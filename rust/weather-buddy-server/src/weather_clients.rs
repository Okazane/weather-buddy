use chrono::{DateTime, Timelike, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;
use weather_buddy_core::{
    HourlyForecastPoint, WeatherProviderType, WeatherSnapshot, WeatherVerificationMeta,
};

const OPEN_METEO_FORECAST_URL: &str = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_AIR_QUALITY_URL: &str = "https://air-quality-api.open-meteo.com/v1/air-quality";
const TOMORROW_FORECAST_URL: &str = "https://api.tomorrow.io/v4/weather/forecast";
const WEATHERAPI_FORECAST_URL: &str = "https://api.weatherapi.com/v1/forecast.json";
const GOOGLE_CURRENT_URL: &str = "https://weather.googleapis.com/v1/currentConditions:lookup";
const GOOGLE_HOURLY_URL: &str = "https://weather.googleapis.com/v1/forecast/hours:lookup";
const NOAA_METAR_URL: &str = "https://aviationweather.gov/api/data/metar";
const MET_NORWAY_COMPACT_URL: &str = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
const CONSENSUS_USER_AGENT: &str =
    "WeatherBuddy/3.0 (https://github.com/Okazane/weather-buddy)";
const CONSENSUS_TIMEOUT_MS: u64 = 2600;
const MAX_METAR_DISTANCE_KM: f64 = 45.0;

fn round1(val: f64) -> f64 {
    if !val.is_finite() {
        return 0.0;
    }
    (val * 10.0).round() / 10.0
}

fn round2(val: f64) -> f64 {
    if !val.is_finite() {
        return 0.0;
    }
    (val * 100.0).round() / 100.0
}

fn clamp_pct(val: f64) -> u8 {
    if !val.is_finite() {
        return 0;
    }
    val.round().clamp(0.0, 100.0) as u8
}

fn format_offset_suffix(utc_offset_seconds: Option<i32>) -> String {
    let Some(sec) = utc_offset_seconds else {
        return "Z".to_string();
    };
    if sec == 0 {
        return "Z".to_string();
    }
    let sign = if sec >= 0 { '+' } else { '-' };
    let abs_min = (sec.abs() + 30) / 60;
    let hours = abs_min / 60;
    let minutes = abs_min % 60;
    format!("{sign}{hours:02}:{minutes:02}")
}

fn normalize_open_meteo_iso(local_time_str: Option<&str>, offset_suffix: &str) -> String {
    let Some(raw) = local_time_str.map(str::trim).filter(|s| !s.is_empty()) else {
        return Utc::now().to_rfc3339();
    };
    if raw.ends_with('Z')
        || raw.ends_with('z')
        || raw
            .get(10..)
            .map_or(false, |tail| tail.contains('+') || tail.contains('-'))
    {
        return raw.to_string();
    }
    let with_seconds = if raw.len() == 16 && raw.as_bytes().get(10) == Some(&b'T') {
        format!("{raw}:00")
    } else {
        raw.to_string()
    };
    format!("{with_seconds}{offset_suffix}")
}

pub fn map_wmo_weather_code(code: Option<i64>, is_day: bool) -> (&'static str, &'static str) {
    match code {
        Some(0) => (
            "CLEAR",
            if is_day {
                "Trời nắng quang đãng"
            } else {
                "Đêm quang đãng"
            },
        ),
        Some(1) => (
            "MOSTLY_CLEAR",
            if is_day {
                "Nắng nhẹ dễ chịu"
            } else {
                "Đêm ít mây"
            },
        ),
        Some(2) => ("PARTLY_CLOUDY", "Có mây rải rác"),
        Some(3) => ("CLOUDY", "Trời nhiều mây"),
        Some(45 | 48) => ("FOG", "Có sương mù nhẹ"),
        Some(51 | 53 | 55 | 56 | 57) => ("DRIZZLE", "Mưa phùn lất phất"),
        Some(61 | 80) => ("LIGHT_RAIN", "Mưa nhỏ rải rác"),
        Some(63 | 81) => ("RAIN", "Mưa rào vừa"),
        Some(65 | 66 | 67 | 82) => ("HEAVY_RAIN", "Mưa to nặng hạt"),
        Some(71 | 73 | 75 | 77 | 85 | 86) => ("SNOW", "Trời lạnh có tuyết"),
        Some(95 | 96 | 99) => ("THUNDERSTORM", "Mưa dông kèm gió giật"),
        _ => (
            "PARTLY_CLOUDY",
            if is_day {
                "Thời tiết dịu nhẹ"
            } else {
                "Đêm mát mẻ"
            },
        ),
    }
}

pub fn calibrate_open_meteo_aqi(raw_aqi: Option<f64>, raw_pm25: Option<f64>) -> Option<u16> {
    let us_aqi = raw_aqi
        .filter(|v| v.is_finite())
        .map(|v| v.round().max(0.0) as u16);
    let pm25_aqi = pm25_to_us_aqi(raw_pm25);

    match (us_aqi, pm25_aqi) {
        (Some(u), Some(p)) => {
            if (u as i32) - (p as i32) > 22 {
                Some(((p as f64) * 0.80 + (u as f64) * 0.20).round().clamp(0.0, 500.0) as u16)
            } else {
                Some(p.max(u))
            }
        }
        (Some(u), None) => Some(u),
        (None, Some(p)) => Some(p),
        (None, None) => None,
    }
}

pub async fn fetch_open_meteo_aqi(client: &Client, lat: f64, lon: f64) -> Option<u16> {
    let url = format!(
        "{OPEN_METEO_AIR_QUALITY_URL}?latitude={lat}&longitude={lon}&current=us_aqi,pm2_5"
    );
    let resp = client.get(&url).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let data = resp.json::<Value>().await.ok()?;
    let current = data.get("current")?;
    let raw_aqi = current.get("us_aqi").and_then(Value::as_f64);
    let raw_pm25 = current.get("pm2_5").and_then(Value::as_f64);
    calibrate_open_meteo_aqi(raw_aqi, raw_pm25)
}

pub async fn fetch_open_meteo_weather(
    client: &Client,
    lat: f64,
    lon: f64,
    location_name: &str,
) -> Result<WeatherSnapshot, String> {
    let forecast_url = format!(
        "{OPEN_METEO_FORECAST_URL}?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m,uv_index&hourly=temperature_2m,precipitation_probability,precipitation,weather_code&minutely_15=precipitation&forecast_minutely_15=2&forecast_days=2&timezone=auto"
    );

    let (forecast_res, aqi_opt) = tokio::join!(
        client.get(&forecast_url).send(),
        fetch_open_meteo_aqi(client, lat, lon)
    );

    let resp = forecast_res.map_err(|e| format!("Open-Meteo request failed: {e}"))?;
    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let text = resp.text().await.unwrap_or_default();
        let snippet: String = text.chars().take(200).collect();
        return Err(format!(
            "Open-Meteo forecast failed (HTTP {status}): {snippet}"
        ));
    }

    let data: Value = resp
        .json()
        .await
        .map_err(|e| format!("Open-Meteo JSON parse failed: {e}"))?;

    let utc_offset_seconds = data
        .get("utc_offset_seconds")
        .and_then(Value::as_i64)
        .map(|v| v as i32);
    let offset_suffix = format_offset_suffix(utc_offset_seconds);

    let current = data.get("current").unwrap_or(&Value::Null);
    let is_day = current.get("is_day").and_then(Value::as_i64).unwrap_or(1) == 1;
    let temperature_c = round1(
        current
            .get("temperature_2m")
            .and_then(Value::as_f64)
            .unwrap_or(25.0),
    );
    let feels_like_c = round1(
        current
            .get("apparent_temperature")
            .and_then(Value::as_f64)
            .unwrap_or(temperature_c),
    );
    let humidity_pct = clamp_pct(
        current
            .get("relative_humidity_2m")
            .and_then(Value::as_f64)
            .unwrap_or(70.0),
    );
    let wind_speed_kmh = round1(
        current
            .get("wind_speed_10m")
            .and_then(Value::as_f64)
            .unwrap_or(0.0),
    )
    .max(0.0);
    let wind_gust_kmh = round1(
        current
            .get("wind_gusts_10m")
            .and_then(Value::as_f64)
            .unwrap_or(wind_speed_kmh),
    )
    .max(wind_speed_kmh);
    let uv_index = round1(
        current
            .get("uv_index")
            .and_then(Value::as_f64)
            .unwrap_or(0.0),
    )
    .max(0.0);

    let minutely15_mm = data
        .get("minutely_15")
        .and_then(|m| m.get("precipitation"))
        .and_then(Value::as_array)
        .map(|arr| {
            arr.iter()
                .take(2)
                .filter_map(Value::as_f64)
                .fold(0.0_f64, f64::max)
        })
        .unwrap_or(0.0);
    let minutely15_rate_per_hr = minutely15_mm * 4.0;
    let current_precip = current
        .get("precipitation")
        .and_then(Value::as_f64)
        .unwrap_or(0.0);
    let precip_mm_per_hr = round2(current_precip.max(minutely15_rate_per_hr)).max(0.0);
    let precip_prob_pct = clamp_pct(
        current
            .get("precipitation_probability")
            .and_then(Value::as_f64)
            .unwrap_or(0.0),
    );

    let weather_code = current.get("weather_code").and_then(Value::as_i64);
    let (_, condition_text_vi) = map_wmo_weather_code(weather_code, is_day);
    let current_time_str = current.get("time").and_then(Value::as_str);
    let updated_at_iso = normalize_open_meteo_iso(current_time_str, &offset_suffix);

    let hourly_obj = data.get("hourly").unwrap_or(&Value::Null);
    let hourly_times = hourly_obj
        .get("time")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let hourly_temps = hourly_obj
        .get("temperature_2m")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let hourly_probs = hourly_obj
        .get("precipitation_probability")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let hourly_precip = hourly_obj
        .get("precipitation")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let hourly_codes = hourly_obj
        .get("weather_code")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let start_idx = if let Some(curr_t) = current_time_str {
        hourly_times
            .iter()
            .position(|v| v.as_str().map_or(false, |t| t > curr_t))
            .unwrap_or(0)
    } else {
        0
    };

    let end_idx = hourly_times.len().min(start_idx + 24);
    let mut hourly = Vec::with_capacity(end_idx.saturating_sub(start_idx));
    for i in start_idx..end_idx {
        let code_val = hourly_codes.get(i).and_then(Value::as_i64);
        let (cond_code, _) = map_wmo_weather_code(code_val, true);
        let time_str = hourly_times.get(i).and_then(Value::as_str);
        hourly.push(HourlyForecastPoint {
            time_iso: normalize_open_meteo_iso(time_str, &offset_suffix),
            temperature_c: round1(
                hourly_temps
                    .get(i)
                    .and_then(Value::as_f64)
                    .unwrap_or(temperature_c),
            ),
            precip_prob_pct: clamp_pct(
                hourly_probs
                    .get(i)
                    .and_then(Value::as_f64)
                    .unwrap_or(0.0),
            ),
            precip_mm: round2(
                hourly_precip
                    .get(i)
                    .and_then(Value::as_f64)
                    .unwrap_or(0.0),
            )
            .max(0.0),
            condition_code: cond_code.to_string(),
        });
    }

    Ok(WeatherSnapshot {
        provider: "open_meteo".to_string(),
        location_name: location_name.to_string(),
        latitude: lat,
        longitude: lon,
        updated_at_iso,
        utc_offset_seconds,
        temperature_c,
        feels_like_c,
        humidity_pct,
        wind_speed_kmh,
        wind_gust_kmh,
        uv_index,
        precip_mm_per_hr,
        precip_prob_pct,
        condition_text: condition_text_vi.to_string(),
        is_day,
        aqi: aqi_opt,
        hourly,
        verification: None,
    })
}

pub fn map_tomorrow_weather_code(code: Option<i64>, is_day: bool) -> (&'static str, &'static str) {
    match code {
        Some(1000) => (
            "CLEAR",
            if is_day {
                "Trời nắng quang đãng"
            } else {
                "Đêm quang đãng"
            },
        ),
        Some(1100) => (
            "MOSTLY_CLEAR",
            if is_day {
                "Nắng nhẹ dễ chịu"
            } else {
                "Đêm ít mây"
            },
        ),
        Some(1101) => ("PARTLY_CLOUDY", "Có mây rải rác"),
        Some(1102 | 1001) => ("CLOUDY", "Trời nhiều mây"),
        Some(2000 | 2100) => ("FOG", "Có sương mù nhẹ"),
        Some(4000) => ("DRIZZLE", "Mưa phùn lất phất"),
        Some(4200) => ("LIGHT_RAIN", "Mưa nhỏ rải rác"),
        Some(4001) => ("RAIN", "Mưa rào vừa"),
        Some(4201) => ("HEAVY_RAIN", "Mưa to nặng hạt"),
        Some(5000 | 5001 | 5100 | 5101 | 6000 | 6001 | 6200 | 6201 | 7000 | 7101 | 7102) => {
            ("SNOW", "Trời rét buốt")
        }
        Some(8000) => ("THUNDERSTORM", "Mưa dông kèm gió giật"),
        _ => (
            "PARTLY_CLOUDY",
            if is_day {
                "Thời tiết dịu nhẹ"
            } else {
                "Đêm mát mẻ"
            },
        ),
    }
}

fn infer_vietnam_daytime(iso_time: &str, lat: f64, lon: f64) -> bool {
    let ts_ms = DateTime::parse_from_rfc3339(iso_time)
        .map(|dt| dt.timestamp_millis())
        .unwrap_or_else(|_| Utc::now().timestamp_millis());
    let is_vn = (8.0..=24.0).contains(&lat) && (102.0..=110.5).contains(&lon);
    let offset_sec: i64 = if is_vn {
        7 * 3600
    } else {
        ((lon / 15.0).round() as i64) * 3600
    };
    if let Some(shifted) = DateTime::<Utc>::from_timestamp_millis(ts_ms + offset_sec * 1000) {
        let local_hour = (shifted.hour() as f64) + (shifted.minute() as f64) / 60.0;
        (6.0..18.25).contains(&local_hour)
    } else {
        true
    }
}

pub async fn fetch_tomorrow_io_weather(
    client: &Client,
    lat: f64,
    lon: f64,
    location_name: &str,
    api_key: &str,
) -> Result<WeatherSnapshot, String> {
    let trimmed = api_key.trim();
    if trimmed.is_empty() {
        return Err("Thiếu Tomorrow.io API Key.".to_string());
    }
    let url = format!(
        "{TOMORROW_FORECAST_URL}?location={lat},{lon}&timesteps=1m,1h&units=metric&apikey={trimmed}"
    );
    let resp = client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Tomorrow.io request failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let text = resp.text().await.unwrap_or_default();
        let snippet: String = text.chars().take(220).collect();
        return Err(format!("Tomorrow.io API failed (HTTP {status}): {snippet}"));
    }

    let data: Value = resp
        .json()
        .await
        .map_err(|e| format!("Tomorrow.io JSON parse failed: {e}"))?;

    let timelines = data.get("timelines").unwrap_or(&Value::Null);
    let minutely = timelines
        .get("minutely")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let hourly_items = timelines
        .get("hourly")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let current_item = minutely
        .first()
        .or_else(|| hourly_items.first())
        .cloned()
        .unwrap_or(Value::Null);
    let values = current_item.get("values").unwrap_or(&Value::Null);
    let hourly_zero = hourly_items
        .first()
        .and_then(|v| v.get("values"))
        .unwrap_or(&Value::Null);

    let updated_at_iso = current_item
        .get("time")
        .and_then(Value::as_str)
        .map(str::to_string)
        .unwrap_or_else(|| Utc::now().to_rfc3339());
    let is_day = infer_vietnam_daytime(&updated_at_iso, lat, lon);

    let pick_f64 = |key: &str, default_val: f64| -> f64 {
        values
            .get(key)
            .and_then(Value::as_f64)
            .or_else(|| hourly_zero.get(key).and_then(Value::as_f64))
            .unwrap_or(default_val)
    };

    let temperature_c = round1(pick_f64("temperature", 26.0));
    let feels_like_c = round1(pick_f64("temperatureApparent", temperature_c));
    let humidity_pct = clamp_pct(pick_f64("humidity", 70.0));
    let wind_speed_kmh = round1(pick_f64("windSpeed", 0.0) * 3.6).max(0.0);
    let wind_gust_kmh = round1(pick_f64("windGust", 0.0) * 3.6).max(wind_speed_kmh);
    let uv_index = round1(pick_f64("uvIndex", 0.0)).max(0.0);

    let next_15m_precip = minutely
        .iter()
        .take(15)
        .filter_map(|item| {
            item.get("values")
                .and_then(|v| v.get("precipitationIntensity"))
                .and_then(Value::as_f64)
        })
        .fold(0.0_f64, f64::max);

    let precip_mm_per_hr =
        round2(pick_f64("precipitationIntensity", 0.0).max(next_15m_precip)).max(0.0);
    let precip_prob_pct = clamp_pct(pick_f64("precipitationProbability", 0.0));
    let weather_code = values
        .get("weatherCode")
        .and_then(Value::as_i64)
        .or_else(|| hourly_zero.get("weatherCode").and_then(Value::as_i64));
    let (_, condition_text_vi) = map_tomorrow_weather_code(weather_code, is_day);

    let hourly: Vec<HourlyForecastPoint> = hourly_items
        .iter()
        .skip(1)
        .take(24)
        .map(|item| {
            let hv = item.get("values").unwrap_or(&Value::Null);
            let time_iso = item
                .get("time")
                .and_then(Value::as_str)
                .map(str::to_string)
                .unwrap_or_else(|| Utc::now().to_rfc3339());
            let code = hv.get("weatherCode").and_then(Value::as_i64);
            let (cond_code, _) =
                map_tomorrow_weather_code(code, infer_vietnam_daytime(&time_iso, lat, lon));
            HourlyForecastPoint {
                time_iso,
                temperature_c: round1(
                    hv.get("temperature")
                        .and_then(Value::as_f64)
                        .unwrap_or(temperature_c),
                ),
                precip_prob_pct: clamp_pct(
                    hv.get("precipitationProbability")
                        .and_then(Value::as_f64)
                        .unwrap_or(0.0),
                ),
                precip_mm: round2(
                    hv.get("precipitationIntensity")
                        .and_then(Value::as_f64)
                        .unwrap_or(0.0),
                )
                .max(0.0),
                condition_code: cond_code.to_string(),
            }
        })
        .collect();

    Ok(WeatherSnapshot {
        provider: "tomorrow_io".to_string(),
        location_name: location_name.to_string(),
        latitude: lat,
        longitude: lon,
        updated_at_iso,
        utc_offset_seconds: None,
        temperature_c,
        feels_like_c,
        humidity_pct,
        wind_speed_kmh,
        wind_gust_kmh,
        uv_index,
        precip_mm_per_hr,
        precip_prob_pct,
        condition_text: condition_text_vi.to_string(),
        is_day,
        aqi: None,
        hourly,
        verification: None,
    })
}

pub fn pm25_to_us_aqi(pm25: Option<f64>) -> Option<u16> {
    let val = pm25.filter(|v| v.is_finite() && *v >= 0.0)?;
    let c = (val * 10.0).floor() / 10.0;
    let breakpoints: [(f64, f64, f64, f64); 6] = [
        (0.0, 9.0, 0.0, 50.0),
        (9.1, 35.4, 51.0, 100.0),
        (35.5, 55.4, 101.0, 150.0),
        (55.5, 125.4, 151.0, 200.0),
        (125.5, 225.4, 201.0, 300.0),
        (225.5, 325.4, 301.0, 500.0),
    ];
    for (c_low, c_high, i_low, i_high) in breakpoints {
        if c <= c_high {
            let aqi = ((i_high - i_low) / (c_high - c_low)) * (c - c_low) + i_low;
            return Some(aqi.round().clamp(0.0, 500.0) as u16);
        }
    }
    Some(500)
}

pub fn map_weatherapi_condition_code(code: Option<i64>) -> &'static str {
    let Some(c) = code else {
        return "PARTLY_CLOUDY";
    };
    if c == 1000 {
        return "CLEAR";
    }
    if c == 1003 {
        return "PARTLY_CLOUDY";
    }
    if c == 1006 || c == 1009 {
        return "CLOUDY";
    }
    if c == 1030 || c == 1135 || c == 1147 {
        return "FOG";
    }
    if c == 1087 || c >= 1273 {
        return "THUNDERSTORM";
    }
    if matches!(c, 1192 | 1195 | 1243 | 1246) {
        return "HEAVY_RAIN";
    }
    if (1150..=1183).contains(&c) {
        return "LIGHT_RAIN";
    }
    if (1063..=1252).contains(&c) {
        return "RAIN";
    }
    "PARTLY_CLOUDY"
}

pub async fn fetch_weatherapi_weather(
    client: &Client,
    lat: f64,
    lon: f64,
    location_name: &str,
    api_key: &str,
) -> Result<WeatherSnapshot, String> {
    let trimmed = api_key.trim();
    if trimmed.is_empty() {
        return Err("Thiếu WeatherAPI.com API Key.".to_string());
    }
    let url = format!(
        "{WEATHERAPI_FORECAST_URL}?key={trimmed}&q={lat},{lon}&days=2&aqi=yes&alerts=no&lang=vi"
    );
    let resp = client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("WeatherAPI.com request failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let text = resp.text().await.unwrap_or_default();
        let snippet: String = text.chars().take(220).collect();
        return Err(format!("WeatherAPI.com failed (HTTP {status}): {snippet}"));
    }

    let data: Value = resp
        .json()
        .await
        .map_err(|e| format!("WeatherAPI.com JSON parse failed: {e}"))?;

    let current = data.get("current").unwrap_or(&Value::Null);
    let is_day = current.get("is_day").and_then(Value::as_i64).unwrap_or(1) == 1;
    let temperature_c = round1(current.get("temp_c").and_then(Value::as_f64).unwrap_or(26.0));
    let feels_like_c = round1(
        current
            .get("feelslike_c")
            .and_then(Value::as_f64)
            .unwrap_or(temperature_c),
    );
    let humidity_pct = clamp_pct(
        current
            .get("humidity")
            .and_then(Value::as_f64)
            .unwrap_or(70.0),
    );
    let wind_speed_kmh = round1(
        current
            .get("wind_kph")
            .and_then(Value::as_f64)
            .unwrap_or(0.0),
    )
    .max(0.0);
    let wind_gust_kmh = round1(
        current
            .get("gust_kph")
            .and_then(Value::as_f64)
            .unwrap_or(wind_speed_kmh),
    )
    .max(wind_speed_kmh);
    let uv_index = round1(current.get("uv").and_then(Value::as_f64).unwrap_or(0.0)).max(0.0);
    let precip_mm_per_hr = round2(
        current
            .get("precip_mm")
            .and_then(Value::as_f64)
            .unwrap_or(0.0),
    )
    .max(0.0);

    let now_epoch = current
        .get("last_updated_epoch")
        .and_then(Value::as_i64)
        .or_else(|| {
            data.get("location")
                .and_then(|l| l.get("localtime_epoch"))
                .and_then(Value::as_i64)
        })
        .unwrap_or_else(|| Utc::now().timestamp());

    let mut all_hours: Vec<Value> = Vec::new();
    if let Some(days) = data
        .get("forecast")
        .and_then(|f| f.get("forecastday"))
        .and_then(Value::as_array)
    {
        for d in days {
            if let Some(hrs) = d.get("hour").and_then(Value::as_array) {
                all_hours.extend(hrs.iter().cloned());
            }
        }
    }

    let upcoming_hours: Vec<&Value> = all_hours
        .iter()
        .filter(|h| h.get("time_epoch").and_then(Value::as_i64).unwrap_or(0) > now_epoch)
        .collect();

    let current_slot = all_hours
        .iter()
        .find(|h| {
            (h.get("time_epoch").and_then(Value::as_i64).unwrap_or(0) - now_epoch).abs() <= 1800
        })
        .or_else(|| upcoming_hours.first().copied());

    let precip_prob_pct = clamp_pct(
        current_slot
            .and_then(|h| h.get("chance_of_rain"))
            .and_then(Value::as_f64)
            .unwrap_or(if precip_mm_per_hr >= 0.2 { 70.0 } else { 10.0 }),
    );

    let updated_at_iso = DateTime::<Utc>::from_timestamp(now_epoch, 0)
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_else(|| Utc::now().to_rfc3339());

    let hourly: Vec<HourlyForecastPoint> = upcoming_hours
        .iter()
        .take(24)
        .map(|h| {
            let epoch = h
                .get("time_epoch")
                .and_then(Value::as_i64)
                .unwrap_or(now_epoch);
            let time_iso = DateTime::<Utc>::from_timestamp(epoch, 0)
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_else(|| Utc::now().to_rfc3339());
            let code = h
                .get("condition")
                .and_then(|c| c.get("code"))
                .and_then(Value::as_i64);
            HourlyForecastPoint {
                time_iso,
                temperature_c: round1(
                    h.get("temp_c")
                        .and_then(Value::as_f64)
                        .unwrap_or(temperature_c),
                ),
                precip_prob_pct: clamp_pct(
                    h.get("chance_of_rain")
                        .and_then(Value::as_f64)
                        .unwrap_or(0.0),
                ),
                precip_mm: round2(h.get("precip_mm").and_then(Value::as_f64).unwrap_or(0.0))
                    .max(0.0),
                condition_code: map_weatherapi_condition_code(code).to_string(),
            }
        })
        .collect();

    let pm25 = current
        .get("air_quality")
        .and_then(|aq| aq.get("pm2_5"))
        .and_then(Value::as_f64);
    let aqi = pm25_to_us_aqi(pm25);

    let condition_text = current
        .get("condition")
        .and_then(|c| c.get("text"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| {
            if is_day {
                "Thời tiết dịu nhẹ".to_string()
            } else {
                "Đêm mát mẻ".to_string()
            }
        });

    Ok(WeatherSnapshot {
        provider: "weatherapi".to_string(),
        location_name: location_name.to_string(),
        latitude: lat,
        longitude: lon,
        updated_at_iso,
        utc_offset_seconds: None,
        temperature_c,
        feels_like_c,
        humidity_pct,
        wind_speed_kmh,
        wind_gust_kmh,
        uv_index,
        precip_mm_per_hr,
        precip_prob_pct,
        condition_text,
        is_day,
        aqi,
        hourly,
        verification: None,
    })
}

pub async fn fetch_google_weather(
    client: &Client,
    lat: f64,
    lon: f64,
    location_name: &str,
    api_key: &str,
) -> Result<WeatherSnapshot, String> {
    let trimmed = api_key.trim();
    if trimmed.is_empty() {
        return Err("Google Weather API key is required.".to_string());
    }
    let current_url = format!(
        "{GOOGLE_CURRENT_URL}?key={trimmed}&location.latitude={lat}&location.longitude={lon}&unitsSystem=METRIC&languageCode=vi"
    );
    let hourly_url = format!(
        "{GOOGLE_HOURLY_URL}?key={trimmed}&location.latitude={lat}&location.longitude={lon}&unitsSystem=METRIC&languageCode=vi&hours=24&pageSize=24"
    );

    let (curr_res, hr_res) = tokio::join!(
        client.get(&current_url).send(),
        client.get(&hourly_url).send()
    );

    let curr_resp = curr_res.map_err(|e| format!("Google Weather request failed: {e}"))?;
    if !curr_resp.status().is_success() {
        let status = curr_resp.status().as_u16();
        let text = curr_resp.text().await.unwrap_or_default();
        let snippet: String = text.chars().take(200).collect();
        return Err(format!(
            "Google Weather currentConditions failed (HTTP {status}): {snippet}"
        ));
    }

    let hr_resp = hr_res.map_err(|e| format!("Google Weather hourly request failed: {e}"))?;
    if !hr_resp.status().is_success() {
        let status = hr_resp.status().as_u16();
        let text = hr_resp.text().await.unwrap_or_default();
        let snippet: String = text.chars().take(200).collect();
        return Err(format!(
            "Google Weather forecast/hours failed (HTTP {status}): {snippet}"
        ));
    }

    let current: Value = curr_resp
        .json()
        .await
        .map_err(|e| format!("Google Weather JSON parse failed: {e}"))?;
    let hourly_resp: Value = hr_resp
        .json()
        .await
        .map_err(|e| format!("Google Weather hourly JSON parse failed: {e}"))?;

    let updated_at_iso = current
        .get("currentTime")
        .and_then(Value::as_str)
        .map(str::to_string)
        .unwrap_or_else(|| Utc::now().to_rfc3339());
    let is_day = current
        .get("isDaytime")
        .and_then(Value::as_bool)
        .unwrap_or(true);

    let to_celsius = |temp_obj: Option<&Value>, fallback: f64| -> f64 {
        let Some(obj) = temp_obj else { return fallback };
        let Some(raw) = obj.get("degrees").and_then(Value::as_f64) else {
            return fallback;
        };
        if obj.get("unit").and_then(Value::as_str) == Some("FAHRENHEIT") {
            round1(((raw - 32.0) * 5.0) / 9.0)
        } else {
            round1(raw)
        }
    };

    let to_kmh = |speed_val: Option<&Value>| -> f64 {
        let Some(v) = speed_val else { return 0.0 };
        if let Some(num) = v.as_f64() {
            return round1(num);
        }
        let Some(raw) = v.get("value").and_then(Value::as_f64) else {
            return 0.0;
        };
        match v.get("unit").and_then(Value::as_str) {
            Some("METERS_PER_SECOND") => round1(raw * 3.6),
            Some("MILES_PER_HOUR") => round1(raw * 1.60934),
            _ => round1(raw),
        }
    };

    let temperature_c = to_celsius(current.get("temperature"), 25.0);
    let feels_like_c = to_celsius(current.get("feelsLikeTemperature"), temperature_c);
    let humidity_pct = clamp_pct(
        current
            .get("relativeHumidity")
            .and_then(Value::as_f64)
            .unwrap_or(65.0),
    );
    let uv_index = round1(
        current
            .get("uvIndex")
            .and_then(Value::as_f64)
            .unwrap_or(0.0),
    )
    .max(0.0);
    let wind_speed_kmh = to_kmh(current.get("wind").and_then(|w| w.get("speed"))).max(0.0);
    let wind_gust_kmh = to_kmh(current.get("wind").and_then(|w| w.get("gust"))).max(wind_speed_kmh);
    let precip_prob_pct = clamp_pct(
        current
            .get("precipitation")
            .and_then(|p| p.get("probability"))
            .and_then(|p| p.get("percent"))
            .and_then(Value::as_f64)
            .unwrap_or(0.0),
    );
    let precip_mm_per_hr = round2(
        current
            .get("precipitation")
            .and_then(|p| p.get("qpf"))
            .and_then(|q| q.get("quantity"))
            .and_then(Value::as_f64)
            .unwrap_or(0.0),
    )
    .max(0.0);

    let condition_text = current
        .get("weatherCondition")
        .and_then(|c| c.get("description"))
        .and_then(|d| d.get("text"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| {
            if is_day {
                "Thời tiết ổn định".to_string()
            } else {
                "Đêm dịu mát".to_string()
            }
        });

    let raw_hours = hourly_resp
        .get("forecastHours")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let hourly: Vec<HourlyForecastPoint> = raw_hours
        .iter()
        .take(24)
        .map(|h| {
            let time_iso = h
                .get("interval")
                .and_then(|iv| iv.get("startTime"))
                .and_then(Value::as_str)
                .map(str::to_string)
                .unwrap_or_else(|| Utc::now().to_rfc3339());
            let cond_code = h
                .get("weatherCondition")
                .and_then(|c| c.get("type"))
                .and_then(Value::as_str)
                .unwrap_or("CLEAR")
                .to_string();
            HourlyForecastPoint {
                time_iso,
                temperature_c: to_celsius(h.get("temperature"), temperature_c),
                precip_prob_pct: clamp_pct(
                    h.get("precipitation")
                        .and_then(|p| p.get("probability"))
                        .and_then(|p| p.get("percent"))
                        .and_then(Value::as_f64)
                        .unwrap_or(0.0),
                ),
                precip_mm: round2(
                    h.get("precipitation")
                        .and_then(|p| p.get("qpf"))
                        .and_then(|q| q.get("quantity"))
                        .and_then(Value::as_f64)
                        .unwrap_or(0.0),
                )
                .max(0.0),
                condition_code: cond_code,
            }
        })
        .collect();

    Ok(WeatherSnapshot {
        provider: "google".to_string(),
        location_name: location_name.to_string(),
        latitude: lat,
        longitude: lon,
        updated_at_iso,
        utc_offset_seconds: None,
        temperature_c,
        feels_like_c,
        humidity_pct,
        wind_speed_kmh,
        wind_gust_kmh,
        uv_index,
        precip_mm_per_hr,
        precip_prob_pct,
        condition_text,
        is_day,
        aqi: None,
        hourly,
        verification: None,
    })
}

#[derive(Debug, Clone)]
pub struct FetchWeatherParams {
    pub latitude: f64,
    pub longitude: f64,
    pub location_name: String,
    pub provider: WeatherProviderType,
    pub tomorrow_io_api_key: String,
    pub weather_api_key: String,
    pub google_api_key: String,
}

async fn enrich_with_open_meteo_aqi(
    client: &Client,
    mut snap: WeatherSnapshot,
    lat: f64,
    lon: f64,
) -> WeatherSnapshot {
    if snap.aqi.is_none() {
        snap.aqi = fetch_open_meteo_aqi(client, lat, lon).await;
    }
    snap
}

/// Multi-provider weather router with `auto` fallback cascade:
/// `Tomorrow.io` -> `WeatherAPI.com` -> `Google Weather` -> `Open-Meteo Free` + US AQI.
pub async fn fetch_weather_snapshot(
    client: &Client,
    params: &FetchWeatherParams,
) -> Result<WeatherSnapshot, (u16, String)> {
    let lat = params.latitude;
    let lon = params.longitude;
    let loc = &params.location_name;
    let t_key = params.tomorrow_io_api_key.trim();
    let w_key = params.weather_api_key.trim();
    let g_key = params.google_api_key.trim();

    match params.provider {
        WeatherProviderType::OpenMeteo => fetch_open_meteo_weather(client, lat, lon, loc)
            .await
            .map_err(|e| (502, e)),

        WeatherProviderType::TomorrowIo => {
            if t_key.is_empty() {
                return Err((
                    400,
                    "Vui lòng nhập Tomorrow.io API Key (miễn phí, không cần thẻ) hoặc chuyển sang Tự động."
                        .to_string(),
                ));
            }
            let snap = fetch_tomorrow_io_weather(client, lat, lon, loc, t_key)
                .await
                .map_err(|e| (502, e))?;
            Ok(enrich_with_open_meteo_aqi(client, snap, lat, lon).await)
        }

        WeatherProviderType::Weatherapi => {
            if w_key.is_empty() {
                return Err((
                    400,
                    "Vui lòng nhập WeatherAPI.com Key (miễn phí 100k lượt/tháng, không cần thẻ) hoặc chuyển sang Tự động."
                        .to_string(),
                ));
            }
            let snap = fetch_weatherapi_weather(client, lat, lon, loc, w_key)
                .await
                .map_err(|e| (502, e))?;
            Ok(enrich_with_open_meteo_aqi(client, snap, lat, lon).await)
        }

        WeatherProviderType::Google => {
            if g_key.is_empty() {
                return Err((
                    400,
                    "Vui lòng nhập Google Cloud Weather API Key để sử dụng nguồn Google Weather."
                        .to_string(),
                ));
            }
            let snap = fetch_google_weather(client, lat, lon, loc, g_key)
                .await
                .map_err(|e| (502, e))?;
            Ok(enrich_with_open_meteo_aqi(client, snap, lat, lon).await)
        }

        WeatherProviderType::Auto => {
            if !t_key.is_empty() {
                if let Ok(snap) = fetch_tomorrow_io_weather(client, lat, lon, loc, t_key).await {
                    return Ok(enrich_with_open_meteo_aqi(client, snap, lat, lon).await);
                }
            }
            if !w_key.is_empty() {
                if let Ok(snap) = fetch_weatherapi_weather(client, lat, lon, loc, w_key).await {
                    return Ok(enrich_with_open_meteo_aqi(client, snap, lat, lon).await);
                }
            }
            if !g_key.is_empty() {
                if let Ok(snap) = fetch_google_weather(client, lat, lon, loc, g_key).await {
                    return Ok(enrich_with_open_meteo_aqi(client, snap, lat, lon).await);
                }
            }
            fetch_open_meteo_weather(client, lat, lon, loc)
                .await
                .map_err(|e| (502, e))
        }
    }
}


// ============================================================================
// Multi-Source Weather Cross-Validation & Ensemble Consensus
// (Open-Meteo + NOAA Aviation METAR Ground Stations + MET Norway ECMWF)
// ============================================================================

#[derive(Debug, Clone, Copy)]
pub struct AirportMetarStation {
    pub icao: &'static str,
    pub name_vi: &'static str,
    pub latitude: f64,
    pub longitude: f64,
}

pub const VIETNAM_METAR_STATIONS: [AirportMetarStation; 18] = [
    AirportMetarStation { icao: "VVTS", name_vi: "Sân bay Tân Sơn Nhất, TP.HCM", latitude: 10.8188, longitude: 106.6519 },
    AirportMetarStation { icao: "VVNB", name_vi: "Sân bay Nội Bài, Hà Nội", latitude: 21.2212, longitude: 105.8072 },
    AirportMetarStation { icao: "VVDN", name_vi: "Sân bay Đà Nẵng", latitude: 16.0439, longitude: 108.1994 },
    AirportMetarStation { icao: "VVCT", name_vi: "Sân bay Cần Thơ", latitude: 10.0851, longitude: 105.7119 },
    AirportMetarStation { icao: "VVCR", name_vi: "Sân bay Cam Ranh, Khánh Hòa", latitude: 12.0067, longitude: 109.2194 },
    AirportMetarStation { icao: "VVPB", name_vi: "Sân bay Phú Bài, Huế", latitude: 16.4015, longitude: 107.7026 },
    AirportMetarStation { icao: "VVCI", name_vi: "Sân bay Cát Bi, Hải Phòng", latitude: 20.8194, longitude: 106.7250 },
    AirportMetarStation { icao: "VVPQ", name_vi: "Sân bay Phú Quốc", latitude: 10.1698, longitude: 103.9931 },
    AirportMetarStation { icao: "VVDL", name_vi: "Sân bay Liên Khương, Đà Lạt", latitude: 11.7500, longitude: 108.3670 },
    AirportMetarStation { icao: "VVVH", name_vi: "Sân bay Vinh, Nghệ An", latitude: 18.7376, longitude: 105.6708 },
    AirportMetarStation { icao: "VVPK", name_vi: "Sân bay Pleiku", latitude: 14.0045, longitude: 108.0172 },
    AirportMetarStation { icao: "VVBM", name_vi: "Sân bay Buôn Ma Thuột", latitude: 12.6683, longitude: 108.1200 },
    AirportMetarStation { icao: "VVTH", name_vi: "Sân bay Tuy Hòa", latitude: 13.0494, longitude: 109.3336 },
    AirportMetarStation { icao: "VVPC", name_vi: "Sân bay Phù Cát, Quy Nhơn", latitude: 13.9550, longitude: 109.0422 },
    AirportMetarStation { icao: "VVDH", name_vi: "Sân bay Đồng Hới", latitude: 17.5150, longitude: 106.5906 },
    AirportMetarStation { icao: "VVTX", name_vi: "Sân bay Thọ Xuân, Thanh Hóa", latitude: 19.9017, longitude: 105.4678 },
    AirportMetarStation { icao: "VVRG", name_vi: "Sân bay Rạch Giá", latitude: 9.9597, longitude: 105.1339 },
    AirportMetarStation { icao: "VVCS", name_vi: "Sân bay Côn Đảo", latitude: 8.7325, longitude: 106.6328 },
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetarObservation {
    pub station_icao: String,
    pub station_name_vi: String,
    pub distance_km: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub observed_at_iso: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub age_minutes: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub temp_c: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dewpoint_c: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub humidity_pct: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wind_speed_kmh: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wx_string: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cloud_cover: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub raw_ob: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetNorwayObservation {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub observed_at_iso: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub temp_c: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub humidity_pct: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub symbol_code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub precip_next_1h_mm: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cloud_area_fraction_pct: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeatherVerificationObservations {
    pub metar: Option<MetarObservation>,
    pub met_norway: Option<MetNorwayObservation>,
    pub fetched_at_iso: String,
}

pub fn haversine_distance_km(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    let r = 6371.0_f64;
    let d_lat = (lat2 - lat1).to_radians();
    let d_lon = (lon2 - lon1).to_radians();
    let a = (d_lat / 2.0).sin().powi(2)
        + lat1.to_radians().cos() * lat2.to_radians().cos() * (d_lon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().atan2((1.0 - a).max(0.0).sqrt());
    round1(r * c)
}

pub fn find_nearest_metar_station(
    lat: f64,
    lon: f64,
    max_distance_km: f64,
) -> Option<(AirportMetarStation, f64)> {
    if !lat.is_finite() || !lon.is_finite() {
        return None;
    }
    let mut best: Option<(AirportMetarStation, f64)> = None;
    for station in VIETNAM_METAR_STATIONS {
        let dist = haversine_distance_km(lat, lon, station.latitude, station.longitude);
        if dist <= max_distance_km && best.map_or(true, |(_, best_dist)| dist < best_dist) {
            best = Some((station, dist));
        }
    }
    best
}

pub fn compute_magnus_humidity_pct(temp_c: f64, dewpoint_c: f64) -> u8 {
    if !temp_c.is_finite() || !dewpoint_c.is_finite() {
        return 70;
    }
    let a = 17.625;
    let b = 243.04;
    let num = ((a * dewpoint_c) / (b + dewpoint_c)).exp();
    let den = ((a * temp_c) / (b + temp_c)).exp();
    if !num.is_finite() || !den.is_finite() || den <= 0.0 {
        return 70;
    }
    ((100.0 * num) / den).round().clamp(5.0, 100.0) as u8
}

fn cloud_cover_rank(code: &str) -> i32 {
    match code {
        "CLR" | "SKC" | "CAVOK" => 0,
        "FEW" => 1,
        "SCT" => 2,
        "BKN" => 3,
        "OVC" => 4,
        _ => -1,
    }
}

fn map_cloud_cover_to_condition_vi(cloud_cover: Option<&str>, is_day: bool) -> &'static str {
    match cloud_cover.unwrap_or("").to_ascii_uppercase().as_str() {
        "FEW" | "CLR" | "SKC" | "CAVOK" => {
            if is_day {
                "Trời nắng quang đãng"
            } else {
                "Đêm quang đãng"
            }
        }
        "SCT" => "Có mây rải rác",
        "BKN" | "OVC" => "Trời nhiều mây",
        _ => {
            if is_day {
                "Có mây rải rác"
            } else {
                "Đêm ít mây"
            }
        }
    }
}

fn parse_metar_payload(
    raw: &Value,
    station: AirportMetarStation,
    distance_km: f64,
    now_ms: i64,
) -> Option<MetarObservation> {
    let item = if let Some(arr) = raw.as_array() {
        arr.first()?
    } else if raw.is_object() {
        raw
    } else {
        return None;
    };

    let mut observed_at_iso = None;
    let mut age_minutes = None;
    if let Some(rt) = item.get("reportTime").and_then(Value::as_str) {
        if let Ok(dt) = DateTime::parse_from_rfc3339(rt.trim()) {
            let obs_ms = dt.timestamp_millis();
            observed_at_iso = Some(dt.with_timezone(&Utc).to_rfc3339());
            age_minutes = Some(round1(((now_ms - obs_ms) as f64 / 60_000.0).max(0.0)));
        }
    } else if let Some(obs_sec) = item.get("obsTime").and_then(Value::as_i64) {
        let obs_ms = if obs_sec > 1_000_000_000_000 {
            obs_sec
        } else {
            obs_sec * 1000
        };
        if let Some(dt) = DateTime::<Utc>::from_timestamp_millis(obs_ms) {
            observed_at_iso = Some(dt.to_rfc3339());
            age_minutes = Some(round1(((now_ms - obs_ms) as f64 / 60_000.0).max(0.0)));
        }
    }

    let temp_c = item.get("temp").and_then(Value::as_f64).map(round1);
    let dewpoint_c = item.get("dewp").and_then(Value::as_f64).map(round1);
    let humidity_pct = match (temp_c, dewpoint_c) {
        (Some(t), Some(d)) => Some(compute_magnus_humidity_pct(t, d)),
        _ => None,
    };
    let wind_speed_kmh = item
        .get("wspd")
        .and_then(Value::as_f64)
        .map(|kt| round1((kt * 1.852).max(0.0)));
    let wx_string = item
        .get("wxString")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    let raw_ob = item
        .get("rawOb")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);

    let mut cloud_cover = item
        .get("cover")
        .and_then(Value::as_str)
        .map(|s| s.trim().to_ascii_uppercase())
        .filter(|s| cloud_cover_rank(s) >= 0);

    if cloud_cover.is_none() {
        if let Some(clouds) = item.get("clouds").and_then(Value::as_array) {
            let mut best_rank = -1;
            for layer in clouds {
                if let Some(c) = layer.get("cover").and_then(Value::as_str) {
                    let up = c.trim().to_ascii_uppercase();
                    let r = cloud_cover_rank(&up);
                    if r > best_rank {
                        best_rank = r;
                        cloud_cover = Some(up);
                    }
                }
            }
        }
    }

    if cloud_cover.is_none() {
        if let Some(raw_str) = raw_ob.as_deref() {
            let up = raw_str.to_ascii_uppercase();
            let tokens: Vec<&str> = up.split_whitespace().collect();
            if tokens.iter().any(|t| matches!(*t, "CAVOK" | "SKC" | "CLR")) {
                cloud_cover = Some("CLR".to_string());
            } else if tokens.iter().any(|t| {
                t.starts_with("OVC")
                    && t.len() == 6
                    && t[3..].chars().all(|c| c.is_ascii_digit())
            }) {
                cloud_cover = Some("OVC".to_string());
            } else if tokens.iter().any(|t| {
                t.starts_with("BKN")
                    && t.len() == 6
                    && t[3..].chars().all(|c| c.is_ascii_digit())
            }) {
                cloud_cover = Some("BKN".to_string());
            } else if tokens.iter().any(|t| {
                t.starts_with("SCT")
                    && t.len() == 6
                    && t[3..].chars().all(|c| c.is_ascii_digit())
            }) {
                cloud_cover = Some("SCT".to_string());
            } else if tokens.iter().any(|t| {
                t.starts_with("FEW")
                    && t.len() == 6
                    && t[3..].chars().all(|c| c.is_ascii_digit())
            }) {
                cloud_cover = Some("FEW".to_string());
            }
        }
    }

    let station_icao = item
        .get("icaoId")
        .and_then(Value::as_str)
        .map(|s| s.trim().to_ascii_uppercase())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| station.icao.to_string());

    Some(MetarObservation {
        station_icao,
        station_name_vi: station.name_vi.to_string(),
        distance_km: round1(distance_km),
        observed_at_iso,
        age_minutes,
        temp_c,
        dewpoint_c,
        humidity_pct,
        wind_speed_kmh,
        wx_string,
        cloud_cover,
        raw_ob,
    })
}

fn parse_met_norway_payload(raw: &Value, now_ms: i64) -> Option<MetNorwayObservation> {
    let timeseries = raw
        .get("properties")
        .and_then(|p| p.get("timeseries"))
        .and_then(Value::as_array)?;
    if timeseries.is_empty() {
        return None;
    }

    let mut best_entry = &timeseries[0];
    let mut best_diff = i64::MAX;
    for candidate in timeseries.iter().take(6) {
        if let Some(ts_str) = candidate.get("time").and_then(Value::as_str) {
            if let Ok(dt) = DateTime::parse_from_rfc3339(ts_str) {
                let diff = (now_ms - dt.timestamp_millis()).abs();
                if diff < best_diff {
                    best_diff = diff;
                    best_entry = candidate;
                }
            }
        }
    }

    let data = best_entry.get("data").unwrap_or(&Value::Null);
    let instant_details = data
        .get("instant")
        .and_then(|i| i.get("details"))
        .unwrap_or(&Value::Null);
    let next1h = data.get("next_1_hours").unwrap_or(&Value::Null);

    let temp_c = instant_details
        .get("air_temperature")
        .and_then(Value::as_f64)
        .map(round1);
    let humidity_pct = instant_details
        .get("relative_humidity")
        .and_then(Value::as_f64)
        .map(clamp_pct);
    let cloud_area_fraction_pct = instant_details
        .get("cloud_area_fraction")
        .and_then(Value::as_f64)
        .map(clamp_pct);
    let symbol_code = next1h
        .get("summary")
        .and_then(|s| s.get("symbol_code"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    let precip_next_1h_mm = next1h
        .get("details")
        .and_then(|d| d.get("precipitation_amount"))
        .and_then(Value::as_f64)
        .map(|v| round2(v.max(0.0)));

    if temp_c.is_none()
        && humidity_pct.is_none()
        && symbol_code.is_none()
        && precip_next_1h_mm.is_none()
    {
        return None;
    }

    Some(MetNorwayObservation {
        observed_at_iso: best_entry
            .get("time")
            .and_then(Value::as_str)
            .map(str::to_string),
        temp_c,
        humidity_pct,
        symbol_code,
        precip_next_1h_mm,
        cloud_area_fraction_pct,
    })
}

pub async fn fetch_secondary_weather_sources(
    client: &Client,
    lat: f64,
    lon: f64,
) -> WeatherVerificationObservations {
    let now = Utc::now();
    let now_ms = now.timestamp_millis();
    let timeout = Duration::from_millis(CONSENSUS_TIMEOUT_MS);

    let nearest = find_nearest_metar_station(lat, lon, MAX_METAR_DISTANCE_KM);
    let metar_fut = async {
        let (station, dist_km) = nearest?;
        let url = format!("{NOAA_METAR_URL}?ids={}&format=json", station.icao);
        let resp = client
            .get(&url)
            .timeout(timeout)
            .header("Accept", "application/json")
            .header("User-Agent", CONSENSUS_USER_AGENT)
            .send()
            .await
            .ok()?;
        if !resp.status().is_success() {
            return None;
        }
        let json: Value = resp.json().await.ok()?;
        parse_metar_payload(&json, station, dist_km, now_ms)
    };

    let met_no_fut = async {
        let url = format!("{MET_NORWAY_COMPACT_URL}?lat={lat:.4}&lon={lon:.4}");
        let resp = client
            .get(&url)
            .timeout(timeout)
            .header("Accept", "application/json")
            .header("User-Agent", CONSENSUS_USER_AGENT)
            .send()
            .await
            .ok()?;
        if !resp.status().is_success() {
            return None;
        }
        let json: Value = resp.json().await.ok()?;
        parse_met_norway_payload(&json, now_ms)
    };

    let (metar, met_norway) = tokio::join!(metar_fut, met_no_fut);

    WeatherVerificationObservations {
        metar,
        met_norway,
        fetched_at_iso: now.to_rfc3339(),
    }
}

fn provider_display_label(provider: &str) -> &str {
    match provider {
        "open_meteo" => "Open-Meteo",
        "tomorrow_io" => "Tomorrow.io",
        "weatherapi" => "WeatherAPI",
        "google" => "Google Weather",
        "demo" => "Demo",
        other => other,
    }
}

fn has_any_precip_or_convective_token(wx: Option<&str>) -> bool {
    let Some(raw) = wx else {
        return false;
    };
    let up = raw.to_ascii_uppercase();
    up.contains("RA") || up.contains("DZ") || up.contains("TS") || up.contains("SH")
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ActiveMetarPrecip {
    ThunderstormOrHeavyRain,
    ThunderstormVicinity,
    LightRain,
}

fn classify_active_metar_precip(wx: Option<&str>) -> Option<ActiveMetarPrecip> {
    let raw = wx?.trim();
    if raw.is_empty() {
        return None;
    }
    let all_tokens: Vec<String> = raw
        .split_whitespace()
        .map(|t| t.to_ascii_uppercase())
        .collect();
    if all_tokens.is_empty() {
        return None;
    }
    let overhead_tokens: Vec<&str> = all_tokens
        .iter()
        .map(String::as_str)
        .filter(|t| !t.starts_with("VC"))
        .collect();

    let has_ts = all_tokens.iter().any(|t| t.contains("TS"));
    let has_overhead_rain_or_shower = overhead_tokens
        .iter()
        .any(|t| t.contains("RA") || t.contains("SH"));
    let has_heavy_rain = overhead_tokens
        .iter()
        .any(|t| t.starts_with('+') && t.contains("RA"));

    if (has_ts && has_overhead_rain_or_shower) || has_heavy_rain {
        return Some(ActiveMetarPrecip::ThunderstormOrHeavyRain);
    }
    if has_ts {
        return Some(ActiveMetarPrecip::ThunderstormVicinity);
    }
    if overhead_tokens
        .iter()
        .any(|t| t.contains("RA") || t.contains("DZ") || t.contains("SH"))
    {
        return Some(ActiveMetarPrecip::LightRain);
    }
    None
}

fn resolve_metar_age_minutes(obs: &MetarObservation, now_ms: i64) -> Option<f64> {
    if let Some(age) = obs.age_minutes {
        if age.is_finite() {
            return Some(age.max(0.0));
        }
    }
    if let Some(iso) = obs.observed_at_iso.as_deref() {
        if let Ok(dt) = DateTime::parse_from_rfc3339(iso) {
            return Some(round1(((now_ms - dt.timestamp_millis()) as f64 / 60_000.0).max(0.0)));
        }
    }
    None
}

pub fn reconcile_weather_consensus(
    mut snapshot: WeatherSnapshot,
    observations: &WeatherVerificationObservations,
    now_ms: i64,
) -> WeatherSnapshot {
    let metar = observations.metar.as_ref();
    let met_no = observations.met_norway.as_ref();

    let metar_age = metar.and_then(|m| resolve_metar_age_minutes(m, now_ms));
    let metar_fresh_dry = metar.map_or(false, |m| {
        m.distance_km <= 45.0 && metar_age.map_or(true, |a| a <= 95.0)
    });
    let metar_fresh_rain = metar.map_or(false, |m| {
        m.distance_km <= 35.0 && metar_age.map_or(true, |a| a <= 75.0)
    });
    let metar_fresh_cal = metar.map_or(false, |m| {
        m.distance_km <= 35.0 && metar_age.map_or(true, |a| a <= 90.0)
    });

    let orig_temp = snapshot.temperature_c;
    let orig_precip = snapshot.precip_mm_per_hr;
    let mut reconciled_rain_adjusted = false;

    // Rule 1a: False-Positive Grid Drizzle Suppression
    let claims_light_drizzle = snapshot.provider == "open_meteo"
        && ((orig_precip >= 0.1 && orig_precip <= 1.5)
            || snapshot.condition_text.contains("Mưa phùn")
            || snapshot.condition_text.contains("Mưa nhỏ"));

    if claims_light_drizzle && metar_fresh_dry {
        if let Some(m) = metar {
            let metar_dry = !has_any_precip_or_convective_token(m.wx_string.as_deref());
            let met_no_dry = met_no
                .and_then(|mn| mn.precip_next_1h_mm)
                .map_or(false, |p| p < 0.2);
            let close_dry_alone = metar_dry && m.distance_km < 25.0 && orig_precip <= 0.6;

            if (metar_dry && met_no_dry) || close_dry_alone {
                snapshot.precip_mm_per_hr = 0.0;
                snapshot.precip_prob_pct = snapshot.precip_prob_pct.min(35);
                snapshot.condition_text =
                    map_cloud_cover_to_condition_vi(m.cloud_cover.as_deref(), snapshot.is_day)
                        .to_string();
                reconciled_rain_adjusted = true;
            }
        }
    }

    // Rule 1b: Dry Close-Range METAR precip_prob_pct Cap (when precip_mm_per_hr < 0.2)
    if let Some(m) = metar {
        let metar_fresh_35 = m.distance_km <= 35.0 && metar_age.map_or(true, |a| a <= 95.0);
        let metar_dry = !has_any_precip_or_convective_token(m.wx_string.as_deref());
        let met_no_low_precip = met_no
            .and_then(|mn| mn.precip_next_1h_mm)
            .map_or(true, |p| p <= 0.3);

        if metar_fresh_35
            && metar_dry
            && snapshot.precip_mm_per_hr < 0.2
            && (met_no_low_precip || m.distance_km <= 15.0)
        {
            if snapshot.precip_prob_pct > 38 {
                snapshot.precip_prob_pct = snapshot.precip_prob_pct.min(38);
                reconciled_rain_adjusted = true;
            }
            if let Some(cov) = m.cloud_cover.as_deref() {
                match cov.to_ascii_uppercase().as_str() {
                    "BKN" | "OVC" => {
                        snapshot.condition_text = "Trời nhiều mây".to_string();
                    }
                    "SCT" => {
                        snapshot.condition_text = "Có mây rải rác".to_string();
                    }
                    _ => {}
                }
            }
        }
    }

    // Rule 2: Real-Time METAR Active Weather / Ground Rain Detection
    if !reconciled_rain_adjusted && metar_fresh_rain {
        if let Some(m) = metar {
            match classify_active_metar_precip(m.wx_string.as_deref()) {
                Some(ActiveMetarPrecip::ThunderstormOrHeavyRain) => {
                    snapshot.precip_mm_per_hr = snapshot.precip_mm_per_hr.max(6.0);
                    snapshot.precip_prob_pct = snapshot.precip_prob_pct.max(88);
                    snapshot.condition_text = "Mưa dông kèm gió giật".to_string();
                    reconciled_rain_adjusted = true;
                }
                Some(ActiveMetarPrecip::ThunderstormVicinity) => {
                    if snapshot.precip_mm_per_hr < 4.5 {
                        snapshot.precip_mm_per_hr = snapshot.precip_mm_per_hr.max(1.8);
                        snapshot.precip_prob_pct = snapshot.precip_prob_pct.max(82);
                        snapshot.condition_text = "Có dông rải rác".to_string();
                        reconciled_rain_adjusted = true;
                    }
                }
                Some(ActiveMetarPrecip::LightRain) => {
                    if snapshot.precip_mm_per_hr < 0.2 {
                        snapshot.precip_mm_per_hr = snapshot.precip_mm_per_hr.max(1.2);
                        snapshot.precip_prob_pct = snapshot.precip_prob_pct.max(72);
                        snapshot.condition_text = "Mưa nhỏ rải rác".to_string();
                        reconciled_rain_adjusted = true;
                    }
                }
                None => {}
            }
        }
    }

    // Rule 3: Physical Thermometer & Humidity Calibration
    if metar_fresh_cal {
        if let Some(m) = metar {
            if let Some(m_temp) = m.temp_c {
                let is_close_fresh =
                    m.distance_km <= 18.0 && metar_age.map_or(true, |a| a <= 75.0);
                let (metar_weight, max_shift) = if is_close_fresh {
                    (0.80, 5.5)
                } else {
                    (0.65, 3.5)
                };
                let model_weight = 1.0 - metar_weight;
                let blended_target = metar_weight * m_temp + model_weight * orig_temp;
                let clamped_delta =
                    round1((blended_target - orig_temp).clamp(-max_shift, max_shift));
                snapshot.temperature_c = round1(orig_temp + clamped_delta);
                snapshot.feels_like_c = round1(snapshot.feels_like_c + clamped_delta);

                let m_hum = m
                    .humidity_pct
                    .or_else(|| m.dewpoint_c.map(|d| compute_magnus_humidity_pct(m_temp, d)));
                if let Some(hum) = m_hum {
                    snapshot.humidity_pct =
                        clamp_pct(0.65 * (hum as f64) + 0.35 * (snapshot.humidity_pct as f64));
                }
            }
        }
    } else if let Some(mn) = met_no {
        if let Some(mn_temp) = mn.temp_c {
            if (mn_temp - orig_temp).abs() <= 4.0 {
                let blended = round1(0.65 * orig_temp + 0.35 * mn_temp);
                let delta = round1(blended - orig_temp);
                snapshot.temperature_c = blended;
                snapshot.feels_like_c = round1(snapshot.feels_like_c + delta);
                if let Some(mn_hum) = mn.humidity_pct {
                    snapshot.humidity_pct =
                        clamp_pct(0.65 * (snapshot.humidity_pct as f64) + 0.35 * (mn_hum as f64));
                }
            }
        }
    }

    // Rule 4: Build WeatherVerificationMeta
    let primary_label = provider_display_label(&snapshot.provider);
    let mut sources_checked = vec![primary_label.to_string()];
    if metar_fresh_dry {
        if let Some(m) = metar {
            sources_checked.push(format!("NOAA METAR ({})", m.station_icao));
        }
    }
    if met_no.is_some() {
        sources_checked.push("MET Norway".to_string());
    }

    let (consensus_level, confidence_pct, summary_vi) = match (metar_fresh_dry, metar, met_no) {
        (true, Some(m), Some(_)) => {
            let temp_agree = m.temp_c.map_or(true, |t| (t - orig_temp).abs() <= 2.5);
            let conf = if reconciled_rain_adjusted {
                90
            } else if temp_agree {
                96
            } else {
                92
            };
            (
                "verified_multi_source".to_string(),
                conf,
                format!(
                    "Đã đối chiếu 3 nguồn: {primary_label} · Trạm sân bay {} ({:.1} km) · MET Norway",
                    m.station_icao, m.distance_km
                ),
            )
        }
        (true, Some(m), None) => {
            let conf = if reconciled_rain_adjusted {
                86
            } else if m.distance_km <= 20.0 {
                92
            } else {
                88
            };
            (
                "verified_multi_source".to_string(),
                conf,
                format!(
                    "Đã đối chiếu {primary_label} · Trạm sân bay {} ({:.1} km)",
                    m.station_icao, m.distance_km
                ),
            )
        }
        (_, _, Some(mn)) => {
            let temp_close = mn.temp_c.map_or(true, |t| (t - orig_temp).abs() <= 2.5);
            let rain_agree = mn
                .precip_next_1h_mm
                .map_or(true, |p| (orig_precip >= 0.2) == (p >= 0.2));
            let conf = if temp_close && rain_agree { 86 } else { 80 };
            (
                "model_consensus".to_string(),
                conf,
                format!("Đã đối chiếu {primary_label} & MET Norway"),
            )
        }
        _ => {
            let conf = if snapshot.provider == "open_meteo" {
                72
            } else {
                80
            };
            (
                "single_source".to_string(),
                conf,
                format!("Dữ liệu đơn nguồn từ {primary_label}"),
            )
        }
    };

    let active_metar = if metar_fresh_dry { metar } else { None };
    snapshot.verification = Some(WeatherVerificationMeta {
        primary_source: snapshot.provider.clone(),
        sources_checked,
        consensus_level,
        confidence_pct,
        metar_station_icao: active_metar.map(|m| m.station_icao.clone()),
        metar_station_name_vi: active_metar.map(|m| m.station_name_vi.clone()),
        metar_distance_km: active_metar.map(|m| m.distance_km),
        metar_observed_at_iso: active_metar.and_then(|m| m.observed_at_iso.clone()),
        metar_temp_c: active_metar.and_then(|m| m.temp_c),
        metar_wx_string: active_metar.and_then(|m| m.wx_string.clone()),
        met_no_symbol_code: met_no.and_then(|mn| mn.symbol_code.clone()),
        met_no_precip_mm: met_no.and_then(|mn| mn.precip_next_1h_mm),
        reconciled_rain_adjusted: if reconciled_rain_adjusted {
            Some(true)
        } else {
            None
        },
        summary_vi,
    });

    snapshot
}

#[cfg(test)]
mod consensus_tests {
    use super::*;

    fn sample_open_meteo_snapshot() -> WeatherSnapshot {
        WeatherSnapshot {
            provider: "open_meteo".to_string(),
            location_name: "TP. Hồ Chí Minh".to_string(),
            latitude: 10.8231,
            longitude: 106.6297,
            updated_at_iso: "2026-11-24T14:00:00+07:00".to_string(),
            utc_offset_seconds: Some(7 * 3600),
            temperature_c: 32.0,
            feels_like_c: 35.0,
            humidity_pct: 68,
            wind_speed_kmh: 10.0,
            wind_gust_kmh: 16.0,
            uv_index: 6.0,
            precip_mm_per_hr: 0.4,
            precip_prob_pct: 65,
            condition_text: "Mưa phùn lất phất".to_string(),
            is_day: true,
            aqi: Some(48),
            hourly: Vec::new(),
            verification: None,
        }
    }

    #[test]
    fn test_nearest_vietnam_metar_station_lookup() {
        let hcmc = find_nearest_metar_station(10.8231, 106.6297, 45.0).expect("VVTS near HCMC");
        assert_eq!(hcmc.0.icao, "VVTS");
        assert!(hcmc.1 < 5.0);

        let hanoi = find_nearest_metar_station(21.0285, 105.8542, 45.0).expect("VVNB near Hanoi");
        assert_eq!(hanoi.0.icao, "VVNB");
        assert!(hanoi.1 < 25.0);

        // Sa Pa is far from any airport (> 45km)
        assert!(find_nearest_metar_station(22.3364, 103.8438, 45.0).is_none());
    }

    #[test]
    fn test_false_positive_drizzle_suppression_and_calibration() {
        let snap = sample_open_meteo_snapshot();
        let obs = WeatherVerificationObservations {
            metar: Some(MetarObservation {
                station_icao: "VVTS".to_string(),
                station_name_vi: "Sân bay Tân Sơn Nhất, TP.HCM".to_string(),
                distance_km: 2.5,
                observed_at_iso: Some("2026-11-24T06:30:00Z".to_string()),
                age_minutes: Some(25.0),
                temp_c: Some(30.0),
                dewpoint_c: Some(25.0),
                humidity_pct: Some(compute_magnus_humidity_pct(30.0, 25.0)),
                wind_speed_kmh: Some(9.3),
                wx_string: None,
                cloud_cover: Some("SCT".to_string()),
                raw_ob: Some("METAR VVTS 240630Z 26005KT 9999 SCT048 30/25 Q1010".to_string()),
            }),
            met_norway: Some(MetNorwayObservation {
                observed_at_iso: Some("2026-11-24T07:00:00Z".to_string()),
                temp_c: Some(31.0),
                humidity_pct: Some(66),
                symbol_code: Some("partlycloudy_day".to_string()),
                precip_next_1h_mm: Some(0.0),
                cloud_area_fraction_pct: Some(45),
            }),
            fetched_at_iso: "2026-11-24T07:00:00Z".to_string(),
        };

        let reconciled = reconcile_weather_consensus(snap, &obs, 1_795_505_400_000);
        assert_eq!(reconciled.precip_mm_per_hr, 0.0);
        assert!(reconciled.precip_prob_pct <= 35);
        assert_eq!(reconciled.condition_text, "Có mây rải rác");
        // Close-range <= 18km: 0.80 * 30.0 + 0.20 * 32.0 = 30.4 (-1.6C delta)
        assert_eq!(reconciled.temperature_c, 30.4);
        assert_eq!(reconciled.feels_like_c, 33.4);
        let ver = reconciled.verification.expect("verification metadata");
        assert_eq!(ver.consensus_level, "verified_multi_source");
        assert_eq!(ver.reconciled_rain_adjusted, Some(true));
        assert!(ver.summary_vi.contains("VVTS"));
    }

    #[test]
    fn test_metar_ground_thunderstorm_overrides_dry_model() {
        let mut snap = sample_open_meteo_snapshot();
        snap.precip_mm_per_hr = 0.0;
        snap.precip_prob_pct = 20;
        snap.condition_text = "Có mây rải rác".to_string();

        let obs = WeatherVerificationObservations {
            metar: Some(MetarObservation {
                station_icao: "VVTS".to_string(),
                station_name_vi: "Sân bay Tân Sơn Nhất, TP.HCM".to_string(),
                distance_km: 6.2,
                observed_at_iso: Some("2026-11-24T06:50:00Z".to_string()),
                age_minutes: Some(10.0),
                temp_c: Some(27.0),
                dewpoint_c: Some(25.0),
                humidity_pct: Some(89),
                wind_speed_kmh: Some(24.0),
                wx_string: Some("+TSRA".to_string()),
                cloud_cover: Some("OVC".to_string()),
                raw_ob: None,
            }),
            met_norway: None,
            fetched_at_iso: "2026-11-24T07:00:00Z".to_string(),
        };

        let reconciled = reconcile_weather_consensus(snap, &obs, 1_795_505_400_000);
        assert!(reconciled.precip_mm_per_hr >= 6.0);
        assert!(reconciled.precip_prob_pct >= 88);
        assert_eq!(reconciled.condition_text, "Mưa dông kèm gió giật");
        // Close-range <= 18km: 0.80 * 27.0 + 0.20 * 32.0 = 28.0 (-4.0C delta, within +-5.5C clamp)
        assert_eq!(reconciled.temperature_c, 28.0);
        assert_eq!(reconciled.feels_like_c, 31.0);
        assert_eq!(
            reconciled.verification.unwrap().reconciled_rain_adjusted,
            Some(true)
        );
    }

    #[test]
    fn test_danang_dry_close_range_metar_caps_high_precip_prob_when_zero_precip() {
        let mut snap = sample_open_meteo_snapshot();
        snap.location_name = "Đà Nẵng".to_string();
        snap.latitude = 16.0544;
        snap.longitude = 108.2022;
        snap.precip_mm_per_hr = 0.0;
        snap.precip_prob_pct = 58;
        snap.condition_text = "Có mây rải rác".to_string();

        let obs = WeatherVerificationObservations {
            metar: Some(MetarObservation {
                station_icao: "VVDN".to_string(),
                station_name_vi: "Sân bay Đà Nẵng".to_string(),
                distance_km: 1.2,
                observed_at_iso: Some("2026-11-24T06:45:00Z".to_string()),
                age_minutes: Some(15.0),
                temp_c: Some(29.0),
                dewpoint_c: Some(23.0),
                humidity_pct: Some(compute_magnus_humidity_pct(29.0, 23.0)),
                wind_speed_kmh: Some(11.0),
                wx_string: None,
                cloud_cover: Some("BKN".to_string()),
                raw_ob: Some("METAR VVDN 240645Z 09006KT 9999 SCT022 BKN053 29/23 Q1012".to_string()),
            }),
            met_norway: None,
            fetched_at_iso: "2026-11-24T07:00:00Z".to_string(),
        };

        let reconciled = reconcile_weather_consensus(snap, &obs, 1_795_505_400_000);
        assert_eq!(reconciled.precip_mm_per_hr, 0.0);
        assert_eq!(reconciled.precip_prob_pct, 38);
        assert_eq!(reconciled.condition_text, "Trời nhiều mây");
        assert_eq!(
            reconciled.verification.unwrap().reconciled_rain_adjusted,
            Some(true)
        );
    }

    #[test]
    fn test_cantho_ts_override_and_close_range_80pct_thermometer_blend() {
        let mut snap = sample_open_meteo_snapshot();
        snap.location_name = "Cần Thơ".to_string();
        snap.latitude = 10.0452;
        snap.longitude = 105.7469;
        snap.temperature_c = 25.9;
        snap.feels_like_c = 27.9;
        snap.precip_mm_per_hr = 0.8;
        snap.precip_prob_pct = 55;
        snap.condition_text = "Mưa phùn lất phất".to_string();

        let obs = WeatherVerificationObservations {
            metar: Some(MetarObservation {
                station_icao: "VVCT".to_string(),
                station_name_vi: "Sân bay Cần Thơ".to_string(),
                distance_km: 5.9,
                observed_at_iso: Some("2026-11-24T06:40:00Z".to_string()),
                age_minutes: Some(20.0),
                temp_c: Some(31.0),
                dewpoint_c: Some(25.0),
                humidity_pct: Some(compute_magnus_humidity_pct(31.0, 25.0)),
                wind_speed_kmh: Some(14.0),
                wx_string: Some("TS".to_string()),
                cloud_cover: Some("SCT".to_string()),
                raw_ob: Some("METAR VVCT 240640Z 22008KT 9999 TS SCT015 FEW017CB 31/25 Q1009".to_string()),
            }),
            met_norway: None,
            fetched_at_iso: "2026-11-24T07:00:00Z".to_string(),
        };

        let reconciled = reconcile_weather_consensus(snap, &obs, 1_795_505_400_000);
        assert!(reconciled.precip_mm_per_hr >= 1.8);
        assert!(reconciled.precip_prob_pct >= 82);
        assert_eq!(reconciled.condition_text, "Có dông rải rác");
        // 0.80 * 31.0 + 0.20 * 25.9 = 29.98 -> +4.1C delta -> 30.0C
        assert_eq!(reconciled.temperature_c, 30.0);
        assert_eq!(reconciled.feels_like_c, 32.0);
        assert_eq!(
            reconciled.verification.unwrap().reconciled_rain_adjusted,
            Some(true)
        );
    }

    #[test]
    fn test_open_meteo_pm25_aqi_calibration_against_cams_ozone_bias() {
        // Legacy us_aqi only (no pm2_5) -> unchanged
        assert_eq!(calibrate_open_meteo_aqi(Some(42.0), None), Some(42));
        // Hanoi CAMS ozone bias case: pm2_5 = 11.2 (pm25_aqi = 55), us_aqi = 94 (diff = 39 > 22)
        // Blended: round(55 * 0.80 + 94 * 0.20) = round(44.0 + 18.8) = 63
        assert_eq!(calibrate_open_meteo_aqi(Some(94.0), Some(11.2)), Some(63));
        // Normal agreement (diff <= 22): takes max(pm25_aqi, us_aqi)
        assert_eq!(calibrate_open_meteo_aqi(Some(58.0), Some(12.0)), Some(58));
    }
}

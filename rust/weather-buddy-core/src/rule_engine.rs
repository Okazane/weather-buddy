use chrono::{DateTime, Timelike, Utc};
use regex::Regex;
use std::sync::OnceLock;

use crate::types::{
    CharacterDecision, CharacterPrefs, CharacterSceneId, SkyTheme, WeatherSnapshot,
};

fn iso_offset_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?([+-]\d{2}:?\d{2})$")
            .expect("valid ISO offset regex")
    })
}

fn parse_iso_timestamp_ms(iso: &str) -> Option<i64> {
    let trimmed = iso.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Ok(dt) = DateTime::parse_from_rfc3339(trimmed) {
        return Some(dt.timestamp_millis());
    }
    // Support offsetless local ISO like "2026-05-15T14:00:00" or "2026-05-15T14:00"
    let candidate = if trimmed.len() == 16 && trimmed.as_bytes().get(10) == Some(&b'T') {
        format!("{trimmed}:00Z")
    } else if !trimmed.ends_with('Z')
        && !trimmed.ends_with('z')
        && trimmed
            .get(10..)
            .map_or(false, |tail| !tail.contains('+') && !tail.contains('-'))
    {
        format!("{trimmed}Z")
    } else {
        trimmed.to_string()
    };
    DateTime::parse_from_rfc3339(&candidate)
        .ok()
        .map(|dt| dt.timestamp_millis())
}

/// Accurately resolves the local wall-clock hour (`0..24`, fractional with minutes)
/// at the target weather location so sky palettes synchronize with real local time-of-day.
pub fn resolve_location_local_hour(weather: &WeatherSnapshot) -> f64 {
    // Priority A: Explicit `utc_offset_seconds` + parseable timestamp
    if let Some(offset_sec) = weather.utc_offset_seconds {
        if !weather.updated_at_iso.is_empty() {
            if let Some(parsed_ms) = parse_iso_timestamp_ms(&weather.updated_at_iso) {
                let shifted_ms = parsed_ms + (offset_sec as i64) * 1000;
                if let Some(dt) = DateTime::<Utc>::from_timestamp_millis(shifted_ms) {
                    return (dt.hour() as f64) + (dt.minute() as f64) / 60.0;
                }
            }
        }
    }

    // Priority B: Explicit non-Z timezone offset suffix in ISO string (e.g. +07:00, -05:00)
    if !weather.updated_at_iso.is_empty() {
        if let Some(caps) = iso_offset_regex().captures(&weather.updated_at_iso) {
            if let (Ok(hh), Ok(mm)) = (caps[1].parse::<f64>(), caps[2].parse::<f64>()) {
                return (((hh + mm / 60.0) % 24.0) + 24.0) % 24.0;
            }
        }
    }

    // Priority C: Fallback from UTC timestamp ('Z'); Vietnam bounding box uses exact UTC+7
    let safe_ms = parse_iso_timestamp_ms(&weather.updated_at_iso)
        .unwrap_or_else(|| Utc::now().timestamp_millis());
    let lat = if weather.latitude.is_finite() {
        weather.latitude
    } else {
        0.0
    };
    let lon = if weather.longitude.is_finite() {
        weather.longitude
    } else {
        0.0
    };
    let is_vietnam_coords =
        (8.0..=24.0).contains(&lat) && (102.0..=110.5).contains(&lon);
    let approx_offset_hrs: i64 = if is_vietnam_coords {
        7
    } else {
        (lon / 15.0).round() as i64
    };
    let shifted_ms = safe_ms + approx_offset_hrs * 3_600_000;
    if let Some(dt) = DateTime::<Utc>::from_timestamp_millis(shifted_ms) {
        (dt.hour() as f64) + (dt.minute() as f64) / 60.0
    } else {
        12.0
    }
}

pub fn resolve_sky_theme(weather: &WeatherSnapshot, scene_id: CharacterSceneId) -> SkyTheme {
    let is_raining = scene_id.is_raining();

    // Nighttime at target location: ONLY nighttime states return dark sky palettes
    if !weather.is_day || scene_id == CharacterSceneId::ClearNight {
        return if is_raining {
            SkyTheme::RainStorm
        } else {
            SkyTheme::Night
        };
    }

    // Daytime at target location (`weather.is_day == true`): NEVER return an `is_dark == true` theme
    if is_raining {
        return SkyTheme::DayRain;
    }

    let local_hour = resolve_location_local_hour(weather);
    let cond_lower = weather.condition_text.to_lowercase();

    // Early Morning / Bình minh (05:00 <= localHour < 7.25)
    if (5.0..7.25).contains(&local_hour)
        || cond_lower.contains("bình minh")
        || cond_lower.contains("sáng sớm")
        || cond_lower.contains("dawn")
        || cond_lower.contains("sunrise")
    {
        return SkyTheme::Dawn;
    }

    // Late Afternoon / Hoàng hôn (16.25 <= localHour < 18.5)
    if (16.25..18.5).contains(&local_hour)
        || cond_lower.contains("hoàng hôn")
        || cond_lower.contains("chiều tà")
        || cond_lower.contains("sunset")
        || cond_lower.contains("dusk")
    {
        return SkyTheme::Sunset;
    }

    // Daytime Cloudy / Overcast / High AQI (07:15 – 16:15)
    let is_cloudy_text = [
        "mây",
        "âm u",
        "sương mù",
        "bụi",
        "cloud",
        "overcast",
        "fog",
        "mist",
        "haze",
    ]
    .iter()
    .any(|kw| cond_lower.contains(kw));

    if is_cloudy_text
        || weather.aqi.unwrap_or(0) >= 150
        || (matches!(
            scene_id,
            CharacterSceneId::ChillyCozy | CharacterSceneId::FreezingPuffer
        ) && weather.uv_index <= 3.0)
    {
        return SkyTheme::DayCloudy;
    }

    // Morning / Midday Clear & Sunny (07:15 – 16:15)
    SkyTheme::DaySunny
}

fn build_vietnamese_copy(
    scene_id: CharacterSceneId,
    effective_temp: f64,
    sky_theme: SkyTheme,
    weather: &WeatherSnapshot,
    has_rain_ahead_prop: bool,
    rain_ahead_hours: Option<u8>,
    has_aqi_mask: bool,
) -> (String, String, String) {
    let headline_vi: String;
    let mut outfit_advice_vi: String;
    let badge_vi: String;

    match scene_id {
        CharacterSceneId::StormRaincoat => {
            badge_vi = "⛈️ Mưa lớn & gió mạnh".to_string();
            headline_vi = "Mưa lớn gió mạnh".to_string();
            outfit_advice_vi = if has_aqi_mask {
                "Mặc áo mưa kín, đeo thêm khẩu trang".to_string()
            } else {
                "Mặc áo mưa kín, tránh cầm ô".to_string()
            };
            return (headline_vi, outfit_advice_vi, badge_vi);
        }
        CharacterSceneId::LightRainUmbrella => {
            badge_vi = "☔ Mưa nhỏ rải rác".to_string();
            headline_vi = "Mưa nhỏ · Cầm ô".to_string();
            outfit_advice_vi = if has_aqi_mask {
                "Mang ô gọn, đeo khẩu trang khi ra đường".to_string()
            } else {
                "Mang ô gọn và áo khoác trượt nước".to_string()
            };
            return (headline_vi, outfit_advice_vi, badge_vi);
        }
        CharacterSceneId::ClearNight => {
            if effective_temp >= 32.0 {
                badge_vi = "🌙 Đêm oi bức".to_string();
                headline_vi = if weather.wind_speed_kmh <= 18.0 {
                    "Đêm oi · Gió nhẹ".to_string()
                } else {
                    "Đêm oi · Có gió".to_string()
                };
                outfit_advice_vi = "Mặc đồ mỏng thoáng mát".to_string();
            } else {
                badge_vi = "🌙 Đêm dịu mát".to_string();
                headline_vi = "Đêm thoáng mát".to_string();
                outfit_advice_vi = if effective_temp < 25.0 {
                    "Mặc thoáng nhẹ, mang theo khoác mỏng".to_string()
                } else {
                    "Mặc đồ gọn nhẹ thoải mái".to_string()
                };
            }
        }
        CharacterSceneId::HotSunny => {
            if weather.uv_index >= 6.0 {
                badge_vi = "🕶️ Nắng gắt & UV cao".to_string();
                headline_vi = "Oi nóng & UV cao".to_string();
                outfit_advice_vi = "Mặc đồ thoáng mát, đeo kính chống nắng".to_string();
            } else {
                badge_vi = "🌡️ Trời oi nóng".to_string();
                headline_vi = "Trời oi nóng".to_string();
                outfit_advice_vi = "Mặc đồ mỏng thoáng mát, uống đủ nước".to_string();
            }
        }
        CharacterSceneId::PleasantSunny => {
            if sky_theme == SkyTheme::DayCloudy {
                badge_vi = "⛅ Trời dịu mát".to_string();
                headline_vi = "Nhiều mây dịu mát".to_string();
            } else {
                badge_vi = "🌤️ Nắng đẹp".to_string();
                headline_vi = "Trời nắng dịu".to_string();
            }
            outfit_advice_vi = if weather.uv_index >= 6.0 && sky_theme != SkyTheme::DayCloudy {
                "Mặc đồ thoáng nhẹ, thoa kem chống nắng".to_string()
            } else {
                "Mặc trang phục gọn nhẹ thoải mái".to_string()
            };
        }
        CharacterSceneId::ChillyCozy => {
            badge_vi = if weather.is_day {
                "🍂 Trời se lạnh".to_string()
            } else {
                "🌙 Đêm se lạnh".to_string()
            };
            headline_vi = if weather.is_day {
                "Trời se lạnh".to_string()
            } else {
                "Đêm se lạnh".to_string()
            };
            outfit_advice_vi = "Khoác áo mỏng khi ra ngoài".to_string();
        }
        CharacterSceneId::FreezingPuffer => {
            badge_vi = if weather.is_day {
                "🧣 Trời rét đậm".to_string()
            } else {
                "🧣 Đêm rét đậm".to_string()
            };
            headline_vi = if weather.is_day {
                "Trời rét đậm".to_string()
            } else {
                "Đêm rét đậm".to_string()
            };
            outfit_advice_vi = "Mặc áo phao dày, giữ ấm cổ".to_string();
        }
    }

    if let (true, Some(hours), true) = (has_rain_ahead_prop, rain_ahead_hours, has_aqi_mask) {
        outfit_advice_vi = format!("Mang sẵn ô, mưa sau {hours}h · Đeo khẩu trang");
    } else if let (true, Some(hours)) = (has_rain_ahead_prop, rain_ahead_hours) {
        outfit_advice_vi = format!("Mang sẵn ô, dự báo mưa sau {hours}h");
    } else if has_aqi_mask {
        if matches!(
            scene_id,
            CharacterSceneId::FreezingPuffer | CharacterSceneId::ChillyCozy
        ) {
            outfit_advice_vi = "Mặc đủ ấm, đeo khẩu trang lọc bụi".to_string();
        } else if scene_id == CharacterSceneId::HotSunny && weather.uv_index >= 6.0 {
            outfit_advice_vi = "Chống nắng kỹ, đeo khẩu trang lọc bụi".to_string();
        } else {
            outfit_advice_vi = "Mặc thoáng nhẹ, đeo khẩu trang lọc bụi".to_string();
        }
    }

    (headline_vi, outfit_advice_vi, badge_vi)
}

/// Evaluates the deterministic character outfit decision tree, foresight rain-ahead prop,
/// AQI mask overlay, local time-of-day sky palette, and natural Vietnamese guidance copy.
pub fn evaluate_character_decision(
    weather: &WeatherSnapshot,
    prefs: CharacterPrefs,
) -> CharacterDecision {
    let effective_temp = weather.feels_like_c + prefs.sensitivity.delta_celsius();

    // Priority 1: Heavy rain / storm raincoat (day or night)
    let scene_id = if weather.precip_mm_per_hr >= 4.5
        || (weather.precip_prob_pct >= 60 && weather.wind_gust_kmh >= 32.0)
    {
        CharacterSceneId::StormRaincoat
    } else if weather.precip_mm_per_hr >= 0.2 || weather.precip_prob_pct >= 50 {
        // Priority 2: Light rain with umbrella (day or night)
        CharacterSceneId::LightRainUmbrella
    } else if !weather.is_day {
        // Nighttime (not raining): NEVER return hot_sunny or pleasant_sunny
        if effective_temp >= 22.0 {
            CharacterSceneId::ClearNight
        } else if effective_temp >= 16.0 {
            CharacterSceneId::ChillyCozy
        } else {
            CharacterSceneId::FreezingPuffer
        }
    } else if effective_temp >= 33.0 || weather.uv_index >= 8.0 {
        CharacterSceneId::HotSunny
    } else if effective_temp >= 22.0 {
        CharacterSceneId::PleasantSunny
    } else if effective_temp >= 16.0 {
        CharacterSceneId::ChillyCozy
    } else {
        CharacterSceneId::FreezingPuffer
    };

    // Foresight Rain-Ahead Prop: active ONLY when not currently raining
    let is_currently_raining = scene_id.is_raining();
    let mut has_rain_ahead_prop = false;
    let mut rain_ahead_hours: Option<u8> = None;

    if !is_currently_raining {
        for (i, hour_point) in weather.hourly.iter().take(6).enumerate() {
            if hour_point.precip_prob_pct >= 65 || hour_point.precip_mm >= 1.0 {
                has_rain_ahead_prop = true;
                rain_ahead_hours = Some((i + 1) as u8);
                break;
            }
        }
    }

    let has_aqi_mask = weather.aqi.unwrap_or(0) >= 130;
    let sky_theme = resolve_sky_theme(weather, scene_id);

    let (headline_vi, outfit_advice_vi, badge_vi) = build_vietnamese_copy(
        scene_id,
        effective_temp,
        sky_theme,
        weather,
        has_rain_ahead_prop,
        rain_ahead_hours,
        has_aqi_mask,
    );

    CharacterDecision {
        scene_id,
        gender: prefs.gender,
        has_rain_ahead_prop,
        rain_ahead_hours,
        has_aqi_mask,
        sky_theme,
        headline_vi,
        outfit_advice_vi,
        badge_vi,
    }
}

use chrono::{DateTime, Timelike, Utc};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use weather_buddy_core::WeatherSnapshot;

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

fn local_offset_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:[+-]\d{2}:?\d{2})?$")
            .expect("valid hour label regex")
    })
}

/// Formats an ISO timestamp into a concise local-clock `HH:mm` label while preserving
/// explicit timezone offsets embedded in Open-Meteo / provider ISO strings.
pub fn format_hour_label_vi(time_iso: &str, fallback_index: usize) -> String {
    let trimmed = time_iso.trim();
    if trimmed.is_empty() {
        return format!("+{}h", fallback_index + 1);
    }

    if !trimmed.ends_with('Z') && !trimmed.ends_with('z') {
        if let Some(caps) = local_offset_regex().captures(trimmed) {
            return format!("{}:{}", &caps[1], &caps[2]);
        }
    }

    if let Ok(parsed) = DateTime::parse_from_rfc3339(trimmed) {
        let ict_ms = parsed.timestamp_millis() + 7 * 3_600_000;
        if let Some(ict_dt) = DateTime::<Utc>::from_timestamp_millis(ict_ms) {
            return format!("{:02}:{:02}", ict_dt.hour(), ict_dt.minute());
        }
    }

    format!("+{}h", fallback_index + 1)
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticsHourlyPoint {
    pub time_iso: String,
    pub hour_label: String,
    pub temperature_c: f64,
    pub precip_prob_pct: u8,
    pub precip_mm: f64,
    pub condition_code: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Analytics24h {
    pub temp_min_c: f64,
    pub temp_max_c: f64,
    pub temp_avg_c: f64,
    pub max_precip_prob_pct: u8,
    pub total_precip_mm: f64,
    pub rain_hours_count: usize,
    pub peak_rain_hour_iso: Option<String>,
    pub peak_rain_hour_label: Option<String>,
    pub comfort_index_vi: String,
    pub hourly_series: Vec<AnalyticsHourlyPoint>,
}

pub fn compute_comfort_index_vi(
    snapshot: &WeatherSnapshot,
    max_precip_prob_pct: u8,
    rain_hours_count: usize,
) -> String {
    let feels_like = snapshot.feels_like_c;
    let uv = snapshot.uv_index;
    let aqi = snapshot.aqi.unwrap_or(0);
    let precip_now = snapshot.precip_mm_per_hr;
    let wind_gust = snapshot.wind_gust_kmh;

    if precip_now >= 4.5 || (max_precip_prob_pct >= 80 && wind_gust >= 32.0) {
        return "Mưa dông ẩm ướt · Hạn chế di chuyển ngoài trời".to_string();
    }
    if precip_now >= 0.2 || snapshot.precip_prob_pct >= 55 {
        return "Trời mưa ẩm · Nên mang áo mưa hoặc ô gọn".to_string();
    }
    if aqi >= 150 {
        return "Chất lượng không khí kém · Nên đeo khẩu trang lọc bụi".to_string();
    }
    if feels_like >= 35.0 || uv >= 9.0 {
        return "Oi bức & tia UV gắt · Cần chống nắng và bù nước".to_string();
    }
    if feels_like >= 31.0 {
        return if rain_hours_count > 0 {
            "Nóng ẩm, có khả năng mưa rào · Ưu tiên đồ thoáng & mang sẵn ô".to_string()
        } else {
            "Khá nóng ẩm · Ưu tiên trang phục thoáng nhẹ".to_string()
        };
    }
    if feels_like < 15.0 {
        return "Rét đậm vùng cao · Giữ ấm kỹ cổ và cơ thể".to_string();
    }
    if feels_like < 21.0 {
        return "Se lạnh dễ chịu · Khoác nhẹ khi ra ngoài".to_string();
    }
    if rain_hours_count > 0 {
        return "Mát mẻ nhưng có khung giờ mưa · Nên mang theo ô gọn".to_string();
    }
    "Dễ chịu thoáng mát · Lý tưởng cho hoạt động ngoài trời".to_string()
}

/// Aggregates 24-hour temperature, precipitation, and comfort metrics from a `WeatherSnapshot`.
pub fn compute_analytics_24h(snapshot: &WeatherSnapshot) -> Analytics24h {
    let mut hourly_series: Vec<AnalyticsHourlyPoint> = snapshot
        .hourly
        .iter()
        .take(24)
        .enumerate()
        .map(|(idx, pt)| AnalyticsHourlyPoint {
            time_iso: pt.time_iso.clone(),
            hour_label: format_hour_label_vi(&pt.time_iso, idx),
            temperature_c: round1(pt.temperature_c),
            precip_prob_pct: pt.precip_prob_pct.min(100),
            precip_mm: round2(pt.precip_mm.max(0.0)),
            condition_code: if pt.condition_code.is_empty() {
                "PARTLY_CLOUDY".to_string()
            } else {
                pt.condition_code.clone()
            },
        })
        .collect();

    if hourly_series.is_empty() {
        let fallback_iso = if snapshot.updated_at_iso.is_empty() {
            Utc::now().to_rfc3339()
        } else {
            snapshot.updated_at_iso.clone()
        };
        hourly_series.push(AnalyticsHourlyPoint {
            hour_label: format_hour_label_vi(&fallback_iso, 0),
            time_iso: fallback_iso,
            temperature_c: round1(snapshot.temperature_c),
            precip_prob_pct: clamp_pct(snapshot.precip_prob_pct as f64),
            precip_mm: round2(snapshot.precip_mm_per_hr.max(0.0)),
            condition_code: "PARTLY_CLOUDY".to_string(),
        });
    }

    let mut temp_min_c = f64::INFINITY;
    let mut temp_max_c = f64::NEG_INFINITY;
    let mut temp_sum = 0.0;
    let mut max_precip_prob_pct: u8 = 0;
    let mut total_precip_mm = 0.0;
    let mut rain_hours_count: usize = 0;
    let mut peak_index: Option<usize> = None;
    let mut peak_score = -1.0_f64;

    for (idx, pt) in hourly_series.iter().enumerate() {
        if pt.temperature_c < temp_min_c {
            temp_min_c = pt.temperature_c;
        }
        if pt.temperature_c > temp_max_c {
            temp_max_c = pt.temperature_c;
        }
        temp_sum += pt.temperature_c;

        if pt.precip_prob_pct > max_precip_prob_pct {
            max_precip_prob_pct = pt.precip_prob_pct;
        }
        total_precip_mm += pt.precip_mm;

        if pt.precip_prob_pct >= 50 || pt.precip_mm >= 0.2 {
            rain_hours_count += 1;
        }

        let rain_score = (pt.precip_prob_pct as f64) + pt.precip_mm * 25.0;
        if rain_score > peak_score {
            peak_score = rain_score;
            peak_index = Some(idx);
        }
    }

    let count = (hourly_series.len().max(1)) as f64;
    let temp_avg_c = round1(temp_sum / count);
    let temp_min_c = if temp_min_c.is_finite() {
        round1(temp_min_c)
    } else {
        temp_avg_c
    };
    let temp_max_c = if temp_max_c.is_finite() {
        round1(temp_max_c)
    } else {
        temp_avg_c
    };
    let total_precip_mm = round2(total_precip_mm);

    let has_meaningful_rain_risk =
        max_precip_prob_pct >= 25 || total_precip_mm >= 0.1 || rain_hours_count > 0;

    let (peak_rain_hour_iso, peak_rain_hour_label) = match (has_meaningful_rain_risk, peak_index) {
        (true, Some(idx)) => (
            Some(hourly_series[idx].time_iso.clone()),
            Some(hourly_series[idx].hour_label.clone()),
        ),
        _ => (None, None),
    };

    let comfort_index_vi =
        compute_comfort_index_vi(snapshot, max_precip_prob_pct, rain_hours_count);

    Analytics24h {
        temp_min_c,
        temp_max_c,
        temp_avg_c,
        max_precip_prob_pct,
        total_precip_mm,
        rain_hours_count,
        peak_rain_hour_iso,
        peak_rain_hour_label,
        comfort_index_vi,
        hourly_series,
    }
}

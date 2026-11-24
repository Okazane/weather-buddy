use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::RwLock;
use uuid::Uuid;
use weather_buddy_core::{CharacterSceneId, Gender, WeatherSnapshot};

pub const MAX_TELEMETRY_ENTRIES: usize = 50;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HourlyMiniPoint {
    pub hour_label: String,
    pub temp_c: i32,
    pub precip_prob_pct: u8,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WidgetSyncPayload {
    pub gender: Gender,
    pub character_name_vi: String,
    pub scene_id: CharacterSceneId,
    pub location_name: String,
    pub latitude: f64,
    pub longitude: f64,
    pub temperature_c: i32,
    pub feels_like_c: i32,
    pub condition_text: String,
    pub headline_vi: String,
    pub outfit_advice_vi: String,
    pub badge_vi: String,
    pub has_rain_ahead_prop: bool,
    pub rain_ahead_hours: Option<u8>,
    pub has_aqi_mask: bool,
    pub sky_theme: String,
    pub updated_at_iso: String,
    pub hourly_mini: Vec<HourlyMiniPoint>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WidgetSyncRecord {
    pub synced_at_iso: String,
    pub payload: WidgetSyncPayload,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryEntry {
    pub id: String,
    pub timestamp_iso: String,
    pub timestamp: String,
    pub location_name: String,
    pub city: String,
    pub latitude: f64,
    pub longitude: f64,
    pub provider_used: String,
    pub provider: String,
    pub cache_hit: bool,
    pub latency_ms: u64,
    pub temperature_c: f64,
    pub temp_c: f64,
    pub feels_like_c: f64,
    pub precip_prob_pct: u8,
    pub uv_index: f64,
    pub aqi: Option<u16>,
}

fn truncate_chars(s: &str, max_chars: usize) -> String {
    s.trim().chars().take(max_chars).collect()
}

fn round_decimals(val: f64, places: u32) -> f64 {
    if !val.is_finite() {
        return 0.0;
    }
    let factor = 10_f64.powi(places as i32);
    (val * factor).round() / factor
}

fn value_as_f64(val: Option<&Value>) -> Option<f64> {
    match val {
        Some(Value::Number(n)) => n.as_f64(),
        Some(Value::String(s)) => s.trim().parse::<f64>().ok(),
        _ => None,
    }
}

fn value_as_str(val: Option<&Value>) -> Option<&str> {
    val.and_then(Value::as_str)
}

/// Validates and normalizes an incoming `WidgetSyncPayload`, stripping unknown properties
/// so arbitrary fields or secrets can never be written to `widget_sync.json`.
pub fn sanitize_widget_sync_payload(raw_input: &Value) -> Result<WidgetSyncPayload, String> {
    let Some(root_obj) = raw_input.as_object() else {
        return Err("Payload đồng bộ Widget không hợp lệ (cần JSON object).".to_string());
    };

    let candidate = root_obj
        .get("payload")
        .and_then(Value::as_object)
        .unwrap_or(root_obj);

    let location_name = value_as_str(candidate.get("locationName"))
        .unwrap_or("")
        .trim();
    if location_name.is_empty() {
        return Err("Thiếu trường bắt buộc: locationName.".to_string());
    }

    let Some(temperature_raw) = value_as_f64(candidate.get("temperatureC")) else {
        return Err("Thiếu hoặc sai kiểu trường bắt buộc: temperatureC.".to_string());
    };
    if !temperature_raw.is_finite() {
        return Err("Thiếu hoặc sai kiểu trường bắt buộc: temperatureC.".to_string());
    }

    let gender = Gender::from_str_lossy(value_as_str(candidate.get("gender")).unwrap_or("female"));
    let scene_id = CharacterSceneId::parse_lossy(
        value_as_str(candidate.get("sceneId")).unwrap_or("pleasant_sunny"),
    );

    let latitude = value_as_f64(candidate.get("latitude"))
        .map(|v| round_decimals(v, 5))
        .unwrap_or(0.0);
    let longitude = value_as_f64(candidate.get("longitude"))
        .map(|v| round_decimals(v, 5))
        .unwrap_or(0.0);

    let temperature_c = temperature_raw.round() as i32;
    let feels_like_c = value_as_f64(candidate.get("feelsLikeC"))
        .filter(|v| v.is_finite())
        .map(|v| v.round() as i32)
        .unwrap_or(temperature_c);

    let hourly_mini: Vec<HourlyMiniPoint> = candidate
        .get("hourlyMini")
        .and_then(Value::as_array)
        .map(|arr| {
            arr.iter()
                .take(8)
                .enumerate()
                .map(|(idx, pt)| {
                    let hour_label = pt
                        .get("hourLabel")
                        .and_then(Value::as_str)
                        .map(|s| truncate_chars(s, 16))
                        .filter(|s| !s.is_empty())
                        .unwrap_or_else(|| format!("+{}h", idx + 1));
                    let temp_c = value_as_f64(pt.get("tempC"))
                        .filter(|v| v.is_finite())
                        .map(|v| v.round() as i32)
                        .unwrap_or(temperature_c);
                    let precip_prob_pct = value_as_f64(pt.get("precipProbPct"))
                        .filter(|v| v.is_finite())
                        .map(|v| v.round().clamp(0.0, 100.0) as u8)
                        .unwrap_or(0);
                    HourlyMiniPoint {
                        hour_label,
                        temp_c,
                        precip_prob_pct,
                    }
                })
                .collect()
        })
        .unwrap_or_default();

    let rain_ahead_hours = value_as_f64(candidate.get("rainAheadHours"))
        .filter(|v| v.is_finite() && *v >= 0.0)
        .map(|v| v.round().clamp(0.0, 24.0) as u8);

    let character_name_vi = value_as_str(candidate.get("characterNameVi"))
        .map(|s| truncate_chars(s, 80))
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| gender.default_character_name_vi().to_string());

    let updated_at_iso = value_as_str(candidate.get("updatedAtIso"))
        .map(|s| truncate_chars(s, 64))
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| Utc::now().to_rfc3339());

    let sky_theme = value_as_str(candidate.get("skyTheme"))
        .map(|s| truncate_chars(s, 40))
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "day_sunny".to_string());

    Ok(WidgetSyncPayload {
        gender,
        character_name_vi,
        scene_id,
        location_name: truncate_chars(location_name, 120),
        latitude,
        longitude,
        temperature_c,
        feels_like_c,
        condition_text: truncate_chars(
            value_as_str(candidate.get("conditionText")).unwrap_or(""),
            160,
        ),
        headline_vi: truncate_chars(
            value_as_str(candidate.get("headlineVi")).unwrap_or(""),
            160,
        ),
        outfit_advice_vi: truncate_chars(
            value_as_str(candidate.get("outfitAdviceVi")).unwrap_or(""),
            240,
        ),
        badge_vi: truncate_chars(value_as_str(candidate.get("badgeVi")).unwrap_or(""), 120),
        has_rain_ahead_prop: candidate
            .get("hasRainAheadProp")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        rain_ahead_hours,
        has_aqi_mask: candidate
            .get("hasAqiMask")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        sky_theme,
        updated_at_iso,
        hourly_mini,
    })
}

/// Builds an anonymized telemetry log entry with zero user credentials.
pub fn build_telemetry_entry(
    snapshot: &WeatherSnapshot,
    cache_hit: bool,
    latency_ms: u64,
) -> TelemetryEntry {
    let timestamp_iso = Utc::now().to_rfc3339();
    let provider_used = if snapshot.provider.is_empty() {
        "open_meteo".to_string()
    } else {
        snapshot.provider.clone()
    };
    let location_name = if snapshot.location_name.trim().is_empty() {
        "Vị trí hiện tại".to_string()
    } else {
        truncate_chars(&snapshot.location_name, 120)
    };
    let temperature_c = round_decimals(snapshot.temperature_c, 1);
    let feels_like_c = round_decimals(snapshot.feels_like_c, 1);

    TelemetryEntry {
        id: Uuid::new_v4().to_string(),
        timestamp_iso: timestamp_iso.clone(),
        timestamp: timestamp_iso,
        location_name: location_name.clone(),
        city: location_name,
        latitude: round_decimals(snapshot.latitude, 4),
        longitude: round_decimals(snapshot.longitude, 4),
        provider_used: provider_used.clone(),
        provider: provider_used,
        cache_hit,
        latency_ms,
        temperature_c,
        temp_c: temperature_c,
        feels_like_c,
        precip_prob_pct: snapshot.precip_prob_pct.min(100),
        uv_index: round_decimals(snapshot.uv_index, 1),
        aqi: snapshot.aqi,
    }
}

pub struct RuntimeStore {
    runtime_dir: PathBuf,
    telemetry_path: PathBuf,
    widget_sync_path: PathBuf,
    telemetry_entries: RwLock<Vec<TelemetryEntry>>,
    widget_record: RwLock<Option<WidgetSyncRecord>>,
}

impl RuntimeStore {
    pub fn new(runtime_dir: impl AsRef<Path>) -> Self {
        let runtime_dir = runtime_dir.as_ref().to_path_buf();
        let telemetry_path = runtime_dir.join("telemetry.json");
        let widget_sync_path = runtime_dir.join("widget_sync.json");

        let store = Self {
            runtime_dir,
            telemetry_path,
            widget_sync_path,
            telemetry_entries: RwLock::new(Vec::new()),
            widget_record: RwLock::new(None),
        };
        store.load_from_disk_sync();
        store
    }

    pub fn runtime_dir(&self) -> &Path {
        &self.runtime_dir
    }

    fn load_from_disk_sync(&self) {
        if let Ok(raw) = fs::read_to_string(&self.telemetry_path) {
            if let Ok(parsed) = serde_json::from_str::<Value>(&raw) {
                let entries_val = if parsed.is_array() {
                    Some(&parsed)
                } else {
                    parsed.get("entries")
                };
                if let Some(arr) = entries_val {
                    if let Ok(mut entries) =
                        serde_json::from_value::<Vec<TelemetryEntry>>(arr.clone())
                    {
                        entries.truncate(MAX_TELEMETRY_ENTRIES);
                        if let Ok(mut guard) = self.telemetry_entries.write() {
                            *guard = entries;
                        }
                    }
                }
            }
        }

        if let Ok(raw) = fs::read_to_string(&self.widget_sync_path) {
            if let Ok(parsed) = serde_json::from_str::<Value>(&raw) {
                if let Ok(payload) = sanitize_widget_sync_payload(&parsed) {
                    let synced_at_iso = parsed
                        .get("syncedAtIso")
                        .and_then(Value::as_str)
                        .map(str::to_string)
                        .unwrap_or_else(|| payload.updated_at_iso.clone());
                    if let Ok(mut guard) = self.widget_record.write() {
                        *guard = Some(WidgetSyncRecord {
                            synced_at_iso,
                            payload,
                        });
                    }
                }
            }
        }
    }

    fn atomic_write_json<T: Serialize>(&self, target_path: &Path, data: &T) -> std::io::Result<()> {
        fs::create_dir_all(&self.runtime_dir)?;
        let tmp_name = format!(
            "{}.{}.tmp",
            target_path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("runtime"),
            Uuid::new_v4()
        );
        let tmp_path = self.runtime_dir.join(tmp_name);
        let serialized = format!("{}\n", serde_json::to_string_pretty(data)?);
        fs::write(&tmp_path, serialized)?;
        if let Err(err) = fs::rename(&tmp_path, target_path) {
            let _ = fs::remove_file(&tmp_path);
            return Err(err);
        }
        Ok(())
    }

    pub fn record_telemetry(&self, entry: TelemetryEntry) {
        let snapshot_to_persist = {
            let mut guard = self.telemetry_entries.write().expect("telemetry lock");
            guard.insert(0, entry.clone());
            guard.truncate(MAX_TELEMETRY_ENTRIES);
            guard.clone()
        };
        let wrapper = serde_json::json!({
            "updatedAtIso": entry.timestamp_iso,
            "entries": snapshot_to_persist,
        });
        let _ = self.atomic_write_json(&self.telemetry_path, &wrapper);
    }

    pub fn get_recent_telemetry(&self, limit: usize) -> Vec<TelemetryEntry> {
        let capped = limit.clamp(1, MAX_TELEMETRY_ENTRIES);
        let guard = self.telemetry_entries.read().expect("telemetry read lock");
        guard.iter().take(capped).cloned().collect()
    }

    pub fn save_widget_sync(&self, raw_payload: &Value) -> Result<WidgetSyncRecord, String> {
        let payload = sanitize_widget_sync_payload(raw_payload)?;
        let record = WidgetSyncRecord {
            synced_at_iso: Utc::now().to_rfc3339(),
            payload,
        };
        {
            let mut guard = self.widget_record.write().expect("widget write lock");
            *guard = Some(record.clone());
        }
        let _ = self.atomic_write_json(&self.widget_sync_path, &record);
        Ok(record)
    }

    pub fn get_widget_sync(&self) -> Option<WidgetSyncRecord> {
        self.widget_record
            .read()
            .expect("widget read lock")
            .clone()
    }

    pub fn clear_widget_sync(&self) {
        {
            let mut guard = self.widget_record.write().expect("widget write lock");
            *guard = None;
        }
        let _ = fs::remove_file(&self.widget_sync_path);
    }
}

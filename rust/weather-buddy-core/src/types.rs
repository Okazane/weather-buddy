use serde::{Deserialize, Serialize};

pub const AUTO_REFRESH_INTERVAL_MINUTES: u64 = 15;
pub const AUTO_REFRESH_INTERVAL_MS: u64 = AUTO_REFRESH_INTERVAL_MINUTES * 60 * 1000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum Gender {
    Male,
    #[default]
    Female,
}

impl Gender {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Male => "male",
            Self::Female => "female",
        }
    }

    pub fn default_character_name_vi(&self) -> &'static str {
        match self {
            Self::Male => "Cậu bé Mây",
            Self::Female => "Cô bé Nắng",
        }
    }

    pub fn from_str_lossy(raw: &str) -> Self {
        if raw.trim().eq_ignore_ascii_case("male") {
            Self::Male
        } else {
            Self::Female
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum ThermalSensitivity {
    ColdSensitive,
    #[default]
    Normal,
    HeatSensitive,
}

impl ThermalSensitivity {
    pub fn delta_celsius(&self) -> f64 {
        match self {
            Self::ColdSensitive => -3.0,
            Self::Normal => 0.0,
            Self::HeatSensitive => 3.0,
        }
    }

    pub fn from_str_lossy(raw: &str) -> Self {
        match raw.trim() {
            "cold_sensitive" => Self::ColdSensitive,
            "heat_sensitive" => Self::HeatSensitive,
            _ => Self::Normal,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum WeatherProviderType {
    #[default]
    Auto,
    TomorrowIo,
    Weatherapi,
    Google,
    OpenMeteo,
}

impl WeatherProviderType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Auto => "auto",
            Self::TomorrowIo => "tomorrow_io",
            Self::Weatherapi => "weatherapi",
            Self::Google => "google",
            Self::OpenMeteo => "open_meteo",
        }
    }

    pub fn parse_strict(raw: &str) -> Option<Self> {
        match raw.trim() {
            "auto" => Some(Self::Auto),
            "tomorrow_io" => Some(Self::TomorrowIo),
            "weatherapi" => Some(Self::Weatherapi),
            "google" => Some(Self::Google),
            "open_meteo" => Some(Self::OpenMeteo),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CharacterSceneId {
    StormRaincoat,
    LightRainUmbrella,
    HotSunny,
    PleasantSunny,
    ClearNight,
    ChillyCozy,
    FreezingPuffer,
}

impl CharacterSceneId {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::StormRaincoat => "storm_raincoat",
            Self::LightRainUmbrella => "light_rain_umbrella",
            Self::HotSunny => "hot_sunny",
            Self::PleasantSunny => "pleasant_sunny",
            Self::ClearNight => "clear_night",
            Self::ChillyCozy => "chilly_cozy",
            Self::FreezingPuffer => "freezing_puffer",
        }
    }

    pub fn parse_lossy(raw: &str) -> Self {
        match raw.trim() {
            "storm_raincoat" => Self::StormRaincoat,
            "light_rain_umbrella" => Self::LightRainUmbrella,
            "hot_sunny" => Self::HotSunny,
            "pleasant_sunny" => Self::PleasantSunny,
            "clear_night" => Self::ClearNight,
            "chilly_cozy" => Self::ChillyCozy,
            "freezing_puffer" => Self::FreezingPuffer,
            _ => Self::PleasantSunny,
        }
    }

    pub fn is_raining(&self) -> bool {
        matches!(self, Self::StormRaincoat | Self::LightRainUmbrella)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SkyTheme {
    Dawn,
    DaySunny,
    DayCloudy,
    DayRain,
    RainStorm,
    Sunset,
    Night,
}

impl SkyTheme {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Dawn => "dawn",
            Self::DaySunny => "day_sunny",
            Self::DayCloudy => "day_cloudy",
            Self::DayRain => "day_rain",
            Self::RainStorm => "rain_storm",
            Self::Sunset => "sunset",
            Self::Night => "night",
        }
    }

    pub fn is_dark(&self) -> bool {
        matches!(self, Self::Night | Self::RainStorm)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HourlyForecastPoint {
    pub time_iso: String,
    pub temperature_c: f64,
    pub precip_prob_pct: u8,
    pub precip_mm: f64,
    pub condition_code: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeatherVerificationMeta {
    pub primary_source: String,
    pub sources_checked: Vec<String>,
    pub consensus_level: String,
    pub confidence_pct: u8,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metar_station_icao: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metar_station_name_vi: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metar_distance_km: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metar_observed_at_iso: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metar_temp_c: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metar_wx_string: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub met_no_symbol_code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub met_no_precip_mm: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reconciled_rain_adjusted: Option<bool>,
    pub summary_vi: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeatherSnapshot {
    pub provider: String,
    pub location_name: String,
    pub latitude: f64,
    pub longitude: f64,
    pub updated_at_iso: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub utc_offset_seconds: Option<i32>,
    pub temperature_c: f64,
    pub feels_like_c: f64,
    pub humidity_pct: u8,
    pub wind_speed_kmh: f64,
    pub wind_gust_kmh: f64,
    pub uv_index: f64,
    pub precip_mm_per_hr: f64,
    pub precip_prob_pct: u8,
    pub condition_text: String,
    pub is_day: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aqi: Option<u16>,
    pub hourly: Vec<HourlyForecastPoint>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verification: Option<WeatherVerificationMeta>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CharacterDecision {
    pub scene_id: CharacterSceneId,
    pub gender: Gender,
    pub has_rain_ahead_prop: bool,
    pub rain_ahead_hours: Option<u8>,
    pub has_aqi_mask: bool,
    pub sky_theme: SkyTheme,
    pub headline_vi: String,
    pub outfit_advice_vi: String,
    pub badge_vi: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CharacterPrefs {
    pub gender: Gender,
    pub sensitivity: ThermalSensitivity,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetCity {
    pub id: &'static str,
    pub name_vi: &'static str,
    pub region_vi: &'static str,
    pub latitude: f64,
    pub longitude: f64,
}

pub const PRESET_CITIES: [PresetCity; 6] = [
    PresetCity {
        id: "ha_noi",
        name_vi: "Hà Nội",
        region_vi: "Miền Bắc",
        latitude: 21.0285,
        longitude: 105.8542,
    },
    PresetCity {
        id: "tp_hcm",
        name_vi: "TP. Hồ Chí Minh",
        region_vi: "Miền Nam",
        latitude: 10.8231,
        longitude: 106.6297,
    },
    PresetCity {
        id: "da_lat",
        name_vi: "Đà Lạt",
        region_vi: "Tây Nguyên",
        latitude: 11.9404,
        longitude: 108.4583,
    },
    PresetCity {
        id: "da_nang",
        name_vi: "Đà Nẵng",
        region_vi: "Miền Trung",
        latitude: 16.0544,
        longitude: 108.2022,
    },
    PresetCity {
        id: "sa_pa",
        name_vi: "Sa Pa",
        region_vi: "Tây Bắc",
        latitude: 22.3364,
        longitude: 103.8438,
    },
    PresetCity {
        id: "can_tho",
        name_vi: "Cần Thơ",
        region_vi: "Miền Tây",
        latitude: 10.0452,
        longitude: 105.7469,
    },
];

pub fn find_nearest_preset_city(lat: f64, lon: f64, max_radius_deg: f64) -> Option<PresetCity> {
    let mut best: Option<(f64, PresetCity)> = None;
    for city in PRESET_CITIES {
        let d_lat = lat - city.latitude;
        let d_lon = lon - city.longitude;
        let dist_sq = d_lat * d_lat + d_lon * d_lon;
        if best.map_or(true, |(best_sq, _)| dist_sq < best_sq) {
            best = Some((dist_sq, city));
        }
    }
    if let Some((dist_sq, city)) = best {
        if dist_sq <= max_radius_deg * max_radius_deg {
            return Some(city);
        }
    }
    None
}

pub fn infer_city_name(lat: f64, lon: f64, explicit_name: Option<&str>) -> String {
    if let Some(raw) = explicit_name {
        let trimmed = raw.trim();
        if !trimmed.is_empty() {
            return trimmed.chars().take(120).collect();
        }
    }
    for preset in PRESET_CITIES {
        if (lat - preset.latitude).abs() <= 0.08 && (lon - preset.longitude).abs() <= 0.08 {
            return preset.name_vi.to_string();
        }
    }
    "Vị trí hiện tại".to_string()
}

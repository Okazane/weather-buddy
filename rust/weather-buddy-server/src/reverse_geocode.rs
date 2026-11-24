use dashmap::DashMap;
use regex::Regex;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::{OnceLock, RwLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use weather_buddy_core::find_nearest_preset_city;

const GEOCODE_CACHE_TTL_MS: u64 = 6 * 60 * 60 * 1000; // 6 hours
const AUTO_LOCATE_CACHE_TTL_MS: u64 = 15 * 60 * 1000; // 15 minutes
const MAX_GEOCODE_CACHE_SIZE: usize = 200;

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn round5(val: f64) -> f64 {
    if !val.is_finite() {
        return 0.0;
    }
    (val * 100_000.0).round() / 100_000.0
}

fn ascii_city_rules() -> &'static Vec<(Regex, &'static str)> {
    static RULES: OnceLock<Vec<(Regex, &'static str)>> = OnceLock::new();
    RULES.get_or_init(|| {
        vec![
            (
                Regex::new(r"(?i)^ho chi minh(?: city)?$").unwrap(),
                "TP. Hồ Chí Minh",
            ),
            (
                Regex::new(r"(?i)^thanh pho ho chi minh$").unwrap(),
                "TP. Hồ Chí Minh",
            ),
            (Regex::new(r"(?i)^saigon$").unwrap(), "TP. Hồ Chí Minh"),
            (Regex::new(r"(?i)^ha noi$|^hanoi$").unwrap(), "Hà Nội"),
            (Regex::new(r"(?i)^da nang$|^danang$").unwrap(), "Đà Nẵng"),
            (Regex::new(r"(?i)^da lat$|^dalat$").unwrap(), "Đà Lạt"),
            (Regex::new(r"(?i)^can tho$|^cantho$").unwrap(), "Cần Thơ"),
            (
                Regex::new(r"(?i)^hai phong$|^haiphong$").unwrap(),
                "Hải Phòng",
            ),
            (Regex::new(r"(?i)^nha trang$").unwrap(), "Nha Trang"),
            (Regex::new(r"(?i)^binh duong$").unwrap(), "Bình Dương"),
            (Regex::new(r"(?i)^dong nai$").unwrap(), "Đồng Nai"),
            (
                Regex::new(r"(?i)^ba ria\s*-?\s*vung tau$|^vung tau$").unwrap(),
                "Vũng Tàu",
            ),
            (
                Regex::new(r"(?i)^hue$|^thua thien hue$").unwrap(),
                "Huế",
            ),
        ]
    })
}

pub fn clean_vietnamese_place_token(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    static TP_RE: OnceLock<Regex> = OnceLock::new();
    static TINH_RE: OnceLock<Regex> = OnceLock::new();
    static WS_RE: OnceLock<Regex> = OnceLock::new();

    let tp_re = TP_RE.get_or_init(|| Regex::new(r"(?i)^Thành phố\s+").unwrap());
    let tinh_re = TINH_RE.get_or_init(|| Regex::new(r"(?i)^Tỉnh\s+").unwrap());
    let ws_re = WS_RE.get_or_init(|| Regex::new(r"\s+").unwrap());

    let step1 = tp_re.replace(trimmed, "TP. ");
    let step2 = tinh_re.replace(&step1, "");
    let cleaned = ws_re.replace_all(step2.trim(), " ").into_owned();

    for (pattern, vi_name) in ascii_city_rules() {
        if pattern.is_match(&cleaned) {
            return (*vi_name).to_string();
        }
    }
    cleaned
}

fn compose_vietnamese_location_name(district: &str, city: &str) -> String {
    if !district.is_empty() && !city.is_empty() {
        let d_low = district.to_lowercase();
        let c_low = city.to_lowercase();
        if d_low != c_low && !c_low.contains(&d_low) && !d_low.contains(&c_low) {
            return format!("{district}, {city}");
        }
    }
    if !city.is_empty() {
        return city.to_string();
    }
    if !district.is_empty() {
        return district.to_string();
    }
    String::new()
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReverseGeocodeResult {
    pub location_name: String,
    pub district: String,
    pub city: String,
    pub country: String,
    pub latitude: f64,
    pub longitude: f64,
    pub cache_hit: bool,
}

#[derive(Debug, Clone)]
struct CachedGeocode {
    value: ReverseGeocodeResult,
    expires_at_ms: u64,
}

pub struct ReverseGeocoder {
    client: Client,
    cache: DashMap<String, CachedGeocode>,
}

impl ReverseGeocoder {
    pub fn new(client: Client) -> Self {
        Self {
            client,
            cache: DashMap::new(),
        }
    }

    async fn fetch_json(&self, url: &str, timeout_ms: u64) -> Option<Value> {
        let resp = self
            .client
            .get(url)
            .header("Accept", "application/json")
            .header("Accept-Language", "vi")
            .header("User-Agent", "WeatherBuddy/3.1")
            .timeout(Duration::from_millis(timeout_ms))
            .send()
            .await
            .ok()?;
        if !resp.status().is_success() {
            return None;
        }
        resp.json::<Value>().await.ok()
    }

    pub async fn reverse_geocode(
        &self,
        latitude: f64,
        longitude: f64,
        city_only: bool,
    ) -> ReverseGeocodeResult {
        let lat = round5(latitude);
        let lon = round5(longitude);
        let cache_key = format!(
            "{:.3},{:.3}:{}",
            latitude,
            longitude,
            if city_only { "city" } else { "full" }
        );

        let now = now_ms();
        if let Some(entry) = self.cache.get(&cache_key) {
            if entry.expires_at_ms > now {
                let mut res = entry.value.clone();
                res.latitude = lat;
                res.longitude = lon;
                res.cache_hit = true;
                return res;
            }
        }

        // 1. Primary lookup: BigDataCloud Vietnamese reverse geocoding
        let bdc_url = format!(
            "https://api.bigdatacloud.net/data/reverse-geocode-client?latitude={lat}&longitude={lon}&localityLanguage=vi"
        );
        let mut district = String::new();
        let mut city = String::new();
        let mut country = String::new();

        if let Some(bdc_data) = self.fetch_json(&bdc_url, 3800).await {
            district = clean_vietnamese_place_token(
                bdc_data
                    .get("locality")
                    .and_then(Value::as_str)
                    .unwrap_or(""),
            );
            let city_raw = bdc_data
                .get("city")
                .and_then(Value::as_str)
                .filter(|s| !s.trim().is_empty())
                .or_else(|| {
                    bdc_data
                        .get("principalSubdivision")
                        .and_then(Value::as_str)
                })
                .unwrap_or("");
            city = clean_vietnamese_place_token(city_raw);
            country = bdc_data
                .get("countryName")
                .and_then(Value::as_str)
                .unwrap_or("")
                .trim()
                .to_string();
        }

        // 2. Fallback lookup: OpenStreetMap Nominatim
        if district.is_empty() && city.is_empty() {
            let nom_url = format!(
                "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={lat}&lon={lon}&accept-language=vi"
            );
            if let Some(nom_data) = self.fetch_json(&nom_url, 4200).await {
                if let Some(addr) = nom_data.get("address").and_then(Value::as_object) {
                    let dist_raw = [
                        "city_district",
                        "district",
                        "county",
                        "suburb",
                        "town",
                        "village",
                    ]
                    .iter()
                    .find_map(|k| addr.get(*k).and_then(Value::as_str))
                    .unwrap_or("");
                    district = clean_vietnamese_place_token(dist_raw);

                    let city_raw = ["city", "state", "province"]
                        .iter()
                        .find_map(|k| addr.get(*k).and_then(Value::as_str))
                        .unwrap_or("");
                    city = clean_vietnamese_place_token(city_raw);

                    if let Some(c) = addr.get("country").and_then(Value::as_str) {
                        if !c.trim().is_empty() {
                            country = c.trim().to_string();
                        }
                    }
                }
            }
        }

        let mut location_name = if city_only {
            if !city.is_empty() {
                city.clone()
            } else {
                district.clone()
            }
        } else {
            compose_vietnamese_location_name(&district, &city)
        };

        // 3. Offline / fallback to nearest Vietnamese preset city
        if location_name.is_empty() {
            if let Some(nearest) = find_nearest_preset_city(lat, lon, 0.25) {
                city = nearest.name_vi.to_string();
                location_name = nearest.name_vi.to_string();
            } else {
                location_name = "Vị trí hiện tại".to_string();
            }
            if country.is_empty() {
                country = "Việt Nam".to_string();
            }
        }

        let result = ReverseGeocodeResult {
            location_name: location_name.clone(),
            district: if city_only {
                String::new()
            } else {
                district
            },
            city: if city.is_empty() {
                location_name
            } else {
                city
            },
            country: if country.is_empty() {
                "Việt Nam".to_string()
            } else {
                country
            },
            latitude: lat,
            longitude: lon,
            cache_hit: false,
        };

        if self.cache.len() >= MAX_GEOCODE_CACHE_SIZE {
            self.cache.retain(|_, v| v.expires_at_ms > now);
            while self.cache.len() >= MAX_GEOCODE_CACHE_SIZE {
                let Some(evict_key) = self.cache.iter().next().map(|e| e.key().clone()) else {
                    break;
                };
                self.cache.remove(&evict_key);
            }
        }
        self.cache.insert(
            cache_key,
            CachedGeocode {
                value: result.clone(),
                expires_at_ms: now + GEOCODE_CACHE_TTL_MS,
            },
        );

        result
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoLocateResult {
    pub status: String,
    pub source: String,
    pub provider: String,
    pub latitude: f64,
    pub longitude: f64,
    pub location_name: String,
    pub city: String,
    pub country: String,
    pub cache_hit: bool,
}

#[derive(Debug, Clone)]
struct CachedAutoLocate {
    value: AutoLocateResult,
    expires_at_ms: u64,
}

/// Optional Windows Native `Windows::Devices::Geolocation::Geolocator` hardware Wi-Fi/GPS lookup
/// with 2.5s timeout before cascading to IP geolocation providers.
#[cfg(target_os = "windows")]
pub async fn try_windows_native_geolocation() -> Option<(f64, f64)> {
    use windows::Devices::Geolocation::{GeolocationAccessStatus, Geolocator};

    let task = tokio::task::spawn_blocking(|| -> Option<(f64, f64)> {
        let access = Geolocator::RequestAccessAsync().ok()?.get().ok()?;
        if access != GeolocationAccessStatus::Allowed {
            return None;
        }
        let locator = Geolocator::new().ok()?;
        let pos = locator.GetGeopositionAsync().ok()?.get().ok()?;
        let coord = pos.Coordinate().ok()?;
        let point = coord.Point().ok()?;
        let basic = point.Position().ok()?;
        if basic.Latitude.is_finite()
            && basic.Longitude.is_finite()
            && (basic.Latitude != 0.0 || basic.Longitude != 0.0)
        {
            Some((round5(basic.Latitude), round5(basic.Longitude)))
        } else {
            None
        }
    });

    tokio::time::timeout(Duration::from_millis(2500), task)
        .await
        .ok()?
        .ok()?
}

#[cfg(not(target_os = "windows"))]
pub async fn try_windows_native_geolocation() -> Option<(f64, f64)> {
    None
}

pub struct AutoLocator {
    client: Client,
    cached: RwLock<Option<CachedAutoLocate>>,
    enable_windows_native_gps: bool,
}

impl AutoLocator {
    pub fn new(client: Client, enable_windows_native_gps: bool) -> Self {
        Self {
            client,
            cached: RwLock::new(None),
            enable_windows_native_gps,
        }
    }

    async fn fetch_json(&self, url: &str, timeout_ms: u64) -> Option<Value> {
        let resp = self
            .client
            .get(url)
            .header("Accept", "application/json")
            .header("User-Agent", "WeatherBuddy/3.1")
            .timeout(Duration::from_millis(timeout_ms))
            .send()
            .await
            .ok()?;
        if !resp.status().is_success() {
            return None;
        }
        resp.json::<Value>().await.ok()
    }

    pub async fn auto_locate(
        &self,
        reverse_geocoder: &ReverseGeocoder,
        force: bool,
    ) -> Result<AutoLocateResult, String> {
        let now = now_ms();
        if !force {
            if let Ok(guard) = self.cached.read() {
                if let Some(entry) = guard.as_ref() {
                    if entry.expires_at_ms > now {
                        let mut res = entry.value.clone();
                        res.cache_hit = true;
                        return Ok(res);
                    }
                }
            }
        }

        let mut coords: Option<(f64, f64)> = None;
        let mut raw_city = String::new();
        let mut raw_country = String::new();
        let mut provider_used = String::new();

        // 0. Optional Windows Native Geolocator (Wi-Fi / GPS hardware sensor with 2.5s timeout)
        if self.enable_windows_native_gps {
            if let Some((win_lat, win_lon)) = try_windows_native_geolocation().await {
                coords = Some((win_lat, win_lon));
                provider_used = "windows-geolocator".to_string();
            }
        }

        // 1. Primary IP geolocation: ipwho.is
        if coords.is_none() {
            if let Some(ipwho) = self.fetch_json("https://ipwho.is/?lang=vi", 3200).await {
                let success = ipwho
                    .get("success")
                    .and_then(Value::as_bool)
                    .unwrap_or(true);
                if success {
                    if let (Some(lat), Some(lon)) = (
                        ipwho.get("latitude").and_then(Value::as_f64),
                        ipwho.get("longitude").and_then(Value::as_f64),
                    ) {
                        if lat.is_finite() && lon.is_finite() {
                            coords = Some((round5(lat), round5(lon)));
                            let city_token = ipwho
                                .get("city")
                                .and_then(Value::as_str)
                                .filter(|s| !s.trim().is_empty())
                                .or_else(|| ipwho.get("region").and_then(Value::as_str))
                                .unwrap_or("");
                            raw_city = clean_vietnamese_place_token(city_token);
                            raw_country = ipwho
                                .get("country")
                                .and_then(Value::as_str)
                                .unwrap_or("Việt Nam")
                                .trim()
                                .to_string();
                            provider_used = "ipwho.is".to_string();
                        }
                    }
                }
            }
        }

        // 2. Fallback IP geolocation: BigDataCloud client-IP mode
        if coords.is_none() {
            if let Some(bdc) = self
                .fetch_json(
                    "https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=vi",
                    3500,
                )
                .await
            {
                if let (Some(lat), Some(lon)) = (
                    bdc.get("latitude").and_then(Value::as_f64),
                    bdc.get("longitude").and_then(Value::as_f64),
                ) {
                    if lat.is_finite() && lon.is_finite() {
                        coords = Some((round5(lat), round5(lon)));
                        let city_token = ["city", "principalSubdivision", "locality"]
                            .iter()
                            .find_map(|k| {
                                bdc.get(*k)
                                    .and_then(Value::as_str)
                                    .filter(|s| !s.trim().is_empty())
                            })
                            .unwrap_or("");
                        raw_city = clean_vietnamese_place_token(city_token);
                        raw_country = bdc
                            .get("countryName")
                            .and_then(Value::as_str)
                            .unwrap_or("Việt Nam")
                            .trim()
                            .to_string();
                        provider_used = "bigdatacloud".to_string();
                    }
                }
            }
        }

        // 3. Tertiary IP geolocation: GeoJS
        if coords.is_none() {
            if let Some(geojs) = self
                .fetch_json("https://get.geojs.io/v1/ip/geo.json", 3200)
                .await
            {
                let lat_opt = geojs
                    .get("latitude")
                    .and_then(Value::as_str)
                    .and_then(|s| s.parse::<f64>().ok())
                    .or_else(|| geojs.get("latitude").and_then(Value::as_f64));
                let lon_opt = geojs
                    .get("longitude")
                    .and_then(Value::as_str)
                    .and_then(|s| s.parse::<f64>().ok())
                    .or_else(|| geojs.get("longitude").and_then(Value::as_f64));

                if let (Some(lat), Some(lon)) = (lat_opt, lon_opt) {
                    if lat.is_finite() && lon.is_finite() {
                        coords = Some((round5(lat), round5(lon)));
                        let city_token = geojs
                            .get("city")
                            .and_then(Value::as_str)
                            .filter(|s| !s.trim().is_empty())
                            .or_else(|| geojs.get("region").and_then(Value::as_str))
                            .unwrap_or("");
                        raw_city = clean_vietnamese_place_token(city_token);
                        raw_country = geojs
                            .get("country")
                            .and_then(Value::as_str)
                            .unwrap_or("Việt Nam")
                            .trim()
                            .to_string();
                        provider_used = "geojs".to_string();
                    }
                }
            }
        }

        let Some((lat, lon)) = coords else {
            return Err("Không thể tự động xác định vị trí qua mạng lúc này.".to_string());
        };

        let mut location_name = raw_city;
        let is_ascii_only = !location_name.is_empty()
            && location_name
                .chars()
                .all(|c| c.is_ascii_alphabetic() || c == ' ' || c == '.' || c == '-');

        if location_name.is_empty() || is_ascii_only {
            let rev = reverse_geocoder.reverse_geocode(lat, lon, true).await;
            if !rev.location_name.is_empty() {
                location_name = rev.location_name;
            }
        }

        if location_name.is_empty() {
            location_name = find_nearest_preset_city(lat, lon, 0.25)
                .map(|c| c.name_vi.to_string())
                .unwrap_or_else(|| "Vị trí hiện tại".to_string());
        }

        let source = if provider_used == "windows-geolocator" {
            "gps".to_string()
        } else {
            "ip".to_string()
        };

        let result = AutoLocateResult {
            status: "ok".to_string(),
            source,
            provider: provider_used,
            latitude: lat,
            longitude: lon,
            location_name: location_name.clone(),
            city: location_name,
            country: if raw_country.is_empty() {
                "Việt Nam".to_string()
            } else {
                raw_country
            },
            cache_hit: false,
        };

        if let Ok(mut guard) = self.cached.write() {
            *guard = Some(CachedAutoLocate {
                value: result.clone(),
                expires_at_ms: now_ms() + AUTO_LOCATE_CACHE_TTL_MS,
            });
        }

        Ok(result)
    }
}

pub mod analytics;
pub mod reverse_geocode;
pub mod runtime_store;
pub mod security;
pub mod weather_clients;

use anyhow::Context;
use axum::{
    body::{Body, Bytes},
    extract::{ConnectInfo, Query, Request, State},
    http::{header, HeaderMap, HeaderValue, Method, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use reqwest::Client;
use serde::Serialize;
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs,
    net::SocketAddr,
    path::{Path, PathBuf},
    process::Command,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use weather_buddy_core::{
    evaluate_character_decision, infer_city_name, CharacterDecision, CharacterPrefs, Gender,
    ThermalSensitivity, WeatherProviderType, WeatherSnapshot, AUTO_REFRESH_INTERVAL_MINUTES,
    AUTO_REFRESH_INTERVAL_MS, PRESET_CITIES,
};

use crate::{
    analytics::compute_analytics_24h,
    reverse_geocode::{AutoLocator, ReverseGeocoder},
    runtime_store::{build_telemetry_entry, RuntimeStore},
    security::{
        evaluate_cors_origin, hash_api_keys_salted, is_strict_loopback, is_suspicious_static_path,
        redact_secrets, RateLimitConfig, SlidingWindowRateLimiter, CSRF_CLIENT_HEADER,
        CSRF_EXPECTED_VALUE, HTML_CONTENT_SECURITY_POLICY, MAX_REQUEST_BODY_BYTES,
        UPSTREAM_FETCH_TIMEOUT_MS,
    },
    weather_clients::{
        fetch_secondary_weather_sources, fetch_weather_snapshot, reconcile_weather_consensus,
        FetchWeatherParams, WeatherVerificationObservations,
    },
};

pub const SERVER_VERSION: &str = "3.1.0";
pub const DEFAULT_PORT: u16 = 8787;
const MAX_WEATHER_CACHE_ENTRIES: usize = 250;
const VERIFY_CACHE_TTL_MS: u64 = 5 * 60 * 1000;

const PC_SUITE_DOWNLOADS: [&str; 2] = [
    "/downloads/weather-buddy-extension.zip",
    "/downloads/weather-buddy-desktop-widget.zip",
];

#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub project_root: PathBuf,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: DEFAULT_PORT,
            project_root: PathBuf::from("."),
        }
    }
}

impl ServerConfig {
    pub fn new(host: impl Into<String>, port: u16, project_root: impl Into<PathBuf>) -> Self {
        Self {
            host: host.into(),
            port,
            project_root: project_root.into(),
        }
    }
}

#[derive(Debug, Clone)]
struct CachedWeatherEntry {
    snapshot: WeatherSnapshot,
    expires_at_ms: u64,
}

#[derive(Debug, Clone)]
struct CachedVerifyEntry {
    observations: WeatherVerificationObservations,
    expires_at_ms: u64,
}

pub struct AppState {
    pub config: ServerConfig,
    pub dist_dir: PathBuf,
    pub public_dir: PathBuf,
    pub started_at: Instant,
    pub http_client: Client,
    pub runtime_store: RuntimeStore,
    pub reverse_geocoder: ReverseGeocoder,
    pub auto_locator: AutoLocator,
    pub rate_limiter: SlidingWindowRateLimiter,
    weather_cache: DashMap<String, CachedWeatherEntry>,
    verify_cache: DashMap<String, CachedVerifyEntry>,
    total_requests: AtomicU64,
    cache_hits: AtomicU64,
}

impl AppState {
    pub fn new(config: ServerConfig, rate_limits: RateLimitConfig) -> anyhow::Result<Self> {
        let dist_dir = config.project_root.join("dist");
        let public_dir = config.project_root.join("public");
        let runtime_dir = config.project_root.join("server").join(".runtime");

        let http_client = Client::builder()
            .timeout(Duration::from_millis(UPSTREAM_FETCH_TIMEOUT_MS))
            .user_agent("WeatherBuddy-RustServer/3.1")
            .build()
            .context("Failed to initialize reqwest HTTP client")?;

        let runtime_store = RuntimeStore::new(runtime_dir);
        let reverse_geocoder = ReverseGeocoder::new(http_client.clone());
        let auto_locator = AutoLocator::new(http_client.clone(), false);
        let rate_limiter = SlidingWindowRateLimiter::new(rate_limits);

        Ok(Self {
            config,
            dist_dir,
            public_dir,
            started_at: Instant::now(),
            http_client,
            runtime_store,
            reverse_geocoder,
            auto_locator,
            rate_limiter,
            weather_cache: DashMap::new(),
            verify_cache: DashMap::new(),
            total_requests: AtomicU64::new(0),
            cache_hits: AtomicU64::new(0),
        })
    }

    fn now_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }

    fn prune_weather_cache(&self) {
        let now = Self::now_ms();
        self.weather_cache.retain(|_, v| v.expires_at_ms > now);
        while self.weather_cache.len() > MAX_WEATHER_CACHE_ENTRIES {
            let Some(first_key) = self.weather_cache.iter().next().map(|e| e.key().clone()) else {
                break;
            };
            self.weather_cache.remove(&first_key);
        }
        self.verify_cache.retain(|_, v| v.expires_at_ms > now);
        while self.verify_cache.len() > MAX_WEATHER_CACHE_ENTRIES {
            let Some(first_key) = self.verify_cache.iter().next().map(|e| e.key().clone()) else {
                break;
            };
            self.verify_cache.remove(&first_key);
        }
    }

    async fn get_or_fetch_verification(
        &self,
        latitude: f64,
        longitude: f64,
        force: bool,
    ) -> (WeatherVerificationObservations, bool, u64) {
        self.prune_weather_cache();
        let cache_key = format!("{latitude:.2},{longitude:.2}");
        let now = Self::now_ms();

        if !force {
            if let Some(cached) = self.verify_cache.get(&cache_key) {
                if cached.expires_at_ms > now {
                    return (cached.observations.clone(), true, cached.expires_at_ms);
                }
            }
        }

        let observations =
            fetch_secondary_weather_sources(&self.http_client, latitude, longitude).await;
        let expires_at_ms = Self::now_ms() + VERIFY_CACHE_TTL_MS;
        self.verify_cache.insert(
            cache_key,
            CachedVerifyEntry {
                observations: observations.clone(),
                expires_at_ms,
            },
        );
        (observations, false, expires_at_ms)
    }

    pub fn build_server_health(&self) -> Value {
        self.prune_weather_cache();
        let uptime_sec = self.started_at.elapsed().as_secs();
        let total = self.total_requests.load(Ordering::Relaxed);
        let hits = self.cache_hits.load(Ordering::Relaxed);
        let hit_rate_pct = if total > 0 {
            (((hits as f64) / (total as f64)) * 1000.0).round() / 10.0
        } else {
            0.0
        };

        json!({
            "status": "ok",
            "service": "weather-buddy-backend",
            "version": SERVER_VERSION,
            "engine": "rust-axum",
            "uptimeSec": uptime_sec,
            "refreshIntervalMinutes": AUTO_REFRESH_INTERVAL_MINUTES,
            "cacheSize": self.weather_cache.len(),
            "totalRequests": total,
            "cacheHits": hits,
            "cacheHitRatePct": hit_rate_pct,
        })
    }
}

/// Builds the full-stack Axum `Router` with all API endpoints, static `dist/` SPA fallback,
/// and enterprise security middleware.
pub async fn build_router(config: ServerConfig) -> anyhow::Result<Router> {
    build_router_with_limits(config, RateLimitConfig::default()).await
}

pub async fn build_router_with_limits(
    config: ServerConfig,
    rate_limits: RateLimitConfig,
) -> anyhow::Result<Router> {
    let state = Arc::new(AppState::new(config, rate_limits)?);

    let router = Router::new()
        .route("/api/health", get(handle_health))
        .route("/api/security/status", get(handle_security_status))
        .route("/api/weather", get(handle_weather_get).post(handle_weather_post))
        .route("/api/weather-verify", get(handle_weather_verify))
        .route("/api/reverse-geocode", get(handle_reverse_geocode))
        .route("/api/auto-locate", get(handle_auto_locate))
        .route("/api/dashboard/overview", get(handle_dashboard_overview))
        .route(
            "/api/widget-sync",
            get(handle_widget_sync_get)
                .post(handle_widget_sync_post)
                .delete(handle_widget_sync_delete),
        )
        .route("/api/pc-suite/status", get(handle_pc_suite_status))
        .route("/api/pc-widget/launch", post(handle_pc_widget_launch))
        .fallback(handle_fallback)
        .layer(middleware::from_fn_with_state(
            state.clone(),
            security_middleware,
        ))
        .with_state(state);

    Ok(router)
}

/// Spawns the Axum HTTP server in the background on `config.host:config.port`
/// so Tauri v2 (`@rust-tauri`) can embed it in-process with a single function call.
pub async fn spawn_background_server(
    config: ServerConfig,
) -> anyhow::Result<tokio::task::JoinHandle<()>> {
    let bind_addr = format!("{}:{}", config.host, config.port);
    let listener = tokio::net::TcpListener::bind(&bind_addr)
        .await
        .with_context(|| format!("Failed to bind WeatherBuddy server on {bind_addr}"))?;
    let router = build_router(config).await?;

    let handle = tokio::spawn(async move {
        let service = router.into_make_service_with_connect_info::<SocketAddr>();
        if let Err(err) = axum::serve(listener, service).await {
            tracing::error!("WeatherBuddy background server stopped with error: {err}");
        }
    });

    Ok(handle)
}

fn percent_decode_lossy(input: &str) -> Result<String, ()> {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            if i + 2 >= bytes.len() {
                return Err(());
            }
            let hi = (bytes[i + 1] as char).to_digit(16).ok_or(())?;
            let lo = (bytes[i + 2] as char).to_digit(16).ok_or(())?;
            out.push(((hi << 4) | lo) as u8);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).map_err(|_| ())
}

fn apply_security_headers(
    headers: &mut HeaderMap,
    origin_header: Option<&str>,
    is_api: bool,
    is_html: bool,
) {
    let env_allowed = std::env::var("ALLOWED_ORIGINS").ok();
    let origin_check = evaluate_cors_origin(origin_header, env_allowed.as_deref());

    if origin_check.trusted {
        if let Some(allow_origin) = origin_check.allow_origin {
            if let Ok(val) = HeaderValue::from_str(&allow_origin) {
                headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, val);
                headers.insert(header::VARY, HeaderValue::from_static("Origin"));
            }
        } else if !origin_check.present && is_api {
            headers.insert(header::VARY, HeaderValue::from_static("Origin"));
        }
    }

    headers.insert(
        header::ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("GET, POST, DELETE, OPTIONS"),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_HEADERS,
        HeaderValue::from_static(
            "Content-Type, X-WeatherBuddy-Client, X-Google-Api-Key, X-Tomorrow-Api-Key, X-Weatherapi-Key, Accept, Origin",
        ),
    );
    headers.insert(
        header::ACCESS_CONTROL_EXPOSE_HEADERS,
        HeaderValue::from_static("X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After"),
    );
    headers.insert(
        header::ACCESS_CONTROL_MAX_AGE,
        HeaderValue::from_static("86400"),
    );

    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(header::X_FRAME_OPTIONS, HeaderValue::from_static("DENY"));
    headers.insert(
        header::REFERRER_POLICY,
        HeaderValue::from_static("no-referrer"),
    );
    headers.insert(
        header::HeaderName::from_static("permissions-policy"),
        HeaderValue::from_static("camera=(), microphone=(), payment=(), geolocation=(self)"),
    );
    headers.insert(
        header::HeaderName::from_static("cross-origin-resource-policy"),
        HeaderValue::from_static(if is_api {
            "cross-origin"
        } else {
            "same-origin"
        }),
    );

    if is_html {
        headers.insert(
            header::CONTENT_SECURITY_POLICY,
            HeaderValue::from_static(HTML_CONTENT_SECURITY_POLICY),
        );
    }

    if is_api {
        headers.insert(
            header::CACHE_CONTROL,
            HeaderValue::from_static("no-store"),
        );
    }
}

fn json_error_response(status: StatusCode, message: &str) -> Response {
    (
        status,
        Json(json!({
            "status": "error",
            "error": message,
        })),
    )
        .into_response()
}

async fn security_middleware(
    State(state): State<Arc<AppState>>,
    req: Request,
    next: Next,
) -> Response {
    let raw_uri = req
        .uri()
        .path_and_query()
        .map(|pq| pq.as_str())
        .unwrap_or_else(|| req.uri().path())
        .to_string();
    let pathname = req.uri().path().to_string();
    let is_api = pathname == "/api" || pathname.starts_with("/api/");
    let origin_header = req
        .headers()
        .get(header::ORIGIN)
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);

    let Ok(decoded_pathname) = percent_decode_lossy(&pathname) else {
        let mut resp = json_error_response(StatusCode::BAD_REQUEST, "Đường dẫn URL không hợp lệ.");
        apply_security_headers(resp.headers_mut(), origin_header.as_deref(), is_api, false);
        return resp;
    };

    if is_suspicious_static_path(&raw_uri, &decoded_pathname) {
        let mut resp = json_error_response(
            StatusCode::FORBIDDEN,
            "Truy cập đường dẫn bị từ chối.",
        );
        apply_security_headers(resp.headers_mut(), origin_header.as_deref(), false, false);
        return resp;
    }

    let env_allowed = std::env::var("ALLOWED_ORIGINS").ok();
    let origin_check = evaluate_cors_origin(origin_header.as_deref(), env_allowed.as_deref());

    if req.method() == Method::OPTIONS {
        if origin_check.present && !origin_check.trusted {
            let mut resp = json_error_response(
                StatusCode::FORBIDDEN,
                "Origin không được phép truy cập CORS.",
            );
            apply_security_headers(resp.headers_mut(), origin_header.as_deref(), is_api, false);
            return resp;
        }
        let mut resp = StatusCode::NO_CONTENT.into_response();
        apply_security_headers(resp.headers_mut(), origin_header.as_deref(), is_api, false);
        return resp;
    }

    if !is_api {
        let mut resp = next.run(req).await;
        let is_html = resp
            .headers()
            .get(header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .map_or(false, |ct| ct.contains("text/html"));
        apply_security_headers(resp.headers_mut(), origin_header.as_deref(), false, is_html);
        return resp;
    }

    // Block cross-site state-changing requests from untrusted Origins
    if req.method() != Method::GET && req.method() != Method::HEAD && req.method() != Method::OPTIONS
    {
        if origin_check.present && !origin_check.trusted {
            let mut resp = json_error_response(
                StatusCode::FORBIDDEN,
                "Origin không nằm trong danh sách tin cậy (CORS/CSRF bị chặn).",
            );
            apply_security_headers(resp.headers_mut(), origin_header.as_deref(), true, false);
            return resp;
        }
    }

    // Sliding-window IP rate limit per endpoint bucket
    let client_ip = req
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ci| ci.0.ip().to_string())
        .unwrap_or_else(|| "127.0.0.1".to_string());

    let bucket = match pathname.as_str() {
        "/api/weather" => "weather",
        "/api/pc-widget/launch" => "pcWidgetLaunch",
        _ => "defaultApi",
    };

    let rl = state.rate_limiter.consume(bucket, &client_ip);
    if !rl.allowed {
        let mut resp = (
            StatusCode::TOO_MANY_REQUESTS,
            Json(json!({
                "status": "error",
                "error": "Quá nhiều yêu cầu trong thời gian ngắn (429 Too Many Requests). Vui lòng thử lại sau.",
                "retryAfterSec": rl.retry_after_sec,
            })),
        )
            .into_response();
        apply_security_headers(resp.headers_mut(), origin_header.as_deref(), true, false);
        if let Ok(v) = HeaderValue::from_str(&rl.limit.to_string()) {
            resp.headers_mut()
                .insert(header::HeaderName::from_static("x-ratelimit-limit"), v);
        }
        resp.headers_mut().insert(
            header::HeaderName::from_static("x-ratelimit-remaining"),
            HeaderValue::from_static("0"),
        );
        if let Ok(v) = HeaderValue::from_str(&rl.retry_after_sec.to_string()) {
            resp.headers_mut().insert(header::RETRY_AFTER, v);
        }
        return resp;
    }

    let mut resp = next.run(req).await;
    apply_security_headers(resp.headers_mut(), origin_header.as_deref(), true, false);
    if let Ok(v) = HeaderValue::from_str(&rl.limit.to_string()) {
        resp.headers_mut()
            .insert(header::HeaderName::from_static("x-ratelimit-limit"), v);
    }
    if let Ok(v) = HeaderValue::from_str(&rl.remaining.to_string()) {
        resp.headers_mut()
            .insert(header::HeaderName::from_static("x-ratelimit-remaining"), v);
    }
    resp
}

async fn handle_health(State(state): State<Arc<AppState>>) -> Response {
    (StatusCode::OK, Json(state.build_server_health())).into_response()
}

async fn handle_security_status(State(state): State<Arc<AppState>>) -> Response {
    (
        StatusCode::OK,
        Json(json!({
            "status": "ok",
            "rateLimitActive": true,
            "csrfProtected": true,
            "keyRedaction": true,
            "headersHardened": true,
            "loopbackGuardOnLaunch": true,
            "maxBodyBytes": MAX_REQUEST_BODY_BYTES,
            "upstreamTimeoutMs": UPSTREAM_FETCH_TIMEOUT_MS,
            "rateLimits": {
                "weatherPerMinute": state.rate_limiter.limits.weather.max,
                "pcWidgetLaunchPerMinute": state.rate_limiter.limits.pc_widget_launch.max,
            }
        })),
    )
        .into_response()
}

fn read_header_str(headers: &HeaderMap, name: &str) -> String {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .unwrap_or("")
        .to_string()
}

fn extract_request_api_keys(headers: &HeaderMap, body: &Value) -> (String, String, String) {
    let mut tomorrow = read_header_str(headers, "x-tomorrow-api-key");
    if tomorrow.is_empty() {
        tomorrow = body
            .get("tomorrowIoApiKey")
            .or_else(|| body.get("tomorrowApiKey"))
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or("")
            .to_string();
    }

    let mut weatherapi = read_header_str(headers, "x-weatherapi-key");
    if weatherapi.is_empty() {
        weatherapi = body
            .get("weatherApiKey")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or("")
            .to_string();
    }

    let mut google = read_header_str(headers, "x-google-api-key");
    if google.is_empty() {
        google = body
            .get("googleApiKey")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or("")
            .to_string();
    }

    (tomorrow, weatherapi, google)
}

fn parse_coordinates(
    raw_lat: Option<&str>,
    raw_lon: Option<&str>,
    default_coords: Option<(f64, f64)>,
) -> Result<(f64, f64, bool), String> {
    let lat_s = raw_lat.map(str::trim).filter(|s| !s.is_empty());
    let lon_s = raw_lon.map(str::trim).filter(|s| !s.is_empty());

    if lat_s.is_none() && lon_s.is_none() {
        if let Some((dlat, dlon)) = default_coords {
            return Ok((dlat, dlon, true));
        }
    }

    let (Some(ls), Some(lns)) = (lat_s, lon_s) else {
        return Err(
            "Tọa độ lat/lon không hợp lệ (lat trong [-90, 90], lon trong [-180, 180]).".to_string(),
        );
    };

    let Ok(lat) = ls.parse::<f64>() else {
        return Err(
            "Tọa độ lat/lon không hợp lệ (lat trong [-90, 90], lon trong [-180, 180]).".to_string(),
        );
    };
    let Ok(lon) = lns.parse::<f64>() else {
        return Err(
            "Tọa độ lat/lon không hợp lệ (lat trong [-90, 90], lon trong [-180, 180]).".to_string(),
        );
    };

    if !lat.is_finite()
        || !lon.is_finite()
        || !(-90.0..=90.0).contains(&lat)
        || !(-180.0..=180.0).contains(&lon)
    {
        return Err(
            "Tọa độ lat/lon không hợp lệ (lat trong [-90, 90], lon trong [-180, 180]).".to_string(),
        );
    }

    let r_lat = (lat * 100_000.0).round() / 100_000.0;
    let r_lon = (lon * 100_000.0).round() / 100_000.0;
    Ok((r_lat, r_lon, false))
}

fn parse_force_flag(raw: Option<&str>) -> bool {
    let Some(s) = raw else { return false };
    matches!(
        s.trim().to_ascii_lowercase().as_str(),
        "1" | "true" | "yes"
    )
}

fn value_to_string_opt(v: Option<&Value>) -> Option<String> {
    match v {
        Some(Value::String(s)) => Some(s.clone()),
        Some(Value::Number(n)) => Some(n.to_string()),
        Some(Value::Bool(b)) => Some(b.to_string()),
        _ => None,
    }
}

async fn read_capped_json_body(headers: &HeaderMap, body_bytes: Bytes) -> Result<Value, Response> {
    if let Some(cl) = headers
        .get(header::CONTENT_LENGTH)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<usize>().ok())
    {
        if cl > MAX_REQUEST_BODY_BYTES {
            return Err(json_error_response(
                StatusCode::PAYLOAD_TOO_LARGE,
                "Kích thước yêu cầu vượt quá giới hạn tối đa 16KB (413 Payload Too Large).",
            ));
        }
    }

    if body_bytes.len() > MAX_REQUEST_BODY_BYTES {
        return Err(json_error_response(
            StatusCode::PAYLOAD_TOO_LARGE,
            "Kích thước yêu cầu vượt quá giới hạn tối đa 16KB (413 Payload Too Large).",
        ));
    }

    if body_bytes.is_empty() {
        return Ok(json!({}));
    }

    let raw = std::str::from_utf8(&body_bytes)
        .map_err(|_| json_error_response(StatusCode::BAD_REQUEST, "Định dạng JSON không hợp lệ."))?
        .trim();

    if raw.is_empty() {
        return Ok(json!({}));
    }

    let parsed: Value = serde_json::from_str(raw)
        .map_err(|_| json_error_response(StatusCode::BAD_REQUEST, "Định dạng JSON không hợp lệ."))?;

    if !parsed.is_object() {
        return Err(json_error_response(
            StatusCode::BAD_REQUEST,
            "Body yêu cầu phải là một JSON object hợp lệ.",
        ));
    }

    Ok(parsed)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WeatherEndpointResult {
    snapshot: WeatherSnapshot,
    decision: CharacterDecision,
    cache_hit: bool,
    latency_ms: u64,
    expires_at_iso: String,
}

async fn get_or_fetch_weather(
    state: &AppState,
    latitude: f64,
    longitude: f64,
    location_name: String,
    provider_raw: &str,
    force: bool,
    gender: Gender,
    sensitivity: ThermalSensitivity,
    tomorrow_key: String,
    weatherapi_key: String,
    google_key: String,
) -> Result<WeatherEndpointResult, Response> {
    let Some(provider) = WeatherProviderType::parse_strict(provider_raw) else {
        return Err(json_error_response(
            StatusCode::BAD_REQUEST,
            &format!(
                "Nguồn thời tiết '{provider_raw}' không hợp lệ (hỗ trợ: auto, tomorrow_io, weatherapi, google, open_meteo)."
            ),
        ));
    };

    let req_start = Instant::now();
    state.total_requests.fetch_add(1, Ordering::Relaxed);
    state.prune_weather_cache();

    let key_hash = hash_api_keys_salted(&tomorrow_key, &weatherapi_key, &google_key);
    let cache_key = format!(
        "{:.3},{:.3},{},{}",
        latitude,
        longitude,
        provider.as_str(),
        key_hash
    );
    let now = AppState::now_ms();

    if !force {
        if let Some(cached) = state.weather_cache.get(&cache_key) {
            if cached.expires_at_ms > now {
                state.cache_hits.fetch_add(1, Ordering::Relaxed);
                let mut snapshot = cached.snapshot.clone();
                if !location_name.is_empty() {
                    snapshot.location_name = location_name;
                }
                let decision = evaluate_character_decision(
                    &snapshot,
                    CharacterPrefs {
                        gender,
                        sensitivity,
                    },
                );
                let latency_ms = req_start.elapsed().as_millis() as u64;
                let expires_at_iso = DateTime::<Utc>::from_timestamp_millis(cached.expires_at_ms as i64)
                    .map(|dt| dt.to_rfc3339())
                    .unwrap_or_else(|| Utc::now().to_rfc3339());

                let telemetry = build_telemetry_entry(&snapshot, true, latency_ms);
                state.runtime_store.record_telemetry(telemetry);

                return Ok(WeatherEndpointResult {
                    snapshot,
                    decision,
                    cache_hit: true,
                    latency_ms,
                    expires_at_iso,
                });
            }
        }
    }

    let fetch_params = FetchWeatherParams {
        latitude,
        longitude,
        location_name: location_name.clone(),
        provider,
        tomorrow_io_api_key: tomorrow_key.clone(),
        weather_api_key: weatherapi_key.clone(),
        google_api_key: google_key.clone(),
    };

    let mut fetched_snapshot = match fetch_weather_snapshot(&state.http_client, &fetch_params).await
    {
        Ok(snap) => snap,
        Err((status_u16, raw_err)) => {
            let safe_msg = redact_secrets(
                &raw_err,
                &[&tomorrow_key, &weatherapi_key, &google_key],
            );
            let code = StatusCode::from_u16(status_u16).unwrap_or(StatusCode::BAD_GATEWAY);
            return Err(json_error_response(code, &safe_msg));
        }
    };

    if !location_name.is_empty() {
        fetched_snapshot.location_name = location_name;
    }

    // Cross-validate against physical airport METAR + MET Norway ECMWF (5-min cached)
    let (observations, _, _) = state
        .get_or_fetch_verification(latitude, longitude, force)
        .await;
    let fetched_snapshot =
        reconcile_weather_consensus(fetched_snapshot, &observations, Utc::now().timestamp_millis());

    let expires_at_ms = AppState::now_ms() + AUTO_REFRESH_INTERVAL_MS;
    state.weather_cache.insert(
        cache_key,
        CachedWeatherEntry {
            snapshot: fetched_snapshot.clone(),
            expires_at_ms,
        },
    );

    let decision = evaluate_character_decision(
        &fetched_snapshot,
        CharacterPrefs {
            gender,
            sensitivity,
        },
    );
    let latency_ms = req_start.elapsed().as_millis() as u64;
    let expires_at_iso = DateTime::<Utc>::from_timestamp_millis(expires_at_ms as i64)
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_else(|| Utc::now().to_rfc3339());

    let telemetry = build_telemetry_entry(&fetched_snapshot, false, latency_ms);
    state.runtime_store.record_telemetry(telemetry);

    Ok(WeatherEndpointResult {
        snapshot: fetched_snapshot,
        decision,
        cache_hit: false,
        latency_ms,
        expires_at_iso,
    })
}

async fn handle_weather_get(
    State(state): State<Arc<AppState>>,
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> Response {
    handle_weather_unified(state, q, headers, json!({})).await
}

async fn handle_weather_verify(
    State(state): State<Arc<AppState>>,
    Query(q): Query<HashMap<String, String>>,
) -> Response {
    let raw_lat = q.get("lat").or_else(|| q.get("latitude")).map(String::as_str);
    let raw_lon = q
        .get("lon")
        .or_else(|| q.get("lng"))
        .or_else(|| q.get("longitude"))
        .map(String::as_str);

    let (latitude, longitude, _) = match parse_coordinates(raw_lat, raw_lon, None) {
        Ok(v) => v,
        Err(msg) => return json_error_response(StatusCode::BAD_REQUEST, &msg),
    };
    let force = parse_force_flag(q.get("force").map(String::as_str));

    let (observations, cache_hit, expires_at_ms) = state
        .get_or_fetch_verification(latitude, longitude, force)
        .await;
    let expires_at_iso = DateTime::<Utc>::from_timestamp_millis(expires_at_ms as i64)
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_else(|| Utc::now().to_rfc3339());

    (
        StatusCode::OK,
        Json(json!({
            "status": "ok",
            "latitude": latitude,
            "longitude": longitude,
            "metar": observations.metar,
            "metNorway": observations.met_norway,
            "fetchedAtIso": observations.fetched_at_iso,
            "expiresAtIso": expires_at_iso,
            "cacheHit": cache_hit,
        })),
    )
        .into_response()
}

async fn handle_weather_post(
    State(state): State<Arc<AppState>>,
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
    body_bytes: Bytes,
) -> Response {
    let body = match read_capped_json_body(&headers, body_bytes).await {
        Ok(b) => b,
        Err(resp) => return resp,
    };
    handle_weather_unified(state, q, headers, body).await
}

async fn handle_weather_unified(
    state: Arc<AppState>,
    q: HashMap<String, String>,
    headers: HeaderMap,
    body: Value,
) -> Response {
    let (tomorrow_key, weatherapi_key, google_key) = extract_request_api_keys(&headers, &body);

    let raw_lat = value_to_string_opt(body.get("lat").or_else(|| body.get("latitude")))
        .or_else(|| q.get("lat").or_else(|| q.get("latitude")).cloned());
    let raw_lon = value_to_string_opt(
        body.get("lon")
            .or_else(|| body.get("lng"))
            .or_else(|| body.get("longitude")),
    )
    .or_else(|| {
        q.get("lon")
            .or_else(|| q.get("lng"))
            .or_else(|| q.get("longitude"))
            .cloned()
    });

    let default_city = PRESET_CITIES[0];
    let (latitude, longitude, used_default) = match parse_coordinates(
        raw_lat.as_deref(),
        raw_lon.as_deref(),
        Some((default_city.latitude, default_city.longitude)),
    ) {
        Ok(v) => v,
        Err(msg) => return json_error_response(StatusCode::BAD_REQUEST, &msg),
    };

    let explicit_name = body
        .get("locationName")
        .and_then(Value::as_str)
        .or_else(|| q.get("locationName").map(String::as_str));

    let location_name = if used_default && explicit_name.is_none() {
        default_city.name_vi.to_string()
    } else {
        infer_city_name(latitude, longitude, explicit_name)
    };

    let provider_raw = body
        .get("provider")
        .and_then(Value::as_str)
        .or_else(|| q.get("provider").map(String::as_str))
        .unwrap_or("auto");

    let force_val = value_to_string_opt(body.get("force")).or_else(|| q.get("force").cloned());
    let force = parse_force_flag(force_val.as_deref());

    let gender_raw = body
        .get("gender")
        .and_then(Value::as_str)
        .or_else(|| q.get("gender").map(String::as_str))
        .unwrap_or("female");
    let gender = Gender::from_str_lossy(gender_raw);

    let sens_raw = body
        .get("sensitivity")
        .and_then(Value::as_str)
        .or_else(|| q.get("sensitivity").map(String::as_str))
        .unwrap_or("normal");
    let sensitivity = ThermalSensitivity::from_str_lossy(sens_raw);

    match get_or_fetch_weather(
        &state,
        latitude,
        longitude,
        location_name,
        provider_raw,
        force,
        gender,
        sensitivity,
        tomorrow_key,
        weatherapi_key,
        google_key,
    )
    .await
    {
        Ok(res) => (StatusCode::OK, Json(res)).into_response(),
        Err(err_resp) => err_resp,
    }
}

async fn handle_reverse_geocode(
    State(state): State<Arc<AppState>>,
    Query(q): Query<HashMap<String, String>>,
) -> Response {
    let raw_lat = q.get("lat").or_else(|| q.get("latitude")).map(String::as_str);
    let raw_lon = q
        .get("lon")
        .or_else(|| q.get("lng"))
        .or_else(|| q.get("longitude"))
        .map(String::as_str);

    let (latitude, longitude, _) = match parse_coordinates(raw_lat, raw_lon, None) {
        Ok(v) => v,
        Err(msg) => return json_error_response(StatusCode::BAD_REQUEST, &msg),
    };

    let geo = state
        .reverse_geocoder
        .reverse_geocode(latitude, longitude, false)
        .await;
    (StatusCode::OK, Json(geo)).into_response()
}

async fn handle_auto_locate(
    State(state): State<Arc<AppState>>,
    Query(q): Query<HashMap<String, String>>,
) -> Response {
    let force = parse_force_flag(q.get("force").map(String::as_str));
    match state
        .auto_locator
        .auto_locate(&state.reverse_geocoder, force)
        .await
    {
        Ok(loc) => (StatusCode::OK, Json(loc)).into_response(),
        Err(msg) => json_error_response(StatusCode::SERVICE_UNAVAILABLE, &msg),
    }
}

async fn handle_dashboard_overview(
    State(state): State<Arc<AppState>>,
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> Response {
    let (tomorrow_key, weatherapi_key, google_key) = extract_request_api_keys(&headers, &json!({}));
    let widget_record = state.runtime_store.get_widget_sync();
    let synced_widget = widget_record.map(|r| r.payload);

    let default_city = if let Some(ref sw) = synced_widget {
        (
            if sw.latitude != 0.0 {
                sw.latitude
            } else {
                PRESET_CITIES[0].latitude
            },
            if sw.longitude != 0.0 {
                sw.longitude
            } else {
                PRESET_CITIES[0].longitude
            },
            sw.location_name.clone(),
        )
    } else {
        (
            PRESET_CITIES[0].latitude,
            PRESET_CITIES[0].longitude,
            PRESET_CITIES[0].name_vi.to_string(),
        )
    };

    let raw_lat = q.get("lat").or_else(|| q.get("latitude")).map(String::as_str);
    let raw_lon = q
        .get("lon")
        .or_else(|| q.get("lng"))
        .or_else(|| q.get("longitude"))
        .map(String::as_str);

    let (latitude, longitude, used_default) =
        match parse_coordinates(raw_lat, raw_lon, Some((default_city.0, default_city.1))) {
            Ok(v) => v,
            Err(msg) => return json_error_response(StatusCode::BAD_REQUEST, &msg),
        };

    let explicit_name = q.get("locationName").map(String::as_str);
    let location_name = if used_default && explicit_name.is_none() {
        default_city.2
    } else {
        infer_city_name(latitude, longitude, explicit_name)
    };

    let provider_raw = q.get("provider").map(String::as_str).unwrap_or("auto");
    let force = parse_force_flag(q.get("force").map(String::as_str));
    let gender = q
        .get("gender")
        .map(|g| Gender::from_str_lossy(g))
        .or_else(|| synced_widget.as_ref().map(|w| w.gender))
        .unwrap_or(Gender::Female);
    let sensitivity = q
        .get("sensitivity")
        .map(|s| ThermalSensitivity::from_str_lossy(s))
        .unwrap_or(ThermalSensitivity::Normal);

    let weather_res = match get_or_fetch_weather(
        &state,
        latitude,
        longitude,
        location_name,
        provider_raw,
        force,
        gender,
        sensitivity,
        tomorrow_key,
        weatherapi_key,
        google_key,
    )
    .await
    {
        Ok(res) => res,
        Err(err_resp) => return err_resp,
    };

    let analytics24h = compute_analytics_24h(&weather_res.snapshot);
    let server_health = state.build_server_health();
    let recent_telemetry = state.runtime_store.get_recent_telemetry(15);

    (
        StatusCode::OK,
        Json(json!({
            "status": "ok",
            "generatedAtIso": Utc::now().to_rfc3339(),
            "serverHealth": server_health,
            "activeLocation": {
                "locationName": weather_res.snapshot.location_name,
                "latitude": latitude,
                "longitude": longitude,
            },
            "snapshot": weather_res.snapshot,
            "decision": weather_res.decision,
            "cacheHit": weather_res.cache_hit,
            "expiresAtIso": weather_res.expires_at_iso,
            "analytics24h": analytics24h,
            "recentTelemetry": recent_telemetry,
            "syncedWidget": synced_widget,
        })),
    )
        .into_response()
}

async fn handle_widget_sync_get(State(state): State<Arc<AppState>>) -> Response {
    let record = state.runtime_store.get_widget_sync();
    (
        StatusCode::OK,
        Json(json!({
            "status": "ok",
            "synced": record.is_some(),
            "syncedAtIso": record.as_ref().map(|r| &r.synced_at_iso),
            "payload": record.as_ref().map(|r| &r.payload),
        })),
    )
        .into_response()
}

async fn handle_widget_sync_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body_bytes: Bytes,
) -> Response {
    let body = match read_capped_json_body(&headers, body_bytes).await {
        Ok(b) => b,
        Err(resp) => return resp,
    };

    match state.runtime_store.save_widget_sync(&body) {
        Ok(record) => (
            StatusCode::OK,
            Json(json!({
                "status": "ok",
                "synced": true,
                "syncedAtIso": record.synced_at_iso,
                "storageKey": "server:.runtime/widget_sync.json",
                "payload": record.payload,
            })),
        )
            .into_response(),
        Err(msg) => json_error_response(StatusCode::BAD_REQUEST, &msg),
    }
}

async fn handle_widget_sync_delete(State(state): State<Arc<AppState>>) -> Response {
    state.runtime_store.clear_widget_sync();
    (
        StatusCode::OK,
        Json(json!({
            "status": "ok",
            "synced": false,
            "cleared": true,
        })),
    )
        .into_response()
}

async fn handle_pc_suite_status(
    State(state): State<Arc<AppState>>,
    req: Request,
) -> Response {
    let client_ip = req
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ci| ci.0.ip().to_string())
        .unwrap_or_else(|| "127.0.0.1".to_string());

    let ext_manifest = state
        .config
        .project_root
        .join("browser-extension")
        .join("manifest.json");
    let desktop_launcher = state
        .config
        .project_root
        .join("desktop-widget")
        .join("Launch-Desktop-Widget.ps1");

    let ext_zip_ready = state
        .dist_dir
        .join("downloads")
        .join("weather-buddy-extension.zip")
        .exists()
        || state
            .public_dir
            .join("downloads")
            .join("weather-buddy-extension.zip")
            .exists();

    let desktop_zip_ready = state
        .dist_dir
        .join("downloads")
        .join("weather-buddy-desktop-widget.zip")
        .exists()
        || state
            .public_dir
            .join("downloads")
            .join("weather-buddy-desktop-widget.zip")
            .exists();

    let extension_ready = ext_manifest.exists();
    let desktop_widget_ready = desktop_launcher.exists();
    let is_windows = cfg!(target_os = "windows");
    let platform = if is_windows {
        "win32"
    } else if cfg!(target_os = "macos") {
        "darwin"
    } else {
        "linux"
    };

    (
        StatusCode::OK,
        Json(json!({
            "status": "ok",
            "platform": platform,
            "canLaunchNativeDesktopWidget": is_windows && is_strict_loopback(&client_ip) && desktop_widget_ready,
            "extensionReady": extension_ready,
            "desktopWidgetReady": desktop_widget_ready,
            "extensionZipReady": ext_zip_ready,
            "desktopWidgetZipReady": desktop_zip_ready,
            "downloads": PC_SUITE_DOWNLOADS,
        })),
    )
        .into_response()
}

async fn handle_pc_widget_launch(
    State(state): State<Arc<AppState>>,
    req: Request,
) -> Response {
    let client_ip = req
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ci| ci.0.ip().to_string())
        .unwrap_or_else(|| "127.0.0.1".to_string());

    if !is_strict_loopback(&client_ip) {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({
                "status": "error",
                "launched": false,
                "error": "Chỉ cho phép khởi chạy Desktop Widget từ kết nối nội bộ (localhost).",
            })),
        )
            .into_response();
    }

    let csrf_val = read_header_str(req.headers(), CSRF_CLIENT_HEADER);
    if csrf_val != CSRF_EXPECTED_VALUE {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({
                "status": "error",
                "launched": false,
                "error": "Thiếu hoặc sai header bảo mật CSRF (X-WeatherBuddy-Client: weatherbuddy-ui).",
            })),
        )
            .into_response();
    }

    let headers = req.headers().clone();
    let Ok(body_bytes) = axum::body::to_bytes(req.into_body(), MAX_REQUEST_BODY_BYTES + 1024).await
    else {
        return json_error_response(
            StatusCode::PAYLOAD_TOO_LARGE,
            "Kích thước yêu cầu vượt quá giới hạn tối đa 16KB (413 Payload Too Large).",
        );
    };

    let body = match read_capped_json_body(&headers, body_bytes).await {
        Ok(b) => b,
        Err(resp) => return resp,
    };

    let corner = match body.get("corner") {
        None | Some(Value::Null) => "BottomRight",
        Some(Value::String(s)) => s.as_str(),
        Some(_) => "",
    };
    let size = match body.get("size") {
        None | Some(Value::Null) => "Standard",
        Some(Value::String(s)) => s.as_str(),
        Some(_) => "",
    };
    let gender = match body.get("gender") {
        None | Some(Value::Null) => "female",
        Some(Value::String(s)) => s.as_str(),
        Some(_) => "",
    };

    if !matches!(corner, "BottomRight" | "TopRight" | "BottomLeft" | "TopLeft") {
        return json_error_response(
            StatusCode::BAD_REQUEST,
            "Giá trị corner không hợp lệ (chấp nhận: BottomRight, TopRight, BottomLeft, TopLeft).",
        );
    }
    if !matches!(size, "Compact" | "Standard") {
        return json_error_response(
            StatusCode::BAD_REQUEST,
            "Giá trị size không hợp lệ (chấp nhận: Compact, Standard).",
        );
    }
    if !matches!(gender, "male" | "female") {
        return json_error_response(
            StatusCode::BAD_REQUEST,
            "Giá trị gender không hợp lệ (chấp nhận: male, female).",
        );
    }

    if !cfg!(target_os = "windows") {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "status": "error",
                "launched": false,
                "error": "Tính năng mở trực tiếp Windows Desktop Widget chỉ hỗ trợ trên Windows.",
            })),
        )
            .into_response();
    }

    let script_path = state
        .config
        .project_root
        .join("desktop-widget")
        .join("Launch-Desktop-Widget.ps1");
    if !script_path.exists() {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({
                "status": "error",
                "launched": false,
                "error": "Chưa tìm thấy bộ khởi chạy desktop-widget/Launch-Desktop-Widget.ps1.",
            })),
        )
            .into_response();
    }

    let mut cmd = Command::new("powershell.exe");
    cmd.args([
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        &script_path.to_string_lossy(),
        "-Corner",
        corner,
        "-Size",
        size,
        "-Gender",
        gender,
    ]);
    if let Some(parent) = script_path.parent() {
        cmd.current_dir(parent);
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    if let Err(err) = cmd.spawn() {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({
                "status": "error",
                "launched": false,
                "error": format!("Không thể khởi chạy Desktop Widget: {err}"),
            })),
        )
            .into_response();
    }

    (
        StatusCode::OK,
        Json(json!({
            "status": "ok",
            "launched": true,
            "mode": size,
            "size": size,
            "corner": corner,
            "gender": gender,
        })),
    )
        .into_response()
}

fn mime_type_for_path(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .as_deref()
    {
        Some("html") => "text/html; charset=utf-8",
        Some("js" | "mjs") => "application/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("json" | "map") => "application/json; charset=utf-8",
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        Some("svg") => "image/svg+xml",
        Some("ico") => "image/x-icon",
        Some("ttf") => "font/ttf",
        Some("otf") => "font/otf",
        Some("woff") => "font/woff",
        Some("woff2") => "font/woff2",
        Some("txt") => "text/plain; charset=utf-8",
        Some("wasm") => "application/wasm",
        Some("zip") => "application/zip",
        Some("vrm" | "glb") => "model/gltf-binary",
        _ => "application/octet-stream",
    }
}

fn serve_file_within_root(
    root: &Path,
    path: &Path,
    cache_control: &'static str,
    is_head: bool,
) -> Option<Response> {
    let canon_root = fs::canonicalize(root).ok()?;
    let canon_path = fs::canonicalize(path).ok()?;
    if !canon_path.starts_with(&canon_root) {
        return None;
    }
    serve_file_sync(&canon_path, cache_control, is_head)
}

fn serve_file_sync(path: &Path, cache_control: &'static str, is_head: bool) -> Option<Response> {
    let metadata = fs::metadata(path).ok()?;
    if !metadata.is_file() {
        return None;
    }
    let content_type = mime_type_for_path(path);
    let is_html = content_type.starts_with("text/html");
    let content_len = metadata.len();

    let bytes = if is_head {
        Vec::new()
    } else {
        fs::read(path).ok()?
    };

    let mut resp = Response::new(Body::from(bytes));
    *resp.status_mut() = StatusCode::OK;
    resp.headers_mut()
        .insert(header::CONTENT_TYPE, HeaderValue::from_static(content_type));
    if let Ok(len_val) = HeaderValue::from_str(&content_len.to_string()) {
        resp.headers_mut().insert(header::CONTENT_LENGTH, len_val);
    }
    resp.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static(cache_control),
    );
    if is_html {
        resp.headers_mut().insert(
            header::CONTENT_SECURITY_POLICY,
            HeaderValue::from_static(HTML_CONTENT_SECURITY_POLICY),
        );
    }
    Some(resp)
}

async fn handle_fallback(State(state): State<Arc<AppState>>, req: Request) -> Response {
    let pathname = req.uri().path().to_string();
    if pathname == "/api" || pathname.starts_with("/api/") {
        return json_error_response(
            StatusCode::NOT_FOUND,
            &format!("Endpoint '{pathname}' không tồn tại."),
        );
    }

    if req.method() != Method::GET && req.method() != Method::HEAD {
        return json_error_response(StatusCode::METHOD_NOT_ALLOWED, "Method Not Allowed");
    }

    let is_head = req.method() == Method::HEAD;
    let Ok(decoded_pathname) = percent_decode_lossy(&pathname) else {
        return json_error_response(StatusCode::BAD_REQUEST, "Đường dẫn URL không hợp lệ.");
    };

    if is_suspicious_static_path(&pathname, &decoded_pathname) {
        return json_error_response(StatusCode::FORBIDDEN, "Truy cập đường dẫn bị từ chối.");
    }

    if decoded_pathname.starts_with("/downloads/") {
        let rel = decoded_pathname.trim_start_matches('/');
        let public_candidate = state.public_dir.join(rel);
        if let Some(resp) =
            serve_file_within_root(&state.public_dir, &public_candidate, "no-cache", is_head)
        {
            return resp;
        }
    }

    let index_html = state.dist_dir.join("index.html");
    if !index_html.exists() {
        return (
            StatusCode::OK,
            Json(json!({
                "status": "ok",
                "service": "weather-buddy-backend",
                "version": SERVER_VERSION,
                "engine": "rust-axum",
                "messageVi": "Backend API đang hoạt động. Chạy `npm run export:web` để xuất giao diện tĩnh vào thư mục dist/.",
                "endpoints": [
                    "/api/health",
                    "/api/security/status",
                    "/api/weather",
                    "/api/weather-verify",
                    "/api/reverse-geocode",
                    "/api/auto-locate",
                    "/api/dashboard/overview",
                    "/api/widget-sync",
                    "/api/pc-suite/status",
                    "/api/pc-widget/launch"
                ]
            })),
        )
            .into_response();
    }

    let rel_target = decoded_pathname.trim_start_matches('/');
    let candidate = if rel_target.is_empty() {
        index_html.clone()
    } else {
        state.dist_dir.join(rel_target)
    };

    let is_immutable =
        decoded_pathname.starts_with("/_expo/") || decoded_pathname.starts_with("/assets/");
    let cache_ctrl = if is_immutable {
        "public, max-age=31536000, immutable"
    } else {
        "no-cache"
    };

    if let Some(resp) = serve_file_within_root(&state.dist_dir, &candidate, cache_ctrl, is_head) {
        return resp;
    }

    let has_extension = Path::new(rel_target).extension().is_some();
    if !has_extension {
        if let Some(resp) = serve_file_within_root(&state.dist_dir, &index_html, "no-cache", is_head) {
            return resp;
        }
    }

    json_error_response(StatusCode::NOT_FOUND, "Không tìm thấy tài nguyên tĩnh.")
}

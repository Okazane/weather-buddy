use dashmap::DashMap;
use hmac::{Hmac, Mac};
use rand::RngCore;
use regex::Regex;
use sha2::Sha256;
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha256 = Hmac<Sha256>;

pub const MAX_REQUEST_BODY_BYTES: usize = 16 * 1024; // 16 KB strict cap
pub const UPSTREAM_FETCH_TIMEOUT_MS: u64 = 10_000; // 10s hard timeout
pub const CSRF_CLIENT_HEADER: &str = "x-weatherbuddy-client";
pub const CSRF_EXPECTED_VALUE: &str = "weatherbuddy-ui";

pub const HTML_CONTENT_SECURITY_POLICY: &str = concat!(
    "default-src 'self'; ",
    "script-src 'self' 'unsafe-inline'; ",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; ",
    "img-src 'self' data: blob:; ",
    "font-src 'self' data: https://fonts.gstatic.com; ",
    "connect-src 'self' http://localhost:* http://127.0.0.1:* https://api.open-meteo.com https://air-quality-api.open-meteo.com https://api.tomorrow.io https://api.weatherapi.com https://weather.googleapis.com https://api.bigdatacloud.net https://nominatim.openstreetmap.org https://ipwho.is https://get.geojs.io https://aviationweather.gov https://api.met.no; ",
    "object-src 'none'; ",
    "base-uri 'self'; ",
    "frame-ancestors 'none'"
);

fn process_key_hash_salt() -> &'static [u8; 32] {
    static SALT: OnceLock<[u8; 32]> = OnceLock::new();
    SALT.get_or_init(|| {
        let mut buf = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut buf);
        buf
    })
}

fn url_secret_param_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r#"(?i)([?&](?:key|apikey|api_key|token|access_token|secret)=)([^&\s"'#]+)"#)
            .expect("valid url secret regex")
    })
}

fn google_key_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"\bAIza[0-9A-Za-z_-]{12,}\b").expect("valid google key regex")
    })
}

fn bearer_token_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)\b(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}").expect("valid bearer regex")
    })
}

/// Scrubs API keys, URL secret parameters, Google `AIza...` tokens, and Bearer tokens
/// from any string before returning to clients or writing to logs.
pub fn redact_secrets(input: &str, raw_secrets: &[&str]) -> String {
    if input.is_empty() {
        return String::new();
    }
    let mut sanitized = input.to_string();

    for secret in raw_secrets {
        let trimmed = secret.trim();
        if trimmed.len() >= 3 {
            sanitized = sanitized.replace(trimmed, "[REDACTED]");
        }
    }

    sanitized = url_secret_param_regex()
        .replace_all(&sanitized, "${1}[REDACTED]")
        .into_owned();

    sanitized = google_key_regex()
        .replace_all(&sanitized, "[REDACTED_GOOGLE_KEY]")
        .into_owned();

    sanitized = bearer_token_regex()
        .replace_all(&sanitized, "${1}[REDACTED]")
        .into_owned();

    sanitized
}

/// Computes a per-process salted HMAC-SHA256 digest for cache-key isolation
/// so raw user keys are never kept in memory.
pub fn hash_api_keys_salted(
    tomorrow_io_api_key: &str,
    weather_api_key: &str,
    google_api_key: &str,
) -> String {
    let t = tomorrow_io_api_key.trim();
    let w = weather_api_key.trim();
    let g = google_api_key.trim();
    if t.is_empty() && w.is_empty() && g.is_empty() {
        return "free-open-meteo".to_string();
    }

    let mut mac = HmacSha256::new_from_slice(process_key_hash_salt())
        .expect("HMAC accepts any key size");
    mac.update(format!("t:{t}|w:{w}|g:{g}").as_bytes());
    let digest_hex = hex::encode(mac.finalize().into_bytes());
    digest_hex.chars().take(24).collect()
}

/// Checks whether a remote socket address is strict loopback.
pub fn is_strict_loopback(remote_addr: &str) -> bool {
    let trimmed = remote_addr.trim();
    if trimmed.is_empty() {
        return false;
    }
    // Strip optional port if formatted as 127.0.0.1:12345 or [::1]:12345
    let host_part = if let Some(rest) = trimmed.strip_prefix('[') {
        rest.split(']').next().unwrap_or(trimmed)
    } else if trimmed.matches(':').count() == 1 {
        trimmed.split(':').next().unwrap_or(trimmed)
    } else {
        trimmed
    };

    matches!(host_part, "127.0.0.1" | "::1" | "::ffff:127.0.0.1")
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CorsOriginEvaluation {
    pub present: bool,
    pub trusted: bool,
    pub allow_origin: Option<String>,
}

fn local_origin_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)^http://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$")
            .expect("valid local origin regex")
    })
}

fn extension_origin_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)^(chrome-extension|moz-extension|safari-web-extension)://[a-z0-9_-]+$")
            .expect("valid extension origin regex")
    })
}

pub fn evaluate_cors_origin(
    origin_header: Option<&str>,
    env_allowed_origins: Option<&str>,
) -> CorsOriginEvaluation {
    let Some(raw) = origin_header else {
        return CorsOriginEvaluation {
            present: false,
            trusted: true,
            allow_origin: None,
        };
    };
    let normalized = raw.trim();
    if normalized.is_empty() {
        return CorsOriginEvaluation {
            present: false,
            trusted: true,
            allow_origin: None,
        };
    }

    if local_origin_regex().is_match(normalized) || extension_origin_regex().is_match(normalized) {
        return CorsOriginEvaluation {
            present: true,
            trusted: true,
            allow_origin: Some(normalized.to_string()),
        };
    }

    if let Some(custom_list) = env_allowed_origins {
        for item in custom_list.split(',').map(str::trim).filter(|s| !s.is_empty()) {
            if item == normalized {
                return CorsOriginEvaluation {
                    present: true,
                    trusted: true,
                    allow_origin: Some(normalized.to_string()),
                };
            }
        }
    }

    CorsOriginEvaluation {
        present: true,
        trusted: false,
        allow_origin: None,
    }
}

/// Detects raw path traversal attempts (`..`, encoded `%2e%2e`, backslashes, null bytes)
/// or dotfile probes (`/.env`, `/.git`) BEFORE URL canonicalization can mask them.
pub fn is_suspicious_static_path(raw_url: &str, decoded_pathname: &str) -> bool {
    let raw_path_part = raw_url.split('?').next().unwrap_or("");
    let lower_raw = raw_path_part.to_ascii_lowercase();

    if raw_path_part.contains('\0')
        || raw_path_part.contains('\\')
        || lower_raw.contains("%2e%2e")
        || lower_raw.contains("%2f..")
        || lower_raw.contains("%5c")
        || lower_raw.contains("%00")
    {
        return true;
    }

    for seg in raw_path_part.split('/').filter(|s| !s.is_empty()) {
        if seg == "." || seg == ".." || seg.starts_with('.') {
            return true;
        }
    }

    for seg in decoded_pathname.split('/').filter(|s| !s.is_empty()) {
        if seg == "." || seg == ".." || seg.starts_with('.') {
            return true;
        }
    }

    false
}

#[derive(Debug, Clone, Copy)]
pub struct RateLimitRule {
    pub window_ms: u64,
    pub max: usize,
}

#[derive(Debug, Clone, Copy)]
pub struct RateLimitConfig {
    pub weather: RateLimitRule,
    pub pc_widget_launch: RateLimitRule,
    pub default_api: RateLimitRule,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            weather: RateLimitRule {
                window_ms: 60_000,
                max: 60,
            },
            pc_widget_launch: RateLimitRule {
                window_ms: 60_000,
                max: 10,
            },
            default_api: RateLimitRule {
                window_ms: 60_000,
                max: 120,
            },
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct RateLimitDecision {
    pub allowed: bool,
    pub limit: usize,
    pub remaining: usize,
    pub retry_after_sec: u64,
}

pub struct SlidingWindowRateLimiter {
    pub limits: RateLimitConfig,
    buckets: DashMap<String, Vec<u64>>,
}

impl SlidingWindowRateLimiter {
    pub fn new(limits: RateLimitConfig) -> Self {
        Self {
            limits,
            buckets: DashMap::new(),
        }
    }

    fn now_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }

    pub fn consume(&self, bucket_name: &str, client_ip: &str) -> RateLimitDecision {
        let rule = match bucket_name {
            "weather" => self.limits.weather,
            "pcWidgetLaunch" => self.limits.pc_widget_launch,
            _ => self.limits.default_api,
        };
        let now = Self::now_ms();
        if self.buckets.len() >= 500 {
            self.buckets
                .retain(|_, ts| ts.last().map_or(false, |&last| now.saturating_sub(last) <= 120_000));
        }
        let window_start = now.saturating_sub(rule.window_ms);
        let key = format!("{bucket_name}:{client_ip}");

        let mut entry = self.buckets.entry(key).or_default();
        entry.retain(|&ts| ts > window_start);

        if entry.len() >= rule.max {
            let oldest = entry.first().copied().unwrap_or(now);
            let remaining_ms = (oldest + rule.window_ms).saturating_sub(now);
            let retry_after_sec = ((remaining_ms + 999) / 1000).max(1);
            return RateLimitDecision {
                allowed: false,
                limit: rule.max,
                remaining: 0,
                retry_after_sec,
            };
        }

        entry.push(now);
        let remaining = rule.max.saturating_sub(entry.len());
        RateLimitDecision {
            allowed: true,
            limit: rule.max,
            remaining,
            retry_after_sec: 0,
        }
    }
}

use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use serde_json::Value;
use tower::ServiceExt;
use weather_buddy_core::{
    evaluate_character_decision, CharacterPrefs, CharacterSceneId, Gender, SkyTheme,
    ThermalSensitivity, WeatherSnapshot,
};
use weather_buddy_server::{
    build_router_with_limits,
    security::{hash_api_keys_salted, redact_secrets, RateLimitConfig, RateLimitRule},
    ServerConfig,
};

fn temp_server_config() -> ServerConfig {
    let dir = std::env::temp_dir().join(format!("wb-rust-test-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).expect("create temp dir");
    ServerConfig {
        host: "127.0.0.1".to_string(),
        port: 0,
        project_root: dir,
    }
}

#[tokio::test]
async fn test_health_and_security_headers() {
    let app = build_router_with_limits(temp_server_config(), RateLimitConfig::default())
        .await
        .expect("build router");

    let req = Request::builder()
        .method("GET")
        .uri("/api/health")
        .header("Origin", "http://localhost:8081")
        .body(Body::empty())
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(
        resp.headers()
            .get("x-content-type-options")
            .and_then(|v| v.to_str().ok()),
        Some("nosniff")
    );
    assert_eq!(
        resp.headers()
            .get("x-frame-options")
            .and_then(|v| v.to_str().ok()),
        Some("DENY")
    );
    assert_eq!(
        resp.headers()
            .get("referrer-policy")
            .and_then(|v| v.to_str().ok()),
        Some("no-referrer")
    );
    assert_eq!(
        resp.headers()
            .get("access-control-allow-origin")
            .and_then(|v| v.to_str().ok()),
        Some("http://localhost:8081")
    );

    let body_bytes = axum::body::to_bytes(resp.into_body(), 65536).await.unwrap();
    let json: Value = serde_json::from_slice(&body_bytes).unwrap();
    assert_eq!(json["status"], "ok");
    assert_eq!(json["service"], "weather-buddy-backend");
    assert_eq!(json["refreshIntervalMinutes"], 15);
}

#[tokio::test]
async fn test_path_traversal_and_dotfiles_return_403() {
    let app = build_router_with_limits(temp_server_config(), RateLimitConfig::default())
        .await
        .expect("build router");

    for suspicious_uri in ["/../.env", "/%2e%2e/.env", "/.env", "/.git/config"] {
        let req = Request::builder()
            .method("GET")
            .uri(suspicious_uri)
            .body(Body::empty())
            .unwrap();
        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(
            resp.status(),
            StatusCode::FORBIDDEN,
            "URI {suspicious_uri} must be blocked with 403"
        );
    }
}

#[tokio::test]
async fn test_csrf_guard_and_rate_limiting_on_pc_widget_launch() {
    let custom_limits = RateLimitConfig {
        pc_widget_launch: RateLimitRule {
            window_ms: 60_000,
            max: 2,
        },
        ..RateLimitConfig::default()
    };
    let app = build_router_with_limits(temp_server_config(), custom_limits)
        .await
        .expect("build router");

    // 1. Missing X-WeatherBuddy-Client header -> 403 Forbidden
    let req1 = Request::builder()
        .method("POST")
        .uri("/api/pc-widget/launch")
        .header("Content-Type", "application/json")
        .body(Body::from(r#"{"corner":"BottomRight"}"#))
        .unwrap();
    let resp1 = app.clone().oneshot(req1).await.unwrap();
    assert_eq!(resp1.status(), StatusCode::FORBIDDEN);

    // 2. Shell injection in corner enum with valid CSRF header -> 400 Bad Request
    let req2 = Request::builder()
        .method("POST")
        .uri("/api/pc-widget/launch")
        .header("Content-Type", "application/json")
        .header("X-WeatherBuddy-Client", "weatherbuddy-ui")
        .body(Body::from(r#"{"corner":"BottomRight; calc.exe"}"#))
        .unwrap();
    let resp2 = app.clone().oneshot(req2).await.unwrap();
    assert_eq!(resp2.status(), StatusCode::BAD_REQUEST);

    // 3. Third request within window exceeds max=2 -> 429 Too Many Requests
    let req3 = Request::builder()
        .method("POST")
        .uri("/api/pc-widget/launch")
        .header("Content-Type", "application/json")
        .header("X-WeatherBuddy-Client", "weatherbuddy-ui")
        .body(Body::from(r#"{}"#))
        .unwrap();
    let resp3 = app.clone().oneshot(req3).await.unwrap();
    assert_eq!(resp3.status(), StatusCode::TOO_MANY_REQUESTS);
}

#[test]
fn test_secret_redaction_and_salted_key_hashing() {
    let raw_google = ["AIza", "SyTestSecretToken1234567890"].join("");
    let msg = format!(
        "Failed request to https://api.tomorrow.io/v4?apikey=MY_TOMORROW_SECRET&key={raw_google} with Bearer eyJhbGciOiJIUzI1NiJ9"
    );
    let scrubbed = redact_secrets(&msg, &["MY_TOMORROW_SECRET"]);
    assert!(!scrubbed.contains("MY_TOMORROW_SECRET"));
    assert!(!scrubbed.contains(&raw_google));
    assert!(!scrubbed.contains("eyJhbGciOiJIUzI1NiJ9"));
    assert!(scrubbed.contains("[REDACTED]"));

    assert_eq!(hash_api_keys_salted("", "", ""), "free-open-meteo");
    let h1 = hash_api_keys_salted("k1", "", "");
    let h2 = hash_api_keys_salted("k2", "", "");
    assert_eq!(h1.len(), 24);
    assert_ne!(h1, h2);
    assert!(!h1.contains("k1"));
}

#[test]
fn test_rule_engine_decisions_in_server_context() {
    let snap = WeatherSnapshot {
        provider: "open_meteo".to_string(),
        location_name: "Sa Pa".to_string(),
        latitude: 22.3364,
        longitude: 103.8438,
        updated_at_iso: "2026-01-15T08:00:00+07:00".to_string(),
        utc_offset_seconds: Some(7 * 3600),
        temperature_c: 9.0,
        feels_like_c: 7.5,
        humidity_pct: 85,
        wind_speed_kmh: 15.0,
        wind_gust_kmh: 24.0,
        uv_index: 2.0,
        precip_mm_per_hr: 0.0,
        precip_prob_pct: 15,
        condition_text: "Rét đậm vùng cao".to_string(),
        is_day: true,
        aqi: Some(30),
        hourly: Vec::new(),
        verification: None,
    };
    let decision = evaluate_character_decision(
        &snap,
        CharacterPrefs {
            gender: Gender::Male,
            sensitivity: ThermalSensitivity::Normal,
        },
    );
    assert_eq!(decision.scene_id, CharacterSceneId::FreezingPuffer);
    assert_eq!(decision.sky_theme, SkyTheme::DayCloudy);
}

#[tokio::test]
async fn test_weather_verify_validates_coordinates_strictly() {
    let app = build_router_with_limits(temp_server_config(), RateLimitConfig::default())
        .await
        .expect("build router");

    let missing_req = Request::builder()
        .method("GET")
        .uri("/api/weather-verify")
        .body(Body::empty())
        .unwrap();
    let missing_resp = app.clone().oneshot(missing_req).await.unwrap();
    assert_eq!(missing_resp.status(), StatusCode::BAD_REQUEST);

    let invalid_req = Request::builder()
        .method("GET")
        .uri("/api/weather-verify?lat=999&lon=106.62")
        .body(Body::empty())
        .unwrap();
    let invalid_resp = app.oneshot(invalid_req).await.unwrap();
    assert_eq!(invalid_resp.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_api_parity_endpoints_and_non_string_launch_validation() {
    let app = build_router_with_limits(temp_server_config(), RateLimitConfig::default())
        .await
        .expect("build router");

    // 1. Root fallback discovery includes /api/weather-verify
    let root_req = Request::builder()
        .method("GET")
        .uri("/")
        .body(Body::empty())
        .unwrap();
    let root_resp = app.clone().oneshot(root_req).await.unwrap();
    assert_eq!(root_resp.status(), StatusCode::OK);
    let root_bytes = axum::body::to_bytes(root_resp.into_body(), 65536)
        .await
        .unwrap();
    let root_json: Value = serde_json::from_slice(&root_bytes).unwrap();
    let endpoints = root_json["endpoints"].as_array().expect("endpoints array");
    assert!(
        endpoints
            .iter()
            .any(|v| v.as_str() == Some("/api/weather-verify")),
        "Fallback endpoints must advertise /api/weather-verify"
    );

    // 2. GET /api/security/status returns hardened posture
    let sec_req = Request::builder()
        .method("GET")
        .uri("/api/security/status")
        .body(Body::empty())
        .unwrap();
    let sec_resp = app.clone().oneshot(sec_req).await.unwrap();
    assert_eq!(sec_resp.status(), StatusCode::OK);
    let sec_bytes = axum::body::to_bytes(sec_resp.into_body(), 65536)
        .await
        .unwrap();
    let sec_json: Value = serde_json::from_slice(&sec_bytes).unwrap();
    assert_eq!(sec_json["csrfProtected"], true);
    assert_eq!(sec_json["rateLimitActive"], true);

    // 3. POST /api/pc-widget/launch rejects non-string corner value with 400
    let bad_type_req = Request::builder()
        .method("POST")
        .uri("/api/pc-widget/launch")
        .header("Content-Type", "application/json")
        .header("X-WeatherBuddy-Client", "weatherbuddy-ui")
        .body(Body::from(r#"{"corner":123}"#))
        .unwrap();
    let bad_type_resp = app.clone().oneshot(bad_type_req).await.unwrap();
    assert_eq!(bad_type_resp.status(), StatusCode::BAD_REQUEST);

    // 4. Widget sync POST -> GET -> DELETE lifecycle
    let sync_post = Request::builder()
        .method("POST")
        .uri("/api/widget-sync")
        .header("Content-Type", "application/json")
        .body(Body::from(
            r#"{"locationName":"Hà Nội","temperatureC":26,"gender":"male","sceneId":"pleasant_sunny"}"#,
        ))
        .unwrap();
    let sync_post_resp = app.clone().oneshot(sync_post).await.unwrap();
    assert_eq!(sync_post_resp.status(), StatusCode::OK);

    let sync_get = Request::builder()
        .method("GET")
        .uri("/api/widget-sync")
        .body(Body::empty())
        .unwrap();
    let sync_get_resp = app.clone().oneshot(sync_get).await.unwrap();
    assert_eq!(sync_get_resp.status(), StatusCode::OK);
    let sync_bytes = axum::body::to_bytes(sync_get_resp.into_body(), 65536)
        .await
        .unwrap();
    let sync_json: Value = serde_json::from_slice(&sync_bytes).unwrap();
    assert_eq!(sync_json["synced"], true);
    assert_eq!(sync_json["payload"]["locationName"], "Hà Nội");

    let sync_del = Request::builder()
        .method("DELETE")
        .uri("/api/widget-sync")
        .body(Body::empty())
        .unwrap();
    let sync_del_resp = app.oneshot(sync_del).await.unwrap();
    assert_eq!(sync_del_resp.status(), StatusCode::OK);
}

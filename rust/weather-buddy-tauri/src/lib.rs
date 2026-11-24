pub mod tray;
pub mod window_position;

use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use anyhow::{anyhow, Context, Result};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, State, WindowEvent};
use tokio::net::TcpStream;
use tokio::task::JoinHandle;
use tracing::{error, info, warn};
use weather_buddy_core::{Gender, PRESET_CITIES};
use weather_buddy_server::{spawn_background_server, ServerConfig};

use crate::window_position::{
    apply_widget_bounds, SnappedWindowBounds, WidgetCorner, WidgetSizeMode,
};

pub const MAIN_WINDOW_LABEL: &str = "main";
pub const WIDGET_WINDOW_LABEL: &str = "companion-widget";
pub const DEFAULT_SERVER_HOST: &str = "127.0.0.1";
pub const DEFAULT_SERVER_PORT: u16 = 8787;

pub const EVENT_WIDGET_CONFIG_CHANGED: &str = "weatherbuddy://widget-config-changed";
pub const EVENT_CHARACTER_CHANGED: &str = "weatherbuddy://character-changed";
pub const EVENT_REFRESH_WEATHER: &str = "weatherbuddy://refresh-weather";
pub const EVENT_BACKEND_READY: &str = "weatherbuddy://backend-ready";

struct RuntimeStateInner {
    corner: WidgetCorner,
    size_mode: WidgetSizeMode,
    always_on_top: bool,
    gender: Gender,
    embedded_server_active: bool,
    reused_external_server: bool,
    server_url: String,
    started_at: Instant,
    server_task: Option<JoinHandle<()>>,
}

#[derive(Clone)]
pub struct SharedRuntimeState {
    inner: Arc<Mutex<RuntimeStateInner>>,
}

impl Default for SharedRuntimeState {
    fn default() -> Self {
        Self::new()
    }
}

impl SharedRuntimeState {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(RuntimeStateInner {
                corner: WidgetCorner::BottomRight,
                size_mode: WidgetSizeMode::Standard,
                always_on_top: true,
                gender: Gender::Female,
                embedded_server_active: false,
                reused_external_server: false,
                server_url: format!("http://{}:{}", DEFAULT_SERVER_HOST, DEFAULT_SERVER_PORT),
                started_at: Instant::now(),
                server_task: None,
            })),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WidgetConfigEventPayload {
    pub corner: WidgetCorner,
    pub size_mode: WidgetSizeMode,
    pub always_on_top: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CharacterChangedPayload {
    pub gender: Gender,
    pub character_name_vi: &'static str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshWeatherPayload {
    pub requested_at_unix_ms: u64,
    pub source: &'static str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendReadyPayload {
    pub server_url: String,
    pub reused_external_server: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppRuntimeStats {
    pub app_version: String,
    pub runtime: &'static str,
    pub platform: &'static str,
    pub arch: &'static str,
    pub pid: u32,
    pub uptime_seconds: u64,
    pub server_url: String,
    pub embedded_server_active: bool,
    pub reused_external_server: bool,
    pub widget_corner: WidgetCorner,
    pub widget_size_mode: WidgetSizeMode,
    pub always_on_top: bool,
    pub character_gender: Gender,
    pub character_name_vi: &'static str,
    pub preset_cities_count: usize,
    pub memory_footprint_tier: &'static str,
}

/// Resolves the WeatherBuddy project root directory so the embedded Axum server can
/// serve `dist/`, `desktop-widget/`, and `public/downloads/` whether running in dev or release.
fn resolve_project_root() -> PathBuf {
    if let Ok(exe_path) = std::env::current_exe() {
        for ancestor in exe_path.ancestors().skip(1) {
            if ancestor.join("dist").is_dir() || ancestor.join("desktop-widget").is_dir() {
                return ancestor.to_path_buf();
            }
        }
    }

    if let Ok(cwd) = std::env::current_dir() {
        for ancestor in cwd.ancestors() {
            if ancestor.join("dist").is_dir() || ancestor.join("desktop-widget").is_dir() {
                return ancestor.to_path_buf();
            }
        }
        return cwd;
    }

    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(|p| p.parent())
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
}

/// Checks if a local backend is already listening on `127.0.0.1:8787`.
async fn is_port_already_listening(host: &str, port: u16) -> bool {
    let addr = format!("{}:{}", host, port);
    matches!(
        tokio::time::timeout(Duration::from_millis(250), TcpStream::connect(&addr)).await,
        Ok(Ok(_))
    )
}

/// Boots the embedded in-process Axum server (`weather-buddy-server`) on `127.0.0.1:8787`
/// unless another WeatherBuddy backend is already bound on that port.
async fn ensure_embedded_backend<R: Runtime>(app: AppHandle<R>, state: SharedRuntimeState) {
    let server_url = format!("http://{}:{}", DEFAULT_SERVER_HOST, DEFAULT_SERVER_PORT);

    if is_port_already_listening(DEFAULT_SERVER_HOST, DEFAULT_SERVER_PORT).await {
        info!(
            url = %server_url,
            "Detected existing WeatherBuddy backend on port 8787; reusing active instance"
        );
        if let Ok(mut guard) = state.inner.lock() {
            guard.embedded_server_active = true;
            guard.reused_external_server = true;
            guard.server_url = server_url.clone();
        }
        let _ = app.emit(
            EVENT_BACKEND_READY,
            BackendReadyPayload {
                server_url,
                reused_external_server: true,
            },
        );
        return;
    }

    let project_root = resolve_project_root();
    info!(
        url = %server_url,
        project_root = %project_root.display(),
        "Starting embedded in-process WeatherBuddy Axum backend"
    );

    let config = ServerConfig {
        host: DEFAULT_SERVER_HOST.to_string(),
        port: DEFAULT_SERVER_PORT,
        project_root,
    };

    match spawn_background_server(config).await {
        Ok(handle) => {
            if let Ok(mut guard) = state.inner.lock() {
                guard.embedded_server_active = true;
                guard.reused_external_server = false;
                guard.server_url = server_url.clone();
                guard.server_task = Some(handle);
            }
            let _ = app.emit(
                EVENT_BACKEND_READY,
                BackendReadyPayload {
                    server_url,
                    reused_external_server: false,
                },
            );
        }
        Err(err) => {
            error!(?err, "Failed to boot embedded WeatherBuddy backend server");
        }
    }
}

pub fn show_dashboard_window<R: Runtime>(app: &AppHandle<R>) -> Result<()> {
    let window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| anyhow!("Main dashboard window '{}' not found", MAIN_WINDOW_LABEL))?;
    let _ = window.unminimize();
    window.show().context("show main dashboard window")?;
    window.set_focus().context("focus main dashboard window")?;
    Ok(())
}

pub fn toggle_companion_widget<R: Runtime>(app: &AppHandle<R>) -> Result<bool> {
    let window = app
        .get_webview_window(WIDGET_WINDOW_LABEL)
        .ok_or_else(|| anyhow!("Companion widget window '{}' not found", WIDGET_WINDOW_LABEL))?;

    let currently_visible = window.is_visible().unwrap_or(true);
    if currently_visible {
        window.hide().context("hide companion widget")?;
        Ok(false)
    } else {
        let (corner, size_mode, always_on_top) = {
            let state = app.state::<SharedRuntimeState>();
            let guard = state
                .inner
                .lock()
                .map_err(|_| anyhow!("Runtime state mutex poisoned"))?;
            (guard.corner, guard.size_mode, guard.always_on_top)
        };
        let _ = apply_widget_bounds(&window, corner, size_mode);
        let _ = window.set_always_on_top(always_on_top);
        let _ = window.unminimize();
        window.show().context("show companion widget")?;
        window.set_focus().context("focus companion widget")?;
        Ok(true)
    }
}

pub fn apply_corner_snap<R: Runtime>(
    app: &AppHandle<R>,
    corner: WidgetCorner,
) -> Result<SnappedWindowBounds> {
    let (size_mode, always_on_top) = {
        let state = app.state::<SharedRuntimeState>();
        let mut guard = state
            .inner
            .lock()
            .map_err(|_| anyhow!("Runtime state mutex poisoned"))?;
        guard.corner = corner;
        (guard.size_mode, guard.always_on_top)
    };

    let window = app
        .get_webview_window(WIDGET_WINDOW_LABEL)
        .ok_or_else(|| anyhow!("Companion widget window '{}' not found", WIDGET_WINDOW_LABEL))?;
    let bounds = apply_widget_bounds(&window, corner, size_mode)?;

    let _ = app.emit(
        EVENT_WIDGET_CONFIG_CHANGED,
        WidgetConfigEventPayload {
            corner,
            size_mode,
            always_on_top,
        },
    );
    Ok(bounds)
}

pub fn apply_size_mode<R: Runtime>(
    app: &AppHandle<R>,
    size_mode: WidgetSizeMode,
) -> Result<SnappedWindowBounds> {
    let (corner, always_on_top) = {
        let state = app.state::<SharedRuntimeState>();
        let mut guard = state
            .inner
            .lock()
            .map_err(|_| anyhow!("Runtime state mutex poisoned"))?;
        guard.size_mode = size_mode;
        (guard.corner, guard.always_on_top)
    };

    let window = app
        .get_webview_window(WIDGET_WINDOW_LABEL)
        .ok_or_else(|| anyhow!("Companion widget window '{}' not found", WIDGET_WINDOW_LABEL))?;
    let bounds = apply_widget_bounds(&window, corner, size_mode)?;

    let _ = app.emit(
        EVENT_WIDGET_CONFIG_CHANGED,
        WidgetConfigEventPayload {
            corner,
            size_mode,
            always_on_top,
        },
    );
    Ok(bounds)
}

pub fn set_character_gender<R: Runtime>(app: &AppHandle<R>, gender: Gender) -> Result<()> {
    {
        let state = app.state::<SharedRuntimeState>();
        let mut guard = state
            .inner
            .lock()
            .map_err(|_| anyhow!("Runtime state mutex poisoned"))?;
        guard.gender = gender;
    }

    app.emit(
        EVENT_CHARACTER_CHANGED,
        CharacterChangedPayload {
            gender,
            character_name_vi: gender.default_character_name_vi(),
        },
    )
    .context("emit character-changed event")?;
    Ok(())
}

pub fn trigger_weather_refresh<R: Runtime>(app: &AppHandle<R>) -> Result<()> {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    app.emit(
        EVENT_REFRESH_WEATHER,
        RefreshWeatherPayload {
            requested_at_unix_ms: now_ms,
            source: "system_tray",
        },
    )
    .context("emit refresh-weather event")?;
    Ok(())
}

pub fn shutdown_and_exit<R: Runtime>(app: &AppHandle<R>) {
    if let Some(state) = app.try_state::<SharedRuntimeState>() {
        if let Ok(mut guard) = state.inner.lock() {
            if let Some(handle) = guard.server_task.take() {
                handle.abort();
            }
            guard.embedded_server_active = false;
        }
    }
    app.exit(0);
}

#[tauri::command]
fn snap_widget_corner(
    app: AppHandle,
    _state: State<'_, SharedRuntimeState>,
    corner: String,
) -> std::result::Result<SnappedWindowBounds, String> {
    let parsed = WidgetCorner::parse_flexible(&corner).map_err(|e| e.to_string())?;
    apply_corner_snap(&app, parsed).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_widget_size(
    app: AppHandle,
    _state: State<'_, SharedRuntimeState>,
    size_mode: String,
) -> std::result::Result<SnappedWindowBounds, String> {
    let parsed = WidgetSizeMode::parse_flexible(&size_mode).map_err(|e| e.to_string())?;
    apply_size_mode(&app, parsed).map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_always_on_top(
    app: AppHandle,
    state: State<'_, SharedRuntimeState>,
    enabled: Option<bool>,
) -> std::result::Result<bool, String> {
    let (next_flag, corner, size_mode) = {
        let mut guard = state
            .inner
            .lock()
            .map_err(|_| "Runtime state mutex poisoned".to_string())?;
        let next = enabled.unwrap_or(!guard.always_on_top);
        guard.always_on_top = next;
        (next, guard.corner, guard.size_mode)
    };

    let window = app
        .get_webview_window(WIDGET_WINDOW_LABEL)
        .ok_or_else(|| format!("Companion widget window '{}' not found", WIDGET_WINDOW_LABEL))?;
    window
        .set_always_on_top(next_flag)
        .map_err(|e| format!("Failed updating always-on-top: {}", e))?;

    let _ = app.emit(
        EVENT_WIDGET_CONFIG_CHANGED,
        WidgetConfigEventPayload {
            corner,
            size_mode,
            always_on_top: next_flag,
        },
    );

    Ok(next_flag)
}

#[tauri::command]
fn open_dashboard_window(app: AppHandle) -> std::result::Result<(), String> {
    show_dashboard_window(&app).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_app_runtime_stats(
    state: State<'_, SharedRuntimeState>,
) -> std::result::Result<AppRuntimeStats, String> {
    let guard = state
        .inner
        .lock()
        .map_err(|_| "Runtime state mutex poisoned".to_string())?;

    Ok(AppRuntimeStats {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        runtime: "tauri-v2-rust",
        platform: std::env::consts::OS,
        arch: std::env::consts::ARCH,
        pid: std::process::id(),
        uptime_seconds: guard.started_at.elapsed().as_secs(),
        server_url: guard.server_url.clone(),
        embedded_server_active: guard.embedded_server_active,
        reused_external_server: guard.reused_external_server,
        widget_corner: guard.corner,
        widget_size_mode: guard.size_mode,
        always_on_top: guard.always_on_top,
        character_gender: guard.gender,
        character_name_vi: guard.gender.default_character_name_vi(),
        preset_cities_count: PRESET_CITIES.len(),
        memory_footprint_tier: "ultra-lightweight (~25-35 MB WebView2)",
    })
}

fn init_tracing() {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info,weather_buddy_tauri_lib=debug"));
    let _ = tracing_subscriber::fmt().with_env_filter(filter).try_init();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_tracing();

    let runtime_state = SharedRuntimeState::new();
    let setup_state = runtime_state.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let wants_dashboard = args.iter().any(|arg| arg == "--dashboard");
            if wants_dashboard {
                if let Err(err) = show_dashboard_window(app) {
                    warn!(?err, "Single-instance focus failed for dashboard");
                }
            } else if let Some(widget) = app.get_webview_window(WIDGET_WINDOW_LABEL) {
                let _ = widget.unminimize();
                let _ = widget.show();
                let _ = widget.set_focus();
            }
        }))
        .manage(runtime_state)
        .setup(move |app| {
            let app_handle = app.handle().clone();

            // 1. Initialize native Vietnamese system tray icon & menu
            tray::build_system_tray(&app_handle)?;

            // 2. Position & pin the frameless transparent companion widget at BottomRight
            if let Some(widget_win) = app.get_webview_window(WIDGET_WINDOW_LABEL) {
                if let Err(err) = apply_widget_bounds(
                    &widget_win,
                    WidgetCorner::BottomRight,
                    WidgetSizeMode::Standard,
                ) {
                    warn!(?err, "Initial companion widget corner snap skipped");
                }
                let _ = widget_win.set_always_on_top(true);
            }

            // 3. Intercept Main Dashboard close -> hide to tray so companion widget stays alive
            if let Some(main_win) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                let main_win_handle = main_win.clone();
                main_win.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = main_win_handle.hide();
                    }
                });
            }

            // 4. Boot embedded in-process Axum backend on 127.0.0.1:8787
            let bg_app_handle = app_handle.clone();
            let bg_state = setup_state.clone();
            tauri::async_runtime::spawn(async move {
                ensure_embedded_backend(bg_app_handle, bg_state).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            snap_widget_corner,
            set_widget_size,
            toggle_always_on_top,
            open_dashboard_window,
            get_app_runtime_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running WeatherBuddy Tauri v2 application");
}

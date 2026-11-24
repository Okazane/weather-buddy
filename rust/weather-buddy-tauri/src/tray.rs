use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Runtime};
use tracing::{error, info};
use weather_buddy_core::Gender;

use crate::window_position::{WidgetCorner, WidgetSizeMode};
use crate::{
    apply_corner_snap, apply_size_mode, set_character_gender, show_dashboard_window,
    shutdown_and_exit, toggle_companion_widget, trigger_weather_refresh,
};

pub const TRAY_ICON_ID: &str = "weatherbuddy-tray";

pub mod menu_id {
    pub const OPEN_DASHBOARD: &str = "open_dashboard";
    pub const TOGGLE_WIDGET: &str = "toggle_widget";
    pub const SNAP_BOTTOM_RIGHT: &str = "snap_bottom_right";
    pub const SNAP_TOP_RIGHT: &str = "snap_top_right";
    pub const SNAP_BOTTOM_LEFT: &str = "snap_bottom_left";
    pub const SNAP_TOP_LEFT: &str = "snap_top_left";
    pub const SIZE_COMPACT: &str = "size_compact";
    pub const SIZE_STANDARD: &str = "size_standard";
    pub const CHARACTER_MALE: &str = "character_male";
    pub const CHARACTER_FEMALE: &str = "character_female";
    pub const REFRESH_WEATHER: &str = "refresh_weather";
    pub const QUIT_APP: &str = "quit_app";
}

/// Builds and registers the native Windows system tray icon with full Vietnamese controls.
pub fn build_system_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let open_dashboard = MenuItem::with_id(
        app,
        menu_id::OPEN_DASHBOARD,
        "🌤️ Mở Bảng điều khiển WeatherBuddy",
        true,
        None::<&str>,
    )?;
    let toggle_widget = MenuItem::with_id(
        app,
        menu_id::TOGGLE_WIDGET,
        "📌 Hiện / Ẩn Widget góc màn hình",
        true,
        None::<&str>,
    )?;

    let sep_1 = PredefinedMenuItem::separator(app)?;

    let snap_bottom_right = MenuItem::with_id(
        app,
        menu_id::SNAP_BOTTOM_RIGHT,
        "↘️ Ghim Góc phải dưới",
        true,
        None::<&str>,
    )?;
    let snap_top_right = MenuItem::with_id(
        app,
        menu_id::SNAP_TOP_RIGHT,
        "↗️ Ghim Góc phải trên",
        true,
        None::<&str>,
    )?;
    let snap_bottom_left = MenuItem::with_id(
        app,
        menu_id::SNAP_BOTTOM_LEFT,
        "↙️ Ghim Góc trái dưới",
        true,
        None::<&str>,
    )?;
    let snap_top_left = MenuItem::with_id(
        app,
        menu_id::SNAP_TOP_LEFT,
        "↖️ Ghim Góc trái trên",
        true,
        None::<&str>,
    )?;

    let sep_2 = PredefinedMenuItem::separator(app)?;

    let size_compact = MenuItem::with_id(
        app,
        menu_id::SIZE_COMPACT,
        "📐 Chế độ Gọn nhẹ (300×420)",
        true,
        None::<&str>,
    )?;
    let size_standard = MenuItem::with_id(
        app,
        menu_id::SIZE_STANDARD,
        "📐 Chế độ Tiêu chuẩn (380×540)",
        true,
        None::<&str>,
    )?;

    let sep_3 = PredefinedMenuItem::separator(app)?;

    let character_male = MenuItem::with_id(
        app,
        menu_id::CHARACTER_MALE,
        "👦 Nhân vật Nam (Cậu bé Mây)",
        true,
        None::<&str>,
    )?;
    let character_female = MenuItem::with_id(
        app,
        menu_id::CHARACTER_FEMALE,
        "👧 Nhân vật Nữ (Cô bé Nắng)",
        true,
        None::<&str>,
    )?;

    let sep_4 = PredefinedMenuItem::separator(app)?;

    let refresh_weather = MenuItem::with_id(
        app,
        menu_id::REFRESH_WEATHER,
        "🔄 Làm mới thời tiết ngay",
        true,
        None::<&str>,
    )?;
    let quit_app = MenuItem::with_id(
        app,
        menu_id::QUIT_APP,
        "❌ Thoát WeatherBuddy",
        true,
        None::<&str>,
    )?;

    let menu = Menu::with_items(
        app,
        &[
            &open_dashboard,
            &toggle_widget,
            &sep_1,
            &snap_bottom_right,
            &snap_top_right,
            &snap_bottom_left,
            &snap_top_left,
            &sep_2,
            &size_compact,
            &size_standard,
            &sep_3,
            &character_male,
            &character_female,
            &sep_4,
            &refresh_weather,
            &quit_app,
        ],
    )?;

    let mut tray_builder = TrayIconBuilder::with_id(TRAY_ICON_ID)
        .menu(&menu)
        .tooltip("WeatherBuddy — Trợ lý Thời tiết & Chibi 3D")
        .show_menu_on_left_click(false)
        .on_menu_event(|app_handle, event| {
            handle_tray_menu_event(app_handle, event.id().as_ref());
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app_handle = tray.app_handle();
                if let Err(err) = toggle_companion_widget(app_handle) {
                    error!(?err, "Failed toggling companion widget from tray click");
                }
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray_builder = tray_builder.icon(icon.clone());
    }

    tray_builder.build(app)?;
    info!("WeatherBuddy native system tray initialized");
    Ok(())
}

fn handle_tray_menu_event<R: Runtime>(app: &AppHandle<R>, item_id: &str) {
    match item_id {
        menu_id::OPEN_DASHBOARD => {
            if let Err(err) = show_dashboard_window(app) {
                error!(?err, "Failed to open WeatherBuddy dashboard window");
            }
        }
        menu_id::TOGGLE_WIDGET => {
            if let Err(err) = toggle_companion_widget(app) {
                error!(?err, "Failed to toggle companion widget visibility");
            }
        }
        menu_id::SNAP_BOTTOM_RIGHT => {
            if let Err(err) = apply_corner_snap(app, WidgetCorner::BottomRight) {
                error!(?err, "Failed snapping widget to BottomRight");
            }
        }
        menu_id::SNAP_TOP_RIGHT => {
            if let Err(err) = apply_corner_snap(app, WidgetCorner::TopRight) {
                error!(?err, "Failed snapping widget to TopRight");
            }
        }
        menu_id::SNAP_BOTTOM_LEFT => {
            if let Err(err) = apply_corner_snap(app, WidgetCorner::BottomLeft) {
                error!(?err, "Failed snapping widget to BottomLeft");
            }
        }
        menu_id::SNAP_TOP_LEFT => {
            if let Err(err) = apply_corner_snap(app, WidgetCorner::TopLeft) {
                error!(?err, "Failed snapping widget to TopLeft");
            }
        }
        menu_id::SIZE_COMPACT => {
            if let Err(err) = apply_size_mode(app, WidgetSizeMode::Compact) {
                error!(?err, "Failed switching widget to Compact mode");
            }
        }
        menu_id::SIZE_STANDARD => {
            if let Err(err) = apply_size_mode(app, WidgetSizeMode::Standard) {
                error!(?err, "Failed switching widget to Standard mode");
            }
        }
        menu_id::CHARACTER_MALE => {
            if let Err(err) = set_character_gender(app, Gender::Male) {
                error!(?err, "Failed switching character to Male");
            }
        }
        menu_id::CHARACTER_FEMALE => {
            if let Err(err) = set_character_gender(app, Gender::Female) {
                error!(?err, "Failed switching character to Female");
            }
        }
        menu_id::REFRESH_WEATHER => {
            if let Err(err) = trigger_weather_refresh(app) {
                error!(?err, "Failed dispatching weather refresh event");
            }
        }
        menu_id::QUIT_APP => {
            info!("Tray quit requested — shutting down WeatherBuddy");
            shutdown_and_exit(app);
        }
        other => {
            info!(menu_id = other, "Unhandled tray menu action");
        }
    }
}

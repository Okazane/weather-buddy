use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use tauri::{PhysicalPosition, PhysicalSize, Position, Runtime, Size, WebviewWindow};

/// Default logical margin (in CSS / DIP pixels) from the monitor work-area edges.
pub const EDGE_MARGIN_LOGICAL: f64 = 16.0;

/// Compact desktop widget logical dimensions (matches Electron / PowerShell launcher).
pub const COMPACT_WIDTH_LOGICAL: u32 = 300;
pub const COMPACT_HEIGHT_LOGICAL: u32 = 420;

/// Standard desktop widget logical dimensions (matches Electron / PowerShell launcher).
pub const STANDARD_WIDTH_LOGICAL: u32 = 380;
pub const STANDARD_HEIGHT_LOGICAL: u32 = 540;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
pub enum WidgetCorner {
    #[default]
    BottomRight,
    TopRight,
    BottomLeft,
    TopLeft,
}

impl WidgetCorner {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::BottomRight => "BottomRight",
            Self::TopRight => "TopRight",
            Self::BottomLeft => "BottomLeft",
            Self::TopLeft => "TopLeft",
        }
    }

    pub fn parse_flexible(raw: &str) -> Result<Self> {
        let normalized = raw
            .trim()
            .replace(['-', '_', ' '], "")
            .to_ascii_lowercase();
        match normalized.as_str() {
            "bottomright" => Ok(Self::BottomRight),
            "topright" => Ok(Self::TopRight),
            "bottomleft" => Ok(Self::BottomLeft),
            "topleft" => Ok(Self::TopLeft),
            _ => Err(anyhow!(
                "Invalid widget corner '{}': expected BottomRight, TopRight, BottomLeft, or TopLeft",
                raw
            )),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
pub enum WidgetSizeMode {
    Compact,
    #[default]
    Standard,
}

impl WidgetSizeMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Compact => "Compact",
            Self::Standard => "Standard",
        }
    }

    pub fn logical_dimensions(&self) -> (u32, u32) {
        match self {
            Self::Compact => (COMPACT_WIDTH_LOGICAL, COMPACT_HEIGHT_LOGICAL),
            Self::Standard => (STANDARD_WIDTH_LOGICAL, STANDARD_HEIGHT_LOGICAL),
        }
    }

    pub fn physical_dimensions(&self, scale_factor: f64) -> (u32, u32) {
        let scale = sanitize_scale_factor(scale_factor);
        let (lw, lh) = self.logical_dimensions();
        (
            (lw as f64 * scale).round().max(1.0) as u32,
            (lh as f64 * scale).round().max(1.0) as u32,
        )
    }

    pub fn parse_flexible(raw: &str) -> Result<Self> {
        let normalized = raw.trim().to_ascii_lowercase();
        match normalized.as_str() {
            "compact" | "small" | "mini" => Ok(Self::Compact),
            "standard" | "normal" | "default" => Ok(Self::Standard),
            _ => Err(anyhow!(
                "Invalid widget size mode '{}': expected Compact or Standard",
                raw
            )),
        }
    }
}

/// Physical monitor work-area rectangle (excluding Windows taskbar / docked appbars)
/// together with its DPI scale factor (`1.0`, `1.25`, `1.5`, `2.0`, ...).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorWorkArea {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
}

/// Exact physical & logical coordinates computed for snapping the companion widget.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnappedWindowBounds {
    pub physical_x: i32,
    pub physical_y: i32,
    pub physical_width: u32,
    pub physical_height: u32,
    pub logical_width: u32,
    pub logical_height: u32,
    pub margin_physical: i32,
    pub corner: WidgetCorner,
    pub size_mode: WidgetSizeMode,
}

#[inline]
fn sanitize_scale_factor(scale_factor: f64) -> f64 {
    if scale_factor.is_finite() && scale_factor > 0.0 {
        scale_factor
    } else {
        1.0
    }
}

/// Computes DPI-aware, multi-monitor work-area coordinates for anchoring the widget
/// to one of the four screen corners with a `16px` logical margin.
pub fn compute_snapped_bounds(
    work_area: MonitorWorkArea,
    corner: WidgetCorner,
    size_mode: WidgetSizeMode,
) -> SnappedWindowBounds {
    let scale = sanitize_scale_factor(work_area.scale_factor);
    let (logical_width, logical_height) = size_mode.logical_dimensions();
    let (physical_width, physical_height) = size_mode.physical_dimensions(scale);
    let margin_physical = (EDGE_MARGIN_LOGICAL * scale).round() as i32;

    let min_x = work_area.x;
    let min_y = work_area.y;
    let right_edge = work_area.x.saturating_add(work_area.width as i32);
    let bottom_edge = work_area.y.saturating_add(work_area.height as i32);

    let max_x = right_edge
        .saturating_sub(physical_width as i32)
        .saturating_sub(margin_physical)
        .max(min_x);
    let max_y = bottom_edge
        .saturating_sub(physical_height as i32)
        .saturating_sub(margin_physical)
        .max(min_y);

    let (physical_x, physical_y) = match corner {
        WidgetCorner::TopLeft => (
            min_x.saturating_add(margin_physical),
            min_y.saturating_add(margin_physical),
        ),
        WidgetCorner::TopRight => (max_x, min_y.saturating_add(margin_physical)),
        WidgetCorner::BottomLeft => (min_x.saturating_add(margin_physical), max_y),
        WidgetCorner::BottomRight => (max_x, max_y),
    };

    SnappedWindowBounds {
        physical_x,
        physical_y,
        physical_width,
        physical_height,
        logical_width,
        logical_height,
        margin_physical,
        corner,
        size_mode,
    }
}

/// Resolves the active monitor's DPI-aware work area for `window`, falling back to
/// the primary monitor, and applies both size and corner position immediately.
pub fn apply_widget_bounds<R: Runtime>(
    window: &WebviewWindow<R>,
    corner: WidgetCorner,
    size_mode: WidgetSizeMode,
) -> Result<SnappedWindowBounds> {
    let monitor = match window.current_monitor().context("query current monitor")? {
        Some(m) => Some(m),
        None => window.primary_monitor().context("query primary monitor")?,
    }
    .ok_or_else(|| anyhow!("No active or primary monitor detected for companion widget"))?;

    let work_rect = monitor.work_area();
    let work_area = MonitorWorkArea {
        x: work_rect.position.x,
        y: work_rect.position.y,
        width: work_rect.size.width,
        height: work_rect.size.height,
        scale_factor: monitor.scale_factor(),
    };

    let bounds = compute_snapped_bounds(work_area, corner, size_mode);

    window
        .set_size(Size::Physical(PhysicalSize::new(
            bounds.physical_width,
            bounds.physical_height,
        )))
        .context("set companion widget size")?;

    window
        .set_position(Position::Physical(PhysicalPosition::new(
            bounds.physical_x,
            bounds.physical_y,
        )))
        .context("set companion widget position")?;

    Ok(bounds)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snaps_all_four_corners_at_100_percent_dpi() {
        // 1920x1080 with 40px Windows taskbar -> 1920x1040 work area
        let wa = MonitorWorkArea {
            x: 0,
            y: 0,
            width: 1920,
            height: 1040,
            scale_factor: 1.0,
        };

        let br = compute_snapped_bounds(wa, WidgetCorner::BottomRight, WidgetSizeMode::Standard);
        assert_eq!(br.physical_width, 380);
        assert_eq!(br.physical_height, 540);
        assert_eq!(br.physical_x, 1920 - 380 - 16);
        assert_eq!(br.physical_y, 1040 - 540 - 16);

        let tr = compute_snapped_bounds(wa, WidgetCorner::TopRight, WidgetSizeMode::Standard);
        assert_eq!(tr.physical_x, 1920 - 380 - 16);
        assert_eq!(tr.physical_y, 16);

        let bl = compute_snapped_bounds(wa, WidgetCorner::BottomLeft, WidgetSizeMode::Compact);
        assert_eq!(bl.physical_width, 300);
        assert_eq!(bl.physical_height, 420);
        assert_eq!(bl.physical_x, 16);
        assert_eq!(bl.physical_y, 1040 - 420 - 16);

        let tl = compute_snapped_bounds(wa, WidgetCorner::TopLeft, WidgetSizeMode::Compact);
        assert_eq!(tl.physical_x, 16);
        assert_eq!(tl.physical_y, 16);
    }

    #[test]
    fn scales_dimensions_and_margin_for_150_percent_hidpi() {
        // 3840x2160 monitor at 150% DPI scaling with 60px taskbar -> height 2100
        let wa = MonitorWorkArea {
            x: 0,
            y: 0,
            width: 3840,
            height: 2100,
            scale_factor: 1.5,
        };

        let br = compute_snapped_bounds(wa, WidgetCorner::BottomRight, WidgetSizeMode::Standard);
        assert_eq!(br.physical_width, 570);
        assert_eq!(br.physical_height, 810);
        assert_eq!(br.margin_physical, 24);
        assert_eq!(br.physical_x, 3840 - 570 - 24);
        assert_eq!(br.physical_y, 2100 - 810 - 24);
    }

    #[test]
    fn handles_negative_secondary_monitor_origin() {
        // Secondary 1920x1080 monitor placed directly to the left of primary monitor
        let wa = MonitorWorkArea {
            x: -1920,
            y: 0,
            width: 1920,
            height: 1040,
            scale_factor: 1.0,
        };

        let bl = compute_snapped_bounds(wa, WidgetCorner::BottomLeft, WidgetSizeMode::Compact);
        assert_eq!(bl.physical_x, -1920 + 16);
        assert_eq!(bl.physical_y, 1040 - 420 - 16);

        let br = compute_snapped_bounds(wa, WidgetCorner::BottomRight, WidgetSizeMode::Compact);
        assert_eq!(br.physical_x, -300 - 16);
        assert_eq!(br.physical_y, 1040 - 420 - 16);
    }

    #[test]
    fn parses_flexible_corner_and_size_names() {
        assert_eq!(
            WidgetCorner::parse_flexible("bottom_right").unwrap(),
            WidgetCorner::BottomRight
        );
        assert_eq!(
            WidgetCorner::parse_flexible("TopLeft").unwrap(),
            WidgetCorner::TopLeft
        );
        assert_eq!(
            WidgetSizeMode::parse_flexible("compact").unwrap(),
            WidgetSizeMode::Compact
        );
        assert_eq!(
            WidgetSizeMode::parse_flexible("Standard").unwrap(),
            WidgetSizeMode::Standard
        );
        assert!(WidgetCorner::parse_flexible("center").is_err());
        assert!(WidgetSizeMode::parse_flexible("giant").is_err());
    }
}

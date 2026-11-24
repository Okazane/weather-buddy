//! Multi-core 3D Chibi sprite auditor & pure-Rust studio remastering pipeline.
//!
//! Replaces the Python/SciPy/Pillow pipeline (`remaster_v5_3d_sprites.py`) with zero external
//! native C/Python dependencies:
//! - Parallel `rayon` RGBA audit across all 24 character/NPC sprites (`768x768`) and companion
//!   sprites (`256x256`), verifying border-clipping invariants, crown/sole bounding landmarks,
//!   and studio white-fringe ratios.
//! - Pure-Rust `#FFFFFF` studio alpha matte extraction, color decontamination
//!   `C = (rgb - (1 - a) * 255) / a`, 4-connected foreground component isolation, automatic
//!   iris-pair detection, and canonical `768x768` landmark alignment
//!   (`Eye Y = 296.0`, `IPD = 114.0`, `Sole Y = 692.0`).

use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;

use anyhow::{bail, Context, Result};
use image::{ColorType, ImageFormat, Rgb, RgbImage, Rgba, RgbaImage};
use rayon::prelude::*;
use serde::Serialize;

/// Canonical output canvas size for standing weather & seated NPC sprites.
pub const CANONICAL_CANVAS: u32 = 768;
/// Canonical output canvas size for companion pet sprites (`companion_cat`, `companion_puppy`).
pub const COMPANION_CANVAS: u32 = 256;

/// Horizontal center X on the `768x768` canonical canvas.
pub const TARGET_CENTER_X: f32 = 384.0;
/// Canonical eye-axis Y coordinate on the `768x768` canvas.
pub const TARGET_EYE_Y: f32 = 296.0;
/// Canonical inter-pupillary distance (`Left = 327.0`, `Right = 441.0`).
pub const TARGET_IPD: f32 = 114.0;
/// Canonical neck pivot Y coordinate where rigid head transform blends into vertical body warp.
pub const TARGET_NECK_Y: f32 = 374.0;
/// Canonical shoe/boot sole baseline Y coordinate on the `768x768` canvas.
pub const TARGET_SOLE_Y: f32 = 692.0;

/// Maximum allowed fraction of foreground pixels exhibiting un-decontaminated `#FFFFFF` fringe.
pub const MAX_WHITE_FRINGE_RATIO: f64 = 0.005;

/// Foreground alpha threshold matching `remaster_v5_3d_sprites.py` (`alpha > 28`).
const FOREGROUND_ALPHA_THRESHOLD: u8 = 28;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SpriteCategory {
    StandingWeather,
    SeatedNpc,
    Companion,
}

impl SpriteCategory {
    pub fn from_relative_path(rel_path: &str) -> Self {
        let normalized = rel_path.replace('\\', "/").to_ascii_lowercase();
        if normalized.starts_with("companions/") || normalized.contains("/companions/") {
            Self::Companion
        } else {
            let file_name = normalized.rsplit('/').next().unwrap_or(&normalized);
            if file_name.starts_with("npc_") {
                Self::SeatedNpc
            } else {
                Self::StandingWeather
            }
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::StandingWeather => "standing",
            Self::SeatedNpc => "npc",
            Self::Companion => "companion",
        }
    }

    pub fn expected_dimensions(self) -> (u32, u32) {
        match self {
            Self::StandingWeather | Self::SeatedNpc => (CANONICAL_CANVAS, CANONICAL_CANVAS),
            Self::Companion => (COMPANION_CANVAS, COMPANION_CANVAS),
        }
    }

    pub fn expected_crown_range(self) -> (u32, u32) {
        match self {
            // Overhead umbrellas / sunglasses reach Y ~ 26; compact hoods sit around Y ~ 107.
            Self::StandingWeather => (16, 185),
            // Seated / active NPC rigs align around Y ~ 143..144.
            Self::SeatedNpc => (115, 185),
            // 256x256 companion pets sit around top Y ~ 36..37.
            Self::Companion => (12, 96),
        }
    }

    pub fn expected_sole_range(self) -> (u32, u32) {
        match self {
            // Canonical 99.6th-percentile sole is Y=692 -> max visible pixel row ~ 698..706.
            Self::StandingWeather => (680, 716),
            // Seated NPC baseline aligns tightly at Y = 691..692.
            Self::SeatedNpc => (682, 704),
            // 256x256 companion pet paws rest around Y = 240.
            Self::Companion => (216, 252),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct SpriteAuditRow {
    pub relative_path: String,
    pub category: SpriteCategory,
    pub width: u32,
    pub height: u32,
    pub is_rgba: bool,
    pub border_alpha_sum: u64,
    pub crown_y: Option<u32>,
    pub sole_y: Option<u32>,
    pub left_x: Option<u32>,
    pub right_x: Option<u32>,
    pub foreground_pixels: u64,
    pub white_fringe_pixels: u64,
    pub white_fringe_ratio: f64,
    pub dimensions_ok: bool,
    pub border_ok: bool,
    pub landmarks_ok: bool,
    pub fringe_ok: bool,
    pub passed: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct SpriteAuditReport {
    pub total_sprites: usize,
    pub character_npc_count: usize,
    pub companion_count: usize,
    pub passed_count: usize,
    pub failed_count: usize,
    pub standing_sole_spread_px: u32,
    pub npc_sole_spread_px: u32,
    pub elapsed_ms: f64,
    pub all_passed: bool,
    pub rows: Vec<SpriteAuditRow>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RemasterStats {
    pub input_path: String,
    pub output_path: String,
    pub top_y: u32,
    pub sole_y: u32,
    pub left_x: u32,
    pub right_x: u32,
    pub left_eye: [f32; 2],
    pub right_eye: [f32; 2],
    pub v_ratio: f32,
    pub detected_eyes: ((f32, f32), (f32, f32)),
}

/// Audits an in-memory `RgbaImage` for canonical resolution, zero border clipping,
/// crown/sole landmark consistency, and studio white-fringe decontamination.
pub fn audit_rgba_image(
    relative_path: &str,
    rgba: &RgbaImage,
    is_rgba_on_disk: bool,
    category: SpriteCategory,
) -> SpriteAuditRow {
    let width = rgba.width();
    let height = rgba.height();
    let (exp_w, exp_h) = category.expected_dimensions();
    let dimensions_ok = is_rgba_on_disk && width == exp_w && height == exp_h;

    let mut border_alpha_sum: u64 = 0;
    if width > 0 && height > 0 {
        for x in 0..width {
            border_alpha_sum += u64::from(rgba.get_pixel(x, 0)[3]);
            if height > 1 {
                border_alpha_sum += u64::from(rgba.get_pixel(x, height - 1)[3]);
            }
        }
        if height > 2 {
            for y in 1..(height - 1) {
                border_alpha_sum += u64::from(rgba.get_pixel(0, y)[3]);
                if width > 1 {
                    border_alpha_sum += u64::from(rgba.get_pixel(width - 1, y)[3]);
                }
            }
        }
    }
    let border_ok = border_alpha_sum == 0;

    let mut min_y = u32::MAX;
    let mut max_y = 0u32;
    let mut min_x = u32::MAX;
    let mut max_x = 0u32;
    let mut has_fg_bbox = false;
    let mut foreground_pixels: u64 = 0;
    let mut white_fringe_pixels: u64 = 0;

    for y in 0..height {
        for x in 0..width {
            let [r, g, b, a] = rgba.get_pixel(x, y).0;
            if a > 0 {
                foreground_pixels += 1;
                if (1..=96).contains(&a) && r >= 252 && g >= 252 && b >= 252 {
                    white_fringe_pixels += 1;
                }
            }
            if a > FOREGROUND_ALPHA_THRESHOLD {
                has_fg_bbox = true;
                if y < min_y {
                    min_y = y;
                }
                if y > max_y {
                    max_y = y;
                }
                if x < min_x {
                    min_x = x;
                }
                if x > max_x {
                    max_x = x;
                }
            }
        }
    }

    let (crown_y, sole_y, left_x, right_x) = if has_fg_bbox {
        (Some(min_y), Some(max_y), Some(min_x), Some(max_x))
    } else {
        (None, None, None, None)
    };

    let (crown_lo, crown_hi) = category.expected_crown_range();
    let (sole_lo, sole_hi) = category.expected_sole_range();
    let landmarks_ok = match (crown_y, sole_y) {
        (Some(cy), Some(sy)) => {
            (crown_lo..=crown_hi).contains(&cy) && (sole_lo..=sole_hi).contains(&sy) && cy < sy
        }
        _ => false,
    };

    let white_fringe_ratio = if foreground_pixels > 0 {
        (white_fringe_pixels as f64) / (foreground_pixels as f64)
    } else {
        1.0
    };
    let fringe_ok = foreground_pixels > 0 && white_fringe_ratio < MAX_WHITE_FRINGE_RATIO;
    let passed = dimensions_ok && border_ok && landmarks_ok && fringe_ok;

    SpriteAuditRow {
        relative_path: relative_path.to_string(),
        category,
        width,
        height,
        is_rgba: is_rgba_on_disk,
        border_alpha_sum,
        crown_y,
        sole_y,
        left_x,
        right_x,
        foreground_pixels,
        white_fringe_pixels,
        white_fringe_ratio,
        dimensions_ok,
        border_ok,
        landmarks_ok,
        fringe_ok,
        passed,
    }
}

fn audit_single_sprite_file(
    relative_path: &str,
    full_path: &Path,
    category: SpriteCategory,
) -> Result<SpriteAuditRow> {
    let dyn_img = image::open(full_path)
        .with_context(|| format!("Failed to decode PNG sprite {:?}", full_path))?;
    let is_rgba_on_disk = matches!(dyn_img.color(), ColorType::Rgba8 | ColorType::Rgba16);
    let rgba = dyn_img.to_rgba8();
    Ok(audit_rgba_image(relative_path, &rgba, is_rgba_on_disk, category))
}

/// Inspects all character/NPC PNGs in `char_dir` (`768x768`) and companion PNGs in
/// `char_dir/companions/` (`256x256`) in parallel across all CPU cores via `rayon`.
pub fn audit_sprites_directory(char_dir: &Path) -> Result<SpriteAuditReport> {
    let started = Instant::now();
    if !char_dir.exists() {
        bail!("Character sprite directory does not exist: {:?}", char_dir);
    }

    let mut targets: Vec<(String, PathBuf, SpriteCategory)> = Vec::new();

    for entry in fs::read_dir(char_dir)
        .with_context(|| format!("Failed reading sprite directory {:?}", char_dir))?
    {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() && is_png_file(&path) {
            let file_name = entry.file_name().to_string_lossy().into_owned();
            let category = SpriteCategory::from_relative_path(&file_name);
            targets.push((file_name, path, category));
        }
    }

    let companions_dir = char_dir.join("companions");
    if companions_dir.is_dir() {
        for entry in fs::read_dir(&companions_dir)
            .with_context(|| format!("Failed reading companions directory {:?}", companions_dir))?
        {
            let entry = entry?;
            let path = entry.path();
            if path.is_file() && is_png_file(&path) {
                let rel = format!("companions/{}", entry.file_name().to_string_lossy());
                targets.push((rel, path, SpriteCategory::Companion));
            }
        }
    }

    targets.sort_by(|a, b| a.0.cmp(&b.0));

    if targets.is_empty() {
        bail!("No PNG sprites found in {:?}", char_dir);
    }

    let rows: Vec<SpriteAuditRow> = targets
        .par_iter()
        .map(|(rel, path, category)| audit_single_sprite_file(rel, path, *category))
        .collect::<Result<Vec<_>>>()?;

    let character_npc_count = rows
        .iter()
        .filter(|r| matches!(r.category, SpriteCategory::StandingWeather | SpriteCategory::SeatedNpc))
        .count();
    let companion_count = rows
        .iter()
        .filter(|r| r.category == SpriteCategory::Companion)
        .count();

    let passed_count = rows.iter().filter(|r| r.passed).count();
    let failed_count = rows.len() - passed_count;

    let standing_sole_spread_px = compute_sole_spread(&rows, SpriteCategory::StandingWeather);
    let npc_sole_spread_px = compute_sole_spread(&rows, SpriteCategory::SeatedNpc);
    let all_passed = failed_count == 0 && character_npc_count >= 24;

    Ok(SpriteAuditReport {
        total_sprites: rows.len(),
        character_npc_count,
        companion_count,
        passed_count,
        failed_count,
        standing_sole_spread_px,
        npc_sole_spread_px,
        elapsed_ms: started.elapsed().as_secs_f64() * 1000.0,
        all_passed,
        rows,
    })
}

fn compute_sole_spread(rows: &[SpriteAuditRow], category: SpriteCategory) -> u32 {
    let soles: Vec<u32> = rows
        .iter()
        .filter(|r| r.category == category)
        .filter_map(|r| r.sole_y)
        .collect();
    match (soles.iter().min(), soles.iter().max()) {
        (Some(lo), Some(hi)) => hi.saturating_sub(*lo),
        _ => 0,
    }
}

/// Formats `SpriteAuditReport` as a clean, aligned CLI table.
pub fn format_audit_table(report: &SpriteAuditReport) -> String {
    let mut out = String::with_capacity(4096);
    out.push_str(&format!(
        "WeatherBuddy 3D Sprite Audit (Rayon {} threads · {:.2} ms)\n",
        rayon::current_num_threads(),
        report.elapsed_ms
    ));
    let sep = "-".repeat(104);
    out.push_str(&sep);
    out.push('\n');
    out.push_str(&format!(
        "{:<40} | {:<9} | {:<9} | {:<4} | {:>6} | {:>5} | {:>5} | {:>7} | {:<6}\n",
        "Sprite File", "Category", "Size", "RGBA", "Border", "Crown", "Sole", "Fringe%", "Status"
    ));
    out.push_str(&sep);
    out.push('\n');

    for row in &report.rows {
        let size_str = format!("{}x{}", row.width, row.height);
        let rgba_str = if row.is_rgba { "YES" } else { "NO" };
        let crown_str = row
            .crown_y
            .map(|v| v.to_string())
            .unwrap_or_else(|| "-".to_string());
        let sole_str = row
            .sole_y
            .map(|v| v.to_string())
            .unwrap_or_else(|| "-".to_string());
        let fringe_pct = format!("{:.2}%", row.white_fringe_ratio * 100.0);
        let status_str = if row.passed { "PASS" } else { "FAIL" };

        out.push_str(&format!(
            "{:<40} | {:<9} | {:<9} | {:<4} | {:>6} | {:>5} | {:>5} | {:>7} | {:<6}\n",
            row.relative_path,
            row.category.label(),
            size_str,
            rgba_str,
            row.border_alpha_sum,
            crown_str,
            sole_str,
            fringe_pct,
            status_str
        ));
    }

    out.push_str(&sep);
    out.push('\n');
    out.push_str(&format!(
        "Summary: {}/{} sprites passed ({} character/NPC @ 768x768, {} companions @ 256x256) | Standing sole spread: {}px | NPC sole spread: {}px\n",
        report.passed_count,
        report.total_sprites,
        report.character_npc_count,
        report.companion_count,
        report.standing_sole_spread_px,
        report.npc_sole_spread_px
    ));
    out
}

/// Pure-Rust studio `#FFFFFF` color decontamination:
/// `C = clamp((rgb - (1 - a) * 255) / max(a, 0.18), 0, 255)`.
#[inline]
pub fn unmix_studio_white_pixel(rgb: [u8; 3], alpha_u8: u8) -> [u8; 3] {
    if alpha_u8 == 0 {
        return [0, 0, 0];
    }
    if alpha_u8 >= 250 {
        return rgb;
    }
    let a = (alpha_u8 as f32) / 255.0;
    let inv_bg = (1.0 - a) * 255.0;
    let denom = a.max(0.18);
    let r = ((rgb[0] as f32 - inv_bg) / denom).clamp(0.0, 255.0).round() as u8;
    let g = ((rgb[1] as f32 - inv_bg) / denom).clamp(0.0, 255.0).round() as u8;
    let b = ((rgb[2] as f32 - inv_bg) / denom).clamp(0.0, 255.0).round() as u8;
    [r, g, b]
}

/// Iterative 4-connected BFS component labeling (replaces `scipy.ndimage.label`).
/// Returns `(labels, component_sizes)` where `labels[idx]` is `0` for `false` and `1..=k` for components.
pub fn label_connected_components(
    mask: &[bool],
    width: usize,
    height: usize,
) -> (Vec<u32>, Vec<usize>) {
    let total = width * height;
    assert_eq!(mask.len(), total, "mask length must match width * height");

    let mut labels = vec![0u32; total];
    let mut sizes = Vec::new();
    let mut queue = Vec::with_capacity(1024);
    let mut current_id = 0u32;

    for start in 0..total {
        if !mask[start] || labels[start] != 0 {
            continue;
        }
        current_id += 1;
        labels[start] = current_id;
        queue.clear();
        queue.push(start);
        let mut head = 0usize;

        while head < queue.len() {
            let idx = queue[head];
            head += 1;
            let x = idx % width;
            let y = idx / width;

            if x > 0 {
                let n = idx - 1;
                if mask[n] && labels[n] == 0 {
                    labels[n] = current_id;
                    queue.push(n);
                }
            }
            if x + 1 < width {
                let n = idx + 1;
                if mask[n] && labels[n] == 0 {
                    labels[n] = current_id;
                    queue.push(n);
                }
            }
            if y > 0 {
                let n = idx - width;
                if mask[n] && labels[n] == 0 {
                    labels[n] = current_id;
                    queue.push(n);
                }
            }
            if y + 1 < height {
                let n = idx + width;
                if mask[n] && labels[n] == 0 {
                    labels[n] = current_id;
                    queue.push(n);
                }
            }
        }
        sizes.push(queue.len());
    }

    (labels, sizes)
}

/// Retains only the single largest 4-connected foreground component, discarding detached stickers/dust.
pub fn extract_largest_foreground_component(
    mask: &[bool],
    width: usize,
    height: usize,
) -> Vec<bool> {
    let (labels, sizes) = label_connected_components(mask, width, height);
    if sizes.len() <= 1 {
        return mask.to_vec();
    }
    let main_id = sizes
        .iter()
        .enumerate()
        .max_by_key(|(_, &sz)| sz)
        .map(|(idx, _)| (idx as u32) + 1)
        .unwrap_or(1);

    labels.into_iter().map(|lbl| lbl == main_id).collect()
}

fn binary_erode_3x3(mask: &[bool], width: usize, height: usize) -> Vec<bool> {
    let mut out = vec![false; width * height];
    if width < 3 || height < 3 {
        return out;
    }
    for y in 1..(height - 1) {
        let row = y * width;
        for x in 1..(width - 1) {
            let idx = row + x;
            if mask[idx]
                && mask[idx - 1]
                && mask[idx + 1]
                && mask[idx - width]
                && mask[idx + width]
                && mask[idx - width - 1]
                && mask[idx - width + 1]
                && mask[idx + width - 1]
                && mask[idx + width + 1]
            {
                out[idx] = true;
            }
        }
    }
    out
}

fn binary_dilate_3x3(mask: &[bool], width: usize, height: usize) -> Vec<bool> {
    let mut out = vec![false; width * height];
    for y in 0..height {
        let y_lo = y.saturating_sub(1);
        let y_hi = (y + 1).min(height - 1);
        for x in 0..width {
            let x_lo = x.saturating_sub(1);
            let x_hi = (x + 1).min(width - 1);
            let mut any = false;
            'ny: for ny in y_lo..=y_hi {
                let r_off = ny * width;
                for nx in x_lo..=x_hi {
                    if mask[r_off + nx] {
                        any = true;
                        break 'ny;
                    }
                }
            }
            out[y * width + x] = any;
        }
    }
    out
}

/// Separable 3x3 Gaussian blur (`[0.21, 0.58, 0.21]`, approximating `sigma = 0.65`).
fn gaussian_blur_alpha_3x3(alpha: &[f32], width: usize, height: usize) -> Vec<f32> {
    const K0: f32 = 0.21;
    const K1: f32 = 0.58;
    let mut temp = vec![0.0f32; width * height];
    let mut out = vec![0.0f32; width * height];

    for y in 0..height {
        let row = y * width;
        for x in 0..width {
            let left = alpha[row + x.saturating_sub(1)];
            let mid = alpha[row + x];
            let right = alpha[row + (x + 1).min(width - 1)];
            temp[row + x] = K0 * left + K1 * mid + K0 * right;
        }
    }

    for y in 0..height {
        let top_r = y.saturating_sub(1) * width;
        let mid_r = y * width;
        let bot_r = (y + 1).min(height - 1) * width;
        for x in 0..width {
            out[mid_r + x] = K0 * temp[top_r + x] + K1 * temp[mid_r + x] + K0 * temp[bot_r + x];
        }
    }
    out
}

fn preclean_attached_stickers(rgb_src: &RgbImage, key_hint: &str) -> RgbImage {
    let mut out = rgb_src.clone();
    if key_hint.contains("storm_raincoat") {
        let w = out.width();
        let h = out.height();
        let y0 = ((h as f32) * 0.77) as u32;
        for y in y0..h {
            for x in 0..w {
                let [r, g, b] = out.get_pixel(x, y).0;
                let ri = i32::from(r);
                let gi = i32::from(g);
                let bi = i32::from(b);
                let sat = ri.max(gi).max(bi) - ri.min(gi).min(bi);
                if bi >= ri - 10 && sat < 58 {
                    out.put_pixel(x, y, Rgb([255, 255, 255]));
                }
            }
        }
    }
    out
}

/// Pure-Rust studio `#FFFFFF` alpha matting, background flood-fill, largest connected-component
/// foreground isolation, Euclidean edge feathering, and `#FFFFFF` color decontamination.
pub fn studio_alpha_matte(rgb_src: &RgbImage, key_hint: &str) -> RgbaImage {
    let rgb_clean = preclean_attached_stickers(rgb_src, key_hint);
    let w = rgb_clean.width() as usize;
    let h = rgb_clean.height() as usize;
    let total = w * h;

    let mut bg_cand = vec![false; total];
    let mut pure_gap_cand = vec![false; total];

    for y in 0..h {
        for x in 0..w {
            let [r, g, b] = rgb_clean.get_pixel(x as u32, y as u32).0;
            let rf = f32::from(r);
            let gf = f32::from(g);
            let bf = f32::from(b);
            let lum = 0.299 * rf + 0.587 * gf + 0.114 * bf;
            let mx = rf.max(gf).max(bf);
            let mn = rf.min(gf).min(bf);
            let sat = mx - mn;

            let is_pure_white = r > 243 && g > 243 && b > 243;
            let is_floor_shadow = lum > 214.0 && sat < 11.0;
            let idx = y * w + x;
            bg_cand[idx] = is_pure_white || is_floor_shadow;
            pure_gap_cand[idx] = r >= 250 && g >= 250 && b >= 250;
        }
    }

    let (lbl_bg, bg_sizes) = label_connected_components(&bg_cand, w, h);
    let mut is_border_comp = vec![false; bg_sizes.len() + 1];
    for x in 0..w {
        is_border_comp[lbl_bg[x] as usize] = true;
        is_border_comp[lbl_bg[(h - 1) * w + x] as usize] = true;
    }
    for y in 0..h {
        is_border_comp[lbl_bg[y * w] as usize] = true;
        is_border_comp[lbl_bg[y * w + (w - 1)] as usize] = true;
    }
    is_border_comp[0] = false;

    let exterior_bg: Vec<bool> = lbl_bg
        .iter()
        .map(|&id| is_border_comp[id as usize])
        .collect();

    // Detect enclosed studio-white gaps between arms/legs (area >= 140, mean_y > 0.34 * h)
    let interior_gap_mask: Vec<bool> = (0..total)
        .map(|i| pure_gap_cand[i] && !exterior_bg[i])
        .collect();
    let (lbl_gap, gap_sizes) = label_connected_components(&interior_gap_mask, w, h);
    let mut gap_y_sums = vec![0usize; gap_sizes.len() + 1];
    for y in 0..h {
        let row = y * w;
        for x in 0..w {
            let gid = lbl_gap[row + x] as usize;
            if gid > 0 {
                gap_y_sums[gid] += y;
            }
        }
    }
    let mut keep_gap_bg = vec![false; gap_sizes.len() + 1];
    for (idx0, &sz) in gap_sizes.iter().enumerate() {
        let gid = idx0 + 1;
        if sz >= 140 {
            let mean_y = (gap_y_sums[gid] as f32) / (sz as f32);
            if mean_y > (h as f32) * 0.34 {
                keep_gap_bg[gid] = true;
            }
        }
    }

    let fg_raw: Vec<bool> = (0..total)
        .map(|i| !(exterior_bg[i] || keep_gap_bg[lbl_gap[i] as usize]))
        .collect();
    let fg_hard = extract_largest_foreground_component(&fg_raw, w, h);

    let eroded1 = binary_erode_3x3(&fg_hard, w, h);
    let eroded = binary_erode_3x3(&eroded1, w, h);
    let dilated = binary_dilate_3x3(&fg_hard, w, h);

    let inv_sqrt3 = 1.0f32 / 3.0f32.sqrt();
    let mut alpha = vec![0.0f32; total];
    for y in 0..h {
        let row = y * w;
        for x in 0..w {
            let idx = row + x;
            if eroded[idx] {
                alpha[idx] = 1.0;
            } else if dilated[idx] && fg_hard[idx] {
                let [r, g, b] = rgb_clean.get_pixel(x as u32, y as u32).0;
                let dr = 255.0 - f32::from(r);
                let dg = 255.0 - f32::from(g);
                let db = 255.0 - f32::from(b);
                let dist_white = (dr * dr + dg * dg + db * db).sqrt() * inv_sqrt3;
                alpha[idx] = ((dist_white - 6.0) / 34.0).clamp(0.0, 1.0);
            }
        }
    }

    let alpha_blur = gaussian_blur_alpha_3x3(&alpha, w, h);
    let mut out = RgbaImage::new(w as u32, h as u32);

    for y in 0..h {
        let row = y * w;
        for x in 0..w {
            let idx = row + x;
            let a_val = if eroded[idx] {
                1.0
            } else if fg_hard[idx] {
                alpha[idx].min(alpha_blur[idx] * 1.08)
            } else {
                0.0
            }
            .clamp(0.0, 1.0);

            let a_u8 = (a_val * 255.0).round() as u8;
            let src_rgb = rgb_clean.get_pixel(x as u32, y as u32).0;
            let unmixed = unmix_studio_white_pixel(src_rgb, a_u8);
            out.put_pixel(
                x as u32,
                y as u32,
                Rgba([unmixed[0], unmixed[1], unmixed[2], a_u8]),
            );
        }
    }

    out
}

/// Automatically locates the character's `(left_eye, right_eye)` sub-pixel iris centers
/// inside the upper face region (`y: 20%..52%`, `x: 20%..80%`).
pub fn detect_eyes_precise(
    rgb_img: &RgbImage,
    fg_mask: &[bool],
    key_hint: &str,
) -> Result<((f32, f32), (f32, f32))> {
    let w = rgb_img.width() as usize;
    let h = rgb_img.height() as usize;
    if fg_mask.len() != w * h {
        bail!("Foreground mask size mismatch in detect_eyes_precise");
    }

    let mut lum = vec![255.0f32; w * h];
    for y in 0..h {
        let row = y * w;
        for x in 0..w {
            let [r, g, b] = rgb_img.get_pixel(x as u32, y as u32).0;
            lum[row + x] = 0.299 * f32::from(r) + 0.587 * f32::from(g) + 0.114 * f32::from(b);
        }
    }

    let y_lo = ((h as f32) * 0.20) as usize;
    let y_hi = ((h as f32) * 0.52) as usize;
    let x_lo = ((w as f32) * 0.20) as usize;
    let x_hi = ((w as f32) * 0.80) as usize;

    // Minimum iris blob area scales gracefully from 512px test renders up to 1200px raw studio renders.
    let min_area = (((w * h) as f32) * 0.00018).max(20.0) as usize;
    let max_area = (((w * h) as f32) * 0.025).max(500.0) as usize;

    for thresh in [56.0f32, 68.0, 80.0] {
        let mut cand = vec![false; w * h];
        for y in y_lo..y_hi.min(h) {
            let row = y * w;
            for x in x_lo..x_hi.min(w) {
                let idx = row + x;
                if fg_mask[idx] && lum[idx] < thresh {
                    cand[idx] = true;
                }
            }
        }

        if key_hint.contains("hot_sunny") {
            cand = binary_erode_3x3(&cand, w, h);
        }

        let (labels, sizes) = label_connected_components(&cand, w, h);
        if sizes.len() < 2 {
            continue;
        }

        let num_c = sizes.len();
        let mut sum_x = vec![0.0f64; num_c + 1];
        let mut sum_y = vec![0.0f64; num_c + 1];
        let mut min_bx = vec![usize::MAX; num_c + 1];
        let mut max_bx = vec![0usize; num_c + 1];
        let mut min_by = vec![usize::MAX; num_c + 1];
        let mut max_by = vec![0usize; num_c + 1];

        for y in y_lo..y_hi.min(h) {
            let row = y * w;
            for x in x_lo..x_hi.min(w) {
                let id = labels[row + x] as usize;
                if id > 0 {
                    sum_x[id] += x as f64;
                    sum_y[id] += y as f64;
                    min_bx[id] = min_bx[id].min(x);
                    max_bx[id] = max_bx[id].max(x);
                    min_by[id] = min_by[id].min(y);
                    max_by[id] = max_by[id].max(y);
                }
            }
        }

        let mut blobs: Vec<(f32, f32, f32)> = Vec::new();
        for (idx0, &area) in sizes.iter().enumerate() {
            let id = idx0 + 1;
            if (min_area..=max_area).contains(&area) {
                let bw = (max_bx[id] - min_bx[id] + 1) as f32;
                let bh = (max_by[id] - min_by[id] + 1).max(1) as f32;
                let aspect = bw / bh;
                if (0.50..=1.85).contains(&aspect) {
                    let cx = (sum_x[id] / (area as f64)) as f32;
                    let cy = (sum_y[id] / (area as f64)) as f32;
                    blobs.push((area as f32, cx, cy));
                }
            }
        }

        let mut best_pair: Option<((f32, f32), (f32, f32))> = None;
        let mut best_score = f32::MAX;
        let wf = w as f32;
        let hf = h as f32;

        for i in 0..blobs.len() {
            for j in (i + 1)..blobs.len() {
                let (mut a1, mut x1, mut y1) = blobs[i];
                let (mut a2, mut x2, mut y2) = blobs[j];
                if x1 > x2 {
                    std::mem::swap(&mut a1, &mut a2);
                    std::mem::swap(&mut x1, &mut x2);
                    std::mem::swap(&mut y1, &mut y2);
                }
                let dx = x2 - x1;
                let dy = (y2 - y1).abs();
                if dx >= wf * 0.10 && dx <= wf * 0.30 && dy <= hf * 0.055 {
                    let area_ratio = a1.max(a2) / a1.min(a2).max(1.0);
                    if area_ratio <= 1.90 {
                        let score = dy * 2.5
                            + ((x1 + x2) * 0.5 - wf * 0.5).abs() * 0.35
                            + (area_ratio - 1.0) * 45.0;
                        if score < best_score {
                            best_score = score;
                            best_pair = Some(((x1, y1), (x2, y2)));
                        }
                    }
                }
            }
        }

        if let Some(pair) = best_pair {
            return Ok(pair);
        }
    }

    bail!(
        "Could not auto-detect symmetric iris pair for '{}'; supply --left-eye x,y --right-eye x,y",
        key_hint
    )
}

#[inline]
fn sample_premultiplied_bilinear(
    premult: &[[f32; 4]],
    width: usize,
    height: usize,
    sx: f32,
    sy: f32,
) -> [f32; 4] {
    if sx < -0.5 || sy < -0.5 || sx > (width as f32) - 0.5 || sy > (height as f32) - 0.5 {
        return [0.0; 4];
    }
    let x0f = sx.floor();
    let y0f = sy.floor();
    let fx = sx - x0f;
    let fy = sy - y0f;

    let sample_clamped = |ix: isize, iy: isize| -> [f32; 4] {
        if ix < 0 || iy < 0 || ix >= (width as isize) || iy >= (height as isize) {
            [0.0; 4]
        } else {
            premult[(iy as usize) * width + (ix as usize)]
        }
    };

    let ix0 = x0f as isize;
    let iy0 = y0f as isize;
    let p00 = sample_clamped(ix0, iy0);
    let p10 = sample_clamped(ix0 + 1, iy0);
    let p01 = sample_clamped(ix0, iy0 + 1);
    let p11 = sample_clamped(ix0 + 1, iy0 + 1);

    let mut out = [0.0f32; 4];
    let w00 = (1.0 - fx) * (1.0 - fy);
    let w10 = fx * (1.0 - fy);
    let w01 = (1.0 - fx) * fy;
    let w11 = fx * fy;

    for ch in 0..4 {
        out[ch] = p00[ch] * w00 + p10[ch] * w10 + p01[ch] * w01 + p11[ch] * w11;
    }
    out
}

/// Aligns a foreground-isolated `RgbaImage` onto the canonical `768x768` landmark grid:
/// `Eye Y = 296.0`, `IPD = 114.0` (`Left = 327.0`, `Right = 441.0`), `Neck = 374.0`, `Sole = 692.0`.
pub fn remaster_character_to_canonical(
    rgba_src: &RgbaImage,
    left_eye: (f32, f32),
    right_eye: (f32, f32),
    key_hint: &str,
) -> Result<(RgbaImage, RemasterStats)> {
    let (lx, ly) = left_eye;
    let (rx, ry) = right_eye;
    let dx = rx - lx;
    let dy = ry - ly;
    let src_ipd = dx.hypot(dy);
    if src_ipd < 8.0 {
        bail!("Invalid inter-pupillary distance ({:.2}px) for '{}'", src_ipd, key_hint);
    }

    let mx = 0.5 * (lx + rx);
    let my = 0.5 * (ly + ry);
    let angle_deg = dy.atan2(dx).to_degrees();
    let correct_rad = (angle_deg * 0.88).to_radians();
    let scale = TARGET_IPD / src_ipd;

    let src_w = rgba_src.width() as usize;
    let src_h = rgba_src.height() as usize;
    let mut src_premult = vec![[0.0f32; 4]; src_w * src_h];
    for y in 0..src_h {
        let row = y * src_w;
        for x in 0..src_w {
            let [r, g, b, a] = rgba_src.get_pixel(x as u32, y as u32).0;
            let af = f32::from(a);
            let an = af / 255.0;
            src_premult[row + x] = [f32::from(r) * an, f32::from(g) * an, f32::from(b) * an, af];
        }
    }

    // Stage 1: Rigid similarity transform onto 960x960 intermediate premultiplied buffer
    const INTER_W: usize = 960;
    const INTER_H: usize = 960;
    const INTER_CX: f32 = 480.0;

    let cos_a = correct_rad.cos() / scale;
    let sin_a = correct_rad.sin() / scale;
    let a = cos_a;
    let b = -sin_a;
    let c = mx - cos_a * INTER_CX + sin_a * TARGET_EYE_Y;
    let d = sin_a;
    let e = cos_a;
    let f = my - sin_a * INTER_CX - cos_a * TARGET_EYE_Y;

    let mut rigid_premult = vec![[0.0f32; 4]; INTER_W * INTER_H];
    let mut fg_ys: Vec<u32> = Vec::with_capacity(65_536);

    for y in 0..INTER_H {
        let yf = y as f32;
        let row = y * INTER_W;
        for x in 0..INTER_W {
            let xf = x as f32;
            let sx = a * xf + b * yf + c;
            let sy = d * xf + e * yf + f;
            let px = sample_premultiplied_bilinear(&src_premult, src_w, src_h, sx, sy);
            rigid_premult[row + x] = px;
            if px[3] > f32::from(FOREGROUND_ALPHA_THRESHOLD) {
                fg_ys.push(y as u32);
            }
        }
    }

    if fg_ys.is_empty() {
        bail!("Rigid-transformed character has zero visible foreground pixels for '{}'", key_hint);
    }
    fg_ys.sort_unstable();
    let pct_idx = (((fg_ys.len() - 1) as f64) * 0.996).round() as usize;
    let cur_sole_y = fg_ys[pct_idx.min(fg_ys.len() - 1)] as f32;

    let src_body_h = (cur_sole_y - TARGET_NECK_Y).max(80.0);
    let dst_body_h = TARGET_SOLE_Y - TARGET_NECK_Y;
    let v_ratio = src_body_h / dst_body_h;

    // Stage 2: Smooth quadratic neck-zone vertical warp onto canonical 768x768 canvas
    let canvas = CANONICAL_CANVAS as usize;
    const BLEND_HALF: f32 = 20.0;
    let mut src_y_1d = vec![0.0f32; canvas];

    for (idx_y, slot) in src_y_1d.iter_mut().enumerate() {
        let yv = idx_y as f32;
        *slot = if yv <= TARGET_NECK_Y - BLEND_HALF {
            yv
        } else if yv < TARGET_NECK_Y + BLEND_HALF {
            let t = (yv - (TARGET_NECK_Y - BLEND_HALF)) / (2.0 * BLEND_HALF);
            (TARGET_NECK_Y - BLEND_HALF)
                + (2.0 * BLEND_HALF) * (t + 0.5 * (v_ratio - 1.0) * (t * t))
        } else {
            let y_at_blend_end =
                (TARGET_NECK_Y - BLEND_HALF) + (2.0 * BLEND_HALF) * (1.0 + 0.5 * (v_ratio - 1.0));
            y_at_blend_end + (yv - (TARGET_NECK_Y + BLEND_HALF)) * v_ratio
        };
    }

    let mut out_rgba = RgbaImage::new(CANONICAL_CANVAS, CANONICAL_CANVAS);
    let mut min_y = u32::MAX;
    let mut max_y = 0u32;
    let mut min_x = u32::MAX;
    let mut max_x = 0u32;
    let is_stride_key = key_hint == "male_pleasant_sunny";

    // Leave 1px transparent safety border (`1..canvas-1`) so outer border clipping is strictly 0.
    for y in 1..(canvas - 1) {
        let sy = src_y_1d[y];
        let stride_scale = if is_stride_key {
            let blend = (((y as f32) - 385.0) / 140.0).clamp(0.0, 1.0);
            1.0 + blend * 0.24
        } else {
            1.0
        };

        for x in 1..(canvas - 1) {
            let base_x = (x as f32) + (INTER_CX - TARGET_CENTER_X);
            let sx = if is_stride_key {
                INTER_CX + (base_x - INTER_CX) * stride_scale
            } else {
                base_x
            };

            let warped = sample_premultiplied_bilinear(&rigid_premult, INTER_W, INTER_H, sx, sy);
            let out_a = warped[3].clamp(0.0, 255.0);
            if out_a > 2.0 {
                let a_norm = (out_a / 255.0).max(1e-4);
                let r = (warped[0] / a_norm).clamp(0.0, 255.0).round() as u8;
                let g = (warped[1] / a_norm).clamp(0.0, 255.0).round() as u8;
                let b = (warped[2] / a_norm).clamp(0.0, 255.0).round() as u8;
                let a_u8 = out_a.round() as u8;
                let clean_rgb = unmix_studio_white_pixel([r, g, b], a_u8);
                out_rgba.put_pixel(
                    x as u32,
                    y as u32,
                    Rgba([clean_rgb[0], clean_rgb[1], clean_rgb[2], a_u8]),
                );

                if a_u8 > FOREGROUND_ALPHA_THRESHOLD {
                    let xu = x as u32;
                    let yu = y as u32;
                    min_x = min_x.min(xu);
                    max_x = max_x.max(xu);
                    min_y = min_y.min(yu);
                    max_y = max_y.max(yu);
                }
            }
        }
    }

    if min_y == u32::MAX {
        bail!("Canonical output image had empty foreground bounding box for '{}'", key_hint);
    }

    let stats = RemasterStats {
        input_path: String::new(),
        output_path: String::new(),
        top_y: min_y,
        sole_y: max_y,
        left_x: min_x,
        right_x: max_x,
        left_eye: [TARGET_CENTER_X - TARGET_IPD * 0.5, TARGET_EYE_Y],
        right_eye: [TARGET_CENTER_X + TARGET_IPD * 0.5, TARGET_EYE_Y],
        v_ratio: (v_ratio * 1000.0).round() / 1000.0,
        detected_eyes: (left_eye, right_eye),
    };

    Ok((out_rgba, stats))
}

/// Synthesizes a cool moonlight `clear_night` variant from a `pleasant_sunny` canonical sprite.
pub fn make_clear_night_variant(day_rgba: &RgbaImage, is_male: bool) -> RgbaImage {
    let w = day_rgba.width();
    let h = day_rgba.height();
    let mut out = RgbaImage::new(w, h);

    for y in 0..h {
        for x in 0..w {
            let [r, g, b, a] = day_rgba.get_pixel(x, y).0;
            if a <= 12 {
                continue;
            }
            let mut rf = f32::from(r);
            let mut gf = f32::from(g);
            let mut bf = f32::from(b);

            if is_male {
                if (372..=548).contains(&y) && i32::from(b) > i32::from(r) + 12 {
                    rf = (rf * 0.78 + 38.0).clamp(0.0, 255.0);
                    gf = (gf * 0.80 + 22.0).clamp(0.0, 255.0);
                    bf = (bf * 1.04 + 14.0).clamp(0.0, 255.0);
                }
            } else if (372..=595).contains(&y)
                && i32::from(r) > i32::from(b) + 20
                && i32::from(g) > i32::from(b) + 15
                && r > 185
            {
                let lum = 0.299 * rf + 0.587 * gf + 0.114 * bf;
                rf = (lum * 0.94 + 8.0).clamp(0.0, 255.0);
                gf = (lum * 0.89 + 4.0).clamp(0.0, 255.0);
                bf = (lum * 1.04 + 18.0).clamp(0.0, 255.0);
            }

            let rn = (rf * 0.965).clamp(0.0, 255.0).round() as u8;
            let gn = (gf * 0.975).clamp(0.0, 255.0).round() as u8;
            let bn = (bf * 1.025 + 3.0).clamp(0.0, 255.0).round() as u8;
            out.put_pixel(x, y, Rgba([rn, gn, bn, a]));
        }
    }
    out
}

/// Processes a single raw 3D studio render (JPEG or PNG) into a canonical `768x768` RGBA PNG.
pub fn remaster_sprite_file(
    input_path: &Path,
    output_path: &Path,
    eyes_override: Option<((f32, f32), (f32, f32))>,
    night_gender: Option<&str>,
) -> Result<RemasterStats> {
    let dyn_img = image::open(input_path)
        .with_context(|| format!("Failed to open raw sprite image {:?}", input_path))?;
    let key_hint = input_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("sprite");

    // Check whether input already has meaningful transparency or is an opaque `#FFFFFF` studio render.
    let has_transparency = match dyn_img.color() {
        ColorType::Rgba8 | ColorType::Rgba16 => {
            let rgba_check = dyn_img.to_rgba8();
            rgba_check.pixels().any(|p| p[3] < 250)
        }
        _ => false,
    };

    let (rgba_matted, rgb_for_eyes) = if has_transparency {
        let mut rgba = dyn_img.to_rgba8();
        let w = rgba.width() as usize;
        let h = rgba.height() as usize;
        let fg_raw: Vec<bool> = rgba.pixels().map(|p| p[3] > 16).collect();
        let fg_clean = extract_largest_foreground_component(&fg_raw, w, h);
        let mut rgb_proxy = RgbImage::from_pixel(rgba.width(), rgba.height(), Rgb([255, 255, 255]));

        for y in 0..h {
            for x in 0..w {
                let idx = y * w + x;
                let px = rgba.get_pixel_mut(x as u32, y as u32);
                if !fg_clean[idx] {
                    *px = Rgba([0, 0, 0, 0]);
                } else {
                    let clean = unmix_studio_white_pixel([px[0], px[1], px[2]], px[3]);
                    *px = Rgba([clean[0], clean[1], clean[2], px[3]]);
                    rgb_proxy.put_pixel(x as u32, y as u32, Rgb(clean));
                }
            }
        }
        (rgba, rgb_proxy)
    } else {
        let rgb = dyn_img.to_rgb8();
        let matted = studio_alpha_matte(&rgb, key_hint);
        (matted, rgb)
    };

    let (left_eye, right_eye) = match eyes_override {
        Some(pair) => pair,
        None => {
            let fg_mask: Vec<bool> = rgba_matted.pixels().map(|p| p[3] > 128).collect();
            detect_eyes_precise(&rgb_for_eyes, &fg_mask, key_hint)?
        }
    };

    let (mut canonical_rgba, mut stats) =
        remaster_character_to_canonical(&rgba_matted, left_eye, right_eye, key_hint)?;

    if let Some(gender) = night_gender {
        let is_male = !gender.eq_ignore_ascii_case("female");
        canonical_rgba = make_clear_night_variant(&canonical_rgba, is_male);
    }

    if let Some(parent) = output_path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)
                .with_context(|| format!("Failed creating directory {:?}", parent))?;
        }
    }

    canonical_rgba
        .save_with_format(output_path, ImageFormat::Png)
        .with_context(|| format!("Failed saving remastered PNG {:?}", output_path))?;

    stats.input_path = input_path.display().to_string();
    stats.output_path = output_path.display().to_string();
    Ok(stats)
}

/// Batch-remasters all `.png` / `.jpg` / `.jpeg` renders in `input_dir` into `output_dir`
/// across all CPU cores using `rayon`.
pub fn remaster_batch_directory(input_dir: &Path, output_dir: &Path) -> Result<Vec<RemasterStats>> {
    if !input_dir.is_dir() {
        bail!("Input directory does not exist: {:?}", input_dir);
    }
    fs::create_dir_all(output_dir)
        .with_context(|| format!("Failed creating output directory {:?}", output_dir))?;

    let mut inputs: Vec<PathBuf> = Vec::new();
    for entry in fs::read_dir(input_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() && is_supported_render_file(&path) {
            inputs.push(path);
        }
    }
    inputs.sort();
    if inputs.is_empty() {
        bail!("No .png/.jpg/.jpeg studio renders found in {:?}", input_dir);
    }

    inputs
        .par_iter()
        .map(|src_path| {
            let stem = src_path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("remastered");
            let dst_path = output_dir.join(format!("{stem}.png"));
            remaster_sprite_file(src_path, &dst_path, None, None)
        })
        .collect()
}

fn is_png_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("png"))
        .unwrap_or(false)
}

fn is_supported_render_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            ext.eq_ignore_ascii_case("png")
                || ext.eq_ignore_ascii_case("jpg")
                || ext.eq_ignore_ascii_case("jpeg")
        })
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_unmix_studio_white_pixel_removes_halo() {
        let true_color = [40u8, 110u8, 220u8];
        let alpha_u8 = 128u8;
        let a = (alpha_u8 as f32) / 255.0;
        let blended = [
            (true_color[0] as f32 * a + 255.0 * (1.0 - a)).round() as u8,
            (true_color[1] as f32 * a + 255.0 * (1.0 - a)).round() as u8,
            (true_color[2] as f32 * a + 255.0 * (1.0 - a)).round() as u8,
        ];

        let recovered = unmix_studio_white_pixel(blended, alpha_u8);
        assert!(
            (i32::from(recovered[0]) - i32::from(true_color[0])).abs() <= 2,
            "red channel mismatch: got {}, expected {}",
            recovered[0],
            true_color[0]
        );
        assert!(
            (i32::from(recovered[1]) - i32::from(true_color[1])).abs() <= 2,
            "green channel mismatch: got {}, expected {}",
            recovered[1],
            true_color[1]
        );
        assert!(
            (i32::from(recovered[2]) - i32::from(true_color[2])).abs() <= 2,
            "blue channel mismatch: got {}, expected {}",
            recovered[2],
            true_color[2]
        );
        assert_eq!(unmix_studio_white_pixel([255, 255, 255], 0), [0, 0, 0]);
    }

    #[test]
    fn test_connected_component_isolation_discards_floating_stickers() {
        let w = 96usize;
        let h = 96usize;
        let mut mask = vec![false; w * h];

        // Main character silhouette (30x50 = 1500 px)
        for y in 20..70 {
            for x in 33..63 {
                mask[y * w + x] = true;
            }
        }
        // Floating sticker #1 in top-left corner (6x6 = 36 px)
        for y in 4..10 {
            for x in 4..10 {
                mask[y * w + x] = true;
            }
        }
        // Floating dust speck #2 in bottom-right corner (4x4 = 16 px)
        for y in 84..88 {
            for x in 82..86 {
                mask[y * w + x] = true;
            }
        }

        let isolated = extract_largest_foreground_component(&mask, w, h);
        let kept_count = isolated.iter().filter(|&&b| b).count();
        assert_eq!(kept_count, 30 * 50);
        assert!(!isolated[5 * w + 5], "top-left floating sticker must be removed");
        assert!(!isolated[85 * w + 83], "bottom-right floating speck must be removed");
        assert!(isolated[45 * w + 48], "main character body must be preserved");
    }

    #[test]
    fn test_studio_matte_and_canonical_768_remaster_pipeline() {
        // Synthesize an 800x900 studio #FFFFFF render with:
        // - Character head + torso + boots
        // - Symmetric dark eyes at (340, 310) and (460, 314)
        // - Detached yellow sun sticker in the upper-left that must be stripped
        let w = 800u32;
        let h = 900u32;
        let mut studio = RgbImage::from_pixel(w, h, Rgb([255, 255, 255]));

        // Detached floating yellow sticker at (60..95, 70..105)
        for y in 70..105 {
            for x in 60..95 {
                studio.put_pixel(x, y, Rgb([250, 200, 40]));
            }
        }

        // Main chibi head & hair (x: 270..530, y: 170..410)
        for y in 170..410 {
            for x in 270..530 {
                let dx = (x as f32) - 400.0;
                let dy = (y as f32) - 290.0;
                if (dx * dx) / (130.0 * 130.0) + (dy * dy) / (120.0 * 120.0) <= 1.0 {
                    studio.put_pixel(x, y, Rgb([235, 195, 170]));
                }
            }
        }

        // Two dark irises: left=(340, 310), right=(460, 314), radius=14 (area ~ 615 px each)
        for (cx, cy) in [(340.0f32, 310.0f32), (460.0f32, 314.0f32)] {
            for y in 285..340 {
                for x in 315..490 {
                    let dist2 = ((x as f32) - cx).powi(2) + ((y as f32) - cy).powi(2);
                    if dist2 <= 14.0 * 14.0 {
                        studio.put_pixel(x, y, Rgb([24, 28, 38]));
                    }
                }
            }
        }

        // Connected torso & boots down to y = 780
        for y in 395..780 {
            for x in 325..475 {
                let color = if y < 640 {
                    Rgb([68, 138, 228])
                } else {
                    Rgb([92, 68, 54])
                };
                studio.put_pixel(x, y, color);
            }
        }

        let matted = studio_alpha_matte(&studio, "male_pleasant_sunny_synthetic");
        assert_eq!(matted.get_pixel(75, 85)[3], 0, "floating sticker must be transparent");

        let fg_mask: Vec<bool> = matted.pixels().map(|p| p[3] > 128).collect();
        let (leye, reye) =
            detect_eyes_precise(&studio, &fg_mask, "male_pleasant_sunny_synthetic")
                .expect("should detect synthetic iris pair");
        assert!((leye.0 - 340.0).abs() < 2.0 && (leye.1 - 310.0).abs() < 2.0);
        assert!((reye.0 - 460.0).abs() < 2.0 && (reye.1 - 314.0).abs() < 2.0);

        let (canonical, stats) = remaster_character_to_canonical(
            &matted,
            leye,
            reye,
            "male_pleasant_sunny_synthetic",
        )
        .expect("canonical remaster should succeed");

        assert_eq!(canonical.dimensions(), (CANONICAL_CANVAS, CANONICAL_CANVAS));
        assert!(
            (684..=706).contains(&stats.sole_y),
            "canonical sole_y={} must align near TARGET_SOLE_Y=692",
            stats.sole_y
        );

        let audit = audit_rgba_image(
            "male_pleasant_sunny.png",
            &canonical,
            true,
            SpriteCategory::StandingWeather,
        );
        assert!(audit.passed, "remastered sprite must pass all audit invariants: {:?}", audit);
        assert_eq!(audit.border_alpha_sum, 0);
        assert!(audit.white_fringe_ratio < MAX_WHITE_FRINGE_RATIO);
    }

    #[test]
    fn test_audit_detects_border_clipping_and_wrong_dimensions() {
        let mut clipped = RgbaImage::new(CANONICAL_CANVAS, CANONICAL_CANVAS);
        for y in 100..700 {
            for x in 300..460 {
                clipped.put_pixel(x, y, Rgba([120, 160, 210, 255]));
            }
        }
        // Touch top border pixel
        clipped.put_pixel(384, 0, Rgba([120, 160, 210, 180]));

        let row = audit_rgba_image(
            "male_hot_sunny.png",
            &clipped,
            true,
            SpriteCategory::StandingWeather,
        );
        assert!(!row.border_ok);
        assert!(!row.passed);
        assert_eq!(row.border_alpha_sum, 180);

        let wrong_sz = RgbaImage::new(512, 512);
        let row_sz = audit_rgba_image(
            "companions/companion_cat.png",
            &wrong_sz,
            true,
            SpriteCategory::Companion,
        );
        assert!(!row_sz.dimensions_ok);
        assert!(!row_sz.passed);
    }
}

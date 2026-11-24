//! Native Rust PC & Browser Suite Packager (`pack-suite`).
//!
//! 1:1 drop-in replacement for `scripts/pack-pc-suite.mjs` without spawning PowerShell:
//! 1. Copies all 24 canonical `.png` sprites (`+ companions/*.png`) from `assets/characters/`
//!    into `browser-extension/assets/characters/` and `desktop-widget/assets/characters/`.
//! 2. Synchronizes `styles.css` and `weather-npc-app.js` from `browser-extension/` into
//!    `desktop-widget/`.
//! 3. Validates `browser-extension/manifest.json` (`manifest_version == 3` and non-empty
//!    `content_security_policy.extension_pages`).
//! 4. Builds deflate-compressed `weather-buddy-extension.zip` and `weather-buddy-desktop-widget.zip`
//!    in parallel via `rayon::join` + `zip` + `walkdir` with cross-platform forward-slash ZIP paths,
//!    mirroring into `dist/downloads/` whenever `dist/` exists.

use std::fs::{self, File};
use std::io::{BufWriter, Read, Write};
use std::path::{Component, Path, PathBuf};
use std::time::Instant;

use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;
use zip::write::{SimpleFileOptions, ZipWriter};
use zip::CompressionMethod;

/// Minimum required character/NPC sprites in `assets/characters/`.
pub const MIN_CHARACTER_SPRITES: usize = 24;
/// Minimum valid output ZIP size in bytes (matches `scripts/pack-pc-suite.mjs`).
pub const MIN_ARCHIVE_BYTES: u64 = 1024;

const SHARED_RUNTIME_FILES: [&str; 2] = ["styles.css", "weather-npc-app.js"];
const EXTENSION_ZIP_NAME: &str = "weather-buddy-extension.zip";
const WIDGET_ZIP_NAME: &str = "weather-buddy-desktop-widget.zip";

#[derive(Debug, Clone, Deserialize)]
struct RawExtensionManifest {
    manifest_version: u32,
    #[serde(default)]
    version: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    content_security_policy: Option<RawManifestCsp>,
}

#[derive(Debug, Clone, Deserialize)]
struct RawManifestCsp {
    #[serde(default)]
    extension_pages: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ManifestInfo {
    pub name: String,
    pub version: String,
    pub manifest_version: u32,
    pub extension_pages_csp: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SpriteSyncStats {
    pub character_sprites_copied: usize,
    pub companion_sprites_copied: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct ZipArchiveStats {
    pub zip_path: String,
    pub files_archived: usize,
    pub uncompressed_bytes: u64,
    pub compressed_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct PackSuiteReport {
    pub character_sprites_synced: usize,
    pub companion_sprites_synced: usize,
    pub shared_runtime_files_synced: Vec<String>,
    pub manifest: ManifestInfo,
    pub extension_archive: ZipArchiveStats,
    pub desktop_widget_archive: ZipArchiveStats,
    pub mirrored_to_dist: bool,
    pub elapsed_ms: f64,
}

/// Converts a file path inside `base_dir` to a deterministic forward-slash (`Posix`) ZIP entry path.
pub fn normalize_zip_entry_path(base_dir: &Path, full_path: &Path) -> Result<String> {
    let rel = full_path.strip_prefix(base_dir).with_context(|| {
        format!(
            "Path {:?} is not inside archive root {:?}",
            full_path, base_dir
        )
    })?;

    let mut segments: Vec<&str> = Vec::new();
    for comp in rel.components() {
        match comp {
            Component::Normal(os_part) => {
                let s = os_part.to_str().ok_or_else(|| {
                    anyhow::anyhow!("Non-UTF-8 path segment in {:?}", full_path)
                })?;
                segments.push(s);
            }
            Component::CurDir => {}
            other => {
                bail!(
                    "Unsupported relative path component {:?} in {:?}",
                    other,
                    full_path
                );
            }
        }
    }

    if segments.is_empty() {
        bail!("Empty relative ZIP entry path for {:?}", full_path);
    }

    Ok(segments.join("/"))
}

/// Copies all 24 `.png` character/NPC sprites and `companions/*.png` sprites into both
/// `browser-extension/assets/characters/` and `desktop-widget/assets/characters/`.
pub fn copy_character_sprites(root_dir: &Path) -> Result<SpriteSyncStats> {
    let char_src_dir = root_dir.join("assets").join("characters");
    let ext_char_dir = root_dir
        .join("browser-extension")
        .join("assets")
        .join("characters");
    let widget_char_dir = root_dir
        .join("desktop-widget")
        .join("assets")
        .join("characters");

    if !char_src_dir.is_dir() {
        bail!(
            "Character source directory does not exist: {:?}",
            char_src_dir
        );
    }

    fs::create_dir_all(&ext_char_dir)
        .with_context(|| format!("Failed creating {:?}", ext_char_dir))?;
    fs::create_dir_all(&widget_char_dir)
        .with_context(|| format!("Failed creating {:?}", widget_char_dir))?;

    let mut png_files: Vec<PathBuf> = Vec::new();
    for entry in fs::read_dir(&char_src_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() && has_png_extension(&path) {
            png_files.push(path);
        }
    }
    png_files.sort();

    if png_files.len() < MIN_CHARACTER_SPRITES {
        bail!(
            "Expected {} character sprites in {:?}, found {}",
            MIN_CHARACTER_SPRITES,
            char_src_dir,
            png_files.len()
        );
    }

    for src in &png_files {
        let file_name = src
            .file_name()
            .ok_or_else(|| anyhow::anyhow!("Invalid sprite file name {:?}", src))?;
        fs::copy(src, ext_char_dir.join(file_name))
            .with_context(|| format!("Failed copying {:?} to browser-extension", src))?;
        fs::copy(src, widget_char_dir.join(file_name))
            .with_context(|| format!("Failed copying {:?} to desktop-widget", src))?;
    }

    let mut companion_sprites_copied = 0usize;
    let comp_src_dir = char_src_dir.join("companions");
    if comp_src_dir.is_dir() {
        let ext_comp_dir = ext_char_dir.join("companions");
        let widget_comp_dir = widget_char_dir.join("companions");
        fs::create_dir_all(&ext_comp_dir)?;
        fs::create_dir_all(&widget_comp_dir)?;

        let mut comp_files: Vec<PathBuf> = Vec::new();
        for entry in fs::read_dir(&comp_src_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_file() && has_png_extension(&path) {
                comp_files.push(path);
            }
        }
        comp_files.sort();

        for src in &comp_files {
            let file_name = src
                .file_name()
                .ok_or_else(|| anyhow::anyhow!("Invalid companion sprite name {:?}", src))?;
            fs::copy(src, ext_comp_dir.join(file_name))?;
            fs::copy(src, widget_comp_dir.join(file_name))?;
            companion_sprites_copied += 1;
        }
    }

    Ok(SpriteSyncStats {
        character_sprites_copied: png_files.len(),
        companion_sprites_copied,
    })
}

/// Synchronizes `styles.css` and `weather-npc-app.js` from `browser-extension/` to `desktop-widget/`.
pub fn sync_shared_runtime_files(root_dir: &Path) -> Result<Vec<String>> {
    let ext_dir = root_dir.join("browser-extension");
    let widget_dir = root_dir.join("desktop-widget");
    fs::create_dir_all(&widget_dir)
        .with_context(|| format!("Failed creating {:?}", widget_dir))?;

    let mut synced = Vec::with_capacity(SHARED_RUNTIME_FILES.len());
    for file_name in SHARED_RUNTIME_FILES {
        let src = ext_dir.join(file_name);
        if !src.is_file() {
            bail!("Missing required source file: {:?}", src);
        }
        let dst = widget_dir.join(file_name);
        fs::copy(&src, &dst)
            .with_context(|| format!("Failed synchronizing {:?} -> {:?}", src, dst))?;
        synced.push(file_name.to_string());
    }
    Ok(synced)
}

/// Parses and validates `browser-extension/manifest.json` (`manifest_version == 3` and
/// `content_security_policy.extension_pages` present).
pub fn verify_manifest_json(ext_dir: &Path) -> Result<ManifestInfo> {
    let manifest_path = ext_dir.join("manifest.json");
    let raw_json = fs::read_to_string(&manifest_path)
        .with_context(|| format!("Failed reading {:?}", manifest_path))?;
    verify_manifest_json_str(&raw_json, &manifest_path)
}

pub fn verify_manifest_json_str(raw_json: &str, source_label: &Path) -> Result<ManifestInfo> {
    let parsed: RawExtensionManifest = serde_json::from_str(raw_json)
        .with_context(|| format!("Invalid JSON in {:?}", source_label))?;

    if parsed.manifest_version != 3 {
        bail!(
            "manifest.json must be Manifest V3 (found manifest_version = {})",
            parsed.manifest_version
        );
    }

    let csp_pages = parsed
        .content_security_policy
        .and_then(|c| c.extension_pages)
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            anyhow::anyhow!("manifest.json must define content_security_policy.extension_pages")
        })?;

    let version = if parsed.version.trim().is_empty() {
        "0.0.0".to_string()
    } else {
        parsed.version
    };

    Ok(ManifestInfo {
        name: parsed.name,
        version,
        manifest_version: parsed.manifest_version,
        extension_pages_csp: csp_pages,
    })
}

/// Creates a deflate-compressed `.zip` archive of `source_dir` at `destination_zip` using
/// `walkdir` + `zip`, guaranteeing forward-slash relative paths across Windows/macOS/Linux.
pub fn create_deflate_zip_archive(
    source_dir: &Path,
    destination_zip: &Path,
    min_expected_bytes: u64,
) -> Result<ZipArchiveStats> {
    if !source_dir.is_dir() {
        bail!("Archive source directory does not exist: {:?}", source_dir);
    }

    if let Some(parent) = destination_zip.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)
                .with_context(|| format!("Failed creating directory {:?}", parent))?;
        }
    }

    if destination_zip.exists() {
        fs::remove_file(destination_zip)
            .with_context(|| format!("Failed removing existing archive {:?}", destination_zip))?;
    }

    let zip_file = File::create(destination_zip)
        .with_context(|| format!("Failed creating archive {:?}", destination_zip))?;
    let buf_writer = BufWriter::with_capacity(256 * 1024, zip_file);
    let mut zip_writer = ZipWriter::new(buf_writer);

    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o644);

    let mut file_buf = Vec::with_capacity(512 * 1024);
    let mut files_archived = 0usize;
    let mut uncompressed_bytes = 0u64;

    for entry in WalkDir::new(source_dir).sort_by_file_name() {
        let entry = entry.with_context(|| format!("Error walking {:?}", source_dir))?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let archive_rel_path = normalize_zip_entry_path(source_dir, path)?;
        zip_writer
            .start_file(&archive_rel_path, options)
            .with_context(|| format!("Failed starting ZIP entry '{}'", archive_rel_path))?;

        file_buf.clear();
        let mut src_file =
            File::open(path).with_context(|| format!("Failed opening {:?}", path))?;
        let read_bytes = src_file
            .read_to_end(&mut file_buf)
            .with_context(|| format!("Failed reading {:?}", path))?;

        zip_writer
            .write_all(&file_buf)
            .with_context(|| format!("Failed writing ZIP entry '{}'", archive_rel_path))?;

        files_archived += 1;
        uncompressed_bytes += read_bytes as u64;
    }

    let mut finished_writer = zip_writer
        .finish()
        .with_context(|| format!("Failed finalizing ZIP archive {:?}", destination_zip))?;
    finished_writer.flush()?;
    drop(finished_writer);

    let metadata = fs::metadata(destination_zip)
        .with_context(|| format!("Missing output ZIP archive {:?}", destination_zip))?;
    let compressed_bytes = metadata.len();
    if compressed_bytes < min_expected_bytes {
        bail!(
            "Zip archive looks unexpectedly small ({} bytes < {} bytes): {:?}",
            compressed_bytes,
            min_expected_bytes,
            destination_zip
        );
    }

    Ok(ZipArchiveStats {
        zip_path: destination_zip.display().to_string(),
        files_archived,
        uncompressed_bytes,
        compressed_bytes,
    })
}

/// Runs the complete WeatherBuddy PC & Browser Suite packaging workflow (`pack-suite`).
pub fn pack_pc_suite(root_dir: &Path) -> Result<PackSuiteReport> {
    let started = Instant::now();

    let sprite_stats = copy_character_sprites(root_dir)?;
    let shared_runtime_files_synced = sync_shared_runtime_files(root_dir)?;

    let ext_dir = root_dir.join("browser-extension");
    let widget_dir = root_dir.join("desktop-widget");
    let manifest = verify_manifest_json(&ext_dir)?;

    let downloads_dir = root_dir.join("public").join("downloads");
    fs::create_dir_all(&downloads_dir)
        .with_context(|| format!("Failed creating {:?}", downloads_dir))?;

    let ext_zip_path = downloads_dir.join(EXTENSION_ZIP_NAME);
    let widget_zip_path = downloads_dir.join(WIDGET_ZIP_NAME);

    // Compress both extension and desktop-widget archives simultaneously across CPU cores!
    let (ext_res, widget_res) = rayon::join(
        || create_deflate_zip_archive(&ext_dir, &ext_zip_path, MIN_ARCHIVE_BYTES),
        || create_deflate_zip_archive(&widget_dir, &widget_zip_path, MIN_ARCHIVE_BYTES),
    );
    let extension_archive = ext_res?;
    let desktop_widget_archive = widget_res?;

    let dist_dir = root_dir.join("dist");
    let mut mirrored_to_dist = false;
    if dist_dir.exists() {
        let dist_downloads = dist_dir.join("downloads");
        fs::create_dir_all(&dist_downloads)
            .with_context(|| format!("Failed creating {:?}", dist_downloads))?;
        fs::copy(&ext_zip_path, dist_downloads.join(EXTENSION_ZIP_NAME))?;
        fs::copy(&widget_zip_path, dist_downloads.join(WIDGET_ZIP_NAME))?;
        mirrored_to_dist = true;
    }

    Ok(PackSuiteReport {
        character_sprites_synced: sprite_stats.character_sprites_copied,
        companion_sprites_synced: sprite_stats.companion_sprites_copied,
        shared_runtime_files_synced,
        manifest,
        extension_archive,
        desktop_widget_archive,
        mirrored_to_dist,
        elapsed_ms: started.elapsed().as_secs_f64() * 1000.0,
    })
}

fn has_png_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("png"))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageFormat, Rgba, RgbaImage};
    use zip::ZipArchive;

    #[test]
    fn test_normalize_zip_entry_path_preserves_forward_slashes() {
        let base = Path::new("workspace_root").join("browser-extension");
        let nested = base
            .join("assets")
            .join("characters")
            .join("companions")
            .join("companion_cat.png");

        let zip_rel = normalize_zip_entry_path(&base, &nested).expect("should normalize path");
        assert_eq!(zip_rel, "assets/characters/companions/companion_cat.png");
        assert!(!zip_rel.contains('\\'));
    }

    #[test]
    fn test_verify_manifest_json_enforces_mv3_and_csp() {
        let valid = r#"{
            "manifest_version": 3,
            "name": "WeatherBuddy",
            "version": "3.1.0",
            "content_security_policy": {
                "extension_pages": "script-src 'self'; object-src 'none';"
            }
        }"#;
        let info = verify_manifest_json_str(valid, Path::new("manifest.json"))
            .expect("valid MV3 manifest should pass");
        assert_eq!(info.manifest_version, 3);
        assert_eq!(info.version, "3.1.0");

        let invalid_mv2 = r#"{
            "manifest_version": 2,
            "version": "2.0.0",
            "content_security_policy": { "extension_pages": "script-src 'self';" }
        }"#;
        assert!(verify_manifest_json_str(invalid_mv2, Path::new("manifest.json")).is_err());

        let missing_csp = r#"{
            "manifest_version": 3,
            "version": "3.1.0"
        }"#;
        assert!(verify_manifest_json_str(missing_csp, Path::new("manifest.json")).is_err());
    }

    #[test]
    fn test_pack_pc_suite_end_to_end_in_isolated_temp_workspace() {
        let unique_dir = std::env::temp_dir().join(format!(
            "weather_buddy_packer_test_{}_{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        let _ = fs::remove_dir_all(&unique_dir);

        let char_dir = unique_dir.join("assets").join("characters");
        let comp_dir = char_dir.join("companions");
        let ext_dir = unique_dir.join("browser-extension");
        let widget_dir = unique_dir.join("desktop-widget");
        let dist_dir = unique_dir.join("dist");

        fs::create_dir_all(&comp_dir).unwrap();
        fs::create_dir_all(&ext_dir).unwrap();
        fs::create_dir_all(&widget_dir).unwrap();
        fs::create_dir_all(&dist_dir).unwrap();

        // Generate 24 deterministic RGBA PNG sprites + 2 companion PNGs
        for idx in 0..24 {
            let mut img = RgbaImage::new(32, 32);
            for y in 4..28 {
                for x in 4..28 {
                    img.put_pixel(
                        x,
                        y,
                        Rgba([
                            ((idx * 9 + x as usize) % 250) as u8,
                            ((idx * 13 + y as usize) % 250) as u8,
                            180,
                            255,
                        ]),
                    );
                }
            }
            img.save_with_format(
                char_dir.join(format!("sprite_{idx:02}.png")),
                ImageFormat::Png,
            )
            .unwrap();
        }
        for pet in ["companion_cat.png", "companion_puppy.png"] {
            let img = RgbaImage::from_pixel(16, 16, Rgba([240, 160, 80, 255]));
            img.save_with_format(comp_dir.join(pet), ImageFormat::Png)
                .unwrap();
        }

        fs::write(
            ext_dir.join("manifest.json"),
            r#"{
                "manifest_version": 3,
                "name": "WeatherBuddy Test Extension",
                "version": "3.1.0",
                "content_security_policy": {
                    "extension_pages": "script-src 'self'; object-src 'none'; base-uri 'self';"
                }
            }"#,
        )
        .unwrap();
        fs::write(
            ext_dir.join("styles.css"),
            "body { margin: 0; background: #0f172a; }\n".repeat(32),
        )
        .unwrap();
        fs::write(
            ext_dir.join("weather-npc-app.js"),
            "export const WEATHER_BUDDY_READY = true;\n".repeat(32),
        )
        .unwrap();
        fs::write(widget_dir.join("widget.html"), "<!doctype html><title>Widget</title>").unwrap();

        let report = pack_pc_suite(&unique_dir).expect("pack_pc_suite should succeed");
        assert_eq!(report.character_sprites_synced, 24);
        assert_eq!(report.companion_sprites_synced, 2);
        assert!(report.mirrored_to_dist);

        // Verify shared runtime sync into desktop-widget/
        assert_eq!(
            fs::read(ext_dir.join("styles.css")).unwrap(),
            fs::read(widget_dir.join("styles.css")).unwrap()
        );
        assert_eq!(
            fs::read(ext_dir.join("weather-npc-app.js")).unwrap(),
            fs::read(widget_dir.join("weather-npc-app.js")).unwrap()
        );
        assert!(
            widget_dir
                .join("assets")
                .join("characters")
                .join("companions")
                .join("companion_cat.png")
                .is_file()
        );

        // Inspect resulting ZIP entries for forward-slash POSIX paths & Deflate compression
        let ext_zip_file = File::open(
            unique_dir
                .join("public")
                .join("downloads")
                .join(EXTENSION_ZIP_NAME),
        )
        .unwrap();
        let mut archive = ZipArchive::new(ext_zip_file).unwrap();
        let mut entry_names = Vec::new();
        for i in 0..archive.len() {
            let entry = archive.by_index(i).unwrap();
            assert_eq!(entry.compression(), CompressionMethod::Deflated);
            assert!(
                !entry.name().contains('\\'),
                "ZIP entry contains Windows backslash: {}",
                entry.name()
            );
            entry_names.push(entry.name().to_string());
        }
        assert!(entry_names.iter().any(|n| n == "manifest.json"));
        assert!(entry_names
            .iter()
            .any(|n| n == "assets/characters/companions/companion_cat.png"));
        assert!(
            unique_dir
                .join("dist")
                .join("downloads")
                .join(WIDGET_ZIP_NAME)
                .is_file()
        );

        let _ = fs::remove_dir_all(&unique_dir);
    }
}

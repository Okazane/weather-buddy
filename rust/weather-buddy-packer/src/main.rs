//! WeatherBuddy Multi-Core 3D Sprite Processor & PC Suite Packager CLI (`weather-buddy-packer`).
//!
//! Subcommands:
//! - `audit-sprites`: Parallel `rayon` verification across all 24 `768x768` character/NPC PNGs
//!   and `256x256` companion PNGs.
//! - `remaster`: Pure-Rust `#FFFFFF` studio alpha unmixing, 4-connected foreground isolation,
//!   and canonical `768x768` landmark alignment (`Eye Y=296, IPD=114, Sole Y=692`).
//! - `pack-suite`: Drop-in native Rust replacement for `scripts/pack-pc-suite.mjs` using
//!   `zip` (Deflate) + `walkdir` + `rayon`.

pub mod sprite_ops;
pub mod zip_packager;

use std::env;
use std::path::{Path, PathBuf};

use anyhow::{bail, Context, Result};
use clap::{Parser, Subcommand};

use crate::sprite_ops::{
    audit_sprites_directory, format_audit_table, remaster_batch_directory, remaster_sprite_file,
};
use crate::zip_packager::pack_pc_suite;

#[derive(Debug, Parser)]
#[command(
    name = "weather-buddy-packer",
    version,
    about = "Multi-core Rayon 3D sprite auditor, canonical landmark remastering engine, and PC suite ZIP packager"
)]
pub struct Cli {
    /// Optional explicit path to the WeatherBuddy repository root.
    /// Auto-detected from current directory or Cargo workspace parent when omitted.
    #[arg(long, global = true)]
    pub root: Option<PathBuf>,

    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Debug, Subcommand)]
pub enum Commands {
    /// Inspects all 24 character/NPC PNGs (`768x768`) + companion PNGs (`256x256`) across all CPU cores.
    AuditSprites {
        /// Optional explicit directory of character PNGs (defaults to `<root>/assets/characters`).
        #[arg(long)]
        dir: Option<PathBuf>,

        /// Emit structured JSON report instead of formatted ASCII table.
        #[arg(long)]
        json: bool,
    },

    /// Pure-Rust studio `#FFFFFF` alpha unmixing, connected-component isolation & `768x768` canonical alignment.
    Remaster {
        /// Single raw studio image path (`.jpg` / `.png`) to remaster.
        #[arg(short, long, conflicts_with = "input_dir")]
        input: Option<PathBuf>,

        /// Destination canonical `768x768` RGBA `.png` path (used with `--input`).
        #[arg(short, long, requires = "input")]
        output: Option<PathBuf>,

        /// Batch input directory of raw studio renders (processed in parallel via `rayon`).
        #[arg(long)]
        input_dir: Option<PathBuf>,

        /// Batch output directory for canonical `768x768` RGBA `.png` sprites.
        #[arg(long, requires = "input_dir")]
        output_dir: Option<PathBuf>,

        /// Optional manual sub-pixel left-eye override formatted as `X,Y` (e.g. `369.5,369.0`).
        #[arg(long)]
        left_eye: Option<String>,

        /// Optional manual sub-pixel right-eye override formatted as `X,Y` (e.g. `512.5,381.0`).
        #[arg(long)]
        right_eye: Option<String>,

        /// Optional moonlight `clear_night` color-grading pass (`male` or `female`).
        #[arg(long)]
        night_variant: Option<String>,

        /// Emit structured JSON output.
        #[arg(long)]
        json: bool,
    },

    /// Synchronizes sprites + runtime files, validates Manifest V3 + CSP, and builds deflate `.zip` bundles.
    PackSuite {
        /// Run multi-core `audit-sprites` check before building the `.zip` bundles.
        #[arg(long)]
        audit_first: bool,

        /// Emit structured JSON summary.
        #[arg(long)]
        json: bool,
    },
}

/// Resolves the WeatherBuddy project root whether invoked from `<repo>/`, `<repo>/rust/`,
/// or `<repo>/rust/weather-buddy-packer/`.
pub fn resolve_project_root(explicit_root: Option<&Path>) -> Result<PathBuf> {
    if let Some(root) = explicit_root {
        return Ok(root.to_path_buf());
    }

    let cwd = env::current_dir().context("Failed to determine current working directory")?;
    let mut cursor: Option<&Path> = Some(cwd.as_path());
    while let Some(candidate) = cursor {
        if candidate.join("assets").join("characters").is_dir()
            && candidate.join("browser-extension").is_dir()
        {
            return Ok(candidate.to_path_buf());
        }
        cursor = candidate.parent();
    }

    // Fallback relative to CARGO_MANIFEST_DIR during `cargo run` / `cargo test`
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    if let Some(repo_root) = manifest_dir.parent().and_then(|p| p.parent()) {
        if repo_root.join("assets").join("characters").is_dir() {
            return Ok(repo_root.to_path_buf());
        }
    }

    Ok(cwd)
}

pub fn parse_xy_coord(raw: &str) -> Result<(f32, f32)> {
    let parts: Vec<&str> = raw.split(',').map(str::trim).collect();
    if parts.len() != 2 {
        bail!("Expected coordinate formatted as 'X,Y' (e.g. '369.5,369.0'), got '{raw}'");
    }
    let x: f32 = parts[0]
        .parse()
        .with_context(|| format!("Invalid X coordinate '{}' in '{}'", parts[0], raw))?;
    let y: f32 = parts[1]
        .parse()
        .with_context(|| format!("Invalid Y coordinate '{}' in '{}'", parts[1], raw))?;
    Ok((x, y))
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match &cli.command {
        Commands::AuditSprites { dir, json } => {
            let char_dir = match dir {
                Some(d) => d.clone(),
                None => resolve_project_root(cli.root.as_deref())?
                    .join("assets")
                    .join("characters"),
            };

            let report = audit_sprites_directory(&char_dir)?;
            if *json {
                println!("{}", serde_json::to_string_pretty(&report)?);
            } else {
                print!("{}", format_audit_table(&report));
            }

            if !report.all_passed {
                bail!(
                    "Sprite audit failed: {}/{} passed (character/NPC count = {}, expected >= 24)",
                    report.passed_count,
                    report.total_sprites,
                    report.character_npc_count
                );
            }
        }

        Commands::Remaster {
            input,
            output,
            input_dir,
            output_dir,
            left_eye,
            right_eye,
            night_variant,
            json,
        } => {
            if let (Some(in_file), Some(out_file)) = (input, output) {
                let eyes_override = match (left_eye, right_eye) {
                    (Some(l), Some(r)) => Some((parse_xy_coord(l)?, parse_xy_coord(r)?)),
                    (None, None) => None,
                    _ => bail!("Both --left-eye and --right-eye must be provided together"),
                };

                let stats = remaster_sprite_file(
                    in_file,
                    out_file,
                    eyes_override,
                    night_variant.as_deref(),
                )?;
                if *json {
                    println!("{}", serde_json::to_string_pretty(&stats)?);
                } else {
                    println!(
                        "Remastered {} -> {} | top={} sole={} v_ratio={:.3} eyes=({:.1},{:.1})..({:.1},{:.1})",
                        stats.input_path,
                        stats.output_path,
                        stats.top_y,
                        stats.sole_y,
                        stats.v_ratio,
                        stats.left_eye[0],
                        stats.left_eye[1],
                        stats.right_eye[0],
                        stats.right_eye[1]
                    );
                }
            } else if let (Some(in_dir), Some(out_dir)) = (input_dir, output_dir) {
                let batch_stats = remaster_batch_directory(in_dir, out_dir)?;
                if *json {
                    println!("{}", serde_json::to_string_pretty(&batch_stats)?);
                } else {
                    for st in &batch_stats {
                        println!(
                            "Remastered {} -> {} | top={} sole={} v_ratio={:.3}",
                            st.input_path, st.output_path, st.top_y, st.sole_y, st.v_ratio
                        );
                    }
                    println!(
                        "Completed multi-core remaster of {} sprites into {}",
                        batch_stats.len(),
                        out_dir.display()
                    );
                }
            } else {
                bail!("Provide either (--input <FILE> --output <FILE>) or (--input-dir <DIR> --output-dir <DIR>)");
            }
        }

        Commands::PackSuite { audit_first, json } => {
            let root_dir = resolve_project_root(cli.root.as_deref())?;
            if *audit_first {
                let char_dir = root_dir.join("assets").join("characters");
                let audit = audit_sprites_directory(&char_dir)?;
                if !audit.all_passed {
                    bail!(
                        "Pre-pack sprite audit failed ({}/{} passed)",
                        audit.passed_count,
                        audit.total_sprites
                    );
                }
            }

            let report = pack_pc_suite(&root_dir)?;
            if *json {
                println!("{}", serde_json::to_string_pretty(&report)?);
            } else {
                println!(
                    "Packing WeatherBuddy PC & Browser Suite (completed in {:.1} ms)...",
                    report.elapsed_ms
                );
                println!(
                    "  [OK] Synchronized {} character/NPC sprites (+ {} companion sprites) into browser-extension/ and desktop-widget/",
                    report.character_sprites_synced, report.companion_sprites_synced
                );
                println!(
                    "  [OK] Verified Manifest V{} (v{}) and CSP hardening",
                    report.manifest.manifest_version, report.manifest.version
                );
                println!(
                    "  [OK] Created {} ({:.2} MB, {} files)",
                    report.extension_archive.zip_path,
                    (report.extension_archive.compressed_bytes as f64) / (1024.0 * 1024.0),
                    report.extension_archive.files_archived
                );
                println!(
                    "  [OK] Created {} ({:.2} MB, {} files)",
                    report.desktop_widget_archive.zip_path,
                    (report.desktop_widget_archive.compressed_bytes as f64) / (1024.0 * 1024.0),
                    report.desktop_widget_archive.files_archived
                );
                if report.mirrored_to_dist {
                    println!("  [OK] Mirrored archives into dist/downloads/");
                }
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_xy_coord_valid_and_invalid() {
        let (x, y) = parse_xy_coord("369.5, 381.0").unwrap();
        assert!((x - 369.5).abs() < 1e-4);
        assert!((y - 381.0).abs() < 1e-4);
        assert!(parse_xy_coord("invalid").is_err());
        assert!(parse_xy_coord("10,20,30").is_err());
    }

    #[test]
    fn test_cli_subcommand_parsing() {
        let audit_cli = Cli::try_parse_from(["weather-buddy-packer", "audit-sprites", "--json"])
            .expect("audit-sprites should parse");
        assert!(matches!(
            audit_cli.command,
            Commands::AuditSprites { json: true, .. }
        ));

        let remaster_cli = Cli::try_parse_from([
            "weather-buddy-packer",
            "remaster",
            "--input",
            "raw.jpg",
            "--output",
            "out.png",
            "--left-eye",
            "327.0,296.0",
            "--right-eye",
            "441.0,296.0",
        ])
        .expect("remaster should parse");
        assert!(matches!(remaster_cli.command, Commands::Remaster { .. }));

        let pack_cli = Cli::try_parse_from([
            "weather-buddy-packer",
            "pack-suite",
            "--audit-first",
        ])
        .expect("pack-suite should parse");
        assert!(matches!(
            pack_cli.command,
            Commands::PackSuite {
                audit_first: true,
                ..
            }
        ));
    }
}

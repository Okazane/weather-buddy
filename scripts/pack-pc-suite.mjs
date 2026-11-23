/**
 * WeatherBuddy PC Suite Packager (scripts/pack-pc-suite.mjs)
 *
 * Synchronizes shared assets and packages:
 *   1. public/downloads/weather-buddy-extension.zip (Chrome / Edge / Brave / CocCoc MV3 Extension)
 *   2. public/downloads/weather-buddy-desktop-widget.zip (Standalone Windows Desktop Companion Widget)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const CHAR_SRC_DIR = path.join(ROOT_DIR, 'assets', 'characters');
const EXT_DIR = path.join(ROOT_DIR, 'browser-extension');
const EXT_CHAR_DIR = path.join(EXT_DIR, 'assets', 'characters');
const WIDGET_DIR = path.join(ROOT_DIR, 'desktop-widget');
const WIDGET_CHAR_DIR = path.join(WIDGET_DIR, 'assets', 'characters');
const DOWNLOADS_DIR = path.join(ROOT_DIR, 'public', 'downloads');
const DIST_DOWNLOADS_DIR = path.join(ROOT_DIR, 'dist', 'downloads');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyCharacterSprites() {
  ensureDir(EXT_CHAR_DIR);
  ensureDir(WIDGET_CHAR_DIR);

  const files = fs
    .readdirSync(CHAR_SRC_DIR)
    .filter((f) => f.toLowerCase().endsWith('.png'));

  if (files.length < 24) {
    throw new Error(`Expected 24 character sprites in ${CHAR_SRC_DIR}, found ${files.length}`);
  }

  for (const file of files) {
    const src = path.join(CHAR_SRC_DIR, file);
    fs.copyFileSync(src, path.join(EXT_CHAR_DIR, file));
    fs.copyFileSync(src, path.join(WIDGET_CHAR_DIR, file));
  }
  return files.length;
}

function syncSharedRuntimeFiles() {
  const sharedFiles = ['styles.css', 'weather-npc-app.js'];
  for (const file of sharedFiles) {
    const src = path.join(EXT_DIR, file);
    const dst = path.join(WIDGET_DIR, file);
    if (!fs.existsSync(src)) {
      throw new Error(`Missing required source file: ${src}`);
    }
    fs.copyFileSync(src, dst);
  }
}

function verifyManifestJson() {
  const manifestPath = path.join(EXT_DIR, 'manifest.json');
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (parsed.manifest_version !== 3) {
    throw new Error('manifest.json must be Manifest V3');
  }
  if (!parsed.content_security_policy || !parsed.content_security_policy.extension_pages) {
    throw new Error('manifest.json must define content_security_policy.extension_pages');
  }
  return parsed.version;
}

function createZipArchive(sourceDir, destinationZip) {
  if (fs.existsSync(destinationZip)) {
    fs.unlinkSync(destinationZip);
  }
  const psCommand = `Compress-Archive -Path '${sourceDir.replace(/'/g, "''")}\\*' -DestinationPath '${destinationZip.replace(/'/g, "''")}' -CompressionLevel Optimal -Force`;
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCommand], {
    stdio: 'inherit',
  });

  if (!fs.existsSync(destinationZip)) {
    throw new Error(`Failed to create zip archive: ${destinationZip}`);
  }
  const stat = fs.statSync(destinationZip);
  if (stat.size < 1024) {
    throw new Error(`Zip archive looks unexpectedly small (${stat.size} bytes): ${destinationZip}`);
  }
  return stat.size;
}

function main() {
  console.log('📦 Packing WeatherBuddy PC & Browser Suite...');
  const spriteCount = copyCharacterSprites();
  console.log(`✅ Synchronized ${spriteCount} character & NPC sprites into browser-extension/ and desktop-widget/`);

  syncSharedRuntimeFiles();
  const version = verifyManifestJson();
  console.log(`✅ Verified Manifest V3 (v${version}) and CSP hardening`);

  ensureDir(DOWNLOADS_DIR);

  const extZipPath = path.join(DOWNLOADS_DIR, 'weather-buddy-extension.zip');
  const widgetZipPath = path.join(DOWNLOADS_DIR, 'weather-buddy-desktop-widget.zip');

  const extBytes = createZipArchive(EXT_DIR, extZipPath);
  const widgetBytes = createZipArchive(WIDGET_DIR, widgetZipPath);

  console.log(`✅ Created ${extZipPath} (${(extBytes / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`✅ Created ${widgetZipPath} (${(widgetBytes / 1024 / 1024).toFixed(2)} MB)`);

  // Also mirror into dist/downloads if dist/ already exists
  if (fs.existsSync(path.join(ROOT_DIR, 'dist'))) {
    ensureDir(DIST_DOWNLOADS_DIR);
    fs.copyFileSync(extZipPath, path.join(DIST_DOWNLOADS_DIR, 'weather-buddy-extension.zip'));
    fs.copyFileSync(widgetZipPath, path.join(DIST_DOWNLOADS_DIR, 'weather-buddy-desktop-widget.zip'));
    console.log('✅ Mirrored archives into dist/downloads/');
  }
}

main();

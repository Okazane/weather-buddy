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

  let companionCount = 0;
  const compSrcDir = path.join(CHAR_SRC_DIR, 'companions');
  if (fs.existsSync(compSrcDir) && fs.statSync(compSrcDir).isDirectory()) {
    const extCompDir = path.join(EXT_CHAR_DIR, 'companions');
    const widgetCompDir = path.join(WIDGET_CHAR_DIR, 'companions');
    ensureDir(extCompDir);
    ensureDir(widgetCompDir);
    const compFiles = fs
      .readdirSync(compSrcDir)
      .filter((f) => f.toLowerCase().endsWith('.png'));
    for (const file of compFiles) {
      const src = path.join(compSrcDir, file);
      fs.copyFileSync(src, path.join(extCompDir, file));
      fs.copyFileSync(src, path.join(widgetCompDir, file));
      companionCount += 1;
    }
  }
  return { spriteCount: files.length, companionCount };
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

function verifyDesktopWidgetHtml() {
  const widgetHtmlPath = path.join(WIDGET_DIR, 'widget.html');
  if (!fs.existsSync(widgetHtmlPath)) {
    throw new Error(`Missing required desktop widget HTML: ${widgetHtmlPath}`);
  }
  const raw = fs.readFileSync(widgetHtmlPath, 'utf8');
  if (!/Content-Security-Policy/i.test(raw)) {
    throw new Error('desktop-widget/widget.html must define a Content-Security-Policy meta tag');
  }
}

function main() {
  console.log('📦 Packing WeatherBuddy PC & Browser Suite...');
  const { spriteCount, companionCount } = copyCharacterSprites();
  console.log(
    `✅ Synchronized ${spriteCount} character & NPC sprites (+${companionCount} companion sprites) into browser-extension/ and desktop-widget/`
  );

  syncSharedRuntimeFiles();
  const version = verifyManifestJson();
  verifyDesktopWidgetHtml();
  console.log(`✅ Verified Manifest V3 (v${version}), desktop widget HTML, and CSP hardening`);

  ensureDir(DOWNLOADS_DIR);

  const extZipPath = path.join(DOWNLOADS_DIR, 'weather-buddy-extension.zip');
  const widgetZipPath = path.join(DOWNLOADS_DIR, 'weather-buddy-desktop-widget.zip');

  const extBytes = createZipArchive(EXT_DIR, extZipPath);
  const widgetBytes = createZipArchive(WIDGET_DIR, widgetZipPath);

  console.log(`✅ Created ${extZipPath} (${(extBytes / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`✅ Created ${widgetZipPath} (${(widgetBytes / 1024 / 1024).toFixed(2)} MB)`);

  // Also mirror into dist/downloads and inject PWA manifest + Service Worker into dist/ if dist/ exists
  const distRoot = path.join(ROOT_DIR, 'dist');
  if (fs.existsSync(distRoot)) {
    ensureDir(DIST_DOWNLOADS_DIR);
    fs.copyFileSync(extZipPath, path.join(DIST_DOWNLOADS_DIR, 'weather-buddy-extension.zip'));
    fs.copyFileSync(widgetZipPath, path.join(DIST_DOWNLOADS_DIR, 'weather-buddy-desktop-widget.zip'));

    const manifestSrc = path.join(ROOT_DIR, 'public', 'manifest.webmanifest');
    const swSrc = path.join(ROOT_DIR, 'public', 'sw.js');
    const iconCandidates = [
      path.join(ROOT_DIR, 'rust', 'weather-buddy-tauri', 'icons', '128x128.png'),
      path.join(ROOT_DIR, 'assets', 'icon.png'),
      path.join(CHAR_SRC_DIR, 'female_pleasant_sunny.png'),
    ];
    const iconSrc = iconCandidates.find((p) => fs.existsSync(p));

    if (fs.existsSync(manifestSrc)) {
      fs.copyFileSync(manifestSrc, path.join(distRoot, 'manifest.webmanifest'));
    }
    if (fs.existsSync(swSrc)) {
      fs.copyFileSync(swSrc, path.join(distRoot, 'sw.js'));
    }
    if (iconSrc) {
      fs.copyFileSync(iconSrc, path.join(distRoot, 'pwa-icon.png'));
      fs.copyFileSync(iconSrc, path.join(ROOT_DIR, 'public', 'pwa-icon.png'));
    }

    const distHtmlPath = path.join(distRoot, 'index.html');
    if (fs.existsSync(distHtmlPath)) {
      let html = fs.readFileSync(distHtmlPath, 'utf8');
      if (!html.includes('rel="manifest"')) {
        html = html.replace(
          '</head>',
          '  <link rel="manifest" href="/manifest.webmanifest" />\n  <meta name="theme-color" content="#152033" />\n  <link rel="apple-touch-icon" href="/pwa-icon.png" />\n</head>'
        );
        fs.writeFileSync(distHtmlPath, html, 'utf8');
      }
    }
    console.log('✅ Mirrored archives & PWA assets (manifest.webmanifest + sw.js) into dist/');
  }
}

main();

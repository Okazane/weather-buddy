import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { hashApiKeysSalted, redactSecrets } from './security.mjs';

export { redactSecrets };
export const hashApiKeys = hashApiKeysSalted;

export const MAX_TELEMETRY_ENTRIES = 50;

const ALLOWED_SCENES = new Set([
  'storm_raincoat',
  'light_rain_umbrella',
  'hot_sunny',
  'pleasant_sunny',
  'clear_night',
  'chilly_cozy',
  'freezing_puffer',
]);

/**
 * Validates and normalizes an incoming WidgetSyncPayload, stripping unknown properties
 * so arbitrary fields or secrets can never be written to widget_sync.json.
 */
export function sanitizeWidgetSyncPayload(rawInput) {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    throw new Error('Payload đồng bộ Widget không hợp lệ (cần JSON object).');
  }

  const candidate =
    rawInput.payload && typeof rawInput.payload === 'object' && !Array.isArray(rawInput.payload)
      ? rawInput.payload
      : rawInput;

  const locationName = String(candidate.locationName ?? '').trim();
  if (!locationName) {
    throw new Error('Thiếu trường bắt buộc: locationName.');
  }

  const temperatureC = Number(candidate.temperatureC);
  if (!Number.isFinite(temperatureC)) {
    throw new Error('Thiếu hoặc sai kiểu trường bắt buộc: temperatureC.');
  }

  const gender = candidate.gender === 'male' ? 'male' : 'female';
  const sceneId = ALLOWED_SCENES.has(candidate.sceneId)
    ? candidate.sceneId
    : 'pleasant_sunny';

  const latitude = Number.isFinite(Number(candidate.latitude))
    ? Number(Number(candidate.latitude).toFixed(5))
    : 0;
  const longitude = Number.isFinite(Number(candidate.longitude))
    ? Number(Number(candidate.longitude).toFixed(5))
    : 0;
  const feelsLikeC = Number.isFinite(Number(candidate.feelsLikeC))
    ? Math.round(Number(candidate.feelsLikeC))
    : Math.round(temperatureC);

  const hourlyMiniRaw = Array.isArray(candidate.hourlyMini)
    ? candidate.hourlyMini.slice(0, 8)
    : [];
  const hourlyMini = hourlyMiniRaw.map((pt, idx) => ({
    hourLabel: String(pt?.hourLabel ?? `+${idx + 1}h`).slice(0, 16),
    tempC: Number.isFinite(Number(pt?.tempC)) ? Math.round(Number(pt.tempC)) : Math.round(temperatureC),
    precipProbPct: Number.isFinite(Number(pt?.precipProbPct))
      ? Math.max(0, Math.min(100, Math.round(Number(pt.precipProbPct))))
      : 0,
  }));

  const rainAheadHours =
    typeof candidate.rainAheadHours === 'number' && Number.isFinite(candidate.rainAheadHours)
      ? Math.max(0, Math.round(candidate.rainAheadHours))
      : null;

  return {
    gender,
    characterNameVi:
      String(candidate.characterNameVi ?? '').trim() ||
      (gender === 'female' ? 'Cô bé Nắng' : 'Cậu bé Mây'),
    sceneId,
    locationName: locationName.slice(0, 120),
    latitude,
    longitude,
    temperatureC: Math.round(temperatureC),
    feelsLikeC,
    conditionText: String(candidate.conditionText ?? '').trim().slice(0, 160),
    headlineVi: String(candidate.headlineVi ?? '').trim().slice(0, 160),
    outfitAdviceVi: String(candidate.outfitAdviceVi ?? '').trim().slice(0, 240),
    badgeVi: String(candidate.badgeVi ?? '').trim().slice(0, 120),
    hasRainAheadProp: Boolean(candidate.hasRainAheadProp),
    rainAheadHours,
    hasAqiMask: Boolean(candidate.hasAqiMask),
    skyTheme: String(candidate.skyTheme ?? 'day_sunny').trim().slice(0, 40),
    updatedAtIso:
      typeof candidate.updatedAtIso === 'string' && candidate.updatedAtIso.trim()
        ? candidate.updatedAtIso.trim().slice(0, 64)
        : new Date().toISOString(),
    hourlyMini,
  };
}

/**
 * Builds an anonymized telemetry log entry with zero user credentials.
 * Includes both canonical fields and lightweight aliases for dashboard consumption.
 */
export function buildTelemetryEntry({
  snapshot,
  cacheHit,
  latencyMs,
  timestampIso = new Date().toISOString(),
}) {
  const providerUsed = String(snapshot.provider || 'open_meteo');
  const locationName = String(snapshot.locationName || 'Vị trí hiện tại').slice(0, 120);
  const temperatureC = Number.isFinite(snapshot.temperatureC)
    ? Math.round(snapshot.temperatureC * 10) / 10
    : 0;
  const feelsLikeC = Number.isFinite(snapshot.feelsLikeC)
    ? Math.round(snapshot.feelsLikeC * 10) / 10
    : temperatureC;
  const precipProbPct = Number.isFinite(snapshot.precipProbPct)
    ? Math.max(0, Math.min(100, Math.round(snapshot.precipProbPct)))
    : 0;
  const uvIndex = Number.isFinite(snapshot.uvIndex)
    ? Math.round(snapshot.uvIndex * 10) / 10
    : 0;
  const aqi =
    typeof snapshot.aqi === 'number' && Number.isFinite(snapshot.aqi)
      ? Math.round(snapshot.aqi)
      : null;

  return {
    id: crypto.randomUUID(),
    timestampIso,
    timestamp: timestampIso,
    locationName,
    city: locationName,
    latitude: Number(Number(snapshot.latitude || 0).toFixed(4)),
    longitude: Number(Number(snapshot.longitude || 0).toFixed(4)),
    providerUsed,
    provider: providerUsed,
    cacheHit: Boolean(cacheHit),
    latencyMs: Math.max(0, Math.round(latencyMs)),
    temperatureC,
    tempC: temperatureC,
    feelsLikeC,
    precipProbPct,
    uvIndex,
    aqi,
  };
}

export class RuntimeStore {
  constructor(runtimeDir) {
    this.runtimeDir = runtimeDir;
    this.telemetryPath = path.join(runtimeDir, 'telemetry.json');
    this.widgetSyncPath = path.join(runtimeDir, 'widget_sync.json');
    this.telemetryEntries = [];
    this.widgetRecord = null;
    this._writeChain = Promise.resolve();
    this._loadFromDiskSync();
  }

  _loadFromDiskSync() {
    try {
      if (fs.existsSync(this.telemetryPath)) {
        const raw = fs.readFileSync(this.telemetryPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.telemetryEntries = parsed.slice(0, MAX_TELEMETRY_ENTRIES);
        } else if (parsed && Array.isArray(parsed.entries)) {
          this.telemetryEntries = parsed.entries.slice(0, MAX_TELEMETRY_ENTRIES);
        }
      }
    } catch {
      this.telemetryEntries = [];
    }

    try {
      if (fs.existsSync(this.widgetSyncPath)) {
        const raw = fs.readFileSync(this.widgetSyncPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (parsed.payload && typeof parsed.payload === 'object') {
            this.widgetRecord = {
              syncedAtIso: String(parsed.syncedAtIso || new Date().toISOString()),
              payload: sanitizeWidgetSyncPayload(parsed.payload),
            };
          } else if (parsed.locationName) {
            this.widgetRecord = {
              syncedAtIso: String(parsed.updatedAtIso || new Date().toISOString()),
              payload: sanitizeWidgetSyncPayload(parsed),
            };
          }
        }
      }
    } catch {
      this.widgetRecord = null;
    }
  }

  _enqueueWrite(fn) {
    this._writeChain = this._writeChain.then(fn, fn);
    return this._writeChain;
  }

  async _atomicWriteJson(filePath, data) {
    await fsp.mkdir(this.runtimeDir, { recursive: true });
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    const serialized = `${JSON.stringify(data, null, 2)}\n`;
    await fsp.writeFile(tmpPath, serialized, 'utf8');
    await fsp.rename(tmpPath, filePath);
  }

  async recordTelemetry(entry) {
    this.telemetryEntries = [entry, ...this.telemetryEntries].slice(0, MAX_TELEMETRY_ENTRIES);
    const snapshotToPersist = [...this.telemetryEntries];
    await this._enqueueWrite(() =>
      this._atomicWriteJson(this.telemetryPath, {
        updatedAtIso: entry.timestampIso,
        entries: snapshotToPersist,
      })
    );
    return entry;
  }

  getRecentTelemetry(limit = 15) {
    return this.telemetryEntries.slice(0, Math.max(1, Math.min(MAX_TELEMETRY_ENTRIES, limit)));
  }

  async saveWidgetSync(rawPayload) {
    const payload = sanitizeWidgetSyncPayload(rawPayload);
    const syncedAtIso = new Date().toISOString();
    this.widgetRecord = { syncedAtIso, payload };
    const recordSnapshot = { ...this.widgetRecord };
    await this._enqueueWrite(() =>
      this._atomicWriteJson(this.widgetSyncPath, recordSnapshot)
    );
    return recordSnapshot;
  }

  getWidgetSync() {
    return this.widgetRecord;
  }

  async clearWidgetSync() {
    this.widgetRecord = null;
    await this._enqueueWrite(async () => {
      try {
        await fsp.unlink(this.widgetSyncPath);
      } catch {
        // Ignore if file already absent
      }
    });
  }

  async flush() {
    await this._writeChain;
  }
}

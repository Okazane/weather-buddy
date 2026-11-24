import type { WeatherSnapshot, WeatherVerificationMeta } from './types';

export const WEATHER_CONSENSUS_USER_AGENT =
  'WeatherBuddy/3.0 (https://github.com/Okazane/weather-buddy)';
export const DEFAULT_CONSENSUS_TIMEOUT_MS = 2600;
export const DEFAULT_MAX_METAR_DISTANCE_KM = 45;

export interface AirportMetarStation {
  icao: string;
  nameVi: string;
  latitude: number;
  longitude: number;
}

export interface NearbyMetarStation extends AirportMetarStation {
  distanceKm: number;
}

export interface MetarObservation {
  stationIcao: string;
  stationNameVi: string;
  distanceKm: number;
  observedAtIso?: string;
  ageMinutes?: number;
  tempC?: number;
  dewpointC?: number;
  humidityPct?: number;
  windSpeedKmh?: number;
  wxString?: string;
  cloudCover?: string;
  rawOb?: string;
}

export interface MetNorwayObservation {
  observedAtIso?: string;
  tempC?: number;
  humidityPct?: number;
  symbolCode?: string;
  precipNext1hMm?: number;
  cloudAreaFractionPct?: number;
}

export interface WeatherVerificationObservations {
  metar?: MetarObservation | null;
  metNorway?: MetNorwayObservation | null;
  fetchedAtIso?: string;
}

export const VIETNAM_METAR_STATIONS: readonly AirportMetarStation[] = [
  { icao: 'VVTS', nameVi: 'Sân bay Tân Sơn Nhất, TP.HCM', latitude: 10.8188, longitude: 106.6519 },
  { icao: 'VVNB', nameVi: 'Sân bay Nội Bài, Hà Nội', latitude: 21.2212, longitude: 105.8072 },
  { icao: 'VVDN', nameVi: 'Sân bay Đà Nẵng', latitude: 16.0439, longitude: 108.1994 },
  { icao: 'VVCT', nameVi: 'Sân bay Cần Thơ', latitude: 10.0851, longitude: 105.7119 },
  { icao: 'VVCR', nameVi: 'Sân bay Cam Ranh, Khánh Hòa', latitude: 12.0067, longitude: 109.2194 },
  { icao: 'VVPB', nameVi: 'Sân bay Phú Bài, Huế', latitude: 16.4015, longitude: 107.7026 },
  { icao: 'VVCI', nameVi: 'Sân bay Cát Bi, Hải Phòng', latitude: 20.8194, longitude: 106.7250 },
  { icao: 'VVPQ', nameVi: 'Sân bay Phú Quốc', latitude: 10.1698, longitude: 103.9931 },
  { icao: 'VVDL', nameVi: 'Sân bay Liên Khương, Đà Lạt', latitude: 11.7500, longitude: 108.3670 },
  { icao: 'VVVH', nameVi: 'Sân bay Vinh, Nghệ An', latitude: 18.7376, longitude: 105.6708 },
  { icao: 'VVPK', nameVi: 'Sân bay Pleiku', latitude: 14.0045, longitude: 108.0172 },
  { icao: 'VVBM', nameVi: 'Sân bay Buôn Ma Thuột', latitude: 12.6683, longitude: 108.1200 },
  { icao: 'VVTH', nameVi: 'Sân bay Tuy Hòa', latitude: 13.0494, longitude: 109.3336 },
  { icao: 'VVPC', nameVi: 'Sân bay Phù Cát, Quy Nhơn', latitude: 13.9550, longitude: 109.0422 },
  { icao: 'VVDH', nameVi: 'Sân bay Đồng Hới', latitude: 17.5150, longitude: 106.5906 },
  { icao: 'VVTX', nameVi: 'Sân bay Thọ Xuân, Thanh Hóa', latitude: 19.9017, longitude: 105.4678 },
  { icao: 'VVRG', nameVi: 'Sân bay Rạch Giá', latitude: 9.9597, longitude: 105.1339 },
  { icao: 'VVCS', nameVi: 'Sân bay Côn Đảo', latitude: 8.7325, longitude: 106.6328 },
];

function round1(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round(val * 10) / 10;
}

function round2(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round(val * 100) / 100;
}

function clampPct(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.max(0, Math.min(100, Math.round(val)));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371.0;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return round1(R * c);
}

export function findNearestMetarStation(
  lat: number,
  lon: number,
  maxDistanceKm: number = DEFAULT_MAX_METAR_DISTANCE_KM
): NearbyMetarStation | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  let best: NearbyMetarStation | null = null;
  for (const station of VIETNAM_METAR_STATIONS) {
    const dist = haversineDistanceKm(lat, lon, station.latitude, station.longitude);
    if (dist <= maxDistanceKm && (!best || dist < best.distanceKm)) {
      best = { ...station, distanceKm: dist };
    }
  }
  return best;
}

/**
 * Computes relative humidity (%) from temperature (°C) and dewpoint (°C)
 * using the August-Roche-Magnus approximation.
 */
export function computeMagnusHumidityPct(tempC: number, dewpointC: number): number {
  if (!Number.isFinite(tempC) || !Number.isFinite(dewpointC)) {
    return 70;
  }
  const a = 17.625;
  const b = 243.04;
  const num = Math.exp((a * dewpointC) / (b + dewpointC));
  const den = Math.exp((a * tempC) / (b + tempC));
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) {
    return 70;
  }
  return Math.max(5, Math.min(100, Math.round((100 * num) / den)));
}

function getProviderDisplayLabel(provider: WeatherSnapshot['provider']): string {
  switch (provider) {
    case 'open_meteo':
      return 'Open-Meteo';
    case 'tomorrow_io':
      return 'Tomorrow.io';
    case 'weatherapi':
      return 'WeatherAPI';
    case 'google':
      return 'Google Weather';
    case 'demo':
      return 'Demo';
    default:
      return String(provider);
  }
}

const CLOUD_COVER_RANK: Record<string, number> = {
  CLR: 0,
  SKC: 0,
  CAVOK: 0,
  FEW: 1,
  SCT: 2,
  BKN: 3,
  OVC: 4,
};

function resolveMetarCloudCover(item: Record<string, unknown>): string | undefined {
  const direct =
    typeof item.cover === 'string' && item.cover.trim()
      ? item.cover.trim().toUpperCase()
      : undefined;
  if (direct && direct in CLOUD_COVER_RANK) {
    return direct;
  }

  let highest: string | undefined;
  let highestRank = -1;
  if (Array.isArray(item.clouds)) {
    for (const layer of item.clouds) {
      if (layer && typeof layer === 'object' && typeof (layer as Record<string, unknown>).cover === 'string') {
        const cov = String((layer as Record<string, unknown>).cover).trim().toUpperCase();
        const rank = CLOUD_COVER_RANK[cov] ?? -1;
        if (rank > highestRank) {
          highestRank = rank;
          highest = cov;
        }
      }
    }
  }
  if (highest) {
    return highest;
  }

  if (typeof item.rawOb === 'string') {
    const raw = item.rawOb.toUpperCase();
    if (/\bCAVOK\b/.test(raw) || /\bSKC\b/.test(raw) || /\bCLR\b/.test(raw)) return 'CLR';
    if (/\bOVC\d{3}\b/.test(raw)) return 'OVC';
    if (/\bBKN\d{3}\b/.test(raw)) return 'BKN';
    if (/\bSCT\d{3}\b/.test(raw)) return 'SCT';
    if (/\bFEW\d{3}\b/.test(raw)) return 'FEW';
  }

  return direct;
}

function mapCloudCoverToConditionVi(cloudCover: string | undefined, isDay: boolean): string {
  const cov = (cloudCover ?? '').toUpperCase();
  if (cov === 'FEW' || cov === 'CLR' || cov === 'SKC' || cov === 'CAVOK') {
    return isDay ? 'Trời nắng quang đãng' : 'Đêm quang đãng';
  }
  if (cov === 'SCT') {
    return 'Có mây rải rác';
  }
  if (cov === 'BKN' || cov === 'OVC') {
    return 'Trời nhiều mây';
  }
  return isDay ? 'Có mây rải rác' : 'Đêm ít mây';
}

export function parseMetarPayload(
  rawJson: unknown,
  station: AirportMetarStation,
  distanceKm: number,
  nowMs: number = Date.now()
): MetarObservation | null {
  const record = Array.isArray(rawJson) ? rawJson[0] : rawJson;
  if (!record || typeof record !== 'object') {
    return null;
  }
  const item = record as Record<string, unknown>;

  let observedAtIso: string | undefined;
  let ageMinutes: number | undefined;

  if (typeof item.reportTime === 'string' && item.reportTime.trim()) {
    const parsed = Date.parse(item.reportTime);
    if (Number.isFinite(parsed)) {
      observedAtIso = new Date(parsed).toISOString();
      ageMinutes = Math.max(0, round1((nowMs - parsed) / 60_000));
    }
  } else if (typeof item.obsTime === 'number' && Number.isFinite(item.obsTime)) {
    const obsMs = item.obsTime > 1e12 ? item.obsTime : item.obsTime * 1000;
    observedAtIso = new Date(obsMs).toISOString();
    ageMinutes = Math.max(0, round1((nowMs - obsMs) / 60_000));
  }

  const tempC =
    typeof item.temp === 'number' && Number.isFinite(item.temp) ? round1(item.temp) : undefined;
  const dewpointC =
    typeof item.dewp === 'number' && Number.isFinite(item.dewp) ? round1(item.dewp) : undefined;
  const humidityPct =
    tempC !== undefined && dewpointC !== undefined
      ? computeMagnusHumidityPct(tempC, dewpointC)
      : undefined;
  const windSpeedKmh =
    typeof item.wspd === 'number' && Number.isFinite(item.wspd)
      ? round1(Math.max(0, item.wspd * 1.852))
      : undefined;

  const wxString =
    typeof item.wxString === 'string' && item.wxString.trim().length > 0
      ? item.wxString.trim()
      : undefined;
  const cloudCover = resolveMetarCloudCover(item);
  const rawOb =
    typeof item.rawOb === 'string' && item.rawOb.trim().length > 0
      ? item.rawOb.trim()
      : undefined;

  const stationIcao =
    typeof item.icaoId === 'string' && item.icaoId.trim()
      ? item.icaoId.trim().toUpperCase()
      : station.icao;

  return {
    stationIcao,
    stationNameVi: station.nameVi,
    distanceKm: round1(distanceKm),
    ...(observedAtIso ? { observedAtIso } : {}),
    ...(ageMinutes !== undefined ? { ageMinutes } : {}),
    ...(tempC !== undefined ? { tempC } : {}),
    ...(dewpointC !== undefined ? { dewpointC } : {}),
    ...(humidityPct !== undefined ? { humidityPct } : {}),
    ...(windSpeedKmh !== undefined ? { windSpeedKmh } : {}),
    ...(wxString ? { wxString } : {}),
    ...(cloudCover ? { cloudCover } : {}),
    ...(rawOb ? { rawOb } : {}),
  };
}

export function parseMetNorwayPayload(
  rawJson: unknown,
  nowMs: number = Date.now()
): MetNorwayObservation | null {
  if (!rawJson || typeof rawJson !== 'object') {
    return null;
  }
  const properties = (rawJson as Record<string, unknown>).properties;
  if (!properties || typeof properties !== 'object') {
    return null;
  }
  const timeseries = (properties as Record<string, unknown>).timeseries;
  if (!Array.isArray(timeseries) || timeseries.length === 0) {
    return null;
  }

  // Pick the entry closest to nowMs (preferring within +-60 minutes of now)
  let bestEntry = timeseries[0] as Record<string, unknown>;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let i = 0; i < Math.min(timeseries.length, 6); i += 1) {
    const candidate = timeseries[i] as Record<string, unknown>;
    const ts = typeof candidate?.time === 'string' ? Date.parse(candidate.time) : Number.NaN;
    if (Number.isFinite(ts)) {
      const diff = Math.abs(nowMs - ts);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestEntry = candidate;
      }
    }
  }

  const data = (bestEntry?.data ?? {}) as Record<string, unknown>;
  const instantDetails = ((data.instant as Record<string, unknown> | undefined)?.details ??
    {}) as Record<string, unknown>;
  const next1h = (data.next_1_hours ?? {}) as Record<string, unknown>;
  const next1hSummary = (next1h.summary ?? {}) as Record<string, unknown>;
  const next1hDetails = (next1h.details ?? {}) as Record<string, unknown>;

  const tempC =
    typeof instantDetails.air_temperature === 'number' &&
    Number.isFinite(instantDetails.air_temperature)
      ? round1(instantDetails.air_temperature)
      : undefined;
  const humidityPct =
    typeof instantDetails.relative_humidity === 'number' &&
    Number.isFinite(instantDetails.relative_humidity)
      ? clampPct(instantDetails.relative_humidity)
      : undefined;
  const cloudAreaFractionPct =
    typeof instantDetails.cloud_area_fraction === 'number' &&
    Number.isFinite(instantDetails.cloud_area_fraction)
      ? clampPct(instantDetails.cloud_area_fraction)
      : undefined;
  const symbolCode =
    typeof next1hSummary.symbol_code === 'string' && next1hSummary.symbol_code.trim()
      ? next1hSummary.symbol_code.trim()
      : undefined;
  const precipNext1hMm =
    typeof next1hDetails.precipitation_amount === 'number' &&
    Number.isFinite(next1hDetails.precipitation_amount)
      ? Math.max(0, round2(next1hDetails.precipitation_amount))
      : undefined;

  if (
    tempC === undefined &&
    humidityPct === undefined &&
    symbolCode === undefined &&
    precipNext1hMm === undefined
  ) {
    return null;
  }

  return {
    ...(typeof bestEntry?.time === 'string' ? { observedAtIso: bestEntry.time } : {}),
    ...(tempC !== undefined ? { tempC } : {}),
    ...(humidityPct !== undefined ? { humidityPct } : {}),
    ...(symbolCode ? { symbolCode } : {}),
    ...(precipNext1hMm !== undefined ? { precipNext1hMm } : {}),
    ...(cloudAreaFractionPct !== undefined ? { cloudAreaFractionPct } : {}),
  };
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit | undefined,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<unknown | null> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(url, {
      ...init,
      signal: controller ? controller.signal : init?.signal,
    });
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch {
    return null;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

const inFlightSecondaryRequests = new Map<string, Promise<WeatherVerificationObservations>>();

export async function fetchSecondaryWeatherSources(
  lat: number,
  lon: number,
  options: {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    nowMs?: number;
    browserVerifyBaseUrl?: string;
    forceDirectUpstream?: boolean;
  } = {}
): Promise<WeatherVerificationObservations> {
  const {
    fetchImpl = fetch,
    timeoutMs = DEFAULT_CONSENSUS_TIMEOUT_MS,
    nowMs = Date.now(),
    browserVerifyBaseUrl,
    forceDirectUpstream = false,
  } = options;

  const isBrowser =
    !forceDirectUpstream && typeof window !== 'undefined' && typeof document !== 'undefined';

  const canCoalesce = fetchImpl === globalThis.fetch && Number.isFinite(lat) && Number.isFinite(lon);
  const flightKey = canCoalesce
    ? `${isBrowser ? 'b' : 's'}:${lat.toFixed(2)},${lon.toFixed(2)}:${browserVerifyBaseUrl ?? ''}`
    : '';

  if (flightKey) {
    const existing = inFlightSecondaryRequests.get(flightKey);
    if (existing) {
      return existing;
    }
  }

  const runFetch = async (): Promise<WeatherVerificationObservations> => {
    if (isBrowser) {
      const base =
        browserVerifyBaseUrl !== undefined
          ? browserVerifyBaseUrl
          : window.location?.port === '8787'
            ? ''
            : 'http://localhost:8787';
      const url = `${base}/api/weather-verify?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
      const body = (await fetchJsonWithTimeout(
        url,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'X-WeatherBuddy-Client': 'weatherbuddy-ui',
          },
        },
        fetchImpl,
        timeoutMs
      )) as Record<string, unknown> | null;

      if (!body || typeof body !== 'object') {
        return { metar: null, metNorway: null, fetchedAtIso: new Date(nowMs).toISOString() };
      }

      return {
        metar: (body.metar as MetarObservation | null | undefined) ?? null,
        metNorway: (body.metNorway as MetNorwayObservation | null | undefined) ?? null,
        fetchedAtIso:
          typeof body.fetchedAtIso === 'string'
            ? body.fetchedAtIso
            : new Date(nowMs).toISOString(),
      };
    }

    // Node / Server runtime: query NOAA Aviation METAR & MET Norway ECMWF directly in parallel
    const nearestStation = findNearestMetarStation(lat, lon, DEFAULT_MAX_METAR_DISTANCE_KM);

    const metarPromise: Promise<MetarObservation | null> = nearestStation
      ? fetchJsonWithTimeout(
          `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(nearestStation.icao)}&format=json`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              'User-Agent': WEATHER_CONSENSUS_USER_AGENT,
            },
          },
          fetchImpl,
          timeoutMs
        ).then((payload) =>
          payload ? parseMetarPayload(payload, nearestStation, nearestStation.distanceKm, nowMs) : null
        )
      : Promise.resolve(null);

    const metNoUrl = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
    const metNoPromise: Promise<MetNorwayObservation | null> = fetchJsonWithTimeout(
      metNoUrl,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': WEATHER_CONSENSUS_USER_AGENT,
        },
      },
      fetchImpl,
      timeoutMs
    ).then((payload) => (payload ? parseMetNorwayPayload(payload, nowMs) : null));

    const [metarResult, metNoResult] = await Promise.allSettled([metarPromise, metNoPromise]);

    return {
      metar: metarResult.status === 'fulfilled' ? metarResult.value : null,
      metNorway: metNoResult.status === 'fulfilled' ? metNoResult.value : null,
      fetchedAtIso: new Date(nowMs).toISOString(),
    };
  };

  if (!flightKey) {
    return runFetch();
  }

  const trackedPromise = runFetch().finally(() => {
    if (inFlightSecondaryRequests.get(flightKey) === trackedPromise) {
      inFlightSecondaryRequests.delete(flightKey);
    }
  });
  inFlightSecondaryRequests.set(flightKey, trackedPromise);
  return trackedPromise;
}

function resolveAgeMinutes(
  obs: MetarObservation | null | undefined,
  nowMs: number
): number | undefined {
  if (!obs) return undefined;
  if (typeof obs.ageMinutes === 'number' && Number.isFinite(obs.ageMinutes)) {
    return Math.max(0, obs.ageMinutes);
  }
  if (obs.observedAtIso) {
    const parsed = Date.parse(obs.observedAtIso);
    if (Number.isFinite(parsed)) {
      return Math.max(0, round1((nowMs - parsed) / 60_000));
    }
  }
  return undefined;
}

function hasAnyPrecipOrConvectiveToken(wxString?: string): boolean {
  if (!wxString) return false;
  return /(RA|DZ|TS|SH)/i.test(wxString);
}

function classifyActiveMetarPrecip(
  wxString?: string
): 'thunderstorm_rain' | 'thunderstorm_dry' | 'light_rain' | null {
  if (!wxString) return null;
  const trimmed = wxString.trim();
  if (!trimmed) return null;

  const hasTs = /TS/i.test(trimmed);
  // Exclude pure vicinity tokens like VCSH when checking precipitation overhead at station
  const overheadTokens = trimmed.split(/\s+/).filter((tok) => !/^VC/i.test(tok));

  const hasRaOrSh = overheadTokens.some((tok) => /(RA|SH)/i.test(tok));
  const hasHeavyRain = overheadTokens.some((tok) => /^\+(?:TS|SH|FZ)*(?:RA|DZ)/i.test(tok));
  const hasLightOrModRain = overheadTokens.some((tok) =>
    /^[+-]?(?:TS|SH|FZ)*(?:RA|DZ|SH)+$/i.test(tok)
  );

  if ((hasTs && hasRaOrSh) || hasHeavyRain) {
    return 'thunderstorm_rain';
  }
  if (hasTs) {
    return 'thunderstorm_dry';
  }
  if (hasLightOrModRain) {
    return 'light_rain';
  }
  return null;
}

/**
 * Reconciles a primary WeatherSnapshot with secondary physical ground-station METAR
 * observations and MET Norway ECMWF model forecasts using strict meteorological rules.
 */
export function reconcileWeatherConsensus(
  snapshot: WeatherSnapshot,
  observations: WeatherVerificationObservations,
  options: { nowMs?: number } = {}
): WeatherSnapshot {
  const nowMs = options.nowMs ?? Date.now();
  const metar = observations.metar ?? null;
  const metNorway = observations.metNorway ?? null;

  const metarAgeMin = resolveAgeMinutes(metar, nowMs);
  const metarFreshForDryCheck =
    Boolean(metar) &&
    (metar!.distanceKm ?? Infinity) <= 45 &&
    (metarAgeMin === undefined || metarAgeMin <= 95);
  const metarFreshForDryProbCap =
    Boolean(metar) &&
    (metar!.distanceKm ?? Infinity) <= 35 &&
    (metarAgeMin === undefined || metarAgeMin <= 95);
  const metarFreshForRainDetect =
    Boolean(metar) &&
    (metar!.distanceKm ?? Infinity) <= 35 &&
    (metarAgeMin === undefined || metarAgeMin <= 75);
  const metarFreshForCalibration =
    Boolean(metar) &&
    (metar!.distanceKm ?? Infinity) <= 35 &&
    (metarAgeMin === undefined || metarAgeMin <= 90);

  let temperatureC = snapshot.temperatureC;
  let feelsLikeC = snapshot.feelsLikeC;
  let humidityPct = snapshot.humidityPct;
  let precipMmPerHr = snapshot.precipMmPerHr;
  let precipProbPct = snapshot.precipProbPct;
  let conditionText = snapshot.conditionText;
  let reconciledRainAdjusted = false;

  // Rule 1: False-Positive Grid Drizzle Suppression (Open-Meteo numerical drizzle bias)
  const claimsLightDrizzle =
    snapshot.provider === 'open_meteo' &&
    ((snapshot.precipMmPerHr >= 0.1 && snapshot.precipMmPerHr <= 1.5) ||
      snapshot.conditionText.includes('Mưa phùn') ||
      snapshot.conditionText.includes('Mưa nhỏ'));

  if (claimsLightDrizzle && metarFreshForDryCheck && metar) {
    const metarDry = !hasAnyPrecipOrConvectiveToken(metar.wxString);
    const metNoDry =
      metNorway !== null &&
      typeof metNorway.precipNext1hMm === 'number' &&
      metNorway.precipNext1hMm < 0.2;
    const closeMetarDryAlone =
      metarDry && metar.distanceKm < 25 && snapshot.precipMmPerHr <= 0.6;

    if ((metarDry && metNoDry) || closeMetarDryAlone) {
      precipMmPerHr = 0;
      precipProbPct = Math.min(snapshot.precipProbPct, 35);
      conditionText = mapCloudCoverToConditionVi(metar.cloudCover, snapshot.isDay);
      reconciledRainAdjusted = true;
    }
  }

  // Rule 1b: Dry METAR Current-Hour Rain Probability Cap (prevents precipProbPct >= 50 false rain when precipMmPerHr == 0)
  if (
    !reconciledRainAdjusted &&
    metarFreshForDryProbCap &&
    metar &&
    !hasAnyPrecipOrConvectiveToken(metar.wxString) &&
    snapshot.precipMmPerHr < 0.2
  ) {
    const metNoPrecipMm = metNorway?.precipNext1hMm;
    if (metNoPrecipMm === undefined || metNoPrecipMm <= 0.3 || metar.distanceKm <= 15) {
      if (snapshot.precipProbPct > 38) {
        precipProbPct = Math.min(snapshot.precipProbPct, 38);
        reconciledRainAdjusted = true;
      }
      const cov = (metar.cloudCover ?? '').toUpperCase();
      if (cov === 'BKN' || cov === 'OVC') {
        conditionText = 'Trời nhiều mây';
      } else if (cov === 'SCT') {
        conditionText = 'Có mây rải rác';
      } else if (/(mưa|dông|rain|drizzle|shower)/i.test(conditionText)) {
        conditionText = mapCloudCoverToConditionVi(metar.cloudCover, snapshot.isDay);
      }
    }
  }

  // Rule 2: Real-Time METAR Active Weather Overrides (thunderstorm / heavy rain / missed ground rain)
  if (!reconciledRainAdjusted && metarFreshForRainDetect && metar) {
    const activeRain = classifyActiveMetarPrecip(metar.wxString);
    if (activeRain === 'thunderstorm_rain') {
      precipMmPerHr = Math.max(snapshot.precipMmPerHr, 6.0);
      precipProbPct = Math.max(snapshot.precipProbPct, 88);
      conditionText = /TS/i.test(metar.wxString ?? '')
        ? 'Mưa dông kèm gió giật'
        : 'Mưa to nặng hạt';
      reconciledRainAdjusted = true;
    } else if (activeRain === 'thunderstorm_dry') {
      if (snapshot.precipMmPerHr < 4.5) {
        precipMmPerHr = Math.max(snapshot.precipMmPerHr, 1.8);
        precipProbPct = Math.max(snapshot.precipProbPct, 82);
        conditionText = 'Có dông rải rác';
        reconciledRainAdjusted = true;
      }
    } else if (activeRain === 'light_rain' && snapshot.precipMmPerHr < 0.2) {
      precipMmPerHr = Math.max(snapshot.precipMmPerHr, 1.2);
      precipProbPct = Math.max(snapshot.precipProbPct, 72);
      conditionText = 'Mưa nhỏ rải rác';
      reconciledRainAdjusted = true;
    }
  }

  // Rule 3: Physical Thermometer & Humidity Calibration
  // Guard highland cities (>15 km from valley/coastal airports, e.g. Đà Lạt 1500m vs VVDL 962m)
  // when both 3D terrain models (Open-Meteo & MET Norway) agree closely against a >=3.2°C lapse-rate offset.
  const isOrographicValleyOffset =
    Boolean(metar) &&
    metar!.distanceKm > 15 &&
    typeof metar!.tempC === 'number' &&
    metNorway !== null &&
    typeof metNorway.tempC === 'number' &&
    Number.isFinite(metNorway.tempC) &&
    Math.abs(metNorway.tempC - snapshot.temperatureC) <= 2.0 &&
    Math.abs(metar!.tempC - snapshot.temperatureC) >= 3.2;

  if (
    !isOrographicValleyOffset &&
    metarFreshForCalibration &&
    metar &&
    typeof metar.tempC === 'number' &&
    Number.isFinite(metar.tempC)
  ) {
    const isCloseFreshMetar =
      metar.distanceKm <= 18 && (metarAgeMin === undefined || metarAgeMin <= 75);
    const metarTempWeight = isCloseFreshMetar ? 0.8 : 0.65;
    const maxTempDelta = isCloseFreshMetar ? 5.5 : 3.5;

    const blendedTarget =
      metarTempWeight * metar.tempC + (1 - metarTempWeight) * snapshot.temperatureC;
    const rawDelta = blendedTarget - snapshot.temperatureC;
    const clampedDelta = round1(Math.max(-maxTempDelta, Math.min(maxTempDelta, rawDelta)));
    temperatureC = round1(snapshot.temperatureC + clampedDelta);
    feelsLikeC = round1(snapshot.feelsLikeC + clampedDelta);

    const metarHum =
      typeof metar.humidityPct === 'number' && Number.isFinite(metar.humidityPct)
        ? metar.humidityPct
        : typeof metar.dewpointC === 'number' && Number.isFinite(metar.dewpointC)
          ? computeMagnusHumidityPct(metar.tempC, metar.dewpointC)
          : undefined;
    if (metarHum !== undefined) {
      humidityPct = clampPct(0.65 * metarHum + 0.35 * snapshot.humidityPct);
    }
  } else if (
    metNorway &&
    typeof metNorway.tempC === 'number' &&
    Number.isFinite(metNorway.tempC) &&
    Math.abs(metNorway.tempC - snapshot.temperatureC) <= 4.0
  ) {
    const blendedTemp = round1(0.65 * snapshot.temperatureC + 0.35 * metNorway.tempC);
    const deltaTemp = round1(blendedTemp - snapshot.temperatureC);
    temperatureC = blendedTemp;
    feelsLikeC = round1(snapshot.feelsLikeC + deltaTemp);

    if (typeof metNorway.humidityPct === 'number' && Number.isFinite(metNorway.humidityPct)) {
      humidityPct = clampPct(0.65 * snapshot.humidityPct + 0.35 * metNorway.humidityPct);
    }
  }

  // Rule 4: Build WeatherVerificationMeta & Vietnamese summary
  const primaryLabel = getProviderDisplayLabel(snapshot.provider);
  const sourcesChecked: string[] = [primaryLabel];
  if (metarFreshForDryCheck && metar) {
    sourcesChecked.push(`NOAA METAR (${metar.stationIcao})`);
  }
  if (metNorway) {
    sourcesChecked.push('MET Norway');
  }

  let consensusLevel: WeatherVerificationMeta['consensusLevel'];
  let confidencePct: number;
  let summaryVi: string;

  if (metarFreshForDryCheck && metar && metNorway) {
    consensusLevel = 'verified_multi_source';
    const tempAgree =
      metar.tempC === undefined || Math.abs(metar.tempC - snapshot.temperatureC) <= 2.5;
    confidencePct = reconciledRainAdjusted ? 90 : tempAgree ? 96 : 92;
    summaryVi = `Đã đối chiếu 3 nguồn: ${primaryLabel} · Trạm sân bay ${metar.stationIcao} (${metar.distanceKm.toFixed(1)} km) · MET Norway`;
  } else if (metarFreshForDryCheck && metar) {
    consensusLevel = 'verified_multi_source';
    const closeStation = metar.distanceKm <= 20;
    confidencePct = reconciledRainAdjusted ? 86 : closeStation ? 92 : 88;
    summaryVi = `Đã đối chiếu ${primaryLabel} · Trạm sân bay ${metar.stationIcao} (${metar.distanceKm.toFixed(1)} km)`;
  } else if (metNorway) {
    consensusLevel = 'model_consensus';
    const tempClose =
      metNorway.tempC === undefined || Math.abs(metNorway.tempC - snapshot.temperatureC) <= 2.5;
    const rainAgree =
      metNorway.precipNext1hMm === undefined ||
      (snapshot.precipMmPerHr >= 0.2) === (metNorway.precipNext1hMm >= 0.2);
    confidencePct = tempClose && rainAgree ? 86 : 80;
    summaryVi = `Đã đối chiếu ${primaryLabel} & MET Norway`;
  } else {
    consensusLevel = 'single_source';
    confidencePct = snapshot.provider === 'open_meteo' ? 72 : 80;
    summaryVi = `Dữ liệu đơn nguồn từ ${primaryLabel}`;
  }

  const verification: WeatherVerificationMeta = {
    primarySource: snapshot.provider,
    sourcesChecked,
    consensusLevel,
    confidencePct,
    summaryVi,
  };

  if (metarFreshForDryCheck && metar) {
    verification.metarStationIcao = metar.stationIcao;
    verification.metarStationNameVi = metar.stationNameVi;
    verification.metarDistanceKm = metar.distanceKm;
    if (metar.observedAtIso) {
      verification.metarObservedAtIso = metar.observedAtIso;
    }
    if (metar.tempC !== undefined) {
      verification.metarTempC = metar.tempC;
    }
    if (metar.wxString) {
      verification.metarWxString = metar.wxString;
    }
  }

  if (metNorway) {
    if (metNorway.symbolCode) {
      verification.metNoSymbolCode = metNorway.symbolCode;
    }
    if (metNorway.precipNext1hMm !== undefined) {
      verification.metNoPrecipMm = metNorway.precipNext1hMm;
    }
  }

  if (reconciledRainAdjusted) {
    verification.reconciledRainAdjusted = true;
  }

  return {
    ...snapshot,
    temperatureC,
    feelsLikeC,
    humidityPct,
    precipMmPerHr,
    precipProbPct,
    conditionText,
    verification,
  };
}

export async function crossValidateWeatherSnapshot(
  snapshot: WeatherSnapshot,
  options: {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    nowMs?: number;
    browserVerifyBaseUrl?: string;
    forceDirectUpstream?: boolean;
  } = {}
): Promise<WeatherSnapshot> {
  try {
    const observations = await fetchSecondaryWeatherSources(
      snapshot.latitude,
      snapshot.longitude,
      options
    );
    return reconcileWeatherConsensus(snapshot, observations, { nowMs: options.nowMs });
  } catch {
    return reconcileWeatherConsensus(
      snapshot,
      { metar: null, metNorway: null },
      { nowMs: options.nowMs }
    );
  }
}

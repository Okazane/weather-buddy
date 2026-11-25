/**
 * Pure, zero-dependency NOAA solar declination + equation-of-time calculator
 * to resolve accurate sunrise, sunset, and `isDay` status for any coordinate
 * and timestamp when an upstream weather provider omits `is_day` / `isDaytime`
 * (e.g. Tomorrow.io timelines, or Google Weather v1 Proto3 omitting `false` booleans).
 */

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function parseIsoOffsetSeconds(isoTime: string | undefined): number | undefined {
  if (!isoTime) return undefined;
  const match = isoTime.match(/([+-])(\d{2}):?(\d{2})$/);
  if (!match) return undefined;
  const sign = match[1] === '-' ? -1 : 1;
  const hh = Number(match[2]);
  const mm = Number(match[3]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return undefined;
  return sign * (hh * 3600 + mm * 60);
}

export function inferAstronomicalDaytime(
  isoTime: string | undefined,
  lat: number,
  lon: number,
  explicitUtcOffsetSeconds?: number
): boolean {
  const safeLat = Number.isFinite(lat) ? Math.max(-89.5, Math.min(89.5, lat)) : 0;
  const safeLon = Number.isFinite(lon) ? lon : 0;
  const isVietnamCoords =
    safeLat >= 8 && safeLat <= 24 && safeLon >= 102 && safeLon <= 110.5;

  const parsedOffsetSec =
    typeof explicitUtcOffsetSeconds === 'number' && Number.isFinite(explicitUtcOffsetSeconds)
      ? explicitUtcOffsetSeconds
      : parseIsoOffsetSeconds(isoTime);

  const offsetSeconds =
    parsedOffsetSec ?? (isVietnamCoords ? 7 * 3600 : Math.round(safeLon / 15) * 3600);

  const parsedMs = isoTime ? Date.parse(isoTime) : Number.NaN;
  const utcMs = Number.isFinite(parsedMs) ? parsedMs : Date.now();
  const localShifted = new Date(utcMs + offsetSeconds * 1000);

  const localHour =
    localShifted.getUTCHours() +
    localShifted.getUTCMinutes() / 60 +
    localShifted.getUTCSeconds() / 3600;

  const yearStartMs = Date.UTC(localShifted.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.max(
    1,
    Math.min(366, Math.floor((localShifted.getTime() - yearStartMs) / 86_400_000))
  );

  // Fractional year angle & NOAA solar declination / Equation of Time
  const bRad = toRad(((360 / 365) * (dayOfYear - 81)));
  const eotMinutes =
    9.87 * Math.sin(2 * bRad) - 7.53 * Math.cos(bRad) - 1.5 * Math.sin(bRad);
  const declRad = toRad(-23.44 * Math.cos(toRad((360 / 365) * (dayOfYear + 10))));
  const latRad = toRad(safeLat);

  // Standard sunrise/sunset zenith 90.833° (altitude -0.833° including refraction)
  const sinAlt = Math.sin(toRad(-0.833));
  const denom = Math.cos(latRad) * Math.cos(declRad);
  const cosHourAngle =
    Math.abs(denom) < 1e-6
      ? 0
      : (sinAlt - Math.sin(latRad) * Math.sin(declRad)) / denom;

  if (cosHourAngle >= 1) {
    return false; // Polar night
  }
  if (cosHourAngle <= -1) {
    return true; // Midnight sun
  }

  const halfDayHours = toDeg(Math.acos(cosHourAngle)) / 15;
  const tzMeridianDeg = (offsetSeconds / 3600) * 15;
  const lonCorrectionHours = Math.max(-2, Math.min(2, (tzMeridianDeg - safeLon) / 15));
  const solarNoonHour = 12 + lonCorrectionHours - eotMinutes / 60;

  const sunriseHour = solarNoonHour - halfDayHours;
  const sunsetHour = solarNoonHour + halfDayHours;

  return localHour >= sunriseHour && localHour < sunsetHour;
}

export interface SolarAndMoonCycle {
  sunriseTimeVi: string;
  sunsetTimeVi: string;
  dayLengthHours: number;
  moonPhaseVi: string;
  moonIlluminationPct: number;
}

function formatHourClockVi(decimalHour: number): string {
  const wrapped = ((decimalHour % 24) + 24) % 24;
  let hh = Math.floor(wrapped);
  let mm = Math.round((wrapped - hh) * 60);
  if (mm >= 60) {
    mm = 0;
    hh = (hh + 1) % 24;
  }
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function computeSolarAndMoonCycle(
  isoTime: string | undefined,
  lat: number,
  lon: number,
  explicitUtcOffsetSeconds?: number
): SolarAndMoonCycle {
  const safeLat = Number.isFinite(lat) ? Math.max(-89.5, Math.min(89.5, lat)) : 0;
  const safeLon = Number.isFinite(lon) ? lon : 0;
  const isVietnamCoords =
    safeLat >= 8 && safeLat <= 24 && safeLon >= 102 && safeLon <= 110.5;

  const parsedOffsetSec =
    typeof explicitUtcOffsetSeconds === 'number' && Number.isFinite(explicitUtcOffsetSeconds)
      ? explicitUtcOffsetSeconds
      : parseIsoOffsetSeconds(isoTime);

  const offsetSeconds =
    parsedOffsetSec ?? (isVietnamCoords ? 7 * 3600 : Math.round(safeLon / 15) * 3600);

  const parsedMs = isoTime ? Date.parse(isoTime) : Number.NaN;
  const utcMs = Number.isFinite(parsedMs) ? parsedMs : Date.now();
  const localShifted = new Date(utcMs + offsetSeconds * 1000);

  const yearStartMs = Date.UTC(localShifted.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.max(
    1,
    Math.min(366, Math.floor((localShifted.getTime() - yearStartMs) / 86_400_000))
  );

  const bRad = toRad((360 / 365) * (dayOfYear - 81));
  const eotMinutes =
    9.87 * Math.sin(2 * bRad) - 7.53 * Math.cos(bRad) - 1.5 * Math.sin(bRad);
  const declRad = toRad(-23.44 * Math.cos(toRad((360 / 365) * (dayOfYear + 10))));
  const latRad = toRad(safeLat);

  const sinAlt = Math.sin(toRad(-0.833));
  const denom = Math.cos(latRad) * Math.cos(declRad);
  const rawCos =
    Math.abs(denom) < 1e-6
      ? 0
      : (sinAlt - Math.sin(latRad) * Math.sin(declRad)) / denom;
  const clampedCos = Math.max(-0.999, Math.min(0.999, rawCos));

  const halfDayHours = toDeg(Math.acos(clampedCos)) / 15;
  const tzMeridianDeg = (offsetSeconds / 3600) * 15;
  const lonCorrectionHours = Math.max(-2, Math.min(2, (tzMeridianDeg - safeLon) / 15));
  const solarNoonHour = 12 + lonCorrectionHours - eotMinutes / 60;

  const sunriseHour = solarNoonHour - halfDayHours;
  const sunsetHour = solarNoonHour + halfDayHours;

  // Synodic lunar cycle anchored to known New Moon (2000-01-06 18:14 UTC)
  const knownNewMoonMs = Date.UTC(2000, 0, 6, 18, 14, 0);
  const synodicMs = 29.530588853 * 86_400_000;
  const phaseRatio = (((utcMs - knownNewMoonMs) % synodicMs) + synodicMs) / synodicMs;
  const moonIlluminationPct = Math.round((1 - Math.cos(phaseRatio * Math.PI * 2)) * 50);

  let moonPhaseVi = 'Trăng tròn';
  if (phaseRatio < 0.04 || phaseRatio >= 0.96) moonPhaseVi = 'Trăng non';
  else if (phaseRatio < 0.22) moonPhaseVi = 'Trăng lưỡi liềm đầu tháng';
  else if (phaseRatio < 0.28) moonPhaseVi = 'Trăng bán nguyệt đầu tháng';
  else if (phaseRatio < 0.46) moonPhaseVi = 'Trăng khuyết tròn dần';
  else if (phaseRatio < 0.54) moonPhaseVi = 'Trăng tròn';
  else if (phaseRatio < 0.72) moonPhaseVi = 'Trăng khuyết cuối tháng';
  else if (phaseRatio < 0.78) moonPhaseVi = 'Trăng bán nguyệt cuối tháng';
  else moonPhaseVi = 'Trăng lưỡi liềm cuối tháng';

  return {
    sunriseTimeVi: formatHourClockVi(sunriseHour),
    sunsetTimeVi: formatHourClockVi(sunsetHour),
    dayLengthHours: Math.round(halfDayHours * 2 * 10) / 10,
    moonPhaseVi,
    moonIlluminationPct,
  };
}

/**
 * Computes physical Dew Point (°C) via Magnus-Tetens approximation and evaluates
 * Northern Vietnam's "Trời nồm ẩm" floor-condensation risk.
 */
export function computeDewPointC(tempC: number, humidityPct: number): number {
  const safeT = Number.isFinite(tempC) ? tempC : 25;
  const safeRh = Math.max(5, Math.min(100, Number.isFinite(humidityPct) ? humidityPct : 65));
  const a = 17.625;
  const b = 243.04;
  const gamma = Math.log(safeRh / 100) + (a * safeT) / (b + safeT);
  const dp = (b * gamma) / (a - gamma);
  return Math.round(dp * 10) / 10;
}

export interface NomAmAssessment {
  level: 'severe_nom' | 'humid_muggy' | 'comfortable' | 'dry';
  badgeVi: string;
  adviceVi: string;
}

export function evaluateNomAmStatus(
  tempC: number,
  humidityPct: number,
  dewPointC = computeDewPointC(tempC, humidityPct)
): NomAmAssessment {
  const spread = tempC - dewPointC;
  if (humidityPct >= 84 && dewPointC >= 18.5 && spread <= 2.8) {
    return {
      level: 'severe_nom',
      badgeVi: 'Nguy cơ nồm ẩm cao',
      adviceVi: `Điểm sương ${dewPointC.toFixed(1)}°C sát nhiệt độ không khí — nên đóng kín cửa đón gió ẩm và bật hút ẩm / điều hòa Dry.`,
    };
  }
  if (dewPointC >= 23 || humidityPct >= 78) {
    return {
      level: 'humid_muggy',
      badgeVi: 'Ẩm cao dễ bí',
      adviceVi: `Điểm sương ${dewPointC.toFixed(1)}°C khá cao, mồ hôi khó bay hơi — ưu tiên quần áo thoáng khí.`,
    };
  }
  if (humidityPct < 42 || dewPointC < 10) {
    return {
      level: 'dry',
      badgeVi: 'Trời hanh khô',
      adviceVi: `Điểm sương thấp (${dewPointC.toFixed(1)}°C) — không khí hanh khô, chú ý uống đủ nước và dưỡng ẩm da.`,
    };
  }
  return {
    level: 'comfortable',
    badgeVi: 'Khô ráo dễ chịu',
    adviceVi: `Điểm sương ${dewPointC.toFixed(1)}°C ở ngưỡng lý tưởng, không lo nồm ẩm hay hanh khô.`,
  };
}

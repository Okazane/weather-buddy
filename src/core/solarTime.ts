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

function round1(val) {
  if (!Number.isFinite(val)) return 0;
  return Math.round(val * 10) / 10;
}

function round2(val) {
  if (!Number.isFinite(val)) return 0;
  return Math.round(val * 100) / 100;
}

function clampPct(val) {
  if (!Number.isFinite(val)) return 0;
  return Math.max(0, Math.min(100, Math.round(val)));
}

/**
 * Formats an ISO timestamp into a concise local-clock `HH:mm` label while preserving
 * explicit timezone offsets embedded in Open-Meteo / provider ISO strings.
 */
export function formatHourLabelVi(timeIso, fallbackIndex = 0) {
  if (typeof timeIso !== 'string' || !timeIso.trim()) {
    return `+${fallbackIndex + 1}h`;
  }
  const trimmed = timeIso.trim();

  // If the ISO string carries a local offset like 2026-05-15T14:00:00+07:00 or no offset,
  // extract the literal local hour/minute directly so server timezone never shifts it.
  const offsetMatch = trimmed.match(/T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:[+-]\d{2}:?\d{2})?$/);
  if (offsetMatch && !trimmed.endsWith('Z') && !trimmed.endsWith('z')) {
    return `${offsetMatch[1]}:${offsetMatch[2]}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    // Convert UTC timestamps to ICT (+07:00) for Vietnam-centric display consistency
    const ictDate = new Date(parsed.getTime() + 7 * 3600_000);
    const hh = String(ictDate.getUTCHours()).padStart(2, '0');
    const mm = String(ictDate.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  return `+${fallbackIndex + 1}h`;
}

/**
 * Computes a natural Vietnamese human-comfort summary from current snapshot + 24h forecast.
 */
export function computeComfortIndexVi(snapshot, stats) {
  const feelsLike = Number(snapshot?.feelsLikeC ?? snapshot?.temperatureC ?? 26);
  const uv = Number(snapshot?.uvIndex ?? 0);
  const aqi = Number(snapshot?.aqi ?? 0);
  const precipNow = Number(snapshot?.precipMmPerHr ?? 0);
  const windGust = Number(snapshot?.windGustKmh ?? 0);

  if (precipNow >= 4.5 || (stats.maxPrecipProbPct >= 80 && windGust >= 32)) {
    return 'Mưa dông ẩm ướt · Hạn chế di chuyển ngoài trời';
  }
  if (precipNow >= 0.2 || Number(snapshot?.precipProbPct ?? 0) >= 55) {
    return 'Trời mưa ẩm · Nên mang áo mưa hoặc ô gọn';
  }
  if (aqi >= 150) {
    return 'Chất lượng không khí kém · Nên đeo khẩu trang lọc bụi';
  }
  if (feelsLike >= 35 || uv >= 9) {
    return 'Oi bức & tia UV gắt · Cần chống nắng và bù nước';
  }
  if (feelsLike >= 31) {
    return stats.rainHoursCount > 0
      ? 'Nóng ẩm, có khả năng mưa rào · Ưu tiên đồ thoáng & mang sẵn ô'
      : 'Khá nóng ẩm · Ưu tiên trang phục thoáng nhẹ';
  }
  if (feelsLike < 15) {
    return 'Rét đậm vùng cao · Giữ ấm kỹ cổ và cơ thể';
  }
  if (feelsLike < 21) {
    return 'Se lạnh dễ chịu · Khoác nhẹ khi ra ngoài';
  }
  if (stats.rainHoursCount > 0) {
    return 'Mát mẻ nhưng có khung giờ mưa · Nên mang theo ô gọn';
  }
  return 'Dễ chịu thoáng mát · Lý tưởng cho hoạt động ngoài trời';
}

/**
 * Aggregates 24-hour temperature, precipitation, and comfort metrics from a WeatherSnapshot.
 */
export function computeAnalytics24h(snapshot) {
  const rawHourly = Array.isArray(snapshot?.hourly) ? snapshot.hourly.slice(0, 24) : [];

  const fallbackPoint = {
    timeIso: snapshot?.updatedAtIso || new Date().toISOString(),
    temperatureC: round1(Number(snapshot?.temperatureC ?? 26)),
    precipProbPct: clampPct(Number(snapshot?.precipProbPct ?? 0)),
    precipMm: round2(Math.max(0, Number(snapshot?.precipMmPerHr ?? 0))),
    conditionCode: 'PARTLY_CLOUDY',
  };

  const sourceSeries = rawHourly.length > 0 ? rawHourly : [fallbackPoint];

  const hourlySeries = sourceSeries.map((pt, idx) => ({
    timeIso: String(pt?.timeIso || fallbackPoint.timeIso),
    hourLabel: formatHourLabelVi(pt?.timeIso, idx),
    temperatureC: round1(Number(pt?.temperatureC ?? fallbackPoint.temperatureC)),
    precipProbPct: clampPct(Number(pt?.precipProbPct ?? 0)),
    precipMm: round2(Math.max(0, Number(pt?.precipMm ?? 0))),
    conditionCode: String(pt?.conditionCode || 'PARTLY_CLOUDY'),
  }));

  let tempMinC = Infinity;
  let tempMaxC = -Infinity;
  let tempSum = 0;
  let maxPrecipProbPct = 0;
  let totalPrecipMm = 0;
  let rainHoursCount = 0;
  let peakPoint = null;
  let peakScore = -1;

  for (const pt of hourlySeries) {
    if (pt.temperatureC < tempMinC) tempMinC = pt.temperatureC;
    if (pt.temperatureC > tempMaxC) tempMaxC = pt.temperatureC;
    tempSum += pt.temperatureC;

    if (pt.precipProbPct > maxPrecipProbPct) {
      maxPrecipProbPct = pt.precipProbPct;
    }
    totalPrecipMm += pt.precipMm;

    if (pt.precipProbPct >= 50 || pt.precipMm >= 0.2) {
      rainHoursCount += 1;
    }

    const rainScore = pt.precipProbPct + pt.precipMm * 25;
    if (rainScore > peakScore) {
      peakScore = rainScore;
      peakPoint = pt;
    }
  }

  const count = hourlySeries.length || 1;
  const tempAvgC = round1(tempSum / count);
  tempMinC = Number.isFinite(tempMinC) ? round1(tempMinC) : tempAvgC;
  tempMaxC = Number.isFinite(tempMaxC) ? round1(tempMaxC) : tempAvgC;
  totalPrecipMm = round2(totalPrecipMm);

  const hasMeaningfulRainRisk =
    maxPrecipProbPct >= 25 || totalPrecipMm >= 0.1 || rainHoursCount > 0;
  const peakRainHourIso = hasMeaningfulRainRisk && peakPoint ? peakPoint.timeIso : null;
  const peakRainHourLabel = hasMeaningfulRainRisk && peakPoint ? peakPoint.hourLabel : null;

  const stats = {
    tempMinC,
    tempMaxC,
    tempAvgC,
    maxPrecipProbPct,
    totalPrecipMm,
    rainHoursCount,
    peakRainHourIso,
    peakRainHourLabel,
  };

  return {
    ...stats,
    comfortIndexVi: computeComfortIndexVi(snapshot, stats),
    hourlySeries,
  };
}

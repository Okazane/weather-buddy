import type {
  CharacterDecision,
  CharacterSceneId,
  Gender,
  SkyTheme,
  ThermalSensitivity,
  WeatherSnapshot,
} from './types';

/**
 * Accurately resolves the local wall-clock hour (`0..24`, fractional with minutes)
 * at the target weather location so sky palettes synchronize with real local time-of-day.
 */
export function resolveLocationLocalHour(weather: WeatherSnapshot): number {
  // Priority A: Explicit `utcOffsetSeconds` + parseable timestamp
  if (
    typeof weather.utcOffsetSeconds === 'number' &&
    Number.isFinite(weather.utcOffsetSeconds) &&
    weather.updatedAtIso
  ) {
    const parsedMs = Date.parse(weather.updatedAtIso);
    if (Number.isFinite(parsedMs)) {
      const shifted = new Date(parsedMs + weather.utcOffsetSeconds * 1000);
      return shifted.getUTCHours() + shifted.getUTCMinutes() / 60;
    }
  }

  // Priority B: Explicit non-Z timezone offset suffix in ISO string (e.g. +07:00, -05:00)
  if (weather.updatedAtIso) {
    const offsetMatch = weather.updatedAtIso.match(
      /T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?([+-]\d{2}:?\d{2})$/
    );
    if (offsetMatch) {
      const hh = Number(offsetMatch[1]);
      const mm = Number(offsetMatch[2]);
      if (Number.isFinite(hh) && Number.isFinite(mm)) {
        return (((hh + mm / 60) % 24) + 24) % 24;
      }
    }
  }

  // Priority C: Fallback from UTC timestamp ('Z'); Vietnam bounding box uses exact UTC+7
  const parsedMs = weather.updatedAtIso ? Date.parse(weather.updatedAtIso) : NaN;
  const safeMs = Number.isFinite(parsedMs) ? parsedMs : Date.now();
  const lat = Number.isFinite(weather.latitude) ? weather.latitude : 0;
  const lon = Number.isFinite(weather.longitude) ? weather.longitude : 0;
  const isVietnamCoords = lat >= 8 && lat <= 24 && lon >= 102 && lon <= 110.5;
  const approxOffsetHrs = isVietnamCoords ? 7 : Math.round(lon / 15);
  const shifted = new Date(safeMs + approxOffsetHrs * 3600_000);
  return shifted.getUTCHours() + shifted.getUTCMinutes() / 60;
}

function resolveSkyTheme(weather: WeatherSnapshot, sceneId: CharacterSceneId): SkyTheme {
  const isRaining =
    sceneId === 'storm_raincoat' || sceneId === 'light_rain_umbrella';

  // Nighttime at target location: ONLY nighttime states return dark sky palettes
  if (!weather.isDay || sceneId === 'clear_night') {
    return isRaining ? 'rain_storm' : 'night';
  }

  // Daytime at target location (`weather.isDay === true`): NEVER return an `isDark: true` theme
  if (isRaining) {
    return 'day_rain';
  }

  const localHour = resolveLocationLocalHour(weather);
  const condLower = (weather.conditionText ?? '').toLowerCase();

  // Early Morning / Bình minh (04:00 <= localHour < 7.25 while isDay === true)
  if (
    (localHour >= 4 && localHour < 7.25) ||
    /bình minh|sáng sớm|dawn|sunrise/.test(condLower)
  ) {
    return 'dawn';
  }

  // Late Afternoon / Hoàng hôn (16.25 <= localHour < 22 while isDay === true, covering summer & global sunsets)
  if (
    (localHour >= 16.25 && localHour < 22) ||
    /hoàng hôn|chiều tà|sunset|dusk/.test(condLower)
  ) {
    return 'sunset';
  }

  // Daytime Cloudy / Overcast / High AQI (07:15 – 16:15)
  if (
    /mây|âm u|sương mù|bụi|cloud|overcast|fog|mist|haze/.test(condLower) ||
    (weather.aqi ?? 0) >= 150 ||
    ((sceneId === 'chilly_cozy' || sceneId === 'freezing_puffer') && weather.uvIndex <= 3)
  ) {
    return 'day_cloudy';
  }

  // Morning / Midday Clear & Sunny (07:15 – 16:15)
  return 'day_sunny';
}

function buildVietnameseCopy(params: {
  sceneId: CharacterSceneId;
  effectiveTemp: number;
  skyTheme: SkyTheme;
  weather: WeatherSnapshot;
  hasRainAheadProp: boolean;
  rainAheadHours: number | null;
  hasAqiMask: boolean;
}): { headlineVi: string; outfitAdviceVi: string; badgeVi: string } {
  const {
    sceneId,
    effectiveTemp,
    skyTheme,
    weather,
    hasRainAheadProp,
    rainAheadHours,
    hasAqiMask,
  } = params;

  let headlineVi = '';
  let outfitAdviceVi = '';
  let badgeVi = '';

  switch (sceneId) {
    case 'storm_raincoat': {
      badgeVi = '⛈️ Mưa lớn & gió mạnh';
      headlineVi = 'Mưa lớn gió mạnh';
      outfitAdviceVi = hasAqiMask
        ? 'Mặc áo mưa kín, đeo thêm khẩu trang'
        : 'Mặc áo mưa kín, tránh cầm ô';
      return { headlineVi, outfitAdviceVi, badgeVi };
    }

    case 'light_rain_umbrella': {
      badgeVi = '☔ Mưa nhỏ rải rác';
      headlineVi = 'Mưa nhỏ · Cầm ô';
      outfitAdviceVi = hasAqiMask
        ? 'Mang ô gọn, đeo khẩu trang khi ra đường'
        : 'Mang ô gọn và áo khoác trượt nước';
      return { headlineVi, outfitAdviceVi, badgeVi };
    }

    case 'clear_night': {
      if (effectiveTemp >= 32) {
        badgeVi = '🌙 Đêm oi bức';
        headlineVi = weather.windSpeedKmh <= 18 ? 'Đêm oi · Gió nhẹ' : 'Đêm oi · Có gió';
        outfitAdviceVi = 'Mặc đồ mỏng thoáng mát';
      } else {
        badgeVi = '🌙 Đêm dịu mát';
        headlineVi = 'Đêm thoáng mát';
        outfitAdviceVi =
          effectiveTemp < 25
            ? 'Mặc thoáng nhẹ, mang theo khoác mỏng'
            : 'Mặc đồ gọn nhẹ thoải mái';
      }
      break;
    }

    case 'hot_sunny': {
      if (weather.uvIndex >= 6 && skyTheme !== 'sunset' && skyTheme !== 'dawn') {
        badgeVi = '🕶️ Nắng gắt & UV cao';
        headlineVi = 'Oi nóng & UV cao';
        outfitAdviceVi = 'Mặc đồ thoáng mát, đeo kính chống nắng';
      } else {
        badgeVi = '🌡️ Trời oi nóng';
        headlineVi = 'Trời oi nóng';
        outfitAdviceVi = 'Mặc đồ mỏng thoáng mát, uống đủ nước';
      }
      break;
    }

    case 'pleasant_sunny': {
      if (skyTheme === 'sunset') {
        badgeVi = '🌅 Chiều dịu mát';
        headlineVi = 'Hoàng hôn dịu mát';
      } else if (skyTheme === 'dawn') {
        badgeVi = '🌅 Sáng sớm dịu mát';
        headlineVi = 'Bình minh trong lành';
      } else if (skyTheme === 'day_cloudy') {
        badgeVi = '⛅ Trời dịu mát';
        headlineVi = 'Nhiều mây dịu mát';
      } else {
        badgeVi = '🌤️ Nắng đẹp';
        headlineVi = 'Trời nắng dịu';
      }
      outfitAdviceVi =
        weather.uvIndex >= 6 &&
        skyTheme !== 'day_cloudy' &&
        skyTheme !== 'sunset' &&
        skyTheme !== 'dawn'
          ? 'Mặc đồ thoáng nhẹ, thoa kem chống nắng'
          : 'Mặc trang phục gọn nhẹ thoải mái';
      break;
    }

    case 'chilly_cozy': {
      badgeVi = weather.isDay ? '🍂 Trời se lạnh' : '🌙 Đêm se lạnh';
      headlineVi = weather.isDay ? 'Trời se lạnh' : 'Đêm se lạnh';
      outfitAdviceVi = 'Khoác áo mỏng khi ra ngoài';
      break;
    }

    case 'freezing_puffer': {
      badgeVi = weather.isDay ? '🧣 Trời rét đậm' : '🧣 Đêm rét đậm';
      headlineVi = weather.isDay ? 'Trời rét đậm' : 'Đêm rét đậm';
      outfitAdviceVi = 'Mặc áo phao dày, giữ ấm cổ';
      break;
    }
  }

  if (hasRainAheadProp && rainAheadHours !== null && hasAqiMask) {
    outfitAdviceVi = `Mang sẵn ô, mưa sau ${rainAheadHours}h · Đeo khẩu trang`;
  } else if (hasRainAheadProp && rainAheadHours !== null) {
    outfitAdviceVi = `Mang sẵn ô, dự báo mưa sau ${rainAheadHours}h`;
  } else if (hasAqiMask) {
    if (sceneId === 'freezing_puffer' || sceneId === 'chilly_cozy') {
      outfitAdviceVi = 'Mặc đủ ấm, đeo khẩu trang lọc bụi';
    } else if (
      sceneId === 'hot_sunny' &&
      weather.uvIndex >= 6 &&
      skyTheme !== 'sunset' &&
      skyTheme !== 'dawn'
    ) {
      outfitAdviceVi = 'Chống nắng kỹ, đeo khẩu trang lọc bụi';
    } else {
      outfitAdviceVi = 'Mặc thoáng nhẹ, đeo khẩu trang lọc bụi';
    }
  }

  return { headlineVi, outfitAdviceVi, badgeVi };
}

export function evaluateCharacterDecision(
  weather: WeatherSnapshot,
  prefs: { gender: Gender; sensitivity: ThermalSensitivity }
): CharacterDecision {
  const sensitivityDelta =
    prefs.sensitivity === 'cold_sensitive'
      ? -3
      : prefs.sensitivity === 'heat_sensitive'
        ? 3
        : 0;

  const effectiveTemp = weather.feelsLikeC + sensitivityDelta;

  let sceneId: CharacterSceneId;

  // Priority 1: Heavy rain / storm raincoat (day or night)
  if (
    weather.precipMmPerHr >= 4.5 ||
    (weather.precipProbPct >= 60 && weather.windGustKmh >= 32)
  ) {
    sceneId = 'storm_raincoat';
  } else if (weather.precipMmPerHr >= 0.2 || weather.precipProbPct >= 50) {
    // Priority 2: Light rain with umbrella (day or night)
    sceneId = 'light_rain_umbrella';
  } else if (!weather.isDay) {
    // Nighttime (not raining): NEVER return hot_sunny or pleasant_sunny
    if (effectiveTemp >= 22) {
      sceneId = 'clear_night';
    } else if (effectiveTemp >= 16) {
      sceneId = 'chilly_cozy';
    } else {
      sceneId = 'freezing_puffer';
    }
  } else if (effectiveTemp >= 33 || weather.uvIndex >= 8) {
    sceneId = 'hot_sunny';
  } else if (effectiveTemp >= 22) {
    sceneId = 'pleasant_sunny';
  } else if (effectiveTemp >= 16) {
    sceneId = 'chilly_cozy';
  } else {
    sceneId = 'freezing_puffer';
  }

  // Foresight Rain-Ahead Prop: active ONLY when not currently raining
  const isCurrentlyRaining =
    sceneId === 'storm_raincoat' || sceneId === 'light_rain_umbrella';

  let hasRainAheadProp = false;
  let rainAheadHours: number | null = null;

  if (!isCurrentlyRaining && Array.isArray(weather.hourly)) {
    const maxLookahead = Math.min(6, weather.hourly.length);
    for (let i = 0; i < maxLookahead; i += 1) {
      const hourPoint = weather.hourly[i];
      if (
        hourPoint &&
        (hourPoint.precipProbPct >= 65 || hourPoint.precipMm >= 1.0)
      ) {
        hasRainAheadProp = true;
        rainAheadHours = i + 1;
        break;
      }
    }
  }

  const hasAqiMask = (weather.aqi ?? 0) >= 130;
  const skyTheme = resolveSkyTheme(weather, sceneId);

  const { headlineVi, outfitAdviceVi, badgeVi } = buildVietnameseCopy({
    sceneId,
    effectiveTemp,
    skyTheme,
    weather,
    hasRainAheadProp,
    rainAheadHours,
    hasAqiMask,
  });

  return {
    sceneId,
    gender: prefs.gender,
    hasRainAheadProp,
    rainAheadHours,
    hasAqiMask,
    skyTheme,
    headlineVi,
    outfitAdviceVi,
    badgeVi,
  };
}

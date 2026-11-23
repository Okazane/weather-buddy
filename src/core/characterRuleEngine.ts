import type {
  CharacterDecision,
  CharacterSceneId,
  Gender,
  SkyTheme,
  ThermalSensitivity,
  WeatherSnapshot,
} from './types';

function resolveSkyTheme(weather: WeatherSnapshot, sceneId: CharacterSceneId): SkyTheme {
  if (sceneId === 'storm_raincoat' || sceneId === 'light_rain_umbrella') {
    return 'rain_storm';
  }

  if (!weather.isDay || sceneId === 'clear_night') {
    return 'night';
  }

  const condLower = (weather.conditionText ?? '').toLowerCase();
  if (/bình minh|dawn|sunrise/.test(condLower)) {
    return 'dawn';
  }
  if (/hoàng hôn|chiều tà|sunset|dusk/.test(condLower)) {
    return 'sunset';
  }

  // Check low-sun dawn/sunset window when daytime UV is very low
  if (weather.uvIndex <= 1.2 && weather.updatedAtIso) {
    const parsedMs = Date.parse(weather.updatedAtIso);
    if (Number.isFinite(parsedMs)) {
      const utcHour = new Date(parsedMs).getUTCHours();
      const approxOffsetHrs = Math.round(weather.longitude / 15);
      const localHour = (utcHour + approxOffsetHrs + 24) % 24;
      if (localHour >= 5 && localHour <= 6) {
        return 'dawn';
      }
      if (localHour >= 17 && localHour <= 18) {
        return 'sunset';
      }
    }
  }

  if (
    /mây|âm u|sương mù|bụi|cloud|overcast|fog|mist|haze/.test(condLower) ||
    (weather.aqi ?? 0) >= 150 ||
    ((sceneId === 'chilly_cozy' || sceneId === 'freezing_puffer') && weather.uvIndex <= 3)
  ) {
    return 'day_cloudy';
  }

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
      if (weather.uvIndex >= 6) {
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
      if (skyTheme === 'day_cloudy') {
        badgeVi = '⛅ Trời dịu mát';
        headlineVi = 'Nhiều mây dịu mát';
      } else {
        badgeVi = '🌤️ Nắng đẹp';
        headlineVi = 'Trời nắng dịu';
      }
      outfitAdviceVi =
        weather.uvIndex >= 6 && skyTheme !== 'day_cloudy'
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
    } else if (sceneId === 'hot_sunny' && weather.uvIndex >= 6) {
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

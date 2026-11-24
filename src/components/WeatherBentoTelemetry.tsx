/* Lucian UX/UI Prompt #094 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#094 */
/* Lucian UX/UI Prompt #228 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#228 */

import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import type {
  CharacterDecision,
  WeatherSnapshot,
} from '../core';
import {
  LucianGlowingBento228,
  type TelemetryMetricCardItem,
} from '../lucian/LucianStageWidgets';
import type { AtmosphericPalette } from './themeTokens';

interface WeatherBentoTelemetryProps {
  palette: AtmosphericPalette;
  weather: WeatherSnapshot;
  decision: CharacterDecision;
  reduceMotion?: boolean;
}

interface ImpeccableSemanticRoles {
  normal: string;
  safe: string;
  caution: string;
  hazard: string;
}

function getImpeccableSemanticRoles(
  palette: AtmosphericPalette
): ImpeccableSemanticRoles {
  return {
    normal: palette.accent,
    safe: palette.isDark ? '#58C49E' : '#168560',
    caution: palette.isDark ? '#E8A849' : '#B86818',
    hazard: palette.isDark ? '#E5737D' : '#C4384B',
  };
}

function describeUvVi(
  uv: number,
  isDay: boolean,
  roles: ImpeccableSemanticRoles
): { badge: string; detail: string; accentColor: string } {
  if (!isDay) {
    return {
      badge: 'Ban đêm',
      detail: 'An toàn cho da khi hoạt động ngoài trời',
      accentColor: roles.normal,
    };
  }
  if (uv >= 8) {
    return {
      badge: 'Rất gắt',
      detail: 'Bôi kem chống nắng, che kín da & đeo kính râm',
      accentColor: roles.hazard,
    };
  }
  if (uv >= 6) {
    return {
      badge: 'Cao',
      detail: 'Đội mũ, đeo kính mát khi ra ngoài trưa',
      accentColor: roles.caution,
    };
  }
  if (uv >= 3) {
    return {
      badge: 'Trung bình',
      detail: 'Che nắng nhẹ nếu ở ngoài trời trên 30 phút',
      accentColor: roles.normal,
    };
  }
  return {
    badge: 'Thấp',
    detail: 'An toàn cho da khi hoạt động ngoài trời',
    accentColor: roles.safe,
  };
}

function describeAqiVi(
  aqi: number | undefined,
  roles: ImpeccableSemanticRoles
): {
  valueLabel: string;
  badge: string;
  note: string;
  pct: number;
  accentColor: string;
} {
  if (typeof aqi !== 'number' || !Number.isFinite(aqi)) {
    return {
      valueLabel: '42',
      badge: 'Trong lành',
      note: 'Không khí sạch · Rất tốt để tập thể dục, mở cửa sổ',
      pct: 24,
      accentColor: roles.safe,
    };
  }
  const rounded = Math.round(aqi);
  if (rounded >= 150) {
    return {
      valueLabel: `${rounded}`,
      badge: 'Ô nhiễm cao',
      note: 'Đeo khẩu trang lọc bụi mịn, hạn chế chạy bộ ngoài đường',
      pct: Math.min(100, (rounded / 200) * 100),
      accentColor: roles.hazard,
    };
  }
  if (rounded >= 101) {
    return {
      valueLabel: `${rounded}`,
      badge: 'Kém (Nhạy cảm)',
      note: 'Người nhạy cảm hô hấp nên đeo khẩu trang khi ra đường',
      pct: Math.min(100, (rounded / 200) * 100),
      accentColor: roles.caution,
    };
  }
  if (rounded >= 51) {
    return {
      valueLabel: `${rounded}`,
      badge: 'Trung bình',
      note: 'Không khí ổn · Hạn chế đứng lâu nơi kẹt xe khói bụi',
      pct: Math.min(100, (rounded / 200) * 100),
      accentColor: roles.normal,
    };
  }
  return {
    valueLabel: `${rounded}`,
    badge: 'Trong lành',
    note: 'Không khí sạch · Rất tốt để tập thể dục, mở cửa sổ',
    pct: Math.max(12, (rounded / 200) * 100),
    accentColor: roles.safe,
  };
}

function formatUpdatedLabelVi(iso?: string, utcOffsetSeconds?: number): string {
  if (!iso) {
    return 'Trực tiếp';
  }
  const trimmed = iso.trim();
  const explicitMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?([+-]\d{2}:?\d{2})?$/
  );
  if (explicitMatch) {
    const [, yyyy, mmDate, dd, hh, min] = explicitMatch;
    return `Trực tiếp · ${hh}:${min} · ${dd}/${mmDate}/${yyyy}`;
  }
  const parsedMs = Date.parse(trimmed);
  if (!Number.isNaN(parsedMs)) {
    const offsetSec =
      typeof utcOffsetSeconds === 'number' && Number.isFinite(utcOffsetSeconds)
        ? utcOffsetSeconds
        : -new Date().getTimezoneOffset() * 60;
    const d = new Date(parsedMs + offsetSec * 1000);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mmDate = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const min = String(d.getUTCMinutes()).padStart(2, '0');
    return `Trực tiếp · ${hh}:${min} · ${dd}/${mmDate}/${yyyy}`;
  }
  return 'Trực tiếp';
}

function buildRealtimeTelemetryAdviceVi(
  weather: WeatherSnapshot,
  decision: CharacterDecision
): string {
  const humidity = Math.round(weather.humidityPct);
  const feels = Math.round(weather.feelsLikeC);
  const rainProb = Math.round(weather.precipProbPct);
  const gust = Math.round(weather.windGustKmh);
  const uv = Math.round(weather.uvIndex);
  const aqiVal =
    typeof weather.aqi === 'number' && Number.isFinite(weather.aqi)
      ? Math.round(weather.aqi)
      : null;

  if (weather.precipMmPerHr >= 0.3 || weather.precipProbPct >= 60) {
    if (gust >= 32) {
      return `Lời khuyên thời gian thực: Khả năng mưa cao (${rainProb}%) kèm gió giật ${gust} km/giờ — nên mặc áo mưa gọn thay vì che ô lớn và giữ vững tay lái nơi đường trơn.`;
    }
    if (aqiVal !== null && aqiVal >= 101) {
      return `Lời khuyên thời gian thực: Trời dễ có mưa (${rainProb}%) kèm bụi mịn mức ${aqiVal} — nên mang sẵn áo mưa hoặc ô gấp và đeo khẩu trang khi ra đường.`;
    }
    return `Lời khuyên thời gian thực: Khả năng mưa cao (${rainProb}%) kèm độ ẩm ${humidity}% — nên chuẩn bị áo mưa hoặc ô gọn và đi chậm tránh đường trơn.`;
  }

  if (decision.hasRainAheadProp && decision.rainAheadHours !== null) {
    return `Lời khuyên thời gian thực: Hiện trời chưa mưa lớn nhưng dự báo có mưa sau khoảng ${decision.rainAheadHours} giờ — nên cất sẵn ô gấp hoặc áo mưa gọn trước khi đi.`;
  }

  if (aqiVal !== null && aqiVal >= 101) {
    if ((weather.isDay && uv >= 6) || feels >= 33) {
      return `Lời khuyên thời gian thực: Nồng độ bụi mịn đang cao (chỉ số ${aqiVal}) kèm trời oi nắng (cảm nhận ${feels}°C) — nên đeo khẩu trang lọc bụi PM2.5, che nắng kỹ và bổ sung nước.`;
    }
    if (aqiVal >= 150) {
      return `Lời khuyên thời gian thực: Nồng độ bụi mịn đang ở mức cao (chỉ số ${aqiVal}) — nên đeo khẩu trang lọc bụi PM2.5 và hạn chế tập thể dục ngoài đường.`;
    }
    return `Lời khuyên thời gian thực: Độ sạch không khí giảm nhẹ do bụi mịn (chỉ số ${aqiVal}) — người nhạy cảm hô hấp nên đeo khẩu trang khi di chuyển ngoài phố.`;
  }

  if (weather.isDay && uv >= 6 && feels >= 33) {
    return `Lời khuyên thời gian thực: Trời oi nóng (cảm nhận ${feels}°C) và bức xạ cực tím cao (mức ${uv}) — nên mặc áo chống nắng thoáng khí, đeo kính râm và bổ sung nước.`;
  }

  if (weather.isDay && uv >= 6) {
    return `Lời khuyên thời gian thực: Bức xạ tia cực tím đang cao (mức ${uv}) — nên thoa kem chống nắng, đội mũ và đeo kính mát khi hoạt động ngoài nắng.`;
  }

  if (feels >= 33) {
    return `Lời khuyên thời gian thực: Nhiệt độ cảm nhận khá oi bức (${feels}°C, độ ẩm ${humidity}%) — ưu tiên trang phục mỏng thoáng mồ hôi và hạn chế đứng lâu ngoài trời nóng.`;
  }

  if (gust >= 34) {
    return `Lời khuyên thời gian thực: Đang có gió giật mạnh (${gust} km/giờ) — nên mặc gọn gàng, chú ý tay lái xe máy và tránh dừng dưới tán cây lớn.`;
  }

  if (feels <= 19) {
    return `Lời khuyên thời gian thực: Nhiệt độ cảm nhận se lạnh (${feels}°C) — nên mặc thêm áo khoác giữ ấm khi ra ngoài.`;
  }

  if (humidity >= 82) {
    return `Lời khuyên thời gian thực: Độ ẩm không khí cao (${humidity}%) dễ gây hầm bí — ưu tiên trang phục mỏng thoáng mồ hôi.`;
  }

  if (humidity <= 42) {
    return `Lời khuyên thời gian thực: Không khí khá khô hanh (độ ẩm ${humidity}%) — nên uống thêm nước và dưỡng ẩm da, môi.`;
  }

  return `Lời khuyên thời gian thực: Các chỉ số nhiệt độ, độ ẩm và không khí đang ở ngưỡng lý tưởng — rất thuận lợi để dạo phố hoặc vận động ngoài trời.`;
}

export const WeatherBentoTelemetry: React.FC<WeatherBentoTelemetryProps> = React.memo(({
  palette,
  weather,
  decision,
  reduceMotion = false,
}) => {
  const updatedLabel = useMemo(
    () => formatUpdatedLabelVi(weather.updatedAtIso, weather.utcOffsetSeconds),
    [weather.updatedAtIso, weather.utcOffsetSeconds]
  );

  const realtimeAdviceVi = useMemo(
    () => buildRealtimeTelemetryAdviceVi(weather, decision),
    [weather, decision]
  );

  const metrics: TelemetryMetricCardItem[] = useMemo(() => {
    const roles = getImpeccableSemanticRoles(palette);
    const aqiMeta = describeAqiVi(weather.aqi, roles);
    const uvMeta = describeUvVi(weather.uvIndex, weather.isDay, roles);
    const diffTemp = Math.round(weather.feelsLikeC - weather.temperatureC);
    const humidity = Math.round(weather.humidityPct);

    const feelsAccentColor =
      weather.feelsLikeC >= 38
        ? roles.hazard
        : weather.feelsLikeC >= 33
          ? roles.caution
          : roles.normal;

    const rainAccentColor =
      weather.precipMmPerHr >= 4.5
        ? roles.hazard
        : weather.precipProbPct >= 50 || weather.precipMmPerHr >= 0.3
          ? roles.caution
          : roles.normal;

    const windAccentColor =
      weather.windGustKmh >= 50
        ? roles.hazard
        : weather.windGustKmh >= 32
          ? roles.caution
          : roles.normal;

    const rainDetail =
      weather.precipMmPerHr >= 0.3
        ? 'Đang có mưa · Mặc áo mưa, đi chậm tránh trơn'
        : decision.hasRainAheadProp && decision.rainAheadHours !== null
          ? `Dự báo mưa sau ${decision.rainAheadHours} giờ · Mang sẵn ô gấp`
          : weather.precipProbPct >= 50
            ? 'Khả năng mưa cao · Nên mang theo ô hoặc áo mưa'
            : weather.precipProbPct >= 25
              ? 'Có thể mưa rào nhẹ · Phòng hờ ô gấp gọn'
              : 'Trời khô ráo · Yên tâm di chuyển ngoài trời';

    return [
      {
        id: 'temp',
        iconKey: 'temp',
        label: 'Nhiệt độ & Độ ẩm không khí',
        value: `${weather.temperatureC.toFixed(1).replace(/\.0$/, '')}°C`,
        badge: `Độ ẩm ${humidity}%`,
        detail:
          humidity >= 80
            ? 'Ẩm cao dễ bí · Mặc vải thoáng mồ hôi'
            : humidity <= 45
              ? 'Khô hanh · Uống thêm nước, dưỡng ẩm'
              : 'Độ ẩm cân bằng · Mặc gọn nhẹ thoải mái',
        explainVi:
          'Nhiệt độ không khí đo tại cao độ 2 mét; độ ẩm tương đối (%) cho biết lượng hơi nước trong không khí (trên 80% gây cảm giác nồm ẩm, lâu khô mồ hôi).',
        progressPct: Math.max(15, Math.min(100, ((weather.temperatureC + 5) / 48) * 100)),
        accentColor: roles.normal,
      },
      {
        id: 'feels',
        iconKey: 'feels',
        label: 'Nhiệt độ cảm nhận thực tế',
        value: `${Math.round(weather.feelsLikeC)}°C`,
        badge:
          diffTemp > 0
            ? `Oi hơn +${diffTemp}°`
            : diffTemp < 0
              ? `Mát hơn -${Math.abs(diffTemp)}°`
              : 'Sát nhiệt kế',
        detail:
          weather.feelsLikeC >= 34
            ? 'Oi bức rõ rệt · Tránh nắng gắt, nghỉ ngơi hợp lý'
            : weather.feelsLikeC <= 18
              ? 'Lạnh hơn nhiệt kế · Nên khoác áo chắn gió'
              : 'Cảm giác dễ chịu · Thuận lợi sinh hoạt ngoài trời',
        explainVi:
          'Nhiệt độ cơ thể thực sự cảm nhận được khi kết hợp nhiệt độ thực, độ ẩm không khí (làm oi hơn) và sức gió thổi (làm mát hoặc lạnh hơn).',
        progressPct: Math.max(15, Math.min(100, ((weather.feelsLikeC + 5) / 48) * 100)),
        accentColor: feelsAccentColor,
      },
      {
        id: 'rain',
        iconKey: 'rain',
        label: 'Khả năng mưa & Lượng mưa',
        value: `${Math.round(weather.precipProbPct)}%`,
        badge: `${weather.precipMmPerHr.toFixed(1)} mm/giờ`,
        detail: rainDetail,
        explainVi:
          'Phần trăm (%) là khả năng xảy ra mưa tại khu vực; mm/giờ là độ dày lớp nước mưa rơi trong 1 giờ (dưới 2 mm: mưa nhỏ, 2–5 mm: mưa vừa, trên 5 mm: mưa to).',
        progressPct: Math.max(8, Math.min(100, weather.precipProbPct)),
        accentColor: rainAccentColor,
      },
      {
        id: 'wind',
        iconKey: 'wind',
        label: 'Sức gió & Gió giật',
        value: `${Math.round(weather.windGustKmh)} km/giờ`,
        badge: `Gió đều ${Math.round(weather.windSpeedKmh)} km/giờ`,
        detail:
          weather.windGustKmh >= 32
            ? 'Gió giật mạnh · Giữ vững tay lái, tránh tán cây lớn'
            : weather.windSpeedKmh >= 16
              ? 'Gió thổi thoáng mát · Mở cửa đón gió tự nhiên'
              : 'Gió nhẹ êm ả · An toàn di chuyển ngoài trời',
        explainVi:
          'Gió đều là tốc độ gió thổi ổn định; gió giật là những luồng gió thốc mạnh đột ngột trong vài giây (trên 32 km/giờ cần chú ý khi đi xe máy).',
        progressPct: Math.max(12, Math.min(100, (weather.windGustKmh / 55) * 100)),
        accentColor: windAccentColor,
      },
      {
        id: 'uv',
        iconKey: 'uv',
        label: 'Bức xạ tia cực tím',
        value: `${Math.round(weather.uvIndex)}`,
        badge: uvMeta.badge,
        detail: uvMeta.detail,
        explainVi:
          'Đo cường độ tia tử ngoại (tia UV) từ mặt trời tác động lên da và mắt: 0–2 An toàn · 3–5 Trung bình · 6–7 Cao · Từ 8 trở lên Rất gắt, dễ gây cháy nắng nhanh.',
        progressPct: weather.isDay
          ? Math.max(10, Math.min(100, (weather.uvIndex / 11) * 100))
          : 8,
        accentColor: uvMeta.accentColor,
      },
      {
        id: 'aqi',
        iconKey: 'aqi',
        label: 'Độ sạch không khí (Bụi mịn)',
        value: aqiMeta.valueLabel,
        badge: aqiMeta.badge,
        detail: aqiMeta.note,
        explainVi:
          'Thang đo độ sạch không khí theo nồng độ bụi mịn PM2.5 và khí thải (0–500): 0–50 Trong lành · 51–100 Trung bình · 101–150 Kém cho người nhạy cảm · Trên 150 Ô nhiễm cao.',
        progressPct: aqiMeta.pct,
        accentColor: aqiMeta.accentColor,
      },
    ];
  }, [weather, decision, palette]);

  return (
    <View style={styles.bentoTelemetryGrid}>
      {/* Full-Width Interactive Bento Matrix: Lucian #228 Cursor-lit glowing card borders (6 Real-Time Weather Telemetry Cards) */}
      <View
        style={[
          styles.outerBezel,
          styles.metricsFullWidth,
          {
            backgroundColor: palette.bezelOuterBg,
            borderColor: palette.bezelOuterBorder,
          },
        ]}
      >
        <LucianGlowingBento228
          palette={palette}
          metrics={metrics}
          realtimeAdviceVi={realtimeAdviceVi}
          updatedLabel={updatedLabel}
          reduceMotion={reduceMotion}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  bentoTelemetryGrid: {
    width: '100%',
    maxWidth: '100%',
  },
  outerBezel: {
    padding: 5,
    borderRadius: 32,
    borderWidth: 1,
    maxWidth: '100%',
  },
  metricsFullWidth: {
    width: '100%',
    minWidth: 0,
  },
});

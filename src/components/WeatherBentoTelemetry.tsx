/* Lucian UX/UI Prompt #094 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#094 */
/* Lucian UX/UI Prompt #228 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#228 */

import React, { useMemo } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import type {
  CharacterDecision,
  WeatherSnapshot,
} from '../core';
import {
  LucianGlowingBento228,
  LucianSkyScrubber094,
  type TelemetryMetricCardItem,
} from '../lucian/LucianStageWidgets';
import type { AtmosphericPalette } from './themeTokens';

interface WeatherBentoTelemetryProps {
  palette: AtmosphericPalette;
  weather: WeatherSnapshot;
  decision: CharacterDecision;
  reduceMotion?: boolean;
}

function describeUvVi(
  uv: number,
  isDay: boolean
): { badge: string; detail: string; accentColor: string } {
  if (!isDay) {
    return {
      badge: 'Ban đêm',
      detail: 'Không có bức xạ mặt trời',
      accentColor: '#818CF8',
    };
  }
  if (uv >= 8) {
    return {
      badge: 'Rất cao',
      detail: 'Cần che chắn kỹ khi ra ngoài',
      accentColor: '#F97316',
    };
  }
  if (uv >= 6) {
    return {
      badge: 'Cao',
      detail: 'Nên hạn chế nắng gắt giữa trưa',
      accentColor: '#F59E0B',
    };
  }
  if (uv >= 3) {
    return {
      badge: 'Trung bình',
      detail: 'Bức xạ vừa phải ngoài trời',
      accentColor: '#EAB308',
    };
  }
  return {
    badge: 'Thấp',
    detail: 'An toàn cho hoạt động ngoài trời',
    accentColor: '#10B981',
  };
}

function describeAqiVi(aqi?: number): {
  valueLabel: string;
  badge: string;
  note: string;
  pct: number;
  accentColor: string;
} {
  if (typeof aqi !== 'number' || !Number.isFinite(aqi)) {
    return {
      valueLabel: '42',
      badge: 'Tốt',
      note: 'Không khí trong lành, dễ chịu',
      pct: 24,
      accentColor: '#10B981',
    };
  }
  const rounded = Math.round(aqi);
  if (rounded >= 150) {
    return {
      valueLabel: `${rounded}`,
      badge: 'Xấu',
      note: 'Bụi mịn cao · Nên đeo khẩu trang',
      pct: Math.min(100, (rounded / 200) * 100),
      accentColor: '#EF4444',
    };
  }
  if (rounded >= 101) {
    return {
      valueLabel: `${rounded}`,
      badge: 'Nhạy cảm',
      note: 'Kém cho nhóm nhạy cảm hô hấp',
      pct: Math.min(100, (rounded / 200) * 100),
      accentColor: '#F59E0B',
    };
  }
  if (rounded >= 51) {
    return {
      valueLabel: `${rounded}`,
      badge: 'Trung bình',
      note: 'Chất lượng không khí chấp nhận được',
      pct: Math.min(100, (rounded / 200) * 100),
      accentColor: '#3B82F6',
    };
  }
  return {
    valueLabel: `${rounded}`,
    badge: 'Tốt',
    note: 'Không khí trong lành, thoáng đãng',
    pct: Math.max(12, (rounded / 200) * 100),
    accentColor: '#10B981',
  };
}

export const WeatherBentoTelemetry: React.FC<WeatherBentoTelemetryProps> = ({
  palette,
  weather,
  decision,
  reduceMotion = false,
}) => {
  const { width } = useWindowDimensions();
  const isSplitDesktop = width >= 900;

  const metrics: TelemetryMetricCardItem[] = useMemo(() => {
    const aqiMeta = describeAqiVi(weather.aqi);
    const uvMeta = describeUvVi(weather.uvIndex, weather.isDay);
    const diffTemp = Math.round(weather.feelsLikeC - weather.temperatureC);
    const humidity = Math.round(weather.humidityPct);

    return [
      {
        id: 'temp',
        iconKey: 'temp',
        label: 'Nhiệt độ & Độ ẩm',
        value: `${weather.temperatureC.toFixed(1).replace(/\.0$/, '')}°C`,
        badge: `Độ ẩm ${humidity}%`,
        detail:
          humidity >= 80
            ? 'Không khí ẩm cao'
            : humidity <= 45
              ? 'Không khí khô thoáng'
              : 'Độ ẩm cân bằng dễ chịu',
        progressPct: Math.max(15, Math.min(100, ((weather.temperatureC + 5) / 48) * 100)),
        accentColor: palette.accent,
      },
      {
        id: 'feels',
        iconKey: 'feels',
        label: 'Cảm giác thực',
        value: `${Math.round(weather.feelsLikeC)}°C`,
        badge:
          diffTemp > 0
            ? `Oi hơn +${diffTemp}°`
            : diffTemp < 0
              ? `Lạnh hơn ${diffTemp}°`
              : 'Sát thực tế',
        detail:
          weather.feelsLikeC >= 33
            ? 'Nhiệt cảm nhận oi bức'
            : weather.feelsLikeC <= 18
              ? 'Nhiệt cảm nhận se lạnh'
              : 'Nhiệt cảm nhận thoải mái',
        progressPct: Math.max(15, Math.min(100, ((weather.feelsLikeC + 5) / 48) * 100)),
        accentColor: '#38BDF8',
      },
      {
        id: 'rain',
        iconKey: 'rain',
        label: 'Lượng mưa & Xác suất',
        value: `${Math.round(weather.precipProbPct)}%`,
        badge: `${weather.precipMmPerHr.toFixed(1)} mm/h`,
        detail:
          decision.hasRainAheadProp && decision.rainAheadHours !== null
            ? `Dự báo có mưa sau ${decision.rainAheadHours}h`
            : weather.precipProbPct >= 50
              ? 'Khả năng mưa cao, nên mang ô'
              : 'Ít khả năng mưa trong giờ tới',
        progressPct: Math.max(8, Math.min(100, weather.precipProbPct)),
        accentColor: '#3B82F6',
      },
      {
        id: 'wind',
        iconKey: 'wind',
        label: 'Gió & Gió giật',
        value: `${Math.round(weather.windGustKmh)} km/h`,
        badge: `Gió đều ${Math.round(weather.windSpeedKmh)} km/h`,
        detail:
          weather.windGustKmh >= 32
            ? 'Gió giật mạnh, chú ý khi di chuyển'
            : weather.windSpeedKmh >= 16
              ? 'Gió thổi mát vừa phải'
              : 'Gió nhẹ êm ả',
        progressPct: Math.max(12, Math.min(100, (weather.windGustKmh / 55) * 100)),
        accentColor: '#10B981',
      },
      {
        id: 'uv',
        iconKey: 'uv',
        label: 'Chỉ số UV',
        value: `${Math.round(weather.uvIndex)}`,
        badge: uvMeta.badge,
        detail: uvMeta.detail,
        progressPct: weather.isDay
          ? Math.max(10, Math.min(100, (weather.uvIndex / 11) * 100))
          : 8,
        accentColor: uvMeta.accentColor,
      },
      {
        id: 'aqi',
        iconKey: 'aqi',
        label: 'Chất lượng không khí (US AQI)',
        value: aqiMeta.valueLabel,
        badge: aqiMeta.badge,
        detail: aqiMeta.note,
        progressPct: aqiMeta.pct,
        accentColor: aqiMeta.accentColor,
      },
    ];
  }, [weather, decision, palette.accent]);

  return (
    <View
      style={[
        styles.bentoTelemetryGrid,
        isSplitDesktop ? styles.bentoSplitRow : styles.bentoVerticalStack,
      ]}
    >
      {/* Left Interactive Widget: Lucian #094 Weather sky you scrub through (24h Sun/Moon Arc + Clouds + Rain) */}
      <View
        style={[
          styles.outerBezel,
          styles.scrubberCol,
          isSplitDesktop && styles.scrubberColDesktop,
          {
            backgroundColor: palette.bezelOuterBg,
            borderColor: palette.bezelOuterBorder,
          },
        ]}
      >
        <LucianSkyScrubber094
          palette={palette}
          weather={weather}
          decision={decision}
          reduceMotion={reduceMotion}
        />
      </View>

      {/* Right Interactive Bento Matrix: Lucian #228 Cursor-lit glowing card borders (6 Weather Telemetry Cards) */}
      <View
        style={[
          styles.outerBezel,
          styles.metricsCol,
          {
            backgroundColor: palette.bezelOuterBg,
            borderColor: palette.bezelOuterBorder,
          },
        ]}
      >
        <LucianGlowingBento228
          palette={palette}
          metrics={metrics}
          reduceMotion={reduceMotion}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bentoTelemetryGrid: {
    width: '100%',
    maxWidth: '100%',
  },
  bentoSplitRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 18,
  },
  bentoVerticalStack: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 16,
  },
  outerBezel: {
    padding: 5,
    borderRadius: 32,
    borderWidth: 1,
    maxWidth: '100%',
  },
  scrubberCol: {
    flex: 0.92,
    minWidth: 0,
  },
  scrubberColDesktop: {
    minWidth: 348,
  },
  metricsCol: {
    flex: 1.28,
    minWidth: 0,
  },
});

import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type {
  CharacterDecision,
  HourlyForecastPoint,
  WeatherSnapshot,
} from '../core';
import {
  FONT_FAMILY_DISPLAY,
  FONT_FAMILY_SANS,
  type AtmosphericPalette,
} from './themeTokens';

interface WeatherBentoTelemetryProps {
  palette: AtmosphericPalette;
  weather: WeatherSnapshot;
  decision: CharacterDecision;
}

function parseSlotHour(iso: string): number | null {
  if (!iso) {
    return null;
  }
  const hasExplicitTz = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso.trim());
  if (!hasExplicitTz) {
    const match = iso.match(/T(\d{2}):(\d{2})/);
    if (match) {
      return Number(match[1]);
    }
  }
  const date = new Date(iso);
  if (!Number.isNaN(date.getTime())) {
    return date.getHours();
  }
  return null;
}

function formatHourlySlotTime(iso: string, index: number): string {
  const hh = parseSlotHour(iso);
  if (hh !== null) {
    return `${String(hh).padStart(2, '0')}:00`;
  }
  return `+${index + 1}h`;
}

function pickConditionIcon(
  code: string,
  iso: string
): React.ComponentProps<typeof Feather>['name'] {
  const upper = (code || '').toUpperCase();
  if (upper.includes('THUNDER') || upper.includes('STORM')) {
    return 'cloud-lightning';
  }
  if (upper.includes('HEAVY_RAIN') || upper.includes('RAIN')) {
    return 'cloud-rain';
  }
  if (upper.includes('DRIZZLE') || upper.includes('LIGHT_RAIN')) {
    return 'umbrella';
  }
  if (upper.includes('SNOW') || upper.includes('ICE')) {
    return 'cloud-snow';
  }
  if (upper.includes('FOG') || upper.includes('CLOUD')) {
    return 'cloud';
  }
  const hour = parseSlotHour(iso);
  if (hour !== null && (hour < 6 || hour >= 18)) {
    return 'moon';
  }
  return 'sun';
}

function describeUvVi(uv: number, isDay: boolean): string {
  if (!isDay) return 'Ban đêm';
  if (uv >= 8) return 'Rất cao';
  if (uv >= 6) return 'Cao';
  if (uv >= 3) return 'Trung bình';
  return 'Thấp';
}

function describeAqiVi(aqi?: number): { valueLabel: string; note: string } {
  if (typeof aqi !== 'number' || !Number.isFinite(aqi)) {
    return { valueLabel: '42', note: 'Tốt' };
  }
  const rounded = Math.round(aqi);
  if (rounded >= 150) {
    return { valueLabel: `${rounded}`, note: 'Xấu · Nên đeo khẩu trang' };
  }
  if (rounded >= 101) {
    return { valueLabel: `${rounded}`, note: 'Kém cho nhóm nhạy cảm' };
  }
  if (rounded >= 51) {
    return { valueLabel: `${rounded}`, note: 'Trung bình' };
  }
  return { valueLabel: `${rounded}`, note: 'Tốt' };
}

export const WeatherBentoTelemetry: React.FC<WeatherBentoTelemetryProps> = ({
  palette,
  weather,
  decision,
}) => {
  const { width } = useWindowDimensions();
  const isWide = width >= 880;
  const hourly12: HourlyForecastPoint[] = (weather.hourly ?? []).slice(0, 12);
  const aqiMeta = describeAqiVi(weather.aqi);
  const diffTemp = Math.round(weather.feelsLikeC - weather.temperatureC);

  const metrics = [
    {
      id: 'temp',
      icon: 'thermometer' as const,
      label: 'Nhiệt độ',
      value: `${weather.temperatureC.toFixed(1).replace(/\.0$/, '')}°C`,
      detail: `Độ ẩm ${Math.round(weather.humidityPct)}%`,
    },
    {
      id: 'feels',
      icon: 'activity' as const,
      label: 'Cảm giác thực',
      value: `${Math.round(weather.feelsLikeC)}°C`,
      detail:
        diffTemp > 0
          ? `Oi hơn +${diffTemp}°`
          : diffTemp < 0
            ? `Lạnh hơn ${diffTemp}°`
            : 'Sát thực tế',
    },
    {
      id: 'rain',
      icon: 'umbrella' as const,
      label: 'Lượng mưa',
      value: `${Math.round(weather.precipProbPct)}%`,
      detail: `${weather.precipMmPerHr.toFixed(1)} mm/h`,
    },
    {
      id: 'wind',
      icon: 'wind' as const,
      label: 'Sức gió',
      value: `${Math.round(weather.windGustKmh)} km/h`,
      detail: `Gió đều ${Math.round(weather.windSpeedKmh)} km/h`,
    },
    {
      id: 'uv',
      icon: (weather.isDay ? 'sun' : 'moon') as 'sun' | 'moon',
      label: 'Chỉ số UV',
      value: `${Math.round(weather.uvIndex)}`,
      detail: describeUvVi(weather.uvIndex, weather.isDay),
    },
    {
      id: 'aqi',
      icon: 'shield' as const,
      label: 'Không khí (AQI)',
      value: `${aqiMeta.valueLabel}`,
      detail: aqiMeta.note,
    },
  ];

  return (
    <View style={styles.bentoSection}>
      {/* Row 1: 12-Hour Scrollable Forecast Strip */}
      <View
        style={[
          styles.outerBezel,
          {
            backgroundColor: palette.bezelOuterBg,
            borderColor: palette.bezelOuterBorder,
          },
        ]}
      >
        <View
          style={[
            styles.innerCore,
            { backgroundColor: palette.coreSurfaceBg },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <View style={styles.headerTitleCluster}>
              <Feather name="clock" size={14} color={palette.accent} />
              <Text
                style={[styles.sectionTitle, { color: palette.inkPrimary }]}
              >
                12 giờ tới
              </Text>
            </View>
            {decision.hasRainAheadProp && decision.rainAheadHours !== null && (
              <Text style={[styles.rainNoteInline, { color: palette.accent }]}>
                Mưa sau {decision.rainAheadHours}h
              </Text>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hourlyScrollRow}
          >
            {hourly12.map((slot, index) => {
              const isRainAlertHour =
                decision.hasRainAheadProp &&
                decision.rainAheadHours === index + 1;
              const showRainProb = slot.precipProbPct >= 20;

              return (
                <View
                  key={`${slot.timeIso}_${index}`}
                  style={[
                    styles.hourColumn,
                    isRainAlertHour && {
                      backgroundColor: palette.accentSoftBg,
                      borderRadius: 16,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.hourTimeText,
                      {
                        color: isRainAlertHour
                          ? palette.accent
                          : palette.inkSecondary,
                      },
                    ]}
                  >
                    {formatHourlySlotTime(slot.timeIso, index)}
                  </Text>

                  <Feather
                    name={pickConditionIcon(slot.conditionCode, slot.timeIso)}
                    size={18}
                    color={
                      showRainProb ? palette.accent : palette.inkPrimary
                    }
                  />

                  <Text
                    style={[
                      styles.hourRainPct,
                      {
                        color: showRainProb
                          ? palette.accent
                          : 'transparent',
                      },
                    ]}
                  >
                    {Math.round(slot.precipProbPct)}%
                  </Text>

                  <Text
                    style={[
                      styles.hourTempText,
                      { color: palette.inkPrimary },
                    ]}
                  >
                    {Math.round(slot.temperatureC)}°
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Row 2: 6-Metric Hairline Bento Telemetry Surface */}
      <View
        style={[
          styles.outerBezel,
          {
            backgroundColor: palette.bezelOuterBg,
            borderColor: palette.bezelOuterBorder,
          },
        ]}
      >
        <View
          style={[
            styles.innerCoreGridWrap,
            { backgroundColor: palette.coreSurfaceBg },
          ]}
        >
          <View style={styles.metricsGrid}>
            {metrics.map((m, idx) => {
              const cols = isWide ? 3 : 2;
              const isRightEdge = (idx + 1) % cols === 0;
              const totalRows = Math.ceil(metrics.length / cols);
              const currentRow = Math.floor(idx / cols) + 1;
              const isBottomRow = currentRow === totalRows;

              return (
                <View
                  key={m.id}
                  style={[
                    styles.metricCell,
                    {
                      width: isWide ? '33.333%' : '50%',
                      borderRightWidth: isRightEdge ? 0 : 1,
                      borderBottomWidth: isBottomRow ? 0 : 1,
                      borderColor: palette.hairline,
                    },
                  ]}
                >
                  <View style={styles.metricLabelRow}>
                    <Feather
                      name={m.icon}
                      size={13}
                      color={palette.inkMuted}
                    />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.metricLabel,
                        { color: palette.inkSecondary },
                      ]}
                    >
                      {m.label}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.metricValue,
                      { color: palette.inkPrimary },
                    ]}
                  >
                    {m.value}
                  </Text>

                  <Text
                    numberOfLines={1}
                    style={[
                      styles.metricDetail,
                      { color: palette.inkMuted },
                    ]}
                  >
                    {m.detail}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bentoSection: {
    width: '100%',
    gap: 16,
  },
  outerBezel: {
    padding: 5,
    borderRadius: 28,
    borderWidth: 1,
  },
  innerCore: {
    borderRadius: 23,
    paddingVertical: 18,
    paddingHorizontal: 18,
    gap: 14,
  },
  innerCoreGridWrap: {
    borderRadius: 23,
    overflow: 'hidden',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerTitleCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 14.5,
    fontWeight: '700',
  },
  rainNoteInline: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '700',
  },
  hourlyScrollRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 8,
  },
  hourColumn: {
    minWidth: 62,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 7,
  },
  hourTimeText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  hourRainPct: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  hourTempText: {
    fontFamily: FONT_FAMILY_DISPLAY,
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metricCell: {
    paddingVertical: 18,
    paddingHorizontal: 18,
    gap: 6,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricLabel: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '600',
    flexShrink: 1,
  },
  metricValue: {
    fontFamily: FONT_FAMILY_DISPLAY,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  metricDetail: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '500',
  },
});

/* Lucian UX/UI Prompt #047 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#047 */

import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type {
  CharacterDecision,
  CharacterSceneId,
  Gender,
  HourlyForecastPoint,
  ThermalSensitivity,
  WeatherSnapshot,
} from '../core';
import { LivingCharacterRig } from './LivingCharacterRig';
import { LucianForecastTrend047 } from '../lucian/LucianStageWidgets';
import {
  FONT_FAMILY_DISPLAY,
  FONT_FAMILY_SANS,
  sanitizeCopy,
  WEB_NO_OUTLINE,
  type AtmosphericPalette,
} from './themeTokens';

interface CharacterStageCardProps {
  palette: AtmosphericPalette;
  weather: WeatherSnapshot;
  decision: CharacterDecision;
  gender: Gender;
  sensitivity: ThermalSensitivity;
  reduceMotion: boolean;
}

function resolveOutfitChipIcon(
  sceneId: CharacterSceneId,
  hasRainAhead: boolean
): React.ComponentProps<typeof Feather>['name'] {
  if (
    hasRainAhead ||
    sceneId === 'light_rain_umbrella' ||
    sceneId === 'storm_raincoat'
  ) {
    return 'umbrella';
  }
  if (sceneId === 'clear_night') {
    return 'moon';
  }
  if (sceneId === 'chilly_cozy' || sceneId === 'freezing_puffer') {
    return 'wind';
  }
  return 'sun';
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

export const CharacterStageCard: React.FC<CharacterStageCardProps> = ({
  palette,
  weather,
  decision,
  gender,
  sensitivity,
  reduceMotion,
}) => {
  const { width } = useWindowDimensions();
  const isSplitDesktop = width >= 900;
  const isCompactMobile = width < 420;
  const [selectedHourIdx, setSelectedHourIdx] = useState<number>(0);

  const hourly12: HourlyForecastPoint[] = useMemo(
    () => (weather.hourly ?? []).slice(0, 12),
    [weather.hourly]
  );

  const { hiTemp, loTemp } = useMemo(() => {
    const temps = [
      weather.temperatureC,
      ...hourly12.map((h) => h.temperatureC),
    ];
    return {
      hiTemp: Math.round(Math.max(...temps)),
      loTemp: Math.round(Math.min(...temps)),
    };
  }, [weather.temperatureC, hourly12]);

  const sensitivityTag =
    sensitivity === 'cold_sensitive'
      ? 'Sợ lạnh'
      : sensitivity === 'heat_sensitive'
        ? 'Sợ nóng'
        : null;

  const spriteSize = isSplitDesktop
    ? 296
    : Math.min(264, Math.max(208, width - 96));

  const outfitIcon = resolveOutfitChipIcon(
    decision.sceneId,
    decision.hasRainAheadProp
  );

  const activeHourPoint = hourly12[selectedHourIdx] ?? hourly12[0] ?? null;

  return (
    <View
      style={[
        styles.heroBentoGrid,
        isSplitDesktop ? styles.heroSplitRow : styles.heroVerticalStack,
      ]}
    >
      {/* Left Hero Bento Card: Badge + 76px Tabular Temp + Practical Chips + Integrated 12h Interactive Forecast Timeline */}
      <View
        style={[
          styles.outerBezel,
          styles.leftHeroCol,
          {
            backgroundColor: palette.bezelOuterBg,
            borderColor: palette.bezelOuterBorder,
          },
        ]}
      >
        <View
          style={[
            styles.leftHeroInner,
            isCompactMobile && styles.leftHeroInnerCompact,
            { backgroundColor: palette.coreSurfaceBg },
          ]}
        >
          {/* Top Status & Location Row */}
          <View style={styles.conditionChipRow}>
            <View
              style={[
                styles.scenePill,
                {
                  backgroundColor: palette.accentSoftBg,
                },
              ]}
            >
              <Text style={[styles.scenePillText, { color: palette.accent }]}>
                {sanitizeCopy(decision.badgeVi)}
              </Text>
            </View>

            {sensitivityTag && (
              <View
                style={[
                  styles.subtleMetaPill,
                  {
                    backgroundColor: palette.pillIdleBg,
                    borderColor: palette.bezelOuterBorder,
                  },
                ]}
              >
                <Text
                  style={[styles.sensitivityHint, { color: palette.inkSecondary }]}
                >
                  {sensitivityTag}
                </Text>
              </View>
            )}

            <View
              style={[
                styles.subtleMetaPill,
                {
                  backgroundColor: palette.pillIdleBg,
                  borderColor: palette.hairline,
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.locationTagText, { color: palette.inkMuted }]}
              >
                {sanitizeCopy(weather.locationName)}
              </Text>
            </View>
          </View>

          {/* Giant 76px Tabular Temperature + Crisp Condition + High/Low/Feels-like Row */}
          <View style={styles.tempNumeralRow}>
            <Text
              style={[
                styles.oversizedTemp,
                isCompactMobile && styles.oversizedTempMobile,
                { color: palette.inkPrimary },
              ]}
            >
              {Math.round(weather.temperatureC)}°
            </Text>

            <View style={styles.tempMetaColumn}>
              <Text
                numberOfLines={2}
                style={[styles.conditionHeadline, { color: palette.inkPrimary }]}
              >
                {sanitizeCopy(weather.conditionText)}
              </Text>
              <Text
                style={[styles.feelsLikeMeta, { color: palette.inkSecondary }]}
              >
                Cảm giác {Math.round(weather.feelsLikeC)}° · Cao {hiTemp}° · Thấp{' '}
                {loTemp}°
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.headlineSummary, { color: palette.inkMuted }]}
              >
                {sanitizeCopy(decision.headlineVi)}
              </Text>
            </View>
          </View>

          {/* Compact Practical Advice & Rain-Ahead / AQI Pills */}
          <View style={styles.factualChipsRow}>
            <View
              style={[
                styles.outfitChip,
                {
                  backgroundColor: palette.coreElevatedBg,
                  borderColor: palette.bezelOuterBorder,
                },
              ]}
            >
              <Feather name={outfitIcon} size={13} color={palette.accent} />
              <Text
                numberOfLines={2}
                style={[styles.outfitChipText, { color: palette.inkPrimary }]}
              >
                {sanitizeCopy(decision.outfitAdviceVi)}
              </Text>
            </View>

            {decision.hasRainAheadProp && (
              <View
                style={[
                  styles.alertChip,
                  {
                    backgroundColor: palette.rainAlertBg,
                    borderColor: palette.rainAlertBorder,
                  },
                ]}
              >
                <Text
                  style={[styles.alertChipText, { color: palette.rainAlertInk }]}
                >
                  ☔ Mưa sau {decision.rainAheadHours ?? 3}h
                </Text>
              </View>
            )}

            {decision.hasAqiMask && (
              <View
                style={[
                  styles.alertChip,
                  {
                    backgroundColor: palette.aqiAlertBg,
                    borderColor: palette.aqiAlertBorder,
                  },
                ]}
              >
                <Text
                  style={[styles.alertChipText, { color: palette.aqiAlertInk }]}
                >
                  😷 AQI cao
                </Text>
              </View>
            )}
          </View>

          {/* Hairline Divider */}
          <View
            style={[
              styles.sectionDivider,
              { backgroundColor: palette.hairline },
            ]}
          />

          {/* Integrated 12-Hour Interactive Forecast Timeline inside Left Hero Bento Card */}
          <View style={styles.timelineBlock}>
            <View style={styles.timelineHeaderRow}>
              <View style={styles.timelineTitleCluster}>
                <Feather name="clock" size={13} color={palette.accent} />
                <Text
                  style={[styles.timelineTitle, { color: palette.inkPrimary }]}
                >
                  Dòng thời gian 12 giờ tới
                </Text>
              </View>

              {activeHourPoint ? (
                <Text
                  style={[
                    styles.timelineSelectedMeta,
                    { color: palette.inkSecondary },
                  ]}
                >
                  {formatHourlySlotTime(
                    activeHourPoint.timeIso,
                    selectedHourIdx
                  )}{' '}
                  · {Math.round(activeHourPoint.temperatureC)}°C · Mưa{' '}
                  {Math.round(activeHourPoint.precipProbPct)}%
                </Text>
              ) : null}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hourlyScrollRow}
            >
              {hourly12.map((slot, index) => {
                const isSelected = index === selectedHourIdx;
                const isRainAlertHour =
                  decision.hasRainAheadProp &&
                  decision.rainAheadHours === index + 1;
                const showRainProb = slot.precipProbPct >= 15;

                return (
                  <Pressable
                    key={`${slot.timeIso}_${index}`}
                    onPress={() => setSelectedHourIdx(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`Dự báo ${formatHourlySlotTime(slot.timeIso, index)}, ${Math.round(slot.temperatureC)} độ, xác suất mưa ${Math.round(slot.precipProbPct)} phần trăm`}
                    style={[
                      styles.hourPill,
                      WEB_NO_OUTLINE,
                      {
                        backgroundColor: isSelected
                          ? palette.coreElevatedBg
                          : isRainAlertHour
                            ? palette.accentSoftBg
                            : 'transparent',
                        borderColor: isSelected
                          ? palette.accent
                          : isRainAlertHour
                            ? palette.bezelOuterBorder
                            : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.hourTimeText,
                        {
                          color:
                            isSelected || isRainAlertHour
                              ? palette.accent
                              : palette.inkSecondary,
                        },
                      ]}
                    >
                      {formatHourlySlotTime(slot.timeIso, index)}
                    </Text>

                    <Feather
                      name={pickConditionIcon(slot.conditionCode, slot.timeIso)}
                      size={17}
                      color={
                        showRainProb || isSelected
                          ? palette.accent
                          : palette.inkPrimary
                      }
                    />

                    <Text
                      style={[
                        styles.hourRainPct,
                        {
                          color: showRainProb
                            ? palette.accent
                            : palette.inkMuted,
                          opacity: showRainProb ? 1 : 0.45,
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
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Ported Lucian #047 Period Segmented Control + Cubic-Bezier Forecast Trend */}
            <LucianForecastTrend047
              palette={palette}
              weather={weather}
              decision={decision}
              reduceMotion={reduceMotion}
            />
          </View>
        </View>
      </View>

      {/* Right Hero Stage Pedestal: Flagship Atmospheric Collectible Showcase Framing <LivingCharacterRig /> */}
      <View
        style={[
          styles.outerBezel,
          styles.rightPedestalCol,
          isSplitDesktop && styles.rightPedestalColDesktop,
          {
            backgroundColor: palette.bezelOuterBg,
            borderColor: palette.bezelOuterBorder,
          },
        ]}
      >
        <View
          style={[
            styles.rightPedestalInner,
            { backgroundColor: palette.coreSurfaceBg },
          ]}
        >
          {/* Subtle Top Showcase Header Pill */}
          <View style={styles.pedestalTopBar}>
            <View
              style={[
                styles.pedestalBadge,
                {
                  backgroundColor: palette.coreElevatedBg,
                  borderColor: palette.hairline,
                },
              ]}
            >
              <View
                style={[
                  styles.livePulseDot,
                  { backgroundColor: palette.accent },
                ]}
              />
              <Text
                style={[
                  styles.pedestalBadgeText,
                  { color: palette.inkSecondary },
                ]}
              >
                {gender === 'male' ? 'Cậu bé Mây' : 'Cô bé Nắng'} · 60fps Live Rig
              </Text>
            </View>

            <Text
              style={[
                styles.pedestalInteractHint,
                { color: palette.inkMuted },
              ]}
            >
              Chạm để vẫy tay
            </Text>
          </View>

          {/* Dedicated Breathing Room Showcase Framing <LivingCharacterRig /> */}
          <View style={styles.characterShowcaseStage}>
            <LivingCharacterRig
              gender={gender}
              sceneId={decision.sceneId}
              palette={palette}
              size={spriteSize}
              reduceMotion={reduceMotion}
              interactive
              showAmbientProps
              npcMode
            />
          </View>

          {/* Bottom Collectible Pedestal Footer Strip */}
          <View
            style={[
              styles.pedestalFooterBar,
              {
                backgroundColor: palette.coreElevatedBg,
                borderColor: palette.hairline,
              },
            ]}
          >
            <View style={styles.pedestalFooterItem}>
              <Feather name="eye" size={12} color={palette.accent} />
              <Text
                style={[
                  styles.pedestalFooterText,
                  { color: palette.inkSecondary },
                ]}
              >
                Ánh mắt theo trỏ chuột
              </Text>
            </View>
            <View
              style={[
                styles.pedestalFooterDot,
                { backgroundColor: palette.hairline },
              ]}
            />
            <View style={styles.pedestalFooterItem}>
              <Feather name="refresh-cw" size={12} color={palette.accent} />
              <Text
                style={[
                  styles.pedestalFooterText,
                  { color: palette.inkSecondary },
                ]}
              >
                Đổi hoạt động 5 phút
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  heroBentoGrid: {
    width: '100%',
    maxWidth: '100%',
  },
  heroSplitRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 18,
  },
  heroVerticalStack: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 16,
  },
  outerBezel: {
    padding: 5,
    borderRadius: 28,
    borderWidth: 1,
    maxWidth: '100%',
  },
  leftHeroCol: {
    flex: 1.28,
    minWidth: 0,
  },
  leftHeroInner: {
    flex: 1,
    borderRadius: 23,
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 14,
  },
  leftHeroInnerCompact: {
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 12,
  },
  conditionChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  scenePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  scenePillText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '700',
  },
  subtleMetaPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '100%',
  },
  sensitivityHint: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '600',
  },
  locationTagText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '600',
  },
  tempNumeralRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
  },
  oversizedTemp: {
    fontFamily: FONT_FAMILY_DISPLAY,
    fontSize: 76,
    lineHeight: 82,
    fontWeight: '700',
    letterSpacing: -3.2,
    fontVariant: ['tabular-nums'],
  },
  oversizedTempMobile: {
    fontSize: 66,
    lineHeight: 72,
  },
  tempMetaColumn: {
    flex: 1,
    minWidth: 170,
    gap: 3,
  },
  conditionHeadline: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 18.5,
    lineHeight: 24,
    fontWeight: '700',
  },
  feelsLikeMeta: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  headlineSummary: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '500',
  },
  factualChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  outfitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '100%',
  },
  outfitChipText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  alertChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  alertChipText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '700',
  },
  sectionDivider: {
    height: 1,
    width: '100%',
    marginVertical: 2,
  },
  timelineBlock: {
    gap: 11,
    width: '100%',
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  timelineTitleCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timelineTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13.5,
    fontWeight: '700',
  },
  timelineSelectedMeta: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  hourlyScrollRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 6,
  },
  hourPill: {
    minWidth: 58,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  hourTimeText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  hourRainPct: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 10.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  hourTempText: {
    fontFamily: FONT_FAMILY_DISPLAY,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  rightPedestalCol: {
    flex: 0.92,
    minWidth: 0,
  },
  rightPedestalColDesktop: {
    minWidth: 348,
  },
  rightPedestalInner: {
    flex: 1,
    borderRadius: 23,
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  pedestalTopBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  pedestalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  pedestalBadgeText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '700',
  },
  pedestalInteractHint: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    fontWeight: '600',
  },
  characterShowcaseStage: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  pedestalFooterBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  pedestalFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pedestalFooterDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  pedestalFooterText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    fontWeight: '600',
  },
});

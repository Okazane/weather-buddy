import React, { useMemo } from 'react';
import {
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
  ThermalSensitivity,
  WeatherSnapshot,
} from '../core';
import { LivingCharacterRig } from './LivingCharacterRig';
import {
  FONT_FAMILY_DISPLAY,
  FONT_FAMILY_SANS,
  sanitizeCopy,
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

  const { hiTemp, loTemp } = useMemo(() => {
    const temps = [
      weather.temperatureC,
      ...(weather.hourly ?? []).slice(0, 12).map((h) => h.temperatureC),
    ];
    return {
      hiTemp: Math.round(Math.max(...temps)),
      loTemp: Math.round(Math.min(...temps)),
    };
  }, [weather]);

  const sensitivityTag =
    sensitivity === 'cold_sensitive'
      ? 'Sợ lạnh'
      : sensitivity === 'heat_sensitive'
        ? 'Sợ nóng'
        : null;

  const spriteSize = isSplitDesktop
    ? 296
    : Math.min(264, Math.max(216, width - 104));

  const outfitIcon = resolveOutfitChipIcon(
    decision.sceneId,
    decision.hasRainAheadProp
  );

  return (
    <View
      style={[
        styles.heroContainer,
        isSplitDesktop ? styles.heroSplitRow : styles.heroVerticalStack,
      ]}
    >
      {/* Left Column: Clean Badge + Giant Tabular Temp + Crisp Condition + Factual Chips */}
      <View
        style={[
          styles.telemetryCol,
          isSplitDesktop && styles.telemetryColDesktop,
        ]}
      >
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
        </View>

        <View style={styles.tempNumeralRow}>
          <Text style={[styles.oversizedTemp, { color: palette.inkPrimary }]}>
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
          </View>
        </View>

        {/* Compact Factual Chips Only (Zero AI Speech Capsule!) */}
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
      </View>

      {/* Right Column: Autonomous Chibi NPC Stage (Stands Up On Tap) */}
      <View
        style={[
          styles.stagePedestalCol,
          isSplitDesktop && styles.stagePedestalColDesktop,
        ]}
      >
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
    </View>
  );
};

const styles = StyleSheet.create({
  heroContainer: {
    width: '100%',
    paddingTop: 4,
    paddingBottom: 4,
  },
  heroSplitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 28,
  },
  heroVerticalStack: {
    flexDirection: 'column-reverse',
    alignItems: 'stretch',
    gap: 14,
  },
  telemetryCol: {
    flex: 1,
    gap: 14,
  },
  telemetryColDesktop: {
    maxWidth: 560,
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
  },
  sensitivityHint: {
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
    fontSize: 84,
    lineHeight: 90,
    fontWeight: '700',
    letterSpacing: -3.4,
    fontVariant: ['tabular-nums'],
  },
  tempMetaColumn: {
    flex: 1,
    minWidth: 180,
    gap: 4,
  },
  conditionHeadline: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '700',
  },
  feelsLikeMeta: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 14,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  factualChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 2,
  },
  outfitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '100%',
  },
  outfitChipText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13.5,
    fontWeight: '600',
    flexShrink: 1,
  },
  alertChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  alertChipText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13,
    fontWeight: '700',
  },
  stagePedestalCol: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  stagePedestalColDesktop: {
    minWidth: 336,
  },
});

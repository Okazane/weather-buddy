import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type {
  CharacterDecision,
  Gender,
  ThermalSensitivity,
  WeatherSnapshot,
} from '../core';
import type { ScenarioSelection } from '../hooks/useWeatherBuddy';
import { CharacterStageCard } from '../components/CharacterStageCard';
import { ScenarioStrip } from '../components/ScenarioStrip';
import { WeatherBentoTelemetry } from '../components/WeatherBentoTelemetry';
import {
  FONT_FAMILY_SANS,
  sanitizeCopy,
  type AtmosphericPalette,
} from '../components/themeTokens';

interface MainStageScreenProps {
  palette: AtmosphericPalette;
  weather: WeatherSnapshot;
  decision: CharacterDecision;
  gender: Gender;
  sensitivity: ThermalSensitivity;
  activeScenarioId: ScenarioSelection;
  onSelectScenario: (scenario: ScenarioSelection) => void;
  gpsError: string | null;
  liveError: string | null;
  reduceMotion: boolean;
}

export const MainStageScreen: React.FC<MainStageScreenProps> = ({
  palette,
  weather,
  decision,
  gender,
  sensitivity,
  activeScenarioId,
  onSelectScenario,
  gpsError,
  liveError,
  reduceMotion,
}) => {
  const bannerMessage = gpsError || (activeScenarioId === 'live' ? liveError : null);

  return (
    <View style={styles.screenStack}>
      {bannerMessage && (
        <View
          style={[
            styles.noticeBanner,
            {
              backgroundColor: palette.coreElevatedBg,
              borderColor: palette.bezelOuterBorder,
            },
          ]}
        >
          <Text style={[styles.noticeText, { color: palette.inkPrimary }]}>
            {sanitizeCopy(bannerMessage)}
          </Text>
        </View>
      )}

      {/* Interactive Scenario Strip right near top so users can test every weather & character outfit effortlessly */}
      <ScenarioStrip
        palette={palette}
        activeScenarioId={activeScenarioId}
        onSelectScenario={onSelectScenario}
      />

      {/* Centerpiece 2.5D Character + Oversized Temperature + Speech Capsule */}
      <CharacterStageCard
        palette={palette}
        weather={weather}
        decision={decision}
        gender={gender}
        sensitivity={sensitivity}
        reduceMotion={reduceMotion}
      />

      {/* 12-Hour Forecast + 6-Metric Hairline Bento */}
      <WeatherBentoTelemetry
        palette={palette}
        weather={weather}
        decision={decision}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screenStack: {
    width: '100%',
    gap: 20,
    paddingBottom: 32,
  },
  noticeBanner: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 1,
  },
  noticeText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13,
    fontWeight: '600',
  },
});

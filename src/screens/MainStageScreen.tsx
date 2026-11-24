/* Lucian UX/UI Prompt #094 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#094 */
/* Lucian UX/UI Prompt #228 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#228 */
/* Lucian UX/UI Prompt #047 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#047 */
/* Lucian UX/UI Prompt #096 & #095 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#096 · https://lucianlabs.dev/uxui-prompt/#095 */

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
import { LucianInteractiveForecastChart } from '../lucian/LucianInteractiveForecastChart';
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
  const bannerMessage =
    gpsError || (activeScenarioId === 'live' ? liveError : null);

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

      {/* Row 1: Asymmetric 2-Column Editorial Hero Grid (Left: 76px Temp + Integrated 12h Timeline + Lucian #047 · Right: Flagship 60fps Chibi Stage Pedestal) */}
      <CharacterStageCard
        palette={palette}
        weather={weather}
        decision={decision}
        gender={gender}
        sensitivity={sensitivity}
        reduceMotion={reduceMotion}
      />

      {/* Row 2: Full-Width 3-Column Bento Forecast Charts (Lucian #096 & #095) */}
      <LucianInteractiveForecastChart
        palette={palette}
        weather={weather}
        decision={decision}
        reduceMotion={reduceMotion}
      />

      {/* Row 3: Lucian #094 Interactive 24h Sky Scrubber + Lucian #228 Cursor-Lit 6-Metric Weather Telemetry Bento */}
      <WeatherBentoTelemetry
        palette={palette}
        weather={weather}
        decision={decision}
        reduceMotion={reduceMotion}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screenStack: {
    width: '100%',
    maxWidth: '100%',
    gap: 18,
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

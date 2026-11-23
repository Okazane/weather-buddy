import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DEMO_SCENARIO_LIST } from '../core';
import type { ScenarioSelection } from '../hooks/useWeatherBuddy';
import {
  FONT_FAMILY_SANS,
  WEB_NO_OUTLINE,
  type AtmosphericPalette,
} from './themeTokens';

interface ScenarioStripProps {
  palette: AtmosphericPalette;
  activeScenarioId: ScenarioSelection;
  onSelectScenario: (scenario: ScenarioSelection) => void;
}

export const ScenarioStrip: React.FC<ScenarioStripProps> = ({
  palette,
  activeScenarioId,
  onSelectScenario,
}) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: activeScenarioId === 'live' }}
          onPress={() => onSelectScenario('live')}
          style={({ pressed }) => [
            styles.chip,
            WEB_NO_OUTLINE,
            {
              backgroundColor:
                activeScenarioId === 'live'
                  ? palette.pillActiveBg
                  : palette.pillIdleBg,
              borderColor:
                activeScenarioId === 'live'
                  ? palette.pillActiveBg
                  : palette.bezelOuterBorder,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            },
          ]}
        >
          <Text
            style={[
              styles.chipText,
              {
                color:
                  activeScenarioId === 'live'
                    ? palette.pillActiveInk
                    : palette.inkPrimary,
              },
            ]}
          >
            Trực tiếp
          </Text>
        </Pressable>

        {DEMO_SCENARIO_LIST.map((item) => {
          const isSelected = activeScenarioId === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelectScenario(item.id)}
              style={({ pressed }) => [
                styles.chip,
                WEB_NO_OUTLINE,
                {
                  backgroundColor: isSelected
                    ? palette.pillActiveBg
                    : palette.pillIdleBg,
                  borderColor: isSelected
                    ? palette.pillActiveBg
                    : palette.bezelOuterBorder,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: isSelected
                      ? palette.pillActiveInk
                      : palette.inkPrimary,
                  },
                ]}
              >
                {item.emoji} {item.labelVi}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
    paddingRight: 16,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '600',
  },
});

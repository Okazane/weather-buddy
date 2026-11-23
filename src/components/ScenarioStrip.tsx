import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { DEMO_SCENARIO_LIST } from '../core';
import type { ScenarioSelection } from '../hooks/useWeatherBuddy';
import {
  LucianScenarioChipBar,
  type LucianScenarioChipItem,
} from '../lucian/LucianNavComponents';
import type { AtmosphericPalette } from './themeTokens';

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
  const scenarioItems = useMemo<
    ReadonlyArray<LucianScenarioChipItem<ScenarioSelection>>
  >(
    () => [
      {
        id: 'live',
        label: 'Trực tiếp',
        isLive: true,
      },
      ...DEMO_SCENARIO_LIST.map((item) => ({
        id: item.id as ScenarioSelection,
        label: `${item.emoji} ${item.labelVi}`,
      })),
    ],
    []
  );

  return (
    <View style={styles.container}>
      <LucianScenarioChipBar
        items={scenarioItems}
        value={activeScenarioId}
        onChange={onSelectScenario}
        ariaLabel="Chọn kịch bản thời tiết trực tiếp hoặc kịch bản mẫu"
        palette={palette}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
});

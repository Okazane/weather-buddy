import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { DEMO_SCENARIO_LIST } from '../core';
import type { ScenarioSelection } from '../hooks/useWeatherBuddy';
import {
  LucianScenarioChipBar,
  type LucianScenarioChipItem,
} from '../lucian/LucianNavComponents';
import { ScenarioIcon } from './AppIcons';
import type { AtmosphericPalette } from './themeTokens';

interface ScenarioStripProps {
  palette: AtmosphericPalette;
  activeScenarioId: ScenarioSelection;
  onSelectScenario: (scenario: ScenarioSelection) => void;
}

/**
 * Applies Impeccable's 3-role color restraint to scenario icons so the strip stays
 * cohesive with the active sky palette instead of flashing 8 competing rainbow hues.
 */
function resolveScenarioIconColor(
  scenarioId: string,
  isSelected: boolean,
  palette: AtmosphericPalette
): string {
  if (Platform.OS !== 'web' && isSelected) {
    return palette.pillActiveInk;
  }
  switch (scenarioId) {
    case 'high_aqi_hanoi':
      return palette.isDark ? '#E5737D' : '#C4384B';
    case 'hot_uv':
    case 'heavy_storm':
      return palette.isDark ? '#E8A849' : '#B86818';
    case 'chilly_dalat':
      return palette.isDark ? '#58C49E' : '#168560';
    default:
      return isSelected ? palette.accent : palette.inkSecondary;
  }
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
      ...DEMO_SCENARIO_LIST.map((item) => {
        const isSelected = activeScenarioId === item.id;
        return {
          id: item.id as ScenarioSelection,
          label: item.labelVi,
          icon: (
            <ScenarioIcon
              scenarioId={item.id}
              isDark={palette.isDark}
              size={15}
              color={resolveScenarioIconColor(item.id, isSelected, palette)}
              weight="duotone"
            />
          ),
        };
      }),
    ],
    [activeScenarioId, palette]
  );

  const webPaletteVars = useMemo(() => {
    if (Platform.OS !== 'web') {
      return undefined;
    }
    return {
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      ['--ux-surface' as string]: palette.coreSurfaceBg,
      ['--ux-surface-2' as string]: palette.pillIdleBg,
      ['--ux-ink' as string]: palette.inkPrimary,
      ['--ux-ink-2' as string]: palette.inkSecondary,
      ['--ux-line' as string]: palette.bezelOuterBorder,
      ['--ux-line-2' as string]: palette.hairline,
      ['--ux-accent' as string]: palette.accent,
      ['--ux-mint' as string]: palette.isDark ? '#58C49E' : '#168560',
    } as React.CSSProperties;
  }, [palette]);

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        <div style={webPaletteVars}>
          <LucianScenarioChipBar
            items={scenarioItems}
            value={activeScenarioId}
            onChange={onSelectScenario}
            ariaLabel="Chọn kịch bản thời tiết trực tiếp hoặc kịch bản mẫu"
            palette={palette}
          />
        </div>
      ) : (
        <LucianScenarioChipBar
          items={scenarioItems}
          value={activeScenarioId}
          onChange={onSelectScenario}
          ariaLabel="Chọn kịch bản thời tiết trực tiếp hoặc kịch bản mẫu"
          palette={palette}
        />
      )}
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

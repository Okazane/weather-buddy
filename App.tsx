import React, { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AmbientSkyBackdrop } from './src/components/AmbientSkyBackdrop';
import { SettingsModal } from './src/components/SettingsModal';
import {
  TopControlBar,
  type ActiveAppTab,
} from './src/components/TopControlBar';
import {
  resolveAppPalette,
  resolveBackdropSkyTheme,
  SKY_PALETTES,
  type AppThemeMode,
} from './src/components/themeTokens';
import { useWeatherBuddy } from './src/hooks/useWeatherBuddy';
import {
  ensureLucianTokensInjected,
  useLucianThemeSync,
} from './src/lucian/lucianTokens';
import { FeatureHubScreen } from './src/screens/FeatureHubScreen';
import { MainStageScreen } from './src/screens/MainStageScreen';
import { WebDashboardScreen } from './src/screens/WebDashboardScreen';
import { WidgetStudioScreen } from './src/screens/WidgetStudioScreen';

const THEME_MODE_STORAGE_KEY = 'weather_buddy_theme_mode_v1';

function loadInitialThemeMode(): AppThemeMode {
  try {
    const scope = globalThis as unknown as {
      localStorage?: { getItem(key: string): string | null };
    };
    const saved = scope.localStorage?.getItem(THEME_MODE_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'auto') {
      return saved;
    }
  } catch {
    // Ignore storage read errors in restricted environments
  }
  return 'auto';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveAppTab>('stage');
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [themeMode, setThemeModeState] = useState<AppThemeMode>(loadInitialThemeMode);

  const setThemeMode = useCallback((next: AppThemeMode) => {
    setThemeModeState(next);
    try {
      const scope = globalThis as unknown as {
        localStorage?: { setItem(key: string, val: string): void };
      };
      scope.localStorage?.setItem(THEME_MODE_STORAGE_KEY, next);
    } catch {
      // Ignore storage write errors
    }
  }, []);

  const { width } = useWindowDimensions();
  const isNarrowMobile = width < 480;
  const isWideDesktop = width >= 1080;

  const buddy = useWeatherBuddy();
  const skyIsNaturallyDark =
    SKY_PALETTES[buddy.decision.skyTheme]?.isDark ?? false;
  const backdropSkyTheme = resolveBackdropSkyTheme(
    buddy.decision.skyTheme,
    themeMode
  );
  const palette = resolveAppPalette(buddy.decision.skyTheme, themeMode);

  // Sync Lucian UX/UI `--ux-*` light/dark tokens & `[data-theme="light"|"dark"]` on Web
  useLucianThemeSync(themeMode, skyIsNaturallyDark, palette);

  // Inject Plus Jakarta Sans geometric web font + zero horizontal overflow guard on Web
  useEffect(() => {
    ensureLucianTokensInjected();
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }
    const existing = document.getElementById('weather-buddy-web-typography');
    if (existing) {
      return;
    }
    const styleEl = document.createElement('style');
    styleEl.id = 'weather-buddy-web-typography';
    styleEl.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
      html, body, #root {
        min-height: 100dvh;
        max-width: 100vw;
        overflow-x: clip;
        margin: 0;
        padding: 0;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      * {
        box-sizing: border-box;
      }
    `;
    document.head.appendChild(styleEl);
  }, []);

  return (
    <AmbientSkyBackdrop
      skyTheme={backdropSkyTheme}
      sceneId={buddy.decision.sceneId}
      reduceMotion={buddy.reduceMotion}
    >
      <StatusBar style={palette.isDark ? 'light' : 'dark'} />

      <SafeAreaView style={styles.safeRoot}>
        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={[
            styles.scrollContent,
            isNarrowMobile && styles.scrollContentMobile,
            isWideDesktop && styles.scrollContentDesktop,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.centeredMaxShell,
              isNarrowMobile && styles.centeredMaxShellMobile,
              isWideDesktop && styles.centeredMaxShellDesktop,
            ]}
          >
            <View style={styles.headerStickyZone}>
              <TopControlBar
                palette={palette}
                activeTab={activeTab}
                onSelectTab={setActiveTab}
                gender={buddy.gender}
                onSelectGender={buddy.setGender}
                selectedCityId={buddy.selectedCityId}
                activeWeather={buddy.activeWeather}
                isLiveMode={buddy.activeScenarioId === 'live'}
                isLoadingLive={buddy.isLoadingLive}
                gpsLoading={buddy.gpsLoading}
                onSelectPresetCity={buddy.selectPresetCity}
                onRequestGps={buddy.requestDeviceLocation}
                onRefreshLive={buddy.refreshLiveWeather}
                onOpenSettings={() => setSettingsOpen(true)}
                themeMode={themeMode}
                onSelectThemeMode={setThemeMode}
              />
            </View>

            <View style={styles.contentMainZone}>
              {activeTab === 'stage' ? (
                <MainStageScreen
                  palette={palette}
                  weather={buddy.activeWeather}
                  decision={buddy.decision}
                  gender={buddy.gender}
                  sensitivity={buddy.sensitivity}
                  activeScenarioId={buddy.activeScenarioId}
                  onSelectScenario={buddy.setActiveScenarioId}
                  gpsError={buddy.gpsError}
                  liveError={buddy.liveError}
                  reduceMotion={buddy.reduceMotion}
                />
              ) : activeTab === 'hub' ? (
                <FeatureHubScreen
                  palette={palette}
                  weather={buddy.activeWeather}
                  decision={buddy.decision}
                  gender={buddy.gender}
                  onSelectGender={buddy.setGender}
                  sensitivity={buddy.sensitivity}
                  onSelectSensitivity={buddy.setSensitivity}
                  reduceMotion={buddy.reduceMotion}
                  onJumpToMobileWidgets={() => setActiveTab('widgets')}
                />
              ) : activeTab === 'widgets' ? (
                <WidgetStudioScreen
                  palette={palette}
                  payload={buddy.widgetPayload}
                  activeScenarioId={buddy.activeScenarioId}
                  onSelectScenario={buddy.setActiveScenarioId}
                  lastWidgetSync={buddy.lastWidgetSync}
                  onManualSync={buddy.triggerManualWidgetSync}
                />
              ) : (
                <WebDashboardScreen
                  palette={palette}
                  weather={buddy.activeWeather}
                  decision={buddy.decision}
                  gender={buddy.gender}
                  sensitivity={buddy.sensitivity}
                  selectedCityId={buddy.selectedCityId}
                  onSelectPresetCity={buddy.selectPresetCity}
                  onRequestGps={buddy.requestDeviceLocation}
                  gpsLoading={buddy.gpsLoading}
                  providerPref={buddy.providerPref}
                  tomorrowIoApiKey={buddy.tomorrowIoApiKey}
                  weatherApiKey={buddy.weatherApiKey}
                  googleApiKey={buddy.googleApiKey}
                />
              )}
            </View>
          </View>
        </ScrollView>

        <SettingsModal
          visible={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          sensitivity={buddy.sensitivity}
          onSelectSensitivity={buddy.setSensitivity}
          providerPref={buddy.providerPref}
          onSelectProvider={buddy.setProviderPref}
          tomorrowIoApiKey={buddy.tomorrowIoApiKey}
          onSaveTomorrowIoApiKey={buddy.setTomorrowIoApiKey}
          weatherApiKey={buddy.weatherApiKey}
          onSaveWeatherApiKey={buddy.setWeatherApiKey}
          googleApiKey={buddy.googleApiKey}
          onSaveGoogleApiKey={buddy.setGoogleApiKey}
          activeWeather={buddy.activeWeather}
          isLiveMode={buddy.activeScenarioId === 'live'}
          liveError={buddy.liveError}
        />
      </SafeAreaView>
    </AmbientSkyBackdrop>
  );
}

const styles = StyleSheet.create({
  safeRoot: {
    flex: 1,
    minWidth: 0,
  },
  mainScroll: {
    flex: 1,
    minWidth: 0,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 18 : 12,
    paddingBottom: 38,
  },
  scrollContentMobile: {
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'web' ? 10 : 8,
    paddingBottom: 28,
  },
  scrollContentDesktop: {
    paddingHorizontal: 28,
    paddingTop: 22,
    paddingBottom: 44,
  },
  centeredMaxShell: {
    width: '100%',
    maxWidth: 1280,
    minWidth: 0,
    alignSelf: 'center',
    gap: 18,
  },
  centeredMaxShellMobile: {
    gap: 14,
  },
  centeredMaxShellDesktop: {
    gap: 20,
  },
  headerStickyZone: {
    width: '100%',
    minWidth: 0,
    overflow: 'visible',
    zIndex: 80,
    ...(Platform.OS === 'web'
      ? ({
          position: 'sticky',
          top: 10,
        } as any)
      : null),
  },
  contentMainZone: {
    width: '100%',
    minWidth: 0,
    zIndex: 1,
  },
});

import React, { useEffect, useState } from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AmbientSkyBackdrop } from './src/components/AmbientSkyBackdrop';
import { SettingsModal } from './src/components/SettingsModal';
import {
  TopControlBar,
  type ActiveAppTab,
} from './src/components/TopControlBar';
import { SKY_PALETTES } from './src/components/themeTokens';
import { useWeatherBuddy } from './src/hooks/useWeatherBuddy';
import { FeatureHubScreen } from './src/screens/FeatureHubScreen';
import { MainStageScreen } from './src/screens/MainStageScreen';
import { WebDashboardScreen } from './src/screens/WebDashboardScreen';
import { WidgetStudioScreen } from './src/screens/WidgetStudioScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveAppTab>('stage');
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

  const buddy = useWeatherBuddy();
  const palette =
    SKY_PALETTES[buddy.decision.skyTheme] ?? SKY_PALETTES.day_sunny;

  // Inject Plus Jakarta Sans geometric web font + smooth scrollbar & tabular numerals on Web
  useEffect(() => {
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
      skyTheme={buddy.decision.skyTheme}
      sceneId={buddy.decision.sceneId}
      reduceMotion={buddy.reduceMotion}
    >
      <StatusBar style={palette.isDark ? 'light' : 'dark'} />

      <SafeAreaView style={styles.safeRoot}>
        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.centeredMaxShell}>
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
            />

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
  },
  mainScroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'web' ? 22 : 12,
    paddingBottom: 36,
  },
  centeredMaxShell: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    gap: 18,
  },
});

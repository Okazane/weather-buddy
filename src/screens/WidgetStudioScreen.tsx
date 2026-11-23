/* Lucian UX/UI Prompt #044 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#044 */

import React, { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import type { CharacterSceneId, Gender, SkyTheme } from '../core';
import { SCENE_VISUAL_META } from '../art/characterAssets';
import { LivingCharacterRig } from '../components/LivingCharacterRig';
import {
  formatWidgetRainAlertVi,
  WIDGET_SETUP_GUIDE_VI,
  type WidgetSetupSectionVi,
  type WidgetSyncPayload,
  type WidgetSyncResult,
} from '../widgets/widgetBridge';
import type { ScenarioSelection } from '../hooks/useWeatherBuddy';
import { ScenarioStrip } from '../components/ScenarioStrip';
import {
  LucianFaqAccordion,
  useResolvedLucianDark,
  type LucianAccordionSection,
} from '../lucian/LucianHubComponents';
import {
  FONT_FAMILY_DISPLAY,
  FONT_FAMILY_SANS,
  sanitizeCopy,
  SKY_PALETTES,
  WEB_NO_OUTLINE,
  type AtmosphericPalette,
} from '../components/themeTokens';

interface WidgetStudioScreenProps {
  palette: AtmosphericPalette;
  payload: WidgetSyncPayload;
  activeScenarioId: ScenarioSelection;
  onSelectScenario: (scenario: ScenarioSelection) => void;
  lastWidgetSync: (WidgetSyncResult & { syncedAtFormatted: string }) | null;
  onManualSync: () => void;
}

function resolveLockWallpaperStops(skyTheme: string): [string, string, string] {
  switch (skyTheme) {
    case 'rain_storm':
      return ['#0A1322', '#15263E', '#223B59'];
    case 'sunset':
      return ['#191E36', '#462C46', '#8B5040'];
    case 'night':
      return ['#070D19', '#101D34', '#1A2F4D'];
    case 'dawn':
      return ['#2B2340', '#583C58', '#8F5E5B'];
    case 'day_cloudy':
      return ['#1F2F42', '#324860', '#48627D'];
    case 'day_sunny':
    default:
      return ['#163B6E', '#245899', '#3D78B8'];
  }
}

export const WidgetStudioScreen: React.FC<WidgetStudioScreenProps> = ({
  palette,
  payload,
  activeScenarioId,
  onSelectScenario,
  lastWidgetSync,
  onManualSync,
}) => {
  const { width } = useWindowDimensions();
  const isTwoColumn = width >= 960;
  const isNarrowMobile = width < 440;
  const isDark = useResolvedLucianDark(palette);

  const [standByMode, setStandByMode] = useState<boolean>(false);
  const [expandedGuideId, setExpandedGuideId] = useState<string>(
    WIDGET_SETUP_GUIDE_VI.iosLockScreen.id
  );

  const genderKey: Gender = payload.gender === 'male' ? 'male' : 'female';
  const sceneKey = (payload.sceneId as CharacterSceneId) || 'pleasant_sunny';
  const sceneMeta = SCENE_VISUAL_META[sceneKey];

  const widgetSkyKey = (payload.skyTheme as SkyTheme) || 'day_sunny';
  const widgetPalette = SKY_PALETTES[widgetSkyKey] ?? SKY_PALETTES.day_sunny;
  const lockWallpaperStops = resolveLockWallpaperStops(payload.skyTheme);

  const rawRainAlert = sanitizeCopy(formatWidgetRainAlertVi(payload));
  const cleanRainAlertText = rawRainAlert
    .replace(/^[☔☂️⛈️🎒]+\s*/u, '')
    .trim();
  const cleanBadgeText = sanitizeCopy(payload.badgeVi)
    .replace(/^[☔☂️⛈️🎒😷🌤️☀️🕶️🌡️🍂🧣❄️🌙]+\s*/u, '')
    .trim();

  const statusLine = cleanRainAlertText
    ? cleanRainAlertText
    : payload.hasAqiMask
      ? 'AQI cao'
      : cleanBadgeText;

  const statusIconName: React.ComponentProps<typeof Feather>['name'] =
    cleanRainAlertText ||
    sceneKey === 'light_rain_umbrella' ||
    sceneKey === 'storm_raincoat'
      ? 'umbrella'
      : payload.hasAqiMask
        ? 'shield'
        : sceneKey === 'clear_night' || payload.skyTheme === 'night'
          ? 'moon'
          : 'sun';

  const accordionSections: ReadonlyArray<LucianAccordionSection> = useMemo(
    () =>
      WIDGET_SETUP_GUIDE_VI.sections.map((sec: WidgetSetupSectionVi) => ({
        id: sec.id,
        tag: sec.platform,
        title: sec.titleVi,
        subtitle: sec.subtitleVi,
        steps: sec.stepsVi,
      })),
    []
  );

  const androidSurfaceBg = isDark ? '#162438' : '#EFF4FA';
  const androidPillBg = isDark ? '#213654' : '#D8E6F8';
  const androidInkPrimary = isDark ? '#F1F5FB' : '#0F172A';
  const androidInkSecondary = isDark ? '#B6C6D9' : '#334155';
  const androidCircleBg = isDark ? '#1D304B' : '#DCE8F7';

  return (
    <View style={styles.studioStack}>
      <ScenarioStrip
        palette={palette}
        activeScenarioId={activeScenarioId}
        onSelectScenario={onSelectScenario}
      />

      {/* Top Studio Control Header */}
      <View
        style={[
          styles.studioHeaderOuter,
          {
            backgroundColor: palette.bezelOuterBg,
            borderColor: palette.bezelOuterBorder,
          },
        ]}
      >
        <View
          style={[
            styles.studioHeaderCore,
            isNarrowMobile && styles.studioHeaderCoreCompact,
            { backgroundColor: palette.coreElevatedBg },
          ]}
        >
          <View style={styles.studioTitleBlock}>
            <Text style={[styles.studioTitle, { color: palette.inkPrimary }]}>
              Widget Màn hình khóa & Màn hình chính
            </Text>
            <Text style={[styles.studioSub, { color: palette.inkSecondary }]}>
              iOS WidgetKit & Android Glance · Tự động cập nhật mỗi 15 phút
            </Text>
          </View>

          <View style={styles.studioActionsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: standByMode }}
              onPress={() => setStandByMode((prev) => !prev)}
              style={({ pressed }) => [
                styles.standByToggleBtn,
                WEB_NO_OUTLINE,
                {
                  backgroundColor: standByMode
                    ? palette.pillActiveBg
                    : palette.accentSoftBg,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <Feather
                name="rotate-cw"
                size={13}
                color={standByMode ? palette.pillActiveInk : palette.accent}
              />
              <Text
                style={[
                  styles.standByToggleText,
                  {
                    color: standByMode ? palette.pillActiveInk : palette.accent,
                  },
                ]}
              >
                {standByMode ? 'Chế độ StandBy' : 'Xem StandBy ngang'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={onManualSync}
              style={({ pressed }) => [
                styles.syncNowBtn,
                WEB_NO_OUTLINE,
                {
                  backgroundColor: palette.pillActiveBg,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <Feather
                name="refresh-cw"
                size={13}
                color={palette.pillActiveInk}
              />
              <Text
                style={[
                  styles.syncNowText,
                  { color: palette.pillActiveInk },
                ]}
              >
                Đồng bộ
                {lastWidgetSync ? ` · ${lastWidgetSync.syncedAtFormatted}` : ''}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Main Preview Grid */}
      <View
        style={[
          styles.previewMainGrid,
          isTwoColumn ? styles.previewRowDesktop : styles.previewColMobile,
        ]}
      >
        {/* Column 1: iPhone Lock Screen OR StandBy */}
        <View
          style={[
            styles.deviceColumn,
            isTwoColumn ? styles.deviceColumnDesktop : styles.deviceColumnMobile,
          ]}
        >
          <Text style={[styles.frameCaption, { color: palette.inkSecondary }]}>
            {standByMode ? 'iPhone StandBy (iOS 17+)' : 'iPhone Màn hình khóa'}
          </Text>

          {!standByMode ? (
            <View style={styles.iphoneTitaniumShell}>
              <LinearGradient
                colors={lockWallpaperStops}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={styles.iphoneScreenInner}
              >
                <View style={styles.dynamicIsland} />

                <View style={styles.lockClockStack}>
                  <View style={styles.lockDateRow}>
                    <Feather
                      name="lock"
                      size={11}
                      color="rgba(248, 250, 252, 0.86)"
                    />
                    <Text style={styles.lockDateText}>Thứ Hai, 23 tháng 11</Text>
                  </View>
                  <Text style={styles.lockTimeText}>09:41</Text>
                </View>

                {/* iOS 16+ Frosted Lock Screen Widget Row */}
                <View style={styles.iosLockWidgetShelf}>
                  <View style={styles.accessoryCircular}>
                    <View style={styles.circularGaugeRing}>
                      <Text style={styles.circularEmoji}>
                        {sceneMeta?.emoji ?? '🌤️'}
                      </Text>
                      <Text style={styles.circularTempText}>
                        {payload.temperatureC}°
                      </Text>
                    </View>
                  </View>

                  <View style={styles.accessoryRectangular}>
                    <View style={styles.rectTopHeader}>
                      <Text numberOfLines={1} style={styles.rectBuddyTitle}>
                        {payload.locationName} · {payload.temperatureC}°
                      </Text>
                    </View>

                    <View style={styles.rectAlertRow}>
                      <Feather
                        name={statusIconName}
                        size={11}
                        color="#BAE6FD"
                      />
                      <Text numberOfLines={1} style={styles.rectAlertLine}>
                        {statusLine}
                      </Text>
                    </View>

                    <Text numberOfLines={1} style={styles.rectAdviceLine}>
                      {sanitizeCopy(payload.outfitAdviceVi)}
                    </Text>
                  </View>
                </View>

                <View style={styles.lockCharacterPeekWrap}>
                  <LivingCharacterRig
                    gender={genderKey}
                    sceneId={sceneKey}
                    palette={SKY_PALETTES.night}
                    size={128}
                    interactive={false}
                    showAmbientProps={false}
                    npcMode={false}
                  />
                  <View style={styles.lockLocationChip}>
                    <Feather name="navigation" size={11} color="#F8FAFC" />
                    <Text style={styles.lockLocationText}>
                      {payload.locationName} · Cảm giác {payload.feelsLikeC}°C
                    </Text>
                  </View>
                </View>

                <View style={styles.lockBottomAffordances}>
                  <View style={styles.lockBottomCircle}>
                    <Feather name="zap" size={15} color="#F8FAFC" />
                  </View>
                  <View style={styles.homeIndicatorBar} />
                  <View style={styles.lockBottomCircle}>
                    <Feather name="camera" size={15} color="#F8FAFC" />
                  </View>
                </View>
              </LinearGradient>
            </View>
          ) : (
            <View style={styles.standByHardwareShell}>
              <View style={styles.standByScreenCore}>
                <View style={styles.standByLeftClockCol}>
                  <Text style={styles.standByTime}>09:41</Text>
                  <Text style={styles.standByLocation}>
                    {payload.locationName} · {payload.temperatureC}°C
                  </Text>
                  <View style={styles.standByStatusRow}>
                    <Feather
                      name={statusIconName}
                      size={12}
                      color="#93C5FD"
                    />
                    <Text numberOfLines={2} style={styles.standByStatus}>
                      {statusLine}
                    </Text>
                  </View>
                </View>

                <View style={styles.standByRightWidgetCol}>
                  <LivingCharacterRig
                    gender={genderKey}
                    sceneId={sceneKey}
                    palette={SKY_PALETTES.night}
                    size={104}
                    interactive={false}
                    showAmbientProps={false}
                    npcMode={false}
                  />
                  <Text numberOfLines={2} style={styles.standByAdvice}>
                    {sanitizeCopy(payload.outfitAdviceVi)}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Column 2: Full-Color Home Screen Widgets */}
        <View style={styles.homeWidgetsColumn}>
          {/* Card A: iOS systemMedium */}
          <View style={styles.widgetShowcaseBlock}>
            <Text style={[styles.frameCaption, { color: palette.inkSecondary }]}>
              iOS Màn hình chính (Medium)
            </Text>

            <View
              style={[
                styles.widgetBezelTray,
                {
                  backgroundColor: palette.bezelOuterBg,
                  borderColor: palette.bezelOuterBorder,
                },
              ]}
            >
              <LinearGradient
                colors={[
                  widgetPalette.skyStops[0],
                  widgetPalette.skyStops[1],
                  widgetPalette.skyStops[2],
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.iosSystemMediumCard,
                  isNarrowMobile && styles.widgetCardCompact,
                ]}
              >
                <View style={styles.mediumTopRow}>
                  <View style={styles.mediumLeftInfo}>
                    <View style={styles.mediumLocRow}>
                      <Feather
                        name="map-pin"
                        size={12}
                        color={widgetPalette.accent}
                      />
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.mediumLocText,
                          { color: widgetPalette.inkPrimary },
                        ]}
                      >
                        {payload.locationName}
                      </Text>
                    </View>

                    <View style={styles.mediumTempRow}>
                      <Text
                        style={[
                          styles.mediumBigTemp,
                          { color: widgetPalette.inkPrimary },
                        ]}
                      >
                        {payload.temperatureC}°
                      </Text>
                      <View style={styles.mediumTempSubCol}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.mediumBuddyTag,
                            { color: widgetPalette.accent },
                          ]}
                        >
                          {sanitizeCopy(payload.headlineVi)}
                        </Text>
                        <Text
                          style={[
                            styles.mediumFeelsText,
                            { color: widgetPalette.inkSecondary },
                          ]}
                        >
                          Cảm giác {payload.feelsLikeC}°
                        </Text>
                      </View>
                    </View>

                    {(cleanRainAlertText || payload.hasAqiMask) && (
                      <View
                        style={[
                          styles.mediumAlertChip,
                          {
                            backgroundColor: payload.hasAqiMask
                              ? widgetPalette.aqiAlertBg
                              : widgetPalette.rainAlertBg,
                          },
                        ]}
                      >
                        <Feather
                          name={payload.hasAqiMask ? 'shield' : 'umbrella'}
                          size={11}
                          color={
                            payload.hasAqiMask
                              ? widgetPalette.aqiAlertInk
                              : widgetPalette.rainAlertInk
                          }
                        />
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.mediumAlertChipText,
                            {
                              color: payload.hasAqiMask
                                ? widgetPalette.aqiAlertInk
                                : widgetPalette.rainAlertInk,
                            },
                          ]}
                        >
                          {cleanRainAlertText || 'AQI cao'}
                        </Text>
                      </View>
                    )}

                    <Text
                      numberOfLines={2}
                      style={[
                        styles.mediumAdviceCopy,
                        { color: widgetPalette.inkPrimary },
                      ]}
                    >
                      {sanitizeCopy(payload.outfitAdviceVi)}
                    </Text>
                  </View>

                  <LivingCharacterRig
                    gender={genderKey}
                    sceneId={sceneKey}
                    palette={widgetPalette}
                    size={isNarrowMobile ? 96 : 114}
                    interactive={false}
                    showAmbientProps={false}
                    npcMode={false}
                  />
                </View>

                <View
                  style={[
                    styles.mediumHourlyStrip,
                    { borderTopColor: widgetPalette.hairline },
                  ]}
                >
                  {payload.hourlyMini.slice(0, 4).map((slot, i) => (
                    <View
                      key={`${slot.hourLabel}_${i}`}
                      style={styles.mediumHourSlot}
                    >
                      <Text
                        style={[
                          styles.mediumHourLabel,
                          { color: widgetPalette.inkSecondary },
                        ]}
                      >
                        {slot.hourLabel}
                      </Text>
                      <Text
                        style={[
                          styles.mediumHourTemp,
                          { color: widgetPalette.inkPrimary },
                        ]}
                      >
                        {slot.tempC}°
                      </Text>
                      <Text
                        style={[
                          styles.mediumHourRain,
                          {
                            color:
                              slot.precipProbPct >= 30
                                ? widgetPalette.accent
                                : widgetPalette.inkMuted,
                          },
                        ]}
                      >
                        {slot.precipProbPct}%
                      </Text>
                    </View>
                  ))}
                </View>
              </LinearGradient>
            </View>
          </View>

          {/* Card B: Android 12+ Jetpack Glance */}
          <View style={styles.widgetShowcaseBlock}>
            <Text style={[styles.frameCaption, { color: palette.inkSecondary }]}>
              Android 12+ Jetpack Glance
            </Text>

            <View
              style={[
                styles.widgetBezelTray,
                {
                  backgroundColor: palette.bezelOuterBg,
                  borderColor: palette.bezelOuterBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.androidGlanceCard,
                  isNarrowMobile && styles.widgetCardCompact,
                  { backgroundColor: androidSurfaceBg },
                ]}
              >
                <View style={styles.glanceTopRow}>
                  <View style={styles.glanceTextCol}>
                    <View style={styles.glanceHeaderPills}>
                      <View
                        style={[
                          styles.glanceLocationPill,
                          { backgroundColor: androidPillBg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.glanceLocationText,
                            { color: androidInkPrimary },
                          ]}
                        >
                          {payload.locationName} · {payload.temperatureC}°C
                        </Text>
                      </View>

                      {(payload.hasRainAheadProp || payload.hasAqiMask) && (
                        <View
                          style={[
                            styles.glanceAlertChip,
                            payload.hasAqiMask && styles.glanceAlertChipAqi,
                          ]}
                        >
                          <Feather
                            name={payload.hasAqiMask ? 'shield' : 'umbrella'}
                            size={11}
                            color={payload.hasAqiMask ? '#FEF2F2' : '#F8FAFC'}
                          />
                          <Text
                            style={[
                              styles.glanceAlertChipText,
                              payload.hasAqiMask &&
                                styles.glanceAlertChipTextAqi,
                            ]}
                          >
                            {cleanRainAlertText || 'AQI cao'}
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text
                      numberOfLines={2}
                      style={[
                        styles.glanceHeadline,
                        { color: androidInkPrimary },
                      ]}
                    >
                      {sanitizeCopy(payload.headlineVi)}
                    </Text>

                    <Text
                      numberOfLines={2}
                      style={[
                        styles.glanceAdvice,
                        { color: androidInkSecondary },
                      ]}
                    >
                      {sanitizeCopy(payload.outfitAdviceVi)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.glanceSpriteCircle,
                      { backgroundColor: androidCircleBg },
                    ]}
                  >
                    <LivingCharacterRig
                      gender={genderKey}
                      sceneId={sceneKey}
                      palette={isDark ? SKY_PALETTES.night : SKY_PALETTES.day_sunny}
                      size={isNarrowMobile ? 84 : 94}
                      interactive={false}
                      showAmbientProps={false}
                      npcMode={false}
                    />
                  </View>
                </View>

                <View
                  style={[
                    styles.glanceFooterRow,
                    {
                      borderTopColor: isDark
                        ? 'rgba(255, 255, 255, 0.10)'
                        : 'rgba(15, 23, 42, 0.08)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.glanceFooterMeta,
                      { color: androidInkSecondary },
                    ]}
                  >
                    Tự làm mới 15 phút
                  </Text>
                  <Text
                    style={[
                      styles.glanceFooterMeta,
                      { color: androidInkSecondary },
                    ]}
                  >
                    Cảm giác {payload.feelsLikeC}°C
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Expandable Setup & Native Build Guide — Lucian #044 FAQ Accordion */}
      <View
        style={[
          styles.guideOuterBezel,
          {
            backgroundColor: palette.bezelOuterBg,
            borderColor: palette.bezelOuterBorder,
          },
        ]}
      >
        <View
          style={[
            styles.guideInnerCore,
            isNarrowMobile && styles.studioHeaderCoreCompact,
            { backgroundColor: palette.coreElevatedBg },
          ]}
        >
          <View style={styles.guideHeaderBlock}>
            <Text style={[styles.guideMainTitle, { color: palette.inkPrimary }]}>
              {sanitizeCopy(WIDGET_SETUP_GUIDE_VI.titleVi)}
            </Text>
            <Text style={[styles.guideSummary, { color: palette.inkSecondary }]}>
              {sanitizeCopy(WIDGET_SETUP_GUIDE_VI.summaryVi)}
            </Text>
          </View>

          <LucianFaqAccordion
            sections={accordionSections}
            openId={expandedGuideId}
            onChangeOpenId={setExpandedGuideId}
            isDark={isDark}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  studioStack: {
    width: '100%',
    minWidth: 0,
    gap: 20,
    paddingBottom: 36,
  },
  studioHeaderOuter: {
    padding: 5,
    borderRadius: 28,
    borderWidth: 1,
    minWidth: 0,
  },
  studioHeaderCore: {
    borderRadius: 23,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 14,
  },
  studioHeaderCoreCompact: {
    padding: 14,
  },
  studioTitleBlock: {
    flex: 1,
    minWidth: 200,
    gap: 4,
  },
  studioTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  studioSub: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13,
  },
  studioActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  standByToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  standByToggleText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '700',
  },
  syncNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 999,
  },
  syncNowText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  previewMainGrid: {
    width: '100%',
    minWidth: 0,
    gap: 22,
  },
  previewRowDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  previewColMobile: {
    flexDirection: 'column',
  },
  deviceColumn: {
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  deviceColumnDesktop: {
    width: 356,
  },
  deviceColumnMobile: {
    width: '100%',
  },
  homeWidgetsColumn: {
    flex: 1,
    minWidth: 0,
    gap: 20,
    width: '100%',
  },
  widgetShowcaseBlock: {
    gap: 10,
    width: '100%',
    minWidth: 0,
  },
  frameCaption: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '600',
  },
  iphoneTitaniumShell: {
    width: '100%',
    maxWidth: 344,
    padding: 9,
    borderRadius: 48,
    backgroundColor: '#1E2633',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  iphoneScreenInner: {
    borderRadius: 39,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 456,
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'hidden',
  },
  dynamicIsland: {
    width: 92,
    height: 23,
    borderRadius: 999,
    backgroundColor: '#070B12',
  },
  lockClockStack: {
    alignItems: 'center',
    marginTop: 6,
    gap: 2,
  },
  lockDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  lockDateText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(248, 250, 252, 0.90)',
  },
  lockTimeText: {
    fontFamily: FONT_FAMILY_DISPLAY,
    fontSize: 58,
    lineHeight: 62,
    fontWeight: '700',
    letterSpacing: -2,
    color: '#F8FAFC',
    fontVariant: ['tabular-nums'],
  },
  iosLockWidgetShelf: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    marginTop: 6,
  },
  accessoryCircular: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularGaugeRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2.5,
    borderColor: 'rgba(248, 250, 252, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularEmoji: {
    fontSize: 14,
  },
  circularTempText: {
    fontFamily: FONT_FAMILY_DISPLAY,
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
    fontVariant: ['tabular-nums'],
  },
  accessoryRectangular: {
    flex: 1,
    minWidth: 0,
    minHeight: 66,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.30)',
    paddingHorizontal: 11,
    paddingVertical: 8,
    justifyContent: 'center',
    gap: 2,
  },
  rectTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rectBuddyTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
    fontVariant: ['tabular-nums'],
  },
  rectAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  rectAlertLine: {
    flex: 1,
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#BAE6FD',
  },
  rectAdviceLine: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(248, 250, 252, 0.86)',
  },
  lockCharacterPeekWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    gap: 6,
  },
  lockLocationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(9, 16, 29, 0.44)',
  },
  lockLocationText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  lockBottomAffordances: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
  },
  lockBottomCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeIndicatorBar: {
    width: 100,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(248, 250, 252, 0.82)',
    marginBottom: 4,
  },
  standByHardwareShell: {
    width: '100%',
    maxWidth: 380,
    padding: 8,
    borderRadius: 36,
    backgroundColor: '#1B2330',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  standByScreenCore: {
    backgroundColor: '#090E17',
    borderRadius: 28,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 200,
  },
  standByLeftClockCol: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  standByTime: {
    fontFamily: FONT_FAMILY_DISPLAY,
    fontSize: 46,
    lineHeight: 50,
    fontWeight: '700',
    color: '#FDBA74',
    letterSpacing: -1.6,
    fontVariant: ['tabular-nums'],
  },
  standByLocation: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  standByStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  standByStatus: {
    flex: 1,
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#93C5FD',
  },
  standByRightWidgetCol: {
    width: 128,
    alignItems: 'center',
    gap: 6,
  },
  standByAdvice: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 10.5,
    lineHeight: 14,
    color: '#CBD5E1',
    textAlign: 'center',
  },
  widgetBezelTray: {
    padding: 5,
    borderRadius: 30,
    borderWidth: 1,
    minWidth: 0,
  },
  iosSystemMediumCard: {
    borderRadius: 25,
    padding: 18,
    gap: 12,
  },
  widgetCardCompact: {
    padding: 13,
  },
  mediumTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  mediumLeftInfo: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  mediumLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  mediumLocText: {
    flex: 1,
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13,
    fontWeight: '700',
  },
  mediumTempRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mediumBigTemp: {
    fontFamily: FONT_FAMILY_DISPLAY,
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '700',
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  mediumTempSubCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  mediumBuddyTag: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '700',
  },
  mediumFeelsText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  mediumAlertChip: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  mediumAlertChipText: {
    flexShrink: 1,
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    fontWeight: '700',
  },
  mediumAdviceCopy: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '600',
  },
  mediumHourlyStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  mediumHourSlot: {
    alignItems: 'center',
    gap: 2,
  },
  mediumHourLabel: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  mediumHourTemp: {
    fontFamily: FONT_FAMILY_DISPLAY,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  mediumHourRain: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 10.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  androidGlanceCard: {
    borderRadius: 25,
    padding: 18,
    gap: 12,
  },
  glanceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  glanceTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  glanceHeaderPills: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  glanceLocationPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  glanceLocationText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  glanceAlertChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#102A43',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  glanceAlertChipAqi: {
    backgroundColor: '#7F1D1D',
  },
  glanceAlertChipText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  glanceAlertChipTextAqi: {
    color: '#FEF2F2',
  },
  glanceHeadline: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 14.5,
    lineHeight: 20,
    fontWeight: '700',
  },
  glanceAdvice: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    lineHeight: 18,
  },
  glanceSpriteCircle: {
    width: 98,
    height: 98,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glanceFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  glanceFooterMeta: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    fontWeight: '600',
  },
  guideOuterBezel: {
    padding: 5,
    borderRadius: 28,
    borderWidth: 1,
    minWidth: 0,
  },
  guideInnerCore: {
    borderRadius: 23,
    padding: 20,
    gap: 14,
  },
  guideHeaderBlock: {
    gap: 6,
  },
  guideMainTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  guideSummary: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13.5,
    lineHeight: 20,
  },
});

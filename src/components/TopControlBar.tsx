import React, { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  PRESET_CITIES,
  type Gender,
  type PresetCity,
  type WeatherSnapshot,
} from '../core';
import {
  LucianCityListbox,
  LucianSlidingPillSwitch,
  LucianViewTabs,
  type LucianPillOption,
  type LucianTabOption,
} from '../lucian/LucianNavComponents';
import { injectLucianElementCss } from '../lucian/lucianTokens';
import { ArrowsClockwise, Broadcast, Crosshair, Desktop, GearSix } from './AppIcons';
import {
  FONT_FAMILY_SANS,
  WEB_NO_OUTLINE,
  type AppThemeMode,
  type AtmosphericPalette,
} from './themeTokens';

export type ActiveAppTab = 'stage' | 'hub' | 'widgets' | 'dashboard';

export interface TopControlBarProps {
  palette: AtmosphericPalette;
  activeTab: ActiveAppTab;
  onSelectTab: (tab: ActiveAppTab) => void;
  gender: Gender;
  onSelectGender: (gender: Gender) => void;
  selectedCityId: string;
  customCity?: PresetCity | null;
  favoriteCities?: ReadonlyArray<PresetCity>;
  activeWeather: WeatherSnapshot;
  isLiveMode: boolean;
  isLoadingLive: boolean;
  gpsLoading: boolean;
  gpsSource?: 'gps' | 'ip' | null;
  onSelectPresetCity: (cityId: string) => void;
  onSelectCustomCity?: (city: PresetCity) => void;
  onToggleFavoriteCity?: (city: PresetCity) => void;
  onRequestGps: () => void;
  onRefreshLive: () => void;
  onOpenSettings: () => void;
  themeMode?: AppThemeMode;
  onSelectThemeMode?: (mode: AppThemeMode) => void;
  alertsSupported?: boolean;
  alertsEnabled?: boolean;
  onToggleAlerts?: () => void;
}

const TOP_BAR_WEB_CSS_ID = 'weather-buddy-top-control-css';
const TOP_BAR_WEB_CSS = `
.wb-gps-btn{display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 13px;border:0;border-radius:999px;background:var(--wb-surface,var(--ux-surface));color:var(--wb-ink,var(--ux-ink));font-size:12.5px;font-weight:700;white-space:nowrap;box-shadow:0 0 0 1px var(--wb-border,var(--ux-line)),0 4px 12px -8px var(--ux-shadow);transition:transform .3s var(--ux-spring),background-color .25s,color .25s,box-shadow .25s}
.wb-gps-btn:hover{background:var(--wb-surface-hover,var(--ux-surface-2));box-shadow:0 0 0 1.5px var(--wb-border-hover,var(--ux-line-2)),0 6px 14px -8px var(--ux-shadow)}
.wb-gps-btn:active{transform:scale(.96)}
.wb-gps-btn[aria-pressed="true"]{background:var(--wb-pill-active,var(--ux-ink));color:var(--wb-pill-active-ink,var(--ux-page));box-shadow:0 8px 18px -10px var(--ux-shadow-strong)}
.wb-gps-btn:focus-visible{outline:2px solid var(--wb-accent,var(--ux-accent));outline-offset:2px}
.wb-prov-pill{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 11px;border-radius:999px;background:var(--wb-pill-idle,var(--ux-surface-2));color:var(--wb-ink-2,var(--ux-ink-2));font-size:11.5px;font-weight:680;font-variant-numeric:tabular-nums;white-space:nowrap;box-shadow:inset 0 0 0 1px var(--wb-hairline,var(--ux-line));transition:background-color .25s,color .25s}
.wb-prov-dot{width:6.5px;height:6.5px;border-radius:50%;background:var(--wb-safe,var(--ux-mint));flex:none}
.wb-prov-dot.is-demo{background:var(--wb-accent,var(--ux-accent))}
.wb-icon-btn{display:inline-grid;place-items:center;width:38px;height:38px;padding:0;border:0;border-radius:12px;background:var(--wb-surface,var(--ux-surface));color:var(--wb-ink,var(--ux-ink));text-decoration:none;cursor:pointer;box-shadow:0 0 0 1px var(--wb-border,var(--ux-line)),0 4px 12px -8px var(--ux-shadow);transition:transform .3s var(--ux-spring),background-color .25s,box-shadow .25s,color .25s}
.wb-icon-btn:hover{background:var(--wb-surface-hover,var(--ux-surface-2));box-shadow:0 0 0 1.5px var(--wb-border-hover,var(--ux-line-2)),0 6px 14px -8px var(--ux-shadow)}
.wb-icon-btn:active{transform:scale(.94)}
.wb-icon-btn:focus-visible{outline:2px solid var(--wb-accent,var(--ux-accent));outline-offset:2px}
.wb-icon-btn.is-busy{color:var(--wb-accent,var(--ux-accent))}
.wb-icon-btn.is-active{background:var(--wb-pill-active,var(--ux-ink));color:var(--wb-pill-active-ink,var(--ux-page));box-shadow:0 8px 18px -10px var(--ux-shadow-strong)}
@keyframes wb-spin{to{transform:rotate(360deg)}}
.wb-icon-btn.is-busy svg{animation:wb-spin .9s linear infinite}
@media (max-width:440px){
  .wb-gps-btn{height:34px;padding:0 10.5px;font-size:12px}
  .wb-prov-pill{height:30px;padding:0 9.5px;font-size:11px}
  .wb-icon-btn{width:36px;height:36px;border-radius:11px}
}
@media (prefers-reduced-motion:reduce){
  .wb-icon-btn.is-busy svg{animation:none!important}
}
`;

const GENDER_OPTIONS: ReadonlyArray<LucianPillOption<Gender>> = [
  { id: 'male', label: 'Nam', icon: 'gender-male', ariaLabel: 'Nhân vật Nam' },
  { id: 'female', label: 'Nữ', icon: 'gender-female', ariaLabel: 'Nhân vật Nữ' },
];

export const TopControlBar: React.FC<TopControlBarProps> = ({
  palette,
  activeTab,
  onSelectTab,
  gender,
  onSelectGender,
  selectedCityId,
  customCity = null,
  favoriteCities = [],
  activeWeather,
  isLiveMode,
  isLoadingLive,
  gpsLoading,
  gpsSource = null,
  onSelectPresetCity,
  onSelectCustomCity,
  onToggleFavoriteCity,
  onRequestGps,
  onRefreshLive,
  onOpenSettings,
  themeMode = 'auto',
  onSelectThemeMode,
  alertsSupported = false,
  alertsEnabled = false,
  onToggleAlerts,
}) => {
  const { width } = useWindowDimensions();
  const isCompactTabs = width < 720;
  const isMobileStack = width < 640;
  const isVeryNarrow = width < 410;

  useEffect(() => {
    if (Platform.OS === 'web') {
      injectLucianElementCss(TOP_BAR_WEB_CSS_ID, TOP_BAR_WEB_CSS);
    }
  }, []);

  const isGpsActive = selectedCityId === 'gps' && isLiveMode;

  const providerBadgeLabel = !isLiveMode
    ? 'Kịch bản mẫu'
    : activeWeather.provider === 'tomorrow_io'
      ? 'Tomorrow.io · 15p'
      : activeWeather.provider === 'weatherapi'
        ? 'WeatherAPI · 15p'
        : activeWeather.provider === 'google'
          ? 'Google · 15p'
          : 'Open-Meteo · 15p';

  const navOptions = useMemo<ReadonlyArray<LucianTabOption<ActiveAppTab>>>(
    () => [
      {
        id: 'stage',
        label: 'Thời tiết',
        compactLabel: 'Thời tiết',
        icon: palette.isDark ? 'moon-stars' : 'cloud-sun',
      },
      {
        id: 'dashboard',
        label: 'Dashboard Web',
        compactLabel: 'Dashboard',
        icon: 'chart-bar',
      },
      {
        id: 'hub',
        label: 'Tiện ích & Cài đặt',
        compactLabel: 'Tiện ích',
        icon: 'squares-four',
      },
      {
        id: 'widgets',
        label: 'Widget Màn hình khóa',
        compactLabel: 'Widget',
        icon: 'device-mobile',
      },
    ],
    [palette.isDark]
  );

  const themeOptions = useMemo<ReadonlyArray<LucianPillOption<AppThemeMode>>>(
    () => [
      {
        id: 'auto',
        label: 'Tự động',
        icon: isVeryNarrow ? undefined : 'cloud-sun',
        ariaLabel: 'Giao diện tự động theo bầu trời',
      },
      {
        id: 'light',
        label: 'Sáng',
        icon: 'sun-dim',
        ariaLabel: 'Giao diện Sáng',
      },
      {
        id: 'dark',
        label: 'Tối',
        icon: 'moon-stars',
        ariaLabel: 'Giao diện Tối',
      },
    ],
    [isVeryNarrow]
  );

  const gpsText = gpsLoading
    ? 'Đang định vị...'
    : isVeryNarrow
      ? 'Vị trí'
      : 'Vị trí hiện tại';

  const safeLiveDotColor = palette.isDark ? '#58C49E' : '#168560';

  const webControlVars = useMemo(() => {
    if (Platform.OS !== 'web') {
      return undefined;
    }
    return {
      ['--wb-surface' as string]: palette.coreElevatedBg,
      ['--wb-surface-hover' as string]: palette.pillIdleBg,
      ['--wb-pill-idle' as string]: palette.pillIdleBg,
      ['--wb-pill-active' as string]: palette.pillActiveBg,
      ['--wb-pill-active-ink' as string]: palette.pillActiveInk,
      ['--wb-ink' as string]: palette.inkPrimary,
      ['--wb-ink-2' as string]: palette.inkSecondary,
      ['--wb-border' as string]: palette.bezelOuterBorder,
      ['--wb-border-hover' as string]: palette.bezelOuterBorder,
      ['--wb-hairline' as string]: palette.hairline,
      ['--wb-accent' as string]: palette.accent,
      ['--wb-safe' as string]: safeLiveDotColor,
    } as React.CSSProperties;
  }, [palette, safeLiveDotColor]);

  return (
    <View
      style={[
        styles.headerShell,
        isMobileStack && styles.headerShellMobile,
        {
          backgroundColor: palette.coreSurfaceBg,
          borderColor: palette.bezelOuterBorder,
        },
        Platform.OS === 'web'
          ? ({
              boxShadow: palette.isDark
                ? '0 18px 40px -14px rgba(4, 6, 11, 0.88), 0 1px 0 0 rgba(224, 234, 248, 0.14)'
                : '0 14px 32px -18px rgba(17, 24, 36, 0.20), 0 1px 0 0 rgba(17, 24, 36, 0.08)',
              transition: 'background-color 0.25s ease, border-color 0.25s ease',
            } as any)
          : null,
      ]}
    >
      {/* Row 1: City Listbox (#031) + 1-Tap GPS + Provider 15p + Gender (#039) + Theme (#039) + Actions */}
      <View style={[styles.topDeck, isMobileStack && styles.topDeckMobile]}>
        <View
          style={[
            styles.locationCluster,
            isMobileStack && styles.locationClusterMobile,
          ]}
        >
          <View
            style={[
              styles.cityBoxSlot,
              isMobileStack && styles.cityBoxSlotMobile,
            ]}
          >
            <LucianCityListbox
              cities={PRESET_CITIES}
              customCity={customCity}
              favoriteCities={favoriteCities}
              selectedCityId={selectedCityId}
              locationLabel={activeWeather.locationName}
              isLiveMode={isLiveMode}
              isGpsActive={isGpsActive}
              onSelectCity={onSelectPresetCity}
              onSelectCustomCity={onSelectCustomCity}
              onToggleFavoriteCity={onToggleFavoriteCity}
              onRequestGps={onRequestGps}
              gpsLoading={gpsLoading}
              gpsSource={gpsSource}
              palette={palette}
            />
          </View>

          {isMobileStack && (
            <View style={styles.mobileQuickActions}>
              {Platform.OS === 'web' ? (
                <div
                  className="ux"
                  style={{ ...webControlVars, display: 'inline-flex', gap: 6 }}
                >
                  {alertsSupported && onToggleAlerts && (
                    <button
                      type="button"
                      className={`wb-icon-btn${alertsEnabled ? ' is-active' : ''}`}
                      aria-pressed={alertsEnabled}
                      aria-label={
                        alertsEnabled
                          ? 'Tắt thông báo cảnh báo thời tiết'
                          : 'Bật thông báo cảnh báo khi sắp mưa / bụi mịn cao'
                      }
                      title={
                        alertsEnabled
                          ? 'Đang bật cảnh báo thời tiết chủ động (bấm để tắt)'
                          : 'Bật thông báo đẩy khi sắp mưa, UV cao hoặc bụi mịn vượt ngưỡng'
                      }
                      onClick={onToggleAlerts}
                    >
                      <Broadcast size={16} weight={alertsEnabled ? 'fill' : 'duotone'} color="currentColor" />
                    </button>
                  )}
                  <a
                    href="/device-lab"
                    target="_blank"
                    rel="noopener"
                    className="wb-icon-btn"
                    aria-label="Mở trang giả lập Điện thoại & Desktop"
                    title="Mở trang Web Giả lập Điện thoại & Màn hình Desktop"
                  >
                    <Desktop size={16} weight="duotone" color="currentColor" />
                  </a>
                  <button
                    type="button"
                    className={`wb-icon-btn${isLoadingLive ? ' is-busy' : ''}`}
                    aria-label="Làm mới thời tiết"
                    title="Làm mới thời tiết"
                    onClick={onRefreshLive}
                  >
                    <ArrowsClockwise size={16} weight="bold" color="currentColor" />
                  </button>
                  <button
                    type="button"
                    className="wb-icon-btn"
                    aria-label="Mở cài đặt"
                    title="Cài đặt nguồn thời tiết & độ nhạy nhiệt"
                    onClick={onOpenSettings}
                  >
                    <GearSix size={16} weight="duotone" color="currentColor" />
                  </button>
                </div>
              ) : (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Làm mới thời tiết"
                    onPress={onRefreshLive}
                    style={[
                      styles.nativeIconBtn,
                      WEB_NO_OUTLINE,
                      {
                        backgroundColor: palette.coreElevatedBg,
                        borderColor: palette.bezelOuterBorder,
                      },
                    ]}
                  >
                    <ArrowsClockwise
                      size={16}
                      weight="bold"
                      color={isLoadingLive ? palette.accent : palette.inkPrimary}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Mở cài đặt"
                    onPress={onOpenSettings}
                    style={[
                      styles.nativeIconBtn,
                      WEB_NO_OUTLINE,
                      {
                        backgroundColor: palette.coreElevatedBg,
                        borderColor: palette.bezelOuterBorder,
                      },
                    ]}
                  >
                    <GearSix size={16} weight="duotone" color={palette.inkPrimary} />
                  </Pressable>
                </>
              )}
            </View>
          )}

          {/* Direct 1-Tap High-Accuracy GPS Pill + Provider 15p Status Pill */}
          {Platform.OS === 'web' ? (
            <div
              className="ux"
              style={{
                ...webControlVars,
                display: 'inline-flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                maxWidth: '100%',
              }}
            >
              <button
                type="button"
                className="wb-gps-btn"
                aria-pressed={isGpsActive}
                aria-busy={gpsLoading}
                aria-label="Định vị vị trí hiện tại"
                onClick={onRequestGps}
              >
                {gpsLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={isGpsActive ? palette.pillActiveInk : palette.accent}
                  />
                ) : (
                  <Crosshair
                    size={15}
                    weight="duotone"
                    color="currentColor"
                  />
                )}
                <span>{gpsText}</span>
              </button>

              <span className="wb-prov-pill" title="Chu kỳ đồng bộ dữ liệu thời tiết">
                <span
                  className={`wb-prov-dot${isLiveMode ? '' : ' is-demo'}`}
                  aria-hidden="true"
                />
                <span>{providerBadgeLabel}</span>
              </span>
            </div>
          ) : (
            <View style={styles.nativeMetaRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isGpsActive, busy: gpsLoading }}
                accessibilityLabel="Định vị vị trí hiện tại"
                onPress={onRequestGps}
                style={[
                  styles.nativeGpsPill,
                  WEB_NO_OUTLINE,
                  {
                    backgroundColor: isGpsActive
                      ? palette.pillActiveBg
                      : palette.coreElevatedBg,
                    borderColor: isGpsActive
                      ? palette.pillActiveBg
                      : palette.bezelOuterBorder,
                  },
                ]}
              >
                {gpsLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={isGpsActive ? palette.pillActiveInk : palette.accent}
                  />
                ) : (
                  <Crosshair
                    size={15}
                    weight="duotone"
                    color={isGpsActive ? palette.pillActiveInk : palette.accent}
                  />
                )}
                <Text
                  numberOfLines={1}
                  style={[
                    styles.nativeGpsText,
                    {
                      color: isGpsActive
                        ? palette.pillActiveInk
                        : palette.inkPrimary,
                    },
                  ]}
                >
                  {gpsText}
                </Text>
              </Pressable>

              <View
                style={[
                  styles.nativeProvBadge,
                  {
                    backgroundColor: palette.pillIdleBg,
                    borderColor: palette.hairline,
                  },
                ]}
              >
                <View
                  style={[
                    styles.nativeProvDot,
                    {
                      backgroundColor: isLiveMode
                        ? safeLiveDotColor
                        : palette.accent,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.nativeProvText,
                    { color: palette.inkSecondary },
                  ]}
                >
                  {providerBadgeLabel}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Right Controls: Gender (#039) + Explicit Theme Switcher (#039) + Refresh + Settings */}
        <View
          style={[
            styles.controlsCluster,
            isMobileStack && styles.controlsClusterMobile,
          ]}
        >
          <LucianSlidingPillSwitch
            options={GENDER_OPTIONS}
            value={gender}
            onChange={onSelectGender}
            ariaLabel="Chọn nhân vật Nam hoặc Nữ"
            palette={palette}
          />

          {onSelectThemeMode && (
            <LucianSlidingPillSwitch
              options={themeOptions}
              value={themeMode}
              onChange={onSelectThemeMode}
              ariaLabel="Chế độ giao diện Tự động, Sáng hoặc Tối"
              palette={palette}
            />
          )}

          {!isMobileStack && (
            Platform.OS === 'web' ? (
              <div
                className="ux"
                style={{ ...webControlVars, display: 'inline-flex', gap: 8 }}
              >
                {alertsSupported && onToggleAlerts && (
                  <button
                    type="button"
                    className={`wb-icon-btn${alertsEnabled ? ' is-active' : ''}`}
                    aria-pressed={alertsEnabled}
                    aria-label={
                      alertsEnabled
                        ? 'Tắt thông báo cảnh báo thời tiết'
                        : 'Bật thông báo cảnh báo khi sắp mưa / bụi mịn cao'
                    }
                    title={
                      alertsEnabled
                        ? 'Đang bật cảnh báo thời tiết chủ động (bấm để tắt)'
                        : 'Bật thông báo đẩy khi sắp mưa, UV cao hoặc bụi mịn vượt ngưỡng'
                    }
                    onClick={onToggleAlerts}
                  >
                    <Broadcast size={16} weight={alertsEnabled ? 'fill' : 'duotone'} color="currentColor" />
                  </button>
                )}
                <a
                  href="/device-lab"
                  target="_blank"
                  rel="noopener"
                  className="wb-icon-btn"
                  aria-label="Mở trang giả lập Điện thoại & Desktop"
                  title="Mở trang Web Giả lập Điện thoại & Màn hình Desktop"
                >
                  <Desktop size={16} weight="duotone" color="currentColor" />
                </a>
                <button
                  type="button"
                  className={`wb-icon-btn${isLoadingLive ? ' is-busy' : ''}`}
                  aria-label="Làm mới thời tiết"
                  title="Làm mới thời tiết"
                  onClick={onRefreshLive}
                >
                  <ArrowsClockwise size={16} weight="bold" color="currentColor" />
                </button>
                <button
                  type="button"
                  className="wb-icon-btn"
                  aria-label="Mở cài đặt"
                  title="Cài đặt nguồn thời tiết & độ nhạy nhiệt"
                  onClick={onOpenSettings}
                >
                  <GearSix size={17} weight="duotone" color="currentColor" />
                </button>
              </div>
            ) : (
              <View style={styles.desktopActionRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Làm mới thời tiết"
                  onPress={onRefreshLive}
                  style={[
                    styles.nativeIconBtn,
                    WEB_NO_OUTLINE,
                    {
                      backgroundColor: palette.coreElevatedBg,
                      borderColor: palette.bezelOuterBorder,
                    },
                  ]}
                >
                  <ArrowsClockwise
                    size={16}
                    weight="bold"
                    color={isLoadingLive ? palette.accent : palette.inkPrimary}
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mở cài đặt"
                  onPress={onOpenSettings}
                  style={[
                    styles.nativeIconBtn,
                    WEB_NO_OUTLINE,
                    {
                      backgroundColor: palette.coreElevatedBg,
                      borderColor: palette.bezelOuterBorder,
                    },
                  ]}
                >
                  <GearSix size={17} weight="duotone" color={palette.inkPrimary} />
                </Pressable>
              </View>
            )
          )}
        </View>
      </View>

      {/* Row 2: 4-View Jelly Segmented Navigation Tabs (#416) */}
      <View style={styles.navDeck}>
        <LucianViewTabs
          options={navOptions}
          value={activeTab}
          onChange={onSelectTab}
          ariaLabel="Điều hướng màn hình chính WeatherBuddy"
          isCompactLabels={isCompactTabs}
          palette={palette}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerShell: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    overflow: 'visible',
    zIndex: 60,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          boxShadow: '0 14px 34px -22px var(--ux-shadow-strong)',
        } as any)
      : null),
  },
  headerShellMobile: {
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 9,
  },
  topDeck: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    overflow: 'visible',
    zIndex: 80,
  },
  topDeckMobile: {
    gap: 8,
  },
  locationCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    minWidth: 0,
    overflow: 'visible',
    zIndex: 90,
  },
  locationClusterMobile: {
    width: '100%',
  },
  cityBoxSlot: {
    overflow: 'visible',
    zIndex: 100,
  },
  cityBoxSlotMobile: {
    flex: 1,
    minWidth: 168,
  },
  mobileQuickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  controlsCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    minWidth: 0,
    zIndex: 30,
  },
  controlsClusterMobile: {
    width: '100%',
    justifyContent: 'space-between',
  },
  desktopActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navDeck: {
    width: '100%',
    minWidth: 0,
    zIndex: 10,
  },
  nativeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  nativeGpsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  nativeGpsText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '700',
  },
  nativeProvBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  nativeProvDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.25,
  },
  nativeProvText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    fontWeight: '600',
  },
  nativeIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

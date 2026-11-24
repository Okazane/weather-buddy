/* Lucian UX/UI Prompt #015 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#015 */
/* Lucian UX/UI Prompt #023 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#023 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  ArrowSquareOut,
  CheckCircle,
  CloudArrowDown,
  Cpu,
  Desktop,
  DeviceMobile,
  DownloadSimple,
  Eye,
  FileCode,
  GenderIcon,
  Info,
  MagnifyingGlass,
  Package,
} from '../components/AppIcons';
import type {
  CharacterDecision,
  Gender,
  ThermalSensitivity,
  WeatherSnapshot,
} from '../core';
import { LivingCharacterRig } from '../components/LivingCharacterRig';
import { resolveBackendBaseUrl } from '../hooks/useWeatherBuddy';
import {
  LucianFeatureSettingsCard,
  LucianPlanRadioCards,
  useResolvedLucianDark,
  type LucianFeatureSwitchRow,
  type LucianRadioOption,
} from '../lucian/LucianHubComponents';
import {
  FONT_FAMILY_DISPLAY,
  FONT_FAMILY_SANS,
  sanitizeCopy,
  WEB_NO_OUTLINE,
  type AtmosphericPalette,
} from '../components/themeTokens';

function localizeDisplayTermVi(raw: string): string {
  return sanitizeCopy(raw)
    .replace(/&\s*UV cao/gi, '· Tia cực tím cao')
    .replace(/\bUV cao\b/gi, 'Tia cực tím cao')
    .replace(/\bAQI cao\b/gi, 'Ô nhiễm bụi mịn cao');
}

export type PlatformInstallTarget =
  | 'browser_newtab'
  | 'browser_popup'
  | 'desktop_widget'
  | 'mobile_lockscreen';

export type DesktopCornerPosition =
  | 'BottomRight'
  | 'TopRight'
  | 'BottomLeft'
  | 'TopLeft';

export type DesktopWidgetSize = 'Compact' | 'Standard';

interface FeatureModuleToggles {
  showBigClock: boolean;
  showSearchBar: boolean;
  autoRotateNpc5m: boolean;
  alwaysOnTop: boolean;
  autoRefresh15m: boolean;
}

interface PersistedHubConfig {
  target: PlatformInstallTarget;
  corner: DesktopCornerPosition;
  size: DesktopWidgetSize;
  modules: FeatureModuleToggles;
}

const HUB_CONFIG_STORAGE_KEY = 'weather_buddy_feature_hub_v1';

const DEFAULT_HUB_CONFIG: PersistedHubConfig = {
  target: 'desktop_widget',
  corner: 'BottomRight',
  size: 'Standard',
  modules: {
    showBigClock: true,
    showSearchBar: true,
    autoRotateNpc5m: true,
    alwaysOnTop: true,
    autoRefresh15m: true,
  },
};

function loadHubConfig(): PersistedHubConfig {
  try {
    const scope = globalThis as unknown as {
      localStorage?: { getItem(k: string): string | null };
    };
    const raw = scope.localStorage?.getItem(HUB_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedHubConfig>;
      return {
        target:
          parsed.target === 'browser_newtab' ||
          parsed.target === 'browser_popup' ||
          parsed.target === 'desktop_widget' ||
          parsed.target === 'mobile_lockscreen'
            ? parsed.target
            : 'desktop_widget',
        corner:
          parsed.corner === 'TopRight' ||
          parsed.corner === 'BottomLeft' ||
          parsed.corner === 'TopLeft'
            ? parsed.corner
            : 'BottomRight',
        size: parsed.size === 'Compact' ? 'Compact' : 'Standard',
        modules: {
          showBigClock: parsed.modules?.showBigClock ?? true,
          showSearchBar: parsed.modules?.showSearchBar ?? true,
          autoRotateNpc5m: parsed.modules?.autoRotateNpc5m ?? true,
          alwaysOnTop: parsed.modules?.alwaysOnTop ?? true,
          autoRefresh15m: parsed.modules?.autoRefresh15m ?? true,
        },
      };
    }
  } catch {
    // Ignore storage read restrictions
  }
  return DEFAULT_HUB_CONFIG;
}

function saveHubConfig(cfg: PersistedHubConfig): void {
  try {
    const scope = globalThis as unknown as {
      localStorage?: { setItem(k: string, v: string): void };
    };
    scope.localStorage?.setItem(HUB_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // Ignore storage write restrictions
  }
}

interface FeatureHubScreenProps {
  palette: AtmosphericPalette;
  weather: WeatherSnapshot;
  decision: CharacterDecision;
  gender: Gender;
  onSelectGender: (gender: Gender) => void;
  sensitivity: ThermalSensitivity;
  onSelectSensitivity: (sensitivity: ThermalSensitivity) => void;
  reduceMotion: boolean;
  onJumpToMobileWidgets: () => void;
}

const PLATFORM_RADIO_CARDS: ReadonlyArray<LucianRadioOption<PlatformInstallTarget>> = [
  {
    id: 'browser_newtab',
    title: 'Tab Mới Extension',
    subtitle: 'Nhân vật theo thời tiết, đồng hồ, tìm kiếm nhanh & dự báo 12 giờ',
    badge: 'Chrome · Edge',
    metaPrimary: 'Tiện ích',
    metaSecondary: 'Tab mới',
    icon: 'layout',
    gradient: 'linear-gradient(140deg,#3A7EC2,#1E6BB8)',
  },
  {
    id: 'browser_popup',
    title: 'Popup Thanh công cụ',
    subtitle: 'Hiển thị nhiệt độ trên thanh công cụ, mở nhanh khung 380×560',
    badge: 'Cập nhật 15p',
    metaPrimary: '380×560',
    metaSecondary: 'Popup',
    icon: 'bookmark',
    gradient: 'linear-gradient(140deg,#3B9D7C,#168560)',
  },
  {
    id: 'desktop_widget',
    title: 'Widget Màn hình Windows',
    subtitle: 'Neo cửa sổ thời tiết nhỏ gọn tại 4 góc màn hình máy tính',
    badge: 'Ghim nổi',
    metaPrimary: 'Tauri · PC',
    metaSecondary: 'Windows',
    icon: 'monitor',
    gradient: 'linear-gradient(140deg,#4A78A8,#2A5580)',
  },
  {
    id: 'mobile_lockscreen',
    title: 'Widget Màn hình khóa Mobile',
    subtitle: 'Xem nhanh nhiệt độ và gợi ý trang phục trên iPhone & Android',
    badge: 'iOS · Android',
    metaPrimary: '15 phút',
    metaSecondary: 'Màn hình khóa',
    icon: 'smartphone',
    gradient: 'linear-gradient(140deg,#388E78,#1F6B59)',
  },
];

const SENSITIVITY_RADIO_CARDS: ReadonlyArray<LucianRadioOption<ThermalSensitivity>> = [
  {
    id: 'cold_sensitive',
    title: 'Sợ lạnh',
    subtitle: '-3°C cảm nhận',
    icon: 'snowflake',
    gradient: 'linear-gradient(140deg,#3A7EC2,#1E6BB8)',
  },
  {
    id: 'normal',
    title: 'Bình thường',
    subtitle: 'Chuẩn mặc định',
    icon: 'sun',
    gradient: 'linear-gradient(140deg,#3B9D7C,#168560)',
  },
  {
    id: 'heat_sensitive',
    title: 'Sợ nóng',
    subtitle: '+3°C cảm nhận',
    icon: 'flame',
    gradient: 'linear-gradient(140deg,#D98A3C,#B86818)',
  },
];

const CORNER_OPTIONS: ReadonlyArray<{
  id: DesktopCornerPosition;
  labelVi: string;
  shortVi: string;
}> = [
  { id: 'BottomRight', labelVi: 'Góc phải dưới', shortVi: 'Phải dưới' },
  { id: 'TopRight', labelVi: 'Góc phải trên', shortVi: 'Phải trên' },
  { id: 'BottomLeft', labelVi: 'Góc trái dưới', shortVi: 'Trái dưới' },
  { id: 'TopLeft', labelVi: 'Góc trái trên', shortVi: 'Trái trên' },
];

const SIZE_OPTIONS: ReadonlyArray<{
  id: DesktopWidgetSize;
  labelVi: string;
  dimLabel: string;
}> = [
  { id: 'Compact', labelVi: 'Gọn nhẹ', dimLabel: '300×420' },
  { id: 'Standard', labelVi: 'Tiêu chuẩn', dimLabel: '380×540' },
];

export const FeatureHubScreen: React.FC<FeatureHubScreenProps> = ({
  palette,
  weather,
  decision,
  gender,
  onSelectGender,
  sensitivity,
  onSelectSensitivity,
  reduceMotion,
  onJumpToMobileWidgets,
}) => {
  const { width } = useWindowDimensions();
  const isTwoCol = width >= 920;
  const isNarrowMobile = width < 440;
  const isDark = useResolvedLucianDark(palette);

  const [config, setConfig] = useState<PersistedHubConfig>(() => loadHubConfig());
  const [suiteStatus, setSuiteStatus] = useState<{
    backendOnline: boolean;
    extensionReady: boolean;
    desktopWidgetReady: boolean;
  }>({
    backendOnline: false,
    extensionReady: true,
    desktopWidgetReady: true,
  });
  const [launchingWidget, setLaunchingWidget] = useState<boolean>(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  useEffect(() => {
    saveHubConfig(config);
  }, [config]);

  const checkPcSuiteBackendStatus = useCallback(async () => {
    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), 2500)
      : null;

    try {
      const base = resolveBackendBaseUrl();
      const res = await fetch(`${base}/api/pc-suite/status`, {
        signal: controller ? controller.signal : undefined,
      });
      if (res.ok) {
        const data = (await res.json()) as {
          extensionReady?: boolean;
          desktopWidgetReady?: boolean;
        };
        setSuiteStatus({
          backendOnline: true,
          extensionReady: Boolean(data.extensionReady ?? true),
          desktopWidgetReady: Boolean(data.desktopWidgetReady ?? true),
        });
      }
    } catch {
      setSuiteStatus((prev) => ({ ...prev, backendOnline: false }));
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }, []);

  useEffect(() => {
    checkPcSuiteBackendStatus();
  }, [checkPcSuiteBackendStatus]);

  const updateTarget = (target: PlatformInstallTarget) => {
    setConfig((prev) => ({ ...prev, target }));
    setActionToast(null);
  };

  const updateCorner = (corner: DesktopCornerPosition) => {
    setConfig((prev) => ({ ...prev, corner }));
    setActionToast(null);
  };

  const updateSize = (size: DesktopWidgetSize) => {
    setConfig((prev) => ({ ...prev, size }));
    setActionToast(null);
  };

  const handleToggleModule = (key: string, explicitNext?: boolean) => {
    const modKey = key as keyof FeatureModuleToggles;
    setConfig((prev) => ({
      ...prev,
      modules: {
        ...prev.modules,
        [modKey]:
          typeof explicitNext === 'boolean'
            ? explicitNext
            : !prev.modules[modKey],
      },
    }));
    setActionToast(null);
  };

  const handleDownloadZip = (filename: string, labelVi: string) => {
    const relativePath = `/downloads/${filename}`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const url = suiteStatus.backendOnline
        ? `${resolveBackendBaseUrl()}${relativePath}`
        : relativePath;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setActionToast(`Đang tải xuống ${labelVi} (${filename})...`);
      return;
    }
    Linking.openURL(`http://localhost:8787${relativePath}`).catch(() => {});
  };

  const handleLaunchWindowsWidget = async () => {
    setLaunchingWidget(true);
    setActionToast(null);

    try {
      const base = resolveBackendBaseUrl();
      const res = await fetch(`${base}/api/pc-widget/launch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WeatherBuddy-Client': 'weatherbuddy-ui',
        },
        body: JSON.stringify({
          corner: config.corner,
          size: config.size,
          gender,
        }),
      });
      if (res.ok) {
        const cornerVi =
          CORNER_OPTIONS.find((c) => c.id === config.corner)?.labelVi ??
          config.corner;
        setActionToast(
          `Đã kích hoạt Widget nổi tại ${cornerVi} màn hình Windows.`
        );
        setLaunchingWidget(false);
        return;
      }
    } catch {
      // Fallback command notice when backend server is not running
    }

    setLaunchingWidget(false);
    setActionToast(
      `Chạy lệnh: powershell -ExecutionPolicy Bypass -File desktop-widget/Launch-Desktop-Widget.ps1 -Corner ${config.corner} -Size ${config.size} -Gender ${gender}`
    );
  };

  const handleExportJsonConfig = () => {
    const exportPayload = {
      version: '3.0.0',
      exportedAtIso: new Date().toISOString(),
      character: {
        gender,
        sensitivity,
      },
      location: {
        locationName: weather.locationName,
        latitude: Number(weather.latitude.toFixed(5)),
        longitude: Number(weather.longitude.toFixed(5)),
      },
      platformTarget: config.target,
      desktopWidget: {
        corner: config.corner,
        size: config.size,
      },
      modules: config.modules,
    };

    const jsonString = JSON.stringify(exportPayload, null, 2);
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      typeof Blob !== 'undefined'
    ) {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'weather-buddy-config.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setActionToast('Đã xuất tệp cấu hình weather-buddy-config.json.');
    } else {
      setActionToast('Đã lưu cấu hình cá nhân trên thiết bị.');
    }
  };

  const cornerLabelVi =
    CORNER_OPTIONS.find((c) => c.id === config.corner)?.labelVi ??
    'Góc phải dưới';
  const sizeMeta =
    SIZE_OPTIONS.find((s) => s.id === config.size) ?? SIZE_OPTIONS[1];

  const cornerAlignmentStyle =
    config.corner === 'BottomRight'
      ? { bottom: 12, right: 12 }
      : config.corner === 'TopRight'
        ? { top: 12, right: 12 }
        : config.corner === 'BottomLeft'
          ? { bottom: 12, left: 12 }
          : { top: 12, left: 12 };

  const safeColor = isDark ? '#58C49E' : '#168560';
  const safeSoftBg = isDark
    ? 'rgba(88, 196, 158, 0.15)'
    : 'rgba(22, 133, 96, 0.11)';

  const lucianSwitchRows: ReadonlyArray<LucianFeatureSwitchRow> = useMemo(
    () => [
      {
        key: 'showBigClock',
        title: 'Đồng hồ trên Tab mới',
        subtitle: 'Hiển thị giờ hiện tại và ngày tháng ở đầu trang',
        enabled: config.modules.showBigClock,
        icon: 'clock',
        gradient: 'linear-gradient(140deg,#3A7EC2,#1E6BB8)',
      },
      {
        key: 'showSearchBar',
        title: 'Thanh tìm kiếm nhanh',
        subtitle: 'Tìm nhanh trên Google hoặc DuckDuckGo ngay tại Tab mới',
        enabled: config.modules.showSearchBar,
        icon: 'search',
        gradient: 'linear-gradient(140deg,#4A78A8,#2A5580)',
      },
      {
        key: 'autoRotateNpc5m',
        title: 'Tự động đổi hoạt động nhân vật mỗi 5 phút',
        subtitle: 'Đọc sách, chơi với mèo, chơi với cún, xem điện thoại, nghe nhạc',
        enabled: config.modules.autoRotateNpc5m,
        icon: 'shuffle',
        gradient: 'linear-gradient(140deg,#3B9D7C,#168560)',
      },
      {
        key: 'alwaysOnTop',
        title: 'Ghim nổi trên cửa sổ khác',
        subtitle: config.modules.alwaysOnTop
          ? `Đang neo tại ${cornerLabelVi}`
          : 'Tắt ghim nổi cửa sổ máy tính',
        enabled: config.modules.alwaysOnTop,
        icon: 'layers',
        gradient: 'linear-gradient(140deg,#D98A3C,#B86818)',
        subOptions: {
          ariaLabel: 'Vị trí góc màn hình máy tính',
          choices: CORNER_OPTIONS.map((c) => ({
            id: c.id,
            label: c.shortVi,
          })),
          selectedId: config.corner,
          onSelect: (id) => updateCorner(id as DesktopCornerPosition),
        },
      },
      {
        key: 'autoRefresh15m',
        title: 'Tự cập nhật thời tiết mỗi 15 phút',
        subtitle: 'Đồng bộ dự báo mới định kỳ ở chế độ nền',
        enabled: config.modules.autoRefresh15m,
        icon: 'refresh',
        gradient: 'linear-gradient(140deg,#388E78,#1F6B59)',
      },
    ],
    [config.modules, config.corner, cornerLabelVi]
  );

  const selectedPlatformCard =
    PLATFORM_RADIO_CARDS.find((c) => c.id === config.target) ??
    PLATFORM_RADIO_CARDS[2];

  return (
    <View style={styles.hubStack}>
      {/* Header Banner + Lucian #015 Platform Mode Selector Cards */}
      <View
        style={[
          styles.outerBezel,
          {
            backgroundColor: palette.bezelOuterBg,
            borderColor: palette.bezelOuterBorder,
          },
        ]}
      >
        <View
          style={[
            styles.innerCore,
            isNarrowMobile && styles.innerCoreCompact,
            { backgroundColor: palette.coreElevatedBg },
          ]}
        >
          <View style={styles.headerTopRow}>
            <View style={styles.headerTextCol}>
              <View style={styles.badgeCluster}>
                <View
                  style={[
                    styles.readyPill,
                    { backgroundColor: palette.accentSoftBg },
                  ]}
                >
                  <Package size={13} color={palette.accent} weight="duotone" />
                  <Text style={[styles.readyPillText, { color: palette.accent }]}>
                    Đa nền tảng · Web · Extension · Windows PC · Mobile
                  </Text>
                </View>

                <View
                  style={[
                    styles.readyPill,
                    {
                      backgroundColor: suiteStatus.backendOnline
                        ? safeSoftBg
                        : palette.pillIdleBg,
                    },
                  ]}
                >
                  {suiteStatus.backendOnline ? (
                    <CheckCircle size={13} color={safeColor} weight="duotone" />
                  ) : (
                    <Cpu
                      size={13}
                      color={palette.inkSecondary}
                      weight="duotone"
                    />
                  )}
                  <Text
                    style={[
                      styles.readyPillText,
                      {
                        color: suiteStatus.backendOnline
                          ? safeColor
                          : palette.inkSecondary,
                      },
                    ]}
                  >
                    {suiteStatus.backendOnline
                      ? 'Máy chủ :8787 sẵn sàng'
                      : 'Tải gói .zip trực tiếp'}
                  </Text>
                </View>
              </View>

              <Text style={[styles.hubTitle, { color: palette.inkPrimary }]}>
                Trung tâm Tính năng & Cài đặt Đa nền tảng
              </Text>
              <Text style={[styles.hubSub, { color: palette.inkSecondary }]}>
                Chọn nền tảng hiển thị, bật hoặc tắt từng thành phần và tải gói cài đặt cho trình duyệt hoặc màn hình máy tính.
              </Text>
            </View>
          </View>

          <LucianPlanRadioCards
            ariaLabel="Chọn chế độ nền tảng"
            options={PLATFORM_RADIO_CARDS}
            value={config.target}
            onChange={updateTarget}
            columns={2}
            summaryLeft={`Đang cấu hình: ${selectedPlatformCard.title}`}
            summaryRight={`${cornerLabelVi} · ${sizeMeta.dimLabel}`}
            isDark={isDark}
          />
        </View>
      </View>

      {/* Main Split: Left = Lucian #023 Interactive Customization Matrix + #015 Thermal Sensitivity | Right = Live Mini-Preview + Action Center */}
      <View
        style={[
          styles.mainSplitGrid,
          isTwoCol ? styles.splitRowDesktop : styles.splitColMobile,
        ]}
      >
        {/* Left Column: Customization Controls */}
        <View style={styles.matrixCol}>
          <LucianFeatureSettingsCard
            title="Thành phần hiển thị"
            rows={lucianSwitchRows}
            onToggleRow={handleToggleModule}
            isDark={isDark}
          />

          {/* Persona, Size & Sensitivity Card */}
          <View
            style={[
              styles.outerBezel,
              {
                backgroundColor: palette.bezelOuterBg,
                borderColor: palette.bezelOuterBorder,
              },
            ]}
          >
            <View
              style={[
                styles.innerCore,
                isNarrowMobile && styles.innerCoreCompact,
                { backgroundColor: palette.coreSurfaceBg },
              ]}
            >
              <View style={styles.dualControlsRow}>
                <View style={styles.halfControlCol}>
                  <Text style={[styles.controlLabel, { color: palette.inkPrimary }]}>
                    Kích thước cửa sổ Widget
                  </Text>
                  <View style={styles.pillsWrapRow}>
                    {SIZE_OPTIONS.map((s) => {
                      const active = config.size === s.id;
                      return (
                        <Pressable
                          key={s.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          onPress={() => updateSize(s.id)}
                          style={({ pressed }) => [
                            styles.optionPill,
                            WEB_NO_OUTLINE,
                            {
                              backgroundColor: active
                                ? palette.pillActiveBg
                                : palette.pillIdleBg,
                              borderColor: active
                                ? palette.pillActiveBg
                                : palette.bezelOuterBorder,
                              transform: [{ scale: pressed ? 0.97 : 1 }],
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.optionPillText,
                              {
                                color: active
                                  ? palette.pillActiveInk
                                  : palette.inkPrimary,
                              },
                            ]}
                          >
                            {s.labelVi} ({s.dimLabel})
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.halfControlCol}>
                  <Text style={[styles.controlLabel, { color: palette.inkPrimary }]}>
                    Nhân vật đồng hành
                  </Text>
                  <View style={styles.pillsWrapRow}>
                    {(['male', 'female'] as const).map((g) => {
                      const active = gender === g;
                      return (
                        <Pressable
                          key={g}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          onPress={() => onSelectGender(g)}
                          style={({ pressed }) => [
                            styles.optionPill,
                            WEB_NO_OUTLINE,
                            {
                              backgroundColor: active
                                ? palette.pillActiveBg
                                : palette.pillIdleBg,
                              borderColor: active
                                ? palette.pillActiveBg
                                : palette.bezelOuterBorder,
                              transform: [{ scale: pressed ? 0.97 : 1 }],
                            },
                          ]}
                        >
                          <GenderIcon
                            gender={g}
                            size={14}
                            color={
                              active
                                ? palette.pillActiveInk
                                : palette.inkPrimary
                            }
                            weight="duotone"
                          />
                          <Text
                            style={[
                              styles.optionPillText,
                              {
                                color: active
                                  ? palette.pillActiveInk
                                  : palette.inkPrimary,
                              },
                            ]}
                          >
                            {g === 'male' ? 'Cậu bé Mây' : 'Cô bé Nắng'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>

              <View style={styles.controlBlock}>
                <Text style={[styles.controlLabel, { color: palette.inkPrimary }]}>
                  Độ nhạy cảm nhiệt độ cá nhân
                </Text>
                <LucianPlanRadioCards
                  ariaLabel="Độ nhạy nhiệt độ"
                  options={SENSITIVITY_RADIO_CARDS}
                  value={sensitivity}
                  onChange={onSelectSensitivity}
                  columns={3}
                  compact
                  isDark={isDark}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Right Column: Live Interactive Screen Preview + Action & Download Center */}
        <View style={styles.previewAndActionsCol}>
          {/* Live Mini-Preview */}
          <View
            style={[
              styles.outerBezel,
              {
                backgroundColor: palette.bezelOuterBg,
                borderColor: palette.bezelOuterBorder,
              },
            ]}
          >
            <View
              style={[
                styles.innerCore,
                isNarrowMobile && styles.innerCoreCompact,
                { backgroundColor: palette.coreElevatedBg },
              ]}
            >
              <View style={styles.previewHeaderRow}>
                <View style={styles.sectionHeaderCluster}>
                  <Eye size={16} color={palette.accent} weight="duotone" />
                  <Text style={[styles.sectionTitle, { color: palette.inkPrimary }]}>
                    Xem trước bố cục ({cornerLabelVi} · {sizeMeta.dimLabel})
                  </Text>
                </View>
              </View>

              {/* Simulated 16:10 PC Monitor / Browser Tab Canvas */}
              <View style={styles.pcMonitorFrame}>
                <View style={styles.pcMonitorTopBar}>
                  <View style={styles.windowDotsRow}>
                    <View
                      style={[styles.winDot, { backgroundColor: '#E5737D' }]}
                    />
                    <View
                      style={[styles.winDot, { backgroundColor: '#E8A849' }]}
                    />
                    <View
                      style={[styles.winDot, { backgroundColor: '#58C49E' }]}
                    />
                  </View>
                  <Text numberOfLines={1} style={styles.pcMonitorUrlText}>
                    {config.target === 'browser_newtab'
                      ? 'Tab mới · WeatherBuddy'
                      : config.target === 'browser_popup'
                        ? 'Popup thanh công cụ · 15p'
                        : config.target === 'mobile_lockscreen'
                          ? 'Widget iPhone & Android'
                          : `Windows · ${cornerLabelVi} (${
                              config.modules.alwaysOnTop
                                ? 'Ghim nổi'
                                : 'Thường'
                            })`}
                  </Text>
                  <View
                    style={[
                      styles.toolbarBadgePreview,
                      { backgroundColor: palette.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.toolbarBadgeText,
                        { color: palette.accentContrastInk },
                      ]}
                    >
                      {Math.round(weather.temperatureC)}°
                    </Text>
                  </View>
                </View>

                <View style={styles.pcMonitorCanvas}>
                  {config.modules.showBigClock && (
                    <View style={styles.previewClockBlock}>
                      <Text style={styles.previewClockTime}>09:41</Text>
                      <Text numberOfLines={1} style={styles.previewClockDate}>
                        {weather.locationName} · Cảm giác{' '}
                        {Math.round(weather.feelsLikeC)}°C
                      </Text>
                    </View>
                  )}

                  {config.modules.showSearchBar && (
                    <View style={styles.previewSearchBar}>
                      <MagnifyingGlass
                        size={12}
                        color="#B2C1D6"
                        weight="duotone"
                      />
                      <Text
                        numberOfLines={1}
                        style={styles.previewSearchPlaceholder}
                      >
                        Tìm kiếm nhanh...
                      </Text>
                    </View>
                  )}

                  {/* Floating Corner Chibi NPC Desktop / Extension Widget Card */}
                  <View
                    style={[
                      styles.floatingCornerWidget,
                      cornerAlignmentStyle,
                      config.size === 'Compact' || isNarrowMobile
                        ? styles.floatingWidgetCompact
                        : styles.floatingWidgetStandard,
                    ]}
                  >
                    <View style={styles.floatingWidgetHeader}>
                      <Text
                        numberOfLines={1}
                        style={styles.floatingWidgetCity}
                      >
                        {weather.locationName}
                      </Text>
                      <Text style={styles.floatingWidgetTemp}>
                        {Math.round(weather.temperatureC)}°C
                      </Text>
                    </View>

                    <LivingCharacterRig
                      gender={gender}
                      sceneId={decision.sceneId}
                      palette={palette}
                      size={config.size === 'Compact' || isNarrowMobile ? 82 : 100}
                      reduceMotion={reduceMotion}
                      interactive
                      showAmbientProps={false}
                      npcMode={config.modules.autoRotateNpc5m}
                    />

                    <Text
                      numberOfLines={1}
                      style={styles.floatingWidgetAdvice}
                    >
                      {localizeDisplayTermVi(decision.outfitAdviceVi)}
                    </Text>
                  </View>
                </View>

                <View style={styles.pcTaskbar}>
                  <Text numberOfLines={1} style={styles.pcTaskbarText}>
                    {weather.locationName}
                  </Text>
                  <Text style={styles.pcTaskbarText}>
                    {config.modules.autoRefresh15m ? 'Cập nhật 15p' : 'Thủ công'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Action, Download & Direct Launch Center */}
          <View
            style={[
              styles.outerBezel,
              {
                backgroundColor: palette.bezelOuterBg,
                borderColor: palette.bezelOuterBorder,
              },
            ]}
          >
            <View
              style={[
                styles.innerCore,
                isNarrowMobile && styles.innerCoreCompact,
                { backgroundColor: palette.coreElevatedBg },
              ]}
            >
              <View style={styles.sectionHeaderCluster}>
                <CloudArrowDown
                  size={16}
                  color={palette.accent}
                  weight="duotone"
                />
                <Text style={[styles.sectionTitle, { color: palette.inkPrimary }]}>
                  Tải gói Cài đặt & Mở nhanh lên Máy tính
                </Text>
              </View>

              <View style={styles.actionButtonsStack}>
                <View style={styles.zipButtonsRow}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      handleDownloadZip(
                        'weather-buddy-extension.zip',
                        'Extension Trình duyệt'
                      )
                    }
                    style={({ pressed }) => [
                      styles.primaryDownloadBtn,
                      WEB_NO_OUTLINE,
                      {
                        backgroundColor: palette.pillActiveBg,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                      },
                    ]}
                  >
                    <DownloadSimple
                      size={15}
                      color={palette.pillActiveInk}
                      weight="duotone"
                    />
                    <Text
                      style={[
                        styles.primaryDownloadText,
                        { color: palette.pillActiveInk },
                      ]}
                    >
                      Tải Extension (.zip)
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      handleDownloadZip(
                        'weather-buddy-desktop-widget.zip',
                        'Widget Máy tính'
                      )
                    }
                    style={({ pressed }) => [
                      styles.primaryDownloadBtn,
                      WEB_NO_OUTLINE,
                      {
                        backgroundColor: palette.accent,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                      },
                    ]}
                  >
                    <Desktop
                      size={15}
                      color={palette.accentContrastInk}
                      weight="duotone"
                    />
                    <Text
                      style={[
                        styles.primaryDownloadText,
                        { color: palette.accentContrastInk },
                      ]}
                    >
                      Tải Widget PC (.zip)
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.zipButtonsRow}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleLaunchWindowsWidget}
                    style={({ pressed }) => [
                      styles.secondaryActionBtn,
                      WEB_NO_OUTLINE,
                      {
                        backgroundColor: palette.accentSoftBg,
                        borderColor: palette.bezelOuterBorder,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                      },
                    ]}
                  >
                    {launchingWidget ? (
                      <ActivityIndicator size="small" color={palette.accent} />
                    ) : (
                      <ArrowSquareOut
                        size={14}
                        color={palette.accent}
                        weight="bold"
                      />
                    )}
                    <Text
                      style={[
                        styles.secondaryActionText,
                        { color: palette.accent },
                      ]}
                    >
                      Mở ngay Widget Windows
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={handleExportJsonConfig}
                    style={({ pressed }) => [
                      styles.secondaryActionBtn,
                      WEB_NO_OUTLINE,
                      {
                        backgroundColor: palette.coreSurfaceBg,
                        borderColor: palette.bezelOuterBorder,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                      },
                    ]}
                  >
                    <FileCode
                      size={15}
                      color={palette.inkPrimary}
                      weight="duotone"
                    />
                    <Text
                      style={[
                        styles.secondaryActionText,
                        { color: palette.inkPrimary },
                      ]}
                    >
                      Xuất cấu hình (.json)
                    </Text>
                  </Pressable>
                </View>

                {config.target === 'mobile_lockscreen' && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={onJumpToMobileWidgets}
                    style={({ pressed }) => [
                      styles.secondaryActionBtn,
                      WEB_NO_OUTLINE,
                      {
                        backgroundColor: palette.coreSurfaceBg,
                        borderColor: palette.accent,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                      },
                    ]}
                  >
                    <DeviceMobile
                      size={15}
                      color={palette.accent}
                      weight="duotone"
                    />
                    <Text
                      style={[
                        styles.secondaryActionText,
                        { color: palette.accent },
                      ]}
                    >
                      Xem mẫu Widget iPhone & Android
                    </Text>
                  </Pressable>
                )}
              </View>

              {actionToast && (
                <View
                  style={[
                    styles.toastBox,
                    {
                      backgroundColor: palette.coreSurfaceBg,
                      borderColor: palette.bezelOuterBorder,
                    },
                  ]}
                >
                  <Info size={14} color={palette.accent} weight="duotone" />
                  <Text style={[styles.toastText, { color: palette.inkPrimary }]}>
                    {actionToast}
                  </Text>
                </View>
              )}

              {/* Concise Step-by-Step Setup Instructions */}
              <View
                style={[
                  styles.guideStepsBox,
                  {
                    backgroundColor: palette.coreSurfaceBg,
                    borderColor: palette.hairline,
                  },
                ]}
              >
                <Text style={[styles.guideBoxTitle, { color: palette.inkPrimary }]}>
                  Hướng dẫn cài đặt nhanh:
                </Text>
                <Text
                  style={[styles.guideStepLine, { color: palette.inkSecondary }]}
                >
                  1. <Text style={styles.boldText}>Extension Trình duyệt</Text>: Giải nén{' '}
                  <Text style={styles.boldText}>weather-buddy-extension.zip</Text>, mở{' '}
                  <Text style={styles.boldText}>chrome://extensions</Text>, bật{' '}
                  <Text style={styles.boldText}>Developer mode</Text> rồi chọn{' '}
                  <Text style={styles.boldText}>Load unpacked</Text>.
                </Text>
                <Text
                  style={[styles.guideStepLine, { color: palette.inkSecondary }]}
                >
                  2. <Text style={styles.boldText}>Widget Màn hình Windows</Text>: Bấm{' '}
                  <Text style={styles.boldText}>Mở ngay Widget Windows</Text> hoặc chạy{' '}
                  <Text style={styles.boldText}>WeatherBuddy-Desktop.bat</Text>.
                </Text>
                <Text
                  style={[styles.guideStepLine, { color: palette.inkSecondary }]}
                >
                  3. <Text style={styles.boldText}>Nguồn dữ liệu</Text>: Tự động dùng Open-Meteo miễn phí, có thể nhập khóa API riêng trong phần Cài đặt khi cần.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  hubStack: {
    width: '100%',
    minWidth: 0,
    gap: 18,
    paddingBottom: 36,
  },
  outerBezel: {
    padding: 5,
    borderRadius: 28,
    borderWidth: 1,
    minWidth: 0,
  },
  innerCore: {
    borderRadius: 23,
    padding: 20,
    gap: 16,
    minWidth: 0,
  },
  innerCoreCompact: {
    padding: 14,
    gap: 13,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  badgeCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  readyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  readyPillText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    fontWeight: '700',
  },
  hubTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  hubSub: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13.5,
    lineHeight: 20,
  },
  mainSplitGrid: {
    width: '100%',
    minWidth: 0,
    gap: 18,
  },
  splitRowDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  splitColMobile: {
    flexDirection: 'column',
  },
  matrixCol: {
    flex: 1.06,
    width: '100%',
    minWidth: 0,
    gap: 18,
  },
  previewAndActionsCol: {
    flex: 1,
    width: '100%',
    minWidth: 0,
    gap: 18,
  },
  sectionHeaderCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  sectionTitle: {
    flex: 1,
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 15,
    fontWeight: '700',
  },
  controlBlock: {
    gap: 8,
  },
  dualControlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  halfControlCol: {
    flex: 1,
    minWidth: 180,
    gap: 8,
  },
  controlLabel: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13,
    fontWeight: '700',
  },
  pillsWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  optionPillText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '600',
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pcMonitorFrame: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#0B1220',
    borderWidth: 1.5,
    borderColor: 'rgba(203, 221, 245, 0.18)',
  },
  pcMonitorTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#152033',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(203, 221, 245, 0.10)',
  },
  windowDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  winDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pcMonitorUrlText: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11,
    fontWeight: '600',
    color: '#B2C1D6',
  },
  toolbarBadgePreview: {
    backgroundColor: '#1E6BB8',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  toolbarBadgeText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#EEF3FA',
    fontVariant: ['tabular-nums'],
  },
  pcMonitorCanvas: {
    height: 268,
    position: 'relative',
    padding: 14,
    backgroundColor: '#101A2D',
  },
  previewClockBlock: {
    gap: 2,
    maxWidth: '58%',
  },
  previewClockTime: {
    fontFamily: FONT_FAMILY_DISPLAY,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '700',
    color: '#EEF3FA',
    letterSpacing: -1.1,
    fontVariant: ['tabular-nums'],
  },
  previewClockDate: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11,
    fontWeight: '600',
    color: '#B2C1D6',
  },
  previewSearchBar: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 175,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(203, 221, 245, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(203, 221, 245, 0.16)',
  },
  previewSearchPlaceholder: {
    flex: 1,
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 10.5,
    color: '#B2C1D6',
  },
  floatingCornerWidget: {
    position: 'absolute',
    borderRadius: 18,
    backgroundColor: 'rgba(21, 32, 51, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(107, 169, 232, 0.30)',
    padding: 9,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  floatingWidgetCompact: {
    width: 140,
    minHeight: 156,
  },
  floatingWidgetStandard: {
    width: 168,
    minHeight: 186,
  },
  floatingWidgetHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  floatingWidgetCity: {
    flex: 1,
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#EEF3FA',
  },
  floatingWidgetTemp: {
    fontFamily: FONT_FAMILY_DISPLAY,
    fontSize: 13,
    fontWeight: '700',
    color: '#6BA9E8',
    fontVariant: ['tabular-nums'],
  },
  floatingWidgetAdvice: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 10,
    fontWeight: '600',
    color: '#B2C1D6',
    textAlign: 'center',
  },
  pcTaskbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#0B1220',
    borderTopWidth: 1,
    borderTopColor: 'rgba(203, 221, 245, 0.10)',
  },
  pcTaskbarText: {
    flexShrink: 1,
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 10.5,
    fontWeight: '600',
    color: '#B2C1D6',
  },
  actionButtonsStack: {
    gap: 10,
  },
  zipButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryDownloadBtn: {
    flex: 1,
    minWidth: 160,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
  },
  primaryDownloadText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    flex: 1,
    minWidth: 160,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 1,
  },
  secondaryActionText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '700',
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  toastText: {
    flex: 1,
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '600',
  },
  guideStepsBox: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  guideBoxTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13,
    fontWeight: '700',
  },
  guideStepLine: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
  },
});

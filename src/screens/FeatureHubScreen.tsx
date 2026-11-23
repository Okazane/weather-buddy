import React, { useCallback, useEffect, useState } from 'react';
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
import { Feather } from '@expo/vector-icons';
import type {
  CharacterDecision,
  Gender,
  ThermalSensitivity,
  WeatherSnapshot,
} from '../core';
import { LivingCharacterRig } from '../components/LivingCharacterRig';
import { resolveBackendBaseUrl } from '../hooks/useWeatherBuddy';
import {
  FONT_FAMILY_DISPLAY,
  FONT_FAMILY_SANS,
  sanitizeCopy,
  WEB_NO_OUTLINE,
  type AtmosphericPalette,
} from '../components/themeTokens';

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

const PLATFORM_CARDS: Array<{
  id: PlatformInstallTarget;
  icon: React.ComponentProps<typeof Feather>['name'];
  tagVi: string;
  titleVi: string;
  descVi: string;
}> = [
  {
    id: 'browser_newtab',
    icon: 'layout',
    tagVi: 'Chrome · Edge · Cốc Cốc',
    titleVi: '🌐 Extension Tab Mới Trình duyệt',
    descVi: 'Mở tab mới hiện Chibi NPC, đồng hồ HH:MM, thanh tìm kiếm và dự báo 12h',
  },
  {
    id: 'browser_popup',
    icon: 'bookmark',
    tagVi: 'Toolbar Badge 15p',
    titleVi: '📌 Popup Thanh công cụ Trình duyệt',
    descVi: 'Ghim nhiệt độ trực tiếp lên thanh công cụ, bấm mở nhanh khung 380×560',
  },
  {
    id: 'desktop_widget',
    icon: 'monitor',
    tagVi: 'Windows Desktop · Always-on-Top',
    titleVi: '🖥️ Widget Nổi Màn hình Máy tính',
    descVi: 'Đặt nhân vật Chibi NPC nổi ở góc màn hình PC Windows hoặc chạy Electron',
  },
  {
    id: 'mobile_lockscreen',
    icon: 'smartphone',
    tagVi: 'iOS 16+ & Android 12+',
    titleVi: '📱 Widget Màn hình khóa Điện thoại',
    descVi: 'Đồng bộ App Group WidgetKit trên iPhone và Jetpack Glance trên Android',
  },
];

const CORNER_OPTIONS: Array<{
  id: DesktopCornerPosition;
  labelVi: string;
}> = [
  { id: 'BottomRight', labelVi: 'Góc phải dưới' },
  { id: 'TopRight', labelVi: 'Góc phải trên' },
  { id: 'BottomLeft', labelVi: 'Góc trái dưới' },
  { id: 'TopLeft', labelVi: 'Góc trái trên' },
];

const SIZE_OPTIONS: Array<{
  id: DesktopWidgetSize;
  labelVi: string;
  dimLabel: string;
}> = [
  { id: 'Compact', labelVi: 'Gọn nhẹ', dimLabel: '300×420' },
  { id: 'Standard', labelVi: 'Tiêu chuẩn', dimLabel: '380×540' },
];

const MODULE_ROWS: Array<{
  key: keyof FeatureModuleToggles;
  icon: React.ComponentProps<typeof Feather>['name'];
  labelVi: string;
  subVi: string;
}> = [
  {
    key: 'showBigClock',
    icon: 'clock',
    labelVi: 'Đồng hồ lớn HH:MM trên Tab mới',
    subVi: 'Hiển thị giờ và ngày tháng chữ số bảng rõ nét',
  },
  {
    key: 'showSearchBar',
    icon: 'search',
    labelVi: 'Thanh tìm kiếm nhanh',
    subVi: 'Tìm nhanh trên Google hoặc DuckDuckGo ngay tại Tab mới',
  },
  {
    key: 'autoRotateNpc5m',
    icon: 'shuffle',
    labelVi: 'Tự động đổi 5 hành động Chibi NPC mỗi 5 phút',
    subVi: 'Đọc sách, chơi với mèo, chơi với cún, xem điện thoại, nghe nhạc',
  },
  {
    key: 'alwaysOnTop',
    icon: 'layers',
    labelVi: 'Ghim nổi trên cửa sổ khác (Always-on-Top)',
    subVi: 'Giữ Widget máy tính luôn hiển thị trên màn hình làm việc',
  },
  {
    key: 'autoRefresh15m',
    icon: 'refresh-cw',
    labelVi: 'Tự cập nhật thời tiết mỗi 15 phút',
    subVi: 'Đồng bộ nền qua Chrome Alarms, WorkManager và Backend Cache',
  },
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

  const toggleModule = (key: keyof FeatureModuleToggles) => {
    setConfig((prev) => ({
      ...prev,
      modules: {
        ...prev.modules,
        [key]: !prev.modules[key],
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
      setActionToast('Đã xuất file cấu hình weather-buddy-config.json (0 chứa khóa API).');
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
      ? { bottom: 14, right: 14 }
      : config.corner === 'TopRight'
        ? { top: 14, right: 14 }
        : config.corner === 'BottomLeft'
          ? { bottom: 14, left: 14 }
          : { top: 14, left: 14 };

  return (
    <View style={styles.hubStack}>
      {/* Header Banner */}
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
                  <Feather name="package" size={12} color={palette.accent} />
                  <Text style={[styles.readyPillText, { color: palette.accent }]}>
                    Đa nền tảng · Web · Extension · Windows PC · iOS/Android
                  </Text>
                </View>
              </View>

              <Text style={[styles.hubTitle, { color: palette.inkPrimary }]}>
                🎛️ Trung tâm Tính năng & Cài đặt Đa nền tảng
              </Text>
              <Text style={[styles.hubSub, { color: palette.inkSecondary }]}>
                Chọn kiểu hiển thị yêu thích, tùy chỉnh vị trí neo, bật/tắt các module chức năng và tải gói cài đặt hoàn chỉnh cho trình duyệt hoặc màn hình máy tính.
              </Text>
            </View>
          </View>

          {/* 4 Platform Mode Selector Cards */}
          <View style={styles.platformGrid}>
            {PLATFORM_CARDS.map((card) => {
              const isSelected = config.target === card.id;
              return (
                <Pressable
                  key={card.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => updateTarget(card.id)}
                  style={({ pressed }) => [
                    styles.platformCard,
                    WEB_NO_OUTLINE,
                    {
                      width: isTwoCol ? '23.8%' : '48%',
                      backgroundColor: isSelected
                        ? palette.coreSurfaceBg
                        : palette.bezelOuterBg,
                      borderColor: isSelected
                        ? palette.accent
                        : palette.bezelOuterBorder,
                      borderWidth: isSelected ? 1.5 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                >
                  <View style={styles.platformCardTop}>
                    <View
                      style={[
                        styles.platformIconCircle,
                        {
                          backgroundColor: isSelected
                            ? palette.pillActiveBg
                            : palette.accentSoftBg,
                        },
                      ]}
                    >
                      <Feather
                        name={card.icon}
                        size={15}
                        color={
                          isSelected ? palette.pillActiveInk : palette.accent
                        }
                      />
                    </View>
                    <Text
                      style={[
                        styles.platformTagText,
                        { color: palette.accent },
                      ]}
                    >
                      {card.tagVi}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.platformCardTitle,
                      { color: palette.inkPrimary },
                    ]}
                  >
                    {card.titleVi}
                  </Text>
                  <Text
                    style={[
                      styles.platformCardDesc,
                      { color: palette.inkSecondary },
                    ]}
                  >
                    {card.descVi}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* Main Split: Left = Interactive Customization Matrix, Right = Live Mini-Preview + Action Bar */}
      <View
        style={[
          styles.mainSplitGrid,
          isTwoCol ? styles.splitRowDesktop : styles.splitColMobile,
        ]}
      >
        {/* Left Column: Interactive Customization Matrix */}
        <View
          style={[
            styles.outerBezel,
            styles.matrixCol,
            {
              backgroundColor: palette.bezelOuterBg,
              borderColor: palette.bezelOuterBorder,
            },
          ]}
        >
          <View
            style={[
              styles.innerCore,
              { backgroundColor: palette.coreSurfaceBg },
            ]}
          >
            <View style={styles.sectionHeaderCluster}>
              <Feather name="sliders" size={15} color={palette.accent} />
              <Text style={[styles.sectionTitle, { color: palette.inkPrimary }]}>
                Bảng tùy chỉnh chức năng trực quan
              </Text>
            </View>

            {/* 1. Desktop Corner Anchor Position */}
            <View style={styles.controlBlock}>
              <Text style={[styles.controlLabel, { color: palette.inkPrimary }]}>
                Vị trí neo trên màn hình máy tính
              </Text>
              <View style={styles.pillsWrapRow}>
                {CORNER_OPTIONS.map((c) => {
                  const active = config.corner === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => updateCorner(c.id)}
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
                        {c.labelVi}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 2. Widget Size + Character Gender Quick Selector */}
            <View style={styles.dualControlsRow}>
              <View style={styles.halfControlCol}>
                <Text
                  style={[styles.controlLabel, { color: palette.inkPrimary }]}
                >
                  Kích thước Widget
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
                <Text
                  style={[styles.controlLabel, { color: palette.inkPrimary }]}
                >
                  Nhân vật & Độ nhạy nhiệt
                </Text>
                <View style={styles.pillsWrapRow}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      onSelectGender(gender === 'male' ? 'female' : 'male')
                    }
                    style={[
                      styles.optionPill,
                      WEB_NO_OUTLINE,
                      {
                        backgroundColor: palette.coreElevatedBg,
                        borderColor: palette.bezelOuterBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionPillText,
                        { color: palette.inkPrimary },
                      ]}
                    >
                      {gender === 'male'
                        ? '👦 Nam (Cậu bé Mây)'
                        : '👧 Nữ (Cô bé Nắng)'}
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      onSelectSensitivity(
                        sensitivity === 'normal'
                          ? 'cold_sensitive'
                          : sensitivity === 'cold_sensitive'
                            ? 'heat_sensitive'
                            : 'normal'
                      )
                    }
                    style={[
                      styles.optionPill,
                      WEB_NO_OUTLINE,
                      {
                        backgroundColor: palette.coreElevatedBg,
                        borderColor: palette.bezelOuterBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionPillText,
                        { color: palette.inkPrimary },
                      ]}
                    >
                      {sensitivity === 'cold_sensitive'
                        ? 'Sợ lạnh (-3°C)'
                        : sensitivity === 'heat_sensitive'
                          ? 'Sợ nóng (+3°C)'
                          : 'Nhiệt độ chuẩn'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* 3. Module Toggle Switches */}
            <View style={styles.controlBlock}>
              <Text style={[styles.controlLabel, { color: palette.inkPrimary }]}>
                Bật / Tắt từng Module chức năng
              </Text>

              <View style={styles.modulesList}>
                {MODULE_ROWS.map((mod) => {
                  const enabled = config.modules[mod.key];
                  return (
                    <Pressable
                      key={mod.key}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: enabled }}
                      onPress={() => toggleModule(mod.key)}
                      style={({ pressed }) => [
                        styles.moduleRowCard,
                        WEB_NO_OUTLINE,
                        {
                          backgroundColor: enabled
                            ? palette.coreElevatedBg
                            : palette.bezelOuterBg,
                          borderColor: enabled
                            ? palette.bezelOuterBorder
                            : palette.hairline,
                          opacity: pressed ? 0.92 : 1,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.moduleIconBox,
                          {
                            backgroundColor: enabled
                              ? palette.accentSoftBg
                              : palette.pillIdleBg,
                          },
                        ]}
                      >
                        <Feather
                          name={mod.icon}
                          size={14}
                          color={enabled ? palette.accent : palette.inkMuted}
                        />
                      </View>

                      <View style={styles.moduleTextCol}>
                        <Text
                          style={[
                            styles.moduleTitle,
                            { color: palette.inkPrimary },
                          ]}
                        >
                          {mod.labelVi}
                        </Text>
                        <Text
                          style={[
                            styles.moduleSub,
                            { color: palette.inkSecondary },
                          ]}
                        >
                          {mod.subVi}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.toggleTrack,
                          {
                            backgroundColor: enabled
                              ? palette.accent
                              : palette.hairline,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.toggleThumb,
                            {
                              transform: [{ translateX: enabled ? 16 : 2 }],
                            },
                          ]}
                        />
                      </View>
                    </Pressable>
                  );
                })}
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
                { backgroundColor: palette.coreElevatedBg },
              ]}
            >
              <View style={styles.previewHeaderRow}>
                <View style={styles.sectionHeaderCluster}>
                  <Feather name="eye" size={15} color={palette.accent} />
                  <Text
                    style={[styles.sectionTitle, { color: palette.inkPrimary }]}
                  >
                    Xem trước Trực tiếp ({cornerLabelVi} · {sizeMeta.dimLabel})
                  </Text>
                </View>
              </View>

              {/* Simulated 16:10 PC Monitor / Browser Tab Canvas */}
              <View style={styles.pcMonitorFrame}>
                {/* Browser / Desktop Top Chrome Bar */}
                <View style={styles.pcMonitorTopBar}>
                  <View style={styles.windowDotsRow}>
                    <View
                      style={[styles.winDot, { backgroundColor: '#FB7185' }]}
                    />
                    <View
                      style={[styles.winDot, { backgroundColor: '#FBBF24' }]}
                    />
                    <View
                      style={[styles.winDot, { backgroundColor: '#34D399' }]}
                    />
                  </View>
                  <Text style={styles.pcMonitorUrlText}>
                    {config.target === 'browser_newtab'
                      ? 'chrome://newtab · WeatherBuddy Chibi NPC'
                      : config.target === 'browser_popup'
                        ? 'Toolbar Popup · Badge 15 phút'
                        : config.target === 'mobile_lockscreen'
                          ? 'iOS 16+ WidgetKit & Android Glance'
                          : `Windows Desktop · ${cornerLabelVi} (${
                              config.modules.alwaysOnTop
                                ? 'Always-on-Top'
                                : 'Thường'
                            })`}
                  </Text>
                  <View style={styles.toolbarBadgePreview}>
                    <Text style={styles.toolbarBadgeText}>
                      {Math.round(weather.temperatureC)}°
                    </Text>
                  </View>
                </View>

                {/* Monitor Wallpaper Workspace */}
                <View style={styles.pcMonitorCanvas}>
                  {/* Optional New-Tab Big Clock & Quick Search Bar */}
                  {config.modules.showBigClock && (
                    <View style={styles.previewClockBlock}>
                      <Text style={styles.previewClockTime}>09:41</Text>
                      <Text style={styles.previewClockDate}>
                        {weather.locationName} · Cảm giác{' '}
                        {Math.round(weather.feelsLikeC)}°C
                      </Text>
                    </View>
                  )}

                  {config.modules.showSearchBar && (
                    <View style={styles.previewSearchBar}>
                      <Feather name="search" size={12} color="#94A3B8" />
                      <Text style={styles.previewSearchPlaceholder}>
                        Tìm kiếm nhanh trên Google...
                      </Text>
                    </View>
                  )}

                  {/* Floating Corner Chibi NPC Desktop / Extension Widget Card */}
                  <View
                    style={[
                      styles.floatingCornerWidget,
                      cornerAlignmentStyle,
                      config.size === 'Compact'
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
                      size={config.size === 'Compact' ? 86 : 104}
                      reduceMotion={reduceMotion}
                      interactive
                      showAmbientProps={false}
                      npcMode={config.modules.autoRotateNpc5m}
                    />

                    <Text
                      numberOfLines={1}
                      style={styles.floatingWidgetAdvice}
                    >
                      {sanitizeCopy(decision.outfitAdviceVi)}
                    </Text>
                  </View>
                </View>

                {/* Windows Taskbar Strip */}
                <View style={styles.pcTaskbar}>
                  <Text style={styles.pcTaskbarText}>
                    {config.modules.autoRotateNpc5m
                      ? 'NPC tự đổi 5 hành động / 5p · Chạm để đứng dậy'
                      : 'Chế độ Đứng báo thời tiết cố định'}
                  </Text>
                  <Text style={styles.pcTaskbarText}>
                    {config.modules.autoRefresh15m ? 'Đồng bộ 15p' : 'Thủ công'}
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
                { backgroundColor: palette.coreElevatedBg },
              ]}
            >
              <View style={styles.sectionHeaderCluster}>
                <Feather name="download-cloud" size={15} color={palette.accent} />
                <Text
                  style={[styles.sectionTitle, { color: palette.inkPrimary }]}
                >
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
                    <Feather
                      name="download"
                      size={14}
                      color={palette.pillActiveInk}
                    />
                    <Text
                      style={[
                        styles.primaryDownloadText,
                        { color: palette.pillActiveInk },
                      ]}
                    >
                      ⬇️ Tải Extension Trình duyệt (.zip)
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
                    <Feather name="monitor" size={14} color="#F8FAFC" />
                    <Text
                      style={[
                        styles.primaryDownloadText,
                        { color: '#F8FAFC' },
                      ]}
                    >
                      ⬇️ Tải Widget Máy tính (.zip)
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
                      <Feather name="external-link" size={14} color={palette.accent} />
                    )}
                    <Text
                      style={[
                        styles.secondaryActionText,
                        { color: palette.accent },
                      ]}
                    >
                      🚀 Mở ngay Widget lên Màn hình Windows
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
                    <Feather
                      name="file-text"
                      size={14}
                      color={palette.inkPrimary}
                    />
                    <Text
                      style={[
                        styles.secondaryActionText,
                        { color: palette.inkPrimary },
                      ]}
                    >
                      📋 Xuất cấu hình cá nhân (.json)
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
                    <Feather
                      name="smartphone"
                      size={14}
                      color={palette.accent}
                    />
                    <Text
                      style={[
                        styles.secondaryActionText,
                        { color: palette.accent },
                      ]}
                    >
                      Xem khung mô phỏng iPhone Lock Screen & Android Glance
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
                  <Feather name="info" size={13} color={palette.accent} />
                  <Text
                    style={[styles.toastText, { color: palette.inkPrimary }]}
                  >
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
                <Text
                  style={[styles.guideBoxTitle, { color: palette.inkPrimary }]}
                >
                  Hướng dẫn cài đặt nhanh (3 bước):
                </Text>
                <Text
                  style={[styles.guideStepLine, { color: palette.inkSecondary }]}
                >
                  1. <Text style={styles.boldText}>Extension Trình duyệt</Text>: Giải nén{' '}
                  <Text style={styles.boldText}>weather-buddy-extension.zip</Text> (hoặc chọn thư mục{' '}
                  <Text style={styles.boldText}>browser-extension/</Text>), mở{' '}
                  <Text style={styles.boldText}>chrome://extensions</Text> hoặc{' '}
                  <Text style={styles.boldText}>edge://extensions</Text>, bật{' '}
                  <Text style={styles.boldText}>Developer mode</Text> → bấm{' '}
                  <Text style={styles.boldText}>Load unpacked</Text>.
                </Text>
                <Text
                  style={[styles.guideStepLine, { color: palette.inkSecondary }]}
                >
                  2. <Text style={styles.boldText}>Widget Màn hình Windows</Text>: Bấm nút{' '}
                  <Text style={styles.boldText}>🚀 Mở ngay Widget</Text> ở trên, hoặc mở{' '}
                  <Text style={styles.boldText}>desktop-widget/WeatherBuddy-Desktop.bat</Text> (chạy{' '}
                  <Text style={styles.boldText}>Install-Shortcut.ps1</Text> để ghim ra Desktop & khởi động cùng Windows).
                </Text>
                <Text
                  style={[styles.guideStepLine, { color: palette.inkSecondary }]}
                >
                  3. <Text style={styles.boldText}>Khóa API cá nhân</Text>: Tất cả nền tảng mặc định để trống khóa API (tự dùng Open-Meteo miễn phí). Khi cần, mở Cài đặt để dán Google Weather / Tomorrow.io / WeatherAPI Key của riêng bạn.
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
    gap: 18,
    paddingBottom: 36,
  },
  outerBezel: {
    padding: 5,
    borderRadius: 28,
    borderWidth: 1,
  },
  innerCore: {
    borderRadius: 23,
    padding: 20,
    gap: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTextCol: {
    flex: 1,
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
    fontSize: 12,
    fontWeight: '700',
  },
  hubTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 20,
    fontWeight: '700',
  },
  hubSub: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13.5,
    lineHeight: 20,
  },
  platformGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  platformCard: {
    flexGrow: 1,
    minWidth: 200,
    borderRadius: 18,
    padding: 15,
    gap: 8,
  },
  platformCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  platformIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformTagText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11,
    fontWeight: '700',
  },
  platformCardTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 14.5,
    fontWeight: '700',
  },
  platformCardDesc: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    lineHeight: 17,
  },
  mainSplitGrid: {
    width: '100%',
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
    flex: 1.08,
    width: '100%',
  },
  previewAndActionsCol: {
    flex: 1,
    width: '100%',
    gap: 18,
  },
  sectionHeaderCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 15.5,
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
    minWidth: 210,
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
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  optionPillText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '600',
  },
  modulesList: {
    gap: 8,
  },
  moduleRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  moduleIconBox: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleTextCol: {
    flex: 1,
    gap: 2,
  },
  moduleTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13.5,
    fontWeight: '700',
  },
  moduleSub: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    lineHeight: 16,
  },
  toggleTrack: {
    width: 38,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pcMonitorFrame: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#0B1322',
    borderWidth: 1.5,
    borderColor: 'rgba(148, 163, 184, 0.28)',
  },
  pcMonitorTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#131F33',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
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
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  toolbarBadgePreview: {
    backgroundColor: '#185ADB',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  toolbarBadgeText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#F8FAFC',
    fontVariant: ['tabular-nums'],
  },
  pcMonitorCanvas: {
    height: 274,
    position: 'relative',
    padding: 16,
    backgroundColor: '#0F1A2E',
  },
  previewClockBlock: {
    gap: 2,
  },
  previewClockTime: {
    fontFamily: FONT_FAMILY_DISPLAY,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
  },
  previewClockDate: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#94A3B8',
  },
  previewSearchBar: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    maxWidth: 220,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  previewSearchPlaceholder: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11,
    color: '#94A3B8',
  },
  floatingCornerWidget: {
    position: 'absolute',
    borderRadius: 20,
    backgroundColor: 'rgba(19, 32, 54, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.35)',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  floatingWidgetCompact: {
    width: 152,
    minHeight: 168,
  },
  floatingWidgetStandard: {
    width: 176,
    minHeight: 194,
  },
  floatingWidgetHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  floatingWidgetCity: {
    flex: 1,
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  floatingWidgetTemp: {
    fontFamily: FONT_FAMILY_DISPLAY,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#60A5FA',
    fontVariant: ['tabular-nums'],
  },
  floatingWidgetAdvice: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 10.5,
    fontWeight: '600',
    color: '#CBD5E1',
    textAlign: 'center',
  },
  pcTaskbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#080D17',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  pcTaskbarText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 10.5,
    fontWeight: '600',
    color: '#94A3B8',
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
    minWidth: 205,
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
    minWidth: 205,
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

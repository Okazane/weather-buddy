/* Lucian UX/UI Prompt #015 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#015 */
/* Lucian UX/UI Prompt #036 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#036 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type {
  ThermalSensitivity,
  WeatherProviderType,
  WeatherSnapshot,
} from '../core';
import {
  LucianApiKeyField,
  LucianPlanRadioCards,
  useResolvedLucianDark,
  type LucianRadioOption,
} from '../lucian/LucianHubComponents';
import {
  Check,
  CheckCircle,
  Eye,
  EyeSlash,
  Lightning,
  SlidersHorizontal,
  Trash,
  X,
} from './AppIcons';
import {
  FONT_FAMILY_SANS,
  sanitizeCopy,
  WEB_NO_OUTLINE,
  type AtmosphericPalette,
} from './themeTokens';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  palette?: AtmosphericPalette;
  sensitivity: ThermalSensitivity;
  onSelectSensitivity: (s: ThermalSensitivity) => void;
  providerPref: WeatherProviderType;
  onSelectProvider: (p: WeatherProviderType) => void;
  tomorrowIoApiKey: string;
  onSaveTomorrowIoApiKey: (key: string) => void;
  weatherApiKey: string;
  onSaveWeatherApiKey: (key: string) => void;
  googleApiKey: string;
  onSaveGoogleApiKey: (key: string) => void;
  activeWeather: WeatherSnapshot;
  isLiveMode: boolean;
  liveError: string | null;
}

const SENSITIVITY_RADIO_OPTIONS: ReadonlyArray<LucianRadioOption<ThermalSensitivity>> = [
  {
    id: 'cold_sensitive',
    title: 'Sợ lạnh',
    subtitle: 'Mặc ấm sớm (-3°C)',
    icon: 'snowflake',
    gradient: 'linear-gradient(140deg,#3A7EC2,#1E6BB8)',
  },
  {
    id: 'normal',
    title: 'Bình thường',
    subtitle: 'Chuẩn cảm nhận',
    badge: 'Mặc định',
    icon: 'sun',
    gradient: 'linear-gradient(140deg,#3B9D7C,#168560)',
  },
  {
    id: 'heat_sensitive',
    title: 'Sợ nóng',
    subtitle: 'Mặc thoáng (+3°C)',
    icon: 'flame',
    gradient: 'linear-gradient(140deg,#D98A3C,#B86818)',
  },
];

const PROVIDER_RADIO_OPTIONS: ReadonlyArray<LucianRadioOption<WeatherProviderType>> = [
  {
    id: 'auto',
    title: 'Tự động',
    subtitle: 'Ưu tiên khóa đã nhập, dự phòng Open-Meteo miễn phí',
    badge: 'Khuyên dùng',
    metaPrimary: '15p',
    metaSecondary: 'Tự chuyển',
    icon: 'zap',
    gradient: 'linear-gradient(140deg,#3A7EC2,#1E6BB8)',
  },
  {
    id: 'open_meteo',
    title: 'Open-Meteo',
    subtitle: 'Miễn phí 100%, không cần khóa API',
    metaPrimary: 'Miễn phí',
    metaSecondary: 'Không cần khóa',
    icon: 'cloud',
    gradient: 'linear-gradient(140deg,#3B9D7C,#168560)',
  },
  {
    id: 'google',
    title: 'Google Weather API',
    subtitle: 'Sử dụng khóa Google Weather cá nhân',
    metaPrimary: 'Khóa riêng',
    metaSecondary: 'Tùy chọn',
    icon: 'globe',
    gradient: 'linear-gradient(140deg,#3A7EC2,#255B96)',
  },
  {
    id: 'tomorrow_io',
    title: 'Tomorrow.io',
    subtitle: 'Sử dụng khóa Tomorrow.io cá nhân',
    metaPrimary: 'Khóa riêng',
    metaSecondary: 'Tùy chọn',
    icon: 'key',
    gradient: 'linear-gradient(140deg,#4A78A8,#2A5580)',
  },
  {
    id: 'weatherapi',
    title: 'WeatherAPI.com',
    subtitle: 'Sử dụng khóa WeatherAPI.com cá nhân',
    metaPrimary: 'Khóa riêng',
    metaSecondary: 'Tùy chọn',
    icon: 'key',
    gradient: 'linear-gradient(140deg,#388E78,#1F6B59)',
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  palette,
  sensitivity,
  onSelectSensitivity,
  providerPref,
  onSelectProvider,
  tomorrowIoApiKey,
  onSaveTomorrowIoApiKey,
  weatherApiKey,
  onSaveWeatherApiKey,
  googleApiKey,
  onSaveGoogleApiKey,
  activeWeather,
  isLiveMode,
  liveError,
}) => {
  const { width } = useWindowDimensions();
  const isCompactMobile = width < 440;
  const isDark = useResolvedLucianDark(palette);

  const [draftGoogleKey, setDraftGoogleKey] = useState<string>(googleApiKey);
  const [draftTomorrowKey, setDraftTomorrowKey] = useState<string>(tomorrowIoApiKey);
  const [draftWeatherApiKey, setDraftWeatherApiKey] = useState<string>(weatherApiKey);
  const [showGoogleKey, setShowGoogleKey] = useState<boolean>(false);
  const [showTomorrowKey, setShowTomorrowKey] = useState<boolean>(false);
  const [showWeatherApiKey, setShowWeatherApiKey] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setDraftGoogleKey(googleApiKey);
      setDraftTomorrowKey(tomorrowIoApiKey);
      setDraftWeatherApiKey(weatherApiKey);
      setShowGoogleKey(false);
      setShowTomorrowKey(false);
      setShowWeatherApiKey(false);
      setFeedbackMessage(null);
    }
  }, [visible, googleApiKey, tomorrowIoApiKey, weatherApiKey]);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [visible, onClose]);

  const anyRevealed = showGoogleKey || showTomorrowKey || showWeatherApiKey;
  const toggleRevealAll = () => {
    const next = !anyRevealed;
    setShowGoogleKey(next);
    setShowTomorrowKey(next);
    setShowWeatherApiKey(next);
  };

  const activeProviderLabel = !isLiveMode
    ? 'Kịch bản mẫu'
    : activeWeather.provider === 'tomorrow_io'
      ? 'Tomorrow.io · 15p'
      : activeWeather.provider === 'weatherapi'
        ? 'WeatherAPI · 15p'
        : activeWeather.provider === 'google'
          ? 'Google Weather · 15p'
          : 'Open-Meteo · 15p';

  const isCustomProviderActive =
    activeWeather.provider === 'google' ||
    activeWeather.provider === 'tomorrow_io' ||
    activeWeather.provider === 'weatherapi';

  const handleApplyKeys = () => {
    onSaveGoogleApiKey(draftGoogleKey.trim());
    onSaveTomorrowIoApiKey(draftTomorrowKey.trim());
    onSaveWeatherApiKey(draftWeatherApiKey.trim());
    setFeedbackMessage('Đã lưu khóa API cá nhân an toàn trên thiết bị.');
  };

  const handleClearKeys = () => {
    setDraftGoogleKey('');
    setDraftTomorrowKey('');
    setDraftWeatherApiKey('');
    onSaveGoogleApiKey('');
    onSaveTomorrowIoApiKey('');
    onSaveWeatherApiKey('');
    if (
      providerPref === 'google' ||
      providerPref === 'tomorrow_io' ||
      providerPref === 'weatherapi'
    ) {
      onSelectProvider('auto');
    }
    setFeedbackMessage('Đã xóa khóa API - Tự động dùng Open-Meteo miễn phí.');
  };

  const surfaceCoreBg =
    palette?.coreSurfaceBg ?? (isDark ? '#152033' : '#FCFBF8');
  const outerBezelBg =
    palette?.bezelOuterBg ??
    (isDark ? 'rgba(21, 32, 51, 0.72)' : 'rgba(252, 251, 248, 0.62)');
  const outerBezelBorder =
    palette?.bezelOuterBorder ??
    (isDark ? 'rgba(203, 221, 245, 0.16)' : 'rgba(20, 29, 43, 0.12)');
  const inkPrimary = palette?.inkPrimary ?? (isDark ? '#EEF3FA' : '#141D2B');
  const inkSecondary =
    palette?.inkSecondary ?? (isDark ? '#B2C1D6' : '#384860');
  const closeBg = palette?.pillIdleBg ?? (isDark ? '#22324D' : '#ECE8DF');
  const keyPanelBg =
    palette?.coreElevatedBg ?? (isDark ? '#1C2A42' : '#F3EFE8');
  const keyPanelBorder =
    palette?.hairline ??
    (isDark ? 'rgba(203, 221, 245, 0.10)' : 'rgba(20, 29, 43, 0.09)');
  const accentColor = palette?.accent ?? (isDark ? '#6BA9E8' : '#1E6BB8');
  const accentSoftBg =
    palette?.accentSoftBg ??
    (isDark ? 'rgba(107, 169, 232, 0.15)' : 'rgba(30, 107, 184, 0.11)');
  const accentContrastInk =
    palette?.accentContrastInk ?? (isDark ? '#0B1220' : '#FCFBF8');
  const safeSoftBg = isDark
    ? 'rgba(88, 196, 158, 0.16)'
    : 'rgba(22, 133, 96, 0.12)';
  const safeInk = isDark ? '#58C49E' : '#146C4F';
  const hazardInk = isDark ? '#E5737D' : '#C4384B';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={[
          styles.backdrop,
          isCompactMobile && styles.backdropCompact,
          WEB_NO_OUTLINE,
        ]}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.outerBezel,
            {
              backgroundColor: outerBezelBg,
              borderColor: outerBezelBorder,
            },
            WEB_NO_OUTLINE,
          ]}
        >
          <View
            style={[
              styles.innerCore,
              isCompactMobile && styles.innerCoreCompact,
              { backgroundColor: surfaceCoreBg },
            ]}
          >
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={styles.headerTitleCluster}>
                <View
                  style={[
                    styles.headerIconBox,
                    {
                      backgroundColor: accentSoftBg,
                    },
                  ]}
                >
                  <SlidersHorizontal
                    size={18}
                    weight="duotone"
                    color={accentColor}
                  />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: inkPrimary }]}>
                    Cài đặt & Nguồn Thời tiết
                  </Text>
                  <Text style={[styles.modalSub, { color: inkSecondary }]}>
                    Cơ địa nhiệt độ & Khóa API cá nhân (mặc định trống)
                  </Text>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng cài đặt"
                onPress={onClose}
                style={[styles.closeBtn, { backgroundColor: closeBg }, WEB_NO_OUTLINE]}
              >
                <X size={16} weight="bold" color={inkPrimary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollBody}
            >
              {/* 1. Thermal Sensitivity — Lucian #015 Plan Radio Cards */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: inkPrimary }]}>
                  1. Cảm nhận nhiệt độ cá nhân
                </Text>
                <LucianPlanRadioCards
                  ariaLabel="Cảm nhận nhiệt độ"
                  options={SENSITIVITY_RADIO_OPTIONS}
                  value={sensitivity}
                  onChange={onSelectSensitivity}
                  columns={3}
                  compact
                  isDark={isDark}
                />
              </View>

              {/* 2. Weather Provider — Lucian #015 Plan Radio Cards */}
              <View style={styles.fieldGroup}>
                <View style={styles.labelStatusRow}>
                  <Text style={[styles.fieldLabel, { color: inkPrimary }]}>
                    2. Nguồn dữ liệu thời tiết
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: isCustomProviderActive
                          ? safeSoftBg
                          : accentSoftBg,
                      },
                    ]}
                  >
                    {isCustomProviderActive ? (
                      <Lightning
                        size={13}
                        weight="duotone"
                        color={safeInk}
                      />
                    ) : (
                      <CheckCircle
                        size={13}
                        weight="duotone"
                        color={accentColor}
                      />
                    )}
                    <Text
                      style={[
                        styles.statusBadgeText,
                        {
                          color: isCustomProviderActive ? safeInk : accentColor,
                        },
                      ]}
                    >
                      {activeProviderLabel}
                    </Text>
                  </View>
                </View>

                <LucianPlanRadioCards
                  ariaLabel="Nguồn thời tiết"
                  options={PROVIDER_RADIO_OPTIONS}
                  value={providerPref}
                  onChange={onSelectProvider}
                  columns={1}
                  compact
                  isDark={isDark}
                />
              </View>

              {/* 3. Blank User-Supplied API Inputs — Lucian #036 Masked Password/Key Inputs */}
              <View
                style={[
                  styles.keyVaultSection,
                  {
                    backgroundColor: keyPanelBg,
                    borderColor: keyPanelBorder,
                  },
                ]}
              >
                <View style={styles.labelStatusRow}>
                  <Text style={[styles.fieldLabel, { color: inkPrimary }]}>
                    3. Khóa API cá nhân (Tùy chọn)
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      anyRevealed ? 'Ẩn tất cả khóa API' : 'Hiện tất cả khóa API'
                    }
                    onPress={toggleRevealAll}
                    style={[
                      styles.revealToggleBtn,
                      { backgroundColor: closeBg },
                      WEB_NO_OUTLINE,
                    ]}
                  >
                    {anyRevealed ? (
                      <EyeSlash size={14} weight="duotone" color={inkPrimary} />
                    ) : (
                      <Eye size={14} weight="duotone" color={inkPrimary} />
                    )}
                    <Text style={[styles.revealToggleText, { color: inkPrimary }]}>
                      {anyRevealed ? 'Ẩn khóa' : 'Hiện khóa'}
                    </Text>
                  </Pressable>
                </View>

                <Text style={[styles.helperText, { color: inkSecondary }]}>
                  Để trống hoàn toàn để dùng Open-Meteo miễn phí. Nếu bạn có khóa riêng (Google Weather, Tomorrow.io, WeatherAPI.com), khóa được che bảo mật và chỉ lưu trên thiết bị của bạn.
                </Text>

                <View style={styles.keysFieldsStack}>
                  <LucianApiKeyField
                    label="Khóa Google Weather API"
                    value={draftGoogleKey}
                    placeholder="Để trống để dùng Open-Meteo miễn phí..."
                    onChange={(txt) => {
                      setDraftGoogleKey(txt);
                      setFeedbackMessage(null);
                    }}
                    showSecret={showGoogleKey}
                    onToggleSecret={() => setShowGoogleKey((v) => !v)}
                    isDark={isDark}
                  />

                  <LucianApiKeyField
                    label="Khóa Tomorrow.io API"
                    value={draftTomorrowKey}
                    placeholder="Để trống để dùng Open-Meteo miễn phí..."
                    onChange={(txt) => {
                      setDraftTomorrowKey(txt);
                      setFeedbackMessage(null);
                    }}
                    showSecret={showTomorrowKey}
                    onToggleSecret={() => setShowTomorrowKey((v) => !v)}
                    isDark={isDark}
                  />

                  <LucianApiKeyField
                    label="Khóa WeatherAPI.com"
                    value={draftWeatherApiKey}
                    placeholder="Để trống để dùng Open-Meteo miễn phí..."
                    onChange={(txt) => {
                      setDraftWeatherApiKey(txt);
                      setFeedbackMessage(null);
                    }}
                    showSecret={showWeatherApiKey}
                    onToggleSecret={() => setShowWeatherApiKey((v) => !v)}
                    isDark={isDark}
                  />
                </View>

                <View style={styles.keyButtonsRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Lưu khóa API"
                    onPress={handleApplyKeys}
                    style={({ pressed }) => [
                      styles.saveKeyBtn,
                      {
                        backgroundColor: accentColor,
                      },
                      WEB_NO_OUTLINE,
                      pressed && { transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <Check
                      size={14}
                      weight="bold"
                      color={accentContrastInk}
                    />
                    <Text
                      style={[
                        styles.saveKeyBtnText,
                        { color: accentContrastInk },
                      ]}
                    >
                      Lưu khóa
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Xóa khóa API"
                    onPress={handleClearKeys}
                    style={({ pressed }) => [
                      styles.clearKeyBtn,
                      {
                        backgroundColor: closeBg,
                      },
                      WEB_NO_OUTLINE,
                      pressed && { transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <Trash size={15} weight="duotone" color={inkPrimary} />
                    <Text style={[styles.clearKeyBtnText, { color: inkPrimary }]}>
                      Xóa khóa
                    </Text>
                  </Pressable>
                </View>

                {feedbackMessage && (
                  <Text
                    style={[
                      styles.savedFeedbackText,
                      { color: safeInk },
                    ]}
                  >
                    {feedbackMessage}
                  </Text>
                )}

                {liveError && (
                  <Text
                    style={[
                      styles.errorText,
                      { color: hazardInk },
                    ]}
                  >
                    {sanitizeCopy(liveError)}
                  </Text>
                )}
              </View>
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 18, 32, 0.60)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  backdropCompact: {
    padding: 10,
  },
  outerBezel: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '92%',
    padding: 5,
    borderRadius: 30,
    borderWidth: 1,
  },
  innerCore: {
    borderRadius: 25,
    padding: 20,
    gap: 14,
    maxHeight: '100%',
  },
  innerCoreCompact: {
    padding: 14,
    borderRadius: 22,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitleCluster: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minWidth: 0,
  },
  headerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 17.5,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  modalSub: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    gap: 18,
    paddingBottom: 6,
  },
  fieldGroup: {
    gap: 9,
  },
  labelStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  fieldLabel: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 14,
    fontWeight: '700',
  },
  helperText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    lineHeight: 18,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    fontWeight: '700',
  },
  keyVaultSection: {
    padding: 14,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
  },
  keysFieldsStack: {
    gap: 12,
  },
  revealToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  revealToggleText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    fontWeight: '700',
  },
  keyButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  saveKeyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
  },
  saveKeyBtnText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13.5,
    fontWeight: '700',
  },
  clearKeyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
  },
  clearKeyBtnText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13.5,
    fontWeight: '700',
  },
  savedFeedbackText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '600',
  },
  errorText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '600',
  },
});

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
import { Feather } from '@expo/vector-icons';
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
import { FONT_FAMILY_SANS, sanitizeCopy, WEB_NO_OUTLINE } from './themeTokens';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
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
    gradient: 'linear-gradient(140deg,#38BDF8,#185ADB)',
  },
  {
    id: 'normal',
    title: 'Bình thường',
    subtitle: 'Chuẩn cảm nhận',
    badge: 'Mặc định',
    icon: 'sun',
    gradient: 'linear-gradient(140deg,#22C3A6,#0EA5E9)',
  },
  {
    id: 'heat_sensitive',
    title: 'Sợ nóng',
    subtitle: 'Mặc thoáng (+3°C)',
    icon: 'flame',
    gradient: 'linear-gradient(140deg,#FB923C,#EA580C)',
  },
];

const PROVIDER_RADIO_OPTIONS: ReadonlyArray<LucianRadioOption<WeatherProviderType>> = [
  {
    id: 'auto',
    title: 'Tự động',
    subtitle: 'Ưu tiên khóa đã nhập, dự phòng Open-Meteo Free',
    badge: 'Khuyên dùng',
    metaPrimary: '15p',
    metaSecondary: 'Tự chuyển',
    icon: 'zap',
    gradient: 'linear-gradient(140deg,#2F8FE0,#185ADB)',
  },
  {
    id: 'open_meteo',
    title: 'Open-Meteo',
    subtitle: 'Miễn phí 100%, không cần khóa API',
    metaPrimary: 'Miễn phí',
    metaSecondary: '0 Key',
    icon: 'cloud',
    gradient: 'linear-gradient(140deg,#22C3A6,#119C72)',
  },
  {
    id: 'google',
    title: 'Google Weather API',
    subtitle: 'Sử dụng Google Weather API Key cá nhân',
    metaPrimary: 'BYOK',
    metaSecondary: 'Tùy chọn',
    icon: 'globe',
    gradient: 'linear-gradient(140deg,#3B82F6,#1D4ED8)',
  },
  {
    id: 'tomorrow_io',
    title: 'Tomorrow.io',
    subtitle: 'Sử dụng Tomorrow.io API Key cá nhân',
    metaPrimary: 'BYOK',
    metaSecondary: 'Tùy chọn',
    icon: 'key',
    gradient: 'linear-gradient(140deg,#0EA5E9,#0369A1)',
  },
  {
    id: 'weatherapi',
    title: 'WeatherAPI.com',
    subtitle: 'Sử dụng WeatherAPI.com Key cá nhân',
    metaPrimary: 'BYOK',
    metaSecondary: 'Tùy chọn',
    icon: 'key',
    gradient: 'linear-gradient(140deg,#14B8A6,#0F766E)',
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
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
  const isDark = useResolvedLucianDark();

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
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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
    setFeedbackMessage('Đã xóa khóa API - Tự động dùng Open-Meteo Free.');
  };

  const surfaceCoreBg = isDark ? '#111A2B' : '#F4F6FA';
  const outerBezelBg = isDark
    ? 'rgba(255, 255, 255, 0.08)'
    : 'rgba(255, 255, 255, 0.34)';
  const outerBezelBorder = isDark
    ? 'rgba(255, 255, 255, 0.18)'
    : 'rgba(255, 255, 255, 0.68)';
  const inkPrimary = isDark ? '#F1F5FB' : '#0F172A';
  const inkSecondary = isDark ? '#94A3B8' : '#475569';
  const closeBg = isDark ? '#1E293B' : '#E2E8F0';
  const keyPanelBg = isDark ? '#162238' : '#EAEEF5';
  const keyPanelBorder = isDark
    ? 'rgba(255, 255, 255, 0.10)'
    : 'rgba(15, 23, 42, 0.08)';

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
                      backgroundColor: isDark
                        ? 'rgba(99, 173, 255, 0.16)'
                        : 'rgba(24, 90, 219, 0.12)',
                    },
                  ]}
                >
                  <Feather
                    name="sliders"
                    size={16}
                    color={isDark ? '#63ADFF' : '#185ADB'}
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
                <Feather name="x" size={17} color={inkPrimary} />
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
                          ? isDark
                            ? 'rgba(16, 185, 129, 0.20)'
                            : '#D1E7DD'
                          : isDark
                            ? 'rgba(99, 173, 255, 0.18)'
                            : '#DBEAFE',
                      },
                    ]}
                  >
                    <Feather
                      name={isCustomProviderActive ? 'zap' : 'check-circle'}
                      size={12}
                      color={
                        isCustomProviderActive
                          ? isDark
                            ? '#6EE7B7'
                            : '#0F5132'
                          : isDark
                            ? '#93C5FD'
                            : '#1E3A8A'
                      }
                    />
                    <Text
                      style={[
                        styles.statusBadgeText,
                        {
                          color: isCustomProviderActive
                            ? isDark
                              ? '#6EE7B7'
                              : '#0F5132'
                            : isDark
                              ? '#93C5FD'
                              : '#1E3A8A',
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
                    3. Khóa API cá nhân (Mặc định trống 100%)
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
                    <Feather
                      name={anyRevealed ? 'eye-off' : 'eye'}
                      size={13}
                      color={inkPrimary}
                    />
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
                    label="Google Weather API Key"
                    value={draftGoogleKey}
                    placeholder="Để trống để dùng Open-Meteo Free..."
                    onChange={(txt) => {
                      setDraftGoogleKey(txt);
                      setFeedbackMessage(null);
                    }}
                    showSecret={showGoogleKey}
                    onToggleSecret={() => setShowGoogleKey((v) => !v)}
                    isDark={isDark}
                  />

                  <LucianApiKeyField
                    label="Tomorrow.io API Key"
                    value={draftTomorrowKey}
                    placeholder="Để trống để dùng Open-Meteo Free..."
                    onChange={(txt) => {
                      setDraftTomorrowKey(txt);
                      setFeedbackMessage(null);
                    }}
                    showSecret={showTomorrowKey}
                    onToggleSecret={() => setShowTomorrowKey((v) => !v)}
                    isDark={isDark}
                  />

                  <LucianApiKeyField
                    label="WeatherAPI.com Key"
                    value={draftWeatherApiKey}
                    placeholder="Để trống để dùng Open-Meteo Free..."
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
                        backgroundColor: isDark ? '#63ADFF' : '#185ADB',
                      },
                      WEB_NO_OUTLINE,
                      pressed && { transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <Feather
                      name="check"
                      size={14}
                      color={isDark ? '#09111F' : '#F8FAFC'}
                    />
                    <Text
                      style={[
                        styles.saveKeyBtnText,
                        { color: isDark ? '#09111F' : '#F8FAFC' },
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
                    <Feather name="trash-2" size={14} color={inkPrimary} />
                    <Text style={[styles.clearKeyBtnText, { color: inkPrimary }]}>
                      Xóa khóa
                    </Text>
                  </Pressable>
                </View>

                {feedbackMessage && (
                  <Text
                    style={[
                      styles.savedFeedbackText,
                      { color: isDark ? '#6EE7B7' : '#0F5132' },
                    ]}
                  >
                    {feedbackMessage}
                  </Text>
                )}

                {liveError && (
                  <Text
                    style={[
                      styles.errorText,
                      { color: isDark ? '#FCA5A5' : '#991B1B' },
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
    backgroundColor: 'rgba(9, 16, 30, 0.62)',
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

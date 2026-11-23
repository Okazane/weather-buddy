import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type {
  ThermalSensitivity,
  WeatherProviderType,
  WeatherSnapshot,
} from '../core';
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

const SENSITIVITY_OPTIONS: Array<{
  id: ThermalSensitivity;
  titleVi: string;
  descVi: string;
}> = [
  {
    id: 'cold_sensitive',
    titleVi: 'Sợ lạnh',
    descVi: '-3°C cảm nhận',
  },
  {
    id: 'normal',
    titleVi: 'Bình thường',
    descVi: 'Mặc định',
  },
  {
    id: 'heat_sensitive',
    titleVi: 'Sợ nóng',
    descVi: '+3°C cảm nhận',
  },
];

const PROVIDER_OPTIONS: Array<{
  id: WeatherProviderType;
  titleVi: string;
  descVi: string;
}> = [
  {
    id: 'auto',
    titleVi: 'Tự động',
    descVi: 'Mặc định Open-Meteo, tự nâng cấp khi bạn nhập khóa API riêng',
  },
  {
    id: 'open_meteo',
    titleVi: 'Open-Meteo',
    descVi: 'Miễn phí, không cần khóa API',
  },
  {
    id: 'google',
    titleVi: 'Google Weather API',
    descVi: 'Dùng Google Weather API Key của bạn',
  },
  {
    id: 'tomorrow_io',
    titleVi: 'Tomorrow.io',
    descVi: 'Dùng Tomorrow.io API Key của bạn',
  },
  {
    id: 'weatherapi',
    titleVi: 'WeatherAPI.com',
    descVi: 'Dùng WeatherAPI.com Key của bạn',
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
  const [draftGoogleKey, setDraftGoogleKey] = useState<string>(googleApiKey);
  const [draftTomorrowKey, setDraftTomorrowKey] = useState<string>(tomorrowIoApiKey);
  const [draftWeatherApiKey, setDraftWeatherApiKey] = useState<string>(weatherApiKey);
  const [showApiKeys, setShowApiKeys] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setDraftGoogleKey(googleApiKey);
      setDraftTomorrowKey(tomorrowIoApiKey);
      setDraftWeatherApiKey(weatherApiKey);
      setShowApiKeys(false);
      setFeedbackMessage(null);
    }
  }, [visible, googleApiKey, tomorrowIoApiKey, weatherApiKey]);

  const activeProviderLabel = !isLiveMode
    ? 'Kịch bản mẫu'
    : activeWeather.provider === 'tomorrow_io'
      ? 'Tomorrow.io · 15p'
      : activeWeather.provider === 'weatherapi'
        ? 'WeatherAPI · 15p'
        : activeWeather.provider === 'google'
          ? 'Google Weather · 15p'
          : 'Open-Meteo · 15p';

  const handleApplyKeys = () => {
    onSaveGoogleApiKey(draftGoogleKey.trim());
    onSaveTomorrowIoApiKey(draftTomorrowKey.trim());
    onSaveWeatherApiKey(draftWeatherApiKey.trim());
    setFeedbackMessage('Đã lưu khóa API trên thiết bị.');
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
    setFeedbackMessage('Đã xóa khóa API - Tự động dùng Open-Meteo.');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={[styles.backdrop, WEB_NO_OUTLINE]} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[styles.outerBezel, WEB_NO_OUTLINE]}
        >
          <View style={styles.innerCore}>
            <View style={styles.headerRow}>
              <Text style={styles.modalTitle}>Cài đặt</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng cài đặt"
                onPress={onClose}
                style={[styles.closeBtn, WEB_NO_OUTLINE]}
              >
                <Feather name="x" size={17} color="#0F172A" />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollBody}
            >
              {/* 1. Thermal Sensitivity */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Cảm nhận nhiệt độ</Text>
                <View style={styles.sensitivityRow}>
                  {SENSITIVITY_OPTIONS.map((opt) => {
                    const active = sensitivity === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => onSelectSensitivity(opt.id)}
                        style={({ pressed }) => [
                          styles.sensCard,
                          WEB_NO_OUTLINE,
                          active && styles.sensCardActive,
                          pressed && { transform: [{ scale: 0.98 }] },
                        ]}
                      >
                        <Text
                          style={[
                            styles.sensTitle,
                            active && styles.sensTitleActive,
                          ]}
                        >
                          {opt.titleVi}
                        </Text>
                        <Text
                          style={[
                            styles.sensDesc,
                            active && styles.sensDescActive,
                          ]}
                        >
                          {opt.descVi}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* 2. Weather Provider */}
              <View style={styles.fieldGroup}>
                <View style={styles.labelStatusRow}>
                  <Text style={styles.fieldLabel}>Nguồn thời tiết</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      activeWeather.provider === 'google' ||
                      activeWeather.provider === 'tomorrow_io' ||
                      activeWeather.provider === 'weatherapi'
                        ? styles.statusBadgeGoogle
                        : styles.statusBadgeOpenMeteo,
                    ]}
                  >
                    <Feather
                      name={
                        activeWeather.provider === 'google' ||
                        activeWeather.provider === 'tomorrow_io' ||
                        activeWeather.provider === 'weatherapi'
                          ? 'zap'
                          : 'check-circle'
                      }
                      size={12}
                      color={
                        activeWeather.provider === 'google' ||
                        activeWeather.provider === 'tomorrow_io' ||
                        activeWeather.provider === 'weatherapi'
                          ? '#0F5132'
                          : '#1E3A8A'
                      }
                    />
                    <Text
                      style={[
                        styles.statusBadgeText,
                        {
                          color:
                            activeWeather.provider === 'google' ||
                            activeWeather.provider === 'tomorrow_io' ||
                            activeWeather.provider === 'weatherapi'
                              ? '#0F5132'
                              : '#1E3A8A',
                        },
                      ]}
                    >
                      {activeProviderLabel}
                    </Text>
                  </View>
                </View>

                <View style={styles.providerList}>
                  {PROVIDER_OPTIONS.map((opt) => {
                    const active = providerPref === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => onSelectProvider(opt.id)}
                        style={({ pressed }) => [
                          styles.providerOption,
                          WEB_NO_OUTLINE,
                          active && styles.providerOptionActive,
                          pressed && { opacity: 0.9 },
                        ]}
                      >
                        <View style={styles.providerOptionTextCol}>
                          <Text
                            style={[
                              styles.providerOptionTitle,
                              active && styles.providerOptionTitleActive,
                            ]}
                          >
                            {opt.titleVi}
                          </Text>
                          <Text
                            style={[
                              styles.providerOptionDesc,
                              active && styles.providerOptionDescActive,
                            ]}
                          >
                            {opt.descVi}
                          </Text>
                        </View>
                        <Feather
                          name={active ? 'check-circle' : 'circle'}
                          size={18}
                          color={active ? '#F8FAFC' : '#64748B'}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* 3. Blank User-Supplied API Inputs (Masked with Show/Hide Toggle) */}
              <View style={styles.fieldGroup}>
                <View style={styles.labelStatusRow}>
                  <Text style={styles.fieldLabel}>
                    Khóa API cá nhân (Để trống để dùng Open-Meteo)
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      showApiKeys ? 'Ẩn khóa API' : 'Hiện khóa API'
                    }
                    onPress={() => setShowApiKeys((prev) => !prev)}
                    style={[styles.revealToggleBtn, WEB_NO_OUTLINE]}
                  >
                    <Feather
                      name={showApiKeys ? 'eye-off' : 'eye'}
                      size={13}
                      color="#334155"
                    />
                    <Text style={styles.revealToggleText}>
                      {showApiKeys ? 'Ẩn khóa' : 'Hiện khóa'}
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.helperText}>
                  Dán khóa API riêng của bạn nếu muốn lấy dữ liệu từ Google Weather, Tomorrow.io hoặc WeatherAPI.com. Khóa được che bảo mật mặc định.
                </Text>

                <Text style={styles.subKeyLabel}>Google Weather API Key</Text>
                <TextInput
                  value={draftGoogleKey}
                  onChangeText={(txt) => {
                    setDraftGoogleKey(txt);
                    setFeedbackMessage(null);
                  }}
                  placeholder="Dán Google Weather API Key của bạn..."
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={!showApiKeys}
                  style={styles.apiKeyInput}
                />

                <Text style={styles.subKeyLabel}>Tomorrow.io API Key</Text>
                <TextInput
                  value={draftTomorrowKey}
                  onChangeText={(txt) => {
                    setDraftTomorrowKey(txt);
                    setFeedbackMessage(null);
                  }}
                  placeholder="Dán Tomorrow.io API Key của bạn..."
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={!showApiKeys}
                  style={styles.apiKeyInput}
                />

                <Text style={styles.subKeyLabel}>WeatherAPI.com Key</Text>
                <TextInput
                  value={draftWeatherApiKey}
                  onChangeText={(txt) => {
                    setDraftWeatherApiKey(txt);
                    setFeedbackMessage(null);
                  }}
                  placeholder="Dán WeatherAPI.com Key của bạn..."
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={!showApiKeys}
                  style={styles.apiKeyInput}
                />

                <View style={styles.keyButtonsRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Lưu khóa API"
                    onPress={handleApplyKeys}
                    style={({ pressed }) => [
                      styles.saveKeyBtn,
                      WEB_NO_OUTLINE,
                      pressed && { transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <Feather name="check" size={14} color="#F8FAFC" />
                    <Text style={styles.saveKeyBtnText}>Lưu khóa</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Xóa khóa API"
                    onPress={handleClearKeys}
                    style={({ pressed }) => [
                      styles.clearKeyBtn,
                      WEB_NO_OUTLINE,
                      pressed && { transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <Feather name="trash-2" size={14} color="#334155" />
                    <Text style={styles.clearKeyBtnText}>Xóa khóa</Text>
                  </Pressable>
                </View>

                {feedbackMessage && (
                  <Text style={styles.savedFeedbackText}>{feedbackMessage}</Text>
                )}

                {liveError && (
                  <Text style={styles.errorText}>
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
    backgroundColor: 'rgba(9, 16, 30, 0.60)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  outerBezel: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '90%',
    padding: 6,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.42)',
  },
  innerCore: {
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    padding: 22,
    gap: 16,
    maxHeight: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 19,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    gap: 20,
    paddingBottom: 6,
  },
  fieldGroup: {
    gap: 8,
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
    color: '#0F172A',
  },
  helperText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#475569',
  },
  subKeyLabel: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
    marginTop: 4,
  },
  sensitivityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sensCard: {
    flex: 1,
    minWidth: 135,
    backgroundColor: '#EEF2F6',
    borderRadius: 16,
    padding: 13,
    gap: 3,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  sensCardActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  sensTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  sensTitleActive: {
    color: '#F8FAFC',
  },
  sensDesc: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    lineHeight: 16,
    color: '#475569',
  },
  sensDescActive: {
    color: '#CBD5E1',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeGoogle: {
    backgroundColor: '#D1E7DD',
  },
  statusBadgeOpenMeteo: {
    backgroundColor: '#DBEAFE',
  },
  statusBadgeText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    fontWeight: '700',
  },
  providerList: {
    gap: 8,
  },
  providerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#EEF2F6',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  providerOptionActive: {
    backgroundColor: '#185ADB',
    borderColor: '#185ADB',
  },
  providerOptionTextCol: {
    flex: 1,
    gap: 3,
  },
  providerOptionTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  providerOptionTitleActive: {
    color: '#F8FAFC',
  },
  providerOptionDesc: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    lineHeight: 17,
    color: '#475569',
  },
  providerOptionDescActive: {
    color: 'rgba(248, 250, 252, 0.86)',
  },
  apiKeyInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13.5,
    color: '#0F172A',
  },
  revealToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  revealToggleText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
  },
  keyButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  saveKeyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
  },
  saveKeyBtnText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  clearKeyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
  },
  clearKeyBtnText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#334155',
  },
  savedFeedbackText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#0F5132',
  },
  errorText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#991B1B',
  },
});

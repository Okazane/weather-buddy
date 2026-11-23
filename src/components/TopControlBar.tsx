import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import {
  PRESET_CITIES,
  type Gender,
  type WeatherSnapshot,
} from '../core';
import {
  FONT_FAMILY_SANS,
  WEB_NO_OUTLINE,
  type AtmosphericPalette,
} from './themeTokens';

export type ActiveAppTab = 'stage' | 'hub' | 'widgets' | 'dashboard';

interface TopControlBarProps {
  palette: AtmosphericPalette;
  activeTab: ActiveAppTab;
  onSelectTab: (tab: ActiveAppTab) => void;
  gender: Gender;
  onSelectGender: (gender: Gender) => void;
  selectedCityId: string;
  activeWeather: WeatherSnapshot;
  isLiveMode: boolean;
  isLoadingLive: boolean;
  gpsLoading: boolean;
  onSelectPresetCity: (cityId: string) => void;
  onRequestGps: () => void;
  onRefreshLive: () => void;
  onOpenSettings: () => void;
}

export const TopControlBar: React.FC<TopControlBarProps> = ({
  palette,
  activeTab,
  onSelectTab,
  gender,
  onSelectGender,
  selectedCityId,
  activeWeather,
  isLiveMode,
  isLoadingLive,
  gpsLoading,
  onSelectPresetCity,
  onRequestGps,
  onRefreshLive,
  onOpenSettings,
}) => {
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const { width } = useWindowDimensions();
  const isCompact = width < 880;
  const isNarrowMobile = width < 480;

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

  return (
    <View style={styles.headerWrap}>
      {/* Top Row: City Selector + 1-Tap Current Location GPS + Gender Switch + Refresh + Settings */}
      <View style={[styles.topRow, isCompact && styles.topRowCompact]}>
        <View style={styles.leftCluster}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chọn thành phố"
            onPress={() => setCityPickerOpen(true)}
            style={({ pressed }) => [
              styles.bezelPillOuter,
              WEB_NO_OUTLINE,
              {
                backgroundColor: palette.bezelOuterBg,
                borderColor: palette.bezelOuterBorder,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <View
              style={[
                styles.cityPillInner,
                { backgroundColor: palette.coreElevatedBg },
              ]}
            >
              <Feather
                name={isGpsActive ? 'navigation' : 'map-pin'}
                size={14}
                color={palette.accent}
              />
              <Text
                numberOfLines={1}
                style={[styles.cityLabelText, { color: palette.inkPrimary }]}
              >
                {activeWeather.locationName}
              </Text>
              <View
                style={[
                  styles.iconChipCircle,
                  { backgroundColor: palette.accentSoftBg },
                ]}
              >
                <Feather name="chevron-down" size={13} color={palette.accent} />
              </View>
            </View>
          </Pressable>

          {/* Direct 1-Tap High-Accuracy Current Location Pill Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isGpsActive, busy: gpsLoading }}
            accessibilityLabel="Định vị vị trí hiện tại"
            onPress={onRequestGps}
            style={({ pressed }) => [
              styles.gpsQuickPill,
              WEB_NO_OUTLINE,
              {
                backgroundColor: isGpsActive
                  ? palette.pillActiveBg
                  : palette.coreElevatedBg,
                borderColor: isGpsActive
                  ? palette.pillActiveBg
                  : palette.bezelOuterBorder,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            {gpsLoading ? (
              <ActivityIndicator
                size="small"
                color={isGpsActive ? palette.pillActiveInk : palette.accent}
              />
            ) : (
              <Feather
                name="crosshair"
                size={13}
                color={isGpsActive ? palette.pillActiveInk : palette.accent}
              />
            )}
            <Text
              numberOfLines={1}
              style={[
                styles.gpsQuickText,
                {
                  color: isGpsActive
                    ? palette.pillActiveInk
                    : palette.inkPrimary,
                },
              ]}
            >
              {gpsLoading ? 'Đang định vị...' : 'Vị trí hiện tại'}
            </Text>
          </Pressable>

          <View
            style={[
              styles.providerBadge,
              {
                backgroundColor: palette.pillIdleBg,
                borderColor: palette.bezelOuterBorder,
              },
            ]}
          >
            <Feather
              name={
                !isLiveMode
                  ? 'sliders'
                  : activeWeather.provider === 'google' ||
                      activeWeather.provider === 'tomorrow_io' ||
                      activeWeather.provider === 'weatherapi'
                    ? 'zap'
                    : 'cloud'
              }
              size={12}
              color={palette.inkSecondary}
            />
            <Text style={[styles.providerText, { color: palette.inkSecondary }]}>
              {providerBadgeLabel}
            </Text>
          </View>
        </View>

        <View style={styles.rightCluster}>
          <View
            style={[
              styles.segmentedShell,
              {
                backgroundColor: palette.bezelOuterBg,
                borderColor: palette.bezelOuterBorder,
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: gender === 'male' }}
              accessibilityLabel="Nhân vật Nam"
              onPress={() => onSelectGender('male')}
              style={({ pressed }) => [
                styles.genderSegmentBtn,
                WEB_NO_OUTLINE,
                gender === 'male' && {
                  backgroundColor: palette.pillActiveBg,
                },
                pressed && { opacity: 0.88 },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.genderSegmentText,
                  {
                    color:
                      gender === 'male'
                        ? palette.pillActiveInk
                        : palette.inkPrimary,
                  },
                ]}
              >
                👦 Nam
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: gender === 'female' }}
              accessibilityLabel="Nhân vật Nữ"
              onPress={() => onSelectGender('female')}
              style={({ pressed }) => [
                styles.genderSegmentBtn,
                WEB_NO_OUTLINE,
                gender === 'female' && {
                  backgroundColor: palette.pillActiveBg,
                },
                pressed && { opacity: 0.88 },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.genderSegmentText,
                  {
                    color:
                      gender === 'female'
                        ? palette.pillActiveInk
                        : palette.inkPrimary,
                  },
                ]}
              >
                👧 Nữ
              </Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Làm mới thời tiết"
            onPress={onRefreshLive}
            style={({ pressed }) => [
              styles.iconActionBtn,
              WEB_NO_OUTLINE,
              {
                backgroundColor: palette.coreElevatedBg,
                borderColor: palette.bezelOuterBorder,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              },
            ]}
          >
            <Feather
              name="refresh-cw"
              size={15}
              color={isLoadingLive ? palette.accent : palette.inkPrimary}
            />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở cài đặt"
            onPress={onOpenSettings}
            style={({ pressed }) => [
              styles.iconActionBtn,
              WEB_NO_OUTLINE,
              {
                backgroundColor: palette.coreElevatedBg,
                borderColor: palette.bezelOuterBorder,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              },
            ]}
          >
            <Feather name="settings" size={16} color={palette.inkPrimary} />
          </Pressable>
        </View>
      </View>

      {/* Navigation Segmented Bar */}
      <View style={styles.tabRow}>
        <View
          style={[
            styles.tabSegmentedShell,
            isNarrowMobile && styles.tabSegmentedShellMobile,
            {
              backgroundColor: palette.bezelOuterBg,
              borderColor: palette.bezelOuterBorder,
            },
          ]}
        >
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'stage' }}
            onPress={() => onSelectTab('stage')}
            style={({ pressed }) => [
              styles.tabItem,
              WEB_NO_OUTLINE,
              isNarrowMobile && styles.tabItemMobile,
              activeTab === 'stage' && {
                backgroundColor: palette.coreElevatedBg,
              },
              pressed && { opacity: 0.9 },
            ]}
          >
            <Feather
              name={palette.isDark ? 'moon' : 'sun'}
              size={14}
              color={
                activeTab === 'stage' ? palette.accent : palette.inkSecondary
              }
            />
            <Text
              numberOfLines={1}
              style={[
                styles.tabItemText,
                isNarrowMobile && styles.tabItemTextMobile,
                {
                  color:
                    activeTab === 'stage'
                      ? palette.inkPrimary
                      : palette.inkSecondary,
                  fontWeight: activeTab === 'stage' ? '700' : '500',
                },
              ]}
            >
              Thời tiết
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'hub' }}
            onPress={() => onSelectTab('hub')}
            style={({ pressed }) => [
              styles.tabItem,
              WEB_NO_OUTLINE,
              isNarrowMobile && styles.tabItemMobile,
              activeTab === 'hub' && {
                backgroundColor: palette.coreElevatedBg,
              },
              pressed && { opacity: 0.9 },
            ]}
          >
            <Feather
              name="grid"
              size={14}
              color={
                activeTab === 'hub' ? palette.accent : palette.inkSecondary
              }
            />
            <Text
              numberOfLines={1}
              style={[
                styles.tabItemText,
                isNarrowMobile && styles.tabItemTextMobile,
                {
                  color:
                    activeTab === 'hub'
                      ? palette.inkPrimary
                      : palette.inkSecondary,
                  fontWeight: activeTab === 'hub' ? '700' : '500',
                },
              ]}
            >
              {isNarrowMobile ? '🧩 Tiện ích' : '🧩 Tiện ích & Cài đặt'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'widgets' }}
            onPress={() => onSelectTab('widgets')}
            style={({ pressed }) => [
              styles.tabItem,
              WEB_NO_OUTLINE,
              isNarrowMobile && styles.tabItemMobile,
              activeTab === 'widgets' && {
                backgroundColor: palette.coreElevatedBg,
              },
              pressed && { opacity: 0.9 },
            ]}
          >
            <Feather
              name="smartphone"
              size={14}
              color={
                activeTab === 'widgets' ? palette.accent : palette.inkSecondary
              }
            />
            <Text
              numberOfLines={1}
              style={[
                styles.tabItemText,
                isNarrowMobile && styles.tabItemTextMobile,
                {
                  color:
                    activeTab === 'widgets'
                      ? palette.inkPrimary
                      : palette.inkSecondary,
                  fontWeight: activeTab === 'widgets' ? '700' : '500',
                },
              ]}
            >
              {isNarrowMobile ? 'Widget' : 'Widget Màn hình khóa'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'dashboard' }}
            onPress={() => onSelectTab('dashboard')}
            style={({ pressed }) => [
              styles.tabItem,
              WEB_NO_OUTLINE,
              isNarrowMobile && styles.tabItemMobile,
              activeTab === 'dashboard' && {
                backgroundColor: palette.coreElevatedBg,
              },
              pressed && { opacity: 0.9 },
            ]}
          >
            <Feather
              name="bar-chart-2"
              size={14}
              color={
                activeTab === 'dashboard' ? palette.accent : palette.inkSecondary
              }
            />
            <Text
              numberOfLines={1}
              style={[
                styles.tabItemText,
                isNarrowMobile && styles.tabItemTextMobile,
                {
                  color:
                    activeTab === 'dashboard'
                      ? palette.inkPrimary
                      : palette.inkSecondary,
                  fontWeight: activeTab === 'dashboard' ? '700' : '500',
                },
              ]}
            >
              {isNarrowMobile ? '📊 Dashboard' : '📊 Dashboard Web'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* City Picker Modal */}
      <Modal
        visible={cityPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCityPickerOpen(false)}
      >
        <Pressable
          style={[styles.modalBackdrop, WEB_NO_OUTLINE]}
          onPress={() => setCityPickerOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.cityModalOuter, WEB_NO_OUTLINE]}
          >
            <View style={styles.cityModalCore}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Khu vực</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Đóng"
                  onPress={() => setCityPickerOpen(false)}
                  style={[styles.closeCircle, WEB_NO_OUTLINE]}
                >
                  <Feather name="x" size={16} color="#1E293B" />
                </Pressable>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onRequestGps();
                  setCityPickerOpen(false);
                }}
                style={({ pressed }) => [
                  styles.gpsButton,
                  WEB_NO_OUTLINE,
                  pressed && { transform: [{ scale: 0.99 }] },
                ]}
              >
                <Text style={styles.gpsButtonText}>
                  {gpsLoading
                    ? '📍 Đang định vị GPS chính xác...'
                    : '📍 Vị trí hiện tại (GPS độ chính xác cao)'}
                </Text>
                <View style={styles.gpsTrailingCircle}>
                  <Feather name="crosshair" size={15} color="#0F172A" />
                </View>
              </Pressable>

              <ScrollView
                style={styles.cityGridScroll}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.cityGrid}>
                  {PRESET_CITIES.map((city) => {
                    const isSelected =
                      selectedCityId === city.id && isLiveMode;
                    return (
                      <Pressable
                        key={city.id}
                        accessibilityRole="button"
                        onPress={() => {
                          onSelectPresetCity(city.id);
                          setCityPickerOpen(false);
                        }}
                        style={({ pressed }) => [
                          styles.cityOptionCard,
                          WEB_NO_OUTLINE,
                          isSelected && styles.cityOptionCardActive,
                          pressed && { transform: [{ scale: 0.98 }] },
                        ]}
                      >
                        <View style={styles.cityOptionRow}>
                          <Text
                            style={[
                              styles.cityOptionName,
                              isSelected && styles.cityOptionNameActive,
                            ]}
                          >
                            {city.nameVi}
                          </Text>
                          {isSelected && (
                            <Feather name="check" size={15} color="#F8FAFC" />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.cityOptionRegion,
                            isSelected && styles.cityOptionRegionActive,
                          ]}
                        >
                          {city.regionVi}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  headerWrap: {
    width: '100%',
    gap: 12,
    paddingBottom: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  topRowCompact: {
    gap: 8,
  },
  leftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bezelPillOuter: {
    padding: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  cityPillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 999,
  },
  cityLabelText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 14,
    fontWeight: '700',
    maxWidth: 195,
  },
  iconChipCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsQuickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  gpsQuickText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '700',
  },
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  providerText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '600',
  },
  segmentedShell: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  genderSegmentBtn: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
  },
  genderSegmentText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13,
    fontWeight: '700',
  },
  iconActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  tabSegmentedShell: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '100%',
    width: Platform.OS === 'web' ? undefined : '100%',
    flexWrap: 'nowrap',
  },
  tabSegmentedShellMobile: {
    width: '100%',
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    flexShrink: 1,
  },
  tabItemMobile: {
    flex: 1,
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  tabItemText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13,
  },
  tabItemTextMobile: {
    fontSize: 12.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 19, 32, 0.56)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  cityModalOuter: {
    width: '100%',
    maxWidth: 460,
    padding: 6,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  cityModalCore: {
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    padding: 20,
    gap: 14,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 999,
  },
  gpsButtonText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#F8FAFC',
    flexShrink: 1,
  },
  gpsTrailingCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  cityGridScroll: {
    maxHeight: 300,
  },
  cityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cityOptionCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#EEF2F6',
    borderRadius: 16,
    padding: 13,
    gap: 3,
  },
  cityOptionCardActive: {
    backgroundColor: '#185ADB',
  },
  cityOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cityOptionName: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  cityOptionNameActive: {
    color: '#F8FAFC',
  },
  cityOptionRegion: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    color: '#475569',
  },
  cityOptionRegionActive: {
    color: 'rgba(248, 250, 252, 0.82)',
  },
});

import { Platform } from 'react-native';
import type { SkyTheme } from '../core';

export interface AtmosphericPalette {
  id: SkyTheme;
  isDark: boolean;
  skyStops: readonly [string, string, string];
  horizonGlow: string;
  inkPrimary: string;
  inkSecondary: string;
  inkMuted: string;
  accent: string;
  accentSoftBg: string;
  accentContrastInk: string;
  bezelOuterBg: string;
  bezelOuterBorder: string;
  coreSurfaceBg: string;
  coreElevatedBg: string;
  hairline: string;
  pillIdleBg: string;
  pillActiveBg: string;
  pillActiveInk: string;
  shadowColor: string;
  rainAlertBg: string;
  rainAlertInk: string;
  rainAlertBorder: string;
  aqiAlertBg: string;
  aqiAlertInk: string;
  aqiAlertBorder: string;
}

/**
 * Perceptually calibrated sky palettes inspired by Apple Design Award (Not Boring) Weather
 * and iOS 18 Weather. Zero AI-purple default gradients, zero pure #000000/#ffffff extremes,
 * and strict WCAG AA+ contrast across both light and dark atmospheric states.
 */
export const SKY_PALETTES: Record<SkyTheme, AtmosphericPalette> = {
  day_sunny: {
    id: 'day_sunny',
    isDark: false,
    skyStops: ['#C4E1FF', '#E5F1FD', '#FDF3DC'],
    horizonGlow: 'rgba(253, 224, 155, 0.42)',
    inkPrimary: '#112031',
    inkSecondary: '#394F66',
    inkMuted: '#5B7087',
    accent: '#185ADB',
    accentSoftBg: 'rgba(24, 90, 219, 0.11)',
    accentContrastInk: '#F8FAFC',
    bezelOuterBg: 'rgba(255, 255, 255, 0.38)',
    bezelOuterBorder: 'rgba(255, 255, 255, 0.68)',
    coreSurfaceBg: 'rgba(252, 253, 255, 0.76)',
    coreElevatedBg: 'rgba(255, 255, 255, 0.90)',
    hairline: 'rgba(17, 32, 49, 0.08)',
    pillIdleBg: 'rgba(255, 255, 255, 0.56)',
    pillActiveBg: '#112031',
    pillActiveInk: '#F8FAFC',
    shadowColor: '#1E3A5F',
    rainAlertBg: '#132944',
    rainAlertInk: '#F6FAFF',
    rainAlertBorder: 'rgba(96, 165, 250, 0.45)',
    aqiAlertBg: '#7F1D1D',
    aqiAlertInk: '#FEF2F2',
    aqiAlertBorder: 'rgba(248, 113, 113, 0.45)',
  },
  dawn: {
    id: 'dawn',
    isDark: false,
    skyStops: ['#DDD6EC', '#F5DEDB', '#FCEED8'],
    horizonGlow: 'rgba(251, 191, 147, 0.36)',
    inkPrimary: '#22182B',
    inkSecondary: '#4E3F5E',
    inkMuted: '#6F5E80',
    accent: '#B83253',
    accentSoftBg: 'rgba(184, 50, 83, 0.11)',
    accentContrastInk: '#FDF8F9',
    bezelOuterBg: 'rgba(255, 255, 255, 0.36)',
    bezelOuterBorder: 'rgba(255, 255, 255, 0.65)',
    coreSurfaceBg: 'rgba(254, 251, 252, 0.76)',
    coreElevatedBg: 'rgba(255, 255, 255, 0.90)',
    hairline: 'rgba(34, 24, 43, 0.08)',
    pillIdleBg: 'rgba(255, 255, 255, 0.55)',
    pillActiveBg: '#22182B',
    pillActiveInk: '#FDF8F9',
    shadowColor: '#3B2542',
    rainAlertBg: '#1B2D45',
    rainAlertInk: '#F6FAFF',
    rainAlertBorder: 'rgba(125, 180, 248, 0.42)',
    aqiAlertBg: '#7F1D1D',
    aqiAlertInk: '#FEF2F2',
    aqiAlertBorder: 'rgba(248, 113, 113, 0.45)',
  },
  day_cloudy: {
    id: 'day_cloudy',
    isDark: false,
    skyStops: ['#BFCBD8', '#D7E0E9', '#EDF1F5'],
    horizonGlow: 'rgba(255, 255, 255, 0.44)',
    inkPrimary: '#14202D',
    inkSecondary: '#415264',
    inkMuted: '#627386',
    accent: '#235B8C',
    accentSoftBg: 'rgba(35, 91, 140, 0.11)',
    accentContrastInk: '#F7FAFC',
    bezelOuterBg: 'rgba(255, 255, 255, 0.40)',
    bezelOuterBorder: 'rgba(255, 255, 255, 0.70)',
    coreSurfaceBg: 'rgba(250, 252, 254, 0.78)',
    coreElevatedBg: 'rgba(255, 255, 255, 0.92)',
    hairline: 'rgba(20, 32, 45, 0.08)',
    pillIdleBg: 'rgba(255, 255, 255, 0.58)',
    pillActiveBg: '#14202D',
    pillActiveInk: '#F7FAFC',
    shadowColor: '#253649',
    rainAlertBg: '#152A42',
    rainAlertInk: '#F6FAFF',
    rainAlertBorder: 'rgba(110, 172, 245, 0.45)',
    aqiAlertBg: '#7C1D26',
    aqiAlertInk: '#FEF2F2',
    aqiAlertBorder: 'rgba(248, 113, 113, 0.45)',
  },
  rain_storm: {
    id: 'rain_storm',
    isDark: true,
    skyStops: ['#0D1624', '#16263B', '#233A54'],
    horizonGlow: 'rgba(86, 144, 214, 0.18)',
    inkPrimary: '#F2F6FB',
    inkSecondary: '#B6C6D9',
    inkMuted: '#899FB8',
    accent: '#63ADFF',
    accentSoftBg: 'rgba(99, 173, 255, 0.16)',
    accentContrastInk: '#0B1422',
    bezelOuterBg: 'rgba(255, 255, 255, 0.06)',
    bezelOuterBorder: 'rgba(255, 255, 255, 0.14)',
    coreSurfaceBg: 'rgba(13, 23, 38, 0.68)',
    coreElevatedBg: 'rgba(21, 35, 56, 0.88)',
    hairline: 'rgba(242, 246, 251, 0.10)',
    pillIdleBg: 'rgba(20, 34, 54, 0.65)',
    pillActiveBg: '#F2F6FB',
    pillActiveInk: '#0D1624',
    shadowColor: '#050A12',
    rainAlertBg: '#E0F0FF',
    rainAlertInk: '#0D2138',
    rainAlertBorder: 'rgba(147, 197, 253, 0.70)',
    aqiAlertBg: '#FEE2E2',
    aqiAlertInk: '#7F1D1D',
    aqiAlertBorder: 'rgba(252, 165, 165, 0.70)',
  },
  sunset: {
    id: 'sunset',
    isDark: true,
    skyStops: ['#1A2037', '#493048', '#945645'],
    horizonGlow: 'rgba(246, 165, 108, 0.25)',
    inkPrimary: '#FAF5F0',
    inkSecondary: '#E3D2C8',
    inkMuted: '#C4ADA2',
    accent: '#F6A96D',
    accentSoftBg: 'rgba(246, 169, 109, 0.18)',
    accentContrastInk: '#1E1522',
    bezelOuterBg: 'rgba(255, 255, 255, 0.07)',
    bezelOuterBorder: 'rgba(255, 255, 255, 0.16)',
    coreSurfaceBg: 'rgba(25, 22, 39, 0.64)',
    coreElevatedBg: 'rgba(38, 31, 53, 0.86)',
    hairline: 'rgba(250, 245, 240, 0.11)',
    pillIdleBg: 'rgba(32, 26, 46, 0.60)',
    pillActiveBg: '#FAF5F0',
    pillActiveInk: '#1F192E',
    shadowColor: '#0B0812',
    rainAlertBg: '#E6F2FF',
    rainAlertInk: '#10243C',
    rainAlertBorder: 'rgba(147, 197, 253, 0.65)',
    aqiAlertBg: '#FEE2E2',
    aqiAlertInk: '#7F1D1D',
    aqiAlertBorder: 'rgba(252, 165, 165, 0.65)',
  },
  night: {
    id: 'night',
    isDark: true,
    skyStops: ['#09101E', '#111F36', '#1B304E'],
    horizonGlow: 'rgba(94, 156, 235, 0.15)',
    inkPrimary: '#F1F5FB',
    inkSecondary: '#ADC0D6',
    inkMuted: '#7F96B2',
    accent: '#6CB4FF',
    accentSoftBg: 'rgba(108, 180, 255, 0.16)',
    accentContrastInk: '#09111F',
    bezelOuterBg: 'rgba(255, 255, 255, 0.06)',
    bezelOuterBorder: 'rgba(255, 255, 255, 0.13)',
    coreSurfaceBg: 'rgba(11, 20, 35, 0.68)',
    coreElevatedBg: 'rgba(19, 32, 54, 0.88)',
    hairline: 'rgba(241, 245, 251, 0.10)',
    pillIdleBg: 'rgba(18, 31, 52, 0.64)',
    pillActiveBg: '#F1F5FB',
    pillActiveInk: '#0A1220',
    shadowColor: '#040810',
    rainAlertBg: '#E0F0FF',
    rainAlertInk: '#0D2138',
    rainAlertBorder: 'rgba(147, 197, 253, 0.70)',
    aqiAlertBg: '#FEE2E2',
    aqiAlertInk: '#7F1D1D',
    aqiAlertBorder: 'rgba(252, 165, 165, 0.70)',
  },
};

export const FONT_FAMILY_SANS = Platform.select({
  web: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  ios: 'System',
  default: 'sans-serif',
});

export const FONT_FAMILY_DISPLAY = Platform.select({
  web: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  ios: 'System',
  default: 'sans-serif-medium',
});

export const WEB_NO_OUTLINE =
  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null;

/**
 * Enforces strict typographic hygiene (zero em-dashes or en-dash separators in visible UI).
 */
export function sanitizeCopy(input: string | null | undefined): string {
  if (!input) {
    return '';
  }
  return input.replace(/\s*[—–]\s*/g, ' - ');
}

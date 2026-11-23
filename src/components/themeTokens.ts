import { Platform } from 'react-native';
import type { SkyTheme } from '../core';

export type AppThemeMode = 'auto' | 'light' | 'dark';

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
 * Perceptually calibrated sky palettes harmonized with Lucian UX/UI `--ux-*` surface,
 * ink, and hairline contrast tokens. Zero AI-purple default gradients and strict WCAG AA+
 * legibility across both light and dark atmospheric states.
 */
export const SKY_PALETTES: Record<SkyTheme, AtmosphericPalette> = {
  day_sunny: {
    id: 'day_sunny',
    isDark: false,
    skyStops: ['#C4E1FF', '#E6F1FD', '#FBF2DE'],
    horizonGlow: 'rgba(253, 224, 155, 0.40)',
    inkPrimary: '#16151B',
    inkSecondary: '#434C5E',
    inkMuted: '#687387',
    accent: '#185ADB',
    accentSoftBg: 'rgba(24, 90, 219, 0.11)',
    accentContrastInk: '#FFFFFF',
    bezelOuterBg: 'rgba(255, 255, 255, 0.56)',
    bezelOuterBorder: 'rgba(22, 21, 27, 0.10)',
    coreSurfaceBg: 'rgba(255, 255, 255, 0.82)',
    coreElevatedBg: 'rgba(255, 255, 255, 0.95)',
    hairline: 'rgba(22, 21, 27, 0.09)',
    pillIdleBg: 'rgba(255, 255, 255, 0.72)',
    pillActiveBg: '#16151B',
    pillActiveInk: '#F4F2EE',
    shadowColor: '#18263E',
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
    horizonGlow: 'rgba(251, 191, 147, 0.34)',
    inkPrimary: '#1D1726',
    inkSecondary: '#4B4058',
    inkMuted: '#6E617E',
    accent: '#B83253',
    accentSoftBg: 'rgba(184, 50, 83, 0.11)',
    accentContrastInk: '#FFFFFF',
    bezelOuterBg: 'rgba(255, 255, 255, 0.54)',
    bezelOuterBorder: 'rgba(29, 23, 38, 0.10)',
    coreSurfaceBg: 'rgba(255, 253, 254, 0.82)',
    coreElevatedBg: 'rgba(255, 255, 255, 0.95)',
    hairline: 'rgba(29, 23, 38, 0.09)',
    pillIdleBg: 'rgba(255, 255, 255, 0.70)',
    pillActiveBg: '#1D1726',
    pillActiveInk: '#FAF6F8',
    shadowColor: '#33203A',
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
    skyStops: ['#C3CED9', '#DCE4EC', '#F1F4F7'],
    horizonGlow: 'rgba(255, 255, 255, 0.42)',
    inkPrimary: '#161B24',
    inkSecondary: '#455262',
    inkMuted: '#687688',
    accent: '#1F5D99',
    accentSoftBg: 'rgba(31, 93, 153, 0.11)',
    accentContrastInk: '#FFFFFF',
    bezelOuterBg: 'rgba(255, 255, 255, 0.58)',
    bezelOuterBorder: 'rgba(22, 27, 36, 0.10)',
    coreSurfaceBg: 'rgba(252, 254, 255, 0.84)',
    coreElevatedBg: 'rgba(255, 255, 255, 0.95)',
    hairline: 'rgba(22, 27, 36, 0.09)',
    pillIdleBg: 'rgba(255, 255, 255, 0.74)',
    pillActiveBg: '#161B24',
    pillActiveInk: '#F5F7FA',
    shadowColor: '#213042',
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
    skyStops: ['#0B121F', '#142236', '#20354E'],
    horizonGlow: 'rgba(86, 144, 214, 0.18)',
    inkPrimary: '#F4F6FA',
    inkSecondary: '#B8C6D8',
    inkMuted: '#889BB3',
    accent: '#63ADFF',
    accentSoftBg: 'rgba(99, 173, 255, 0.16)',
    accentContrastInk: '#0B1422',
    bezelOuterBg: 'rgba(19, 24, 36, 0.56)',
    bezelOuterBorder: 'rgba(255, 255, 255, 0.15)',
    coreSurfaceBg: 'rgba(17, 25, 39, 0.76)',
    coreElevatedBg: 'rgba(23, 33, 50, 0.92)',
    hairline: 'rgba(255, 255, 255, 0.09)',
    pillIdleBg: 'rgba(24, 35, 54, 0.72)',
    pillActiveBg: '#F4F6FA',
    pillActiveInk: '#0D1624',
    shadowColor: '#040810',
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
    skyStops: ['#161B2E', '#432C44', '#8B5142'],
    horizonGlow: 'rgba(246, 165, 108, 0.24)',
    inkPrimary: '#FAF5F0',
    inkSecondary: '#E3D2C8',
    inkMuted: '#BCA69B',
    accent: '#F6A96D',
    accentSoftBg: 'rgba(246, 169, 109, 0.18)',
    accentContrastInk: '#1E1522',
    bezelOuterBg: 'rgba(24, 21, 36, 0.56)',
    bezelOuterBorder: 'rgba(255, 255, 255, 0.16)',
    coreSurfaceBg: 'rgba(25, 22, 39, 0.74)',
    coreElevatedBg: 'rgba(36, 30, 52, 0.91)',
    hairline: 'rgba(250, 245, 240, 0.10)',
    pillIdleBg: 'rgba(34, 28, 49, 0.68)',
    pillActiveBg: '#FAF5F0',
    pillActiveInk: '#1F192E',
    shadowColor: '#0A0712',
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
    skyStops: ['#080E1A', '#101C31', '#182B47'],
    horizonGlow: 'rgba(94, 156, 235, 0.14)',
    inkPrimary: '#F4F6FA',
    inkSecondary: '#B2C3D8',
    inkMuted: '#8297B2',
    accent: '#6CB4FF',
    accentSoftBg: 'rgba(108, 180, 255, 0.16)',
    accentContrastInk: '#09111F',
    bezelOuterBg: 'rgba(17, 23, 36, 0.58)',
    bezelOuterBorder: 'rgba(255, 255, 255, 0.14)',
    coreSurfaceBg: 'rgba(15, 22, 36, 0.76)',
    coreElevatedBg: 'rgba(21, 31, 49, 0.92)',
    hairline: 'rgba(255, 255, 255, 0.09)',
    pillIdleBg: 'rgba(21, 32, 50, 0.72)',
    pillActiveBg: '#F4F6FA',
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

/**
 * Resolves the effective `SkyTheme` passed to `AmbientSkyBackdrop` when the user
 * chooses an explicit Light or Dark override vs Auto-Sky mode.
 */
export function resolveBackdropSkyTheme(
  skyTheme: SkyTheme,
  themeMode: AppThemeMode
): SkyTheme {
  const base = SKY_PALETTES[skyTheme] ?? SKY_PALETTES.day_sunny;
  if (themeMode === 'auto') {
    return base.id;
  }
  if (themeMode === 'light') {
    if (!base.isDark) {
      return base.id;
    }
    if (skyTheme === 'rain_storm') {
      return 'day_cloudy';
    }
    if (skyTheme === 'sunset') {
      return 'dawn';
    }
    return 'day_sunny';
  }
  // themeMode === 'dark'
  if (base.isDark) {
    return base.id;
  }
  if (skyTheme === 'day_cloudy') {
    return 'rain_storm';
  }
  if (skyTheme === 'dawn') {
    return 'sunset';
  }
  return 'night';
}

/**
 * Resolves the `AtmosphericPalette` harmonized with Lucian `--ux-*` light/dark tokens
 * for the active sky state and manual theme override (`auto` | `light` | `dark`).
 */
export function resolveAppPalette(
  skyTheme: SkyTheme,
  themeMode: AppThemeMode
): AtmosphericPalette {
  const effectiveSky = resolveBackdropSkyTheme(skyTheme, themeMode);
  return SKY_PALETTES[effectiveSky] ?? SKY_PALETTES.day_sunny;
}

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

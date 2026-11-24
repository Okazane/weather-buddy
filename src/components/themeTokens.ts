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
 * Perceptually calibrated OKLCH sky palettes (pbakaus/impeccable colorize system)
 * harmonized with Lucian UX/UI `--ux-*` surface, ink, and hairline contrast tokens.
 * Enforces anti-slop rules (zero pure #FFFFFF/#000000/dead gray, zero AI-purple gradients)
 * and strict WCAG AA+ legibility across all light and dark atmospheric states.
 */
export const SKY_PALETTES: Record<SkyTheme, AtmosphericPalette> = {
  day_sunny: {
    id: 'day_sunny',
    isDark: false,
    skyStops: ['#DCEBFA', '#EEF4FA', '#F7F5F0'],
    horizonGlow: 'rgba(248, 216, 148, 0.32)',
    inkPrimary: '#141D2B',
    inkSecondary: '#36455C',
    inkMuted: '#53647D',
    accent: '#1E6BB8',
    accentSoftBg: 'rgba(30, 107, 184, 0.11)',
    accentContrastInk: '#FCFBF8',
    bezelOuterBg: 'rgba(252, 251, 248, 0.72)',
    bezelOuterBorder: 'rgba(20, 29, 43, 0.10)',
    coreSurfaceBg: '#FCFBF8',
    coreElevatedBg: '#F3EFE8',
    hairline: 'rgba(20, 29, 43, 0.08)',
    pillIdleBg: '#ECE8DF',
    pillActiveBg: '#141D2B',
    pillActiveInk: '#FCFBF8',
    shadowColor: '#162338',
    rainAlertBg: '#1A3452',
    rainAlertInk: '#F4F8FC',
    rainAlertBorder: 'rgba(88, 152, 224, 0.42)',
    aqiAlertBg: '#6E242E',
    aqiAlertInk: '#FCF3F4',
    aqiAlertBorder: 'rgba(218, 114, 126, 0.42)',
  },
  dawn: {
    id: 'dawn',
    isDark: false,
    skyStops: ['#F3D6C6', '#F9EAE0', '#FAF5EE'],
    horizonGlow: 'rgba(244, 184, 140, 0.30)',
    inkPrimary: '#141D2B',
    inkSecondary: '#36455C',
    inkMuted: '#53647D',
    accent: '#B85D28',
    accentSoftBg: 'rgba(184, 93, 40, 0.11)',
    accentContrastInk: '#FDFBF8',
    bezelOuterBg: 'rgba(253, 251, 248, 0.72)',
    bezelOuterBorder: 'rgba(20, 29, 43, 0.10)',
    coreSurfaceBg: '#FDFBF8',
    coreElevatedBg: '#F5EDE4',
    hairline: 'rgba(20, 29, 43, 0.08)',
    pillIdleBg: '#EDE3D8',
    pillActiveBg: '#141D2B',
    pillActiveInk: '#FDFBF8',
    shadowColor: '#2B1F24',
    rainAlertBg: '#1D3552',
    rainAlertInk: '#F4F8FC',
    rainAlertBorder: 'rgba(104, 162, 228, 0.40)',
    aqiAlertBg: '#6E242E',
    aqiAlertInk: '#FCF3F4',
    aqiAlertBorder: 'rgba(218, 114, 126, 0.42)',
  },
  day_cloudy: {
    id: 'day_cloudy',
    isDark: false,
    skyStops: ['#D5E0EC', '#E7EEF5', '#F2F5F8'],
    horizonGlow: 'rgba(235, 242, 250, 0.36)',
    inkPrimary: '#141D2B',
    inkSecondary: '#36455C',
    inkMuted: '#53647D',
    accent: '#26639E',
    accentSoftBg: 'rgba(38, 99, 158, 0.11)',
    accentContrastInk: '#FAFBFC',
    bezelOuterBg: 'rgba(250, 251, 252, 0.74)',
    bezelOuterBorder: 'rgba(20, 29, 43, 0.10)',
    coreSurfaceBg: '#FAFBFC',
    coreElevatedBg: '#EDF1F6',
    hairline: 'rgba(20, 29, 43, 0.08)',
    pillIdleBg: '#E4EAF1',
    pillActiveBg: '#141D2B',
    pillActiveInk: '#FAFBFC',
    shadowColor: '#1B283A',
    rainAlertBg: '#1A3452',
    rainAlertInk: '#F4F8FC',
    rainAlertBorder: 'rgba(88, 152, 224, 0.42)',
    aqiAlertBg: '#6E242E',
    aqiAlertInk: '#FCF3F4',
    aqiAlertBorder: 'rgba(218, 114, 126, 0.42)',
  },
  day_rain: {
    id: 'day_rain',
    isDark: false,
    skyStops: ['#C7D5E4', '#DCE6F0', '#ECF1F6'],
    horizonGlow: 'rgba(216, 229, 243, 0.38)',
    inkPrimary: '#141D2B',
    inkSecondary: '#36455C',
    inkMuted: '#53647D',
    accent: '#235E99',
    accentSoftBg: 'rgba(35, 94, 153, 0.12)',
    accentContrastInk: '#F8FAFC',
    bezelOuterBg: 'rgba(248, 250, 252, 0.74)',
    bezelOuterBorder: 'rgba(20, 29, 43, 0.11)',
    coreSurfaceBg: '#F8FAFC',
    coreElevatedBg: '#E8EFF6',
    hairline: 'rgba(20, 29, 43, 0.09)',
    pillIdleBg: '#DFE8F1',
    pillActiveBg: '#141D2B',
    pillActiveInk: '#F8FAFC',
    shadowColor: '#182638',
    rainAlertBg: '#1A3452',
    rainAlertInk: '#F4F8FC',
    rainAlertBorder: 'rgba(88, 152, 224, 0.44)',
    aqiAlertBg: '#6E242E',
    aqiAlertInk: '#FCF3F4',
    aqiAlertBorder: 'rgba(218, 114, 126, 0.42)',
  },
  rain_storm: {
    id: 'rain_storm',
    isDark: true,
    skyStops: ['#0D1522', '#131E30', '#172438'],
    horizonGlow: 'rgba(100, 165, 227, 0.12)',
    inkPrimary: '#EEF3FA',
    inkSecondary: '#B2C1D6',
    inkMuted: '#7E91AC',
    accent: '#64A5E3',
    accentSoftBg: 'rgba(100, 165, 227, 0.14)',
    accentContrastInk: '#0D1522',
    bezelOuterBg: 'rgba(255, 255, 255, 0.045)',
    bezelOuterBorder: 'rgba(203, 221, 245, 0.13)',
    coreSurfaceBg: '#162234',
    coreElevatedBg: '#1E2D44',
    hairline: 'rgba(203, 221, 245, 0.08)',
    pillIdleBg: '#23344F',
    pillActiveBg: '#EEF3FA',
    pillActiveInk: '#0F1828',
    shadowColor: '#050A14',
    rainAlertBg: '#D8E8FA',
    rainAlertInk: '#12263F',
    rainAlertBorder: 'rgba(130, 182, 240, 0.62)',
    aqiAlertBg: '#F6DDE1',
    aqiAlertInk: '#611C26',
    aqiAlertBorder: 'rgba(226, 134, 146, 0.62)',
  },
  sunset: {
    id: 'sunset',
    isDark: false,
    skyStops: ['#EBC4A4', '#F5DFC9', '#F9F3EA'],
    horizonGlow: 'rgba(238, 168, 98, 0.30)',
    inkPrimary: '#141D2B',
    inkSecondary: '#36455C',
    inkMuted: '#53647D',
    accent: '#B55824',
    accentSoftBg: 'rgba(181, 88, 36, 0.12)',
    accentContrastInk: '#FCF9F4',
    bezelOuterBg: 'rgba(252, 249, 244, 0.72)',
    bezelOuterBorder: 'rgba(20, 29, 43, 0.10)',
    coreSurfaceBg: '#FCF9F4',
    coreElevatedBg: '#F3EAE0',
    hairline: 'rgba(20, 29, 43, 0.08)',
    pillIdleBg: '#EAE0D3',
    pillActiveBg: '#141D2B',
    pillActiveInk: '#FCF9F4',
    shadowColor: '#2E2118',
    rainAlertBg: '#1D3552',
    rainAlertInk: '#F4F8FC',
    rainAlertBorder: 'rgba(104, 162, 228, 0.40)',
    aqiAlertBg: '#6E242E',
    aqiAlertInk: '#FCF3F4',
    aqiAlertBorder: 'rgba(218, 114, 126, 0.42)',
  },
  night: {
    id: 'night',
    isDark: true,
    skyStops: ['#0B1220', '#101A2D', '#142036'],
    horizonGlow: 'rgba(107, 169, 232, 0.10)',
    inkPrimary: '#EEF3FA',
    inkSecondary: '#B2C1D6',
    inkMuted: '#7E91AC',
    accent: '#6BA9E8',
    accentSoftBg: 'rgba(107, 169, 232, 0.14)',
    accentContrastInk: '#0D1524',
    bezelOuterBg: 'rgba(255, 255, 255, 0.045)',
    bezelOuterBorder: 'rgba(203, 221, 245, 0.13)',
    coreSurfaceBg: '#152033',
    coreElevatedBg: '#1C2A42',
    hairline: 'rgba(203, 221, 245, 0.08)',
    pillIdleBg: '#22324D',
    pillActiveBg: '#EEF3FA',
    pillActiveInk: '#0E1726',
    shadowColor: '#050A14',
    rainAlertBg: '#D8E8FA',
    rainAlertInk: '#12263F',
    rainAlertBorder: 'rgba(130, 182, 240, 0.62)',
    aqiAlertBg: '#F6DDE1',
    aqiAlertInk: '#611C26',
    aqiAlertBorder: 'rgba(226, 134, 146, 0.62)',
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
      return 'day_rain';
    }
    return 'day_sunny';
  }
  // themeMode === 'dark'
  if (base.isDark) {
    return base.id;
  }
  if (skyTheme === 'day_rain' || skyTheme === 'day_cloudy') {
    return 'rain_storm';
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

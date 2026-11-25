/* Lucian UX/UI Prompt #047 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#047 */
/* Lucian UX/UI Prompt #095 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#095 */

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type {
  CharacterDecision,
  Gender,
  HourlyForecastPoint,
  ThermalSensitivity,
  WeatherSnapshot,
} from '../core';
import {
  ArrowCounterClockwise,
  Clock,
  Cube,
  MapPin,
  Moon,
  SceneBadgeIcon,
  ShieldCheck,
  ShieldWarning,
  Sun,
  SunHorizon,
  ThermometerCold,
  ThermometerHot,
  Umbrella,
  WeatherIcon,
  stripLeadingEmoji,
} from './AppIcons';
import { LivingCharacterRig } from './LivingCharacterRig';
import { TermTooltip } from './TermTooltip';
import {
  FONT_FAMILY_DISPLAY,
  FONT_FAMILY_SANS,
  sanitizeCopy,
  WEB_NO_OUTLINE,
  type AtmosphericPalette,
} from './themeTokens';

interface CharacterStageCardProps {
  palette: AtmosphericPalette;
  weather: WeatherSnapshot;
  decision: CharacterDecision;
  gender: Gender;
  sensitivity: ThermalSensitivity;
  reduceMotion: boolean;
}

function localizeDisplayTermVi(raw: string): string {
  return sanitizeCopy(raw)
    .replace(/&\s*UV cao/gi, '· Tia cực tím cao')
    .replace(/\bUV cao\b/gi, 'Tia cực tím cao')
    .replace(/\bAQI cao\b/gi, 'Ô nhiễm bụi mịn cao');
}

function localizeVerificationSummaryVi(raw: string): string {
  return sanitizeCopy(raw)
    .replace(/Trạm sân bay/g, 'Trạm khí tượng sân bay')
    .replace(/MET Norway/g, 'Viện Khí tượng Na Uy (ECMWF)');
}

function buildBadgeExplanationVi(
  weather: WeatherSnapshot,
  decision: CharacterDecision
): string {
  const temp = Math.round(weather.temperatureC);
  const feels = Math.round(weather.feelsLikeC);
  const hum = Math.round(weather.humidityPct);
  const rain = Math.round(weather.precipProbPct);
  const wind = Math.round(weather.windSpeedKmh);
  const uvClause = weather.isDay
    ? `, bức xạ tia cực tím mức ${weather.uvIndex}`
    : ', ban đêm không có bức xạ mặt trời';

  if (
    decision.sceneId === 'storm_raincoat' ||
    decision.sceneId === 'light_rain_umbrella'
  ) {
    return `Phân loại theo lượng mưa thực tế (${weather.precipMmPerHr.toFixed(1)} mm/giờ, xác suất ${rain}%), sức gió ${wind} km/giờ và nhiệt độ cảm nhận ${feels}°C.`;
  }
  return `Tổng hợp từ nhiệt độ thực ${temp}°C (cảm nhận ${feels}°C), độ ẩm ${hum}%${uvClause} và tốc độ gió ${wind} km/giờ tại khu vực của bạn.`;
}

function buildOutfitExplanationVi(
  weather: WeatherSnapshot,
  decision: CharacterDecision,
  sensitivity: ThermalSensitivity
): string {
  const reasons: string[] = [
    `nhiệt độ cảm nhận ${Math.round(weather.feelsLikeC)}°C (độ ẩm ${Math.round(weather.humidityPct)}%)`,
  ];
  if (sensitivity === 'cold_sensitive') {
    reasons.push('cơ địa sợ lạnh (ưu tiên giữ ấm sớm hơn 3°C)');
  } else if (sensitivity === 'heat_sensitive') {
    reasons.push('cơ địa sợ nóng (ưu tiên đồ thoáng mát sớm hơn 3°C)');
  }
  if (
    decision.sceneId === 'storm_raincoat' ||
    decision.sceneId === 'light_rain_umbrella'
  ) {
    reasons.push(`trời đang có mưa (${Math.round(weather.precipProbPct)}%)`);
  } else if (decision.hasRainAheadProp) {
    reasons.push(
      `dự báo sắp có mưa trong ${decision.rainAheadHours ?? 3} giờ tới`
    );
  }
  if (weather.isDay && weather.uvIndex >= 6) {
    reasons.push(`bức xạ tia cực tím cao (mức ${weather.uvIndex})`);
  }
  if (decision.hasAqiMask) {
    reasons.push(
      typeof weather.aqi === 'number'
        ? `mật độ bụi mịn cao (chỉ số ${Math.round(weather.aqi)}) cần đeo khẩu trang lọc bụi`
        : 'mật độ bụi mịn không khí cao cần đeo khẩu trang lọc bụi'
    );
  }
  return `Lời khuyên được tính toán tự động dựa trên ${reasons.join(', ')}.`;
}

const WEEKDAY_LABELS_VI = [
  'Chủ Nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
];

interface LocalDateTimeParts {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
}

function extractLocalDateTimeParts(
  iso: string | undefined,
  utcOffsetSeconds?: number
): LocalDateTimeParts | null {
  if (!iso) {
    return null;
  }
  const trimmed = iso.trim();
  const explicitMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?([+-]\d{2}:?\d{2})?$/
  );
  if (explicitMatch) {
    const year = Number(explicitMatch[1]);
    const month = Number(explicitMatch[2]);
    const day = Number(explicitMatch[3]);
    const hour = Number(explicitMatch[4]);
    const minute = Number(explicitMatch[5]);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return { year, month, day, weekday, hour, minute };
  }
  const parsedMs = Date.parse(trimmed);
  if (Number.isNaN(parsedMs)) {
    return null;
  }
  const offsetSec =
    typeof utcOffsetSeconds === 'number' && Number.isFinite(utcOffsetSeconds)
      ? utcOffsetSeconds
      : -new Date().getTimezoneOffset() * 60;
  const shifted = new Date(parsedMs + offsetSec * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

function formatHourlySlotTime(
  iso: string,
  index: number,
  utcOffsetSeconds?: number
): string {
  const parts = extractLocalDateTimeParts(iso, utcOffsetSeconds);
  if (parts) {
    return `${String(parts.hour).padStart(2, '0')}:00`;
  }
  return `+${index + 1}h`;
}

function formatHourlySlotDateShort(
  iso: string,
  utcOffsetSeconds?: number
): string {
  const parts = extractLocalDateTimeParts(iso, utcOffsetSeconds);
  if (!parts) {
    return '';
  }
  return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}`;
}

function formatFullDateTimeBadgeVi(
  iso: string | undefined,
  utcOffsetSeconds?: number,
  includeMinutes = true
): string {
  const parts = extractLocalDateTimeParts(iso, utcOffsetSeconds);
  if (!parts) {
    return '';
  }
  const weekdayLabel = WEEKDAY_LABELS_VI[parts.weekday] ?? '';
  const dd = String(parts.day).padStart(2, '0');
  const mm = String(parts.month).padStart(2, '0');
  const hh = String(parts.hour).padStart(2, '0');
  const min = String(parts.minute).padStart(2, '0');
  const timePart = includeMinutes ? `${hh}:${min}` : `${hh}:00`;
  return `${weekdayLabel}, ${dd}/${mm}/${parts.year} · ${timePart}`;
}

function describeSlotConditionVi(code: string, hour: number): string {
  const upper = (code || '').toUpperCase();
  const isDay = hour >= 6 && hour < 18;
  if (upper.includes('THUNDER') || upper.includes('STORM')) {
    return 'Mưa dông rải rác';
  }
  if (upper.includes('HEAVY_RAIN')) {
    return 'Mưa to nặng hạt';
  }
  if (upper.includes('RAIN')) {
    return 'Có mưa rào';
  }
  if (upper.includes('DRIZZLE')) {
    return 'Mưa phùn nhẹ';
  }
  if (upper.includes('SNOW')) {
    return 'Trời lạnh có tuyết';
  }
  if (upper.includes('FOG')) {
    return 'Có sương mù nhẹ';
  }
  if (upper.includes('MOSTLY_CLOUDY')) {
    return isDay ? 'Nắng dịu có mây' : 'Đêm có mây nhẹ';
  }
  if (upper.includes('MOSTLY_CLEAR')) {
    return isDay ? 'Nắng nhẹ dễ chịu' : 'Đêm ít mây';
  }
  if (upper === 'CLOUDY' || upper.includes('OVERCAST')) {
    return 'Trời nhiều mây';
  }
  if (upper.includes('CLOUD')) {
    return isDay ? 'Có mây rải rác' : 'Đêm ít mây';
  }
  return isDay ? 'Trời nắng quang đãng' : 'Đêm quang mây';
}

interface SunlightPhaseMeta {
  labelVi: string;
  shortLabelVi: string;
  phase: 'dawn' | 'day' | 'sunset' | 'night';
  iconKind: 'sun' | 'horizon' | 'moon';
  accentHex: string;
  textAccentLightHex: string;
  iconHex: string;
  haloRgba: string;
}

/**
 * Calibrated physical sunlight color-temperature phases across the 24-hour solar cycle
 * (~2200K dusk/dawn horizon -> ~4500K morning/afternoon gold -> ~6000K zenith daylight -> slate night).
 * Zero synthetic neon pink/magenta/purple.
 */
function describeSkyPhaseVi(hour: number): SunlightPhaseMeta {
  const h = ((Math.round(hour) % 24) + 24) % 24;
  if (h <= 4) {
    return {
      labelVi: 'Đêm sâu · Ánh trăng dịu',
      shortLabelVi: 'Đêm sâu',
      phase: 'night',
      iconKind: 'moon',
      accentHex: '#8CC2FF',
      textAccentLightHex: '#255B94',
      iconHex: '#D8ECFF',
      haloRgba: 'rgba(140, 194, 255, 0.34)',
    };
  }
  if (h === 5) {
    return {
      labelVi: 'Hửng đông · Chân trời ấm',
      shortLabelVi: 'Hửng đông',
      phase: 'dawn',
      iconKind: 'horizon',
      accentHex: '#E09145',
      textAccentLightHex: '#9E5319',
      iconHex: '#D98234',
      haloRgba: 'rgba(224, 145, 69, 0.28)',
    };
  }
  if (h === 6) {
    return {
      labelVi: 'Bình minh nắng sớm',
      shortLabelVi: 'Bình minh',
      phase: 'dawn',
      iconKind: 'horizon',
      accentHex: '#E8A849',
      textAccentLightHex: '#966012',
      iconHex: '#DC962E',
      haloRgba: 'rgba(232, 168, 73, 0.30)',
    };
  }
  if (h === 7 || h === 8) {
    return {
      labelVi: 'Nắng mai dịu',
      shortLabelVi: 'Nắng mai',
      phase: 'day',
      iconKind: 'sun',
      accentHex: '#DFB04B',
      textAccentLightHex: '#8C6210',
      iconHex: '#D49B2A',
      haloRgba: 'rgba(223, 176, 75, 0.28)',
    };
  }
  if (h === 9 || h === 10) {
    return {
      labelVi: 'Nắng sáng trong',
      shortLabelVi: 'Nắng sáng',
      phase: 'day',
      iconKind: 'sun',
      accentHex: '#4BA3E3',
      textAccentLightHex: '#1E679E',
      iconHex: '#3894D8',
      haloRgba: 'rgba(75, 163, 227, 0.26)',
    };
  }
  if (h >= 11 && h <= 14) {
    return {
      labelVi: 'Nắng trưa rực rỡ',
      shortLabelVi: 'Nắng trưa',
      phase: 'day',
      iconKind: 'sun',
      accentHex: '#3B9AE1',
      textAccentLightHex: '#185E99',
      iconHex: '#2E8AD0',
      haloRgba: 'rgba(59, 154, 225, 0.26)',
    };
  }
  if (h === 15 || h === 16) {
    return {
      labelVi: 'Nắng chiều vàng',
      shortLabelVi: 'Nắng chiều',
      phase: 'day',
      iconKind: 'sun',
      accentHex: '#E5A23C',
      textAccentLightHex: '#945F10',
      iconHex: '#D99226',
      haloRgba: 'rgba(229, 162, 60, 0.28)',
    };
  }
  if (h === 17) {
    return {
      labelVi: 'Hoàng hôn nắng cam',
      shortLabelVi: 'Hoàng hôn',
      phase: 'sunset',
      iconKind: 'horizon',
      accentHex: '#E28739',
      textAccentLightHex: '#9C4C16',
      iconHex: '#D97724',
      haloRgba: 'rgba(226, 135, 57, 0.30)',
    };
  }
  if (h === 18) {
    return {
      labelVi: 'Chạng vạng tắt nắng',
      shortLabelVi: 'Chạng vạng',
      phase: 'sunset',
      iconKind: 'horizon',
      accentHex: '#C97A53',
      textAccentLightHex: '#874728',
      iconHex: '#C47149',
      haloRgba: 'rgba(201, 122, 83, 0.26)',
    };
  }
  return {
    labelVi: 'Đêm tối quang tĩnh',
    shortLabelVi: 'Đêm tối',
    phase: 'night',
    iconKind: 'moon',
    accentHex: '#8CC2FF',
    textAccentLightHex: '#255B94',
    iconHex: '#D8ECFF',
    haloRgba: 'rgba(140, 194, 255, 0.34)',
  };
}

function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixHexColors(hexA: string, hexB: string, ratio: number): string {
  const [r1, g1, b1] = hexToRgbTuple(hexA);
  const [r2, g2, b2] = hexToRgbTuple(hexB);
  const t = Math.max(0, Math.min(1, ratio));
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function skyHourToSunlightStops(hour: number, palette: AtmosphericPalette): string[] {
  const h = ((Math.round(hour) % 24) + 24) % 24;
  const night = palette.skyRailNight;
  const twilight = palette.skyRailTwilight;
  const dawn = palette.skyRailDawn;
  const day = palette.skyRailDay;
  // Soft atmospheric bridge between dawn amber and clear sky blue (never muddy olive)
  const horizonSky = mixHexColors(twilight, day, 0.45);
  const warmDay = mixHexColors(dawn, day, 0.25);

  if (h <= 2) return [night];
  if (h === 3) return [mixHexColors(night, twilight, 0.35)];
  if (h === 4) return [twilight];
  if (h === 5) return [mixHexColors(twilight, dawn, 0.55), dawn];
  if (h === 6) return [dawn, warmDay];
  if (h === 7) return [horizonSky];
  if (h === 8) return [mixHexColors(horizonSky, day, 0.58)];
  if (h === 9) return [mixHexColors(horizonSky, day, 0.82)];
  if (h >= 10 && h <= 14) return [day];
  if (h === 15) return [mixHexColors(day, horizonSky, 0.32)];
  if (h === 16) return [horizonSky, warmDay];
  if (h === 17) return [dawn, mixHexColors(dawn, twilight, 0.35)];
  if (h === 18) return [mixHexColors(dawn, twilight, 0.72), twilight];
  if (h === 19) return [mixHexColors(twilight, night, 0.62)];
  if (h === 20) return [mixHexColors(twilight, night, 0.85)];
  return [night];
}

function buildChronologicalSkyGradientCss(
  hours: number[],
  palette: AtmosphericPalette
): string {
  if (hours.length < 2) {
    return `linear-gradient(90deg, ${palette.skyRailNight} 0%, ${palette.skyRailTwilight} 16%, ${palette.skyRailDawn} 26%, ${palette.skyRailDay} 50%, ${palette.skyRailDawn} 74%, ${palette.skyRailTwilight} 86%, ${palette.skyRailNight} 100%)`;
  }
  const expanded: string[] = [];
  for (const h of hours) {
    expanded.push(...skyHourToSunlightStops(h, palette));
  }
  const maxIdx = Math.max(1, expanded.length - 1);
  const stops = expanded.map(
    (col, idx) => `${col} ${((idx / maxIdx) * 100).toFixed(1)}%`
  );
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export const CharacterStageCard: React.FC<CharacterStageCardProps> = React.memo(({
  palette,
  weather,
  decision,
  gender,
  sensitivity,
  reduceMotion,
}) => {
  const { width } = useWindowDimensions();
  const isSplitDesktop = width >= 900;
  const isCompactMobile = width < 420;
  const [selectedHourIdx, setSelectedHourIdx] = useState<number>(-1);
  const [customVrmUrl, setCustomVrmUrl] = useState<string | null>(null);

  useEffect(() => {
    setSelectedHourIdx(-1);
  }, [weather.locationName, weather.updatedAtIso]);

  useEffect(() => {
    return () => {
      if (customVrmUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(customVrmUrl);
      }
    };
  }, [customVrmUrl]);

  const handleOpenVrmPicker = useCallback(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.vrm';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        return;
      }
      const nextUrl = URL.createObjectURL(file);
      setCustomVrmUrl(nextUrl);
    };
    input.click();
  }, []);

  const handleResetCustomVrm = useCallback(() => {
    setCustomVrmUrl(null);
  }, []);

  const hourly24: HourlyForecastPoint[] = useMemo(
    () => (weather.hourly ?? []).slice(0, 24),
    [weather.hourly]
  );

  const { hiTemp3, loTemp3, hiTemp24, loTemp24 } = useMemo(() => {
    const temps3 = [
      weather.temperatureC,
      ...hourly24.slice(0, 3).map((h) => h.temperatureC),
    ];
    const temps24 = [
      weather.temperatureC,
      ...hourly24.map((h) => h.temperatureC),
    ];
    return {
      hiTemp3: Math.round(Math.max(...temps3)),
      loTemp3: Math.round(Math.min(...temps3)),
      hiTemp24: Math.round(Math.max(...temps24)),
      loTemp24: Math.round(Math.min(...temps24)),
    };
  }, [weather.temperatureC, hourly24]);

  const badgeLabel = useMemo(
    () => localizeDisplayTermVi(stripLeadingEmoji(decision.badgeVi)),
    [decision.badgeVi]
  );

  const badgeExplanationVi = useMemo(
    () => buildBadgeExplanationVi(weather, decision),
    [weather, decision]
  );

  const outfitExplanationVi = useMemo(
    () => buildOutfitExplanationVi(weather, decision, sensitivity),
    [weather, decision, sensitivity]
  );

  const sensitivityTag =
    sensitivity === 'cold_sensitive'
      ? 'Sợ lạnh'
      : sensitivity === 'heat_sensitive'
        ? 'Sợ nóng'
        : null;

  const spriteSize = isSplitDesktop
    ? 336
    : Math.min(288, Math.max(224, width - 84));

  const skyTrackRef = useRef<View | null>(null);
  const knobDomRef = useRef<View | null>(null);
  const hourlyScrollRef = useRef<ScrollView | null>(null);
  const draggingRef = useRef<boolean>(false);
  const trackWidthPxRef = useRef<number>(320);
  const dragTrackLeftRef = useRef<number>(0);
  const activePointerIdRef = useRef<number | null>(null);
  const hasInitializedKnobRef = useRef<boolean>(false);
  const [nativeTrackWidth, setNativeTrackWidth] = useState<number>(320);

  const isPreviewingSlot =
    selectedHourIdx >= 0 && selectedHourIdx < hourly24.length;
  const activeHourPoint = isPreviewingSlot ? hourly24[selectedHourIdx] : null;
  const hasHourlyTimeline = hourly24.length > 0;

  const currentParts = useMemo(
    () => extractLocalDateTimeParts(weather.updatedAtIso, weather.utcOffsetSeconds),
    [weather.updatedAtIso, weather.utcOffsetSeconds]
  );
  const currentDateShort = useMemo(
    () => formatHourlySlotDateShort(weather.updatedAtIso, weather.utcOffsetSeconds),
    [weather.updatedAtIso, weather.utcOffsetSeconds]
  );
  const activeSlotParts = useMemo(
    () =>
      activeHourPoint
        ? extractLocalDateTimeParts(activeHourPoint.timeIso, weather.utcOffsetSeconds)
        : currentParts,
    [activeHourPoint, weather.utcOffsetSeconds, currentParts]
  );

  const activeSkyHour = activeSlotParts?.hour ?? (weather.isDay ? 12 : 21);
  const skyPhaseInfo = describeSkyPhaseVi(activeSkyHour);

  const totalScrubSteps = Math.max(1, hourly24.length);

  // Sync mutable refs on every render so stable DOM drag listeners never tear down mid-drag
  const selectedIdxRef = useRef<number>(selectedHourIdx);
  const totalStepsRef = useRef<number>(totalScrubSteps);
  const hourlyLenRef = useRef<number>(hourly24.length);
  const reduceMotionRef = useRef<boolean>(reduceMotion);
  selectedIdxRef.current = selectedHourIdx;
  totalStepsRef.current = totalScrubSteps;
  hourlyLenRef.current = hourly24.length;
  reduceMotionRef.current = reduceMotion;

  const computeSnappedKnobX = useCallback(
    (widthPx: number, idx: number, steps: number): number => {
      const safeWidth = Math.max(28, widthPx);
      const stepPos = idx >= 0 ? Math.min(steps, idx + 1) : 0;
      const ratio = steps > 0 ? stepPos / steps : 0;
      const rawX = 14 + ratio * (safeWidth - 28);
      return Math.max(14, Math.min(safeWidth - 14, rawX));
    },
    []
  );

  const nativeKnobX = computeSnappedKnobX(
    nativeTrackWidth,
    selectedHourIdx,
    totalScrubSteps
  );

  const chronologicalSkyGradientCss = useMemo(() => {
    const startHour = currentParts?.hour ?? (weather.isDay ? 12 : 21);
    const seqHours = [
      startHour,
      ...hourly24.map((slot, idx) => {
        const p = extractLocalDateTimeParts(slot.timeIso, weather.utcOffsetSeconds);
        return p?.hour ?? (startHour + idx + 1) % 24;
      }),
    ];
    return buildChronologicalSkyGradientCss(seqHours, palette);
  }, [currentParts, weather.isDay, weather.utcOffsetSeconds, hourly24, palette]);

  const isDemoSnapshot = weather.provider === 'demo';

  const skyLegendStops = useMemo(() => {
    if (hourly24.length === 0) {
      return [];
    }
    const maxPos = hourly24.length;
    const positions = [
      0,
      Math.round(maxPos * 0.25),
      Math.round(maxPos * 0.5),
      Math.round(maxPos * 0.75),
      maxPos,
    ];
    return positions.map((pos, i) => {
      if (pos === 0) {
        const hh =
          currentParts !== null
            ? `${String(currentParts.hour).padStart(2, '0')}h`
            : '';
        return {
          slotIdx: -1,
          label: isDemoSnapshot
            ? `Mẫu${hh ? ` (${hh})` : ''}`
            : `Hiện tại${hh ? ` (${hh})` : ''}`,
        };
      }
      const idx = Math.min(hourly24.length - 1, pos - 1);
      const slot = hourly24[idx];
      const parts = extractLocalDateTimeParts(
        slot.timeIso,
        weather.utcOffsetSeconds
      );
      const hhStr =
        parts !== null
          ? `${String(parts.hour).padStart(2, '0')}h`
          : `+${idx + 1}h`;
      const ddMm = formatHourlySlotDateShort(
        slot.timeIso,
        weather.utcOffsetSeconds
      );
      const phaseTag =
        parts !== null ? describeSkyPhaseVi(parts.hour).shortLabelVi : '';
      return {
        slotIdx: idx,
        label:
          i === positions.length - 1 && ddMm
            ? `${hhStr} (${ddMm})`
            : phaseTag
              ? `${hhStr} ${phaseTag}`
              : hhStr,
      };
    });
  }, [hourly24, currentParts, weather.utcOffsetSeconds, isDemoSnapshot]);

  const commitDiscreteRatio = useCallback((ratio: number, animateScroll: boolean) => {
    const clamped = Math.max(0, Math.min(1, ratio));
    const steps = Math.max(1, totalStepsRef.current);
    const maxHourIdx = Math.max(0, hourlyLenRef.current - 1);
    const nextStep = Math.round(clamped * steps);
    const nextIdx = nextStep <= 0 ? -1 : Math.min(maxHourIdx, nextStep - 1);
    if (nextIdx !== selectedIdxRef.current) {
      selectedIdxRef.current = nextIdx;
      setSelectedHourIdx(nextIdx);
      hourlyScrollRef.current?.scrollTo({
        x: Math.max(0, nextStep * 68 - 136),
        animated: animateScroll && !reduceMotionRef.current,
      });
    }
  }, []);

  // Sync GPU-composited translate3d thumb whenever discrete slot changes outside live drag
  useIsomorphicLayoutEffect(() => {
    if (Platform.OS !== 'web' || !hasHourlyTimeline || draggingRef.current) {
      return;
    }
    const trackEl = skyTrackRef.current as unknown as HTMLElement | null;
    const knobEl = knobDomRef.current as unknown as HTMLElement | null;
    if (!knobEl) {
      return;
    }
    const measuredW = trackEl?.getBoundingClientRect().width ?? 0;
    if (measuredW > 0) {
      trackWidthPxRef.current = measuredW;
    }
    const snappedX = computeSnappedKnobX(
      trackWidthPxRef.current,
      selectedHourIdx,
      totalScrubSteps
    );
    if (!hasInitializedKnobRef.current) {
      hasInitializedKnobRef.current = true;
      knobEl.style.transition = 'none';
      knobEl.style.transform = `translate3d(${snappedX.toFixed(1)}px, 0, 0) scale(1)`;
      return;
    }
    knobEl.style.transition = reduceMotion
      ? 'none'
      : 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)';
    knobEl.style.transform = `translate3d(${snappedX.toFixed(1)}px, 0, 0) scale(1)`;
  }, [
    selectedHourIdx,
    totalScrubSteps,
    reduceMotion,
    hasHourlyTimeline,
    computeSnappedKnobX,
  ]);

  // Web 60fps/120fps GPU-composited pointer dragging + ResizeObserver + keyboard navigation
  // Stable dependencies guarantee listeners are NEVER torn down mid-drag when selectedHourIdx changes!
  useEffect(() => {
    if (Platform.OS !== 'web' || !hasHourlyTimeline) {
      return;
    }
    const el = skyTrackRef.current as unknown as HTMLElement | null;
    if (!el || typeof el.addEventListener !== 'function') {
      return;
    }

    const initialRect = el.getBoundingClientRect();
    if (initialRect.width > 0) {
      trackWidthPxRef.current = initialRect.width;
      dragTrackLeftRef.current = initialRect.left;
    }

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        const nextWidth =
          entry?.contentRect?.width && entry.contentRect.width > 0
            ? entry.contentRect.width
            : el.getBoundingClientRect().width;
        if (nextWidth > 0) {
          trackWidthPxRef.current = nextWidth;
          if (!draggingRef.current) {
            const knobEl = knobDomRef.current as unknown as HTMLElement | null;
            if (knobEl) {
              const snappedX = computeSnappedKnobX(
                nextWidth,
                selectedIdxRef.current,
                totalStepsRef.current
              );
              knobEl.style.transition = 'none';
              knobEl.style.transform = `translate3d(${snappedX.toFixed(1)}px, 0, 0) scale(1)`;
            }
          }
        }
      });
      resizeObserver.observe(el);
    }

    let prevBodyUserSelect = '';
    let prevBodyCursor = '';

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) {
        return;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) {
        trackWidthPxRef.current = rect.width;
        dragTrackLeftRef.current = rect.left;
      }
      const widthPx = Math.max(28, trackWidthPxRef.current);
      const rawX = e.clientX - dragTrackLeftRef.current;
      const xPx = Math.max(14, Math.min(Math.max(14, widthPx - 14), rawX));

      draggingRef.current = true;
      activePointerIdRef.current = e.pointerId;
      el.style.cursor = 'grabbing';
      if (typeof document !== 'undefined' && document.body) {
        prevBodyUserSelect = document.body.style.userSelect;
        prevBodyCursor = document.body.style.cursor;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
      }
      el.focus?.({ preventScroll: true });

      const knobEl = knobDomRef.current as unknown as HTMLElement | null;
      if (knobEl) {
        knobEl.style.transition = 'none';
        knobEl.style.transform = `translate3d(${xPx.toFixed(1)}px, 0, 0) scale(1.14)`;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current) {
        return;
      }
      if (
        activePointerIdRef.current !== null &&
        e.pointerId !== activePointerIdRef.current
      ) {
        return;
      }
      const widthPx = Math.max(28, trackWidthPxRef.current);
      const rawX = e.clientX - dragTrackLeftRef.current;
      const clamped = Math.max(0, Math.min(1, rawX / widthPx));
      const xPx = Math.max(14, Math.min(Math.max(14, widthPx - 14), rawX));

      const knobEl = knobDomRef.current as unknown as HTMLElement | null;
      if (knobEl) {
        knobEl.style.transform = `translate3d(${xPx.toFixed(1)}px, 0, 0) scale(1.14)`;
      }

      const steps = Math.max(1, totalStepsRef.current);
      const maxHourIdx = Math.max(0, hourlyLenRef.current - 1);
      const nextStep = Math.round(clamped * steps);
      const nextIdx = nextStep <= 0 ? -1 : Math.min(maxHourIdx, nextStep - 1);

      if (nextIdx !== selectedIdxRef.current) {
        selectedIdxRef.current = nextIdx;
        setSelectedHourIdx(nextIdx);
        hourlyScrollRef.current?.scrollTo({
          x: Math.max(0, nextStep * 68 - 136),
          animated: !reduceMotionRef.current,
        });
      }
    };

    const finishDrag = (e?: PointerEvent | FocusEvent) => {
      if (!draggingRef.current) {
        return;
      }
      if (
        e &&
        'pointerId' in e &&
        activePointerIdRef.current !== null &&
        e.pointerId !== activePointerIdRef.current
      ) {
        return;
      }
      draggingRef.current = false;
      activePointerIdRef.current = null;
      el.style.cursor = 'grab';
      if (typeof document !== 'undefined' && document.body) {
        document.body.style.userSelect = prevBodyUserSelect;
        document.body.style.cursor = prevBodyCursor;
      }

      const widthPx = Math.max(28, trackWidthPxRef.current);
      if (
        e &&
        'clientX' in e &&
        typeof e.clientX === 'number' &&
        e.type !== 'pointercancel'
      ) {
        const rawX = e.clientX - dragTrackLeftRef.current;
        const clamped = Math.max(0, Math.min(1, rawX / widthPx));
        const steps = Math.max(1, totalStepsRef.current);
        const maxHourIdx = Math.max(0, hourlyLenRef.current - 1);
        const nextStep = Math.round(clamped * steps);
        const nextIdx = nextStep <= 0 ? -1 : Math.min(maxHourIdx, nextStep - 1);
        if (nextIdx !== selectedIdxRef.current) {
          selectedIdxRef.current = nextIdx;
          setSelectedHourIdx(nextIdx);
          hourlyScrollRef.current?.scrollTo({
            x: Math.max(0, nextStep * 68 - 136),
            animated: !reduceMotionRef.current,
          });
        }
      }

      const knobEl = knobDomRef.current as unknown as HTMLElement | null;
      if (knobEl) {
        const snappedX = computeSnappedKnobX(
          widthPx,
          selectedIdxRef.current,
          totalStepsRef.current
        );
        knobEl.style.transition = reduceMotionRef.current
          ? 'none'
          : 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)';
        knobEl.style.transform = `translate3d(${snappedX.toFixed(1)}px, 0, 0) scale(1)`;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const steps = Math.max(1, totalStepsRef.current);
      const curStep =
        selectedIdxRef.current >= 0 ? selectedIdxRef.current + 1 : 0;
      let targetStep: number | null = null;

      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        targetStep = Math.min(steps, curStep + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        targetStep = Math.max(0, curStep - 1);
      } else if (e.key === 'Home') {
        targetStep = 0;
      } else if (e.key === 'End') {
        targetStep = steps;
      }

      if (targetStep !== null) {
        e.preventDefault();
        const maxHourIdx = Math.max(0, hourlyLenRef.current - 1);
        const nextIdx =
          targetStep <= 0 ? -1 : Math.min(maxHourIdx, targetStep - 1);
        if (nextIdx !== selectedIdxRef.current) {
          selectedIdxRef.current = nextIdx;
          setSelectedHourIdx(nextIdx);
          hourlyScrollRef.current?.scrollTo({
            x: Math.max(0, targetStep * 68 - 136),
            animated: !reduceMotionRef.current,
          });
        }
      }
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    window.addEventListener('blur', finishDrag);

    return () => {
      resizeObserver?.disconnect();
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
      window.removeEventListener('blur', finishDrag);
      if (draggingRef.current && typeof document !== 'undefined' && document.body) {
        document.body.style.userSelect = prevBodyUserSelect;
        document.body.style.cursor = prevBodyCursor;
      }
      draggingRef.current = false;
      activePointerIdRef.current = null;
    };
  }, [hasHourlyTimeline, computeSnappedKnobX]);

  const headerDateBadgeLabel = activeHourPoint
    ? `Dự báo · ${formatFullDateTimeBadgeVi(
        activeHourPoint.timeIso,
        weather.utcOffsetSeconds,
        false
      )}`
    : isDemoSnapshot
      ? `Mô phỏng · ${formatFullDateTimeBadgeVi(
          weather.updatedAtIso,
          weather.utcOffsetSeconds,
          false
        )}`
      : formatFullDateTimeBadgeVi(
          weather.updatedAtIso,
          weather.utcOffsetSeconds,
          true
        );

  const heroDisplayTemp = activeHourPoint
    ? Math.round(activeHourPoint.temperatureC)
    : Math.round(weather.temperatureC);
  const heroDisplayCondition = activeHourPoint
    ? describeSlotConditionVi(activeHourPoint.conditionCode, activeSkyHour)
    : sanitizeCopy(weather.conditionText);

  return (
    <View
      style={[
        styles.heroBentoGrid,
        isSplitDesktop ? styles.heroSplitRow : styles.heroVerticalStack,
      ]}
    >
      {/* Left Hero Bento Card: Badge + Date + 76px Tabular Temp + Practical Chips + Merged 24h Sky Scrubber & Timeline */}
      <View
        style={[
          styles.outerBezel,
          styles.leftHeroCol,
          {
            backgroundColor: palette.bezelOuterBg,
            borderColor: palette.bezelOuterBorder,
          },
        ]}
      >
        <View
          style={[
            styles.leftHeroInner,
            isCompactMobile && styles.leftHeroInnerCompact,
            { backgroundColor: palette.coreSurfaceBg },
          ]}
        >
          {/* Top Status, Location & Explicit Date/Month Row */}
          <View style={styles.conditionChipRow}>
            <TermTooltip
              palette={palette}
              align="left"
              termTitleVi="Trạng thái thời tiết hiện tại"
              explanationVi={badgeExplanationVi}
            >
              <View
                style={[
                  styles.scenePill,
                  {
                    backgroundColor: palette.accentSoftBg,
                  },
                ]}
              >
                <SceneBadgeIcon
                  sceneId={decision.sceneId}
                  isDay={weather.isDay}
                  skyTheme={decision.skyTheme}
                  hasAqiMask={decision.hasAqiMask}
                  isDark={palette.isDark}
                  size={15}
                />
                <Text style={[styles.scenePillText, { color: palette.accent }]}>
                  {badgeLabel}
                </Text>
              </View>
            </TermTooltip>

            {sensitivityTag && (
              <TermTooltip
                palette={palette}
                align="left"
                termTitleVi="Hiệu chỉnh theo cơ địa nhiệt"
                explanationVi={
                  sensitivity === 'cold_sensitive'
                    ? 'Cơ địa Sợ lạnh (-3°C): hệ thống ưu tiên gợi ý trang phục giữ ấm sớm hơn 3°C so với cảm nhận thông thường.'
                    : 'Cơ địa Sợ nóng (+3°C): hệ thống ưu tiên gợi ý trang phục thoáng mát sớm hơn 3°C so với cảm nhận thông thường.'
                }
              >
                <View
                  style={[
                    styles.subtleMetaPill,
                    {
                      backgroundColor: palette.pillIdleBg,
                      borderColor: palette.bezelOuterBorder,
                    },
                  ]}
                >
                  {sensitivity === 'cold_sensitive' ? (
                    <ThermometerCold size={13} weight="duotone" color={palette.accent} />
                  ) : (
                    <ThermometerHot size={13} weight="duotone" color={palette.accent} />
                  )}
                  <Text
                    style={[styles.sensitivityHint, { color: palette.inkSecondary }]}
                  >
                    {sensitivityTag}
                  </Text>
                </View>
              </TermTooltip>
            )}

            <View
              style={[
                styles.subtleMetaPill,
                {
                  backgroundColor: palette.pillIdleBg,
                  borderColor: palette.hairline,
                },
              ]}
            >
              <MapPin size={12.5} weight="duotone" color={palette.inkMuted} />
              <Text
                numberOfLines={1}
                style={[styles.locationTagText, { color: palette.inkMuted }]}
              >
                {sanitizeCopy(weather.locationName)}
              </Text>
            </View>

            {Boolean(headerDateBadgeLabel) && (
              <View
                style={[
                  styles.subtleMetaPill,
                  {
                    backgroundColor: activeHourPoint
                      ? palette.accentSoftBg
                      : palette.pillIdleBg,
                    borderColor: activeHourPoint
                      ? palette.accent
                      : palette.hairline,
                  },
                ]}
              >
                <Clock
                  size={12.5}
                  weight="duotone"
                  color={activeHourPoint ? palette.accent : palette.inkMuted}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.locationTagText,
                    {
                      color: activeHourPoint
                        ? palette.accent
                        : palette.inkSecondary,
                    },
                  ]}
                >
                  {headerDateBadgeLabel}
                </Text>
              </View>
            )}
          </View>

          {/* Giant 76px Tabular Temperature + Crisp Condition + High/Low/Feels-like Row */}
          <View style={styles.tempNumeralRow}>
            <Text
              style={[
                styles.oversizedTemp,
                isCompactMobile && styles.oversizedTempMobile,
                { color: palette.inkPrimary },
              ]}
            >
              {heroDisplayTemp}°
            </Text>

            <View style={styles.tempMetaColumn}>
              <Text
                numberOfLines={2}
                style={[styles.conditionHeadline, { color: palette.inkPrimary }]}
              >
                {heroDisplayCondition}
              </Text>

              {activeHourPoint ? (
                <Text
                  style={[styles.feelsLikeMeta, { color: palette.inkSecondary }]}
                >
                  Khả năng mưa {Math.round(activeHourPoint.precipProbPct)}% ·{' '}
                  {skyPhaseInfo.labelVi} · Cả ngày {loTemp24}°–{hiTemp24}°
                </Text>
              ) : (
                <TermTooltip
                  palette={palette}
                  align="left"
                  termTitleVi="Nhiệt độ cảm nhận & Biên nhiệt 3 giờ"
                  explanationVi="Nhiệt độ cảm nhận tính cả độ ẩm và sức gió lên cơ thể; biên nhiệt 3h cho biết khoảng dao động thấp nhất – cao nhất trong 3 tiếng sắp tới."
                >
                  <Text
                    style={[styles.feelsLikeMeta, { color: palette.inkSecondary }]}
                  >
                    Cảm nhận {Math.round(weather.feelsLikeC)}° · Biên nhiệt 3h:{' '}
                    {loTemp3}°–{hiTemp3}°
                  </Text>
                </TermTooltip>
              )}

              <Text
                numberOfLines={1}
                style={[styles.headlineSummary, { color: palette.inkMuted }]}
              >
                {activeHourPoint
                  ? `Xem trước mốc ${formatHourlySlotTime(
                      activeHourPoint.timeIso,
                      selectedHourIdx,
                      weather.utcOffsetSeconds
                    )} ngày ${formatHourlySlotDateShort(
                      activeHourPoint.timeIso,
                      weather.utcOffsetSeconds
                    )}`
                  : localizeDisplayTermVi(decision.headlineVi)}
              </Text>

              {weather.verification &&
                weather.verification.consensusLevel !== 'single_source' &&
                Boolean(weather.verification.summaryVi) && (
                  <TermTooltip
                    palette={palette}
                    align="left"
                    termTitleVi="Đối chiếu khí tượng đa nguồn thời gian thực"
                    explanationVi="Dữ liệu đã được kiểm chứng chéo giữa mô hình Open-Meteo, Viện Khí tượng Na Uy (ECMWF) và cảm biến đo thực tế tại trạm khí tượng sân bay gần nhất để khử báo mưa ảo."
                  >
                    <View style={styles.verificationRow}>
                      <ShieldCheck
                        size={12}
                        weight="duotone"
                        color={palette.accent}
                      />
                      <Text
                        numberOfLines={1}
                        style={[styles.verificationText, { color: palette.inkMuted }]}
                      >
                        {localizeVerificationSummaryVi(
                          weather.verification.summaryVi
                        )}
                      </Text>
                    </View>
                  </TermTooltip>
                )}
            </View>
          </View>

          {/* Compact Practical Advice & Rain-Ahead / AQI Pills */}
          <View style={styles.factualChipsRow}>
            <TermTooltip
              palette={palette}
              align="left"
              termTitleVi="Gợi ý trang phục & bảo vệ sức khỏe"
              explanationVi={outfitExplanationVi}
            >
              <View
                style={[
                  styles.outfitChip,
                  {
                    backgroundColor: palette.coreElevatedBg,
                    borderColor: palette.bezelOuterBorder,
                  },
                ]}
              >
                <SceneBadgeIcon
                  sceneId={decision.sceneId}
                  isDay={weather.isDay}
                  skyTheme={decision.skyTheme}
                  hasRainAhead={decision.hasRainAheadProp}
                  isDark={palette.isDark}
                  size={15}
                />
                <Text
                  numberOfLines={2}
                  style={[styles.outfitChipText, { color: palette.inkPrimary }]}
                >
                  {localizeDisplayTermVi(decision.outfitAdviceVi)}
                </Text>
              </View>
            </TermTooltip>

            {decision.hasRainAheadProp && (
              <TermTooltip
                palette={palette}
                align="left"
                termTitleVi="Cảnh báo mưa sắp tới"
                explanationVi="Dự báo trong vài giờ tới khu vực của bạn có xác suất mưa tăng cao. Bạn nên mang sẵn ô gấp hoặc áo mưa trong cốp xe."
              >
                <View
                  style={[
                    styles.alertChip,
                    {
                      backgroundColor: palette.rainAlertBg,
                      borderColor: palette.rainAlertBorder,
                    },
                  ]}
                >
                  <Umbrella size={14} weight="duotone" color={palette.rainAlertInk} />
                  <Text
                    style={[styles.alertChipText, { color: palette.rainAlertInk }]}
                  >
                    Mưa sau {decision.rainAheadHours ?? 3}h
                  </Text>
                </View>
              </TermTooltip>
            )}

            {decision.hasAqiMask && (
              <TermTooltip
                palette={palette}
                align="right"
                termTitleVi="Độ sạch không khí & Bụi mịn (AQI)"
                explanationVi="Đo mật độ bụi mịn PM2.5 và khí thải trong không khí (thang 0–500). Hiện tại ở mức cao (trên 130): không khí kém trong lành, nên đeo khẩu trang lọc bụi mịn khi ra đường."
              >
                <View
                  style={[
                    styles.alertChip,
                    {
                      backgroundColor: palette.aqiAlertBg,
                      borderColor: palette.aqiAlertBorder,
                    },
                  ]}
                >
                  <ShieldWarning
                    size={14}
                    weight="duotone"
                    color={palette.aqiAlertInk}
                  />
                  <Text
                    style={[styles.alertChipText, { color: palette.aqiAlertInk }]}
                  >
                    {typeof weather.aqi === 'number'
                      ? `Bụi mịn cao (${Math.round(weather.aqi)})`
                      : 'Ô nhiễm bụi mịn cao'}
                  </Text>
                </View>
              </TermTooltip>
            )}
          </View>

          {/* Hairline Divider */}
          <View
            style={[
              styles.sectionDivider,
              { backgroundColor: palette.hairline },
            ]}
          />

          {/* Unified 24-Hour Interactive Sky Trajectory & Forecast Timeline */}
          <View style={styles.timelineBlock}>
            <View style={styles.timelineHeaderRow}>
              <View style={styles.timelineTitleCluster}>
                <Clock size={15} weight="duotone" color={palette.accent} />
                <Text
                  style={[styles.timelineTitle, { color: palette.inkPrimary }]}
                >
                  Dòng thời gian & Bầu trời 24 giờ
                </Text>
              </View>

              <View style={styles.timelineRightCluster}>
                {activeHourPoint ? (
                  <>
                    <Text
                      style={[
                        styles.timelineSelectedMeta,
                        { color: palette.inkSecondary },
                      ]}
                    >
                      {formatHourlySlotTime(
                        activeHourPoint.timeIso,
                        selectedHourIdx,
                        weather.utcOffsetSeconds
                      )}{' '}
                      ({formatHourlySlotDateShort(
                        activeHourPoint.timeIso,
                        weather.utcOffsetSeconds
                      )}) · {Math.round(activeHourPoint.temperatureC)}°C
                    </Text>
                    <Pressable
                      onPress={() => {
                        selectedIdxRef.current = -1;
                        setSelectedHourIdx(-1);
                        hourlyScrollRef.current?.scrollTo({
                          x: 0,
                          animated: !reduceMotion,
                        });
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Quay về thời tiết hiện tại"
                      style={[
                        styles.resetNowBtn,
                        WEB_NO_OUTLINE,
                        {
                          backgroundColor: palette.accentSoftBg,
                          borderColor: palette.accent,
                        },
                      ]}
                    >
                      <ArrowCounterClockwise
                        size={11.5}
                        weight="bold"
                        color={palette.accent}
                      />
                      <Text
                        style={[styles.resetNowBtnText, { color: palette.accent }]}
                      >
                        Hiện tại
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <Text
                    style={[
                      styles.timelineSelectedMeta,
                      { color: palette.inkSecondary },
                    ]}
                  >
                    {skyPhaseInfo.labelVi} · Cao {hiTemp24}° · Thấp {loTemp24}°
                  </Text>
                )}
              </View>
            </View>

            {/* Draggable 24h Natural Sunlight Spectrum Scrubber Track (60fps/120fps GPU translate3d) */}
            {hasHourlyTimeline && (
              <View
                style={[
                  styles.skyScrubberCard,
                  {
                    backgroundColor: palette.coreElevatedBg,
                    borderColor: palette.bezelOuterBorder,
                  },
                ]}
              >
                <View
                  ref={skyTrackRef}
                  accessible
                  accessibilityRole="adjustable"
                  accessibilityLabel="Thanh kéo bầu trời ánh nắng dự báo 24 giờ tới"
                  onLayout={(e) => {
                    const measuredWidth = Math.max(
                      28,
                      e.nativeEvent.layout.width
                    );
                    trackWidthPxRef.current = measuredWidth;
                    if (Platform.OS !== 'web') {
                      setNativeTrackWidth(measuredWidth);
                    } else if (!draggingRef.current) {
                      const knobEl =
                        knobDomRef.current as unknown as HTMLElement | null;
                      if (knobEl) {
                        const snappedX = computeSnappedKnobX(
                          measuredWidth,
                          selectedIdxRef.current,
                          totalStepsRef.current
                        );
                        knobEl.style.transition = 'none';
                        knobEl.style.transform = `translate3d(${snappedX.toFixed(1)}px, 0, 0) scale(1)`;
                      }
                    }
                  }}
                  onStartShouldSetResponder={() => Platform.OS !== 'web'}
                  onMoveShouldSetResponder={() => Platform.OS !== 'web'}
                  onResponderGrant={(e) => {
                    if (Platform.OS !== 'web') {
                      commitDiscreteRatio(
                        e.nativeEvent.locationX /
                          Math.max(28, trackWidthPxRef.current),
                        false
                      );
                    }
                  }}
                  onResponderMove={(e) => {
                    if (Platform.OS !== 'web') {
                      commitDiscreteRatio(
                        e.nativeEvent.locationX /
                          Math.max(28, trackWidthPxRef.current),
                        false
                      );
                    }
                  }}
                  onResponderRelease={(e) => {
                    if (Platform.OS !== 'web') {
                      commitDiscreteRatio(
                        e.nativeEvent.locationX /
                          Math.max(28, trackWidthPxRef.current),
                        true
                      );
                    }
                  }}
                  {...(Platform.OS === 'web'
                    ? ({ tabIndex: 0 } as object)
                    : {})}
                  style={[
                    styles.skyScrubberTrackWrap,
                    WEB_NO_OUTLINE,
                    Platform.OS === 'web'
                      ? ({
                          cursor: 'grab',
                          touchAction: 'none',
                          userSelect: 'none',
                        } as object)
                      : null,
                  ]}
                >
                  {/* Natural Sunlight Kelvin Color-Temperature Rail (Zero Neon Purple/Pink, Zero Muddy Green) */}
                  <View
                    pointerEvents="none"
                    style={[
                      styles.skyScrubberGradientBar,
                      {
                        borderColor: palette.isDark
                          ? 'rgba(226, 236, 248, 0.18)'
                          : 'rgba(20, 29, 43, 0.12)',
                      },
                      Platform.OS === 'web'
                        ? ({
                            backgroundImage: chronologicalSkyGradientCss,
                            boxShadow: palette.isDark
                              ? 'inset 0 1px 2px rgba(255, 255, 255, 0.18), 0 2px 8px rgba(8, 15, 28, 0.36)'
                              : 'inset 0 1px 2px rgba(20, 29, 43, 0.10), 0 1px 3px rgba(20, 29, 43, 0.05)',
                          } as object)
                        : { backgroundColor: skyPhaseInfo.accentHex },
                    ]}
                  />

                  {/* GPU-Composited Draggable Sun / Horizon / Moon Orb Thumb (left: 0 + translate3d) */}
                  <View
                    ref={knobDomRef}
                    pointerEvents="none"
                    style={[
                      styles.skyScrubberKnob,
                      {
                        backgroundColor: palette.isDark ? '#24344E' : '#FFFDF9',
                        borderColor: skyPhaseInfo.accentHex,
                      },
                      Platform.OS === 'web'
                        ? ({
                            willChange: 'transform',
                            boxShadow: `0 0 0 4px ${skyPhaseInfo.haloRgba}, 0 4px 14px rgba(4, 6, 11, ${
                              palette.isDark ? '0.68' : '0.18'
                            })`,
                          } as object)
                        : {
                            transform: [{ translateX: nativeKnobX }],
                          },
                    ]}
                  >
                    {skyPhaseInfo.iconKind === 'sun' ? (
                      <Sun
                        size={16}
                        weight="duotone"
                        color={skyPhaseInfo.iconHex}
                      />
                    ) : skyPhaseInfo.iconKind === 'horizon' ? (
                      <SunHorizon
                        size={16}
                        weight="duotone"
                        color={skyPhaseInfo.iconHex}
                      />
                    ) : (
                      <Moon
                        size={15.5}
                        weight="fill"
                        color={palette.isDark ? '#D8ECFF' : '#255B94'}
                      />
                    )}
                  </View>
                </View>

                <View style={styles.skyScrubberLegendRow}>
                  {skyLegendStops.map((stop, idx) => {
                    const isStopActive = stop.slotIdx === selectedHourIdx;
                    return (
                      <Pressable
                        key={`leg_${stop.slotIdx}_${idx}`}
                        onPress={() => {
                          selectedIdxRef.current = stop.slotIdx;
                          setSelectedHourIdx(stop.slotIdx);
                          const stepPos = stop.slotIdx + 1;
                          hourlyScrollRef.current?.scrollTo({
                            x: Math.max(0, stepPos * 68 - 136),
                            animated: !reduceMotion,
                          });
                        }}
                        accessibilityRole="button"
                        style={WEB_NO_OUTLINE}
                      >
                        <Text
                          style={[
                            styles.skyLegendText,
                            {
                              color: isStopActive
                                ? palette.isDark
                                  ? skyPhaseInfo.accentHex
                                  : skyPhaseInfo.textAccentLightHex
                                : palette.inkSecondary,
                              fontWeight: isStopActive ? '700' : '600',
                            },
                          ]}
                        >
                          {stop.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            <ScrollView
              ref={hourlyScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hourlyScrollRow}
            >
              {/* Live "Hiện tại" (or "Mô phỏng" for demo scenarios) Anchor Pill with Explicit Date */}
              <Pressable
                onPress={() => setSelectedHourIdx(-1)}
                accessibilityRole="button"
                accessibilityLabel={`${isDemoSnapshot ? 'Kịch bản mô phỏng' : 'Thời tiết hiện tại'} ngày ${currentDateShort}, ${Math.round(weather.temperatureC)} độ`}
                style={[
                  styles.hourPill,
                  WEB_NO_OUTLINE,
                  {
                    backgroundColor: !isPreviewingSlot
                      ? palette.coreElevatedBg
                      : 'transparent',
                    borderColor: !isPreviewingSlot
                      ? palette.accent
                      : palette.hairline,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.hourTimeText,
                    {
                      color: !isPreviewingSlot
                        ? palette.accent
                        : palette.inkSecondary,
                    },
                  ]}
                >
                  {isDemoSnapshot ? 'Mô phỏng' : 'Hiện tại'}
                </Text>
                {Boolean(currentDateShort) && (
                  <Text
                    style={[
                      styles.hourDateSubText,
                      {
                        color: !isPreviewingSlot
                          ? palette.accent
                          : palette.inkMuted,
                      },
                    ]}
                  >
                    {currentDateShort}
                  </Text>
                )}
                <SceneBadgeIcon
                  sceneId={decision.sceneId}
                  isDay={weather.isDay}
                  skyTheme={decision.skyTheme}
                  isDark={palette.isDark}
                  size={32}
                />
                <Text
                  style={[
                    styles.hourRainPct,
                    {
                      color:
                        weather.precipProbPct >= 15
                          ? palette.accent
                          : palette.inkMuted,
                      opacity: weather.precipProbPct >= 15 ? 1 : 0.85,
                    },
                  ]}
                >
                  {Math.round(weather.precipProbPct)}%
                </Text>
                <Text
                  style={[styles.hourTempText, { color: palette.inkPrimary }]}
                >
                  {Math.round(weather.temperatureC)}°
                </Text>
              </Pressable>

              {hourly24.map((slot, index) => {
                const isSelected = index === selectedHourIdx;
                const isRainAlertHour =
                  decision.hasRainAheadProp &&
                  decision.rainAheadHours === index + 1;
                const showRainProb = slot.precipProbPct >= 15;
                const slotParts = extractLocalDateTimeParts(
                  slot.timeIso,
                  weather.utcOffsetSeconds
                );
                const slotDateShort = formatHourlySlotDateShort(
                  slot.timeIso,
                  weather.utcOffsetSeconds
                );
                const isNewDayBoundary = slotParts?.hour === 0;

                return (
                  <Pressable
                    key={`${slot.timeIso}_${index}`}
                    onPress={() => setSelectedHourIdx(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`Dự báo ${formatHourlySlotTime(
                      slot.timeIso,
                      index,
                      weather.utcOffsetSeconds
                    )} ngày ${slotDateShort}, ${Math.round(slot.temperatureC)} độ, xác suất mưa ${Math.round(slot.precipProbPct)} phần trăm`}
                    style={[
                      styles.hourPill,
                      WEB_NO_OUTLINE,
                      {
                        backgroundColor: isSelected
                          ? palette.coreElevatedBg
                          : isRainAlertHour || isNewDayBoundary
                            ? palette.accentSoftBg
                            : 'transparent',
                        borderColor: isSelected
                          ? palette.accent
                          : isRainAlertHour || isNewDayBoundary
                            ? palette.bezelOuterBorder
                            : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.hourTimeText,
                        {
                          color:
                            isSelected || isRainAlertHour
                              ? palette.accent
                              : palette.inkSecondary,
                        },
                      ]}
                    >
                      {formatHourlySlotTime(
                        slot.timeIso,
                        index,
                        weather.utcOffsetSeconds
                      )}
                    </Text>

                    {Boolean(slotDateShort) && (
                      <Text
                        style={[
                          styles.hourDateSubText,
                          {
                            color:
                              isSelected || isNewDayBoundary
                                ? palette.accent
                                : palette.inkMuted,
                            fontWeight: isNewDayBoundary ? '700' : '600',
                          },
                        ]}
                      >
                        {slotDateShort}
                      </Text>
                    )}

                    <WeatherIcon
                      code={slot.conditionCode}
                      timeIso={slot.timeIso}
                      utcOffsetSeconds={weather.utcOffsetSeconds}
                      precipProbPct={slot.precipProbPct}
                      isDark={palette.isDark}
                      size={32}
                      weight="duotone"
                    />

                    <Text
                      style={[
                        styles.hourRainPct,
                        {
                          color: showRainProb
                            ? palette.accent
                            : palette.inkMuted,
                          opacity: showRainProb ? 1 : 0.82,
                        },
                      ]}
                    >
                      {Math.round(slot.precipProbPct)}%
                    </Text>

                    <Text
                      style={[
                        styles.hourTempText,
                        { color: palette.inkPrimary },
                      ]}
                    >
                      {Math.round(slot.temperatureC)}°
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </View>

      {/* Right Hero Stage Pedestal: Flagship Atmospheric Collectible Showcase Framing <LivingCharacterRig /> */}
      <View
        style={[
          styles.outerBezel,
          styles.rightPedestalCol,
          isSplitDesktop && styles.rightPedestalColDesktop,
          {
            backgroundColor: palette.bezelOuterBg,
            borderColor: palette.bezelOuterBorder,
          },
        ]}
      >
        <View
          style={[
            styles.rightPedestalInner,
            { backgroundColor: palette.coreSurfaceBg },
          ]}
        >
          {/* Subtle Top Showcase Header Pill + Minimal .vrm Avatar Action Icons */}
          <View style={styles.pedestalTopBar}>
            <View
              style={[
                styles.pedestalBadge,
                {
                  backgroundColor: palette.coreElevatedBg,
                  borderColor: palette.hairline,
                },
              ]}
            >
              <View
                style={[
                  styles.livePulseDot,
                  { backgroundColor: palette.accent },
                ]}
              />
              <Text
                style={[
                  styles.pedestalBadgeText,
                  { color: palette.inkSecondary },
                ]}
              >
                {gender === 'male' ? 'Cậu bé Mây' : 'Cô bé Nắng'}
              </Text>
            </View>

            {Platform.OS === 'web' && (
              <View style={styles.vrmIconCluster}>
                {customVrmUrl && (
                  <Pressable
                    onPress={handleResetCustomVrm}
                    accessibilityRole="button"
                    accessibilityLabel="Khôi phục nhân vật mặc định"
                    {...({ title: 'Khôi phục nhân vật mặc định' } as object)}
                    style={[
                      styles.vrmIconBtn,
                      WEB_NO_OUTLINE,
                      {
                        backgroundColor: palette.coreElevatedBg,
                        borderColor: palette.hairline,
                      },
                    ]}
                  >
                    <ArrowCounterClockwise
                      size={13}
                      weight="bold"
                      color={palette.inkSecondary}
                    />
                  </Pressable>
                )}

                <Pressable
                  onPress={handleOpenVrmPicker}
                  accessibilityRole="button"
                  accessibilityLabel="Tải mô hình 3D .vrm tùy chỉnh"
                  {...({ title: 'Tải mô hình 3D .vrm tùy chỉnh' } as object)}
                  style={[
                    styles.vrmIconBtn,
                    WEB_NO_OUTLINE,
                    {
                      backgroundColor: customVrmUrl
                        ? palette.accentSoftBg
                        : palette.coreElevatedBg,
                      borderColor: customVrmUrl ? palette.accent : palette.hairline,
                    },
                  ]}
                >
                  <Cube
                    size={14}
                    weight="duotone"
                    color={customVrmUrl ? palette.accent : palette.inkSecondary}
                  />
                </Pressable>
              </View>
            )}
          </View>

          {/* Dedicated Breathing Room Showcase Framing <LivingCharacterRig /> */}
          <View style={styles.characterShowcaseStage}>
            <LivingCharacterRig
              gender={gender}
              sceneId={decision.sceneId}
              palette={palette}
              size={spriteSize}
              weather={weather}
              customVrmUrl={customVrmUrl}
              reduceMotion={reduceMotion}
              interactive
              showAmbientProps
              npcMode
            />
          </View>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  heroBentoGrid: {
    width: '100%',
    maxWidth: '100%',
    overflow: 'visible',
  },
  heroSplitRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 18,
  },
  heroVerticalStack: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 16,
  },
  outerBezel: {
    padding: 5,
    borderRadius: 28,
    borderWidth: 1,
    maxWidth: '100%',
    overflow: 'visible',
  },
  leftHeroCol: {
    flex: 1.28,
    minWidth: 0,
    overflow: 'visible',
  },
  leftHeroInner: {
    flex: 1,
    borderRadius: 23,
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 14,
    overflow: 'visible',
  },
  leftHeroInnerCompact: {
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 12,
  },
  conditionChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    overflow: 'visible',
  },
  scenePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  scenePillText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '700',
  },
  subtleMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '100%',
  },
  sensitivityHint: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '600',
  },
  locationTagText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '600',
  },
  tempNumeralRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    overflow: 'visible',
  },
  oversizedTemp: {
    fontFamily: FONT_FAMILY_DISPLAY,
    fontSize: 76,
    lineHeight: 82,
    fontWeight: '700',
    letterSpacing: -3.2,
    fontVariant: ['tabular-nums'],
  },
  oversizedTempMobile: {
    fontSize: 66,
    lineHeight: 72,
  },
  tempMetaColumn: {
    flex: 1,
    minWidth: 170,
    gap: 3,
    overflow: 'visible',
  },
  conditionHeadline: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 18.5,
    lineHeight: 24,
    fontWeight: '700',
  },
  feelsLikeMeta: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  headlineSummary: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '500',
  },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
    minWidth: 0,
  },
  verificationText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    fontWeight: '600',
    flexShrink: 1,
  },
  factualChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    overflow: 'visible',
  },
  outfitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '100%',
  },
  outfitChipText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  alertChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  alertChipText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '700',
  },
  sectionDivider: {
    height: 1,
    width: '100%',
    marginVertical: 2,
  },
  timelineBlock: {
    gap: 11,
    width: '100%',
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  timelineTitleCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timelineTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13.5,
    fontWeight: '700',
  },
  timelineRightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  timelineSelectedMeta: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  resetNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 999,
    borderWidth: 1,
  },
  resetNowBtnText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11,
    fontWeight: '700',
  },
  skyScrubberCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 9,
    gap: 8,
  },
  skyScrubberTrackWrap: {
    position: 'relative',
    height: 30,
    justifyContent: 'center',
  },
  skyScrubberGradientBar: {
    height: 9,
    borderRadius: 999,
    borderWidth: 1,
    width: '100%',
  },
  skyScrubberKnob: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 30,
    height: 30,
    marginLeft: -15,
    borderRadius: 999,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skyScrubberLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skyLegendText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 10.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  hourlyScrollRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 8,
  },
  hourPill: {
    minWidth: 74,
    paddingVertical: 10,
    paddingHorizontal: 9,
    borderRadius: 16,
    borderWidth: 1.25,
    alignItems: 'center',
    gap: 5,
  },
  hourTimeText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  hourDateSubText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 10,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  hourRainPct: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 10.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  hourTempText: {
    fontFamily: FONT_FAMILY_DISPLAY,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  rightPedestalCol: {
    flex: 0.92,
    minWidth: 0,
  },
  rightPedestalColDesktop: {
    minWidth: 348,
  },
  rightPedestalInner: {
    flex: 1,
    borderRadius: 23,
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  pedestalTopBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  pedestalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  pedestalBadgeText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '700',
  },
  vrmIconCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vrmIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  characterShowcaseStage: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
});

/* Lucian UX/UI Prompt #095 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#095 */
/* Lucian UX/UI Prompt #227 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#227 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  evaluateCharacterDecision,
  PRESET_CITIES,
  type CharacterDecision,
  type Gender,
  type HourlyForecastPoint,
  type PresetCity,
  type ThermalSensitivity,
  type WeatherProviderType,
  type WeatherSnapshot,
} from '../core';
import {
  fetchWeatherWithBackendFallback,
  resolveBackendBaseUrl,
} from '../hooks/useWeatherBuddy';
import {
  LucianLiveSortableTable,
  LucianMorphingForecastChart,
  useResolvedLucianDark,
  type LucianSortableRow,
} from '../lucian/LucianHubComponents';
import {
  FONT_FAMILY_DISPLAY,
  FONT_FAMILY_SANS,
  sanitizeCopy,
  WEB_NO_OUTLINE,
  type AtmosphericPalette,
} from '../components/themeTokens';

interface WebDashboardScreenProps {
  palette: AtmosphericPalette;
  weather: WeatherSnapshot;
  decision: CharacterDecision;
  gender: Gender;
  sensitivity: ThermalSensitivity;
  selectedCityId: string;
  onSelectPresetCity: (cityId: string) => void;
  onRequestGps: () => void;
  gpsLoading: boolean;
  providerPref: WeatherProviderType;
  tomorrowIoApiKey: string;
  weatherApiKey: string;
  googleApiKey: string;
}

interface ServerHealthSummary {
  uptimeSec: number;
  refreshIntervalMinutes: number;
  totalRequests: number;
  cacheHits: number;
  cacheHitRatePct: number;
}

interface TelemetryEntry {
  id: string;
  timestampIso: string;
  locationName: string;
  latitude: number;
  longitude: number;
  providerUsed: string;
  cacheHit: boolean;
  latencyMs: number;
  temperatureC: number;
  feelsLikeC: number;
  precipProbPct: number;
  uvIndex: number;
  aqi?: number;
}

interface Analytics24hPayload {
  tempMinC: number;
  tempMaxC: number;
  tempAvgC: number;
  maxPrecipProbPct: number;
  totalPrecipMm: number;
  rainHoursCount: number;
  peakRainHourIso: string | null;
  comfortIndexVi: string;
  hourlySeries: HourlyForecastPoint[];
}

interface DashboardOverviewResponse {
  serverHealth?: ServerHealthSummary;
  analytics24h?: Analytics24hPayload;
  recentTelemetry?: TelemetryEntry[];
}

interface SecurityStatusResponse {
  rateLimitActive?: boolean;
  csrfProtected?: boolean;
  keyRedaction?: boolean;
  headersHardened?: boolean;
  loopbackGuardOnLaunch?: boolean;
}

interface CityComparisonRow {
  city: PresetCity;
  snapshot: WeatherSnapshot | null;
  decision: CharacterDecision | null;
}

function formatHourShort(iso: string | null | undefined, index: number): string {
  if (!iso) {
    return `+${index + 1}h`;
  }
  const hasExplicitTz = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso.trim());
  if (!hasExplicitTz) {
    const match = iso.match(/T(\d{2}):(\d{2})/);
    if (match) {
      return `${match[1]}:00`;
    }
  }
  const parsed = new Date(iso);
  if (!Number.isNaN(parsed.getTime())) {
    return `${String(parsed.getHours()).padStart(2, '0')}:00`;
  }
  return `+${index + 1}h`;
}

function formatTimeClock(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return '--:--:--';
  }
  const hh = String(parsed.getHours()).padStart(2, '0');
  const mm = String(parsed.getMinutes()).padStart(2, '0');
  const ss = String(parsed.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function computeClientAnalytics24h(weather: WeatherSnapshot): Analytics24hPayload {
  const series = (weather.hourly ?? []).slice(0, 24);
  if (series.length === 0) {
    const rounded = Math.round(weather.temperatureC);
    return {
      tempMinC: rounded,
      tempMaxC: rounded,
      tempAvgC: rounded,
      maxPrecipProbPct: Math.round(weather.precipProbPct),
      totalPrecipMm: Number((weather.precipMmPerHr || 0).toFixed(1)),
      rainHoursCount: weather.precipProbPct >= 45 ? 1 : 0,
      peakRainHourIso: null,
      comfortIndexVi:
        weather.feelsLikeC >= 33
          ? 'Oi nóng'
          : weather.feelsLikeC < 18
            ? 'Se lạnh'
            : 'Dễ chịu',
      hourlySeries: [],
    };
  }

  const temps = series.map((h) => h.temperatureC);
  const tempMinC = Math.round(Math.min(...temps));
  const tempMaxC = Math.round(Math.max(...temps));
  const tempAvgC = Number(
    (temps.reduce((acc, t) => acc + t, 0) / temps.length).toFixed(1)
  );

  let maxPrecipProbPct = 0;
  let totalPrecipMm = 0;
  let rainHoursCount = 0;
  let peakRainHourIso: string | null = null;

  for (const pt of series) {
    const prob = Math.round(pt.precipProbPct || 0);
    const mm = Number(pt.precipMm || 0);
    totalPrecipMm += mm;
    if (prob >= 45 || mm >= 0.3) {
      rainHoursCount += 1;
    }
    if (prob > maxPrecipProbPct) {
      maxPrecipProbPct = prob;
      peakRainHourIso = pt.timeIso;
    }
  }

  const comfortIndexVi =
    tempMaxC >= 34
      ? 'Oi nóng'
      : tempMinC < 16
        ? 'Rét'
        : tempMinC < 21
          ? 'Se lạnh'
          : 'Dễ chịu';

  return {
    tempMinC,
    tempMaxC,
    tempAvgC,
    maxPrecipProbPct,
    totalPrecipMm: Number(totalPrecipMm.toFixed(1)),
    rainHoursCount,
    peakRainHourIso,
    comfortIndexVi,
    hourlySeries: series,
  };
}

export const WebDashboardScreen: React.FC<WebDashboardScreenProps> = ({
  palette,
  weather,
  decision,
  gender,
  sensitivity,
  selectedCityId,
  onSelectPresetCity,
  onRequestGps,
  gpsLoading,
  providerPref,
  tomorrowIoApiKey,
  weatherApiKey,
  googleApiKey,
}) => {
  const { width } = useWindowDimensions();
  const isTwoColTables = width >= 960;
  const isNarrowMobile = width < 440;
  const isDark = useResolvedLucianDark(palette);

  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [loadingOverview, setLoadingOverview] = useState<boolean>(false);
  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(null);
  const [securityStatus, setSecurityStatus] =
    useState<SecurityStatusResponse | null>(null);
  const [selectedHourIdx, setSelectedHourIdx] = useState<number>(0);
  const [telemetryPaused, setTelemetryPaused] = useState<boolean>(false);
  const [cityRows, setCityRows] = useState<CityComparisonRow[]>(() =>
    PRESET_CITIES.map((city) => ({ city, snapshot: null, decision: null }))
  );
  const [loadingCities, setLoadingCities] = useState<boolean>(false);

  const clientAnalytics = useMemo(
    () => computeClientAnalytics24h(weather),
    [weather]
  );

  const analytics = overview?.analytics24h?.hourlySeries?.length
    ? overview.analytics24h
    : clientAnalytics;

  const chartSeries: HourlyForecastPoint[] = useMemo(() => {
    const raw =
      analytics.hourlySeries && analytics.hourlySeries.length > 0
        ? analytics.hourlySeries
        : weather.hourly ?? [];
    return raw.slice(0, 16);
  }, [analytics, weather.hourly]);

  const fetchBackendOverview = useCallback(async () => {
    if (telemetryPaused) {
      return;
    }
    setLoadingOverview(true);
    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), 3500)
      : null;

    try {
      const base = resolveBackendBaseUrl();
      const qs = new URLSearchParams({
        lat: String(weather.latitude),
        lon: String(weather.longitude),
        locationName: weather.locationName,
      });
      const [res, secRes] = await Promise.all([
        fetch(`${base}/api/dashboard/overview?${qs.toString()}`, {
          signal: controller ? controller.signal : undefined,
        }),
        fetch(`${base}/api/security/status`, {
          signal: controller ? controller.signal : undefined,
        }).catch(() => null),
      ]);
      if (res.ok) {
        const data = (await res.json()) as DashboardOverviewResponse;
        setOverview(data);
        setBackendOnline(true);
        if (secRes && secRes.ok) {
          const secData = (await secRes.json()) as SecurityStatusResponse;
          setSecurityStatus(secData);
        }
      } else {
        setBackendOnline(false);
      }
    } catch {
      setBackendOnline(false);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
      setLoadingOverview(false);
    }
  }, [weather.latitude, weather.longitude, weather.locationName, telemetryPaused]);

  const fetchMultiCityComparison = useCallback(async () => {
    setLoadingCities(true);
    try {
      const results = await Promise.all(
        PRESET_CITIES.map(async (city): Promise<CityComparisonRow> => {
          try {
            const snap = await fetchWeatherWithBackendFallback({
              latitude: city.latitude,
              longitude: city.longitude,
              locationName: city.nameVi,
              provider: providerPref,
              tomorrowIoApiKey,
              weatherApiKey,
              googleApiKey,
            });
            const dec = evaluateCharacterDecision(snap, { gender, sensitivity });
            return { city, snapshot: snap, decision: dec };
          } catch {
            return { city, snapshot: null, decision: null };
          }
        })
      );
      setCityRows(results);
    } finally {
      setLoadingCities(false);
    }
  }, [
    providerPref,
    tomorrowIoApiKey,
    weatherApiKey,
    googleApiKey,
    gender,
    sensitivity,
  ]);

  useEffect(() => {
    fetchBackendOverview();
  }, [fetchBackendOverview]);

  useEffect(() => {
    fetchMultiCityComparison();
  }, [fetchMultiCityComparison]);

  const activeHourPoint: HourlyForecastPoint | null =
    chartSeries[selectedHourIdx] ?? chartSeries[0] ?? null;

  const citySortableRows: ReadonlyArray<LucianSortableRow> = useMemo(
    () =>
      cityRows.map(({ city, snapshot, decision: cityDec }, idx) => {
        const tempRounded = snapshot ? Math.round(snapshot.temperatureC) : -99;
        const rainPct = snapshot ? Math.round(snapshot.precipProbPct) : 0;
        const humPct = snapshot ? Math.round(snapshot.humidityPct) : 0;
        const statusColor = !snapshot
          ? '#94A3B8'
          : rainPct >= 50
            ? '#38BDF8'
            : tempRounded >= 33
              ? '#F97316'
              : tempRounded < 18
                ? '#60A5FA'
                : '#10B981';

        return {
          id: city.id,
          primaryText: city.nameVi,
          secondaryText: snapshot
            ? `${city.regionVi} · Ẩm ${humPct}% · Mưa ${rainPct}%`
            : `${city.regionVi} · Đang tải...`,
          metricDisplay: snapshot ? `${tempRounded}°C` : '--°C',
          metricNumeric: snapshot ? snapshot.temperatureC : -99,
          sortTimeOrOrder: idx + 1,
          statusText: cityDec
            ? sanitizeCopy(cityDec.headlineVi)
            : 'Đang đồng bộ',
          statusColor,
          isSelected: selectedCityId === city.id,
        };
      }),
    [cityRows, selectedCityId]
  );

  const backendSortableRows: ReadonlyArray<LucianSortableRow> = useMemo(() => {
    const logs = overview?.recentTelemetry ?? [];
    if (backendOnline && logs.length > 0) {
      return logs.slice(0, 6).map((entry, idx) => ({
        id: entry.id || `log_${idx}`,
        primaryText: `${entry.locationName} (${Math.round(entry.temperatureC)}°C)`,
        secondaryText: `${formatTimeClock(entry.timestampIso)} · ${entry.providerUsed}`,
        metricDisplay: entry.cacheHit ? '0 ms' : `${entry.latencyMs} ms`,
        metricNumeric: entry.cacheHit ? 0 : entry.latencyMs,
        sortTimeOrOrder: Date.parse(entry.timestampIso) || idx,
        statusText: entry.cacheHit ? 'CACHE HIT 15p' : 'UPSTREAM LIVE',
        statusColor: entry.cacheHit ? '#10B981' : '#38BDF8',
      }));
    }

    return [
      {
        id: 'sec_zero_keys',
        primaryText: 'Zero Hardcoded Keys',
        secondaryText: 'Khóa API cá nhân mặc định trống 100%',
        metricDisplay: '0 Key',
        metricNumeric: 1,
        sortTimeOrOrder: 1,
        statusText: securityStatus?.keyRedaction !== false ? 'SHA-256 Redact' : 'Bảo vệ',
        statusColor: '#10B981',
      },
      {
        id: 'sec_csrf',
        primaryText: 'CSRF & Origin Guard',
        secondaryText: 'X-WeatherBuddy-Client + Loopback Check',
        metricDisplay: backendOnline ? '200 OK' : 'Client',
        metricNumeric: 2,
        sortTimeOrOrder: 2,
        statusText: securityStatus?.csrfProtected ? 'Đang bật :8787' : 'Sẵn sàng',
        statusColor: '#10B981',
      },
      {
        id: 'sec_ratelimit',
        primaryText: 'Rate Limit & Body Cap',
        secondaryText: 'Giới hạn 16KB POST & chống spam IP',
        metricDisplay: '16 KB',
        metricNumeric: 16,
        sortTimeOrOrder: 3,
        statusText: securityStatus?.rateLimitActive ? 'Đang bảo vệ' : 'Tiêu chuẩn',
        statusColor: '#0EA5E9',
      },
      {
        id: 'sec_cache',
        primaryText: 'Bộ đệm Khí tượng 15 phút',
        secondaryText: backendOnline
          ? `${overview?.serverHealth?.totalRequests ?? 0} yêu cầu · Uptime ${
              overview?.serverHealth?.uptimeSec ?? 0
            }s`
          : 'Đồng bộ trực tiếp Open-Meteo Free',
        metricDisplay: backendOnline
          ? `${overview?.serverHealth?.cacheHitRatePct ?? 0}%`
          : '15 phút',
        metricNumeric: overview?.serverHealth?.cacheHitRatePct ?? 15,
        sortTimeOrOrder: 4,
        statusText: backendOnline ? 'Backend :8787' : 'Trình duyệt',
        statusColor: backendOnline ? '#10B981' : '#38BDF8',
      },
      {
        id: 'sec_headers',
        primaryText: 'CSP & Nosniff Headers',
        secondaryText: "object-src 'none' · frame-ancestors 'none'",
        metricDisplay: 'A+ Sec',
        metricNumeric: 99,
        sortTimeOrOrder: 5,
        statusText: securityStatus?.headersHardened !== false ? 'Đã khóa cứng' : 'Chuẩn',
        statusColor: '#10B981',
      },
    ];
  }, [backendOnline, overview, securityStatus]);

  return (
    <View style={styles.dashboardStack}>
      {/* Section 1: Backend Server & 15-Minute Sync Telemetry Header + 4 KPI Cards */}
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
            <View style={styles.headerTitleCol}>
              <View style={styles.statusPillRow}>
                <View
                  style={[
                    styles.backendStatusPill,
                    {
                      backgroundColor: backendOnline
                        ? 'rgba(16, 185, 129, 0.16)'
                        : palette.accentSoftBg,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: backendOnline
                          ? '#10B981'
                          : palette.accent,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.backendStatusText,
                      {
                        color: backendOnline ? '#10B981' : palette.accent,
                      },
                    ]}
                  >
                    {backendOnline
                      ? 'Backend API Online · Port 8787'
                      : 'Chế độ Trực tiếp Trình duyệt'}
                  </Text>
                </View>

                <View
                  style={[
                    styles.coordPill,
                    {
                      backgroundColor: palette.pillIdleBg,
                      borderColor: palette.bezelOuterBorder,
                    },
                  ]}
                >
                  <Feather name="compass" size={11} color={palette.inkSecondary} />
                  <Text
                    style={[styles.coordPillText, { color: palette.inkSecondary }]}
                  >
                    {weather.latitude.toFixed(4)}, {weather.longitude.toFixed(4)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.coordPill,
                    {
                      backgroundColor: palette.pillIdleBg,
                      borderColor: palette.bezelOuterBorder,
                    },
                  ]}
                >
                  <Feather name="shield" size={11} color={palette.accent} />
                  <Text
                    style={[styles.coordPillText, { color: palette.inkPrimary }]}
                  >
                    {backendOnline && securityStatus?.csrfProtected
                      ? 'CSRF · Rate Limit · SHA-256 Redaction'
                      : 'Bảo mật: 0 lưu khóa API trên Server'}
                  </Text>
                </View>
              </View>

              <Text style={[styles.dashboardTitle, { color: palette.inkPrimary }]}>
                Bảng điều khiển Khí tượng · {weather.locationName}
              </Text>
              <Text style={[styles.dashboardSub, { color: palette.inkSecondary }]}>
                {backendOnline
                  ? `Máy chủ bộ đệm 15 phút đang hoạt động · Tỷ lệ Cache Hit ${
                      overview?.serverHealth?.cacheHitRatePct ?? 0
                    }% (${overview?.serverHealth?.totalRequests ?? 0} yêu cầu)`
                  : 'Phân tích trực tiếp 24 giờ trên trình duyệt · Tự động kết nối cổng 8787 khi chạy máy chủ'}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Làm mới dữ liệu Dashboard"
              onPress={() => {
                setTelemetryPaused(false);
                fetchBackendOverview();
                fetchMultiCityComparison();
              }}
              style={({ pressed }) => [
                styles.refreshDashBtn,
                WEB_NO_OUTLINE,
                {
                  backgroundColor: palette.pillActiveBg,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              {loadingOverview || loadingCities ? (
                <ActivityIndicator size="small" color={palette.pillActiveInk} />
              ) : (
                <Feather
                  name="refresh-cw"
                  size={13}
                  color={palette.pillActiveInk}
                />
              )}
              <Text
                style={[
                  styles.refreshDashBtnText,
                  { color: palette.pillActiveInk },
                ]}
              >
                Làm mới
              </Text>
            </Pressable>
          </View>

          {/* 4 KPI Summary Bento Cards */}
          <View style={styles.kpiRow}>
            <View
              style={[
                styles.kpiCard,
                {
                  backgroundColor: palette.coreSurfaceBg,
                  borderColor: palette.hairline,
                },
              ]}
            >
              <Text style={[styles.kpiLabel, { color: palette.inkSecondary }]}>
                Biên độ 24h
              </Text>
              <Text style={[styles.kpiValue, { color: palette.inkPrimary }]}>
                {analytics.tempMinC}° - {analytics.tempMaxC}°C
              </Text>
              <Text style={[styles.kpiSub, { color: palette.inkMuted }]}>
                Trung bình {analytics.tempAvgC}°C
              </Text>
            </View>

            <View
              style={[
                styles.kpiCard,
                {
                  backgroundColor: palette.coreSurfaceBg,
                  borderColor: palette.hairline,
                },
              ]}
            >
              <Text style={[styles.kpiLabel, { color: palette.inkSecondary }]}>
                Xác suất mưa đỉnh
              </Text>
              <Text style={[styles.kpiValue, { color: palette.inkPrimary }]}>
                {analytics.maxPrecipProbPct}%
              </Text>
              <Text style={[styles.kpiSub, { color: palette.inkMuted }]}>
                {analytics.peakRainHourIso
                  ? `Đỉnh lúc ${formatHourShort(analytics.peakRainHourIso, 0)}`
                  : 'Trời tạnh ráo'}
              </Text>
            </View>

            <View
              style={[
                styles.kpiCard,
                {
                  backgroundColor: palette.coreSurfaceBg,
                  borderColor: palette.hairline,
                },
              ]}
            >
              <Text style={[styles.kpiLabel, { color: palette.inkSecondary }]}>
                Tổng lượng mưa
              </Text>
              <Text style={[styles.kpiValue, { color: palette.inkPrimary }]}>
                {analytics.totalPrecipMm} mm
              </Text>
              <Text style={[styles.kpiSub, { color: palette.inkMuted }]}>
                {analytics.rainHoursCount} khung giờ có mưa
              </Text>
            </View>

            <View
              style={[
                styles.kpiCard,
                {
                  backgroundColor: palette.coreSurfaceBg,
                  borderColor: palette.hairline,
                },
              ]}
            >
              <Text style={[styles.kpiLabel, { color: palette.inkSecondary }]}>
                Trạng thái gợi ý
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.kpiValueSmall, { color: palette.accent }]}
              >
                {sanitizeCopy(decision.headlineVi)}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.kpiSub, { color: palette.inkMuted }]}
              >
                {sanitizeCopy(decision.outfitAdviceVi)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Section 2: Lucian #095 Morphing Bar Chart (Temperature / Rain % / Feels-Like) */}
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
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleCluster}>
              <Feather name="bar-chart-2" size={15} color={palette.accent} />
              <Text style={[styles.sectionTitle, { color: palette.inkPrimary }]}>
                Phân tích Biến thiên Nhiệt độ, Mưa & Cảm giác theo giờ
              </Text>
            </View>

            {activeHourPoint && (
              <View
                style={[
                  styles.selectedHourBadge,
                  { backgroundColor: palette.accentSoftBg },
                ]}
              >
                <Text
                  style={[styles.selectedHourBadgeText, { color: palette.accent }]}
                >
                  {formatHourShort(activeHourPoint.timeIso, selectedHourIdx)} ·{' '}
                  {Math.round(activeHourPoint.temperatureC)}°C · Mưa{' '}
                  {Math.round(activeHourPoint.precipProbPct)}%
                </Text>
              </View>
            )}
          </View>

          <LucianMorphingForecastChart
            series={chartSeries}
            currentFeelsLikeC={weather.feelsLikeC}
            selectedHourIdx={selectedHourIdx}
            onSelectHour={setSelectedHourIdx}
            isDark={isDark}
          />
        </View>
      </View>

      {/* Section 3: Dual Lucian #227 Sortable Live Tables (6 Vietnam Cities + Backend :8787 Telemetry & Security) */}
      <View
        style={[
          styles.tablesSplitGrid,
          isTwoColTables ? styles.tablesRowDesktop : styles.tablesColMobile,
        ]}
      >
        <View style={styles.tableHalfCol}>
          <LucianLiveSortableTable
            title="So sánh 6 Thành phố Việt Nam"
            col0Label="Thành phố"
            col1Label="Nhiệt độ"
            col2Label="Trạng thái"
            rows={citySortableRows}
            actionButtonLabel={
              gpsLoading ? 'Đang định vị...' : '📍 GPS của tôi'
            }
            onPressActionButton={onRequestGps}
            onSelectRow={onSelectPresetCity}
            isDark={isDark}
          />
        </View>

        <View style={styles.tableHalfCol}>
          <LucianLiveSortableTable
            title={
              backendOnline && (overview?.recentTelemetry?.length ?? 0) > 0
                ? 'Nhật ký Đồng bộ Backend :8787'
                : 'Hạ tầng Bảo mật & Bộ đệm :8787'
            }
            col0Label={
              backendOnline && (overview?.recentTelemetry?.length ?? 0) > 0
                ? 'Điểm đo & Nguồn'
                : 'Lớp bảo vệ'
            }
            col1Label={
              backendOnline && (overview?.recentTelemetry?.length ?? 0) > 0
                ? 'Độ trễ'
                : 'Thông số'
            }
            col2Label="Trạng thái"
            rows={backendSortableRows}
            actionButtonLabel={telemetryPaused ? 'Tiếp tục' : 'Tạm dừng'}
            onPressActionButton={() => setTelemetryPaused((p) => !p)}
            paused={telemetryPaused}
            isDark={isDark}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dashboardStack: {
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
    flexWrap: 'wrap',
    gap: 12,
  },
  headerTitleCol: {
    flex: 1,
    minWidth: 210,
    gap: 6,
  },
  statusPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  backendStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  backendStatusText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '700',
  },
  coordPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  coordPillText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  dashboardTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  dashboardSub: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13,
    lineHeight: 19,
  },
  refreshDashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 999,
  },
  refreshDashBtnText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '700',
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    minWidth: 145,
    borderRadius: 18,
    borderWidth: 1,
    padding: 13,
    gap: 4,
  },
  kpiLabel: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '600',
  },
  kpiValue: {
    fontFamily: FONT_FAMILY_DISPLAY,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  kpiValueSmall: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 15.5,
    lineHeight: 21,
    fontWeight: '700',
  },
  kpiSub: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  sectionTitleCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    flexShrink: 1,
  },
  sectionTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  selectedHourBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  selectedHourBadgeText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  tablesSplitGrid: {
    width: '100%',
    minWidth: 0,
    gap: 18,
  },
  tablesRowDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tablesColMobile: {
    flexDirection: 'column',
  },
  tableHalfCol: {
    flex: 1,
    width: '100%',
    minWidth: 0,
  },
});

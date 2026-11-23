import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
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
  const isWide = width >= 900;

  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [loadingOverview, setLoadingOverview] = useState<boolean>(false);
  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(null);
  const [securityStatus, setSecurityStatus] =
    useState<SecurityStatusResponse | null>(null);
  const [selectedHourIdx, setSelectedHourIdx] = useState<number>(0);
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
  }, [weather.latitude, weather.longitude, weather.locationName]);

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

  const { minChartTemp, maxChartTemp } = useMemo(() => {
    if (chartSeries.length === 0) {
      return { minChartTemp: 20, maxChartTemp: 32 };
    }
    const vals = chartSeries.map((c) => c.temperatureC);
    return {
      minChartTemp: Math.min(...vals),
      maxChartTemp: Math.max(...vals),
    };
  }, [chartSeries]);

  return (
    <View style={styles.dashboardStack}>
      {/* Section 1: Backend Server & 15-Minute Sync Telemetry Header */}
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
                      ? 'Bảo mật: CSRF · Rate Limit · SHA-256 Redaction'
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
                  : 'Phân tích trực tiếp 24 giờ trên trình duyệt · Chạy "npm run server" để bật Backend API cổng 8787'}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Làm mới dữ liệu Dashboard"
              onPress={() => {
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

          {/* 6 KPI Summary Cards */}
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

      {/* Section 2: 24-Hour Interactive Temperature & Rain Probability Chart */}
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
            { backgroundColor: palette.coreSurfaceBg },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleCluster}>
              <Feather name="trending-up" size={15} color={palette.accent} />
              <Text style={[styles.sectionTitle, { color: palette.inkPrimary }]}>
                Biểu đồ Nhiệt độ & Xác suất mưa theo giờ
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
                  {Math.round(activeHourPoint.precipProbPct)}% (
                  {Number(activeHourPoint.precipMm || 0).toFixed(1)} mm)
                </Text>
              </View>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chartColumnsRow}
          >
            {chartSeries.map((pt, idx) => {
              const isSelected = idx === selectedHourIdx;
              const tempSpan = Math.max(1, maxChartTemp - minChartTemp);
              const normalizedTemp =
                (pt.temperatureC - minChartTemp) / tempSpan;
              const tempBarHeight = Math.round(28 + normalizedTemp * 54);
              const rainPct = Math.max(
                0,
                Math.min(100, Math.round(pt.precipProbPct || 0))
              );
              const rainBarHeight = Math.max(4, Math.round((rainPct / 100) * 52));

              return (
                <Pressable
                  key={`${pt.timeIso}_${idx}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setSelectedHourIdx(idx)}
                  style={({ pressed }) => [
                    styles.chartColBtn,
                    WEB_NO_OUTLINE,
                    isSelected && {
                      backgroundColor: palette.coreElevatedBg,
                      borderColor: palette.bezelOuterBorder,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text
                    style={[
                      styles.chartTempTop,
                      {
                        color: isSelected
                          ? palette.accent
                          : palette.inkPrimary,
                      },
                    ]}
                  >
                    {Math.round(pt.temperatureC)}°
                  </Text>

                  <View style={styles.dualBarTrack}>
                    {/* Temperature vertical column */}
                    <View
                      style={[
                        styles.tempColumnFill,
                        {
                          height: tempBarHeight,
                          backgroundColor: isSelected
                            ? palette.accent
                            : palette.isDark
                              ? 'rgba(147, 197, 253, 0.48)'
                              : 'rgba(24, 90, 219, 0.34)',
                        },
                      ]}
                    />

                    {/* Rain probability vertical bar */}
                    <View
                      style={[
                        styles.rainColumnFill,
                        {
                          height: rainBarHeight,
                          backgroundColor:
                            rainPct >= 45
                              ? '#38BDF8'
                              : palette.isDark
                                ? 'rgba(148, 163, 184, 0.25)'
                                : 'rgba(100, 116, 139, 0.22)',
                        },
                      ]}
                    />
                  </View>

                  <Text
                    style={[
                      styles.chartRainLabel,
                      {
                        color:
                          rainPct >= 30
                            ? palette.accent
                            : palette.inkMuted,
                      },
                    ]}
                  >
                    {rainPct}%
                  </Text>

                  <Text
                    style={[
                      styles.chartHourLabel,
                      {
                        color: isSelected
                          ? palette.inkPrimary
                          : palette.inkSecondary,
                        fontWeight: isSelected ? '700' : '600',
                      },
                    ]}
                  >
                    {formatHourShort(pt.timeIso, idx)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Section 3: Multi-City Vietnam Live Comparison Grid + 1-Tap GPS */}
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
            { backgroundColor: palette.coreSurfaceBg },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleCluster}>
              <Feather name="map" size={15} color={palette.accent} />
              <Text style={[styles.sectionTitle, { color: palette.inkPrimary }]}>
                So sánh Thời tiết 6 Thành phố Việt Nam & GPS
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={onRequestGps}
              style={({ pressed }) => [
                styles.gpsCompareBtn,
                WEB_NO_OUTLINE,
                {
                  backgroundColor:
                    selectedCityId === 'gps'
                      ? palette.pillActiveBg
                      : palette.accentSoftBg,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <Feather
                name="crosshair"
                size={12}
                color={
                  selectedCityId === 'gps'
                    ? palette.pillActiveInk
                    : palette.accent
                }
              />
              <Text
                style={[
                  styles.gpsCompareBtnText,
                  {
                    color:
                      selectedCityId === 'gps'
                        ? palette.pillActiveInk
                        : palette.accent,
                  },
                ]}
              >
                {gpsLoading ? 'Đang định vị...' : 'Định vị GPS của tôi'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.citiesComparisonGrid}>
            {cityRows.map(({ city, snapshot, decision: cityDec }) => {
              const isCurrent = selectedCityId === city.id;
              return (
                <Pressable
                  key={city.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isCurrent }}
                  onPress={() => onSelectPresetCity(city.id)}
                  style={({ pressed }) => [
                    styles.cityCompareCard,
                    WEB_NO_OUTLINE,
                    {
                      width: isWide ? '31.8%' : '48%',
                      backgroundColor: isCurrent
                        ? palette.coreElevatedBg
                        : palette.bezelOuterBg,
                      borderColor: isCurrent
                        ? palette.accent
                        : palette.bezelOuterBorder,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                >
                  <View style={styles.cityCompareTop}>
                    <View>
                      <Text
                        style={[
                          styles.cityCompareName,
                          { color: palette.inkPrimary },
                        ]}
                      >
                        {city.nameVi}
                      </Text>
                      <Text
                        style={[
                          styles.cityCompareRegion,
                          { color: palette.inkMuted },
                        ]}
                      >
                        {city.regionVi}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.cityCompareTemp,
                        { color: palette.inkPrimary },
                      ]}
                    >
                      {snapshot ? `${Math.round(snapshot.temperatureC)}°` : '--°'}
                    </Text>
                  </View>

                  <View style={styles.cityCompareBottom}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.cityCompareBadge,
                        { color: palette.accent },
                      ]}
                    >
                      {cityDec
                        ? sanitizeCopy(cityDec.badgeVi)
                        : 'Đang đồng bộ...'}
                    </Text>
                    {snapshot && (
                      <Text
                        style={[
                          styles.cityCompareMeta,
                          { color: palette.inkSecondary },
                        ]}
                      >
                        Ẩm {Math.round(snapshot.humidityPct)}% · Mưa{' '}
                        {Math.round(snapshot.precipProbPct)}%
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* Section 4: Backend 15-Minute Sync Telemetry Log (When Backend Port 8787 is Active) */}
      {backendOnline &&
        overview?.recentTelemetry &&
        overview.recentTelemetry.length > 0 && (
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
                { backgroundColor: palette.coreSurfaceBg },
              ]}
            >
              <View style={styles.sectionTitleCluster}>
                <Feather name="server" size={15} color={palette.accent} />
                <Text
                  style={[styles.sectionTitle, { color: palette.inkPrimary }]}
                >
                  Nhật ký Đồng bộ Backend (Bộ đệm 15 phút)
                </Text>
              </View>

              <View style={styles.telemetryList}>
                {overview.recentTelemetry.slice(0, 6).map((entry) => (
                  <View
                    key={entry.id}
                    style={[
                      styles.telemetryRow,
                      { borderBottomColor: palette.hairline },
                    ]}
                  >
                    <Text
                      style={[
                        styles.telemetryTime,
                        { color: palette.inkMuted },
                      ]}
                    >
                      {formatTimeClock(entry.timestampIso)}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.telemetryCity,
                        { color: palette.inkPrimary },
                      ]}
                    >
                      {entry.locationName} ({Math.round(entry.temperatureC)}°C)
                    </Text>
                    <Text
                      style={[
                        styles.telemetryMeta,
                        {
                          color: entry.cacheHit
                            ? '#10B981'
                            : palette.inkSecondary,
                        },
                      ]}
                    >
                      {entry.providerUsed} ·{' '}
                      {entry.cacheHit ? 'CACHE HIT' : `${entry.latencyMs}ms`}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
    </View>
  );
};

const styles = StyleSheet.create({
  dashboardStack: {
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
    flexWrap: 'wrap',
    gap: 12,
  },
  headerTitleCol: {
    flex: 1,
    minWidth: 240,
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
    minWidth: 170,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  kpiLabel: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '600',
  },
  kpiValue: {
    fontFamily: FONT_FAMILY_DISPLAY,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  kpiValueSmall: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  kpiSub: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
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
  },
  sectionTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 15,
    fontWeight: '700',
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
  chartColumnsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingVertical: 4,
    paddingRight: 8,
  },
  chartColBtn: {
    minWidth: 56,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    gap: 7,
  },
  chartTempTop: {
    fontFamily: FONT_FAMILY_DISPLAY,
    fontSize: 14.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  dualBarTrack: {
    height: 86,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  tempColumnFill: {
    width: 11,
    borderRadius: 6,
  },
  rainColumnFill: {
    width: 7,
    borderRadius: 4,
  },
  chartRainLabel: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  chartHourLabel: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    fontVariant: ['tabular-nums'],
  },
  gpsCompareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
  },
  gpsCompareBtnText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '700',
  },
  citiesComparisonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cityCompareCard: {
    flexGrow: 1,
    minWidth: 210,
    borderRadius: 18,
    borderWidth: 1,
    padding: 15,
    gap: 10,
  },
  cityCompareTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  cityCompareName: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 15,
    fontWeight: '700',
  },
  cityCompareRegion: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '500',
  },
  cityCompareTemp: {
    fontFamily: FONT_FAMILY_DISPLAY,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  cityCompareBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  cityCompareBadge: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '700',
  },
  cityCompareMeta: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  telemetryList: {
    gap: 6,
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 10,
  },
  telemetryTime: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  telemetryCity: {
    flex: 1,
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13,
    fontWeight: '600',
  },
  telemetryMeta: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});

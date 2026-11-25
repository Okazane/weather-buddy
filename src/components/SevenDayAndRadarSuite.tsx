import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  computeSolarAndMoonCycle,
  type DailyForecastPoint,
  type WeatherSnapshot,
} from '../core';
import {
  Compass,
  Drop,
  MoonStars,
  SunHorizon,
  WeatherIcon,
} from './AppIcons';
import {
  FONT_FAMILY_DISPLAY,
  FONT_FAMILY_SANS,
  WEB_NO_OUTLINE,
  type AtmosphericPalette,
} from './themeTokens';

interface SevenDayAndRadarSuiteProps {
  palette: AtmosphericPalette;
  weather: WeatherSnapshot;
  reduceMotion?: boolean;
}

interface RainViewerFrame {
  time: number;
  path: string;
  isForecast?: boolean;
}

const WEEKDAY_SHORT_VI = [
  'CN',
  'Thứ 2',
  'Thứ 3',
  'Thứ 4',
  'Thứ 5',
  'Thứ 6',
  'Thứ 7',
];

function formatDailyRowLabel(dateIso: string, index: number): { dayVi: string; ddMm: string } {
  const m = dateIso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    return {
      dayVi: index === 0 ? 'Hôm nay' : index === 1 ? 'Ngày mai' : `Ngày +${index}`,
      ddMm: '',
    };
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const ddMm = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
  if (index === 0) return { dayVi: 'Hôm nay', ddMm };
  if (index === 1) return { dayVi: 'Ngày mai', ddMm };
  return { dayVi: WEEKDAY_SHORT_VI[dow] ?? 'Ngày tới', ddMm };
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function interpolateThermalColor(tempC: number, palette: AtmosphericPalette): string {
  const coolRgb = hexToRgb(palette.thermalCool);
  const mildRgb = hexToRgb(palette.thermalMild);
  const warmRgb = hexToRgb(palette.thermalWarm);
  const hotRgb = hexToRgb(palette.thermalHot);
  const softWarmRgb: [number, number, number] = palette.isDark
    ? [
        Math.min(255, Math.round(warmRgb[0] * 1.04)),
        Math.min(255, Math.round(warmRgb[1] * 1.12)),
        Math.min(255, Math.round(warmRgb[2] * 1.24)),
      ]
    : [
        Math.min(255, Math.round(warmRgb[0] * 1.04)),
        Math.min(255, Math.round(warmRgb[1] * 1.12)),
        Math.min(255, Math.round(warmRgb[2] * 1.38)),
      ];

  const stops: Array<{ t: number; rgb: [number, number, number] }> = [
    { t: 10, rgb: coolRgb },
    { t: 19, rgb: mildRgb },
    { t: 23, rgb: softWarmRgb },
    { t: 28, rgb: warmRgb },
    { t: 34, rgb: hotRgb },
  ];

  if (tempC <= stops[0].t) {
    const [r, g, b] = stops[0].rgb;
    return `rgb(${r}, ${g}, ${b})`;
  }
  const last = stops[stops.length - 1];
  if (tempC >= last.t) {
    const [r, g, b] = last.rgb;
    return `rgb(${r}, ${g}, ${b})`;
  }
  for (let i = 0; i < stops.length - 1; i += 1) {
    const a = stops[i];
    const b = stops[i + 1];
    if (tempC >= a.t && tempC <= b.t) {
      const f = (tempC - a.t) / Math.max(0.01, b.t - a.t);
      const r = Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * f);
      const g = Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * f);
      const bl = Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * f);
      return `rgb(${r}, ${g}, ${bl})`;
    }
  }
  return `rgb(${last.rgb[0]}, ${last.rgb[1]}, ${last.rgb[2]})`;
}

function buildThermalRangeGradientCss(
  minC: number,
  maxC: number,
  palette: AtmosphericPalette
): string {
  const c0 = interpolateThermalColor(minC, palette);
  const cMid = interpolateThermalColor((minC + maxC) / 2, palette);
  const c1 = interpolateThermalColor(maxC, palette);
  return `linear-gradient(90deg, ${c0} 0%, ${cMid} 52%, ${c1} 100%)`;
}

function latLonToTileFloat(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const safeLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const n = Math.pow(2, zoom);
  const x = ((lon + 180) / 360) * n;
  const latRad = (safeLat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

export const SevenDayAndRadarSuite: React.FC<SevenDayAndRadarSuiteProps> = React.memo(
  ({ palette, weather, reduceMotion = false }) => {
    const { width } = useWindowDimensions();
    const isDesktopSplit = width >= 1040;

    const solarMeta = useMemo(
      () =>
        computeSolarAndMoonCycle(
          weather.updatedAtIso,
          weather.latitude,
          weather.longitude,
          weather.utcOffsetSeconds
        ),
      [weather.updatedAtIso, weather.latitude, weather.longitude, weather.utcOffsetSeconds]
    );

    const sunriseLabel = weather.sunriseTimeVi ?? solarMeta.sunriseTimeVi;
    const sunsetLabel = weather.sunsetTimeVi ?? solarMeta.sunsetTimeVi;
    const moonLabel = weather.moonPhaseVi ?? solarMeta.moonPhaseVi;

    const dailyList: DailyForecastPoint[] = useMemo(() => {
      if (Array.isArray(weather.daily) && weather.daily.length > 0) {
        return weather.daily.slice(0, 7);
      }
      return [];
    }, [weather.daily]);

    const { weekMin, weekSpan } = useMemo(() => {
      if (dailyList.length === 0) {
        return { weekMin: 18, weekSpan: 12 };
      }
      const mins = dailyList.map((d) => d.tempMinC);
      const maxs = dailyList.map((d) => d.tempMaxC);
      const lo = Math.min(...mins);
      const hi = Math.max(...maxs);
      return { weekMin: lo, weekSpan: Math.max(2, hi - lo) };
    }, [dailyList]);

    // Live RainViewer Radar Frames
    const [radarHost, setRadarHost] = useState<string>('https://tilecache.rainviewer.com');
    const [radarFrames, setRadarFrames] = useState<RainViewerFrame[]>([]);
    const [frameIdx, setFrameIdx] = useState<number>(0);
    const [isPlayingRadar, setIsPlayingRadar] = useState<boolean>(false);
    const [zoom, setZoom] = useState<number>(7);

    useEffect(() => {
      if (Platform.OS !== 'web') return;
      let cancelled = false;

      fetch('https://api.rainviewer.com/public/weather-maps.json')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled || !data) return;
          const host =
            typeof data.host === 'string' && data.host
              ? data.host
              : 'https://tilecache.rainviewer.com';
          const past: RainViewerFrame[] = Array.isArray(data?.radar?.past)
            ? data.radar.past.slice(-6).map((f: any) => ({
                time: Number(f.time),
                path: String(f.path),
                isForecast: false,
              }))
            : [];
          const nowcast: RainViewerFrame[] = Array.isArray(data?.radar?.nowcast)
            ? data.radar.nowcast.slice(0, 2).map((f: any) => ({
                time: Number(f.time),
                path: String(f.path),
                isForecast: true,
              }))
            : [];
          const all = [...past, ...nowcast].filter((f) => f.time > 0 && f.path);
          setRadarHost(host);
          setRadarFrames(all);
          if (all.length > 0) {
            const latestPastIdx = Math.max(0, past.length - 1);
            setFrameIdx(latestPastIdx);
          }
        })
        .catch(() => {
          // Gracefully show base map when offline
        });

      return () => {
        cancelled = true;
      };
    }, []);

    useEffect(() => {
      if (!isPlayingRadar || reduceMotion || radarFrames.length <= 1) {
        return;
      }
      const timer = setInterval(() => {
        setFrameIdx((prev) => (prev + 1) % radarFrames.length);
      }, 900);
      return () => clearInterval(timer);
    }, [isPlayingRadar, reduceMotion, radarFrames.length]);

    const activeFrame = radarFrames[frameIdx] ?? null;

    const frameClockVi = useMemo(() => {
      if (!activeFrame) return 'Bản đồ nền trực tiếp';
      const offsetSec =
        typeof weather.utcOffsetSeconds === 'number' &&
        Number.isFinite(weather.utcOffsetSeconds)
          ? weather.utcOffsetSeconds
          : 7 * 3600;
      const d = new Date(activeFrame.time * 1000 + offsetSec * 1000);
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const mm = String(d.getUTCMinutes()).padStart(2, '0');
      return `${activeFrame.isForecast ? 'Dự báo radar' : 'Ảnh radar'} · ${hh}:${mm}`;
    }, [activeFrame, weather.utcOffsetSeconds]);

    const tileGrid = useMemo(() => {
      const n = Math.pow(2, zoom);
      const center = latLonToTileFloat(weather.latitude, weather.longitude, zoom);
      const cx = Math.floor(center.x);
      const cy = Math.floor(center.y);
      const fracX = center.x - cx;
      const fracY = center.y - cy;

      const tiles: Array<{
        key: string;
        dx: number;
        dy: number;
        baseUrl: string;
        radarUrl: string | null;
      }> = [];

      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const tx = ((cx + dx) % n + n) % n;
          const ty = Math.max(0, Math.min(n - 1, cy + dy));
          const baseUrl = `/api/map-tile?z=${zoom}&x=${tx}&y=${ty}`;
          const radarUrl = activeFrame
            ? `${radarHost}${activeFrame.path}/256/${zoom}/${tx}/${ty}/2/1_1.png`
            : null;
          tiles.push({
            key: `${zoom}_${tx}_${ty}_${dy}_${dx}`,
            dx,
            dy,
            baseUrl,
            radarUrl,
          });
        }
      }

      return { tiles, fracX, fracY };
    }, [weather.latitude, weather.longitude, zoom, palette.isDark, radarHost, activeFrame]);

    const warmGold = palette.thermalWarm;
    const warmAmber = palette.thermalHot;
    const rainCyan = palette.accent;

    return (
      <View style={[styles.suiteRow, isDesktopSplit && styles.suiteRowDesktop]}>
        {/* Left Card: 7-Day Forecast + Solar / Lunar / Pressure Bar */}
        <View
          style={[
            styles.outerBezel,
            isDesktopSplit && styles.leftColDesktop,
            {
              backgroundColor: palette.bezelOuterBg,
              borderColor: palette.hairline,
            },
          ]}
        >
          <View
            style={[
              styles.cardInner,
              {
                backgroundColor: palette.coreSurfaceBg,
                borderColor: palette.bezelOuterBorder,
              },
            ]}
          >
            <View style={styles.cardHdrRow}>
              <View style={styles.hdrTitleWrap}>
                <View style={[styles.hdrDot, { backgroundColor: warmGold }]} />
                <Text style={[styles.cardTitle, { color: palette.inkPrimary }]}>
                  Dự báo 7 ngày tới & Chu kỳ Mặt trời
                </Text>
              </View>
              <View
                style={[
                  styles.subtleBadge,
                  {
                    backgroundColor: palette.coreElevatedBg,
                    borderColor: palette.bezelOuterBorder,
                  },
                ]}
              >
                <MoonStars size={13} weight="duotone" color={palette.accent} />
                <Text style={[styles.subtleBadgeText, { color: palette.inkSecondary }]}>
                  {moonLabel}
                </Text>
              </View>
            </View>

            {/* Solar + Atmospheric Meta Strip */}
            <View
              style={[
                styles.solarStrip,
                {
                  backgroundColor: palette.coreElevatedBg,
                  borderColor: palette.hairline,
                },
              ]}
            >
              <View style={styles.solarItem}>
                <SunHorizon size={15} weight="duotone" color={warmGold} />
                <Text style={[styles.solarLabel, { color: palette.inkSecondary }]}>
                  Bình minh{' '}
                  <Text style={{ color: palette.inkPrimary, fontWeight: '700' }}>
                    {sunriseLabel}
                  </Text>
                </Text>
              </View>
              <View style={[styles.solarDivider, { backgroundColor: palette.bezelOuterBorder }]} />
              <View style={styles.solarItem}>
                <SunHorizon size={15} weight="duotone" color={warmAmber} />
                <Text style={[styles.solarLabel, { color: palette.inkSecondary }]}>
                  Hoàng hôn{' '}
                  <Text style={{ color: palette.inkPrimary, fontWeight: '700' }}>
                    {sunsetLabel}
                  </Text>
                </Text>
              </View>
              {typeof weather.surfacePressureHpa === 'number' && (
                <>
                  <View
                    style={[styles.solarDivider, { backgroundColor: palette.bezelOuterBorder }]}
                  />
                  <View style={styles.solarItem}>
                    <Compass size={14} weight="duotone" color={palette.accent} />
                    <Text style={[styles.solarLabel, { color: palette.inkSecondary }]}>
                      Áp suất{' '}
                      <Text style={{ color: palette.inkPrimary, fontWeight: '700' }}>
                        {Math.round(weather.surfacePressureHpa)} hPa
                      </Text>
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* 7-Day Rows */}
            <View style={styles.daysList}>
              {dailyList.map((day, idx) => {
                const { dayVi, ddMm } = formatDailyRowLabel(day.dateIso, idx);
                const leftPct = Math.max(
                  0,
                  Math.min(90, ((day.tempMinC - weekMin) / weekSpan) * 100)
                );
                const barWidthPct = Math.max(
                  10,
                  Math.min(100 - leftPct, ((day.tempMaxC - day.tempMinC) / weekSpan) * 100)
                );
                const nowDotPct =
                  idx === 0
                    ? Math.max(
                        0,
                        Math.min(100, ((weather.temperatureC - weekMin) / weekSpan) * 100)
                      )
                    : null;

                return (
                  <View
                    key={`${day.dateIso}_${idx}`}
                    style={[
                      styles.dayRow,
                      idx > 0 && {
                        borderTopWidth: 1,
                        borderTopColor: palette.hairline,
                      },
                    ]}
                  >
                    <View style={styles.dayColName}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.dayNameText,
                          {
                            color: idx === 0 ? palette.accent : palette.inkPrimary,
                            fontWeight: idx === 0 ? '800' : '700',
                          },
                        ]}
                      >
                        {dayVi}
                      </Text>
                      {Boolean(ddMm) && (
                        <Text style={[styles.dayDateText, { color: palette.inkMuted }]}>
                          {ddMm}
                        </Text>
                      )}
                    </View>

                    <View style={styles.dayColIcon}>
                      <WeatherIcon
                        code={day.conditionCode}
                        isDay={true}
                        isDark={palette.isDark}
                        precipProbPct={day.precipProbMaxPct}
                        size={26}
                      />
                      {day.precipProbMaxPct >= 15 ? (
                        <Text style={[styles.dayRainText, { color: rainCyan }]}>
                          {day.precipProbMaxPct}%
                          {day.precipSumMm >= 0.5 ? ` · ${day.precipSumMm.toFixed(1)}mm` : ''}
                        </Text>
                      ) : (
                        <Text style={[styles.dayRainText, { color: palette.inkMuted }]}>
                          Khô ráo
                        </Text>
                      )}
                    </View>

                    <Text style={[styles.dayTempBound, { color: palette.inkSecondary }]}>
                      {Math.round(day.tempMinC)}°
                    </Text>

                    <View style={styles.rangeTrackOuter}>
                      <View
                        style={[
                          styles.rangeTrackBg,
                          {
                            backgroundColor: palette.barTrackBg,
                            borderWidth: 1,
                            borderColor: palette.hairline,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.rangeBarFill,
                            {
                              left: `${leftPct.toFixed(1)}%` as any,
                              width: `${barWidthPct.toFixed(1)}%` as any,
                              backgroundColor: warmGold,
                            },
                            Platform.OS === 'web'
                              ? ({
                                  backgroundImage: buildThermalRangeGradientCss(
                                    day.tempMinC,
                                    day.tempMaxC,
                                    palette
                                  ),
                                } as any)
                              : null,
                          ]}
                        />
                        {nowDotPct !== null && (
                          <View
                            style={[
                              styles.nowTempDot,
                              {
                                left: `${nowDotPct.toFixed(1)}%` as any,
                                backgroundColor: palette.inkPrimary,
                                borderColor: palette.coreSurfaceBg,
                              },
                            ]}
                          />
                        )}
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.dayTempBound,
                        styles.dayTempMax,
                        { color: palette.inkPrimary },
                      ]}
                    >
                      {Math.round(day.tempMaxC)}°
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Right Card: Interactive Live Precipitation Radar Map */}
        <View
          style={[
            styles.outerBezel,
            isDesktopSplit && styles.rightColDesktop,
            {
              backgroundColor: palette.bezelOuterBg,
              borderColor: palette.hairline,
            },
          ]}
        >
          <View
            style={[
              styles.cardInner,
              {
                backgroundColor: palette.coreSurfaceBg,
                borderColor: palette.bezelOuterBorder,
              },
            ]}
          >
            <View style={styles.cardHdrRow}>
              <View style={styles.hdrTitleWrap}>
                <View style={[styles.hdrDot, { backgroundColor: rainCyan }]} />
                <Text style={[styles.cardTitle, { color: palette.inkPrimary }]}>
                  Radar Mây Mưa Trực Tiếp
                </Text>
              </View>
              <View
                style={[
                  styles.subtleBadge,
                  {
                    backgroundColor: palette.coreElevatedBg,
                    borderColor: palette.bezelOuterBorder,
                  },
                ]}
              >
                <Drop size={12} weight="duotone" color={rainCyan} />
                <Text style={[styles.subtleBadgeText, { color: palette.inkSecondary }]}>
                  {frameClockVi}
                </Text>
              </View>
            </View>

            {Platform.OS === 'web' ? (
              <View
                style={[
                  styles.radarViewport,
                  {
                    backgroundColor: palette.isDark ? '#0B0E14' : '#DCE8F4',
                    borderColor: palette.bezelOuterBorder,
                  },
                ]}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: 768,
                    height: 768,
                    transform: `translate(${-(256 + tileGrid.fracX * 256).toFixed(1)}px, ${-(
                      256 +
                      tileGrid.fracY * 256
                    ).toFixed(1)}px)`,
                    pointerEvents: 'none',
                  }}
                >
                  {tileGrid.tiles.map((t) => (
                    <React.Fragment key={t.key}>
                      <img
                        src={t.baseUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        style={{
                          position: 'absolute',
                          left: (t.dx + 1) * 256,
                          top: (t.dy + 1) * 256,
                          width: 256,
                          height: 256,
                          display: 'block',
                          filter: palette.isDark
                            ? 'invert(0.90) hue-rotate(188deg) saturate(0.45) brightness(0.96) contrast(1.12)'
                            : 'saturate(0.84) brightness(0.99)',
                        }}
                      />
                      {t.radarUrl && (
                        <img
                          src={t.radarUrl}
                          alt=""
                          decoding="async"
                          style={{
                            position: 'absolute',
                            left: (t.dx + 1) * 256,
                            top: (t.dy + 1) * 256,
                            width: 256,
                            height: 256,
                            opacity: 0.72,
                            display: 'block',
                          }}
                        />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                {/* Center City Pin */}
                <View pointerEvents="none" style={styles.radarCenterMarkerWrap}>
                  <View
                    style={[
                      styles.radarCenterHalo,
                      { backgroundColor: `${rainCyan}38`, borderColor: rainCyan },
                    ]}
                  />
                  <View
                    style={[
                      styles.radarCenterDot,
                      {
                        backgroundColor: rainCyan,
                        borderColor: palette.coreSurfaceBg,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.radarPinLabel,
                      {
                        backgroundColor: palette.coreSurfaceBg,
                        borderColor: palette.bezelOuterBorder,
                      },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.radarPinText, { color: palette.inkPrimary }]}
                    >
                      {weather.locationName} · {Math.round(weather.temperatureC)}°
                    </Text>
                  </View>
                </View>

                {/* Zoom Controls */}
                <View style={styles.radarZoomCol}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Phóng to bản đồ radar"
                    onPress={() => setZoom((z) => Math.min(10, z + 1))}
                    style={[
                      styles.radarCtrlBtn,
                      WEB_NO_OUTLINE,
                      {
                        backgroundColor: palette.coreSurfaceBg,
                        borderColor: palette.bezelOuterBorder,
                      },
                    ]}
                  >
                    <Text style={[styles.radarCtrlBtnText, { color: palette.inkPrimary }]}>
                      +
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Thu nhỏ bản đồ radar"
                    onPress={() => setZoom((z) => Math.max(5, z - 1))}
                    style={[
                      styles.radarCtrlBtn,
                      WEB_NO_OUTLINE,
                      {
                        backgroundColor: palette.coreSurfaceBg,
                        borderColor: palette.bezelOuterBorder,
                      },
                    ]}
                  >
                    <Text style={[styles.radarCtrlBtnText, { color: palette.inkPrimary }]}>
                      −
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View
                style={[
                  styles.radarNativeFallback,
                  { backgroundColor: palette.coreElevatedBg },
                ]}
              >
                <Text style={{ color: palette.inkSecondary, fontSize: 13 }}>
                  Radar mây mưa tại {weather.locationName} ({weather.latitude.toFixed(2)},{' '}
                  {weather.longitude.toFixed(2)})
                </Text>
              </View>
            )}

            {/* Radar Playback Scrubber + Intensity Legend */}
            <View style={styles.radarFooter}>
              {radarFrames.length > 1 && (
                <View style={styles.radarTimelineRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={isPlayingRadar ? 'Tạm dừng radar' : 'Phát chuyển động mây mưa'}
                    onPress={() => setIsPlayingRadar((p) => !p)}
                    style={[
                      styles.playRadarBtn,
                      WEB_NO_OUTLINE,
                      {
                        backgroundColor: isPlayingRadar
                          ? palette.accent
                          : palette.coreElevatedBg,
                        borderColor: palette.bezelOuterBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.playRadarBtnText,
                        {
                          color: isPlayingRadar
                            ? palette.accentContrastInk
                            : palette.inkPrimary,
                        },
                      ]}
                    >
                      {isPlayingRadar ? 'Tạm dừng' : '▶ Phát radar'}
                    </Text>
                  </Pressable>

                  <View style={styles.frameDotsRow}>
                    {radarFrames.map((f, idx) => {
                      const active = idx === frameIdx;
                      return (
                        <Pressable
                          key={f.time}
                          onPress={() => {
                            setIsPlayingRadar(false);
                            setFrameIdx(idx);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`Khung radar ${idx + 1}`}
                          style={[
                            styles.frameStepPill,
                            WEB_NO_OUTLINE,
                            {
                              backgroundColor: active
                                ? rainCyan
                                : f.isForecast
                                  ? palette.accentSoftBg
                                  : palette.pillIdleBg,
                              flex: active ? 1.8 : 1,
                            },
                          ]}
                        />
                      );
                    })}
                  </View>
                </View>
              )}

              <View style={styles.radarLegendRow}>
                <Text style={[styles.legendCaption, { color: palette.inkMuted }]}>
                  Cường độ mưa:
                </Text>
                <View style={styles.legendChip}>
                  <View style={[styles.legendSwatch, { backgroundColor: '#38BDF8' }]} />
                  <Text style={[styles.legendLabel, { color: palette.inkSecondary }]}>
                    Nhỏ
                  </Text>
                </View>
                <View style={styles.legendChip}>
                  <View style={[styles.legendSwatch, { backgroundColor: '#34D399' }]} />
                  <Text style={[styles.legendLabel, { color: palette.inkSecondary }]}>
                    Vừa
                  </Text>
                </View>
                <View style={styles.legendChip}>
                  <View style={[styles.legendSwatch, { backgroundColor: '#FBBF24' }]} />
                  <Text style={[styles.legendLabel, { color: palette.inkSecondary }]}>
                    To
                  </Text>
                </View>
                <View style={styles.legendChip}>
                  <View style={[styles.legendSwatch, { backgroundColor: '#EF4444' }]} />
                  <Text style={[styles.legendLabel, { color: palette.inkSecondary }]}>
                    Dông bão
                  </Text>
                </View>
                <Text style={[styles.legendCaption, { color: palette.inkMuted, marginLeft: 'auto' as any }]}>
                  © OpenStreetMap · RainViewer
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  suiteRow: {
    width: '100%',
    maxWidth: '100%',
    gap: 16,
    flexDirection: 'column',
  },
  suiteRowDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  leftColDesktop: {
    flex: 1.15,
    minWidth: 0,
  },
  rightColDesktop: {
    flex: 0.95,
    minWidth: 0,
  },
  outerBezel: {
    padding: 5,
    borderRadius: 30,
    borderWidth: 1,
    maxWidth: '100%',
  },
  cardInner: {
    flex: 1,
    borderRadius: 25,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  cardHdrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  hdrTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hdrDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 14.5,
    fontWeight: '800',
  },
  subtleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  subtleBadgeText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.2,
    fontWeight: '700',
  },
  solarStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
  },
  solarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  solarDivider: {
    width: 1,
    height: 14,
  },
  solarLabel: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '600',
  },
  daysList: {
    gap: 2,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  dayColName: {
    width: 78,
  },
  dayNameText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.8,
  },
  dayDateText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 10.8,
    fontWeight: '600',
  },
  dayColIcon: {
    width: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dayRainText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.2,
    fontWeight: '700',
    flexShrink: 1,
  },
  dayTempBound: {
    width: 30,
    fontFamily: FONT_FAMILY_DISPLAY,
    fontSize: 13.2,
    fontWeight: '700',
    textAlign: 'right',
  },
  dayTempMax: {
    textAlign: 'left',
  },
  rangeTrackOuter: {
    flex: 1,
    minWidth: 56,
    paddingHorizontal: 4,
  },
  rangeTrackBg: {
    height: 7,
    borderRadius: 999,
    position: 'relative',
    overflow: 'visible',
  },
  rangeBarFill: {
    position: 'absolute',
    top: -1,
    bottom: -1,
    borderRadius: 999,
  },
  nowTempDot: {
    position: 'absolute',
    top: -3,
    marginLeft: -6,
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 2,
  },
  radarViewport: {
    position: 'relative',
    width: '100%',
    height: 274,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  radarCenterMarkerWrap: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: -70 }, { translateY: -14 }],
    width: 140,
  },
  radarCenterHalo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarCenterDot: {
    position: 'absolute',
    top: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  radarPinLabel: {
    marginTop: 4,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  radarPinText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11,
    fontWeight: '800',
  },
  radarZoomCol: {
    position: 'absolute',
    right: 10,
    top: 10,
    gap: 6,
  },
  radarCtrlBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarCtrlBtnText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 20,
  },
  radarNativeFallback: {
    height: 200,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  radarFooter: {
    gap: 9,
    marginTop: 'auto',
  },
  radarTimelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playRadarBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  playRadarBtnText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    fontWeight: '800',
  },
  frameDotsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  frameStepPill: {
    height: 7,
    borderRadius: 999,
  },
  radarLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  legendCaption: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11,
    fontWeight: '700',
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendSwatch: {
    width: 9,
    height: 9,
    borderRadius: 3,
  },
  legendLabel: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11,
    fontWeight: '600',
  },
});

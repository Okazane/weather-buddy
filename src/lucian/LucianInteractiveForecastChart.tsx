/* Lucian UX/UI Prompt #096 & #095 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#096 · https://lucianlabs.dev/uxui-prompt/#095 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Sparkle } from '../components/AppIcons';
import type {
  CharacterDecision,
  HourlyForecastPoint,
  WeatherSnapshot,
} from '../core';
import {
  FONT_FAMILY_DISPLAY,
  FONT_FAMILY_SANS,
  type AtmosphericPalette,
} from '../components/themeTokens';
import { injectLucianElementCss } from './lucianTokens';

export interface LucianInteractiveForecastChartProps {
  palette: AtmosphericPalette;
  weather: WeatherSnapshot;
  decision: CharacterDecision;
  reduceMotion?: boolean;
}

const STYLE_ELEMENT_ID = 'lucian-u096-u095-mixed24h-css';

/**
 * Genuine Lucian UX/UI Prompt #096 ("Stock line that splits as you scrub") + #095 ("Bar chart that changes shape")
 * combined into a clean, non-overlapping Two-Lane 24-Hour Weather Chart:
 * - Upper Lane (124px): Nhiệt độ (°C) scrub-split curve in Warm Sunlight Amber-Gold (--temp)
 * - Middle Micro-Divider (18px): Calm hairline & caption separating the two lanes
 * - Lower Lane (58px): Lượng mưa (mm & %) solid rounded bars in Cool Sky-Cyan (--rain)
 */
const LUCIAN_U096_U095_MIXED_CSS = `/* Lucian UX/UI Prompt #096 & #095 · Two-Lane 24h Temperature & Rainfall Chart */
.u096{--temp:var(--u096-temp,#F0AE43);--c:var(--temp);--rain:var(--u096-rain,#38BDF8);position:relative;width:100%;max-width:100%;height:auto;display:flex;flex-direction:column;padding:14px 16px 13px;border-radius:22px;background:var(--ux-surface);box-shadow:0 0 0 1px var(--ux-line),0 24px 52px -34px var(--ux-shadow-strong);overflow:hidden}
.u096-h{display:flex;flex-direction:column;gap:6px}
.u096-top{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.u096-h small{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:730;color:var(--ux-ink-2);line-height:1.35;min-width:0;flex:1}
.u096-h small i{width:13px;height:13px;border-radius:4px;background:linear-gradient(145deg,var(--temp),var(--rain));flex:none}
.u096-sub{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.u096-head-right{display:flex;align-items:center;flex-wrap:wrap;gap:6px;flex:none}
.u096-legend{display:inline-flex;align-items:center;gap:9px;padding:3px 9px;border-radius:999px;background:var(--ux-surface-2);border:1px solid var(--ux-line)}
.u096-leg-item{display:inline-flex;align-items:center;gap:4px;font-size:10.3px;font-weight:760;color:var(--ux-ink-2);white-space:nowrap}
.u096-leg-line{position:relative;width:14px;height:2.2px;border-radius:2px;background:var(--temp);display:inline-block}
.u096-leg-line::after{content:"";position:absolute;left:4px;top:-2px;width:6px;height:6px;border-radius:50%;background:var(--temp);border:1.2px solid var(--ux-surface)}
.u096-leg-bar{width:7px;height:10px;border-radius:2.5px 2.5px 1px 1px;background:linear-gradient(180deg,var(--rain),color-mix(in srgb,var(--rain) 42%,transparent));display:inline-block}
.u096-help-btn{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border-radius:50%;border:1px solid var(--ux-line-2);background:var(--ux-surface-2);color:var(--ux-ink-3);font-size:11px;font-weight:800;flex:none;transition:background-color .2s,color .2s,border-color .2s}
.u096-help-btn:hover,.u096-help-btn:focus-visible,.u096-help-btn.on{background:var(--ux-accent-soft);color:var(--ux-ink);border-color:var(--temp)}
.u096-p-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.u096-p-wrap{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-width:0}
.u096-p-lead{display:inline-flex;align-items:center;gap:6px}
.u096-p-dot{width:8px;height:8px;border-radius:50%;background:var(--temp);box-shadow:0 0 0 3px color-mix(in srgb,var(--temp) 20%,transparent);flex:none}
.u096-p{display:block;margin:0;font-size:17px;font-weight:830;letter-spacing:-.02em;line-height:1.2;font-variant-numeric:tabular-nums;color:var(--ux-ink);transition:font-size .15s}
.u096.scrub .u096-p{font-size:21px;font-weight:860;letter-spacing:-.035em}
.u096-rain-badge{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 10px;border-radius:999px;font-size:11.3px;font-weight:790;color:var(--rain);background:color-mix(in srgb,var(--rain) 13%,transparent);border:1px solid color-mix(in srgb,var(--rain) 28%,transparent);font-variant-numeric:tabular-nums;white-space:nowrap;transition:background-color .25s,border-color .25s}
.u096-rain-badge.wet{background:color-mix(in srgb,var(--rain) 20%,transparent);border-color:color-mix(in srgb,var(--rain) 46%,transparent)}
.u096-pin-hint{font-size:10.8px;font-weight:720;color:var(--ux-ink-3);font-variant-numeric:tabular-nums;white-space:nowrap}
.u096-ch{position:relative;flex:none;height:224px;margin:8px 0 0;padding:0 42px 0 2px;touch-action:pan-y;user-select:none;cursor:crosshair;outline:none;border-radius:12px}
.u096-ch:focus,.u096-ch:focus-visible{outline:none;box-shadow:0 0 0 1.5px color-mix(in srgb,var(--temp) 48%,transparent)}
.u096-plot{position:relative;width:100%;height:200px;display:flex;flex-direction:column}
.u096-lane-temp{position:relative;width:100%;height:124px;flex:none}
.u096-lane-temp svg{position:relative;z-index:3;display:block;width:100%;height:124px;overflow:visible}
.u096-grid{position:absolute;inset:0;pointer-events:none;z-index:0}
.u096-gl{position:absolute;left:0;right:-42px;height:0;border-top:1px dashed var(--ux-line-2)}
.u096-gl span{position:absolute;right:0;top:-7px;width:38px;text-align:right;font-size:10.2px;font-weight:750;color:var(--ux-ink-3);font-variant-numeric:tabular-nums;transition:opacity .2s}
.u096-avg-pill{position:absolute;right:-42px;top:0;width:38px;text-align:right;font-size:9.8px;font-weight:820;color:var(--temp);font-variant-numeric:tabular-nums;white-space:nowrap;transform:translateY(-50%);pointer-events:none;z-index:3}
.u096-base{fill:none;stroke:var(--ux-ink-3);stroke-opacity:.32;stroke-width:2.1;stroke-linejoin:round;stroke-linecap:round}
.u096-line{fill:none;stroke:var(--temp);stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round;transition:stroke .3s}
.u096-gd stop{stop-color:var(--temp);transition:stop-color .3s}
.u096-ref{stroke:var(--temp);stroke-opacity:.42;stroke-width:1.15;stroke-dasharray:3 4}
.u096-cur{stroke:var(--ux-ink-3);stroke-width:1.15;stroke-dasharray:2 3;opacity:0;transition:opacity .18s}
.u096.scrub .u096-cur{opacity:.78}
.u096-ev-peak{fill:var(--temp);stroke:var(--ux-surface);stroke-width:1.6}
.u096-ev-low{fill:var(--ux-surface);stroke:var(--temp);stroke-width:1.8}
.u096-dot{fill:var(--temp);stroke:var(--ux-surface);stroke-width:2.2;opacity:.9;transition:opacity .18s,transform .18s;transform-box:fill-box;transform-origin:center}
.u096-ring{fill:none;stroke:var(--temp);stroke-width:1.6;opacity:0;transform-box:fill-box;transform-origin:center;transition:opacity .18s,transform .18s}
.u096.scrub .u096-dot{opacity:1;transform:scale(1.12)}
.u096.scrub .u096-ring{opacity:.42;transform:scale(1.38)}
.u096.pinned .u096-ring{opacity:.85;transform:scale(1.5)}
.u096-callout{position:absolute;left:0;top:0;z-index:4;font-size:10.3px;font-weight:840;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap;pointer-events:none;text-shadow:0 1px 4px var(--ux-surface),0 0 8px var(--ux-surface);transform:translate(var(--tx,0),var(--ty,0));transition:opacity .18s}
.u096-callout.peak{color:var(--temp)}
.u096-callout.low{color:var(--ux-ink-2)}
.u096-callout.off,.u096.scrub .u096-callout{opacity:0}
.u096-lane-div{position:relative;width:100%;height:18px;padding-left:2px;flex:none;display:flex;align-items:center;border-top:1px solid var(--ux-line);pointer-events:none;z-index:1}
.u096-lane-div span{font-size:10px;font-weight:720;color:var(--ux-ink-3);letter-spacing:.01em;white-space:nowrap}
.u096-lane-rain{position:relative;width:100%;height:58px;flex:none;border-bottom:1px solid var(--ux-line-2)}
.u096-rain-axis{position:absolute;top:0;bottom:0;right:-42px;width:38px;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end;pointer-events:none;z-index:1}
.u096-rain-tick{font-size:9.6px;font-weight:760;color:var(--rain);opacity:.85;font-variant-numeric:tabular-nums;white-space:nowrap;line-height:1}
.u095-bars{position:absolute;inset:0;z-index:2;pointer-events:none}
.u095-b{position:absolute;bottom:0;height:44px;width:var(--bw,8px);transform:translateX(-50%);display:flex;flex-direction:column;justify-content:flex-end;align-items:center;pointer-events:none}
.u095-b i{display:block;width:100%;height:calc(var(--h,0) * 100%);border-radius:4px 4px 1px 1px;background:linear-gradient(180deg,var(--rain),color-mix(in srgb,var(--rain) 44%,transparent));opacity:.92;transition:height .55s var(--ux-spring),opacity .22s,transform .18s;transition-delay:calc(var(--d,0) * 12ms),0s,0s}
.u095-b.drizzle i{background:linear-gradient(180deg,color-mix(in srgb,var(--rain) 85%,transparent),color-mix(in srgb,var(--rain) 35%,transparent));opacity:.34}
.u095-b.dry i{height:0;opacity:0}
.u095-b-val{position:absolute;bottom:calc(var(--h,0) * 100% + 2px);left:50%;transform:translateX(-50%);font-size:9.3px;font-weight:830;color:var(--rain);text-decoration:none;font-variant-numeric:tabular-nums;white-space:nowrap;line-height:1.1;text-shadow:0 1px 4px var(--ux-surface);opacity:0;transition:opacity .18s}
.u095-b.edge-l .u095-b-val{left:0;transform:none}
.u095-b.edge-r .u095-b-val{left:auto;right:0;transform:none}
.u095-b.show-val .u095-b-val{opacity:.96}
.u096.scrub .u095-b:not(.on) i{opacity:.26}
.u096.scrub .u095-b.dry:not(.on) i{opacity:0}
.u096.scrub .u095-b:not(.on) .u095-b-val{opacity:0}
.u095-b.on i{opacity:1;transform:scaleX(1.22)}
.u095-b.drizzle.on i{opacity:.68}
.u095-b.on:not(.dry) .u095-b-val{opacity:1}
.u095-b.pin:not(.dry) i{box-shadow:0 0 0 1.5px var(--ux-surface),0 0 0 2.5px var(--rain)}
.u096-tag{position:absolute;top:-4px;left:0;z-index:6;height:22px;padding:0 8px;border-radius:6px;display:flex;align-items:center;gap:5px;background:var(--ux-ink);color:var(--ux-page);font-size:10.8px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap;pointer-events:none;box-shadow:0 6px 14px -6px var(--ux-shadow-strong);transform:translateX(var(--tx,0));opacity:0;transition:opacity .18s}
.u096.scrub .u096-tag{opacity:1}
.u096-x{position:relative;height:22px;margin-top:2px;display:flex;align-items:center;justify-content:space-between;pointer-events:none}
.u096-x-tick{position:absolute;top:4px;transform:translateX(-50%);font-size:10.2px;font-weight:730;color:var(--ux-ink-3);font-variant-numeric:tabular-nums;white-space:nowrap;transition:color .2s,font-weight .2s}
.u096-x-tick.first{transform:none}
.u096-x-tick.last{transform:translateX(-100%)}
.u096-x-tick.on{color:var(--ux-ink);font-weight:850}
.u096-adv{display:flex;align-items:flex-start;gap:7px;margin-top:8px;padding:8px 10px;border-radius:12px;background:linear-gradient(125deg,color-mix(in srgb,var(--temp) 10%,transparent),transparent 90%),var(--ux-surface-2);border:1px solid var(--ux-line);font-size:11.5px;line-height:1.42;font-weight:650;color:var(--ux-ink-2)}
.u096-adv-ic{display:inline-grid;place-items:center;flex:none;margin-top:1.5px}
.u096-adv-txt{min-width:0;flex:1}
.u096-tip-pop{position:absolute;left:12px;right:12px;top:68px;z-index:30;padding:10px 12px;border-radius:14px;background:var(--ux-surface);border:1px solid var(--ux-line-2);box-shadow:0 16px 34px -12px var(--ux-shadow-strong),0 0 0 1px var(--ux-accent-soft);backdrop-filter:blur(12px);pointer-events:none;opacity:0;visibility:hidden;transform:translateY(-4px) scale(.985);transition:opacity .18s var(--ux-ease),transform .22s var(--ux-spring),visibility 0s .18s}
.u096-tip-pop.on{opacity:1;visibility:visible;transform:translateY(0) scale(1);transition:opacity .18s var(--ux-ease),transform .22s var(--ux-spring)}
.u096-tip-hdr{display:flex;align-items:center;gap:6px;margin-bottom:4px}
.u096-tip-dot{width:6.5px;height:6.5px;border-radius:50%;background:var(--temp);flex:none}
.u096-tip-title{font-size:12px;font-weight:800;color:var(--ux-ink)}
.u096-tip-body{margin:0;font-size:11.4px;line-height:1.44;font-weight:580;color:var(--ux-ink-2)}
@media (max-width:460px){
  .u096{padding:12px 12px 11px}
  .u096-p{font-size:15.5px}
  .u096.scrub .u096-p{font-size:18.5px}
  .u096-legend{padding:2px 7px;gap:6px}
  .u096-leg-item{font-size:9.7px}
  .u096-ch{padding-right:38px}
  .u096-gl,.u096-avg-pill,.u096-rain-axis{right:-38px}
  .u096-gl span,.u096-avg-pill,.u096-rain-axis{width:35px}
  .u096-x-tick{font-size:9.6px}
}
`;

function buildPaletteUxVars(palette: AtmosphericPalette): Record<string, string> {
  if (palette.isDark) {
    return {
      '--ux-page': palette.skyStops[2],
      '--ux-surface': palette.coreSurfaceBg,
      '--ux-surface-2': palette.coreElevatedBg,
      '--ux-surface-3': palette.pillIdleBg,
      '--ux-ink': palette.inkPrimary,
      '--ux-ink-2': palette.inkSecondary,
      '--ux-ink-3': palette.inkMuted,
      '--ux-line': palette.hairline,
      '--ux-line-2': palette.bezelOuterBorder,
      '--ux-accent': palette.accent,
      '--ux-accent-2': '#5899DA',
      '--ux-accent-soft': palette.accentSoftBg,
      '--ux-accent-ink': palette.accentContrastInk,
      '--ux-mint': '#38B889',
      '--ux-warn': '#E5A23C',
      '--ux-danger': '#E26D7A',
      '--ux-shadow-strong': 'rgba(5, 10, 20, 0.64)',
      '--temp': '#F0AE43',
      '--u096-temp': '#F0AE43',
      '--rain': '#38BDF8',
      '--u096-rain': '#38BDF8',
    };
  }
  return {
    '--ux-page': palette.skyStops[2],
    '--ux-surface': palette.coreSurfaceBg,
    '--ux-surface-2': palette.coreElevatedBg,
    '--ux-surface-3': palette.pillIdleBg,
    '--ux-ink': palette.inkPrimary,
    '--ux-ink-2': palette.inkSecondary,
    '--ux-ink-3': palette.inkMuted,
    '--ux-line': palette.hairline,
    '--ux-line-2': 'rgba(20, 29, 43, 0.15)',
    '--ux-accent': palette.accent,
    '--ux-accent-2': '#26639E',
    '--ux-accent-soft': palette.accentSoftBg,
    '--ux-accent-ink': palette.accentContrastInk,
    '--ux-mint': '#13845E',
    '--ux-warn': '#B86B1D',
    '--ux-danger': '#C4384B',
    '--ux-shadow-strong': 'rgba(20, 29, 43, 0.18)',
    '--temp': '#C87416',
    '--u096-temp': '#C87416',
    '--rain': '#0284C7',
    '--u096-rain': '#0284C7',
  };
}

interface ParsedSlotTime {
  hour: number;
  minute: number;
  day: number;
  month: number;
  year: number;
}

function parseSlotLocalTime(
  iso: string | undefined,
  utcOffsetSeconds: number | undefined,
  fallbackBaseIso: string | undefined,
  fallbackPlusHours: number
): ParsedSlotTime {
  const tryParse = (raw?: string): ParsedSlotTime | null => {
    if (!raw) return null;
    const trimmed = raw.trim();
    const explicit = trimmed.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?([+-]\d{2}:?\d{2})?$/
    );
    if (explicit) {
      return {
        year: Number(explicit[1]),
        month: Number(explicit[2]),
        day: Number(explicit[3]),
        hour: Number(explicit[4]),
        minute: Number(explicit[5]),
      };
    }
    const ms = Date.parse(trimmed);
    if (Number.isNaN(ms)) return null;
    const offsetSec =
      typeof utcOffsetSeconds === 'number' && Number.isFinite(utcOffsetSeconds)
        ? utcOffsetSeconds
        : -new Date().getTimezoneOffset() * 60;
    const d = new Date(ms + offsetSec * 1000);
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
    };
  };

  const direct = tryParse(iso);
  if (direct) return direct;

  const base = tryParse(fallbackBaseIso);
  if (base) {
    const shifted = new Date(
      Date.UTC(base.year, base.month - 1, base.day, base.hour + fallbackPlusHours, 0)
    );
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hour: shifted.getUTCHours(),
      minute: 0,
    };
  }

  return {
    year: 2026,
    month: 1,
    day: 1,
    hour: (12 + fallbackPlusHours) % 24,
    minute: 0,
  };
}

function describeShortConditionVi(code: string | undefined, hour: number): string {
  const upper = (code || '').toUpperCase();
  const isDay = hour >= 6 && hour < 18;
  if (upper.includes('THUNDER') || upper.includes('STORM')) return 'Mưa dông';
  if (upper.includes('HEAVY_RAIN')) return 'Mưa to';
  if (upper.includes('RAIN')) return 'Mưa rào';
  if (upper.includes('DRIZZLE')) return 'Mưa phùn';
  if (upper.includes('SNOW')) return 'Có tuyết';
  if (upper.includes('FOG')) return 'Sương mù';
  if (upper === 'CLOUDY' || upper.includes('OVERCAST')) return 'Nhiều mây';
  if (upper.includes('CLOUD')) return isDay ? 'Mây rải rác' : 'Đêm ít mây';
  return isDay ? 'Trời quang' : 'Đêm quang';
}

/**
 * Computes a clean temperature Y-axis range `[axisMin, axisMax]` for the Upper Lane
 * where `(axisMax - axisMin)` is an even integer (so `axisMax`, `axisMid`, `axisMin` are whole numbers).
 */
function computeTempAxisBounds(values: number[]): {
  axisMin: number;
  axisMax: number;
  axisMid: number;
} {
  const safe = values.filter((v) => Number.isFinite(v));
  const lo = safe.length > 0 ? Math.min(...safe) : 18;
  const hi = safe.length > 0 ? Math.max(...safe) : 24;
  const rawMin = Math.floor(lo - 1.2);
  const rawMax = Math.ceil(hi + 1.2);
  const halfStep = Math.max(2, Math.ceil((rawMax - rawMin) / 2));
  const totalSpan = halfStep * 2;
  const extra = Math.max(0, totalSpan - (hi - lo));
  const axisMin = Math.floor(lo - Math.max(1, extra * 0.5));
  const axisMax = axisMin + totalSpan;
  const axisMid = axisMin + halfStep;
  return { axisMin, axisMax, axisMid };
}

function computeNiceRainMaxMm(peakMm: number): number {
  if (!Number.isFinite(peakMm) || peakMm <= 2) return 2;
  if (peakMm <= 5) return 5;
  if (peakMm <= 10) return 10;
  return Math.ceil(peakMm / 5) * 5;
}

/**
 * Monotone cubic Hermite interpolation (Fritsch-Carlson) resampling `raw` (length 25)
 * onto `targetN = 49` dense curve samples (`24 * 2 + 1`).
 */
function resampleMonotoneCubic(raw: number[], targetN: number): number[] {
  const M = raw.length;
  if (M === 0) return new Array(targetN).fill(0);
  if (M === 1) return new Array(targetN).fill(raw[0]);

  const segCount = M - 1;
  const deltas: number[] = new Array(segCount);
  for (let k = 0; k < segCount; k += 1) {
    deltas[k] = raw[k + 1] - raw[k];
  }

  const m: number[] = new Array(M);
  m[0] = deltas[0];
  m[M - 1] = deltas[segCount - 1];
  for (let k = 1; k < segCount; k += 1) {
    if (deltas[k - 1] * deltas[k] <= 0) {
      m[k] = 0;
    } else {
      m[k] = (deltas[k - 1] + deltas[k]) / 2;
    }
  }

  for (let k = 0; k < segCount; k += 1) {
    const d = deltas[k];
    if (d === 0) {
      m[k] = 0;
      m[k + 1] = 0;
    } else {
      const a = m[k] / d;
      const b = m[k + 1] / d;
      const hyp = Math.hypot(a, b);
      if (hyp > 3) {
        const tau = 3 / hyp;
        m[k] = tau * a * d;
        m[k + 1] = tau * b * d;
      }
    }
  }

  const out: number[] = new Array(targetN);
  for (let i = 0; i < targetN; i += 1) {
    const pos = (i / (targetN - 1)) * segCount;
    const k = Math.min(segCount - 1, Math.floor(pos));
    const t = pos - k;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    out[i] = h00 * raw[k] + h10 * m[k] + h01 * raw[k + 1] + h11 * m[k + 1];
  }
  return out;
}

export interface ForecastAxisTick {
  slotIdx: number;
  pct: number;
  label: string;
}

export interface Mixed24hSlotPoint {
  plusHours: number;
  tempC: number;
  rainMm: number;
  rainPct: number;
  barHeightRatio: number;
  barMode: 'wet' | 'drizzle' | 'dry';
  barInlineLabel: string;
  showInlineLabel: boolean;
  hh00: string;
  hhShort: string;
  ddMm: string;
  condVi: string;
  subtitleVi: string;
  rainBadgeVi: string;
  tagLabelVi: string;
}

export interface Mixed24hForecastModel {
  titleVi: string;
  restSubtitle: string;
  restPrimaryReadout: string;
  restRainBadge: string;
  restHasWetRain: boolean;
  meanTempC: number;
  totalRain24hMm: number;
  peakRainMm: number;
  maxRainPct: number;
  axisMinTemp: number;
  axisMidTemp: number;
  axisMaxTemp: number;
  axisMaxRainMm: number;
  slots: Mixed24hSlotPoint[];
  denseTempCurve: number[];
  sampleStep: number;
  xTicks: ForecastAxisTick[];
  peakTempSlotIdx: number;
  lowTempSlotIdx: number;
  peakTempSampleIdx: number;
  lowTempSampleIdx: number;
  peakRainSlotIdx: number;
  peakTempCallout: string;
  lowTempCallout: string;
  adviceVi: string;
  explainVi: string;
}

const SAMPLE_COUNT = 49; // 24 hourly intervals * 2 + 1
const SLOT_INDICES = Array.from({ length: 25 }, (_, i) => i);
const X_TICK_SLOTS = [0, 1, 2, 3, 4, 5, 6] as const;
const TEMP_GRID_INDICES = [0, 1, 2] as const;

export const LucianInteractiveForecastChart: React.FC<
  LucianInteractiveForecastChartProps
> = ({ palette, weather, reduceMotion = false }) => {
  const rootRef = useRef<HTMLDivElement | null>(null);

  const model: Mixed24hForecastModel = useMemo(() => {
    const rawHourly: HourlyForecastPoint[] = (weather.hourly ?? []).slice(0, 24);
    const nowTime = parseSlotLocalTime(
      weather.updatedAtIso,
      weather.utcOffsetSeconds,
      undefined,
      0
    );
    const nowDdMm = `${String(nowTime.day).padStart(2, '0')}/${String(
      nowTime.month
    ).padStart(2, '0')}`;
    const nowHh = String(nowTime.hour).padStart(2, '0');
    const nowHhMm = `${nowHh}:00`;

    const buildRawPoint = (plusHours: number) => {
      if (plusHours === 0) {
        const tempC = Number(weather.temperatureC.toFixed(1));
        const rainMm = Math.max(
          0,
          Number((weather.precipMmPerHr ?? 0).toFixed(2))
        );
        const rainPct = Math.max(
          0,
          Math.min(100, Math.round(weather.precipProbPct ?? 0))
        );
        return {
          plusHours: 0,
          tempC,
          rainMm,
          rainPct,
          hh00: nowHhMm,
          hhShort: `${nowHh}h`,
          ddMm: nowDdMm,
          condVi: describeShortConditionVi(
            rawHourly[0]?.conditionCode,
            nowTime.hour
          ),
        };
      }

      const slot = rawHourly[plusHours - 1];
      const lastKnown =
        rawHourly.length > 0 ? rawHourly[rawHourly.length - 1] : undefined;
      const baseTemp = lastKnown ? lastKnown.temperatureC : weather.temperatureC;
      const tempC = slot
        ? Number(slot.temperatureC.toFixed(1))
        : Number(
            (
              baseTemp +
              Math.sin(((plusHours - rawHourly.length) / 12) * Math.PI * 2) * 1.8
            ).toFixed(1)
          );
      const rainMm = slot
        ? Math.max(0, Number((slot.precipMm ?? 0).toFixed(2)))
        : Math.max(0, Number((lastKnown?.precipMm ?? 0).toFixed(2)));
      const rainPct = slot
        ? Math.max(0, Math.min(100, Math.round(slot.precipProbPct ?? 0)))
        : Math.max(
            0,
            Math.min(
              100,
              Math.round(lastKnown?.precipProbPct ?? weather.precipProbPct ?? 0)
            )
          );
      const tParts = parseSlotLocalTime(
        slot?.timeIso,
        weather.utcOffsetSeconds,
        weather.updatedAtIso,
        plusHours
      );
      const hh = String(tParts.hour).padStart(2, '0');
      const ddMm = `${String(tParts.day).padStart(2, '0')}/${String(
        tParts.month
      ).padStart(2, '0')}`;
      const condVi = describeShortConditionVi(
        slot?.conditionCode ?? lastKnown?.conditionCode,
        tParts.hour
      );
      return {
        plusHours,
        tempC,
        rainMm,
        rainPct,
        hh00: `${hh}:00`,
        hhShort: `${hh}h`,
        ddMm,
        condVi,
      };
    };

    const rawPts = SLOT_INDICES.map((plusHours) => buildRawPoint(plusHours));
    const temps = rawPts.map((p) => p.tempC);
    const rainMms = rawPts.map((p) => p.rainMm);
    const rainPcts = rawPts.map((p) => p.rainPct);

    const loTemp = Math.min(...temps);
    const hiTemp = Math.max(...temps);
    const meanTempC =
      temps.reduce((sum, v) => sum + v, 0) / Math.max(1, temps.length);
    const spanTemp = Number((hiTemp - loTemp).toFixed(1));
    const tempBounds = computeTempAxisBounds(temps);

    const upcomingMmSum = rawPts
      .slice(1)
      .reduce((sum, p) => sum + p.rainMm, 0);
    const totalRain24hMm = Number(
      Math.max(upcomingMmSum, rawPts[0].rainMm).toFixed(1)
    );
    const peakRainMm = Math.max(...rainMms);
    const maxRainPct = Math.max(...rainPcts);
    const axisMaxRainMm = computeNiceRainMaxMm(peakRainMm);

    let peakTempSlotIdx = 0;
    let lowTempSlotIdx = 0;
    let peakRainSlotIdx = 0;
    let bestRainScore = -1;

    rawPts.forEach((pt, idx) => {
      if (pt.tempC > rawPts[peakTempSlotIdx].tempC) peakTempSlotIdx = idx;
      if (pt.tempC < rawPts[lowTempSlotIdx].tempC) lowTempSlotIdx = idx;
      const rainScore = pt.rainMm * 1000 + pt.rainPct;
      if (rainScore > bestRainScore) {
        bestRainScore = rainScore;
        peakRainSlotIdx = idx;
      }
    });

    const slots: Mixed24hSlotPoint[] = rawPts.map((pt, idx) => {
      const isWet = pt.rainMm >= 0.05;
      const isDrizzleProb = !isWet && pt.rainPct >= 10;
      const barMode: 'wet' | 'drizzle' | 'dry' = isWet
        ? 'wet'
        : isDrizzleProb
          ? 'drizzle'
          : 'dry';

      let barHeightRatio = 0;
      if (isWet) {
        const mmNorm = Math.min(1, pt.rainMm / Math.max(0.5, axisMaxRainMm));
        barHeightRatio = Math.max(0.16, Math.min(1, mmNorm));
      } else if (isDrizzleProb) {
        barHeightRatio = Math.max(0.1, (pt.rainPct / 100) * 0.42);
      }

      const isSingleHighestRainBar =
        idx === peakRainSlotIdx && (peakRainMm >= 0.1 || maxRainPct >= 30);

      const barInlineLabel =
        pt.rainMm >= 0.1
          ? `${pt.rainMm.toFixed(1)} mm`
          : pt.rainMm >= 0.05
            ? '0.1 mm'
            : `<0.1 mm · ${pt.rainPct}%`;

      const rainBadgeVi =
        pt.rainMm >= 0.05
          ? `${pt.rainMm.toFixed(1)} mm · ${pt.rainPct}% mưa`
          : pt.rainPct >= 20
            ? `<0.1 mm · ${pt.rainPct}% khả năng mưa`
            : '0.0 mm · Không mưa';

      const tagRainPart =
        pt.rainMm >= 0.05
          ? `${pt.rainMm.toFixed(1)} mm (${pt.rainPct}%)`
          : pt.rainPct >= 10
            ? `<0.1 mm (${pt.rainPct}%)`
            : '0.0 mm';

      return {
        ...pt,
        barHeightRatio,
        barMode,
        barInlineLabel,
        showInlineLabel: isSingleHighestRainBar,
        subtitleVi: `Dự báo ${pt.hh00} (${pt.ddMm}) · ${pt.condVi}`,
        rainBadgeVi,
        tagLabelVi: `${pt.hh00} · ${pt.tempC.toFixed(1)}°C · ${tagRainPart}`,
      };
    });

    const endDdMm = slots[slots.length - 1].ddMm;
    const spanDates = `${nowDdMm} – ${endDdMm}`;
    const peakRainPt = slots[peakRainSlotIdx];

    const restRainBadge =
      totalRain24hMm >= 0.1 || peakRainMm >= 0.1
        ? `Tổng mưa 24h: ${totalRain24hMm.toFixed(1)} mm · Đỉnh ${peakRainPt.rainMm.toFixed(1)} mm/h (${peakRainPt.rainPct}%)`
        : maxRainPct >= 40
          ? `Mưa nhỏ rải rác (<0.1 mm · Đỉnh ${maxRainPct}%)`
          : 'Tổng mưa 24h: 0.0 mm';

    const adviceVi =
      peakRainMm >= 2.5 || totalRain24hMm >= 5.0
        ? `Tổng lượng mưa 24 giờ tới dự báo khoảng ${totalRain24hMm.toFixed(1)} mm, đỉnh mưa đạt ${peakRainPt.rainMm.toFixed(1)} mm/giờ (${peakRainPt.rainPct}%) lúc ${peakRainPt.hh00} — nên chuẩn bị sẵn áo mưa hoặc ô chắc chắn.`
        : peakRainMm >= 0.1
          ? `Trong 24 giờ tới có mưa nhẹ với lượng mưa đỉnh ${peakRainPt.rainMm.toFixed(1)} mm/giờ (xác suất ${peakRainPt.rainPct}%) vào khoảng ${peakRainPt.hh00}, tổng mưa 24h ${totalRain24hMm.toFixed(1)} mm — nên mang sẵn ô gấp gọn.`
          : maxRainPct >= 40
            ? `Trong 24 giờ tới có khả năng mưa nhỏ rải rác (<0.1 mm/giờ, xác suất đỉnh ${maxRainPct}% lúc ${peakRainPt.hh00}) — nên mang theo ô nhẹ khi ra ngoài.`
            : spanTemp >= 7
              ? `Trời 24 giờ tới khô ráo (tổng mưa 0.0 mm) nhưng biên độ nhiệt ngày – đêm khá lớn (${spanTemp.toFixed(1)}°C: cao ${hiTemp.toFixed(1)}° · thấp ${loTemp.toFixed(1)}°), nên mặc trang phục dễ điều chỉnh.`
              : `Xu hướng 24 giờ tới ổn định: nhiệt độ cao nhất ${hiTemp.toFixed(1)}°C, thấp nhất ${loTemp.toFixed(1)}°C (trung bình ${meanTempC.toFixed(1)}°C), trời tạnh ráo.`;

    const xTicks: ForecastAxisTick[] = [0, 4, 8, 12, 16, 20, 24].map(
      (slotIdx) => ({
        slotIdx,
        pct: (slotIdx / 24) * 100,
        label: slotIdx === 0 ? 'Nay' : slots[slotIdx].hhShort,
      })
    );

    return {
      titleVi: 'Biểu đồ 2 tầng Nhiệt độ (°C) & Lượng mưa (mm · %) 24 giờ',
      restSubtitle: `Xu hướng 24 giờ · ${spanDates}`,
      restPrimaryReadout: `Cao ${hiTemp.toFixed(1)}° · Thấp ${loTemp.toFixed(1)}°`,
      restRainBadge,
      restHasWetRain: totalRain24hMm >= 0.1 || peakRainMm >= 0.1 || maxRainPct >= 40,
      meanTempC,
      totalRain24hMm,
      peakRainMm,
      maxRainPct,
      axisMinTemp: tempBounds.axisMin,
      axisMidTemp: tempBounds.axisMid,
      axisMaxTemp: tempBounds.axisMax,
      axisMaxRainMm,
      slots,
      denseTempCurve: resampleMonotoneCubic(temps, SAMPLE_COUNT),
      sampleStep: 2,
      xTicks,
      peakTempSlotIdx,
      lowTempSlotIdx,
      peakTempSampleIdx: peakTempSlotIdx * 2,
      lowTempSampleIdx: lowTempSlotIdx * 2,
      peakRainSlotIdx,
      peakTempCallout: `${hiTemp.toFixed(1)}°`,
      lowTempCallout: `${loTemp.toFixed(1)}°`,
      adviceVi,
      explainVi:
        'Biểu đồ 24 giờ tách thành 2 tầng độc lập: tầng trên hiển thị đường Nhiệt độ (°C) màu vàng ấm cùng mức trung bình (TB); tầng dưới hiển thị cột Lượng mưa (mm/giờ) và xác suất mưa (%) màu xanh lam. Lướt hoặc chạm vào bất kỳ giờ nào để xem chi tiết.',
    };
  }, [weather]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    injectLucianElementCss(STYLE_ELEMENT_ID, LUCIAN_U096_U095_MIXED_CSS);
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const q = <T extends Element = HTMLElement>(s: string) =>
      root.querySelector(s) as T | null;

    const sub = q<HTMLElement>('.u096-sub');
    const price = q<HTMLElement>('.u096-p');
    const rainBadge = q<HTMLElement>('.u096-rain-badge');
    const pinHint = q<HTMLElement>('.u096-pin-hint');
    const ch = q<HTMLElement>('.u096-ch');
    const plot = q<HTMLElement>('.u096-plot');
    const tempLane = q<HTMLElement>('.u096-lane-temp');
    const svg = q<SVGSVGElement>('.u096-lane-temp svg');
    const tag = q<HTMLElement>('.u096-tag');
    const base = q<SVGPathElement>('.u096-base');
    const line = q<SVGPathElement>('.u096-line');
    const area = q<SVGPathElement>('.u096-area');
    const ref = q<SVGLineElement>('.u096-ref');
    const cur = q<SVGLineElement>('.u096-cur');
    const dot = q<SVGCircleElement>('.u096-dot');
    const ring = q<SVGCircleElement>('.u096-ring');
    const evPeak = q<SVGCircleElement>('.u096-ev-peak');
    const evLow = q<SVGCircleElement>('.u096-ev-low');
    const rect = q<SVGRectElement>('.u096-cp rect');
    const gd = q<SVGLinearGradientElement>('.u096-gd');
    const cp = q<SVGClipPathElement>('.u096-cp');
    const clipG = q<SVGGElement>('.u096-clip');
    const avgPill = q<HTMLElement>('.u096-avg-pill');
    const pkCallout = q<HTMLElement>('.u096-callout.peak');
    const loCallout = q<HTMLElement>('.u096-callout.low');
    const helpBtn = q<HTMLButtonElement>('.u096-help-btn');
    const tipPop = q<HTMLElement>('.u096-tip-pop');

    const gls = Array.prototype.slice.call(
      root.querySelectorAll('.u096-gl')
    ) as HTMLElement[];
    const barEls = Array.prototype.slice.call(
      root.querySelectorAll('.u095-b')
    ) as HTMLElement[];
    const xTickEls = Array.prototype.slice.call(
      root.querySelectorAll('.u096-x-tick')
    ) as HTMLElement[];

    if (
      !sub ||
      !price ||
      !rainBadge ||
      !ch ||
      !plot ||
      !tempLane ||
      !svg ||
      !tag ||
      !base ||
      !line ||
      !area ||
      !ref ||
      !cur ||
      !dot ||
      !ring ||
      !evPeak ||
      !evLow ||
      !rect ||
      !gd ||
      !cp ||
      !clipG
    ) {
      return;
    }

    const uid = 'u096m' + Math.random().toString(36).slice(2, 7);
    gd.id = uid + 'g';
    cp.id = uid + 'c';
    area.setAttribute('fill', 'url(#' + uid + 'g)');
    clipG.setAttribute('clip-path', 'url(#' + uid + 'c)');

    const tipId = uid + '-explain';
    if (tipPop) {
      tipPop.id = tipId;
    }
    if (helpBtn) {
      helpBtn.setAttribute('aria-describedby', tipId);
    }

    const rm = Boolean(
      reduceMotion ||
        (typeof window !== 'undefined' &&
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    );

    const N = SAMPLE_COUNT;
    let W = Math.max(220, Math.round(tempLane.clientWidth || 320));
    const H_TEMP = 124;
    const H_TOTAL = 200; // 124 (temp) + 18 (divider) + 58 (rain)
    const PT = 18;
    const PB = 16;
    const PL = 10;
    const PR = 10;

    let ys: number[] | null = null;
    let at = N - 1;
    let scrub = false;
    let pinnedSlot = -1;
    let tw = 0;
    let back = 0;
    let explainPinned = false;

    function syncSvgViewport(): void {
      const nextW = Math.max(220, Math.round(tempLane!.clientWidth || 320));
      W = nextW;
      svg!.setAttribute('viewBox', `0 0 ${W} ${H_TEMP}`);
      ref!.setAttribute('x1', String(PL));
      ref!.setAttribute('x2', String(W - PR));
      cur!.setAttribute('y1', '6');
      cur!.setAttribute('y2', String(H_TOTAL));
      rect!.setAttribute('height', String(H_TEMP + 30));
    }

    function setExplainVisible(visible: boolean): void {
      if (!tipPop) return;
      tipPop.classList.toggle('on', visible);
      tipPop.setAttribute('aria-hidden', visible ? 'false' : 'true');
      if (helpBtn) {
        helpBtn.classList.toggle('on', visible);
        helpBtn.setAttribute('aria-expanded', visible ? 'true' : 'false');
      }
    }

    function yForTemp(val: number): number {
      const span = Math.max(1, model.axisMaxTemp - model.axisMinTemp);
      const norm = (val - model.axisMinTemp) / span;
      return PT + (1 - norm) * (H_TEMP - PT - PB);
    }

    function proj(): number[] {
      return model.denseTempCurve.map((val) => yForTemp(val));
    }

    function X(i: number): number {
      return PL + (i / (N - 1)) * (W - PL - PR);
    }

    function buildPath(yArr: number[]): string {
      return yArr
        .map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + v.toFixed(1))
        .join('');
    }

    function yAt(i: number): number {
      if (!ys || ys.length === 0) return H_TEMP - PB;
      const clamped = Math.max(0, Math.min(N - 1, i));
      const a = Math.floor(clamped);
      const b = Math.min(N - 1, a + 1);
      return ys[a] + (ys[b] - ys[a]) * (clamped - a);
    }

    function nearestSlotIndex(sampleIndex: number): number {
      const slotCount = model.slots.length;
      return Math.max(
        0,
        Math.min(slotCount - 1, Math.round(sampleIndex / model.sampleStep))
      );
    }

    function syncAxesAndBars(): void {
      const tickVals = [model.axisMinTemp, model.axisMidTemp, model.axisMaxTemp];
      const yMeanEst = yForTemp(model.meanTempC);

      gls.forEach((g, j) => {
        const yGrid = PT + (1 - j / 2) * (H_TEMP - PT - PB);
        g.style.top = `${yGrid.toFixed(1)}px`;
        const spanEl = g.firstElementChild as HTMLElement | null;
        if (!spanEl) return;
        const tickVal = tickVals[j] ?? model.axisMinTemp;
        spanEl.textContent = `${Math.round(tickVal)}°`;
        spanEl.style.opacity = Math.abs(yGrid - yMeanEst) < 14 ? '0' : '1';
      });

      const slotSpacing = (W - PL - PR) / Math.max(1, model.slots.length - 1);
      const barWidth = Math.max(4.5, Math.min(11, slotSpacing * 0.62));

      barEls.forEach((bEl, m) => {
        const slot = model.slots[m];
        if (!slot) return;
        const xPx = X(m * model.sampleStep);
        const leftPct = (xPx / W) * 100;
        bEl.style.left = `${leftPct.toFixed(3)}%`;
        bEl.style.setProperty('--bw', `${barWidth.toFixed(1)}px`);
        bEl.style.setProperty('--d', String(m));
        bEl.style.setProperty('--h', slot.barHeightRatio.toFixed(3));
        bEl.classList.toggle('wet', slot.barMode === 'wet');
        bEl.classList.toggle('drizzle', slot.barMode === 'drizzle');
        bEl.classList.toggle('dry', slot.barMode === 'dry');
        bEl.classList.toggle('edge-l', m <= 3);
        bEl.classList.toggle('edge-r', m >= model.slots.length - 4);
        bEl.classList.toggle('show-val', slot.showInlineLabel);
        const valEl = bEl.querySelector('.u095-b-val');
        if (valEl) {
          valEl.textContent = slot.barInlineLabel;
        }
      });

      xTickEls.forEach((el, idx) => {
        const tick = model.xTicks[idx];
        if (!tick) return;
        const xPx = X(tick.slotIdx * model.sampleStep);
        const leftPct = (xPx / W) * 100;
        el.classList.toggle('first', idx === 0);
        el.classList.toggle('last', idx === model.xTicks.length - 1);
        el.style.left = `${leftPct.toFixed(2)}%`;
        el.textContent = tick.label;
      });
    }

    function place(): void {
      if (!ys) return;
      const x = X(at);
      const y = yAt(at);
      const slotIdx = nearestSlotIndex(at);
      const slot = model.slots[slotIdx];
      const isActiveScrub = scrub || pinnedSlot >= 0;

      const clipW = at >= N - 1.05 ? W : x;
      rect!.setAttribute('width', clipW.toFixed(1));
      cur!.setAttribute('x1', x.toFixed(1));
      cur!.setAttribute('x2', x.toFixed(1));
      dot!.setAttribute('cx', x.toFixed(1));
      dot!.setAttribute('cy', y.toFixed(1));
      ring!.setAttribute('cx', x.toFixed(1));
      ring!.setAttribute('cy', y.toFixed(1));

      barEls.forEach((bEl, m) => {
        bEl.classList.toggle('on', isActiveScrub && m === slotIdx);
        bEl.classList.toggle('pin', m === pinnedSlot);
      });

      xTickEls.forEach((el, idx) => {
        const tick = model.xTicks[idx];
        if (!tick) return;
        const dist = Math.abs(tick.slotIdx - slotIdx);
        el.classList.toggle('on', isActiveScrub && dist <= 1);
      });

      if (isActiveScrub) {
        sub!.textContent = slot.subtitleVi;
        price!.textContent = `${slot.tempC.toFixed(1)}°C`;
        rainBadge!.textContent = slot.rainBadgeVi;
        rainBadge!.classList.toggle('wet', slot.rainMm >= 0.05 || slot.rainPct >= 20);
        if (pinHint) {
          pinHint.textContent =
            pinnedSlot >= 0 ? `Đã ghim ${slot.hh00} · Chạm để bỏ ghim` : '';
        }
      } else {
        sub!.textContent = model.restSubtitle;
        price!.textContent = model.restPrimaryReadout;
        rainBadge!.textContent = model.restRainBadge;
        rainBadge!.classList.toggle('wet', model.restHasWetRain);
        if (pinHint) {
          pinHint.textContent = '';
        }
      }

      tag!.textContent = slot.tagLabelVi;

      const cw = tempLane!.clientWidth || W;
      const tw2 = tag!.offsetWidth || 156;
      const px = (x / W) * cw;
      tag!.style.setProperty(
        '--tx',
        Math.max(2, Math.min(cw - tw2 - 2, px - tw2 / 2)).toFixed(1) + 'px'
      );

      const maxSlots = model.slots.length - 1;
      ch!.setAttribute('aria-valuemax', String(maxSlots));
      ch!.setAttribute('aria-valuenow', String(slotIdx));
      ch!.setAttribute('aria-valuetext', slot.tagLabelVi);
    }

    function paint(): void {
      if (!ys) return;
      const p = buildPath(ys);
      const baseBottom = H_TEMP - PB + 4;
      base!.setAttribute('d', p);
      line!.setAttribute('d', p);
      area!.setAttribute(
        'd',
        `${p}L${X(N - 1).toFixed(1)} ${baseBottom.toFixed(1)}L${X(0).toFixed(1)} ${baseBottom.toFixed(1)}Z`
      );

      const vertexCount = model.slots.length;
      let sumY = 0;
      for (let m = 0; m < vertexCount; m += 1) {
        sumY += ys[m * model.sampleStep];
      }
      const yMean = sumY / Math.max(1, vertexCount);
      ref!.setAttribute('y1', yMean.toFixed(1));
      ref!.setAttribute('y2', yMean.toFixed(1));
      if (avgPill) {
        avgPill.style.top = `${yMean.toFixed(1)}px`;
        avgPill.textContent = `TB ${Math.round(model.meanTempC)}°`;
      }

      gls.forEach((g, j) => {
        const yGrid = PT + (1 - j / 2) * (H_TEMP - PT - PB);
        const spanEl = g.firstElementChild as HTMLElement | null;
        if (spanEl) {
          spanEl.style.opacity = Math.abs(yGrid - yMean) < 14 ? '0' : '1';
        }
      });

      const ePeak = model.peakTempSampleIdx;
      const pkX = X(ePeak);
      const pkY = ys[ePeak];
      evPeak!.setAttribute('cx', pkX.toFixed(1));
      evPeak!.setAttribute('cy', pkY.toFixed(1));

      const eLow = model.lowTempSampleIdx;
      const loX = X(eLow);
      const loY = ys[eLow];
      evLow!.setAttribute('cx', loX.toFixed(1));
      evLow!.setAttribute('cy', loY.toFixed(1));

      const cw = tempLane!.clientWidth || W;
      if (pkCallout) {
        pkCallout.textContent = model.peakTempCallout;
        const pkW = pkCallout.offsetWidth || 30;
        const pkTx = Math.max(
          2,
          Math.min(cw - pkW - 2, (pkX / W) * cw - pkW / 2)
        );
        const pkTy = Math.max(1, pkY - 17);
        pkCallout.style.setProperty('--tx', `${pkTx.toFixed(1)}px`);
        pkCallout.style.setProperty('--ty', `${pkTy.toFixed(1)}px`);
      }

      if (loCallout) {
        const sameAsPeak = model.lowTempSlotIdx === model.peakTempSlotIdx;
        loCallout.classList.toggle('off', sameAsPeak);
        if (!sameAsPeak) {
          loCallout.textContent = model.lowTempCallout;
          const loW = loCallout.offsetWidth || 30;
          const loTx = Math.max(
            2,
            Math.min(cw - loW - 2, (loX / W) * cw - loW / 2)
          );
          const loTy = Math.min(H_TEMP - 13, loY + 7);
          loCallout.style.setProperty('--tx', `${loTx.toFixed(1)}px`);
          loCallout.style.setProperty('--ty', `${loTy.toFixed(1)}px`);
        }
      }

      place();
    }

    function morph(to: number[]): void {
      cancelAnimationFrame(tw);
      const from = ys ? ys.slice() : to.map(() => H_TEMP - PB);
      const t0 = performance.now();
      const dur = rm ? 1 : 620;
      const step = (n: number) => {
        if (!root || !root.isConnected) return;
        const t = Math.min(1, (n - t0) / dur);
        const e =
          t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        ys = from.map((y, i) => y + (to[i] - y) * e);
        paint();
        if (t < 1) {
          tw = requestAnimationFrame(step);
        }
      };
      step(t0);
    }

    function goBack(targetAt = N - 1): void {
      cancelAnimationFrame(back);
      const from = at;
      const t0 = performance.now();
      const dur = rm ? 1 : 420;
      const step = (n: number) => {
        if (!root || !root.isConnected) return;
        const t = Math.min(1, (n - t0) / dur);
        const e = 1 - Math.pow(1 - t, 3);
        at = from + (targetAt - from) * e;
        place();
        if (t < 1) {
          back = requestAnimationFrame(step);
        }
      };
      step(t0);
    }

    function idx(clientX: number): number {
      const r = tempLane!.getBoundingClientRect();
      const width = Math.max(1, r.width);
      const relX = ((clientX - r.left) / width) * W;
      const ratio = (relX - PL) / Math.max(1, W - PL - PR);
      return Math.max(0, Math.min(N - 1, ratio * (N - 1)));
    }

    function start(clientX: number): void {
      cancelAnimationFrame(back);
      scrub = true;
      root!.classList.add('scrub');
      at = idx(clientX);
      place();
    }

    function end(): void {
      if (!scrub && pinnedSlot < 0) return;
      scrub = false;
      if (pinnedSlot >= 0) {
        const targetSample = pinnedSlot * model.sampleStep;
        root!.classList.add('scrub', 'pinned');
        goBack(targetSample);
      } else {
        root!.classList.remove('scrub', 'pinned');
        goBack(N - 1);
      }
    }

    const cleanups: Array<() => void> = [];
    let touching = false;
    let downX = 0;
    let downY = 0;

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
      if (e.pointerType === 'mouse') return;
      touching = true;
      try {
        ch.setPointerCapture(e.pointerId);
      } catch {
        // ignore if unsupported
      }
      start(e.clientX);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || touching) {
        start(e.clientX);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (moved < 8) {
        const clickedSlot = nearestSlotIndex(idx(e.clientX));
        if (pinnedSlot === clickedSlot) {
          pinnedSlot = -1;
          root.classList.remove('pinned');
        } else {
          pinnedSlot = clickedSlot;
          root.classList.add('scrub', 'pinned');
          at = pinnedSlot * model.sampleStep;
          place();
        }
      }
      if (touching) {
        touching = false;
        end();
      }
    };

    const onPointerCancel = () => {
      touching = false;
      end();
    };

    const onPointerLeave = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        end();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const step = model.sampleStep;
      const stepMap: Record<string, number | undefined> = {
        ArrowLeft: -step,
        ArrowRight: step,
      };
      let s = stepMap[e.key];
      if (e.key === 'Escape') {
        pinnedSlot = -1;
        root.classList.remove('pinned');
        end();
        return;
      }
      if (e.key === 'Home') s = -N;
      else if (e.key === 'End') s = N;
      if (s === undefined) return;
      e.preventDefault();
      cancelAnimationFrame(back);
      scrub = true;
      root.classList.add('scrub');
      const curSlot = nearestSlotIndex(at);
      const nextSample = Math.max(0, Math.min(N - 1, curSlot * step + s));
      at = nextSample;
      place();
    };

    const onBlur = () => {
      end();
    };

    ch.addEventListener('pointerdown', onPointerDown);
    ch.addEventListener('pointermove', onPointerMove);
    ch.addEventListener('pointerup', onPointerUp);
    ch.addEventListener('pointercancel', onPointerCancel);
    ch.addEventListener('pointerleave', onPointerLeave);
    ch.addEventListener('keydown', onKeyDown);
    ch.addEventListener('blur', onBlur);

    cleanups.push(() => {
      ch.removeEventListener('pointerdown', onPointerDown);
      ch.removeEventListener('pointermove', onPointerMove);
      ch.removeEventListener('pointerup', onPointerUp);
      ch.removeEventListener('pointercancel', onPointerCancel);
      ch.removeEventListener('pointerleave', onPointerLeave);
      ch.removeEventListener('keydown', onKeyDown);
      ch.removeEventListener('blur', onBlur);
    });

    if (helpBtn) {
      const onHelpClick = (e: MouseEvent) => {
        e.stopPropagation();
        explainPinned = !explainPinned;
        setExplainVisible(explainPinned);
      };
      const onHelpEnter = (e: PointerEvent) => {
        if (e.pointerType !== 'touch') setExplainVisible(true);
      };
      const onHelpLeave = (e: PointerEvent) => {
        if (e.pointerType !== 'touch' && !explainPinned) setExplainVisible(false);
      };
      const onHelpFocus = () => setExplainVisible(true);
      const onHelpBlur = () => {
        if (!explainPinned) setExplainVisible(false);
      };
      helpBtn.addEventListener('click', onHelpClick);
      helpBtn.addEventListener('pointerenter', onHelpEnter);
      helpBtn.addEventListener('pointerleave', onHelpLeave);
      helpBtn.addEventListener('focus', onHelpFocus);
      helpBtn.addEventListener('blur', onHelpBlur);
      cleanups.push(() => {
        helpBtn.removeEventListener('click', onHelpClick);
        helpBtn.removeEventListener('pointerenter', onHelpEnter);
        helpBtn.removeEventListener('pointerleave', onHelpLeave);
        helpBtn.removeEventListener('focus', onHelpFocus);
        helpBtn.removeEventListener('blur', onHelpBlur);
      });
    }

    const onDocPointerDown = (e: PointerEvent) => {
      if (explainPinned && !root.contains(e.target as Node | null)) {
        explainPinned = false;
        setExplainVisible(false);
      }
    };
    const onRootKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && explainPinned) {
        explainPinned = false;
        setExplainVisible(false);
      }
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    root.addEventListener('keydown', onRootKeyDown);
    cleanups.push(() => {
      document.removeEventListener('pointerdown', onDocPointerDown);
      root.removeEventListener('keydown', onRootKeyDown);
    });

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        if (!root.isConnected) return;
        syncSvgViewport();
        syncAxesAndBars();
        ys = proj();
        paint();
      });
      ro.observe(tempLane);
      cleanups.push(() => ro.disconnect());
    }

    syncSvgViewport();
    syncAxesAndBars();
    morph(proj());

    return () => {
      cancelAnimationFrame(tw);
      cancelAnimationFrame(back);
      cleanups.forEach((fn) => fn());
    };
  }, [model, reduceMotion]);

  if (Platform.OS !== 'web') {
    return (
      <View
        style={[
          nativeStyles.fallbackCard,
          {
            backgroundColor: palette.coreSurfaceBg,
            borderColor: palette.bezelOuterBorder,
          },
        ]}
      >
        <Text style={[nativeStyles.fallbackTitle, { color: palette.inkPrimary }]}>
          {model.restSubtitle}
        </Text>
        <Text style={[nativeStyles.fallbackSub, { color: palette.inkSecondary }]}>
          {model.adviceVi}
        </Text>
      </View>
    );
  }

  const uxVars = buildPaletteUxVars(palette) as React.CSSProperties;

  return (
    <div
      ref={rootRef}
      className="ux u096"
      data-theme={palette.isDark ? 'dark' : 'light'}
      style={uxVars}
    >
      <div className="u096-h">
        <div className="u096-top">
          <small>
            <i aria-hidden="true" />
            <span className="u096-sub">{model.restSubtitle}</span>
          </small>

          <div className="u096-head-right">
            <div
              className="u096-legend"
              role="note"
              aria-label="Chú giải biểu đồ 24 giờ"
            >
              <span className="u096-leg-item">
                <i className="u096-leg-line" aria-hidden="true" />
                <span>Nhiệt độ</span>
              </span>
              <span className="u096-leg-item">
                <i className="u096-leg-bar" aria-hidden="true" />
                <span>Lượng mưa</span>
              </span>
            </div>

            <button
              type="button"
              className="u096-help-btn"
              aria-label="Giải thích biểu đồ 24 giờ"
              aria-expanded="false"
            >
              ?
            </button>
          </div>
        </div>

        <div className="u096-p-row" aria-live="polite">
          <div className="u096-p-wrap">
            <span className="u096-p-lead">
              <i className="u096-p-dot" aria-hidden="true" />
              <b className="u096-p">{model.restPrimaryReadout}</b>
            </span>
            <span
              className={`u096-rain-badge${model.restHasWetRain ? ' wet' : ''}`}
            >
              {model.restRainBadge}
            </span>
          </div>
          <span className="u096-pin-hint" />
        </div>
      </div>

      <div
        className="u096-ch"
        tabIndex={0}
        role="slider"
        aria-label="Biểu đồ 2 tầng nhiệt độ (°C) và lượng mưa (mm, %) 24 giờ — lướt, chạm hoặc dùng phím mũi tên trái/phải để xem từng giờ"
        aria-valuemin={0}
        aria-valuemax={24}
        aria-valuenow={24}
      >
        <div className="u096-plot">
          <div className="u096-lane-temp">
            <div className="u096-grid" aria-hidden="true">
              {TEMP_GRID_INDICES.map((idx) => (
                <div key={idx} className="u096-gl">
                  <span />
                </div>
              ))}
            </div>

            <svg viewBox="0 0 340 124" aria-hidden="true">
              <defs>
                <linearGradient className="u096-gd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopOpacity=".26" />
                  <stop offset="1" stopOpacity="0" />
                </linearGradient>
                <clipPath className="u096-cp">
                  <rect x="0" y="-20" height="160" width="340" />
                </clipPath>
              </defs>
              <line className="u096-ref" x1="10" x2="330" />
              <path className="u096-base" />
              <g className="u096-clip">
                <path className="u096-area" />
                <path className="u096-line" />
              </g>
              <circle className="u096-ev-peak" r="3" />
              <circle className="u096-ev-low" r="3" />
              <line className="u096-cur" y1="6" y2="200" />
              <circle className="u096-ring" r="4.8" />
              <circle className="u096-dot" r="5" />
            </svg>

            <span className="u096-avg-pill" aria-hidden="true">
              TB {Math.round(model.meanTempC)}°
            </span>
            <span className="u096-callout peak" aria-hidden="true">
              {model.peakTempCallout}
            </span>
            <span className="u096-callout low" aria-hidden="true">
              {model.lowTempCallout}
            </span>
          </div>

          <div className="u096-lane-div" aria-hidden="true">
            <span>Lượng mưa (mm/giờ) &amp; Xác suất mưa (%)</span>
          </div>

          <div className="u096-lane-rain">
            <div className="u096-rain-axis" aria-hidden="true">
              <span className="u096-rain-tick">{model.axisMaxRainMm} mm</span>
              <span className="u096-rain-tick">0 mm</span>
            </div>

            <div className="u095-bars" aria-hidden="true">
              {SLOT_INDICES.map((idx) => (
                <div key={idx} className="u095-b">
                  <u className="u095-b-val" />
                  <i />
                </div>
              ))}
            </div>
          </div>

          <span className="u096-tag" aria-hidden="true" />
        </div>

        <div className="u096-x" aria-hidden="true">
          {X_TICK_SLOTS.map((slot) => (
            <span key={slot} className="u096-x-tick" />
          ))}
        </div>
      </div>

      <div className="u096-adv" role="note" aria-label="Lời khuyên dự báo 24 giờ">
        <span className="u096-adv-ic" aria-hidden="true">
          <Sparkle
            size={13}
            weight="duotone"
            color={palette.isDark ? '#F0AE43' : '#C87416'}
          />
        </span>
        <span className="u096-adv-txt">{model.adviceVi}</span>
      </div>

      <div className="u096-tip-pop" role="tooltip" aria-hidden="true">
        <div className="u096-tip-hdr">
          <span className="u096-tip-dot" aria-hidden="true" />
          <strong className="u096-tip-title">{model.titleVi}</strong>
        </div>
        <p className="u096-tip-body">{model.explainVi}</p>
      </div>
    </div>
  );
};

const nativeStyles = StyleSheet.create({
  fallbackCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  fallbackTitle: {
    fontFamily: FONT_FAMILY_DISPLAY,
    fontSize: 15,
    fontWeight: '700',
  },
  fallbackSub: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13,
    lineHeight: 18,
  },
});

/* Lucian UX/UI Prompt #096 & #095 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#096 · https://lucianlabs.dev/uxui-prompt/#095 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { CloudRain, Drop, Thermometer } from '../components/AppIcons';
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

const STYLE_ELEMENT_ID = 'lucian-u096-u095-three-charts-24h-css';

/**
 * Genuine Lucian UX/UI Prompt #096 ("Stock line that splits as you scrub")
 * and #095 ("Bar chart that changes shape") ported into 3 dedicated, synchronized
 * 24-hour forecast cards:
 * 1. Nhiệt độ 24 giờ (°C) — #096 Scrub-Split Line Chart in Warm Sunlight Amber-Gold
 * 2. Độ ẩm không khí 24 giờ (%) — #096 Scrub-Split Area-Line Chart in Mineral Emerald-Teal
 * 3. Mưa & Lượng mưa 24 giờ (% & mm/h) — Combined #096 Sky-Cobalt Probability Line + #095 Aqua-Cyan Rainfall Columns
 */
const LUCIAN_U096_U095_SUITE_CSS = `/* Lucian UX/UI Prompt #096 & #095 · 3-Card Synchronized 24h Weather Suite */
.u096-suite{--temp:var(--u096-temp,#F0AE43);--hum:var(--u096-hum,#38B889);--rain-prob:var(--u096-rain-prob,#60A5FA);--rain-mm:var(--u096-rain-mm,#22D3EE);position:relative;width:100%;max-width:100%;display:flex;flex-direction:column;gap:10px}
.u096-suite-bar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:2px 4px}
.u096-suite-title-wrap{display:flex;align-items:center;gap:8px;min-width:0}
.u096-suite-pip{width:9px;height:9px;border-radius:3px;background:linear-gradient(135deg,var(--temp),var(--hum),var(--rain-prob));flex:none}
.u096-suite-title{margin:0;font-size:13.5px;font-weight:820;letter-spacing:-.015em;color:var(--ux-ink);line-height:1.3}
.u096-suite-sync{display:inline-flex;align-items:center;gap:6px;height:25px;padding:0 10px;border-radius:999px;background:var(--ux-surface-2);border:1px solid var(--ux-line);font-size:11.2px;font-weight:750;color:var(--ux-ink-2);font-variant-numeric:tabular-nums;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;transition:background-color .2s,border-color .2s,color .2s}
.u096-suite.scrub .u096-suite-sync{background:var(--ux-accent-soft);border-color:color-mix(in srgb,var(--ux-accent) 42%,transparent);color:var(--ux-ink)}
.u096-suite.pinned .u096-suite-sync{cursor:pointer;background:color-mix(in srgb,var(--temp) 16%,var(--ux-surface-2));border-color:color-mix(in srgb,var(--temp) 48%,transparent);color:var(--ux-ink)}
.u096-suite-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;width:100%;max-width:100%}
@media (min-width:1080px){
  .u096-suite-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
}
.u096{--c:var(--temp);position:relative;width:100%;max-width:100%;height:auto;display:flex;flex-direction:column;justify-content:space-between;padding:14px 15px 13px;border-radius:22px;background:var(--ux-surface);box-shadow:0 0 0 1px var(--ux-line),0 22px 48px -34px var(--ux-shadow-strong);overflow:hidden;min-width:0}
.u096[data-card="temp"]{--c:var(--temp)}
.u096[data-card="hum"]{--c:var(--hum)}
.u096[data-card="rain"]{--c:var(--rain-prob)}
.u096-h{display:flex;flex-direction:column;gap:5px;min-width:0}
.u096-top{display:flex;align-items:center;justify-content:space-between;gap:6px;min-width:0}
.u096-h small{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:770;color:var(--ux-ink-2);line-height:1.3;min-width:0;flex:1}
.u096-h small i{width:10px;height:10px;border-radius:3.5px;background:var(--c);box-shadow:0 0 0 2.5px color-mix(in srgb,var(--c) 20%,transparent);flex:none}
.u096[data-card="rain"] .u096-h small i{background:linear-gradient(135deg,var(--rain-prob),var(--rain-mm))}
.u096-card-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.u096-head-right{display:flex;align-items:center;gap:5px;flex:none}
.u096-mini-leg{display:inline-flex;align-items:center;gap:7px;padding:2px 7px;border-radius:999px;background:var(--ux-surface-2);border:1px solid var(--ux-line)}
.u096-leg-i{display:inline-flex;align-items:center;gap:3.5px;font-size:10px;font-weight:770;color:var(--ux-ink-2);white-space:nowrap}
.u096-leg-ln{width:11px;height:2.2px;border-radius:2px;background:var(--rain-prob);display:inline-block}
.u096-leg-br{width:6px;height:9px;border-radius:2px 2px 1px 1px;background:var(--rain-mm);display:inline-block}
.u096-help-btn{display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;padding:0;border-radius:50%;border:1px solid var(--ux-line-2);background:var(--ux-surface-2);color:var(--ux-ink-3);font-size:10.8px;font-weight:800;flex:none;transition:background-color .2s,color .2s,border-color .2s}
.u096-help-btn:hover,.u096-help-btn:focus-visible,.u096-help-btn.on{background:var(--ux-accent-soft);color:var(--ux-ink);border-color:var(--c)}
.u096-p-row{display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:6px;min-width:0}
.u096-p-wrap{display:flex;align-items:center;flex-wrap:wrap;gap:7px;min-width:0}
.u096-p{display:block;margin:0;font-size:21px;font-weight:860;letter-spacing:-.035em;line-height:1.15;font-variant-numeric:tabular-nums;color:var(--ux-ink)}
.u096-badge{display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 8.5px;border-radius:999px;font-size:10.8px;font-weight:780;color:var(--c);background:color-mix(in srgb,var(--c) 13%,transparent);border:1px solid color-mix(in srgb,var(--c) 28%,transparent);font-variant-numeric:tabular-nums;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.u096[data-card="rain"] .u096-badge.wet{color:var(--rain-mm);background:color-mix(in srgb,var(--rain-mm) 15%,transparent);border-color:color-mix(in srgb,var(--rain-mm) 36%,transparent)}
.u096-sub-meta{font-size:10.6px;font-weight:730;color:var(--ux-ink-3);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.u096-ch{position:relative;flex:none;height:180px;margin:6px 0 0;padding:0 38px 0 4px;touch-action:pan-y;user-select:none;cursor:crosshair;outline:none;border-radius:12px}
.u096[data-card="rain"] .u096-ch{padding:0 40px 0 34px}
.u096-ch:focus,.u096-ch:focus-visible{outline:none;box-shadow:0 0 0 1.5px color-mix(in srgb,var(--c) 52%,transparent)}
.u096-plot{position:relative;width:100%;height:156px}
.u096-plot svg{position:relative;z-index:3;display:block;width:100%;height:156px;overflow:visible}
.u096-grid{position:absolute;inset:0;pointer-events:none;z-index:0}
.u096-gl{position:absolute;left:0;right:0;height:0;border-top:1px dashed var(--ux-line-2)}
.u096-gl:last-child{border-top-style:solid}
.u096-gl-r{position:absolute;right:-38px;top:-7px;width:35px;text-align:right;font-size:9.8px;font-weight:750;color:var(--ux-ink-3);font-variant-numeric:tabular-nums;white-space:nowrap;transition:opacity .2s}
.u096[data-card="rain"] .u096-gl-r{right:-40px;width:37px;color:var(--rain-mm)}
.u096-gl-l{position:absolute;left:-34px;top:-7px;width:30px;text-align:left;font-size:9.8px;font-weight:760;color:var(--rain-prob);font-variant-numeric:tabular-nums;white-space:nowrap}
.u096-avg-pill{position:absolute;right:-38px;top:0;width:35px;text-align:right;font-size:9.5px;font-weight:820;color:var(--c);font-variant-numeric:tabular-nums;white-space:nowrap;transform:translateY(-50%);pointer-events:none;z-index:4}
.u096-base{fill:none;stroke:var(--ux-ink-3);stroke-opacity:.32;stroke-width:2.1;stroke-linejoin:round;stroke-linecap:round}
.u096-line{fill:none;stroke:var(--c);stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round;transition:stroke .3s}
.u096-gd stop{stop-color:var(--c);transition:stop-color .3s}
.u096-ref{stroke:var(--c);stroke-opacity:.44;stroke-width:1.15;stroke-dasharray:3 4}
.u096-cur{stroke:var(--ux-ink-3);stroke-width:1.15;stroke-dasharray:2 3;opacity:0;transition:opacity .18s}
.u096.scrub .u096-cur{opacity:.82}
.u096-ev-peak{fill:var(--c);stroke:var(--ux-surface);stroke-width:1.6}
.u096-ev-low{fill:var(--ux-surface);stroke:var(--c);stroke-width:1.8}
.u096-dot{fill:var(--c);stroke:var(--ux-surface);stroke-width:2.2;opacity:.92;transition:opacity .18s,transform .18s;transform-box:fill-box;transform-origin:center}
.u096-ring{fill:none;stroke:var(--c);stroke-width:1.6;opacity:0;transform-box:fill-box;transform-origin:center;transition:opacity .18s,transform .18s}
.u096.scrub .u096-dot{opacity:1;transform:scale(1.12)}
.u096.scrub .u096-ring{opacity:.44;transform:scale(1.38)}
.u096.pinned .u096-ring{opacity:.86;transform:scale(1.52)}
.u096-callout{position:absolute;left:0;top:0;z-index:4;font-size:10px;font-weight:840;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap;pointer-events:none;text-shadow:0 1px 4px var(--ux-surface),0 0 8px var(--ux-surface);transform:translate(var(--tx,0),var(--ty,0));transition:opacity .18s}
.u096-callout.peak{color:var(--c)}
.u096-callout.low{color:var(--ux-ink-2)}
.u096-callout.off,.u096.scrub .u096-callout{opacity:0}
.u095-bars{position:absolute;left:0;right:0;top:18px;bottom:16px;z-index:2;pointer-events:none}
.u095-b{position:absolute;bottom:0;height:100%;width:var(--bw,7px);transform:translateX(-50%);display:flex;flex-direction:column;justify-content:flex-end;align-items:center;pointer-events:none}
.u095-b i{display:block;width:100%;height:calc(var(--h,0) * 100%);border-radius:4px 4px 1px 1px;background:linear-gradient(180deg,var(--rain-mm),color-mix(in srgb,var(--rain-mm) 38%,transparent));opacity:.88;transition:height .55s var(--ux-spring),opacity .2s,transform .18s;transition-delay:calc(var(--d,0) * 10ms),0s,0s}
.u095-b.dry i{height:0;opacity:0}
.u095-b-val{position:absolute;bottom:calc(var(--h,0) * 100% + 3px);left:50%;transform:translateX(-50%);font-size:9.1px;font-weight:830;color:var(--rain-mm);text-decoration:none;font-variant-numeric:tabular-nums;white-space:nowrap;line-height:1;text-shadow:0 1px 4px var(--ux-surface);opacity:0;transition:opacity .18s}
.u095-b.edge-l .u095-b-val{left:0;transform:none}
.u095-b.edge-r .u095-b-val{left:auto;right:0;transform:none}
.u095-b.show-val:not(.dry) .u095-b-val{opacity:.95}
.u096.scrub .u095-b:not(.on) i{opacity:.28}
.u096.scrub .u095-b.dry:not(.on) i{opacity:0}
.u096.scrub .u095-b:not(.on) .u095-b-val{opacity:0}
.u095-b.on:not(.dry) i{opacity:1;transform:scaleX(1.22)}
.u095-b.on:not(.dry) .u095-b-val{opacity:1}
.u095-b.pin:not(.dry) i{box-shadow:0 0 0 1.5px var(--ux-surface),0 0 0 2.5px var(--rain-mm)}
.u096-tag{position:absolute;top:-3px;left:0;z-index:6;height:21px;padding:0 7.5px;border-radius:6px;display:flex;align-items:center;gap:4px;background:var(--ux-ink);color:var(--ux-page);font-size:10.3px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap;pointer-events:none;box-shadow:0 6px 14px -6px var(--ux-shadow-strong);transform:translateX(var(--tx,0));opacity:0;transition:opacity .18s}
.u096.scrub .u096-tag{opacity:1}
.u096-x{position:relative;height:22px;margin-top:2px;display:flex;align-items:center;justify-content:space-between;pointer-events:none}
.u096-x-tick{position:absolute;top:4px;transform:translateX(-50%);font-size:9.8px;font-weight:730;color:var(--ux-ink-3);font-variant-numeric:tabular-nums;white-space:nowrap;transition:color .2s,font-weight .2s}
.u096-x-tick.first{transform:none}
.u096-x-tick.last{transform:translateX(-100%)}
.u096-x-tick.on{color:var(--ux-ink);font-weight:850}
.u096-adv{display:flex;align-items:flex-start;gap:6.5px;margin-top:7px;padding:7.5px 9.5px;border-radius:11px;background:linear-gradient(125deg,color-mix(in srgb,var(--c) 10%,transparent),transparent 90%),var(--ux-surface-2);border:1px solid var(--ux-line);font-size:11.1px;line-height:1.38;font-weight:640;color:var(--ux-ink-2)}
.u096-adv-ic{display:inline-grid;place-items:center;flex:none;margin-top:1px}
.u096-adv-txt{min-width:0;flex:1}
.u096-tip-pop{position:absolute;left:10px;right:10px;top:64px;z-index:30;padding:10px 11px;border-radius:13px;background:var(--ux-surface);border:1px solid var(--ux-line-2);box-shadow:0 16px 34px -12px var(--ux-shadow-strong),0 0 0 1px var(--ux-accent-soft);backdrop-filter:blur(12px);pointer-events:none;opacity:0;visibility:hidden;transform:translateY(-4px) scale(.985);transition:opacity .18s var(--ux-ease),transform .22s var(--ux-spring),visibility 0s .18s}
.u096-tip-pop.on{opacity:1;visibility:visible;transform:translateY(0) scale(1);transition:opacity .18s var(--ux-ease),transform .22s var(--ux-spring)}
.u096-tip-hdr{display:flex;align-items:center;gap:6px;margin-bottom:4px}
.u096-tip-dot{width:6.5px;height:6.5px;border-radius:50%;background:var(--c);flex:none}
.u096-tip-title{font-size:11.6px;font-weight:800;color:var(--ux-ink)}
.u096-tip-body{margin:0;font-size:11.1px;line-height:1.42;font-weight:580;color:var(--ux-ink-2)}
@media (max-width:460px){
  .u096{padding:12px 12px 11px}
  .u096-p{font-size:19px}
  .u096-ch{padding-right:35px}
  .u096-gl-r,.u096-avg-pill{right:-35px;width:32px;font-size:9.3px}
  .u096[data-card="rain"] .u096-ch{padding:0 37px 0 31px}
  .u096[data-card="rain"] .u096-gl-r{right:-37px;width:34px}
  .u096-gl-l{left:-31px;width:28px;font-size:9.3px}
  .u096-x-tick{font-size:9.3px}
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
      '--ux-mint': palette.thermalMild,
      '--ux-warn': palette.thermalWarm,
      '--ux-danger': '#F27482',
      '--ux-shadow-strong': 'rgba(4, 6, 11, 0.72)',
      '--temp': palette.thermalWarm,
      '--u096-temp': palette.thermalWarm,
      '--hum': palette.thermalMild,
      '--u096-hum': palette.thermalMild,
      '--rain-prob': palette.accent,
      '--u096-rain-prob': palette.accent,
      '--rain-mm': '#38C7E8',
      '--u096-rain-mm': '#38C7E8',
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
    '--ux-line-2': palette.bezelOuterBorder,
    '--ux-accent': palette.accent,
    '--ux-accent-2': palette.thermalCool,
    '--ux-accent-soft': palette.accentSoftBg,
    '--ux-accent-ink': palette.accentContrastInk,
    '--ux-mint': palette.thermalMild,
    '--ux-warn': palette.thermalWarm,
    '--ux-danger': '#BE3145',
    '--ux-shadow-strong': 'rgba(17, 24, 36, 0.18)',
    '--temp': palette.thermalWarm,
    '--u096-temp': palette.thermalWarm,
    '--hum': palette.thermalMild,
    '--u096-hum': palette.thermalMild,
    '--rain-prob': palette.accent,
    '--u096-rain-prob': palette.accent,
    '--rain-mm': '#0E8FB0',
    '--u096-rain-mm': '#0E8FB0',
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

function describeHumidityStateVi(humidityPct: number): string {
  if (humidityPct < 40) return 'Hanh khô';
  if (humidityPct <= 68) return 'Dễ chịu';
  return 'Độ ẩm cao';
}

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

function computeHumidityAxisBounds(values: number[]): {
  axisMin: number;
  axisMid: number;
  axisMax: number;
} {
  const safe = values.filter((v) => Number.isFinite(v));
  const lo = safe.length > 0 ? Math.min(...safe) : 50;
  const hi = safe.length > 0 ? Math.max(...safe) : 85;
  let axisMin = Math.max(0, Math.floor((lo - 4) / 10) * 10);
  let axisMax = Math.min(100, Math.ceil((hi + 4) / 10) * 10);
  if (axisMax - axisMin < 20) {
    if (axisMax <= 90) axisMax += 10;
    else if (axisMin >= 10) axisMin -= 10;
  }
  if ((axisMax - axisMin) % 20 !== 0) {
    if (axisMin >= 10) axisMin -= 10;
    else if (axisMax <= 90) axisMax += 10;
  }
  const axisMid = Math.round((axisMin + axisMax) / 2);
  return { axisMin, axisMid, axisMax };
}

function computeNiceRainMaxMm(peakMm: number): number {
  if (!Number.isFinite(peakMm) || peakMm <= 2) return 2;
  if (peakMm <= 4) return 4;
  if (peakMm <= 6) return 6;
  if (peakMm <= 10) return 10;
  return Math.ceil(peakMm / 5) * 5;
}

function formatRainAxisMm(val: number): string {
  if (val <= 0) return '0 mm';
  return Number.isInteger(val) ? `${val} mm` : `${val.toFixed(1)} mm`;
}

/**
 * Monotone cubic Hermite interpolation (Fritsch-Carlson) resampling `raw` (length 25)
 * onto `targetN = 49` dense curve samples (`24 * 2 + 1`).
 */
function resampleMonotoneCubic(raw: number[], targetN: number, clampBounds?: [number, number]): number[] {
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
    let val = h00 * raw[k] + h10 * m[k] + h01 * raw[k + 1] + h11 * m[k + 1];
    if (clampBounds) {
      val = Math.max(clampBounds[0], Math.min(clampBounds[1], val));
    }
    out[i] = val;
  }
  return out;
}

export interface ForecastAxisTick {
  slotIdx: number;
  pct: number;
  label: string;
}

export interface Suite24hSlotPoint {
  plusHours: number;
  tempC: number;
  humidityPct: number;
  humidityStateVi: string;
  rainMm: number;
  rainPct: number;
  isWetMm: boolean;
  barHeightRatio: number;
  barInlineLabel: string;
  showInlineLabel: boolean;
  hh00: string;
  hhShort: string;
  ddMm: string;
  condVi: string;
  tempPrimaryVi: string;
  tempBadgeVi: string;
  tempMetaVi: string;
  tempTagVi: string;
  humPrimaryVi: string;
  humBadgeVi: string;
  humMetaVi: string;
  humTagVi: string;
  rainPrimaryVi: string;
  rainBadgeVi: string;
  rainMetaVi: string;
  rainTagVi: string;
}

export interface Suite24hForecastModel {
  sectionTitleVi: string;
  restSyncHintVi: string;
  sampleStep: number;
  slots: Suite24hSlotPoint[];
  xTicks: ForecastAxisTick[];
  tempCard: {
    titleVi: string;
    restPrimaryVi: string;
    restBadgeVi: string;
    restMetaVi: string;
    meanVal: number;
    axisMin: number;
    axisMid: number;
    axisMax: number;
    denseCurve: number[];
    peakSlotIdx: number;
    lowSlotIdx: number;
    peakSampleIdx: number;
    lowSampleIdx: number;
    peakCallout: string;
    lowCallout: string;
    adviceVi: string;
    explainVi: string;
  };
  humCard: {
    titleVi: string;
    restPrimaryVi: string;
    restBadgeVi: string;
    restMetaVi: string;
    meanVal: number;
    axisMin: number;
    axisMid: number;
    axisMax: number;
    denseCurve: number[];
    peakSlotIdx: number;
    lowSlotIdx: number;
    peakSampleIdx: number;
    lowSampleIdx: number;
    peakCallout: string;
    lowCallout: string;
    adviceVi: string;
    explainVi: string;
  };
  rainCard: {
    titleVi: string;
    restPrimaryVi: string;
    restBadgeVi: string;
    restMetaVi: string;
    restHasWetRain: boolean;
    totalRain24hMm: number;
    peakRainMm: number;
    maxRainPct: number;
    axisMaxRainMm: number;
    axisMidRainMm: number;
    denseProbCurve: number[];
    peakProbSlotIdx: number;
    peakProbSampleIdx: number;
    peakProbCallout: string;
    adviceVi: string;
    explainVi: string;
  };
}

const SAMPLE_COUNT = 49; // 24 hourly intervals * 2 + 1
const SLOT_INDICES = Array.from({ length: 25 }, (_, i) => i);
const X_TICK_SLOT_INDICES = [0, 5, 10, 15, 20, 24] as const;
const GRID_LEVEL_INDICES = [0, 1, 2] as const;

export const LucianInteractiveForecastChart: React.FC<
  LucianInteractiveForecastChartProps
> = ({ palette, weather, reduceMotion = false }) => {
  const suiteRef = useRef<HTMLDivElement | null>(null);

  const model: Suite24hForecastModel = useMemo(() => {
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
    const baseHumidity =
      typeof weather.humidityPct === 'number' && Number.isFinite(weather.humidityPct)
        ? Math.max(15, Math.min(100, Math.round(weather.humidityPct)))
        : 72;

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
          humidityPct: baseHumidity,
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

      const rawSlotHum = (slot as { humidityPct?: number } | undefined)?.humidityPct;
      const humidityPct =
        typeof rawSlotHum === 'number' && Number.isFinite(rawSlotHum)
          ? Math.max(15, Math.min(100, Math.round(rawSlotHum)))
          : Math.max(
              25,
              Math.min(
                99,
                Math.round(
                  baseHumidity -
                    (tempC - weather.temperatureC) * 2.6 +
                    rainPct * 0.16
                )
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
        humidityPct,
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
    const hums = rawPts.map((p) => p.humidityPct);
    const rainMms = rawPts.map((p) => p.rainMm);
    const rainPcts = rawPts.map((p) => p.rainPct);

    const loTemp = Math.min(...temps);
    const hiTemp = Math.max(...temps);
    const meanTempC =
      temps.reduce((sum, v) => sum + v, 0) / Math.max(1, temps.length);
    const spanTemp = Number((hiTemp - loTemp).toFixed(1));
    const tempBounds = computeTempAxisBounds(temps);

    const loHum = Math.min(...hums);
    const hiHum = Math.max(...hums);
    const meanHum =
      hums.reduce((sum, v) => sum + v, 0) / Math.max(1, hums.length);
    const humBounds = computeHumidityAxisBounds(hums);

    const upcomingMmSum = rawPts
      .slice(1)
      .reduce((sum, p) => sum + p.rainMm, 0);
    const totalRain24hMm = Number(
      Math.max(upcomingMmSum, rawPts[0].rainMm).toFixed(1)
    );
    const peakRainMm = Math.max(...rainMms);
    const maxRainPct = Math.max(...rainPcts);
    const axisMaxRainMm = computeNiceRainMaxMm(peakRainMm);
    const axisMidRainMm = Number((axisMaxRainMm / 2).toFixed(1));

    let peakTempSlotIdx = 0;
    let lowTempSlotIdx = 0;
    let peakHumSlotIdx = 0;
    let lowHumSlotIdx = 0;
    let peakProbSlotIdx = 0;
    let peakWetBarSlotIdx = -1;
    let bestWetMm = 0;

    rawPts.forEach((pt, idx) => {
      if (pt.tempC > rawPts[peakTempSlotIdx].tempC) peakTempSlotIdx = idx;
      if (pt.tempC < rawPts[lowTempSlotIdx].tempC) lowTempSlotIdx = idx;
      if (pt.humidityPct > rawPts[peakHumSlotIdx].humidityPct) peakHumSlotIdx = idx;
      if (pt.humidityPct < rawPts[lowHumSlotIdx].humidityPct) lowHumSlotIdx = idx;
      if (
        pt.rainPct > rawPts[peakProbSlotIdx].rainPct ||
        (pt.rainPct === rawPts[peakProbSlotIdx].rainPct &&
          pt.rainMm > rawPts[peakProbSlotIdx].rainMm)
      ) {
        peakProbSlotIdx = idx;
      }
      if (pt.rainMm >= 0.05 && pt.rainMm > bestWetMm) {
        bestWetMm = pt.rainMm;
        peakWetBarSlotIdx = idx;
      }
    });

    const slots: Suite24hSlotPoint[] = rawPts.map((pt, idx) => {
      const isWetMm = pt.rainMm >= 0.05;
      const barHeightRatio = isWetMm
        ? Math.max(0.12, Math.min(1, pt.rainMm / Math.max(0.5, axisMaxRainMm)))
        : 0;
      const barInlineLabel = isWetMm
        ? `${Math.max(0.1, pt.rainMm).toFixed(1)} mm`
        : '';
      const showInlineLabel =
        isWetMm &&
        idx === peakWetBarSlotIdx &&
        Math.abs(peakWetBarSlotIdx - peakProbSlotIdx) > 3;

      const humidityStateVi = describeHumidityStateVi(pt.humidityPct);

      const rainMmPartVi = isWetMm
        ? `${pt.rainMm.toFixed(1)} mm/h`
        : pt.rainPct >= 30
          ? '<0.1 mm/h'
          : '0.0 mm/h';

      const rainStateVi =
        pt.rainMm >= 2.5
          ? 'Mưa vừa – to'
          : isWetMm
            ? 'Có mưa'
            : pt.rainPct >= 40
              ? 'Dễ có mưa nhỏ'
              : pt.rainPct >= 20
                ? 'Khả năng mưa thấp'
                : 'Tạnh ráo';

      return {
        ...pt,
        humidityStateVi,
        isWetMm,
        barHeightRatio,
        barInlineLabel,
        showInlineLabel,
        tempPrimaryVi: `${pt.tempC.toFixed(1)}°C`,
        tempBadgeVi: `Cao ${hiTemp.toFixed(1)}° · Thấp ${loTemp.toFixed(1)}°`,
        tempMetaVi: `${pt.hh00} (${pt.ddMm}) · ${pt.condVi}`,
        tempTagVi: `${pt.hh00} · ${pt.tempC.toFixed(1)}°C · ${pt.condVi}`,
        humPrimaryVi: `${pt.humidityPct}%`,
        humBadgeVi: humidityStateVi,
        humMetaVi: `${pt.hh00} (${pt.ddMm}) · Cao ${hiHum}% / Thấp ${loHum}%`,
        humTagVi: `${pt.hh00} · Độ ẩm ${pt.humidityPct}% · ${humidityStateVi}`,
        rainPrimaryVi: `${pt.rainPct}% · ${rainMmPartVi}`,
        rainBadgeVi: rainStateVi,
        rainMetaVi: `${pt.hh00} (${pt.ddMm}) · Tổng 24h ${totalRain24hMm.toFixed(1)} mm`,
        rainTagVi: `${pt.hh00} · Mưa ${pt.rainPct}% · ${rainMmPartVi}`,
      };
    });

    const endDdMm = slots[slots.length - 1].ddMm;
    const spanDates = `${nowDdMm} – ${endDdMm}`;
    const peakTempPt = slots[peakTempSlotIdx];
    const lowTempPt = slots[lowTempSlotIdx];
    const peakHumPt = slots[peakHumSlotIdx];
    const lowHumPt = slots[lowHumSlotIdx];
    const peakProbPt = slots[peakProbSlotIdx];

    const xTicks: ForecastAxisTick[] = X_TICK_SLOT_INDICES.map((slotIdx) => ({
      slotIdx,
      pct: (slotIdx / 24) * 100,
      label: slotIdx === 0 ? 'Nay' : slots[slotIdx].hhShort,
    }));

    const tempAdviceVi =
      hiTemp >= 34
        ? `Đỉnh nhiệt đạt ${hiTemp.toFixed(1)}°C lúc ${peakTempPt.hh00}, thấp nhất ${loTemp.toFixed(1)}°C lúc ${lowTempPt.hh00} — ưu tiên đồ thoáng mát và uống đủ nước.`
        : spanTemp >= 7
          ? `Biên độ nhiệt 24h chênh ${spanTemp.toFixed(1)}°C (${loTemp.toFixed(1)}°–${hiTemp.toFixed(1)}°C) — nên mang áo khoác nhẹ khi ra ngoài sáng sớm hoặc tối.`
          : loTemp <= 18
            ? `Nhiệt độ hạ thấp ${loTemp.toFixed(1)}°C lúc ${lowTempPt.hh00} (cao nhất ${hiTemp.toFixed(1)}°C) — lưu ý giữ ấm khi di chuyển.`
            : `Nhiệt độ 24 giờ dao động ổn định ${loTemp.toFixed(1)}°C – ${hiTemp.toFixed(1)}°C (trung bình ${meanTempC.toFixed(1)}°C).`;

    const humAdviceVi =
      hiHum >= 82 || meanHum > 68
        ? `Độ ẩm đạt đỉnh ${hiHum}% lúc ${peakHumPt.hh00} (trung bình ${Math.round(meanHum)}%) — không khí khá ẩm, ưu tiên trang phục thoáng khí.`
        : loHum < 42
          ? `Độ ẩm giảm còn ${loHum}% lúc ${lowHumPt.hh00} — trời hanh khô, chú ý bổ sung nước và dưỡng ẩm.`
          : `Độ ẩm 24h từ ${loHum}% đến ${hiHum}% (trung bình ${Math.round(meanHum)}%), duy trì mức dễ chịu.`;

    const rainRestPrimaryVi =
      totalRain24hMm >= 0.1 || peakRainMm >= 0.05
        ? `Tổng 24h: ${totalRain24hMm.toFixed(1)} mm`
        : maxRainPct >= 30
          ? `<0.1 mm · Đỉnh ${maxRainPct}%`
          : 'Tổng 24h: 0.0 mm';

    const rainRestBadgeVi =
      peakRainMm >= 0.05
        ? `Đỉnh mưa ${maxRainPct}% (${peakRainMm.toFixed(1)} mm/h)`
        : `Đỉnh mưa ${maxRainPct}%`;

    const rainAdviceVi =
      peakRainMm >= 2.5 || totalRain24hMm >= 5.0
        ? `Tổng mưa 24h khoảng ${totalRain24hMm.toFixed(1)} mm, đỉnh mưa ${peakRainMm.toFixed(1)} mm/h (${maxRainPct}%) lúc ${peakProbPt.hh00} — nên mang áo mưa hoặc ô chắc chắn.`
        : peakRainMm >= 0.05
          ? `Có mưa rải rác (tổng ${totalRain24hMm.toFixed(1)} mm), đỉnh ${peakRainMm.toFixed(1)} mm/h (${maxRainPct}%) lúc ${peakProbPt.hh00} — nên mang sẵn ô gấp gọn.`
          : maxRainPct >= 30
            ? `Lượng mưa dự báo <0.1 mm nhưng xác suất mưa đạt ${maxRainPct}% lúc ${peakProbPt.hh00} — nên mang ô nhẹ dự phòng.`
            : `Trời 24 giờ tới tạnh ráo (0.0 mm, xác suất mưa tối đa ${maxRainPct}%) — thuận lợi hoạt động ngoài trời.`;

    return {
      sectionTitleVi: `Dự báo chi tiết 24 giờ · ${spanDates}`,
      restSyncHintVi: 'Đồng bộ 3 biểu đồ · Lướt hoặc chạm để xem theo giờ',
      sampleStep: 2,
      slots,
      xTicks,
      tempCard: {
        titleVi: 'Nhiệt độ 24 giờ',
        restPrimaryVi: `${slots[0].tempC.toFixed(1)}°C`,
        restBadgeVi: `Cao ${hiTemp.toFixed(1)}° · Thấp ${loTemp.toFixed(1)}°`,
        restMetaVi: `TB ${meanTempC.toFixed(1)}°C · Đỉnh ${peakTempPt.hh00}`,
        meanVal: meanTempC,
        axisMin: tempBounds.axisMin,
        axisMid: tempBounds.axisMid,
        axisMax: tempBounds.axisMax,
        denseCurve: resampleMonotoneCubic(temps, SAMPLE_COUNT),
        peakSlotIdx: peakTempSlotIdx,
        lowSlotIdx: lowTempSlotIdx,
        peakSampleIdx: peakTempSlotIdx * 2,
        lowSampleIdx: lowTempSlotIdx * 2,
        peakCallout: `${hiTemp.toFixed(1)}°`,
        lowCallout: `${loTemp.toFixed(1)}°`,
        adviceVi: tempAdviceVi,
        explainVi:
          'Biểu đồ Nhiệt độ (°C) 24 giờ tới với đường trung bình (TB) nét đứt và điểm Cao nhất / Thấp nhất. Khi bạn lướt trên biểu đồ này, cả Độ ẩm và Lượng mưa cũng di chuyển theo đúng giờ tương ứng.',
      },
      humCard: {
        titleVi: 'Độ ẩm không khí 24 giờ',
        restPrimaryVi: `${slots[0].humidityPct}%`,
        restBadgeVi: slots[0].humidityStateVi,
        restMetaVi: `Cao ${hiHum}% · Thấp ${loHum}% · TB ${Math.round(meanHum)}%`,
        meanVal: meanHum,
        axisMin: humBounds.axisMin,
        axisMid: humBounds.axisMid,
        axisMax: humBounds.axisMax,
        denseCurve: resampleMonotoneCubic(hums, SAMPLE_COUNT, [0, 100]),
        peakSlotIdx: peakHumSlotIdx,
        lowSlotIdx: lowHumSlotIdx,
        peakSampleIdx: peakHumSlotIdx * 2,
        lowSampleIdx: lowHumSlotIdx * 2,
        peakCallout: `${hiHum}%`,
        lowCallout: `${loHum}%`,
        adviceVi: humAdviceVi,
        explainVi:
          'Biểu đồ Độ ẩm không khí (%) trong 24 giờ tới. Mức 40–68% là ngưỡng dễ chịu; dưới 40% trời hanh khô, trên 68% không khí ẩm dễ gây cảm giác oi hoặc nồm ẩm.',
      },
      rainCard: {
        titleVi: 'Mưa & Lượng mưa 24 giờ',
        restPrimaryVi: rainRestPrimaryVi,
        restBadgeVi: rainRestBadgeVi,
        restMetaVi:
          peakRainMm >= 0.05
            ? `Cao nhất lúc ${peakProbPt.hh00} (${peakProbPt.ddMm})`
            : maxRainPct >= 20
              ? `Khả năng mưa cao nhất lúc ${peakProbPt.hh00}`
              : 'Không có mưa đáng kể trong 24h',
        restHasWetRain:
          totalRain24hMm >= 0.1 || peakRainMm >= 0.05 || maxRainPct >= 30,
        totalRain24hMm,
        peakRainMm,
        maxRainPct,
        axisMaxRainMm,
        axisMidRainMm,
        denseProbCurve: resampleMonotoneCubic(rainPcts, SAMPLE_COUNT, [0, 100]),
        peakProbSlotIdx,
        peakProbSampleIdx: peakProbSlotIdx * 2,
        peakProbCallout:
          peakRainMm >= 0.05 && Math.abs(peakWetBarSlotIdx - peakProbSlotIdx) <= 3
            ? `${maxRainPct}% · ${peakRainMm.toFixed(1)} mm`
            : `${maxRainPct}%`,
        adviceVi: rainAdviceVi,
        explainVi:
          'Biểu đồ gộp Xác suất mưa (%) và Lượng mưa (mm/giờ): đường màu xanh dương (trục trái 0–100%) thể hiện khả năng mưa; cột màu xanh ngọc (trục phải mm) thể hiện lượng mưa thực tế từng giờ khi trời có mưa.',
      },
    };
  }, [weather]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    injectLucianElementCss(STYLE_ELEMENT_ID, LUCIAN_U096_U095_SUITE_CSS);
    const suite = suiteRef.current;
    if (!suite) {
      return;
    }

    const syncPill = suite.querySelector('.u096-suite-sync') as HTMLElement | null;
    const tempRoot = suite.querySelector('.u096[data-card="temp"]') as HTMLElement | null;
    const humRoot = suite.querySelector('.u096[data-card="hum"]') as HTMLElement | null;
    const rainRoot = suite.querySelector('.u096[data-card="rain"]') as HTMLElement | null;

    if (!tempRoot || !humRoot || !rainRoot) {
      return;
    }

    const rm = Boolean(
      reduceMotion ||
        (typeof window !== 'undefined' &&
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    );

    const N = SAMPLE_COUNT;
    const H_PLOT = 156;
    const PT = 18;
    const PB = 16;
    const PL = 8;
    const PR = 8;

    let at = N - 1;
    let scrub = false;
    let pinnedSlot = -1;
    let tw = 0;
    let back = 0;

    interface CardDomRefs {
      kind: 'temp' | 'hum' | 'rain';
      root: HTMLElement;
      primary: HTMLElement;
      badge: HTMLElement;
      meta: HTMLElement;
      ch: HTMLElement;
      plot: HTMLElement;
      svg: SVGSVGElement;
      tag: HTMLElement;
      base: SVGPathElement;
      line: SVGPathElement;
      area: SVGPathElement;
      refLine: SVGLineElement | null;
      cur: SVGLineElement;
      dot: SVGCircleElement;
      ring: SVGCircleElement;
      evPeak: SVGCircleElement;
      evLow: SVGCircleElement | null;
      rect: SVGRectElement;
      gd: SVGLinearGradientElement;
      cp: SVGClipPathElement;
      clipG: SVGGElement;
      avgPill: HTMLElement | null;
      pkCallout: HTMLElement | null;
      loCallout: HTMLElement | null;
      helpBtn: HTMLButtonElement | null;
      tipPop: HTMLElement | null;
      gls: HTMLElement[];
      barEls: HTMLElement[];
      xTickEls: HTMLElement[];
      W: number;
      ys: number[] | null;
      fromYs: number[];
      targetYs: number[];
      explainPinned: boolean;
    }

    function queryCardRefs(root: HTMLElement, kind: 'temp' | 'hum' | 'rain'): CardDomRefs | null {
      const q = <T extends Element = HTMLElement>(s: string) =>
        root.querySelector(s) as T | null;

      const primary = q<HTMLElement>('.u096-p');
      const badge = q<HTMLElement>('.u096-badge');
      const meta = q<HTMLElement>('.u096-sub-meta');
      const ch = q<HTMLElement>('.u096-ch');
      const plot = q<HTMLElement>('.u096-plot');
      const svg = q<SVGSVGElement>('.u096-plot svg');
      const tag = q<HTMLElement>('.u096-tag');
      const base = q<SVGPathElement>('.u096-base');
      const line = q<SVGPathElement>('.u096-line');
      const area = q<SVGPathElement>('.u096-area');
      const refLine = q<SVGLineElement>('.u096-ref');
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
        !primary ||
        !badge ||
        !meta ||
        !ch ||
        !plot ||
        !svg ||
        !tag ||
        !base ||
        !line ||
        !area ||
        !cur ||
        !dot ||
        !ring ||
        !evPeak ||
        !rect ||
        !gd ||
        !cp ||
        !clipG
      ) {
        return null;
      }

      const uid = `u096-${kind}-${Math.random().toString(36).slice(2, 7)}`;
      gd.id = `${uid}-g`;
      cp.id = `${uid}-c`;
      area.setAttribute('fill', `url(#${uid}-g)`);
      clipG.setAttribute('clip-path', `url(#${uid}-c)`);

      const tipId = `${uid}-explain`;
      if (tipPop) tipPop.id = tipId;
      if (helpBtn) helpBtn.setAttribute('aria-describedby', tipId);

      return {
        kind,
        root,
        primary,
        badge,
        meta,
        ch,
        plot,
        svg,
        tag,
        base,
        line,
        area,
        refLine,
        cur,
        dot,
        ring,
        evPeak,
        evLow,
        rect,
        gd,
        cp,
        clipG,
        avgPill,
        pkCallout,
        loCallout,
        helpBtn,
        tipPop,
        gls,
        barEls,
        xTickEls,
        W: Math.max(200, Math.round(plot.clientWidth || 300)),
        ys: null,
        fromYs: [],
        targetYs: [],
        explainPinned: false,
      };
    }

    const tempRefs = queryCardRefs(tempRoot, 'temp');
    const humRefs = queryCardRefs(humRoot, 'hum');
    const rainRefs = queryCardRefs(rainRoot, 'rain');
    if (!tempRefs || !humRefs || !rainRefs) {
      return;
    }

    const cards: CardDomRefs[] = [tempRefs, humRefs, rainRefs];

    function yForValue(val: number, axisMin: number, axisMax: number): number {
      const span = Math.max(1, axisMax - axisMin);
      const norm = (val - axisMin) / span;
      return PT + (1 - norm) * (H_PLOT - PT - PB);
    }

    function projectCard(card: CardDomRefs): number[] {
      if (card.kind === 'temp') {
        return model.tempCard.denseCurve.map((v) =>
          yForValue(v, model.tempCard.axisMin, model.tempCard.axisMax)
        );
      }
      if (card.kind === 'hum') {
        return model.humCard.denseCurve.map((v) =>
          yForValue(v, model.humCard.axisMin, model.humCard.axisMax)
        );
      }
      return model.rainCard.denseProbCurve.map((v) => yForValue(v, 0, 100));
    }

    function X(card: CardDomRefs, i: number): number {
      return PL + (i / (N - 1)) * (card.W - PL - PR);
    }

    function buildPath(card: CardDomRefs, yArr: number[]): string {
      return yArr
        .map((v, i) => (i ? 'L' : 'M') + X(card, i).toFixed(1) + ' ' + v.toFixed(1))
        .join('');
    }

    function yAt(card: CardDomRefs, i: number): number {
      if (!card.ys || card.ys.length === 0) return H_PLOT - PB;
      const clamped = Math.max(0, Math.min(N - 1, i));
      const a = Math.floor(clamped);
      const b = Math.min(N - 1, a + 1);
      return card.ys[a] + (card.ys[b] - card.ys[a]) * (clamped - a);
    }

    function nearestSlotIndex(sampleIndex: number): number {
      const slotCount = model.slots.length;
      return Math.max(
        0,
        Math.min(slotCount - 1, Math.round(sampleIndex / model.sampleStep))
      );
    }

    function syncCardViewportAndAxes(card: CardDomRefs): void {
      card.W = Math.max(200, Math.round(card.plot.clientWidth || 300));
      card.svg.setAttribute('viewBox', `0 0 ${card.W} ${H_PLOT}`);
      if (card.refLine) {
        card.refLine.setAttribute('x1', String(PL));
        card.refLine.setAttribute('x2', String(card.W - PR));
      }
      card.cur.setAttribute('y1', String(PT - 6));
      card.cur.setAttribute('y2', String(H_PLOT - PB + 4));
      card.rect.setAttribute('height', String(H_PLOT + 30));

      if (card.kind === 'temp' || card.kind === 'hum') {
        const cfg = card.kind === 'temp' ? model.tempCard : model.humCard;
        const unit = card.kind === 'temp' ? '°' : '%';
        const tickVals = [cfg.axisMin, cfg.axisMid, cfg.axisMax];
        const yMeanEst = yForValue(cfg.meanVal, cfg.axisMin, cfg.axisMax);

        card.gls.forEach((g, j) => {
          const yGrid = PT + (1 - j / 2) * (H_PLOT - PT - PB);
          g.style.top = `${yGrid.toFixed(1)}px`;
          const rSpan = g.querySelector('.u096-gl-r') as HTMLElement | null;
          if (rSpan) {
            const tv = tickVals[j] ?? cfg.axisMin;
            rSpan.textContent = `${Math.round(tv)}${unit}`;
            rSpan.style.opacity = Math.abs(yGrid - yMeanEst) < 14 ? '0' : '1';
          }
        });
      } else {
        const leftLabels = ['0%', '50%', '100%'];
        const rightLabels = [
          '0 mm',
          formatRainAxisMm(model.rainCard.axisMidRainMm),
          formatRainAxisMm(model.rainCard.axisMaxRainMm),
        ];
        card.gls.forEach((g, j) => {
          const yGrid = PT + (1 - j / 2) * (H_PLOT - PT - PB);
          g.style.top = `${yGrid.toFixed(1)}px`;
          const lSpan = g.querySelector('.u096-gl-l') as HTMLElement | null;
          const rSpan = g.querySelector('.u096-gl-r') as HTMLElement | null;
          if (lSpan) lSpan.textContent = leftLabels[j] ?? '';
          if (rSpan) rSpan.textContent = rightLabels[j] ?? '';
        });

        const slotSpacing =
          (card.W - PL - PR) / Math.max(1, model.slots.length - 1);
        const barWidth = Math.max(4.5, Math.min(10.5, slotSpacing * 0.58));

        card.barEls.forEach((bEl, m) => {
          const slot = model.slots[m];
          if (!slot) return;
          const xPx = X(card, m * model.sampleStep);
          const leftPct = (xPx / card.W) * 100;
          bEl.style.left = `${leftPct.toFixed(3)}%`;
          bEl.style.setProperty('--bw', `${barWidth.toFixed(1)}px`);
          bEl.style.setProperty('--d', String(m));
          bEl.style.setProperty('--h', slot.barHeightRatio.toFixed(3));
          bEl.classList.toggle('dry', !slot.isWetMm);
          bEl.classList.toggle('edge-l', m <= 3);
          bEl.classList.toggle('edge-r', m >= model.slots.length - 4);
          bEl.classList.toggle('show-val', slot.showInlineLabel);
          const valEl = bEl.querySelector('.u095-b-val');
          if (valEl) {
            valEl.textContent = slot.barInlineLabel;
          }
        });
      }

      card.xTickEls.forEach((el, idx) => {
        const tick = model.xTicks[idx];
        if (!tick) return;
        const xPx = X(card, tick.slotIdx * model.sampleStep);
        const leftPct = (xPx / card.W) * 100;
        el.classList.toggle('first', idx === 0);
        el.classList.toggle('last', idx === model.xTicks.length - 1);
        el.style.left = `${leftPct.toFixed(2)}%`;
        el.textContent = tick.label;
      });
    }

    function placeCard(card: CardDomRefs, slotIdx: number, isActiveScrub: boolean): void {
      if (!card.ys) return;
      const x = X(card, at);
      const y = yAt(card, at);
      const slot = model.slots[slotIdx];

      const clipW = at >= N - 1.05 ? card.W : x;
      card.rect.setAttribute('width', clipW.toFixed(1));
      card.cur.setAttribute('x1', x.toFixed(1));
      card.cur.setAttribute('x2', x.toFixed(1));
      card.dot.setAttribute('cx', x.toFixed(1));
      card.dot.setAttribute('cy', y.toFixed(1));
      card.ring.setAttribute('cx', x.toFixed(1));
      card.ring.setAttribute('cy', y.toFixed(1));

      card.root.classList.toggle('scrub', isActiveScrub);
      card.root.classList.toggle('pinned', pinnedSlot >= 0);

      if (card.kind === 'rain') {
        card.barEls.forEach((bEl, m) => {
          bEl.classList.toggle('on', isActiveScrub && m === slotIdx);
          bEl.classList.toggle('pin', m === pinnedSlot);
        });
      }

      card.xTickEls.forEach((el, idx) => {
        const tick = model.xTicks[idx];
        if (!tick) return;
        const dist = Math.abs(tick.slotIdx - slotIdx);
        el.classList.toggle('on', isActiveScrub && dist <= 1);
      });

      if (card.kind === 'temp') {
        if (isActiveScrub) {
          card.primary.textContent = slot.tempPrimaryVi;
          card.badge.textContent = slot.tempBadgeVi;
          card.meta.textContent = slot.tempMetaVi;
        } else {
          card.primary.textContent = model.tempCard.restPrimaryVi;
          card.badge.textContent = model.tempCard.restBadgeVi;
          card.meta.textContent = model.tempCard.restMetaVi;
        }
        card.tag.textContent = slot.tempTagVi;
      } else if (card.kind === 'hum') {
        if (isActiveScrub) {
          card.primary.textContent = slot.humPrimaryVi;
          card.badge.textContent = slot.humBadgeVi;
          card.meta.textContent = slot.humMetaVi;
        } else {
          card.primary.textContent = model.humCard.restPrimaryVi;
          card.badge.textContent = model.humCard.restBadgeVi;
          card.meta.textContent = model.humCard.restMetaVi;
        }
        card.tag.textContent = slot.humTagVi;
      } else {
        if (isActiveScrub) {
          card.primary.textContent = slot.rainPrimaryVi;
          card.badge.textContent = slot.rainBadgeVi;
          card.badge.classList.toggle('wet', slot.isWetMm || slot.rainPct >= 30);
          card.meta.textContent = slot.rainMetaVi;
        } else {
          card.primary.textContent = model.rainCard.restPrimaryVi;
          card.badge.textContent = model.rainCard.restBadgeVi;
          card.badge.classList.toggle('wet', model.rainCard.restHasWetRain);
          card.meta.textContent = model.rainCard.restMetaVi;
        }
        card.tag.textContent = slot.rainTagVi;
      }

      const cw = card.plot.clientWidth || card.W;
      const tw2 = card.tag.offsetWidth || 136;
      const px = (x / card.W) * cw;
      card.tag.style.setProperty(
        '--tx',
        Math.max(2, Math.min(cw - tw2 - 2, px - tw2 / 2)).toFixed(1) + 'px'
      );

      const maxSlots = model.slots.length - 1;
      card.ch.setAttribute('aria-valuemax', String(maxSlots));
      card.ch.setAttribute('aria-valuenow', String(slotIdx));
      card.ch.setAttribute(
        'aria-valuetext',
        card.kind === 'temp'
          ? slot.tempTagVi
          : card.kind === 'hum'
            ? slot.humTagVi
            : slot.rainTagVi
      );
    }

    function placeAll(): void {
      const slotIdx = nearestSlotIndex(at);
      const slot = model.slots[slotIdx];
      const isActiveScrub = scrub || pinnedSlot >= 0;

      suite!.classList.toggle('scrub', isActiveScrub);
      suite!.classList.toggle('pinned', pinnedSlot >= 0);

      if (syncPill) {
        if (pinnedSlot >= 0) {
          syncPill.textContent = `Đang ghim mốc ${slot.hh00} (${slot.ddMm}) · Chạm hoặc nhấn Esc để bỏ ghim`;
        } else if (isActiveScrub) {
          syncPill.textContent = `Đang xem mốc ${slot.hh00} (${slot.ddMm}) · ${slot.tempC.toFixed(1)}°C · Ẩm ${slot.humidityPct}% · Mưa ${slot.rainPct}%`;
        } else {
          syncPill.textContent = model.restSyncHintVi;
        }
      }

      cards.forEach((c) => placeCard(c, slotIdx, isActiveScrub));
    }

    function paintCard(card: CardDomRefs): void {
      if (!card.ys) return;
      const p = buildPath(card, card.ys);
      const baseBottom = H_PLOT - PB;
      card.base.setAttribute('d', p);
      card.line.setAttribute('d', p);
      card.area.setAttribute(
        'd',
        `${p}L${X(card, N - 1).toFixed(1)} ${baseBottom.toFixed(1)}L${X(card, 0).toFixed(1)} ${baseBottom.toFixed(1)}Z`
      );

      const cw = card.plot.clientWidth || card.W;

      if (card.kind === 'temp' || card.kind === 'hum') {
        const cfg = card.kind === 'temp' ? model.tempCard : model.humCard;
        const unit = card.kind === 'temp' ? '°' : '%';
        const vertexCount = model.slots.length;
        let sumY = 0;
        for (let m = 0; m < vertexCount; m += 1) {
          sumY += card.ys[m * model.sampleStep];
        }
        const yMean = sumY / Math.max(1, vertexCount);
        if (card.refLine) {
          card.refLine.setAttribute('y1', yMean.toFixed(1));
          card.refLine.setAttribute('y2', yMean.toFixed(1));
        }
        if (card.avgPill) {
          card.avgPill.style.top = `${yMean.toFixed(1)}px`;
          card.avgPill.textContent = `TB ${Math.round(cfg.meanVal)}${unit}`;
        }

        card.gls.forEach((g, j) => {
          const yGrid = PT + (1 - j / 2) * (H_PLOT - PT - PB);
          const rSpan = g.querySelector('.u096-gl-r') as HTMLElement | null;
          if (rSpan) {
            rSpan.style.opacity = Math.abs(yGrid - yMean) < 14 ? '0' : '1';
          }
        });

        const ePeak = cfg.peakSampleIdx;
        const pkX = X(card, ePeak);
        const pkY = card.ys[ePeak];
        card.evPeak.setAttribute('cx', pkX.toFixed(1));
        card.evPeak.setAttribute('cy', pkY.toFixed(1));

        const eLow = cfg.lowSampleIdx;
        const loX = X(card, eLow);
        const loY = card.ys[eLow];
        if (card.evLow) {
          card.evLow.setAttribute('cx', loX.toFixed(1));
          card.evLow.setAttribute('cy', loY.toFixed(1));
        }

        if (card.pkCallout) {
          card.pkCallout.textContent = cfg.peakCallout;
          const pkW = card.pkCallout.offsetWidth || 28;
          const pkTx = Math.max(
            2,
            Math.min(cw - pkW - 2, (pkX / card.W) * cw - pkW / 2)
          );
          const pkTy = Math.max(1, pkY - 16);
          card.pkCallout.style.setProperty('--tx', `${pkTx.toFixed(1)}px`);
          card.pkCallout.style.setProperty('--ty', `${pkTy.toFixed(1)}px`);
        }

        if (card.loCallout) {
          const sameAsPeak = cfg.lowSlotIdx === cfg.peakSlotIdx;
          card.loCallout.classList.toggle('off', sameAsPeak);
          if (!sameAsPeak) {
            card.loCallout.textContent = cfg.lowCallout;
            const loW = card.loCallout.offsetWidth || 28;
            const loTx = Math.max(
              2,
              Math.min(cw - loW - 2, (loX / card.W) * cw - loW / 2)
            );
            const loTy = Math.min(H_PLOT - 13, loY + 7);
            card.loCallout.style.setProperty('--tx', `${loTx.toFixed(1)}px`);
            card.loCallout.style.setProperty('--ty', `${loTy.toFixed(1)}px`);
          }
        }
      } else {
        const ePeak = model.rainCard.peakProbSampleIdx;
        const pkX = X(card, ePeak);
        const pkY = card.ys[ePeak];
        card.evPeak.setAttribute('cx', pkX.toFixed(1));
        card.evPeak.setAttribute('cy', pkY.toFixed(1));

        if (card.pkCallout) {
          const hidePeak = model.rainCard.maxRainPct <= 0;
          card.pkCallout.classList.toggle('off', hidePeak);
          if (!hidePeak) {
            card.pkCallout.textContent = model.rainCard.peakProbCallout;
            const pkW = card.pkCallout.offsetWidth || 26;
            const pkTx = Math.max(
              2,
              Math.min(cw - pkW - 2, (pkX / card.W) * cw - pkW / 2)
            );
            const pkTy = Math.max(1, pkY - 16);
            card.pkCallout.style.setProperty('--tx', `${pkTx.toFixed(1)}px`);
            card.pkCallout.style.setProperty('--ty', `${pkTy.toFixed(1)}px`);
          }
        }
      }
    }

    function paintAll(): void {
      cards.forEach((c) => paintCard(c));
      placeAll();
    }

    function morphAll(): void {
      cancelAnimationFrame(tw);
      cards.forEach((c) => {
        const target = projectCard(c);
        c.targetYs = target;
        c.fromYs = c.ys ? c.ys.slice() : target.map(() => H_PLOT - PB);
      });
      const t0 = performance.now();
      const dur = rm ? 1 : 620;
      const step = (n: number) => {
        if (!suite || !suite.isConnected) return;
        const t = Math.min(1, (n - t0) / dur);
        const e =
          t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        cards.forEach((c) => {
          c.ys = c.fromYs.map((y, i) => y + (c.targetYs[i] - y) * e);
        });
        paintAll();
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
        if (!suite || !suite.isConnected) return;
        const t = Math.min(1, (n - t0) / dur);
        const e = 1 - Math.pow(1 - t, 3);
        at = from + (targetAt - from) * e;
        placeAll();
        if (t < 1) {
          back = requestAnimationFrame(step);
        }
      };
      step(t0);
    }

    function idxForCard(card: CardDomRefs, clientX: number): number {
      const r = card.plot.getBoundingClientRect();
      const width = Math.max(1, r.width);
      const relX = ((clientX - r.left) / width) * card.W;
      const ratio = (relX - PL) / Math.max(1, card.W - PL - PR);
      return Math.max(0, Math.min(N - 1, ratio * (N - 1)));
    }

    function startOnCard(card: CardDomRefs, clientX: number): void {
      cancelAnimationFrame(back);
      scrub = true;
      at = idxForCard(card, clientX);
      placeAll();
    }

    function endScrub(): void {
      if (!scrub && pinnedSlot < 0) return;
      scrub = false;
      if (pinnedSlot >= 0) {
        const targetSample = pinnedSlot * model.sampleStep;
        goBack(targetSample);
      } else {
        goBack(N - 1);
      }
    }

    function unpinAll(): void {
      if (pinnedSlot < 0 && !scrub) return;
      pinnedSlot = -1;
      scrub = false;
      goBack(N - 1);
    }

    function setCardExplainVisible(card: CardDomRefs, visible: boolean): void {
      if (!card.tipPop) return;
      card.tipPop.classList.toggle('on', visible);
      card.tipPop.setAttribute('aria-hidden', visible ? 'false' : 'true');
      if (card.helpBtn) {
        card.helpBtn.classList.toggle('on', visible);
        card.helpBtn.setAttribute('aria-expanded', visible ? 'true' : 'false');
      }
    }

    const cleanups: Array<() => void> = [];

    if (syncPill) {
      const onSyncClick = () => {
        if (pinnedSlot >= 0) {
          unpinAll();
        }
      };
      syncPill.addEventListener('click', onSyncClick);
      cleanups.push(() => syncPill.removeEventListener('click', onSyncClick));
    }

    cards.forEach((card) => {
      let touching = false;
      let downX = 0;
      let downY = 0;

      const onPointerDown = (e: PointerEvent) => {
        downX = e.clientX;
        downY = e.clientY;
        if (e.pointerType === 'mouse') return;
        touching = true;
        try {
          card.ch.setPointerCapture(e.pointerId);
        } catch {
          // ignore if unsupported
        }
        startOnCard(card, e.clientX);
      };

      const onPointerMove = (e: PointerEvent) => {
        if (e.pointerType === 'mouse' || touching) {
          startOnCard(card, e.clientX);
        }
      };

      const onPointerUp = (e: PointerEvent) => {
        const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
        if (moved < 8) {
          const clickedSlot = nearestSlotIndex(idxForCard(card, e.clientX));
          if (pinnedSlot === clickedSlot) {
            pinnedSlot = -1;
          } else {
            pinnedSlot = clickedSlot;
            at = pinnedSlot * model.sampleStep;
            placeAll();
          }
        }
        if (touching) {
          touching = false;
          endScrub();
        }
      };

      const onPointerCancel = () => {
        touching = false;
        endScrub();
      };

      const onPointerLeave = (e: PointerEvent) => {
        if (e.pointerType === 'mouse') {
          endScrub();
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
          endScrub();
          return;
        }
        if (e.key === 'Home') s = -N;
        else if (e.key === 'End') s = N;
        if (s === undefined) return;
        e.preventDefault();
        cancelAnimationFrame(back);
        scrub = true;
        const curSlot = nearestSlotIndex(at);
        const nextSample = Math.max(0, Math.min(N - 1, curSlot * step + s));
        at = nextSample;
        placeAll();
      };

      const onBlur = () => {
        endScrub();
      };

      card.ch.addEventListener('pointerdown', onPointerDown);
      card.ch.addEventListener('pointermove', onPointerMove);
      card.ch.addEventListener('pointerup', onPointerUp);
      card.ch.addEventListener('pointercancel', onPointerCancel);
      card.ch.addEventListener('pointerleave', onPointerLeave);
      card.ch.addEventListener('keydown', onKeyDown);
      card.ch.addEventListener('blur', onBlur);

      cleanups.push(() => {
        card.ch.removeEventListener('pointerdown', onPointerDown);
        card.ch.removeEventListener('pointermove', onPointerMove);
        card.ch.removeEventListener('pointerup', onPointerUp);
        card.ch.removeEventListener('pointercancel', onPointerCancel);
        card.ch.removeEventListener('pointerleave', onPointerLeave);
        card.ch.removeEventListener('keydown', onKeyDown);
        card.ch.removeEventListener('blur', onBlur);
      });

      if (card.helpBtn) {
        const onHelpClick = (e: MouseEvent) => {
          e.stopPropagation();
          card.explainPinned = !card.explainPinned;
          setCardExplainVisible(card, card.explainPinned);
        };
        const onHelpEnter = (e: PointerEvent) => {
          if (e.pointerType !== 'touch') setCardExplainVisible(card, true);
        };
        const onHelpLeave = (e: PointerEvent) => {
          if (e.pointerType !== 'touch' && !card.explainPinned) {
            setCardExplainVisible(card, false);
          }
        };
        const onHelpFocus = () => setCardExplainVisible(card, true);
        const onHelpBlur = () => {
          if (!card.explainPinned) setCardExplainVisible(card, false);
        };
        card.helpBtn.addEventListener('click', onHelpClick);
        card.helpBtn.addEventListener('pointerenter', onHelpEnter);
        card.helpBtn.addEventListener('pointerleave', onHelpLeave);
        card.helpBtn.addEventListener('focus', onHelpFocus);
        card.helpBtn.addEventListener('blur', onHelpBlur);
        cleanups.push(() => {
          card.helpBtn?.removeEventListener('click', onHelpClick);
          card.helpBtn?.removeEventListener('pointerenter', onHelpEnter);
          card.helpBtn?.removeEventListener('pointerleave', onHelpLeave);
          card.helpBtn?.removeEventListener('focus', onHelpFocus);
          card.helpBtn?.removeEventListener('blur', onHelpBlur);
        });
      }
    });

    const onDocPointerDown = (e: PointerEvent) => {
      cards.forEach((c) => {
        if (c.explainPinned && !c.root.contains(e.target as Node | null)) {
          c.explainPinned = false;
          setCardExplainVisible(c, false);
        }
      });
    };

    const onSuiteKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cards.forEach((c) => {
          if (c.explainPinned) {
            c.explainPinned = false;
            setCardExplainVisible(c, false);
          }
        });
      }
    };

    document.addEventListener('pointerdown', onDocPointerDown);
    suite.addEventListener('keydown', onSuiteKeyDown);
    cleanups.push(() => {
      document.removeEventListener('pointerdown', onDocPointerDown);
      suite.removeEventListener('keydown', onSuiteKeyDown);
    });

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        if (!suite.isConnected) return;
        cards.forEach((c) => {
          syncCardViewportAndAxes(c);
          c.ys = projectCard(c);
        });
        paintAll();
      });
      cards.forEach((c) => ro.observe(c.plot));
      cleanups.push(() => ro.disconnect());
    }

    cards.forEach((c) => syncCardViewportAndAxes(c));
    morphAll();

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
          {model.sectionTitleVi}
        </Text>
        <Text style={[nativeStyles.fallbackSub, { color: palette.inkSecondary }]}>
          {model.tempCard.adviceVi}
        </Text>
        <Text style={[nativeStyles.fallbackSub, { color: palette.inkSecondary }]}>
          {model.humCard.adviceVi}
        </Text>
        <Text style={[nativeStyles.fallbackSub, { color: palette.inkSecondary }]}>
          {model.rainCard.adviceVi}
        </Text>
      </View>
    );
  }

  const uxVars = buildPaletteUxVars(palette) as React.CSSProperties;

  return (
    <section
      ref={suiteRef}
      className="ux u096-suite"
      data-theme={palette.isDark ? 'dark' : 'light'}
      style={uxVars}
      aria-label="Bộ 3 biểu đồ dự báo 24 giờ: Nhiệt độ, Độ ẩm và Lượng mưa"
    >
      <div className="u096-suite-bar">
        <div className="u096-suite-title-wrap">
          <i className="u096-suite-pip" aria-hidden="true" />
          <h3 className="u096-suite-title">{model.sectionTitleVi}</h3>
        </div>
        <span className="u096-suite-sync" aria-live="polite">
          {model.restSyncHintVi}
        </span>
      </div>

      <div className="u096-suite-grid">
        {/* Card 1: Nhiệt độ 24 giờ (°C) */}
        <article className="u096" data-card="temp">
          <div className="u096-h">
            <div className="u096-top">
              <small>
                <i aria-hidden="true" />
                <span className="u096-card-title">{model.tempCard.titleVi}</span>
              </small>
              <div className="u096-head-right">
                <button
                  type="button"
                  className="u096-help-btn"
                  aria-label="Giải thích biểu đồ Nhiệt độ 24 giờ"
                  aria-expanded="false"
                >
                  ?
                </button>
              </div>
            </div>

            <div className="u096-p-row" aria-live="polite">
              <div className="u096-p-wrap">
                <b className="u096-p">{model.tempCard.restPrimaryVi}</b>
                <span className="u096-badge">{model.tempCard.restBadgeVi}</span>
              </div>
              <span className="u096-sub-meta">{model.tempCard.restMetaVi}</span>
            </div>
          </div>

          <div
            className="u096-ch"
            tabIndex={0}
            role="slider"
            aria-label="Biểu đồ Nhiệt độ (°C) 24 giờ — lướt hoặc dùng phím mũi tên trái/phải để xem từng giờ"
            aria-valuemin={0}
            aria-valuemax={24}
            aria-valuenow={24}
          >
            <div className="u096-plot">
              <div className="u096-grid" aria-hidden="true">
                {GRID_LEVEL_INDICES.map((idx) => (
                  <div key={idx} className="u096-gl">
                    <span className="u096-gl-r" />
                  </div>
                ))}
              </div>

              <svg viewBox="0 0 320 156" aria-hidden="true">
                <defs>
                  <linearGradient className="u096-gd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopOpacity=".28" />
                    <stop offset="1" stopOpacity="0" />
                  </linearGradient>
                  <clipPath className="u096-cp">
                    <rect x="0" y="-20" height="190" width="320" />
                  </clipPath>
                </defs>
                <line className="u096-ref" x1="8" x2="312" />
                <path className="u096-base" />
                <g className="u096-clip">
                  <path className="u096-area" />
                  <path className="u096-line" />
                </g>
                <circle className="u096-ev-peak" r="3.2" />
                <circle className="u096-ev-low" r="3.2" />
                <line className="u096-cur" y1="12" y2="144" />
                <circle className="u096-ring" r="4.8" />
                <circle className="u096-dot" r="5" />
              </svg>

              <span className="u096-avg-pill" aria-hidden="true">
                TB {Math.round(model.tempCard.meanVal)}°
              </span>
              <span className="u096-callout peak" aria-hidden="true">
                {model.tempCard.peakCallout}
              </span>
              <span className="u096-callout low" aria-hidden="true">
                {model.tempCard.lowCallout}
              </span>
              <span className="u096-tag" aria-hidden="true" />
            </div>

            <div className="u096-x" aria-hidden="true">
              {X_TICK_SLOT_INDICES.map((slot) => (
                <span key={slot} className="u096-x-tick" />
              ))}
            </div>
          </div>

          <div className="u096-adv" role="note" aria-label="Lời khuyên nhiệt độ 24 giờ">
            <span className="u096-adv-ic" aria-hidden="true">
              <Thermometer
                size={13}
                weight="duotone"
                color={palette.isDark ? '#F0AE43' : '#C87416'}
              />
            </span>
            <span className="u096-adv-txt">{model.tempCard.adviceVi}</span>
          </div>

          <div className="u096-tip-pop" role="tooltip" aria-hidden="true">
            <div className="u096-tip-hdr">
              <span className="u096-tip-dot" aria-hidden="true" />
              <strong className="u096-tip-title">{model.tempCard.titleVi}</strong>
            </div>
            <p className="u096-tip-body">{model.tempCard.explainVi}</p>
          </div>
        </article>

        {/* Card 2: Độ ẩm không khí 24 giờ (%) */}
        <article className="u096" data-card="hum">
          <div className="u096-h">
            <div className="u096-top">
              <small>
                <i aria-hidden="true" />
                <span className="u096-card-title">{model.humCard.titleVi}</span>
              </small>
              <div className="u096-head-right">
                <button
                  type="button"
                  className="u096-help-btn"
                  aria-label="Giải thích biểu đồ Độ ẩm không khí 24 giờ"
                  aria-expanded="false"
                >
                  ?
                </button>
              </div>
            </div>

            <div className="u096-p-row" aria-live="polite">
              <div className="u096-p-wrap">
                <b className="u096-p">{model.humCard.restPrimaryVi}</b>
                <span className="u096-badge">{model.humCard.restBadgeVi}</span>
              </div>
              <span className="u096-sub-meta">{model.humCard.restMetaVi}</span>
            </div>
          </div>

          <div
            className="u096-ch"
            tabIndex={0}
            role="slider"
            aria-label="Biểu đồ Độ ẩm không khí (%) 24 giờ — lướt hoặc dùng phím mũi tên trái/phải để xem từng giờ"
            aria-valuemin={0}
            aria-valuemax={24}
            aria-valuenow={24}
          >
            <div className="u096-plot">
              <div className="u096-grid" aria-hidden="true">
                {GRID_LEVEL_INDICES.map((idx) => (
                  <div key={idx} className="u096-gl">
                    <span className="u096-gl-r" />
                  </div>
                ))}
              </div>

              <svg viewBox="0 0 320 156" aria-hidden="true">
                <defs>
                  <linearGradient className="u096-gd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopOpacity=".28" />
                    <stop offset="1" stopOpacity="0" />
                  </linearGradient>
                  <clipPath className="u096-cp">
                    <rect x="0" y="-20" height="190" width="320" />
                  </clipPath>
                </defs>
                <line className="u096-ref" x1="8" x2="312" />
                <path className="u096-base" />
                <g className="u096-clip">
                  <path className="u096-area" />
                  <path className="u096-line" />
                </g>
                <circle className="u096-ev-peak" r="3.2" />
                <circle className="u096-ev-low" r="3.2" />
                <line className="u096-cur" y1="12" y2="144" />
                <circle className="u096-ring" r="4.8" />
                <circle className="u096-dot" r="5" />
              </svg>

              <span className="u096-avg-pill" aria-hidden="true">
                TB {Math.round(model.humCard.meanVal)}%
              </span>
              <span className="u096-callout peak" aria-hidden="true">
                {model.humCard.peakCallout}
              </span>
              <span className="u096-callout low" aria-hidden="true">
                {model.humCard.lowCallout}
              </span>
              <span className="u096-tag" aria-hidden="true" />
            </div>

            <div className="u096-x" aria-hidden="true">
              {X_TICK_SLOT_INDICES.map((slot) => (
                <span key={slot} className="u096-x-tick" />
              ))}
            </div>
          </div>

          <div className="u096-adv" role="note" aria-label="Lời khuyên độ ẩm 24 giờ">
            <span className="u096-adv-ic" aria-hidden="true">
              <Drop
                size={13}
                weight="duotone"
                color={palette.isDark ? '#38B889' : '#13845E'}
              />
            </span>
            <span className="u096-adv-txt">{model.humCard.adviceVi}</span>
          </div>

          <div className="u096-tip-pop" role="tooltip" aria-hidden="true">
            <div className="u096-tip-hdr">
              <span className="u096-tip-dot" aria-hidden="true" />
              <strong className="u096-tip-title">{model.humCard.titleVi}</strong>
            </div>
            <p className="u096-tip-body">{model.humCard.explainVi}</p>
          </div>
        </article>

        {/* Card 3: Mưa (%) & Lượng mưa (mm) 24 giờ */}
        <article className="u096" data-card="rain">
          <div className="u096-h">
            <div className="u096-top">
              <small>
                <i aria-hidden="true" />
                <span className="u096-card-title">{model.rainCard.titleVi}</span>
              </small>
              <div className="u096-head-right">
                <div
                  className="u096-mini-leg"
                  role="note"
                  aria-label="Chú giải xác suất mưa và lượng mưa"
                >
                  <span className="u096-leg-i">
                    <i className="u096-leg-ln" aria-hidden="true" />
                    <span>% mưa</span>
                  </span>
                  <span className="u096-leg-i">
                    <i className="u096-leg-br" aria-hidden="true" />
                    <span>mm</span>
                  </span>
                </div>
                <button
                  type="button"
                  className="u096-help-btn"
                  aria-label="Giải thích biểu đồ Mưa và Lượng mưa 24 giờ"
                  aria-expanded="false"
                >
                  ?
                </button>
              </div>
            </div>

            <div className="u096-p-row" aria-live="polite">
              <div className="u096-p-wrap">
                <b className="u096-p">{model.rainCard.restPrimaryVi}</b>
                <span
                  className={`u096-badge${model.rainCard.restHasWetRain ? ' wet' : ''}`}
                >
                  {model.rainCard.restBadgeVi}
                </span>
              </div>
              <span className="u096-sub-meta">{model.rainCard.restMetaVi}</span>
            </div>
          </div>

          <div
            className="u096-ch"
            tabIndex={0}
            role="slider"
            aria-label="Biểu đồ Xác suất mưa (%) và Lượng mưa (mm/giờ) 24 giờ — lướt hoặc dùng phím mũi tên trái/phải để xem từng giờ"
            aria-valuemin={0}
            aria-valuemax={24}
            aria-valuenow={24}
          >
            <div className="u096-plot">
              <div className="u096-grid" aria-hidden="true">
                {GRID_LEVEL_INDICES.map((idx) => (
                  <div key={idx} className="u096-gl">
                    <span className="u096-gl-l" />
                    <span className="u096-gl-r" />
                  </div>
                ))}
              </div>

              <div className="u095-bars" aria-hidden="true">
                {SLOT_INDICES.map((idx) => (
                  <div key={idx} className="u095-b">
                    <u className="u095-b-val" />
                    <i />
                  </div>
                ))}
              </div>

              <svg viewBox="0 0 320 156" aria-hidden="true">
                <defs>
                  <linearGradient className="u096-gd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopOpacity=".24" />
                    <stop offset="1" stopOpacity="0" />
                  </linearGradient>
                  <clipPath className="u096-cp">
                    <rect x="0" y="-20" height="190" width="320" />
                  </clipPath>
                </defs>
                <path className="u096-base" />
                <g className="u096-clip">
                  <path className="u096-area" />
                  <path className="u096-line" />
                </g>
                <circle className="u096-ev-peak" r="3.2" />
                <line className="u096-cur" y1="12" y2="144" />
                <circle className="u096-ring" r="4.8" />
                <circle className="u096-dot" r="5" />
              </svg>

              <span className="u096-callout peak" aria-hidden="true">
                {model.rainCard.peakProbCallout}
              </span>
              <span className="u096-tag" aria-hidden="true" />
            </div>

            <div className="u096-x" aria-hidden="true">
              {X_TICK_SLOT_INDICES.map((slot) => (
                <span key={slot} className="u096-x-tick" />
              ))}
            </div>
          </div>

          <div className="u096-adv" role="note" aria-label="Lời khuyên mưa 24 giờ">
            <span className="u096-adv-ic" aria-hidden="true">
              <CloudRain
                size={13}
                weight="duotone"
                color={palette.isDark ? '#60A5FA' : '#2563EB'}
              />
            </span>
            <span className="u096-adv-txt">{model.rainCard.adviceVi}</span>
          </div>

          <div className="u096-tip-pop" role="tooltip" aria-hidden="true">
            <div className="u096-tip-hdr">
              <span className="u096-tip-dot" aria-hidden="true" />
              <strong className="u096-tip-title">{model.rainCard.titleVi}</strong>
            </div>
            <p className="u096-tip-body">{model.rainCard.explainVi}</p>
          </div>
        </article>
      </div>
    </section>
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

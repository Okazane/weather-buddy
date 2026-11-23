/* Lucian UX/UI Prompt #094 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#094 */
/* Lucian UX/UI Prompt #228 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#228 */
/* Lucian UX/UI Prompt #047 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#047 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type {
  CharacterDecision,
  HourlyForecastPoint,
  WeatherSnapshot,
} from '../core';
import {
  FONT_FAMILY_DISPLAY,
  FONT_FAMILY_SANS,
  sanitizeCopy,
  type AtmosphericPalette,
} from '../components/themeTokens';

export interface TelemetryMetricCardItem {
  id: string;
  iconKey: 'temp' | 'feels' | 'rain' | 'wind' | 'uv' | 'aqi';
  label: string;
  value: string;
  badge: string;
  detail: string;
  progressPct: number;
  accentColor?: string;
}

export interface LucianSkyScrubber094Props {
  palette: AtmosphericPalette;
  weather: WeatherSnapshot;
  decision: CharacterDecision;
  reduceMotion?: boolean;
}

export interface LucianGlowingBento228Props {
  palette: AtmosphericPalette;
  metrics: TelemetryMetricCardItem[];
  reduceMotion?: boolean;
}

export interface LucianForecastTrend047Props {
  palette: AtmosphericPalette;
  weather: WeatherSnapshot;
  decision: CharacterDecision;
  reduceMotion?: boolean;
}

const STYLE_ELEMENT_ID = 'lucian-stage-widgets-094-228-047-css';

/**
 * Genuine scoped CSS from Lucian UX/UI Prompt #094, #228, and #047
 * plus fallback --ux-* theme tokens and responsive max-width:100% adaptations
 * for 375px mobile and fluid desktop Bento slots.
 */
const LUCIAN_STAGE_CSS = `
/* Lucian UX/UI Prompt theme tokens fallback + .ux base */
:root{
  --ux-page:#F4F2EE;
  --ux-surface:#FFFFFF;
  --ux-surface-2:#F5F3EF;
  --ux-surface-3:#EAE7E1;
  --ux-ink:#16151B;
  --ux-ink-2:#57535F;
  --ux-ink-3:#8E8A97;
  --ux-line:rgba(22,21,27,.09);
  --ux-line-2:rgba(22,21,27,.17);
  --ux-accent:#185ADB;
  --ux-accent-2:#2F8FE0;
  --ux-accent-soft:rgba(24,90,219,.12);
  --ux-accent-ink:#FFFFFF;
  --ux-mint:#119C72;
  --ux-warn:#D6731E;
  --ux-danger:#D93A55;
  --ux-glass:rgba(255,255,255,.58);
  --ux-glass-line:rgba(255,255,255,.85);
  --ux-shadow:rgba(17,32,49,.12);
  --ux-shadow-strong:rgba(17,32,49,.26);
  --ux-grad:linear-gradient(120deg,#185ADB,#3D8BFF 55%,#1FB89A);
  --ux-ease:cubic-bezier(.2,.8,.2,1);
  --ux-spring:cubic-bezier(.34,1.45,.64,1);
}
:root[data-theme="dark"]{
  --ux-page:#07080D;
  --ux-surface:#111A2B;
  --ux-surface-2:#172338;
  --ux-surface-3:#21314D;
  --ux-ink:#F2F6FB;
  --ux-ink-2:rgba(242,246,251,.74);
  --ux-ink-3:rgba(242,246,251,.48);
  --ux-line:rgba(255,255,255,.09);
  --ux-line-2:rgba(255,255,255,.17);
  --ux-accent:#63ADFF;
  --ux-accent-2:#7DB4FF;
  --ux-accent-soft:rgba(99,173,255,.16);
  --ux-accent-ink:#0B1422;
  --ux-mint:#7EE8C0;
  --ux-warn:#FFB26B;
  --ux-danger:#FF7D8C;
  --ux-glass:rgba(255,255,255,.07);
  --ux-glass-line:rgba(255,255,255,.18);
  --ux-shadow:rgba(0,0,0,.45);
  --ux-shadow-strong:rgba(0,0,0,.72);
  --ux-grad:linear-gradient(120deg,#63ADFF,#7DB4FF 55%,#7EE8C0);
}
.ux,.ux *,.ux *::before,.ux *::after{box-sizing:border-box}
.ux{
  font-family:'Plus Jakarta Sans',"Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  color:var(--ux-ink);-webkit-font-smoothing:antialiased;letter-spacing:-.01em;
  -webkit-tap-highlight-color:transparent;
  word-break:keep-all;overflow-wrap:break-word;
}
:where(.ux) :is(button,input,textarea,select){font:inherit;color:inherit}
:where(.ux) button{cursor:pointer}
.ux :focus-visible{outline:2px solid var(--ux-accent);outline-offset:3px}
.ux [hidden]{display:none!important}
@media (prefers-reduced-motion:reduce){
  .ux,.ux *,.ux *::before,.ux *::after{
    animation-duration:.001ms!important;animation-iteration-count:1!important;
    transition-duration:.001ms!important;scroll-behavior:auto!important;
  }
}

/* ============================================================================
   Lucian UX/UI Prompt #094 · Weather sky you scrub through
   ============================================================================ */
.u094{position:relative;width:100%;max-width:100%;min-height:420px;display:flex;flex-direction:column;border-radius:28px;background:var(--ux-surface);box-shadow:0 0 0 1px var(--ux-line),0 30px 60px -36px var(--ux-shadow-strong);overflow:hidden}
.u094-sky{position:relative;height:262px;flex:none;overflow:hidden;background:linear-gradient(180deg,var(--s1,#4A92F0),var(--s2,#8ED0FF));color:#fff}
.u094-stars{position:absolute;inset:0;opacity:var(--night,0);pointer-events:none}
.u094-stars i{position:absolute;width:2px;height:2px;border-radius:50%;background:#fff;animation:u094-tw 2.6s ease-in-out infinite}
@keyframes u094-tw{50%{opacity:.3}}
.u094-arc{position:absolute;left:0;top:0;width:100%;height:262px;fill:none;stroke:#fff;stroke-opacity:.35;stroke-width:1.6;stroke-dasharray:2 6;stroke-linecap:round;pointer-events:none}
.u094-orb{position:absolute;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;transform:translate(var(--ox,220px),var(--oy,68px));pointer-events:none}
.u094-orb.sun{background:radial-gradient(circle at 40% 38%,#FFF3C4,#FFC94D 55%,#FFB020);box-shadow:0 0 0 8px rgba(255,214,102,.22),0 0 40px 10px rgba(255,190,70,.45)}
.u094-orb.moon{background:radial-gradient(circle at 36% 36%,#FFFFFF,#DCE3F5 70%);box-shadow:0 0 30px 4px rgba(200,215,255,.35)}
.u094-orb.moon::after{content:"";position:absolute;width:9px;height:9px;left:16px;top:9px;border-radius:50%;background:rgba(150,165,200,.35)}
.u094-hz{position:absolute;left:0;right:0;top:206px;bottom:0;background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,0));pointer-events:none}
.u094-cl{position:absolute;opacity:var(--cloud,.2);transition:opacity .4s;pointer-events:none}
.u094-cl svg{display:block;fill:#fff}
.u094-cl.a{right:-34px;top:58px;width:140px;animation:u094-drift 26s ease-in-out infinite alternate}
.u094-cl.b{left:140px;top:150px;width:104px;animation:u094-drift 32s ease-in-out infinite alternate-reverse}
.u094.rain .u094-cl svg{fill:#DDE3EC}
@keyframes u094-drift{to{transform:translateX(46px)}}
.u094-drops{position:absolute;inset:0;opacity:0;transition:opacity .5s;pointer-events:none}
.u094.rain .u094-drops{opacity:1}
.u094-drops i{position:absolute;top:-24px;width:1.6px;height:16px;border-radius:1px;background:linear-gradient(transparent,rgba(255,255,255,.75));transform:rotate(12deg);animation:u094-fall .8s linear infinite}
.u094:not(.rain) .u094-drops i{animation-play-state:paused}
@keyframes u094-fall{to{transform:translate(-60px,300px) rotate(12deg)}}
.u094-info{position:absolute;left:22px;top:20px;right:22px;text-shadow:0 1px 10px rgba(0,0,0,.18);pointer-events:none}
.u094-info small{display:block;font-size:12.5px;font-weight:700;opacity:.92;letter-spacing:.01em}
.u094-t{display:block;margin-top:4px;font-size:60px;font-weight:700;letter-spacing:-.04em;line-height:1;font-variant-numeric:tabular-nums}
.u094-c{display:block;margin-top:6px;font-size:15px;font-weight:750}
.u094-meta{display:block;margin-top:3px;font-size:12px;font-weight:600;opacity:.88;font-variant-numeric:tabular-nums}
.u094-now{position:absolute;left:20px;bottom:14px;height:26px;padding:0 11px;border-radius:999px;display:inline-flex;align-items:center;gap:6px;background:rgba(15,23,42,.34);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.24);font-size:12px;font-weight:800;font-variant-numeric:tabular-nums}
.u094-hint{position:absolute;right:18px;bottom:14px;height:26px;padding:0 10px;border-radius:999px;display:inline-flex;align-items:center;background:rgba(255,255,255,.16);backdrop-filter:blur(6px);font-size:11px;font-weight:700;color:rgba(255,255,255,.92);pointer-events:none}
.u094-strip{position:relative;flex:1;padding:0 22px 18px;touch-action:none;cursor:ew-resize;outline:none;user-select:none}
.u094-strip:focus-visible{box-shadow:inset 0 0 0 2px var(--ux-accent);border-radius:0 0 28px 28px}
.u094-labs{position:relative;height:96px;margin-top:12px}
.u094-lb{position:absolute;top:0;width:42px;margin-left:-21px;padding:6px 0 0;border:0;border-radius:14px;background:transparent;display:flex;flex-direction:column;align-items:center;gap:4px;color:var(--ux-ink-3);transition:background-color .25s,color .25s,transform .35s var(--ux-spring)}
.u094-lb small{font-size:11px;font-weight:700;font-variant-numeric:tabular-nums}
.u094-lb svg{width:22px;height:22px}
.u094-lb b{padding-bottom:8px;font-size:13px;font-weight:800;color:var(--ux-ink-2);font-variant-numeric:tabular-nums}
.u094-lb.on{background:var(--ux-surface-2);color:var(--ux-ink);transform:translateY(-2px);box-shadow:0 0 0 1px var(--ux-line)}
.u094-lb.on b{color:var(--ux-ink)}
.u094-trk{position:relative;height:6px;margin-top:12px;border-radius:3px;background:var(--ux-surface-3)}
.u094-trk>i{position:absolute;left:0;top:0;bottom:0;width:var(--x,37.5%);border-radius:inherit;background:linear-gradient(90deg,#3B3F7A,#F7A07C 26%,#5CB8FF 50%,#FF9A6B 77%,#2A2E6E)}
.u094-kn{position:absolute;top:50%;left:var(--x,37.5%);width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;display:grid;place-items:center;background:var(--ux-surface);box-shadow:0 0 0 1px var(--ux-line-2),0 4px 12px -4px var(--ux-shadow-strong);transition:transform .3s var(--ux-spring)}
.u094-strip.drag .u094-kn{transform:scale(1.15)}
.u094-kn i{width:12px;height:12px;border-radius:50%;background:#FFB020;transition:background-color .3s,box-shadow .3s}
.u094-kn.moon i{background:transparent;box-shadow:inset -4px -1px 0 0 #8B9BFF}
@media (max-width:420px){
  .u094-strip{padding:0 16px 16px}
  .u094-lb{width:36px;margin-left:-18px}
  .u094-lb small{font-size:10px}
  .u094-lb b{font-size:12px}
  .u094-hint{display:none}
}

/* ============================================================================
   Lucian UX/UI Prompt #228 · Cursor-lit glowing card borders
   ============================================================================ */
.u228{position:relative;width:100%;max-width:100%;min-height:340px;border-radius:28px;overflow:hidden;background:var(--ux-surface);box-shadow:0 0 0 1px var(--ux-line),0 30px 60px -36px var(--ux-shadow-strong);color:var(--ux-ink);padding:18px;--x:-500px;--y:-500px;--o:0}
.u228-hdr{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;padding:0 2px}
.u228-hdr-title{display:flex;align-items:center;gap:8px;font-size:14.5px;font-weight:800;color:var(--ux-ink)}
.u228-hdr-dot{width:8px;height:8px;border-radius:50%;background:var(--ux-accent);box-shadow:0 0 0 4px var(--ux-accent-soft)}
.u228-hdr-sub{font-size:12px;font-weight:650;color:var(--ux-ink-3)}
.u228-gd{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;width:100%}
@media (min-width:680px){
  .u228-gd{grid-template-columns:repeat(3,minmax(0,1fr))}
}
@media (min-width:960px) and (max-width:1180px){
  .u228-gd{grid-template-columns:repeat(2,minmax(0,1fr))}
}
.u228-c{position:relative;border-radius:20px;padding:1.5px;background:radial-gradient(190px circle at var(--cx,-500px) var(--cy,-500px),var(--u228-g1,rgba(99,173,255,calc(var(--o,0) * 1))),var(--u228-g2,rgba(56,189,248,calc(var(--o,0) * .55))) 42%,transparent 72%),var(--ux-line-2);transition:transform .28s var(--ux-spring);outline:none}
.u228-c:hover{transform:translateY(-1.5px)}
.u228-c:focus-visible{box-shadow:0 0 0 2px var(--ux-accent)}
.u228-in{position:relative;height:100%;min-height:132px;border-radius:18.5px;background:radial-gradient(230px circle at var(--cx,-500px) var(--cy,-500px),var(--u228-gin,rgba(99,173,255,calc(var(--o,0) * .15))),transparent 62%),var(--ux-surface-2);padding:15px;display:flex;flex-direction:column;gap:6px;overflow:hidden}
.u228-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.u228-ic{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:var(--ux-surface);box-shadow:inset 0 0 0 1px var(--ux-line-2);flex:none}
.u228-ic svg{width:17px;height:17px}
.u228-tag{font-size:11px;font-weight:750;padding:3px 8px;border-radius:999px;background:var(--ux-accent-soft);color:var(--ux-accent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px}
.u228-lbl{font-size:12px;font-weight:700;color:var(--ux-ink-2);margin-top:4px}
.u228-val{font-size:25px;font-weight:800;letter-spacing:-.035em;line-height:1.12;color:var(--ux-ink);font-variant-numeric:tabular-nums}
.u228-bar{height:4px;border-radius:999px;background:var(--ux-surface-3);overflow:hidden;margin-top:auto}
.u228-bar>i{display:block;height:100%;border-radius:inherit;background:var(--ux-accent);transition:width .5s var(--ux-ease)}
.u228-in span.u228-det{font-size:11.5px;font-weight:600;color:var(--ux-ink-3);word-break:keep-all}
@media (max-width:400px){
  .u228{padding:14px}
  .u228-gd{gap:9px}
  .u228-in{padding:12px;min-height:122px}
  .u228-val{font-size:21px}
}

/* ============================================================================
   Lucian UX/UI Prompt #047 · Period segmented control
   ============================================================================ */
.u047{position:relative;width:100%;max-width:100%;height:auto;min-height:232px;display:flex;flex-direction:column;padding:14px 16px 0;border-radius:22px;background:var(--ux-surface);box-shadow:0 0 0 1px var(--ux-line),0 20px 44px -32px var(--ux-shadow-strong);overflow:hidden}
.u047-seg{position:relative;display:grid;grid-template-columns:repeat(4,1fr);padding:4px;border-radius:14px;background:var(--ux-surface-2)}
.u047-knob{position:absolute;top:4px;bottom:4px;left:var(--l,4px);right:var(--r,4px);border-radius:10px;background:var(--ux-surface);box-shadow:0 4px 12px -6px var(--ux-shadow-strong),0 0 0 1px var(--ux-line)}
.u047-seg.go-r .u047-knob{transition:right .3s var(--ux-ease),left .5s var(--ux-spring) .07s}
.u047-seg.go-l .u047-knob{transition:left .3s var(--ux-ease),right .5s var(--ux-spring) .07s}
.u047-opt{position:relative;height:34px;border:0;padding:0 4px;border-radius:10px;background:none;font-size:12.5px;font-weight:700;color:var(--ux-ink-3);transition:color .3s,transform .3s var(--ux-spring);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.u047-opt:hover{color:var(--ux-ink-2)}
.u047-opt:active{transform:scale(.94)}
.u047-opt[aria-checked="true"]{color:var(--ux-ink)}
.u047-opt:focus-visible{outline:2px solid var(--ux-accent);outline-offset:1px}
.u047-lab{margin:12px 4px 0;font-size:12px;font-weight:650;color:var(--ux-ink-3)}
.u047-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin:2px 4px 0}
.u047-num-wrap{display:flex;align-items:center;gap:10px}
.u047-num{font-size:30px;font-weight:800;letter-spacing:-.045em;line-height:1.1;font-variant-numeric:tabular-nums;color:var(--ux-ink)}
.u047-chg{display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 9px;border-radius:999px;font-size:12px;font-weight:750;background:color-mix(in srgb,var(--ux-mint) 15%,transparent);color:var(--ux-mint);font-variant-numeric:tabular-nums;transition:background-color .4s,color .4s}
.u047-chg.down{background:color-mix(in srgb,var(--ux-danger) 13%,transparent);color:var(--ux-danger)}
.u047-chg svg{width:11px;height:11px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;transition:transform .45s var(--ux-spring)}
.u047-chg.down svg{transform:rotate(180deg)}
.u047-chart{position:relative;height:110px;margin:6px -16px 0}
.u047-chart svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.u047-line{fill:none;stroke:var(--ux-accent);stroke-width:2.6;stroke-linejoin:round;stroke-linecap:round}
.u047-grid line{stroke:var(--ux-line);stroke-dasharray:3 5}
.u047-dot{fill:var(--ux-surface);stroke:var(--ux-accent);stroke-width:3}
.u047-halo{fill:var(--ux-accent);opacity:.18;transform-box:fill-box;transform-origin:center;animation:u047-p 2s ease-out infinite}
@keyframes u047-p{0%{transform:scale(.6);opacity:.35}100%{transform:scale(2.2);opacity:0}}
@media (max-width:400px){
  .u047{padding:12px 12px 0}
  .u047-opt{font-size:11.5px;height:32px}
  .u047-num{font-size:26px}
}
`;

function ensureLucianStageCssInjected(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }
  if (document.getElementById(STYLE_ELEMENT_ID)) {
    return;
  }
  const styleEl = document.createElement('style');
  styleEl.id = STYLE_ELEMENT_ID;
  styleEl.textContent = LUCIAN_STAGE_CSS;
  document.head.appendChild(styleEl);
}

function buildPaletteUxVars(palette: AtmosphericPalette): Record<string, string> {
  if (palette.isDark) {
    return {
      '--ux-surface': palette.coreSurfaceBg,
      '--ux-surface-2': palette.coreElevatedBg,
      '--ux-surface-3': 'rgba(255, 255, 255, 0.11)',
      '--ux-ink': palette.inkPrimary,
      '--ux-ink-2': palette.inkSecondary,
      '--ux-ink-3': palette.inkMuted,
      '--ux-line': palette.hairline,
      '--ux-line-2': palette.bezelOuterBorder,
      '--ux-accent': palette.accent,
      '--ux-accent-2': '#38BDF8',
      '--ux-accent-soft': palette.accentSoftBg,
      '--ux-mint': '#34D399',
      '--ux-warn': '#FBBF24',
      '--ux-danger': '#F87171',
      '--ux-shadow-strong': 'rgba(2, 6, 23, 0.65)',
      '--u228-g1': 'rgba(99, 173, 255, calc(var(--o, 0) * 1))',
      '--u228-g2': 'rgba(56, 189, 248, calc(var(--o, 0) * 0.58))',
      '--u228-gin': 'rgba(99, 173, 255, calc(var(--o, 0) * 0.16))',
    };
  }
  return {
    '--ux-surface': palette.coreElevatedBg,
    '--ux-surface-2': palette.coreSurfaceBg,
    '--ux-surface-3': 'rgba(17, 32, 49, 0.08)',
    '--ux-ink': palette.inkPrimary,
    '--ux-ink-2': palette.inkSecondary,
    '--ux-ink-3': palette.inkMuted,
    '--ux-line': palette.hairline,
    '--ux-line-2': 'rgba(17, 32, 49, 0.14)',
    '--ux-accent': palette.accent,
    '--ux-accent-2': '#0284C7',
    '--ux-accent-soft': palette.accentSoftBg,
    '--ux-mint': '#0D9488',
    '--ux-warn': '#D97706',
    '--ux-danger': '#E11D48',
    '--ux-shadow-strong': 'rgba(17, 32, 49, 0.18)',
    '--u228-g1': 'rgba(24, 90, 219, calc(var(--o, 0) * 0.92))',
    '--u228-g2': 'rgba(14, 165, 233, calc(var(--o, 0) * 0.52))',
    '--u228-gin': 'rgba(24, 90, 219, calc(var(--o, 0) * 0.10))',
  };
}

function parseHourFromIso(iso: string, fallbackIndex: number): number {
  if (iso) {
    const hasExplicitTz = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso.trim());
    if (!hasExplicitTz) {
      const m = iso.match(/T(\d{2}):(\d{2})/);
      if (m) {
        return Number(m[1]);
      }
    }
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      return d.getHours();
    }
  }
  return (9 + fallbackIndex) % 24;
}

interface HourForecastModelPoint {
  hour: number;
  tempC: number;
  precipProbPct: number;
  conditionCode: string;
}

function build24HourModel(weather: WeatherSnapshot): HourForecastModelPoint[] {
  const byHour = new Map<number, HourlyForecastPoint>();
  const list = weather.hourly ?? [];
  list.forEach((pt, idx) => {
    const h = parseHourFromIso(pt.timeIso, idx);
    if (!byHour.has(h)) {
      byHour.set(h, pt);
    }
  });

  const baseTemp = weather.temperatureC;
  const baseRain = weather.precipProbPct;

  const model: HourForecastModelPoint[] = [];
  for (let h = 0; h < 24; h += 1) {
    const exact = byHour.get(h);
    if (exact) {
      model.push({
        hour: h,
        tempC: exact.temperatureC,
        precipProbPct: exact.precipProbPct,
        conditionCode: exact.conditionCode || 'CLEAR',
      });
    } else {
      // Smooth diurnal curve around current snapshot when fewer than 24 hourly points are supplied
      const diurnalOffset = Math.sin(((h - 8) / 24) * Math.PI * 2) * 3.2;
      model.push({
        hour: h,
        tempC: baseTemp + diurnalOffset,
        precipProbPct: baseRain,
        conditionCode: baseRain >= 50 ? 'RAIN' : 'CLEAR',
      });
    }
  }
  return model;
}

/**
 * Ported Lucian Element #094: "Weather sky you scrub through"
 * Driven by real 24h weather.hourly forecast data, with sun/moon Bezier arc,
 * dynamic stars, drifting clouds, rain particles, and accessible pointer/keyboard scrubbing.
 */
export const LucianSkyScrubber094: React.FC<LucianSkyScrubber094Props> = ({
  palette,
  weather,
  reduceMotion = false,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hourModel = useMemo(() => build24HourModel(weather), [weather]);

  const { hiTemp, loTemp } = useMemo(() => {
    const temps = [
      weather.temperatureC,
      ...hourModel.map((m) => m.tempC),
    ];
    return {
      hiTemp: Math.round(Math.max(...temps)),
      loTemp: Math.round(Math.min(...temps)),
    };
  }, [weather.temperatureC, hourModel]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    ensureLucianStageCssInjected();
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const cleanups: Array<() => void> = [];
    const sky = root.querySelector('.u094-sky') as HTMLElement | null;
    const orb = root.querySelector('.u094-orb') as HTMLElement | null;
    const tEl = root.querySelector('.u094-t') as HTMLElement | null;
    const cEl = root.querySelector('.u094-c') as HTMLElement | null;
    const now = root.querySelector('.u094-now') as HTMLElement | null;
    const strip = root.querySelector('.u094-strip') as HTMLElement | null;
    const labs = root.querySelector('.u094-labs') as HTMLElement | null;
    const trk = root.querySelector('.u094-trk') as HTMLElement | null;
    const kn = root.querySelector('.u094-kn') as HTMLElement | null;
    const starsEl = root.querySelector('.u094-stars') as HTMLElement | null;
    const dropsEl = root.querySelector('.u094-drops') as HTMLElement | null;

    if (!sky || !orb || !tEl || !cEl || !now || !strip || !labs || !trk || !kn || !starsEl || !dropsEl) {
      return;
    }

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const rm = Boolean(reduceMotion || mq.matches);

    const SKY: Array<[number, string, string]> = [
      [0, '#0B1026', '#1E2656'],
      [4.5, '#151B44', '#3B3F7A'],
      [6, '#F3A27E', '#6C7FD8'],
      [8, '#8ED0FF', '#4A92F0'],
      [12, '#5CB8FF', '#2F7BFF'],
      [14.5, '#7DA9D6', '#4E73B0'],
      [15.5, '#6E85A6', '#485B73'],
      [17.4, '#7E8FA6', '#536278'],
      [18.6, '#FF9F6E', '#6E56B8'],
      [20, '#23295E', '#111633'],
      [24, '#0B1026', '#1E2656'],
    ];

    const ICON: Record<'sun' | 'moon' | 'cloud' | 'rain', string> = {
      sun: '<circle cx="11" cy="11" r="4.4" fill="#FFB020"/><path d="M11 2.5v2M11 17.5v2M2.5 11h2M17.5 11h2M5 5l1.4 1.4M15.6 15.6L17 17M5 17l1.4-1.4M15.6 6.4L17 5" stroke="#FFB020" stroke-width="1.8" stroke-linecap="round"/>',
      moon: '<path d="M14.5 15.8A6.6 6.6 0 0 1 8.2 4.4a6.6 6.6 0 1 0 8.6 9.2 6.6 6.6 0 0 1-2.3 2.2z" fill="#8B9BFF"/>',
      cloud: '<circle cx="8" cy="8" r="3.4" fill="#FFB020"/><path d="M7 18a3.6 3.6 0 0 1-.4-7.2 5 5 0 0 1 9.6.8A3.2 3.2 0 0 1 16.4 18z" fill="#A7B1C2"/>',
      rain: '<path d="M6.6 13a3.6 3.6 0 0 1-.4-7.2 5 5 0 0 1 9.6.8 3.2 3.2 0 0 1 .2 6.4z" fill="#A7B1C2"/><path d="M8 15.5l-1 3M11.5 15.5l-1 3M15 15.5l-1 3" stroke="#3D8BFF" stroke-width="1.8" stroke-linecap="round"/>',
    };

    function getPointAtHour(h: number): {
      temp: number;
      rainPct: number;
      code: string;
    } {
      const norm = ((h % 24) + 24) % 24;
      const i0 = Math.floor(norm) % 24;
      const i1 = (i0 + 1) % 24;
      const frac = norm - Math.floor(norm);
      const p0 = hourModel[i0] || { tempC: weather.temperatureC, precipProbPct: weather.precipProbPct, conditionCode: 'CLEAR' };
      const p1 = hourModel[i1] || p0;
      return {
        temp: Math.round(p0.tempC + (p1.tempC - p0.tempC) * frac),
        rainPct: Math.round(p0.precipProbPct + (p1.precipProbPct - p0.precipProbPct) * frac),
        code: (frac < 0.5 ? p0.conditionCode : p1.conditionCode) || 'CLEAR',
      };
    }

    function cond(h: number): [string, 'sun' | 'moon' | 'cloud' | 'rain', number] {
      const pt = getPointAtHour(h);
      const upper = pt.code.toUpperCase();
      const isNightHour = h < 6 || h >= 19.2;
      if (
        pt.rainPct >= 45 ||
        upper.includes('RAIN') ||
        upper.includes('STORM') ||
        upper.includes('THUNDER') ||
        upper.includes('DRIZZLE')
      ) {
        return [`Mưa rào · ${pt.rainPct}% mưa`, 'rain', 0.95];
      }
      if (isNightHour) {
        return [
          pt.rainPct >= 20 ? `Đêm có mây · ${pt.rainPct}%` : 'Đêm quang mây',
          'moon',
          pt.rainPct >= 20 ? 0.35 : 0.12,
        ];
      }
      if (upper.includes('CLOUD') || upper.includes('FOG') || pt.rainPct >= 25) {
        return [`Có mây · ${pt.rainPct}% mưa`, 'cloud', 0.58];
      }
      if (h < 7.5) {
        return ['Bình minh dịu mát', 'sun', 0.16];
      }
      if (h >= 17.2) {
        return ['Hoàng hôn chuyển chiều', 'cloud', 0.34];
      }
      return ['Trời nắng thoáng đãng', 'sun', 0.12];
    }

    function temp(h: number): number {
      return getPointAtHour(h).temp;
    }

    function hx(c: string): [number, number, number] {
      return [
        parseInt(c.slice(1, 3), 16),
        parseInt(c.slice(3, 5), 16),
        parseInt(c.slice(5, 7), 16),
      ];
    }

    function mix(aHex: string, bHex: string, t: number): string {
      const a = hx(aHex);
      const b = hx(bHex);
      return (
        'rgb(' +
        a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',') +
        ')'
      );
    }

    function label(h: number): string {
      const hh = Math.floor(h) % 24;
      const mm = Math.round((h - Math.floor(h)) * 60) >= 30 ? '30' : '00';
      return `${String(hh).padStart(2, '0')}:${mm}`;
    }

    // Populate stars and raindrops deterministically on mount (clearing previous for StrictMode)
    starsEl.innerHTML = '';
    for (let i = 0; i < 18; i += 1) {
      const s = document.createElement('i');
      s.style.left = `${8 + ((i * 47) % 84)}%`;
      s.style.top = `${6 + ((i * 31) % 60)}%`;
      s.style.animationDelay = `${((i * 0.37) % 2.6).toFixed(2)}s`;
      starsEl.appendChild(s);
    }

    dropsEl.innerHTML = '';
    for (let i = 0; i < 22; i += 1) {
      const d = document.createElement('i');
      d.style.left = `${(i * 29) % 118}%`;
      d.style.animationDelay = `${(-((i * 0.19) % 0.8)).toFixed(2)}s`;
      d.style.animationDuration = `${(0.6 + ((i * 0.07) % 0.4)).toFixed(2)}s`;
      dropsEl.appendChild(d);
    }

    labs.innerHTML = '';
    let hour = weather.isDay ? 9 : 20;
    let shownT: number | null = null;
    let tw = 0;

    function set(h: number): void {
      if (!sky || !orb || !tEl || !cEl || !now || !strip || !trk || !kn || !root) {
        return;
      }
      hour = (h + 24) % 24;
      let k = 0;
      while (k + 1 < SKY.length - 1 && SKY[k + 1][0] <= hour) {
        k += 1;
      }
      const a = SKY[k];
      const b = SKY[k + 1];
      const span = Math.max(0.001, b[0] - a[0]);
      const t = Math.max(0, Math.min(1, (hour - a[0]) / span));

      sky.style.setProperty('--s1', mix(a[1], b[1], t));
      sky.style.setProperty('--s2', mix(a[2], b[2], t));

      const day = hour >= 6 && hour < 18;
      const p = day ? (hour - 6) / 12 : ((hour - 18 + 24) % 24) / 12;

      // Scale horizontal Bezier coordinate proportionally to current container width
      const widthScale = (sky.clientWidth || 340) / 340;
      const rawX = (1 - p) * (1 - p) * 120 + 2 * (1 - p) * p * 225 + p * p * 330;
      const x = rawX * widthScale;
      const y = (1 - p) * (1 - p) * 206 + 2 * (1 - p) * p * -118 + p * p * 206;

      orb.className = 'u094-orb ' + (day ? 'sun' : 'moon');
      orb.style.setProperty('--ox', `${x.toFixed(1)}px`);
      orb.style.setProperty('--oy', `${y.toFixed(1)}px`);
      orb.style.opacity = Math.min(1, Math.sin(Math.PI * p) * 3.5).toFixed(2);

      const c = cond(hour);
      sky.style.setProperty('--cloud', String(c[2]));
      sky.style.setProperty(
        '--night',
        day ? Math.max(0, 1 - Math.min(hour - 6, 18 - hour) * 1.5).toFixed(2) : '1'
      );
      root.classList.toggle('rain', c[1] === 'rain');

      const T = temp(hour);
      if (T !== shownT) {
        if (shownT !== null && !rm && typeof tEl.animate === 'function') {
          tEl.animate(
            [
              {
                transform: `translateY(${T > shownT ? 10 : -10}px)`,
                opacity: 0.2,
              },
              { transform: 'none', opacity: 1 },
            ],
            { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' }
          );
        }
        shownT = T;
        tEl.textContent = `${T}°`;
      }
      cEl.textContent = c[0];
      now.textContent = `🕒 ${label(hour)}`;
      trk.style.setProperty('--x', `${((hour / 24) * 100).toFixed(2)}%`);
      kn.classList.toggle('moon', !day);

      if (LB.length > 0) {
        const near = LB.reduce((m, l) =>
          Math.abs(l[0] - hour) < Math.abs(m[0] - hour) ? l : m
        );
        LB.forEach((l) => {
          l[1].classList.toggle('on', l === near && Math.abs(l[0] - hour) <= 1.6);
        });
      }
      strip.setAttribute('aria-valuenow', hour.toFixed(1));
      strip.setAttribute('aria-valuetext', `${label(hour)}, ${T} độ C, ${c[0]}`);
    }

    function glide(to: number): void {
      cancelAnimationFrame(tw);
      const from = hour;
      const t0 = performance.now();
      const dur = rm ? 1 : 700;
      function f(n: number): void {
        if (!root || !root.isConnected) {
          return;
        }
        const k = Math.min(1, Math.max(0, (n - t0) / dur));
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        set(from + (to - from) * e);
        if (k < 1) {
          tw = requestAnimationFrame(f);
        }
      }
      f(t0);
    }

    const LB: Array<[number, HTMLButtonElement]> = [3, 6, 9, 12, 15, 18, 21].map(
      (h) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'u094-lb';
        b.tabIndex = -1;
        b.style.left = `${(h / 24) * 100}%`;
        const c = cond(h);
        const tVal = temp(h);
        b.innerHTML = `<small>${String(h).padStart(2, '0')}h</small><svg viewBox="0 0 22 22" aria-hidden="true">${ICON[c[1]]}</svg><b>${tVal}°</b>`;
        b.setAttribute('aria-label', `${h}:00, ${tVal} độ C, ${c[0]}`);
        const onClick = (e: MouseEvent) => {
          e.stopPropagation();
          glide(h);
        };
        const onPointerDown = (e: PointerEvent) => {
          e.stopPropagation();
        };
        b.addEventListener('click', onClick);
        b.addEventListener('pointerdown', onPointerDown);
        labs.appendChild(b);
        return [h, b];
      }
    );

    function at(e: PointerEvent): number {
      const r = trk!.getBoundingClientRect();
      return Math.max(
        0,
        Math.min(23.5, ((e.clientX - r.left) / Math.max(1, r.width)) * 24)
      );
    }

    let down = false;
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') {
        return;
      }
      down = true;
      cancelAnimationFrame(tw);
      try {
        strip.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if synthetic event
      }
      strip.classList.add('drag');
      set(at(e));
    };
    const onPointerMove = (e: PointerEvent) => {
      if (down) {
        set(at(e));
      }
    };
    const up = () => {
      if (!down) {
        return;
      }
      down = false;
      strip.classList.remove('drag');
      glide(Math.round(hour * 2) / 2);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      let to: number | null = null;
      const r = Math.round(hour);
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        to = Math.min(23.5, r + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        to = Math.max(0, r - 1);
      } else if (e.key === 'Home') {
        to = 0;
      } else if (e.key === 'End') {
        to = 23.5;
      }
      if (to === null) {
        return;
      }
      e.preventDefault();
      glide(to);
    };

    strip.addEventListener('pointerdown', onPointerDown);
    strip.addEventListener('pointermove', onPointerMove);
    strip.addEventListener('pointerup', up);
    strip.addEventListener('pointercancel', up);
    strip.addEventListener('keydown', onKeyDown);

    cleanups.push(() => {
      strip.removeEventListener('pointerdown', onPointerDown);
      strip.removeEventListener('pointermove', onPointerMove);
      strip.removeEventListener('pointerup', up);
      strip.removeEventListener('pointercancel', up);
      strip.removeEventListener('keydown', onKeyDown);
    });

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        if (root.isConnected) {
          set(hour);
        }
      });
      ro.observe(sky);
      cleanups.push(() => ro.disconnect());
    }

    const startHour = weather.isDay ? 9 : 19;
    const targetHour = weather.isDay ? 14 : 21;
    set(startHour);
    if (rm) {
      set(targetHour);
    } else {
      const timerId = window.setTimeout(() => {
        if (root.isConnected) {
          glide(targetHour);
        }
      }, 360);
      cleanups.push(() => window.clearTimeout(timerId));
    }

    return () => {
      cancelAnimationFrame(tw);
      cleanups.forEach((fn) => fn());
    };
  }, [hourModel, weather.isDay, weather.temperatureC, weather.precipProbPct, reduceMotion]);

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
          Bầu trời tương tác 24h · {sanitizeCopy(weather.locationName)}
        </Text>
        <Text style={[nativeStyles.fallbackSub, { color: palette.inkSecondary }]}>
          {Math.round(weather.temperatureC)}°C · Cao {hiTemp}° · Thấp {loTemp}°
        </Text>
      </View>
    );
  }

  const uxVars = buildPaletteUxVars(palette) as React.CSSProperties;

  return (
    <div
      ref={rootRef}
      className="ux u094"
      data-theme={palette.isDark ? 'dark' : 'light'}
      style={uxVars}
    >
      <div className="u094-sky" aria-hidden="true">
        <div className="u094-stars" />
        <svg
          className="u094-arc"
          viewBox="0 0 340 262"
          preserveAspectRatio="none"
        >
          <path d="M120 206Q225 -118 330 206" />
        </svg>
        <span className="u094-orb sun" />
        <div className="u094-hz" />
        <div className="u094-cl a">
          <svg viewBox="0 0 150 60">
            <path d="M30 58a24 24 0 0 1-2-48 32 32 0 0 1 60-4 26 26 0 0 1 34 18 18 18 0 0 1 4 34z" />
          </svg>
        </div>
        <div className="u094-cl b">
          <svg viewBox="0 0 150 60">
            <path d="M30 58a24 24 0 0 1-2-48 32 32 0 0 1 60-4 26 26 0 0 1 34 18 18 18 0 0 1 4 34z" />
          </svg>
        </div>
        <div className="u094-drops" />
        <div className="u094-info">
          <small>{sanitizeCopy(weather.locationName)} · Mô phỏng bầu trời 24h</small>
          <b className="u094-t">{Math.round(weather.temperatureC)}°</b>
          <span className="u094-c">{sanitizeCopy(weather.conditionText)}</span>
          <span className="u094-meta">
            Cao {hiTemp}° · Thấp {loTemp}° · Cảm giác {Math.round(weather.feelsLikeC)}°
          </span>
        </div>
        <span className="u094-now">🕒 14:00</span>
        <span className="u094-hint">Kéo thanh giờ ↔</span>
      </div>
      <div
        className="u094-strip"
        role="slider"
        tabIndex={0}
        aria-label="Thanh trượt thời gian bầu trời 24 giờ"
        aria-valuemin={0}
        aria-valuemax={23.5}
        aria-valuenow={14}
      >
        <div className="u094-labs" />
        <div className="u094-trk">
          <i />
          <span className="u094-kn">
            <i />
          </span>
        </div>
      </div>
    </div>
  );
};

function renderMetricSvgIcon(
  iconKey: TelemetryMetricCardItem['iconKey'],
  accentColor: string
): React.ReactNode {
  switch (iconKey) {
    case 'temp':
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M14 14.76V5a2 2 0 1 0-4 0v9.76a4 4 0 1 0 4 0Z"
            stroke={accentColor}
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="17.5" r="1.7" fill={accentColor} />
        </svg>
      );
    case 'feels':
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 12h4l2.8-7 4.4 14 2.8-7H21"
            stroke="#38BDF8"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'rain':
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.1A7 7 0 1 0 4 14.9"
            stroke="#60A5FA"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8.5 19l-1.2 2.5M12.5 19l-1.2 2.5M16.5 19l-1.2 2.5"
            stroke="#3B82F6"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'wind':
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"
            stroke="#34D399"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'uv':
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" stroke="#FBBF24" strokeWidth="2.1" />
          <path
            d="M12 2v2.4M12 19.6V22M4.93 4.93l1.7 1.7M17.37 17.37l1.7 1.7M2 12h2.4M19.6 12H22M4.93 19.07l1.7-1.7M17.37 6.63l1.7-1.7"
            stroke="#FBBF24"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'aqi':
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3l7 3v5c0 5-3 8.2-7 10-4-1.8-7-5-7-10V6l7-3Z"
            stroke="#A78BFA"
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          <path
            d="M9 12.2l2 2 4-4"
            stroke="#A78BFA"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

/**
 * Ported Lucian Element #228: "Cursor-lit glowing card borders"
 * Renders the 6 Weather Telemetry Bento Cards with cross-gap radial cursor border spotlight.
 */
export const LucianGlowingBento228: React.FC<LucianGlowingBento228Props> = ({
  palette,
  metrics,
  reduceMotion = false,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    ensureLucianStageCssInjected();
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const rm = Boolean(reduceMotion || mq.matches);

    let p = { x: -500, y: -500 };
    let o = 0;
    let oT = 0;
    let raf = 0;
    let last = 0;

    function getCards(): HTMLElement[] {
      if (!root) {
        return [];
      }
      return Array.prototype.slice.call(root.querySelectorAll('.u228-c'));
    }

    function apply(): void {
      if (!root) {
        return;
      }
      const rb = root.getBoundingClientRect();
      const k = root.offsetWidth / (rb.width || 1);
      const cards = getCards();
      cards.forEach((el) => {
        const r = el.getBoundingClientRect();
        const lx = p.x - (r.left - rb.left) * k;
        const ly = p.y - (r.top - rb.top) * k;
        el.style.setProperty('--cx', `${lx.toFixed(1)}px`);
        el.style.setProperty('--cy', `${ly.toFixed(1)}px`);
        el.style.setProperty('--o', o.toFixed(3));
        const inner = el.firstElementChild as HTMLElement | null;
        if (inner) {
          inner.style.setProperty('--cx', `${(lx - 1.5).toFixed(1)}px`);
          inner.style.setProperty('--cy', `${(ly - 1.5).toFixed(1)}px`);
        }
      });
    }

    function frame(now: number): void {
      raf = 0;
      if (!root || !root.isConnected) {
        return;
      }
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      o += (oT - o) * (rm ? 1 : Math.min(1, dt * (oT ? 8 : 2.5)));
      apply();
      if (Math.abs(oT - o) > 0.005) {
        raf = requestAnimationFrame(frame);
      }
    }

    function kick(): void {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      const b = root.getBoundingClientRect();
      const k = root.offsetWidth / (b.width || 1);
      p = {
        x: (e.clientX - b.left) * k,
        y: (e.clientY - b.top) * k,
      };
      oT = 1;
      apply();
      kick();
    };

    const onPointerLeave = () => {
      oT = 0;
      kick();
    };

    const onFocusIn = (e: FocusEvent) => {
      const target = (e.target as HTMLElement | null)?.closest('.u228-c') as HTMLElement | null;
      if (!target) {
        return;
      }
      const b = root.getBoundingClientRect();
      const r = target.getBoundingClientRect();
      const k = root.offsetWidth / (b.width || 1);
      p = {
        x: (r.left - b.left + r.width / 2) * k,
        y: (r.top - b.top + r.height / 2) * k,
      };
      oT = 1;
      apply();
      kick();
    };

    const onFocusOut = () => {
      oT = 0;
      kick();
    };

    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerleave', onPointerLeave);
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);
    apply();

    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerleave', onPointerLeave);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
    };
  }, [metrics, reduceMotion]);

  if (Platform.OS !== 'web') {
    return (
      <View style={nativeStyles.nativeGrid}>
        {metrics.map((m) => (
          <View
            key={m.id}
            style={[
              nativeStyles.nativeMetricCard,
              {
                backgroundColor: palette.coreSurfaceBg,
                borderColor: palette.bezelOuterBorder,
              },
            ]}
          >
            <Text style={[nativeStyles.nativeMetricLabel, { color: palette.inkSecondary }]}>
              {m.label}
            </Text>
            <Text style={[nativeStyles.nativeMetricVal, { color: palette.inkPrimary }]}>
              {m.value}
            </Text>
            <Text style={[nativeStyles.nativeMetricDet, { color: palette.inkMuted }]}>
              {m.detail}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  const uxVars = buildPaletteUxVars(palette) as React.CSSProperties;

  return (
    <div
      ref={rootRef}
      className="ux u228"
      data-theme={palette.isDark ? 'dark' : 'light'}
      style={uxVars}
    >
      <div className="u228-hdr">
        <div className="u228-hdr-title">
          <span className="u228-hdr-dot" aria-hidden="true" />
          <span>Chỉ số Khí tượng Chi tiết (Bento 6-Metric)</span>
        </div>
        <span className="u228-hdr-sub">Di chuột để chiếu sáng viền</span>
      </div>
      <div
        className="u228-gd"
        role="list"
        aria-label="Sáu thẻ chỉ số thời tiết chi tiết"
      >
        {metrics.map((m) => {
          const clampedPct = Math.max(6, Math.min(100, Math.round(m.progressPct)));
          return (
            <div
              key={m.id}
              className="u228-c"
              role="listitem"
              tabIndex={0}
              aria-label={`${m.label}: ${m.value}, ${m.badge}, ${m.detail}`}
            >
              <div className="u228-in">
                <div className="u228-top">
                  <span className="u228-ic">
                    {renderMetricSvgIcon(m.iconKey, m.accentColor || palette.accent)}
                  </span>
                  <span className="u228-tag">{m.badge}</span>
                </div>
                <span className="u228-lbl">{m.label}</span>
                <b className="u228-val">{m.value}</b>
                <div className="u228-bar" aria-hidden="true">
                  <i
                    style={{
                      width: `${clampedPct}%`,
                      backgroundColor: m.accentColor || palette.accent,
                    }}
                  />
                </div>
                <span className="u228-det">{m.detail}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Ported Lucian Element #047: "Period segmented control"
 * Embedded inside the Left Hero Bento Card to switch between 12h Temperature Curve,
 * Rain Probability Curve, Next 6h Window, and Full 24h Trend with stretching knob
 * and smooth cubic-Bezier SVG curve morphing.
 */
export const LucianForecastTrend047: React.FC<LucianForecastTrend047Props> = ({
  palette,
  weather,
  reduceMotion = false,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);

  const datasets = useMemo(() => {
    const hourly12 = (weather.hourly ?? []).slice(0, 12);
    const hourly24 = (weather.hourly ?? []).slice(0, 24);
    const fallbackTemps = Array.from({ length: 12 }, (_, i) =>
      Math.round(weather.temperatureC + Math.sin((i / 12) * Math.PI * 2) * 2.5)
    );
    const temps12 =
      hourly12.length >= 4
        ? hourly12.map((h) => h.temperatureC)
        : fallbackTemps;
    const rains12 =
      hourly12.length >= 4
        ? hourly12.map((h) => h.precipProbPct)
        : Array.from({ length: 12 }, () => weather.precipProbPct);
    const temps6 = temps12.slice(0, 6);
    const temps24 =
      hourly24.length >= 6
        ? hourly24.map((h) => h.temperatureC)
        : temps12;

    function normalizeSeries(arr: number[], minFloor = 0.14, maxCeil = 0.92): number[] {
      const lo = Math.min(...arr);
      const hi = Math.max(...arr);
      const span = hi - lo;
      if (span < 0.5) {
        return arr.map((_, idx) => 0.48 + Math.sin(idx * 0.7) * 0.06);
      }
      return arr.map(
        (v) => minFloor + ((v - lo) / span) * (maxCeil - minFloor)
      );
    }

    const avgTemp12 =
      temps12.reduce((sum, v) => sum + v, 0) / Math.max(1, temps12.length);
    const deltaTemp12 =
      (temps12[temps12.length - 1] ?? weather.temperatureC) -
      (temps12[0] ?? weather.temperatureC);

    const maxRain12 = Math.max(weather.precipProbPct, ...rains12);
    const deltaRain12 =
      (rains12[rains12.length - 1] ?? weather.precipProbPct) -
      (rains12[0] ?? weather.precipProbPct);

    const avgTemp6 =
      temps6.reduce((sum, v) => sum + v, 0) / Math.max(1, temps6.length);
    const deltaTemp6 =
      (temps6[temps6.length - 1] ?? weather.temperatureC) -
      (temps6[0] ?? weather.temperatureC);

    const hiTemp24 = Math.max(weather.temperatureC, ...temps24);
    const loTemp24 = Math.min(weather.temperatureC, ...temps24);

    return [
      {
        tab: 'Nhiệt độ 12h',
        l: `Biên độ nhiệt 12 giờ tới · Trung bình ${Math.round(avgTemp12)}°C`,
        v: Math.round(avgTemp12),
        unit: '°C',
        p: Number(deltaTemp12.toFixed(1)),
        pUnit: '°',
        pts: normalizeSeries(temps12),
      },
      {
        tab: 'Khả năng mưa',
        l: `Đỉnh xác suất mưa 12 giờ tới · Hiện tại ${Math.round(weather.precipProbPct)}%`,
        v: Math.round(maxRain12),
        unit: '%',
        p: Number(deltaRain12.toFixed(0)),
        pUnit: '%',
        pts: normalizeSeries(rains12, 0.1, 0.94),
      },
      {
        tab: '6 giờ tới',
        l: `Xu hướng ngắn hạn 6 giờ tới · Cảm giác ${Math.round(weather.feelsLikeC)}°C`,
        v: Math.round(avgTemp6),
        unit: '°C',
        p: Number(deltaTemp6.toFixed(1)),
        pUnit: '°',
        pts: normalizeSeries(temps6.length >= 4 ? temps6 : temps12),
      },
      {
        tab: 'Đỉnh 24h',
        l: `Đỉnh nhiệt trong ngày · Thấp nhất ${Math.round(loTemp24)}°C`,
        v: Math.round(hiTemp24),
        unit: '°C',
        p: Number((hiTemp24 - loTemp24).toFixed(1)),
        pUnit: '°',
        pts: normalizeSeries(temps24),
      },
    ];
  }, [weather]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    ensureLucianStageCssInjected();
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const seg = root.querySelector('.u047-seg') as HTMLElement | null;
    const knob = root.querySelector('.u047-knob') as HTMLElement | null;
    const opts = Array.prototype.slice.call(
      root.querySelectorAll('.u047-opt')
    ) as HTMLButtonElement[];
    const num = root.querySelector('.u047-num') as HTMLElement | null;
    const lab = root.querySelector('.u047-lab') as HTMLElement | null;
    const chg = root.querySelector('.u047-chg') as HTMLElement | null;
    const pct = chg?.querySelector('span') as HTMLElement | null;
    const area = root.querySelector('.u047-area') as SVGPathElement | null;
    const line = root.querySelector('.u047-line') as SVGPathElement | null;
    const dot = root.querySelector('.u047-dot') as SVGCircleElement | null;
    const halo = root.querySelector('.u047-halo') as SVGCircleElement | null;
    const grad = root.querySelector('linearGradient') as SVGLinearGradientElement | null;

    if (!seg || !knob || opts.length === 0 || !num || !lab || !chg || !pct || !area || !line || !dot || !halo || !grad) {
      return;
    }

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const rm = Boolean(reduceMotion || mq.matches);

    const gid = 'u047-f' + Math.random().toString(36).slice(2, 7);
    grad.id = gid;
    area.setAttribute('fill', `url(#${gid})`);

    let cur = 0;
    const targetLen = datasets[0].pts.length;
    let shown = {
      v: datasets[0].v,
      p: datasets[0].p,
      unit: datasets[0].unit,
      pUnit: datasets[0].pUnit,
      pts: datasets[0].pts.map(() => 0.25),
    };
    let raf = 0;

    function resample(pts: number[], len: number): number[] {
      if (pts.length === len) {
        return pts.slice();
      }
      const res: number[] = [];
      for (let i = 0; i < len; i += 1) {
        const pos = (i / Math.max(1, len - 1)) * (pts.length - 1);
        const i0 = Math.floor(pos);
        const i1 = Math.min(pts.length - 1, i0 + 1);
        const f = pos - i0;
        res.push(pts[i0] + (pts[i1] - pts[i0]) * f);
      }
      return res;
    }

    function xy(pts: number[]): Array<[number, number]> {
      return pts.map((v, i) => [
        (i * 350) / Math.max(1, pts.length - 1),
        136 - Math.max(0.08, Math.min(0.95, v)) * 112,
      ]);
    }

    function path(p: Array<[number, number]>): string {
      let d = `M${p[0][0]},${p[0][1]}`;
      for (let i = 0; i < p.length - 1; i += 1) {
        const a = p[i - 1] || p[i];
        const b = p[i];
        const c = p[i + 1];
        const e = p[i + 2] || c;
        d +=
          `C${(b[0] + (c[0] - a[0]) / 6).toFixed(1)},${(
            b[1] +
            (c[1] - a[1]) / 6
          ).toFixed(1)} ` +
          `${(c[0] - (e[0] - b[0]) / 6).toFixed(1)},${(
            c[1] -
            (e[1] - b[1]) / 6
          ).toFixed(1)} ` +
          `${c[0].toFixed(1)},${c[1].toFixed(1)}`;
      }
      return d;
    }

    function paint(): void {
      const p = xy(shown.pts);
      const d = path(p);
      const lastPt = p[p.length - 1];
      line!.setAttribute('d', d);
      area!.setAttribute('d', `${d}L350,150L0,150Z`);
      dot!.setAttribute('cx', String(lastPt[0]));
      dot!.setAttribute('cy', String(lastPt[1]));
      halo!.setAttribute('cx', String(lastPt[0]));
      halo!.setAttribute('cy', String(lastPt[1]));
      num!.textContent = `${Math.round(shown.v)}${shown.unit}`;
      const sign = shown.p >= 0 ? '+' : '-';
      pct!.textContent = `${sign}${Math.abs(shown.p).toFixed(1)}${shown.pUnit}`;
    }

    function tween(to: (typeof datasets)[number]): void {
      cancelAnimationFrame(raf);
      const toPts = resample(to.pts, targetLen);
      const from = {
        v: shown.v,
        p: shown.p,
        pts: resample(shown.pts, targetLen),
      };
      shown.unit = to.unit;
      shown.pUnit = to.pUnit;
      let t0 = 0;
      const dur = 750;
      if (rm) {
        shown = {
          v: to.v,
          p: to.p,
          unit: to.unit,
          pUnit: to.pUnit,
          pts: toPts,
        };
        paint();
        return;
      }
      function step(now: number): void {
        if (!root || !root.isConnected) {
          return;
        }
        if (!t0) {
          t0 = now;
        }
        const k = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - k, 4);
        shown.v = from.v + (to.v - from.v) * e;
        shown.p = from.p + (to.p - from.p) * e;
        shown.pts = from.pts.map((v, i) => v + (toPts[i] - v) * e);
        paint();
        if (k < 1) {
          raf = requestAnimationFrame(step);
        }
      }
      raf = requestAnimationFrame(step);
    }

    function place(dir: number): void {
      const o = opts[cur];
      if (!o || !seg || !knob) {
        return;
      }
      seg.classList.toggle('go-r', dir > 0);
      seg.classList.toggle('go-l', dir < 0);
      knob.style.setProperty('--l', `${o.offsetLeft}px`);
      knob.style.setProperty(
        '--r',
        `${Math.max(4, seg.clientWidth - o.offsetLeft - o.offsetWidth)}px`
      );
    }

    function select(i: number, focus?: boolean, first?: boolean): void {
      if (i === cur && !first) {
        return;
      }
      const dir = first ? 0 : i > cur ? 1 : -1;
      cur = i;
      opts.forEach((o, k) => {
        o.setAttribute('aria-checked', String(k === i));
        o.tabIndex = k === i ? 0 : -1;
      });
      if (focus) {
        opts[i].focus();
      }
      place(dir);
      const d = datasets[i];
      lab!.textContent = d.l;
      chg!.classList.toggle('down', d.p < 0);
      chg!.setAttribute(
        'aria-label',
        `${d.p < 0 ? 'Giảm ' : 'Tăng '}${Math.abs(d.p)}${d.pUnit}`
      );
      tween(d);
    }

    const cleanups: Array<() => void> = [];
    opts.forEach((o, i) => {
      const onClick = () => select(i);
      const onKeyDown = (e: KeyboardEvent) => {
        const d =
          e.key === 'ArrowRight' || e.key === 'ArrowDown'
            ? 1
            : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
              ? -1
              : 0;
        if (d) {
          e.preventDefault();
          select((i + d + 4) % 4, true);
        }
      };
      o.addEventListener('click', onClick);
      o.addEventListener('keydown', onKeyDown);
      cleanups.push(() => {
        o.removeEventListener('click', onClick);
        o.removeEventListener('keydown', onKeyDown);
      });
    });

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        if (root.isConnected) {
          place(0);
        }
      });
      ro.observe(seg);
      cleanups.push(() => ro.disconnect());
    }

    select(0, false, true);

    return () => {
      cancelAnimationFrame(raf);
      cleanups.forEach((fn) => fn());
    };
  }, [datasets, reduceMotion]);

  if (Platform.OS !== 'web') {
    return null;
  }

  const uxVars = buildPaletteUxVars(palette) as React.CSSProperties;

  return (
    <div
      ref={rootRef}
      className="ux u047"
      data-theme={palette.isDark ? 'dark' : 'light'}
      style={uxVars}
    >
      <div
        className="u047-seg"
        role="radiogroup"
        aria-label="Chế độ biểu đồ xu hướng thời tiết"
      >
        <span className="u047-knob" aria-hidden="true" />
        {datasets.map((d, idx) => (
          <button
            key={d.tab}
            className="u047-opt"
            type="button"
            role="radio"
            aria-checked={idx === 0 ? 'true' : 'false'}
          >
            {d.tab}
          </button>
        ))}
      </div>
      <div className="u047-lab">{datasets[0].l}</div>
      <div className="u047-row" aria-live="polite">
        <div className="u047-num-wrap">
          <span className="u047-num">
            {datasets[0].v}
            {datasets[0].unit}
          </span>
          <span className="u047-chg">
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2.5 7.5L6 4l3.5 3.5" />
            </svg>
            <span>0°</span>
          </span>
        </div>
      </div>
      <div className="u047-chart" aria-hidden="true">
        <svg viewBox="0 0 350 150" preserveAspectRatio="none">
          <defs>
            <linearGradient id="u047-fill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0"
                style={{
                  stopColor: 'var(--ux-accent)',
                  stopOpacity: 0.28,
                }}
              />
              <stop
                offset="1"
                style={{
                  stopColor: 'var(--ux-accent)',
                  stopOpacity: 0,
                }}
              />
            </linearGradient>
          </defs>
          <g className="u047-grid">
            <line x1="0" x2="350" y1="40" y2="40" />
            <line x1="0" x2="350" y1="85" y2="85" />
          </g>
          <path className="u047-area" />
          <path className="u047-line" />
          <circle className="u047-halo" r="9" />
          <circle className="u047-dot" r="5.5" />
        </svg>
      </div>
    </div>
  );
};

const nativeStyles = StyleSheet.create({
  fallbackCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 6,
  },
  fallbackTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 15,
    fontWeight: '700',
  },
  fallbackSub: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13,
    fontWeight: '500',
  },
  nativeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  nativeMetricCard: {
    width: '48%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  nativeMetricLabel: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '600',
  },
  nativeMetricVal: {
    fontFamily: FONT_FAMILY_DISPLAY,
    fontSize: 22,
    fontWeight: '700',
  },
  nativeMetricDet: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 11.5,
    fontWeight: '500',
  },
});

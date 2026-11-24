/* Lucian UX/UI Prompt #094 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#094 */
/* Lucian UX/UI Prompt #228 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#228 */
/* Lucian UX/UI Prompt #047 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#047 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import {
  Clock,
  CloudRain,
  ShieldWarning,
  Sparkle,
  SunDim,
  ThermometerHot,
  Wind,
} from '../components/AppIcons';
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
  explainVi?: string;
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
  realtimeAdviceVi?: string;
  updatedLabel?: string;
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
/* Lucian UX/UI Prompt theme tokens fallback + .ux base (pbakaus/impeccable OKLCH calibrated) */
:root{
  --ux-page:#F7F5F0;
  --ux-surface:#FCFBF8;
  --ux-surface-2:#F3EFE8;
  --ux-surface-3:#ECE8DF;
  --ux-ink:#141D2B;
  --ux-ink-2:#36455C;
  --ux-ink-3:#53647D;
  --ux-line:rgba(20,29,43,.09);
  --ux-line-2:rgba(20,29,43,.17);
  --ux-accent:#1E6BB8;
  --ux-accent-2:#2A7AC9;
  --ux-accent-soft:rgba(30,107,184,.11);
  --ux-accent-ink:#FCFBF8;
  --ux-mint:#13845E;
  --ux-warn:#B86B1D;
  --ux-danger:#C4384B;
  --ux-glass:rgba(252,251,248,.74);
  --ux-glass-line:rgba(252,251,248,.88);
  --ux-shadow:rgba(20,29,43,.10);
  --ux-shadow-strong:rgba(20,29,43,.22);
  --ux-grad:linear-gradient(120deg,#1E6BB8,#2A7AC9 55%,#13845E);
  --ux-ease:cubic-bezier(.2,.8,.2,1);
  --ux-spring:cubic-bezier(.34,1.45,.64,1);
}
:root[data-theme="dark"]{
  --ux-page:#0B1220;
  --ux-surface:#152033;
  --ux-surface-2:#1C2A42;
  --ux-surface-3:#22324D;
  --ux-ink:#EEF3FA;
  --ux-ink-2:#B2C1D6;
  --ux-ink-3:#7E91AC;
  --ux-line:rgba(203,221,245,.08);
  --ux-line-2:rgba(203,221,245,.15);
  --ux-accent:#6BA9E8;
  --ux-accent-2:#7EB6EE;
  --ux-accent-soft:rgba(107,169,232,.14);
  --ux-accent-ink:#0D1524;
  --ux-mint:#38B889;
  --ux-warn:#E5A23C;
  --ux-danger:#E26D7A;
  --ux-glass:rgba(21,32,51,.76);
  --ux-glass-line:rgba(203,221,245,.16);
  --ux-shadow:rgba(5,10,20,.44);
  --ux-shadow-strong:rgba(5,10,20,.68);
  --ux-grad:linear-gradient(120deg,#6BA9E8,#5899DA 55%,#38B889);
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
.u094-orb{position:absolute;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;transform:translate(var(--ox,220px),var(--oy,68px));pointer-events:none;transition:transform .38s var(--ux-spring),opacity .3s}
.u094.is-drag .u094-orb{transition:none}
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
.u094-lb{position:absolute;top:0;width:40px;margin-left:-20px;padding:6px 0 0;border:0;border-radius:14px;background:transparent;display:flex;flex-direction:column;align-items:center;gap:4px;color:var(--ux-ink-2);transition:background-color .25s,color .25s,transform .35s var(--ux-spring);z-index:2}
.u094-lb small{font-size:11px;font-weight:700;font-variant-numeric:tabular-nums}
.u094-lb svg{width:22px;height:22px}
.u094-lb b{padding-bottom:8px;font-size:13px;font-weight:800;color:var(--ux-ink-2);font-variant-numeric:tabular-nums}
.u094-lb.on{background:var(--ux-surface-2);color:var(--ux-ink);transform:translateY(-2px);box-shadow:0 0 0 1px var(--ux-line)}
.u094-lb.on b{color:var(--ux-ink)}
.u094-trk{position:relative;height:6px;margin-top:12px;border-radius:3px;background:var(--ux-surface-3)}
.u094-trk>i{position:absolute;left:0;top:0;bottom:0;width:var(--x,37.5%);border-radius:inherit;background:linear-gradient(90deg,#1E3152,#E8A582 26%,#58A6E8 50%,#E59A6C 77%,#16243D);transition:width .35s var(--ux-spring)}
.u094-strip.drag .u094-trk>i{transition:none}
.u094-kn{position:absolute;top:50%;left:var(--x,37.5%);width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;display:grid;place-items:center;background:var(--ux-surface);box-shadow:0 0 0 1px var(--ux-line-2),0 4px 12px -4px var(--ux-shadow-strong);transition:left .35s var(--ux-spring),transform .3s var(--ux-spring)}
.u094-strip.drag .u094-kn{transform:scale(1.15);transition:transform .2s var(--ux-spring)}
.u094-kn i{width:12px;height:12px;border-radius:50%;background:#E5A23C;transition:background-color .3s,box-shadow .3s}
.u094-kn.moon i{background:transparent;box-shadow:inset -4px -1px 0 0 #6BA9E8}
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
.u228{position:relative;width:100%;max-width:100%;min-height:340px;border-radius:28px;overflow:visible;background:var(--ux-surface);box-shadow:0 0 0 1px var(--ux-line),0 30px 60px -36px var(--ux-shadow-strong);color:var(--ux-ink);padding:18px;--x:-500px;--y:-500px;--o:0}
.u228-hdr{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px;padding:0 2px}
.u228-hdr-title{display:flex;align-items:center;gap:8px;font-size:14.5px;font-weight:800;color:var(--ux-ink)}
.u228-hdr-dot{width:8px;height:8px;border-radius:50%;background:var(--ux-accent);box-shadow:0 0 0 4px var(--ux-accent-soft);flex:none}
.u228-live-pill{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:999px;background:color-mix(in srgb,var(--ux-mint) 14%,transparent);border:1px solid color-mix(in srgb,var(--ux-mint) 32%,transparent);font-size:11px;font-weight:750;color:var(--ux-mint);font-variant-numeric:tabular-nums;white-space:nowrap}
.u228-live-dot{width:6.5px;height:6.5px;border-radius:50%;background:var(--ux-mint);box-shadow:0 0 0 3px color-mix(in srgb,var(--ux-mint) 24%,transparent);animation:u228-live 2.2s ease-in-out infinite}
@keyframes u228-live{50%{opacity:.42;transform:scale(.85)}}
.u228-advice-box{display:flex;align-items:flex-start;gap:9px;margin:0 0 13px;padding:10px 12px;border-radius:16px;background:linear-gradient(135deg,var(--ux-accent-soft),transparent 92%),var(--ux-surface-2);border:1px solid var(--ux-line-2)}
.u228-advice-ic{width:24px;height:24px;border-radius:8px;display:grid;place-items:center;background:var(--ux-surface);box-shadow:inset 0 0 0 1px var(--ux-line);flex:none;margin-top:1px}
.u228-advice-content{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.u228-advice-txt{font-size:12.2px;line-height:1.45;font-weight:680;color:var(--ux-ink)}
.u228-advice-hint{font-size:11px;line-height:1.35;font-weight:600;color:var(--ux-ink-3)}
.u228-gd{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;width:100%}
@media (min-width:680px){
  .u228-gd{grid-template-columns:repeat(3,minmax(0,1fr))}
}
.u228-c{position:relative;border-radius:20px;padding:1.5px;background:radial-gradient(190px circle at var(--cx,-500px) var(--cy,-500px),var(--u228-g1,rgba(99,173,255,calc(var(--o,0) * 1))),var(--u228-g2,rgba(56,189,248,calc(var(--o,0) * .55))) 42%,transparent 72%),var(--ux-line-2);transition:transform .28s var(--ux-spring);outline:none;cursor:help}
.u228-c:hover{transform:translateY(-1.5px)}
.u228-c:focus-visible{box-shadow:0 0 0 2px var(--ux-accent)}
.u228-in{position:relative;height:100%;min-height:136px;border-radius:18.5px;background:radial-gradient(230px circle at var(--cx,-500px) var(--cy,-500px),var(--u228-gin,rgba(99,173,255,calc(var(--o,0) * .15))),transparent 62%),var(--ux-surface-2);padding:14px;display:flex;flex-direction:column;gap:5px;overflow:hidden}
.u228-top{display:flex;align-items:center;justify-content:space-between;gap:6px}
.u228-ic{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:var(--ux-surface);box-shadow:inset 0 0 0 1px var(--ux-line-2);flex:none}
.u228-ic svg{width:17px;height:17px}
.u228-tag{font-size:10.8px;font-weight:750;padding:3px 8px;border-radius:999px;background:var(--ux-accent-soft);color:var(--ux-accent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:calc(100% - 38px)}
.u228-lbl-row{display:flex;align-items:center;justify-content:space-between;gap:5px;margin-top:3px}
.u228-lbl{font-size:12px;font-weight:720;color:var(--ux-ink-2);line-height:1.28;min-width:0}
.u228-q{width:17px;height:17px;border-radius:999px;display:inline-grid;place-items:center;flex:none;font-size:10.5px;font-weight:800;background:var(--ux-surface-3);color:var(--ux-ink-3);border:1px solid var(--ux-line);transition:background-color .22s,color .22s,border-color .22s,transform .22s var(--ux-spring)}
.u228-c:hover .u228-q,.u228-c:focus-visible .u228-q,.u228-c.tip-on .u228-q{background:var(--ux-accent);color:var(--ux-accent-ink);border-color:var(--ux-accent);transform:scale(1.08)}
.u228-val{font-size:24px;font-weight:800;letter-spacing:-.035em;line-height:1.12;color:var(--ux-ink);font-variant-numeric:tabular-nums}
.u228-bar{height:4px;border-radius:999px;background:var(--ux-surface-3);overflow:hidden;margin-top:auto}
.u228-bar>i{display:block;height:100%;border-radius:inherit;background:var(--ux-accent);transition:width .5s var(--ux-ease)}
.u228-in span.u228-det{font-size:11.3px;line-height:1.34;font-weight:620;color:var(--ux-ink-3);word-break:keep-all}
.u228-tip-pop{position:absolute;left:12px;top:12px;width:min(312px,calc(100% - 24px));z-index:35;padding:11px 13px;border-radius:16px;background:var(--ux-surface);border:1px solid var(--ux-line-2);box-shadow:0 18px 40px -14px var(--ux-shadow-strong),0 0 0 1px var(--ux-accent-soft);backdrop-filter:blur(14px);pointer-events:none;opacity:0;visibility:hidden;transform:translateY(4px) scale(.98);transition:opacity .18s var(--ux-ease),transform .22s var(--ux-spring),visibility 0s .18s}
.u228-tip-pop.on{opacity:1;visibility:visible;transform:translateY(0) scale(1);transition:opacity .18s var(--ux-ease),transform .22s var(--ux-spring)}
.u228-tip-hdr{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:5px;flex-wrap:wrap}
.u228-tip-title-wrap{display:flex;align-items:center;gap:6px;min-width:0}
.u228-tip-dot{width:7px;height:7px;border-radius:50%;background:var(--ux-accent);flex:none}
.u228-tip-title{font-size:12.2px;font-weight:800;color:var(--ux-ink);line-height:1.25}
.u228-tip-badge{font-size:10.5px;font-weight:750;padding:2px 7px;border-radius:999px;background:var(--ux-accent-soft);color:var(--ux-accent);font-variant-numeric:tabular-nums}
.u228-tip-body{margin:0;font-size:11.6px;line-height:1.46;font-weight:580;color:var(--ux-ink-2)}
.u228-tip-adv{display:block;margin-top:6px;padding-top:5px;border-top:1px dashed var(--ux-line);font-size:11px;line-height:1.35;font-weight:700;color:var(--ux-accent)}
@media (max-width:420px){
  .u228{padding:14px}
  .u228-gd{gap:9px}
  .u228-in{padding:11px;min-height:126px}
  .u228-ic{width:28px;height:28px;border-radius:9px}
  .u228-tag{font-size:10px;padding:2px 6px;max-width:calc(100% - 34px)}
  .u228-lbl{font-size:11.3px}
  .u228-val{font-size:20.5px}
  .u228-in span.u228-det{font-size:10.8px}
}

/* ============================================================================
   Lucian UX/UI Prompt #047 · Period segmented control (3h Range + Advice + Tip)
   ============================================================================ */
.u047{position:relative;width:100%;max-width:100%;height:auto;min-height:248px;display:flex;flex-direction:column;padding:14px 16px 0;border-radius:22px;background:var(--ux-surface);box-shadow:0 0 0 1px var(--ux-line),0 20px 44px -32px var(--ux-shadow-strong);overflow:hidden}
.u047-seg{position:relative;display:grid;grid-template-columns:repeat(4,1fr);padding:4px;border-radius:14px;background:var(--ux-surface-2)}
.u047-knob{position:absolute;top:4px;bottom:4px;left:var(--l,4px);right:var(--r,4px);border-radius:10px;background:var(--ux-surface);box-shadow:0 4px 12px -6px var(--ux-shadow-strong),0 0 0 1px var(--ux-line)}
.u047-seg.go-r .u047-knob{transition:right .3s var(--ux-ease),left .5s var(--ux-spring) .07s}
.u047-seg.go-l .u047-knob{transition:left .3s var(--ux-ease),right .5s var(--ux-spring) .07s}
.u047-opt{position:relative;height:34px;border:0;padding:0 4px;border-radius:10px;background:none;font-size:12px;font-weight:720;color:var(--ux-ink-2);transition:color .3s,transform .3s var(--ux-spring);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.u047-opt:hover{color:var(--ux-ink)}
.u047-opt:active{transform:scale(.94)}
.u047-opt[aria-checked="true"]{color:var(--ux-ink);font-weight:800}
.u047-opt:focus-visible{outline:2px solid var(--ux-accent);outline-offset:1px}
.u047-lab-wrap{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:11px 2px 0;cursor:help}
.u047-lab{font-size:12px;font-weight:680;color:var(--ux-ink-2);line-height:1.35;min-width:0}
.u047-help-btn{display:inline-flex;align-items:center;gap:4px;height:21px;padding:0 7px 0 5px;border-radius:999px;border:1px solid var(--ux-line-2);background:var(--ux-surface-2);color:var(--ux-ink-3);font-size:10.5px;font-weight:750;flex:none;transition:background-color .2s,color .2s,border-color .2s}
.u047-help-btn:hover,.u047-help-btn:focus-visible,.u047-help-btn.on{background:var(--ux-accent-soft);color:var(--ux-accent);border-color:var(--ux-accent)}
.u047-help-q{width:13px;height:13px;border-radius:50%;display:inline-grid;place-items:center;background:var(--ux-surface-3);font-size:9.5px;font-weight:800;line-height:1}
.u047-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin:3px 2px 0}
.u047-num-wrap{display:flex;align-items:center;gap:9px}
.u047-num{font-size:29px;font-weight:800;letter-spacing:-.045em;line-height:1.1;font-variant-numeric:tabular-nums;color:var(--ux-ink)}
.u047-chg{display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 9px;border-radius:999px;font-size:12px;font-weight:750;background:color-mix(in srgb,var(--ux-mint) 15%,transparent);color:var(--ux-mint);font-variant-numeric:tabular-nums;transition:background-color .4s,color .4s;cursor:help}
.u047-chg.down{background:color-mix(in srgb,var(--ux-danger) 13%,transparent);color:var(--ux-danger)}
.u047-chg svg{width:11px;height:11px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;transition:transform .45s var(--ux-spring)}
.u047-chg.down svg{transform:rotate(180deg)}
.u047-range-pill{font-size:11px;font-weight:720;padding:3px 9px;border-radius:999px;background:var(--ux-surface-2);border:1px solid var(--ux-line);color:var(--ux-ink-2);font-variant-numeric:tabular-nums;white-space:nowrap}
.u047-adv{display:flex;align-items:flex-start;gap:7px;margin:8px 2px 2px;padding:7px 10px;border-radius:12px;background:linear-gradient(125deg,var(--ux-accent-soft),transparent 90%),var(--ux-surface-2);border:1px solid var(--ux-line);font-size:11.6px;line-height:1.4;font-weight:650;color:var(--ux-ink-2)}
.u047-adv-ic{display:inline-grid;place-items:center;flex:none;margin-top:1.5px}
.u047-adv-txt{min-width:0;flex:1}
.u047-tip-pop{position:absolute;left:12px;right:12px;top:82px;z-index:30;padding:10px 12px;border-radius:14px;background:var(--ux-surface);border:1px solid var(--ux-line-2);box-shadow:0 16px 34px -12px var(--ux-shadow-strong),0 0 0 1px var(--ux-accent-soft);backdrop-filter:blur(12px);pointer-events:none;opacity:0;visibility:hidden;transform:translateY(-4px) scale(.985);transition:opacity .18s var(--ux-ease),transform .22s var(--ux-spring),visibility 0s .18s}
.u047-tip-pop.on{opacity:1;visibility:visible;transform:translateY(0) scale(1);transition:opacity .18s var(--ux-ease),transform .22s var(--ux-spring)}
.u047-tip-hdr{display:flex;align-items:center;gap:6px;margin-bottom:4px}
.u047-tip-dot{width:6.5px;height:6.5px;border-radius:50%;background:var(--ux-accent);flex:none}
.u047-tip-title{font-size:12px;font-weight:800;color:var(--ux-ink)}
.u047-tip-body{margin:0;font-size:11.4px;line-height:1.44;font-weight:580;color:var(--ux-ink-2)}
.u047-chart{position:relative;height:96px;margin:4px -16px 0}
.u047-chart svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.u047-line{fill:none;stroke:var(--ux-accent);stroke-width:2.6;stroke-linejoin:round;stroke-linecap:round}
.u047-grid line{stroke:var(--ux-line);stroke-dasharray:3 5}
.u047-dot{fill:var(--ux-surface);stroke:var(--ux-accent);stroke-width:3}
.u047-halo{fill:var(--ux-accent);opacity:.18;transform-box:fill-box;transform-origin:center;animation:u047-p 2s ease-out infinite}
@keyframes u047-p{0%{transform:scale(.6);opacity:.35}100%{transform:scale(2.2);opacity:0}}
@media (max-width:460px){
  .u047{padding:12px 12px 0}
  .u047-opt{font-size:10.8px;height:32px;padding:0 2px;letter-spacing:-.02em}
  .u047-num{font-size:25px}
  .u047-chart{margin:4px -12px 0}
}
`;

function ensureLucianStageCssInjected(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }
  const existing = document.getElementById(STYLE_ELEMENT_ID);
  if (existing) {
    if (existing.textContent !== LUCIAN_STAGE_CSS) {
      existing.textContent = LUCIAN_STAGE_CSS;
    }
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
      '--u228-g1': 'rgba(107, 169, 232, calc(var(--o, 0) * 0.92))',
      '--u228-g2': 'rgba(88, 153, 218, calc(var(--o, 0) * 0.54))',
      '--u228-gin': 'rgba(107, 169, 232, calc(var(--o, 0) * 0.14))',
    };
  }
  return {
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
    '--u228-g1': 'rgba(30, 107, 184, calc(var(--o, 0) * 0.88))',
    '--u228-g2': 'rgba(42, 122, 201, calc(var(--o, 0) * 0.48))',
    '--u228-gin': 'rgba(30, 107, 184, calc(var(--o, 0) * 0.09))',
  };
}

function parseHourFromIso(iso: string, fallbackIndex: number): number {
  if (iso) {
    const trimmed = iso.trim();
    const endsWithZ = /Z$/i.test(trimmed);
    if (!endsWithZ) {
      const m = trimmed.match(/T(\d{2}):(\d{2})/);
      if (m) {
        return Number(m[1]);
      }
    }
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) {
      return d.getHours();
    }
  }
  return (9 + fallbackIndex) % 24;
}

/**
 * Resolves the target city's real-time local hour (snapped to 0.5h steps in 0..23.5,
 * e.g. 18.5 at 18:25) so the 24h sky scrubber opens at the actual current time of day.
 */
export function resolveLocationLocalHour(weather: WeatherSnapshot): number {
  const clampHalfHour = (rawHour: number): number => {
    const norm = ((rawHour % 24) + 24) % 24;
    return Math.max(0, Math.min(23.5, Math.round(norm * 2) / 2));
  };

  let offsetSec: number | null =
    typeof weather.utcOffsetSeconds === 'number' &&
    Number.isFinite(weather.utcOffsetSeconds)
      ? weather.utcOffsetSeconds
      : null;

  if (offsetSec === null) {
    const sampleIso =
      weather.updatedAtIso || weather.hourly?.[0]?.timeIso || '';
    const tzMatch = sampleIso.trim().match(/([+-])(\d{2}):?(\d{2})$/);
    if (tzMatch) {
      const sign = tzMatch[1] === '-' ? -1 : 1;
      offsetSec =
        sign * (Number(tzMatch[2]) * 3600 + Number(tzMatch[3]) * 60);
    }
  }

  const nowMs = Date.now();
  const parsedMs = weather.updatedAtIso
    ? Date.parse(weather.updatedAtIso)
    : NaN;
  const isLiveFresh =
    weather.provider !== 'demo' &&
    (Number.isNaN(parsedMs) || Math.abs(nowMs - parsedMs) <= 2 * 3600_000);

  if (isLiveFresh) {
    if (offsetSec !== null) {
      const localDate = new Date(nowMs + offsetSec * 1000);
      return clampHalfHour(
        localDate.getUTCHours() + localDate.getUTCMinutes() / 60
      );
    }
    const nowLocal = new Date(nowMs);
    return clampHalfHour(nowLocal.getHours() + nowLocal.getMinutes() / 60);
  }

  if (weather.updatedAtIso) {
    const trimmed = weather.updatedAtIso.trim();
    const wallMatch = trimmed.match(/T(\d{2}):(\d{2})/);
    const endsWithZ = /Z$/i.test(trimmed);
    if (wallMatch && !endsWithZ) {
      return clampHalfHour(Number(wallMatch[1]) + Number(wallMatch[2]) / 60);
    }
    if (!Number.isNaN(parsedMs)) {
      if (offsetSec !== null) {
        const localDate = new Date(parsedMs + offsetSec * 1000);
        return clampHalfHour(
          localDate.getUTCHours() + localDate.getUTCMinutes() / 60
        );
      }
      const d = new Date(parsedMs);
      return clampHalfHour(d.getHours() + d.getMinutes() / 60);
    }
  }

  return weather.isDay ? 14 : 21;
}

function formatHalfHourLabel(h: number): string {
  const norm = ((h % 24) + 24) % 24;
  const hh = Math.floor(norm) % 24;
  const mm = Math.round((norm - Math.floor(norm)) * 60) >= 30 ? '30' : '00';
  return `${String(hh).padStart(2, '0')}:${mm}`;
}

interface HourForecastModelPoint {
  hour: number;
  tempC: number;
  precipProbPct: number;
  conditionCode: string;
}

function build24HourModel(
  weather: WeatherSnapshot,
  currentLocalHour: number
): HourForecastModelPoint[] {
  const byHour = new Map<number, HourlyForecastPoint>();
  const currentSlotHour = Math.floor(((currentLocalHour % 24) + 24) % 24) % 24;
  byHour.set(currentSlotHour, {
    timeIso: weather.updatedAtIso || '',
    temperatureC: weather.temperatureC,
    precipProbPct: weather.precipProbPct,
    precipMm: weather.precipMmPerHr,
    conditionCode:
      weather.precipMmPerHr >= 0.3 || weather.precipProbPct >= 50
        ? 'RAIN'
        : 'CLEAR',
  });

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
  const targetLocalHour = useMemo(
    () => resolveLocationLocalHour(weather),
    [weather]
  );
  const initialNowLabel = useMemo(
    () => formatHalfHourLabel(targetLocalHour),
    [targetLocalHour]
  );
  const hourModel = useMemo(
    () => build24HourModel(weather, targetLocalHour),
    [weather, targetLocalHour]
  );

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
    const nowTxt = root.querySelector('.u094-now-txt') as HTMLElement | null;
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
      [0, '#0B1220', '#16243D'],
      [4.5, '#13203B', '#283F66'],
      [6, '#E8A582', '#4E6FA3'],
      [8, '#87C4F2', '#4688DC'],
      [12, '#58A8EB', '#2A72D6'],
      [14.5, '#78A3CE', '#496DA8'],
      [15.5, '#6B82A2', '#455870'],
      [17.4, '#7A8BA2', '#516075'],
      [18.6, '#E59A6C', '#4A6294'],
      [20, '#1B2845', '#0E1729'],
      [24, '#0B1220', '#16243D'],
    ];

    const SVG_NS = 'http://www.w3.org/2000/svg';
    function buildMiniWeatherSvg(kind: 'sun' | 'moon' | 'cloud' | 'rain'): SVGSVGElement {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', '0 0 22 22');
      svg.setAttribute('aria-hidden', 'true');
      const addPath = (attrs: Record<string, string>, tag = 'path') => {
        const el = document.createElementNS(SVG_NS, tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        svg.appendChild(el);
      };
      if (kind === 'sun') {
        addPath({ cx: '11', cy: '11', r: '6.2', fill: '#FFB020', opacity: '0.24' }, 'circle');
        addPath({ cx: '11', cy: '11', r: '4.3', fill: '#FFB020' }, 'circle');
        addPath({
          d: 'M11 2.4v2.1M11 17.5v2.1M2.4 11h2.1M17.5 11h2.1M4.9 4.9l1.5 1.5M15.6 15.6l1.5 1.5M4.9 17.1l1.5-1.5M15.6 6.4l1.5-1.5',
          stroke: '#FFB020',
          'stroke-width': '1.8',
          'stroke-linecap': 'round',
          fill: 'none',
        });
      } else if (kind === 'moon') {
        addPath({
          d: 'M14.5 15.8A6.6 6.6 0 0 1 8.2 4.4a6.6 6.6 0 1 0 8.6 9.2 6.6 6.6 0 0 1-2.3 2.2z',
          fill: '#8B9BFF',
          opacity: '0.28',
        });
        addPath({
          d: 'M14.5 15.8A6.6 6.6 0 0 1 8.2 4.4a6.6 6.6 0 1 0 8.6 9.2 6.6 6.6 0 0 1-2.3 2.2z',
          stroke: '#8B9BFF',
          'stroke-width': '1.5',
          'stroke-linejoin': 'round',
          fill: 'none',
        });
        addPath({ cx: '16.5', cy: '5.5', r: '1.1', fill: '#FBBF24' }, 'circle');
      } else if (kind === 'cloud') {
        addPath({ cx: '7.8', cy: '8.2', r: '3.5', fill: '#FFB020' }, 'circle');
        addPath({
          d: 'M7 18a3.6 3.6 0 0 1-.4-7.2 5 5 0 0 1 9.6.8A3.2 3.2 0 0 1 16.4 18z',
          fill: '#94A3B8',
          opacity: '0.88',
        });
      } else {
        addPath({
          d: 'M6.6 13a3.6 3.6 0 0 1-.4-7.2 5 5 0 0 1 9.6.8 3.2 3.2 0 0 1 .2 6.4z',
          fill: '#94A3B8',
          opacity: '0.86',
        });
        addPath({
          d: 'M8 15.4l-1.1 3M11.5 15.4l-1.1 3M15 15.4l-1.1 3',
          stroke: '#3D8BFF',
          'stroke-width': '1.85',
          'stroke-linecap': 'round',
          fill: 'none',
        });
      }
      return svg;
    }

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
    starsEl.replaceChildren();
    for (let i = 0; i < 18; i += 1) {
      const s = document.createElement('i');
      s.style.left = `${8 + ((i * 47) % 84)}%`;
      s.style.top = `${6 + ((i * 31) % 60)}%`;
      s.style.animationDelay = `${((i * 0.37) % 2.6).toFixed(2)}s`;
      starsEl.appendChild(s);
    }

    dropsEl.replaceChildren();
    for (let i = 0; i < 22; i += 1) {
      const d = document.createElement('i');
      d.style.left = `${(i * 29) % 118}%`;
      d.style.animationDelay = `${(-((i * 0.19) % 0.8)).toFixed(2)}s`;
      d.style.animationDuration = `${(0.6 + ((i * 0.07) % 0.4)).toFixed(2)}s`;
      dropsEl.appendChild(d);
    }

    labs.replaceChildren();
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
      (nowTxt ?? now).textContent = label(hour);
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
      // Update state and DOM synchronously so clicking any hour button or keyboard arrow
      // immediately synchronizes the sky preview, clock pill, and slider thumb (CSS transitions handle smooth motion).
      set(to);
    }

    const LB: Array<[number, HTMLButtonElement]> = [0, 3, 6, 9, 12, 15, 18, 21].map(
      (h) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'u094-lb';
        b.tabIndex = -1;
        const leftPct = Math.max(4.5, Math.min(92.5, (h / 24) * 100));
        b.style.left = `${leftPct.toFixed(2)}%`;
        const c = cond(h);
        const tVal = temp(h);
        const smallEl = document.createElement('small');
        smallEl.textContent = `${String(h).padStart(2, '0')}h`;
        const bTempEl = document.createElement('b');
        bTempEl.textContent = `${tVal}°`;
        b.appendChild(smallEl);
        b.appendChild(buildMiniWeatherSvg(c[1]));
        b.appendChild(bTempEl);
        b.setAttribute('aria-label', `${h}:00, ${tVal} độ C, ${c[0]}`);
        const activateHour = (e: Event) => {
          e.stopPropagation();
          down = false;
          strip.classList.remove('drag');
          root.classList.remove('is-drag');
          glide(h);
        };
        b.addEventListener('click', activateHour);
        b.addEventListener('pointerdown', (e: PointerEvent) => {
          e.stopPropagation();
          if (e.button === 0 || e.pointerType !== 'mouse') {
            down = false;
            strip.classList.remove('drag');
            root.classList.remove('is-drag');
            glide(h);
          }
        });
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
      if ((e.target as HTMLElement | null)?.closest('.u094-lb')) {
        return;
      }
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
      root.classList.add('is-drag');
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
      root.classList.remove('is-drag');
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

    set(targetLocalHour);

    return () => {
      cancelAnimationFrame(tw);
      cleanups.forEach((fn) => fn());
    };
  }, [
    hourModel,
    targetLocalHour,
    weather.isDay,
    weather.temperatureC,
    weather.precipProbPct,
    reduceMotion,
  ]);

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
          <small>{sanitizeCopy(weather.locationName)} · Bầu trời 24 giờ</small>
          <b className="u094-t">{Math.round(weather.temperatureC)}°</b>
          <span className="u094-c">{sanitizeCopy(weather.conditionText)}</span>
          <span className="u094-meta">
            Cao {hiTemp}° · Thấp {loTemp}° · Cảm giác {Math.round(weather.feelsLikeC)}°
          </span>
        </div>
        <span className="u094-now">
          <Clock size={14} weight="duotone" color="#FDE68A" />
          <span className="u094-now-txt">{initialNowLabel}</span>
        </span>
      </div>
      <div
        className="u094-strip"
        role="slider"
        tabIndex={0}
        aria-label="Thanh trượt thời gian bầu trời 24 giờ"
        aria-valuemin={0}
        aria-valuemax={23.5}
        aria-valuenow={targetLocalHour}
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
      return <ThermometerHot size={18} weight="duotone" color={accentColor} />;
    case 'feels':
      return <Sparkle size={18} weight="duotone" color="#4A90D9" />;
    case 'rain':
      return <CloudRain size={18} weight="duotone" color="#3578BE" />;
    case 'wind':
      return <Wind size={18} weight="duotone" color="#229A73" />;
    case 'uv':
      return <SunDim size={18} weight="duotone" color="#D4882A" />;
    case 'aqi':
    default:
      return <ShieldWarning size={18} weight="duotone" color="#2E85B8" />;
  }
}

/**
 * Ported Lucian Element #228: "Cursor-lit glowing card borders"
 * Renders the 6 Weather Telemetry Bento Cards with cross-gap radial cursor border spotlight.
 */
export const LucianGlowingBento228: React.FC<LucianGlowingBento228Props> = ({
  palette,
  metrics,
  realtimeAdviceVi,
  updatedLabel,
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

    const tipEl = root.querySelector('.u228-tip-pop') as HTMLElement | null;
    const tipDot = root.querySelector('.u228-tip-dot') as HTMLElement | null;
    const tipTitle = root.querySelector('.u228-tip-title') as HTMLElement | null;
    const tipBadge = root.querySelector('.u228-tip-badge') as HTMLElement | null;
    const tipBody = root.querySelector('.u228-tip-body') as HTMLElement | null;
    const tipAdv = root.querySelector('.u228-tip-adv') as HTMLElement | null;
    const tipId = 'u228-tip-' + Math.random().toString(36).slice(2, 7);
    if (tipEl) {
      tipEl.id = tipId;
    }

    let p = { x: -500, y: -500 };
    let o = 0;
    let oT = 0;
    let raf = 0;
    let last = 0;
    let activeTipIdx: number | null = null;
    let pinnedTipIdx: number | null = null;

    function getCards(): HTMLElement[] {
      if (!root) {
        return [];
      }
      return Array.prototype.slice.call(root.querySelectorAll('.u228-c'));
    }

    function hideTip(): void {
      if (!tipEl) {
        return;
      }
      activeTipIdx = null;
      tipEl.classList.remove('on');
      tipEl.setAttribute('aria-hidden', 'true');
      getCards().forEach((el) => {
        el.classList.remove('tip-on');
        el.removeAttribute('aria-describedby');
      });
    }

    function showTip(idx: number, anchorEl: HTMLElement): void {
      if (!root || !tipEl || !tipTitle || !tipBody) {
        return;
      }
      const m = metrics[idx];
      if (!m || !m.explainVi) {
        hideTip();
        return;
      }

      if (activeTipIdx !== idx) {
        activeTipIdx = idx;
        const accent = m.accentColor || palette.accent;
        if (tipDot) {
          tipDot.style.backgroundColor = accent;
        }
        tipTitle.textContent = m.label;
        if (tipBadge) {
          tipBadge.textContent = `${m.value} · ${m.badge}`;
        }
        tipBody.textContent = m.explainVi;
        if (tipAdv) {
          tipAdv.textContent = `Lời khuyên: ${m.detail}`;
        }
        getCards().forEach((el, k) => {
          const isMatch = k === idx;
          el.classList.toggle('tip-on', isMatch);
          if (isMatch) {
            el.setAttribute('aria-describedby', tipId);
          } else {
            el.removeAttribute('aria-describedby');
          }
        });
      }

      tipEl.classList.add('on');
      tipEl.setAttribute('aria-hidden', 'false');

      const rb = root.getBoundingClientRect();
      const cb = anchorEl.getBoundingClientRect();
      const k = root.offsetWidth / (rb.width || 1);
      const rootW = root.offsetWidth;
      const rootH = root.offsetHeight;

      const cLeft = (cb.left - rb.left) * k;
      const cTop = (cb.top - rb.top) * k;
      const cWidth = cb.width * k;
      const cHeight = cb.height * k;

      const tipW = tipEl.offsetWidth || Math.min(312, rootW - 24);
      const tipH = tipEl.offsetHeight || 116;

      const idealLeft = cLeft + cWidth / 2 - tipW / 2;
      const maxLeft = Math.max(12, rootW - tipW - 12);
      const clampedLeft = Math.max(12, Math.min(maxLeft, idealLeft));

      const spaceAbove = cTop - 12;
      let targetTop =
        spaceAbove >= tipH + 8
          ? cTop - tipH - 8
          : cTop + cHeight + 8;
      const maxTop = Math.max(10, rootH - tipH - 10);
      targetTop = Math.max(10, Math.min(maxTop, targetTop));

      tipEl.style.left = `${clampedLeft.toFixed(1)}px`;
      tipEl.style.top = `${targetTop.toFixed(1)}px`;
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

      if (e.pointerType !== 'touch' && pinnedTipIdx === null) {
        const cardEl = (e.target as HTMLElement | null)?.closest(
          '.u228-c'
        ) as HTMLElement | null;
        if (cardEl) {
          const idx = Number(cardEl.getAttribute('data-metric-idx'));
          if (Number.isFinite(idx) && idx >= 0) {
            showTip(idx, cardEl);
          }
        } else if (activeTipIdx !== null) {
          hideTip();
        }
      }
    };

    const onPointerLeave = () => {
      oT = 0;
      kick();
      if (pinnedTipIdx === null) {
        hideTip();
      }
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
      const idx = Number(target.getAttribute('data-metric-idx'));
      if (Number.isFinite(idx) && idx >= 0) {
        showTip(idx, target);
      }
    };

    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as HTMLElement | null;
      if (next && root.contains(next) && next.closest('.u228-c')) {
        return;
      }
      oT = 0;
      kick();
      if (pinnedTipIdx === null) {
        hideTip();
      }
    };

    const onClick = (e: MouseEvent) => {
      const cardEl = (e.target as HTMLElement | null)?.closest(
        '.u228-c'
      ) as HTMLElement | null;
      if (!cardEl) {
        if (pinnedTipIdx !== null) {
          pinnedTipIdx = null;
          hideTip();
        }
        return;
      }
      const idx = Number(cardEl.getAttribute('data-metric-idx'));
      if (!Number.isFinite(idx) || idx < 0) {
        return;
      }
      if (pinnedTipIdx === idx) {
        pinnedTipIdx = null;
        hideTip();
      } else {
        pinnedTipIdx = idx;
        showTip(idx, cardEl);
      }
    };

    const onDocPointerDown = (e: PointerEvent) => {
      if (pinnedTipIdx !== null && !root.contains(e.target as Node | null)) {
        pinnedTipIdx = null;
        hideTip();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (pinnedTipIdx !== null || activeTipIdx !== null)) {
        pinnedTipIdx = null;
        hideTip();
      }
    };

    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerleave', onPointerLeave);
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onDocPointerDown);
    apply();

    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerleave', onPointerLeave);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onDocPointerDown);
    };
  }, [metrics, palette.accent, reduceMotion]);

  if (Platform.OS !== 'web') {
    return (
      <View style={nativeStyles.nativeWrap}>
        <View style={nativeStyles.nativeHdrRow}>
          <Text style={[nativeStyles.fallbackTitle, { color: palette.inkPrimary }]}>
            Chỉ số khí tượng thời gian thực
          </Text>
          <Text style={[nativeStyles.nativeLiveBadge, { color: palette.accent }]}>
            {updatedLabel || 'Trực tiếp'}
          </Text>
        </View>
        {realtimeAdviceVi ? (
          <View
            style={[
              nativeStyles.nativeAdviceBox,
              {
                backgroundColor: palette.accentSoftBg,
                borderColor: palette.bezelOuterBorder,
              },
            ]}
          >
            <Text style={[nativeStyles.nativeAdviceText, { color: palette.inkPrimary }]}>
              {realtimeAdviceVi}
            </Text>
          </View>
        ) : null}
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
          <span>Chỉ số khí tượng thời gian thực</span>
        </div>
        <span className="u228-live-pill">
          <span className="u228-live-dot" aria-hidden="true" />
          <span>{updatedLabel || 'Trực tiếp'}</span>
        </span>
      </div>

      {realtimeAdviceVi ? (
        <div
          className="u228-advice-box"
          role="note"
          aria-label="Lời khuyên thời tiết thời gian thực"
        >
          <span className="u228-advice-ic" aria-hidden="true">
            <Sparkle size={14} weight="duotone" color={palette.accent} />
          </span>
          <div className="u228-advice-content">
            <span className="u228-advice-txt">{realtimeAdviceVi}</span>
          </div>
        </div>
      ) : null}

      <div
        className="u228-gd"
        role="list"
        aria-label="Sáu thẻ chỉ số khí tượng thời gian thực"
      >
        {metrics.map((m, idx) => {
          const clampedPct = Math.max(6, Math.min(100, Math.round(m.progressPct)));
          return (
            <div
              key={m.id}
              data-metric-idx={idx}
              className="u228-c"
              role="listitem"
              tabIndex={0}
              aria-label={`${m.label}: ${m.value}, ${m.badge}. ${m.detail}${
                m.explainVi ? `. Giải thích: ${m.explainVi}` : ''
              }`}
            >
              <div className="u228-in">
                <div className="u228-top">
                  <span className="u228-ic">
                    {renderMetricSvgIcon(m.iconKey, m.accentColor || palette.accent)}
                  </span>
                  <span className="u228-tag">{m.badge}</span>
                </div>
                <div className="u228-lbl-row">
                  <span className="u228-lbl">{m.label}</span>
                  {m.explainVi ? (
                    <span className="u228-q" aria-hidden="true">
                      ?
                    </span>
                  ) : null}
                </div>
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

      <div className="u228-tip-pop" role="tooltip" aria-hidden="true">
        <div className="u228-tip-hdr">
          <div className="u228-tip-title-wrap">
            <span className="u228-tip-dot" aria-hidden="true" />
            <strong className="u228-tip-title" />
          </div>
          <span className="u228-tip-badge" />
        </div>
        <p className="u228-tip-body" />
        <span className="u228-tip-adv" />
      </div>
    </div>
  );
};

/**
 * Ported Lucian Element #047: "Period segmented control"
 * Embedded inside the Left Hero Bento Card to switch between 3h Temperature Range,
 * 3h Rain Probability, Next 6h Trend, and Full 24h Range with practical advice
 * and instant hover/focus metric explanation.
 */
export const LucianForecastTrend047: React.FC<LucianForecastTrend047Props> = ({
  palette,
  weather,
  reduceMotion = false,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);

  const datasets = useMemo(() => {
    const hourly3 = (weather.hourly ?? []).slice(0, 3);
    const hourly6 = (weather.hourly ?? []).slice(0, 6);
    const hourly24 = (weather.hourly ?? []).slice(0, 24);

    const temps3 =
      hourly3.length >= 2
        ? [weather.temperatureC, ...hourly3.map((h) => h.temperatureC)]
        : [
            weather.temperatureC,
            weather.temperatureC + 0.5,
            weather.temperatureC + 0.2,
            weather.temperatureC - 0.4,
          ];

    const rains3 =
      hourly3.length >= 2
        ? [weather.precipProbPct, ...hourly3.map((h) => h.precipProbPct)]
        : [
            weather.precipProbPct,
            weather.precipProbPct,
            weather.precipProbPct,
            weather.precipProbPct,
          ];

    const temps6 =
      hourly6.length >= 3
        ? [weather.temperatureC, ...hourly6.map((h) => h.temperatureC)]
        : [
            ...temps3,
            weather.temperatureC - 0.6,
            weather.temperatureC - 0.9,
            weather.temperatureC - 1.1,
          ];

    const rains6 =
      hourly6.length >= 3
        ? [weather.precipProbPct, ...hourly6.map((h) => h.precipProbPct)]
        : [...rains3, weather.precipProbPct, weather.precipProbPct];

    const fallbackTemps24 = [
      weather.temperatureC,
      ...Array.from({ length: 12 }, (_, i) =>
        Number(
          (
            weather.temperatureC +
            Math.sin(((i + 1) / 12) * Math.PI * 2) * 2.5
          ).toFixed(1)
        )
      ),
    ];

    const temps24 =
      hourly24.length >= 6
        ? [weather.temperatureC, ...hourly24.map((h) => h.temperatureC)]
        : fallbackTemps24;

    const rains24 =
      hourly24.length >= 6
        ? [weather.precipProbPct, ...hourly24.map((h) => h.precipProbPct)]
        : Array.from({ length: temps24.length }, () => weather.precipProbPct);

    function normalizeSeries(arr: number[], minFloor = 0.14, maxCeil = 0.92): number[] {
      const safe = arr.map((v) => (Number.isFinite(v) ? v : 0));
      const lo = Math.min(...safe);
      const hi = Math.max(...safe);
      const span = hi - lo;
      if (!Number.isFinite(span) || span < 0.5) {
        return safe.map((_, idx) => 0.48 + Math.sin(idx * 0.7) * 0.06);
      }
      return safe.map(
        (v) => minFloor + ((v - lo) / span) * (maxCeil - minFloor)
      );
    }

    const loTemp3 = Math.min(...temps3);
    const hiTemp3 = Math.max(...temps3);
    const avgTemp3 =
      temps3.reduce((sum, v) => sum + v, 0) / Math.max(1, temps3.length);
    const deltaTemp3 = temps3[temps3.length - 1] - temps3[0];

    const maxRain3 = Math.max(...rains3);
    const deltaRain3 = rains3[rains3.length - 1] - rains3[0];

    const loTemp6 = Math.min(...temps6);
    const hiTemp6 = Math.max(...temps6);
    const avgTemp6 =
      temps6.reduce((sum, v) => sum + v, 0) / Math.max(1, temps6.length);
    const deltaTemp6 = temps6[temps6.length - 1] - temps6[0];
    const maxRain6 = Math.max(...rains6);

    const loTemp24 = Math.min(...temps24);
    const hiTemp24 = Math.max(...temps24);
    const spanTemp24 = hiTemp24 - loTemp24;
    const maxRain24 = Math.max(...rains24);

    const advice3hTemp =
      maxRain3 >= 50
        ? `Trong 3 giờ tới khả năng mưa tới ${Math.round(maxRain3)}%, nên mang sẵn ô hoặc áo mưa gọn.`
        : deltaTemp3 <= -1.8
          ? `Nhiệt độ hạ khoảng ${Math.abs(deltaTemp3).toFixed(1)}°C trong 3 giờ tới, nên mang theo áo khoác nhẹ.`
          : deltaTemp3 >= 1.8
            ? `Trời ấm tăng thêm +${deltaTemp3.toFixed(1)}°C trong 3 giờ tới, ưu tiên trang phục thoáng mát và uống đủ nước.`
            : hiTemp3 >= 33
              ? 'Nền nhiệt 3 giờ tới khá oi nóng, nên hạn chế đứng lâu ngoài nắng gắt.'
              : loTemp3 <= 19
                ? 'Tiết trời 3 giờ tới se lạnh, nên giữ ấm cổ và khoác áo mỏng khi ra đường.'
                : 'Biên độ nhiệt 3 giờ tới ổn định, tiết trời dễ chịu cho việc di chuyển ngoài trời.';

    const advice3hRain =
      maxRain3 >= 55
        ? `Đỉnh khả năng mưa đạt ${Math.round(maxRain3)}% trong 3 giờ tới — nên chuẩn bị sẵn áo mưa hoặc ô trước khi đi.`
        : maxRain3 >= 30
          ? `Có khoảng ${Math.round(maxRain3)}% khả năng mưa rào thoáng qua trong 3 giờ tới, nên phòng hờ ô gấp gọn.`
          : 'Trời khô ráo trong 3 giờ tới, thuận lợi cho việc đi lại và hoạt động ngoài trời.';

    const advice6h =
      maxRain6 >= 50
        ? `Trong 6 giờ tới xác suất mưa lên đến ${Math.round(maxRain6)}%, nên chủ động mang theo đồ che mưa.`
        : deltaTemp6 <= -2.2
          ? `Nền nhiệt giảm dần ${Math.abs(deltaTemp6).toFixed(1)}°C trong 6 giờ tới, nên chuẩn bị áo khoác mỏng.`
          : deltaTemp6 >= 2.2
            ? `Nhiệt độ tăng thêm +${deltaTemp6.toFixed(1)}°C trong 6 giờ tới, ưu tiên đồ thoáng khí và bổ sung nước.`
            : weather.feelsLikeC >= 33
              ? 'Nhiệt cảm nhận khá oi bức trong nửa buổi tới, nên ưu tiên không gian thoáng mát.'
              : weather.feelsLikeC <= 19
                ? 'Nhiệt cảm nhận se lạnh trong 6 giờ tới, nên giữ ấm cơ thể vừa phải.'
                : 'Xu hướng nhiệt 6 giờ tới duy trì ôn hòa, thuận lợi cho công việc và sinh hoạt.';

    const advice24h =
      spanTemp24 >= 7
        ? `Chênh lệch nhiệt ngày – đêm lớn (${spanTemp24.toFixed(1)}°C), nên mặc trang phục nhiều lớp dễ điều chỉnh.`
        : maxRain24 >= 55
          ? `Trong 24 giờ tới có thời điểm khả năng mưa cao (${Math.round(maxRain24)}%), nên mang sẵn ô khi đi cả ngày.`
          : hiTemp24 >= 34
            ? `Đỉnh nhiệt trong ngày lên tới ${Math.round(hiTemp24)}°C, hạn chế vận động gắng sức ngoài nắng trưa.`
            : loTemp24 <= 18
              ? `Nhiệt độ thấp nhất hạ còn ${Math.round(loTemp24)}°C về đêm và sáng sớm, chú ý giữ ấm.`
              : 'Biên độ nhiệt cả ngày ôn hòa, ít biến động đột ngột giữa ban ngày và ban đêm.';

    function formatDateSpanVi(endIso?: string): string {
      const extractDdMm = (raw?: string): string | null => {
        if (!raw) return null;
        const trimmed = raw.trim();
        const m = trimmed.match(
          /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?([+-]\d{2}:?\d{2})?$/
        );
        if (m) {
          return `${m[3]}/${m[2]}`;
        }
        const ms = Date.parse(trimmed);
        if (Number.isNaN(ms)) return null;
        const offsetSec =
          typeof weather.utcOffsetSeconds === 'number' &&
          Number.isFinite(weather.utcOffsetSeconds)
            ? weather.utcOffsetSeconds
            : -new Date().getTimezoneOffset() * 60;
        const d = new Date(ms + offsetSec * 1000);
        return `${String(d.getUTCDate()).padStart(2, '0')}/${String(
          d.getUTCMonth() + 1
        ).padStart(2, '0')}`;
      };
      const startDdMm = extractDdMm(weather.updatedAtIso);
      const endDdMm = extractDdMm(endIso);
      if (startDdMm && endDdMm && startDdMm !== endDdMm) {
        return `${startDdMm} – ${endDdMm}`;
      }
      return startDdMm || endDdMm || '';
    }

    const span3Label = formatDateSpanVi(hourly3[hourly3.length - 1]?.timeIso);
    const span6Label = formatDateSpanVi(hourly6[hourly6.length - 1]?.timeIso);
    const span24Label = formatDateSpanVi(hourly24[hourly24.length - 1]?.timeIso);
    const prefix3 = span3Label ? `${span3Label} · ` : '';
    const prefix6 = span6Label ? `${span6Label} · ` : '';
    const prefix24 = span24Label ? `${span24Label} · ` : '';

    return [
      {
        tab: 'Biên nhiệt 3h',
        titleVi: 'Biên độ nhiệt 3 giờ tới',
        l: `${prefix3}Biên độ nhiệt 3 giờ tới (${Math.round(loTemp3)}°–${Math.round(hiTemp3)}°C) · Trung bình ${Math.round(avgTemp3)}°C`,
        rangeLabel: `Thấp ${Math.round(loTemp3)}° · Cao ${Math.round(hiTemp3)}°`,
        v: Math.round(avgTemp3),
        unit: '°C',
        p: Number(deltaTemp3.toFixed(1)),
        pUnit: '°',
        pts: normalizeSeries(temps3),
        adviceVi: advice3hTemp,
        explainVi:
          'Biên độ nhiệt 3 giờ tới đo mức chênh lệch nhiệt độ cao nhất – thấp nhất và độ tăng/giảm từ hiện tại đến 3 tiếng tiếp theo.',
      },
      {
        tab: 'Xác suất mưa 3h',
        titleVi: 'Xác suất mưa 3 giờ tới',
        l: `${prefix3}Khả năng mưa 3 giờ tới · Hiện tại ${Math.round(weather.precipProbPct)}%`,
        rangeLabel: `Đỉnh 3h: ${Math.round(maxRain3)}%`,
        v: Math.round(maxRain3),
        unit: '%',
        p: Number(deltaRain3.toFixed(0)),
        pUnit: '%',
        pts: normalizeSeries(rains3, 0.1, 0.94),
        adviceVi: advice3hRain,
        explainVi:
          'Xác suất mưa (%) cho biết khả năng xuất hiện mưa tại khu vực của bạn trong khung 3 giờ sắp tới.',
      },
      {
        tab: 'Xu hướng 6h',
        titleVi: 'Xu hướng nhiệt độ 6 giờ tới',
        l: `${prefix6}Biên độ nhiệt 6 giờ tới · Nhiệt cảm nhận ${Math.round(weather.feelsLikeC)}°C`,
        rangeLabel: `Khung 6h: ${Math.round(loTemp6)}°–${Math.round(hiTemp6)}°`,
        v: Math.round(avgTemp6),
        unit: '°C',
        p: Number(deltaTemp6.toFixed(1)),
        pUnit: '°',
        pts: normalizeSeries(temps6),
        adviceVi: advice6h,
        explainVi:
          'Biểu đồ xu hướng 6 giờ tới phản ánh đà tăng hoặc giảm nhiệt độ trung hạn kèm mức nhiệt cơ thể cảm nhận thực tế.',
      },
      {
        tab: 'Cả ngày 24h',
        titleVi: 'Biên độ nhiệt 24 giờ',
        l: `${prefix24}Biên độ nhiệt 24 giờ (${Math.round(loTemp24)}°–${Math.round(hiTemp24)}°C) · Chênh lệch ${spanTemp24.toFixed(1)}°`,
        rangeLabel: `Cả ngày: ${Math.round(loTemp24)}°–${Math.round(hiTemp24)}°`,
        v: Math.round(hiTemp24),
        unit: '°C',
        p: Number(spanTemp24.toFixed(1)),
        pUnit: '°',
        pts: normalizeSeries(temps24),
        adviceVi: advice24h,
        explainVi:
          'Biên độ nhiệt 24 giờ thể hiện đỉnh nhiệt cao nhất, mức thấp nhất và tổng độ chênh lệch nhiệt độ suốt cả ngày.',
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
    const labWrap = root.querySelector('.u047-lab-wrap') as HTMLElement | null;
    const lab = root.querySelector('.u047-lab') as HTMLElement | null;
    const helpBtn = root.querySelector('.u047-help-btn') as HTMLButtonElement | null;
    const chg = root.querySelector('.u047-chg') as HTMLElement | null;
    const pct = chg?.querySelector('span') as HTMLElement | null;
    const rangePill = root.querySelector('.u047-range-pill') as HTMLElement | null;
    const advTxt = root.querySelector('.u047-adv-txt') as HTMLElement | null;
    const tipPop = root.querySelector('.u047-tip-pop') as HTMLElement | null;
    const tipTitle = root.querySelector('.u047-tip-title') as HTMLElement | null;
    const tipBody = root.querySelector('.u047-tip-body') as HTMLElement | null;
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

    const tipId = 'u047-tip-' + Math.random().toString(36).slice(2, 7);
    if (tipPop) {
      tipPop.id = tipId;
    }
    if (helpBtn) {
      helpBtn.setAttribute('aria-describedby', tipId);
    }

    let cur = 0;
    const targetLen = 12;
    let shown = {
      v: datasets[0].v,
      p: datasets[0].p,
      unit: datasets[0].unit,
      pUnit: datasets[0].pUnit,
      pts: Array.from({ length: targetLen }, () => 0.25),
    };
    let raf = 0;
    let tipPinned = false;

    function setTipVisible(visible: boolean): void {
      if (!tipPop) {
        return;
      }
      tipPop.classList.toggle('on', visible);
      tipPop.setAttribute('aria-hidden', visible ? 'false' : 'true');
      if (helpBtn) {
        helpBtn.classList.toggle('on', visible);
        helpBtn.setAttribute('aria-expanded', visible ? 'true' : 'false');
      }
    }

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
        8 + (i * 330) / Math.max(1, pts.length - 1),
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
      area!.setAttribute('d', `${d}L338,150L8,150Z`);
      dot!.setAttribute('cx', String(lastPt[0]));
      dot!.setAttribute('cy', String(lastPt[1]));
      halo!.setAttribute('cx', String(lastPt[0]));
      halo!.setAttribute('cy', String(lastPt[1]));
      num!.textContent = `${Math.round(shown.v)}${shown.unit}`;
      const sign = shown.p >= 0 ? '+' : '-';
      const formattedDelta =
        shown.pUnit === '%'
          ? String(Math.round(Math.abs(shown.p)))
          : Math.abs(shown.p).toFixed(1);
      pct!.textContent = `${sign}${formattedDelta}${shown.pUnit}`;
    }

    function tween(to: (typeof datasets)[number], immediate?: boolean): void {
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
      const dur = 520;
      if (rm || immediate || (typeof document !== 'undefined' && document.hidden)) {
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
      if (rangePill) {
        rangePill.textContent = d.rangeLabel;
      }
      if (advTxt) {
        advTxt.textContent = d.adviceVi;
      }
      if (tipTitle) {
        tipTitle.textContent = d.titleVi;
      }
      if (tipBody) {
        tipBody.textContent = d.explainVi;
      }
      chg!.classList.toggle('down', d.p < 0);
      chg!.setAttribute(
        'aria-label',
        `${d.p < 0 ? 'Giảm ' : 'Tăng '}${Math.abs(d.p)}${d.pUnit}. ${d.explainVi}`
      );
      tween(d, Boolean(first));
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

    const hoverTargets = [labWrap, chg].filter(Boolean) as HTMLElement[];
    hoverTargets.forEach((el) => {
      const onEnter = (e: PointerEvent) => {
        if (e.pointerType !== 'touch') {
          setTipVisible(true);
        }
      };
      const onLeave = (e: PointerEvent) => {
        if (e.pointerType !== 'touch' && !tipPinned) {
          setTipVisible(false);
        }
      };
      el.addEventListener('pointerenter', onEnter);
      el.addEventListener('pointerleave', onLeave);
      cleanups.push(() => {
        el.removeEventListener('pointerenter', onEnter);
        el.removeEventListener('pointerleave', onLeave);
      });
    });

    if (helpBtn) {
      const onHelpClick = (e: MouseEvent) => {
        e.stopPropagation();
        tipPinned = !tipPinned;
        setTipVisible(tipPinned);
      };
      const onHelpFocus = () => setTipVisible(true);
      const onHelpBlur = () => {
        if (!tipPinned) {
          setTipVisible(false);
        }
      };
      helpBtn.addEventListener('click', onHelpClick);
      helpBtn.addEventListener('focus', onHelpFocus);
      helpBtn.addEventListener('blur', onHelpBlur);
      cleanups.push(() => {
        helpBtn.removeEventListener('click', onHelpClick);
        helpBtn.removeEventListener('focus', onHelpFocus);
        helpBtn.removeEventListener('blur', onHelpBlur);
      });
    }

    const onChgFocus = () => setTipVisible(true);
    const onChgBlur = () => {
      if (!tipPinned) {
        setTipVisible(false);
      }
    };
    chg.addEventListener('focus', onChgFocus);
    chg.addEventListener('blur', onChgBlur);
    cleanups.push(() => {
      chg.removeEventListener('focus', onChgFocus);
      chg.removeEventListener('blur', onChgBlur);
    });

    const onDocPointerDown = (e: PointerEvent) => {
      if (tipPinned && !root.contains(e.target as Node | null)) {
        tipPinned = false;
        setTipVisible(false);
      }
    };
    const onRootKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        tipPinned = false;
        setTipVisible(false);
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
          {datasets[0].l}
        </Text>
        <Text style={[nativeStyles.fallbackSub, { color: palette.inkSecondary }]}>
          {datasets[0].adviceVi}
        </Text>
      </View>
    );
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

      <div className="u047-lab-wrap">
        <span className="u047-lab">{datasets[0].l}</span>
        <button
          type="button"
          className="u047-help-btn"
          aria-label="Giải thích chỉ số xu hướng"
          aria-expanded="false"
        >
          <span className="u047-help-q" aria-hidden="true">
            ?
          </span>
          <span>Giải thích</span>
        </button>
      </div>

      <div className="u047-row" aria-live="polite">
        <div className="u047-num-wrap">
          <span className="u047-num">
            {datasets[0].v}
            {datasets[0].unit}
          </span>
          <span
            className={`u047-chg${datasets[0].p < 0 ? ' down' : ''}`}
            tabIndex={0}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2.5 7.5L6 4l3.5 3.5" />
            </svg>
            <span>
              {`${datasets[0].p >= 0 ? '+' : '-'}${
                datasets[0].pUnit === '%'
                  ? Math.round(Math.abs(datasets[0].p))
                  : Math.abs(datasets[0].p).toFixed(1)
              }${datasets[0].pUnit}`}
            </span>
          </span>
        </div>
        <span className="u047-range-pill">{datasets[0].rangeLabel}</span>
      </div>

      <div className="u047-adv" role="note" aria-label="Lời khuyên theo xu hướng">
        <span className="u047-adv-ic" aria-hidden="true">
          <Sparkle size={13} weight="duotone" color={palette.accent} />
        </span>
        <span className="u047-adv-txt">{datasets[0].adviceVi}</span>
      </div>

      <div className="u047-tip-pop" role="tooltip" aria-hidden="true">
        <div className="u047-tip-hdr">
          <span className="u047-tip-dot" aria-hidden="true" />
          <strong className="u047-tip-title">{datasets[0].titleVi}</strong>
        </div>
        <p className="u047-tip-body">{datasets[0].explainVi}</p>
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
  nativeWrap: {
    gap: 10,
  },
  nativeHdrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  nativeLiveBadge: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    fontWeight: '700',
  },
  nativeAdviceBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  nativeAdviceText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '600',
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

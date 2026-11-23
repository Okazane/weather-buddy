/* Lucian UX/UI Prompt #015 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#015 */
/* Lucian UX/UI Prompt #023 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#023 */
/* Lucian UX/UI Prompt #036 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#036 */
/* Lucian UX/UI Prompt #044 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#044 */
/* Lucian UX/UI Prompt #095 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#095 */
/* Lucian UX/UI Prompt #227 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#227 */

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { HourlyForecastPoint } from '../core';
import {
  FONT_FAMILY_SANS,
  sanitizeCopy,
  WEB_NO_OUTLINE,
  type AtmosphericPalette,
} from '../components/themeTokens';
import { injectLucianElementCss } from './lucianTokens';

const LUCIAN_HUB_STYLE_ID = 'weather-buddy-lucian-hub-elements-css';

/**
 * Plain scoped CSS ported verbatim from Lucian UX/UI Prompt (#015, #023, #036, #044, #095, #227),
 * keeping every .uNNN selector, radius, shadow, duration, and cubic-bezier curve intact,
 * with fluid max-width: 100% responsiveness for 375px mobile through 1360px desktop.
 * Relies on the single shared `--ux-*` & `.ux` token sheet injected by `lucianTokens.ts`.
 */
const LUCIAN_HUB_SCOPED_CSS = `
/* #015 Plan radio cards */
.u015{position:relative;width:100%;max-width:100%}
.u015-grp{position:relative;display:grid;grid-template-columns:minmax(0,1fr);gap:10px}
.u015[data-cols="2"] .u015-grp{grid-template-columns:repeat(2,minmax(0,1fr))}
.u015[data-cols="3"] .u015-grp{grid-template-columns:repeat(3,minmax(0,1fr))}
@media (max-width:720px){
  .u015[data-cols="2"] .u015-grp{grid-template-columns:minmax(0,1fr)}
}
@media (max-width:600px){
  .u015[data-cols="3"] .u015-grp{grid-template-columns:minmax(0,1fr)}
}
.u015-frame{position:absolute;left:0;top:0;width:0;height:0;border-radius:20px;pointer-events:none;z-index:2;
  box-shadow:0 0 0 2px var(--ux-accent),0 18px 36px -20px color-mix(in srgb,var(--ux-accent) 70%,transparent);
  background:linear-gradient(135deg,color-mix(in srgb,var(--ux-accent) 9%,transparent),transparent 70%);
  transition:left .55s var(--ux-spring),top .55s var(--ux-spring),width .55s var(--ux-spring),height .55s var(--ux-spring)}
.u015-opt{position:relative;z-index:1;display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px;border:0;border-radius:20px;background:var(--ux-surface);color:var(--ux-ink);text-align:left;
  box-shadow:0 0 0 1px var(--ux-line);transition:transform .4s var(--ux-spring),box-shadow .3s var(--ux-ease)}
.u015[data-compact="true"] .u015-opt{padding:12px 13px;gap:10px;border-radius:18px}
.u015[data-compact="true"] .u015-frame{border-radius:18px}
.u015-opt:hover{box-shadow:0 0 0 1px var(--ux-line-2)}
.u015-opt:active{transform:scale(.98)}
.u015-opt:focus-visible{outline:2px solid var(--ux-accent);outline-offset:3px}
.u015-dot{position:relative;width:22px;height:22px;flex:none;border-radius:50%;box-shadow:inset 0 0 0 2px var(--ux-line-2);transition:box-shadow .3s var(--ux-ease)}
.u015-dot::after{content:"";position:absolute;inset:5px;border-radius:50%;background:var(--ux-accent);transform:scale(0);transition:transform .45s var(--ux-spring)}
.u015-opt[aria-checked="true"] .u015-dot{box-shadow:inset 0 0 0 2px var(--ux-accent)}
.u015-opt[aria-checked="true"] .u015-dot::after{transform:scale(1)}
.u015-ic{width:38px;height:38px;flex:none;border-radius:12px;display:grid;place-items:center;color:#fff;background:var(--g)}
.u015[data-compact="true"] .u015-ic{width:32px;height:32px;border-radius:10px}
.u015-ic svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.u015-txt{flex:1;min-width:0}
.u015-txt b{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:14.5px;font-weight:720;letter-spacing:-.02em;color:var(--ux-ink)}
.u015[data-compact="true"] .u015-txt b{font-size:13.5px}
.u015-txt em{font-style:normal;font-size:10.5px;font-weight:750;padding:2px 7px;border-radius:999px;background:var(--ux-accent-soft);color:var(--ux-accent)}
.u015-txt small{display:block;margin-top:3px;font-size:12.5px;line-height:1.42;color:var(--ux-ink-2)}
.u015-price{text-align:right;flex:none;font-variant-numeric:tabular-nums;color:var(--ux-ink-3);transition:color .35s var(--ux-ease)}
.u015-price b{display:block;font-size:14px;font-weight:760;letter-spacing:-.02em}
.u015-price small{font-size:11px}
.u015-opt[aria-checked="true"] .u015-price{color:var(--ux-accent)}
.u015-cta{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin:12px 0 0;padding:0 4px;font-size:12.5px;color:var(--ux-ink-2)}
.u015-cta b{color:var(--ux-ink);font-variant-numeric:tabular-nums}

/* #023 Expanding notification settings */
.u023{position:relative;display:flex;flex-direction:column;width:100%;max-width:100%;padding:20px 18px 16px;border-radius:24px;background:var(--ux-surface);box-shadow:0 0 0 1px var(--ux-line),0 24px 48px -32px var(--ux-shadow-strong)}
.u023-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:0 4px 10px}
.u023-top b{font-size:16.5px;font-weight:760;letter-spacing:-.025em;color:var(--ux-ink)}
.u023-badge{font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;background:var(--ux-accent-soft);color:var(--ux-accent);font-variant-numeric:tabular-nums;transition:background-color .3s,color .3s}
.u023-item{border-top:1px solid var(--ux-line)}
.u023-head{display:flex;align-items:center;gap:12px;padding:13px 4px}
.u023-ic{width:38px;height:38px;flex:none;border-radius:12px;display:grid;place-items:center;color:#fff;background:var(--g);transition:filter .5s var(--ux-ease),opacity .5s var(--ux-ease)}
.u023-ic svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.u023-item.is-off .u023-ic{filter:grayscale(1);opacity:.45}
.u023-t{flex:1;min-width:0}
.u023-t b{display:block;font-size:14px;font-weight:700;letter-spacing:-.015em;color:var(--ux-ink)}
.u023-t small{display:block;margin-top:2px;font-size:12px;line-height:1.4;color:var(--ux-ink-2)}
.u023-sw{position:relative;width:52px;height:32px;flex:none;border:0;padding:0;border-radius:999px;background:var(--ux-surface-3);transition:background-color .4s var(--ux-ease)}
.u023-sw::after{content:"";position:absolute;left:3px;top:3px;width:26px;height:26px;border-radius:50%;background:#fff;box-shadow:0 2px 6px -1px rgba(0,0,0,.3);transition:transform .5s var(--ux-spring),width .25s var(--ux-ease)}
.u023-sw:active::after{width:32px}
.u023-sw[aria-checked="true"]{background:var(--ux-mint)}
.u023-sw[aria-checked="true"]::after{transform:translateX(20px)}
.u023-sw[aria-checked="true"]:active::after{transform:translateX(14px)}
.u023-sw:focus-visible{outline:2px solid var(--ux-accent);outline-offset:3px}
.u023-more{display:grid;grid-template-rows:0fr;transition:grid-template-rows .55s var(--ux-ease)}
.u023-more.is-open{grid-template-rows:1fr}
.u023-more>div{overflow:hidden;min-height:0}
.u023-opts{position:relative;display:flex;margin:0 4px 14px 50px;padding:4px;border-radius:12px;background:var(--ux-surface-2);opacity:0;transform:translateY(-8px);transition:opacity .3s var(--ux-ease),transform .5s var(--ux-spring)}
@media (max-width:520px){
  .u023-opts{margin-left:4px}
}
.u023-more.is-open .u023-opts{opacity:1;transform:none;transition-delay:.12s}
.u023-pill{position:absolute;left:4px;top:4px;bottom:4px;width:calc((100% - 8px) / var(--count,4));border-radius:9px;background:var(--ux-surface);box-shadow:0 1px 0 var(--ux-line),0 4px 10px -6px var(--ux-shadow-strong);transform:translateX(calc(var(--i,0) * 100%));transition:transform .5s var(--ux-spring);pointer-events:none}
.u023-opt{position:relative;z-index:1;flex:1;min-width:0;height:34px;border:0;background:none;border-radius:9px;padding:0 4px;font-size:12px;font-weight:680;color:var(--ux-ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .3s var(--ux-ease)}
.u023-opt[aria-checked="true"]{color:var(--ux-ink)}
.u023-opt:focus-visible{outline:2px solid var(--ux-accent);outline-offset:1px}
.u023-all{margin-top:10px;height:44px;border:0;border-radius:14px;background:var(--ux-surface-2);font-size:13.5px;font-weight:700;color:var(--ux-ink-2);transition:background-color .3s var(--ux-ease),color .3s var(--ux-ease),transform .4s var(--ux-spring)}
.u023-all:hover{color:var(--ux-accent);background:var(--ux-accent-soft)}
.u023-all:active{transform:scale(.98)}
.u023-all:focus-visible{outline:2px solid var(--ux-accent);outline-offset:2px}

/* #036 Password strength meter (adapted for blank-by-default personal API keys) */
.u036{--lv:var(--ux-line-2);position:relative;width:100%;max-width:100%;display:flex;flex-direction:column}
.u036-lab{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 4px 6px;font-size:12.5px;font-weight:700;color:var(--ux-ink-2)}
.u036-box{position:relative;display:flex;align-items:center;height:50px;padding:0 6px 0 14px;border-radius:15px;background:var(--ux-surface);box-shadow:0 0 0 1.5px var(--ux-line-2);transition:box-shadow .25s}
.u036-box:focus-within{box-shadow:0 0 0 2px var(--lv),0 0 0 5px color-mix(in srgb,var(--lv) 18%,transparent)}
.u036-in{flex:1;min-width:0;height:100%;border:0;outline:0;background:none;font-size:14px;font-weight:600;letter-spacing:.02em;color:var(--ux-ink)}
.u036-in::placeholder{color:var(--ux-ink-3);letter-spacing:normal;font-weight:500}
.u036-in:focus-visible{outline:none}
.u036-eye{width:38px;height:38px;flex:none;border:0;padding:0;border-radius:11px;background:none;color:var(--ux-ink-2);display:grid;place-items:center;transition:background-color .2s}
.u036-eye:hover{background:var(--ux-surface-2)}
.u036-eye:focus-visible{outline:2px solid var(--ux-accent);outline-offset:1px}
.u036-eye svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;overflow:visible}
.u036-lid{transform-origin:12px 12px;transition:transform .4s var(--ux-spring)}
.u036-pupil{transform-origin:12px 12px;transition:transform .35s var(--ux-spring) .05s}
.u036-slash{stroke-dasharray:24;stroke-dashoffset:0;transition:stroke-dashoffset .35s var(--ux-ease)}
.u036.is-show .u036-slash{stroke-dashoffset:24}
.u036:not(.is-show) .u036-pupil{transform:scale(0)}
.u036:not(.is-show) .u036-lid{transform:scaleY(.15)}
.u036-meter{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin:8px 4px 0}
.u036-meter i{height:5px;border-radius:4px;background:var(--ux-surface-3);overflow:hidden;position:relative;display:block}
.u036-meter i::after{content:"";position:absolute;inset:0;background:var(--lv);transform:scaleX(0);transform-origin:0 50%;transition:transform .45s var(--ux-ease),background-color .4s}
.u036-meter i.on::after{transform:none}
.u036-meter i:nth-child(2)::after{transition-delay:.05s}
.u036-meter i:nth-child(3)::after{transition-delay:.1s}
.u036-meter i:nth-child(4)::after{transition-delay:.15s}
.u036-lv{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:5px 4px 0;font-size:11.5px;font-weight:650;color:var(--ux-ink-3)}
.u036-lv b{color:var(--lv);transition:color .4s;font-variant-numeric:tabular-nums}

/* #044 FAQ accordion */
.u044{position:relative;width:100%;max-width:100%;display:flex;flex-direction:column;gap:10px}
.u044-it{position:relative;border-radius:20px;background:var(--ux-surface);box-shadow:0 0 0 1px var(--ux-line);transition:background-color .4s var(--ux-ease),box-shadow .5s var(--ux-ease),transform .5s var(--ux-spring)}
.u044-it.open{box-shadow:0 0 0 1px var(--ux-line-2),0 20px 36px -22px var(--ux-shadow-strong);transform:translateY(-2px)}
.u044-q{position:relative;display:flex;align-items:center;gap:12px;width:100%;min-height:58px;padding:12px 14px 12px 16px;border:0;border-radius:20px;background:none;font-size:14.5px;font-weight:700;letter-spacing:-.015em;color:var(--ux-ink);text-align:left}
.u044-q:focus-visible{outline:2px solid var(--ux-accent);outline-offset:2px}
.u044-n{font-size:11.5px;font-weight:800;padding:3px 9px;border-radius:999px;background:var(--ux-surface-2);color:var(--ux-ink-2);font-variant-numeric:tabular-nums;transition:color .3s,background-color .3s;flex:none}
.u044-it.open .u044-n{background:var(--ux-accent-soft);color:var(--ux-accent)}
.u044-t{flex:1;min-width:0}
.u044-pm{position:relative;width:30px;height:30px;flex:none;border-radius:50%;background:var(--ux-surface-2);transition:background-color .35s var(--ux-ease),transform .45s var(--ux-spring)}
.u044-q:hover .u044-pm{transform:scale(1.1)}
.u044-q:active .u044-pm{transform:scale(.9)}
.u044-pm::before,.u044-pm::after{content:"";position:absolute;left:50%;top:50%;width:11px;height:2px;margin:-1px 0 0 -5.5px;border-radius:2px;background:var(--ux-ink);transition:transform .5s var(--ux-spring),background-color .3s}
.u044-pm::after{transform:rotate(90deg)}
.u044-it.open .u044-pm{background:var(--ux-ink)}
.u044-it.open .u044-pm::before,.u044-it.open .u044-pm::after{background:var(--ux-page)}
.u044-it.open .u044-pm::after{transform:rotate(180deg)}
.u044-body{display:grid;grid-template-rows:0fr;transition:grid-template-rows .5s var(--ux-ease)}
.u044-it.open .u044-body{grid-template-rows:1fr}
.u044-body>div{overflow:hidden;min-height:0}
.u044-a{padding:0 18px 18px 20px;opacity:0;transform:translateY(-8px);transition:opacity .25s var(--ux-ease),transform .45s var(--ux-spring)}
.u044-it.open .u044-a{opacity:1;transform:none;transition-delay:.12s}
.u044-a p{margin:0 0 10px;font-size:13px;line-height:1.58;color:var(--ux-ink-2)}
.u044-steps{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}
.u044-step{display:flex;align-items:flex-start;gap:10px;font-size:13px;line-height:1.55;color:var(--ux-ink)}
.u044-step i{font-style:normal;width:22px;height:22px;flex:none;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:800;background:var(--ux-accent-soft);color:var(--ux-accent);font-variant-numeric:tabular-nums;margin-top:1px}

/* #095 Bar chart that changes shape */
.u095{position:relative;width:100%;max-width:100%;height:356px;display:flex;flex-direction:column;padding:20px 18px 14px;border-radius:26px;background:var(--ux-surface);box-shadow:0 0 0 1px var(--ux-line),0 26px 52px -34px var(--ux-shadow-strong);overflow:hidden}
.u095-h{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap}
.u095-h small{display:block;font-size:12.5px;font-weight:700;color:var(--ux-ink-3)}
.u095-v{margin-top:2px}
.u095-v b{font-size:28px;font-weight:820;letter-spacing:-.04em;font-variant-numeric:tabular-nums;color:var(--ux-ink)}
.u095-top{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px}
.u095-dl{font-size:12px;font-weight:800;color:var(--ux-mint);white-space:nowrap;font-variant-numeric:tabular-nums}
.u095-dl.dn{color:var(--ux-accent)}
.u095-seg{position:relative;display:grid;grid-template-columns:repeat(3,66px);padding:3px;border-radius:12px;background:var(--ux-surface-2)}
.u095-seg::before{content:"";position:absolute;top:3px;bottom:3px;left:3px;width:66px;border-radius:9px;background:var(--ux-surface);box-shadow:0 1px 4px -1px var(--ux-shadow-strong);transform:translateX(calc(var(--k,0) * 66px));transition:transform .45s var(--ux-spring);pointer-events:none}
@media (max-width:460px){
  .u095-seg{grid-template-columns:repeat(3,56px)}
  .u095-seg::before{width:56px;transform:translateX(calc(var(--k,0) * 56px))}
}
.u095-seg button{position:relative;z-index:1;height:30px;border:0;padding:0 4px;background:transparent;font-size:11.5px;font-weight:800;color:var(--ux-ink-3);transition:color .2s;white-space:nowrap}
.u095-seg button[aria-pressed="true"]{color:var(--ux-ink)}
.u095-seg button:focus-visible{outline:2px solid var(--ux-accent);outline-offset:1px;border-radius:9px}
.u095-ch{position:relative;flex:1;margin-top:16px;padding-right:46px;touch-action:pan-y}
.u095-grid{position:absolute;inset:0 0 26px 0}
.u095-gl{position:absolute;left:0;right:0;height:0;border-top:1px dashed var(--ux-line-2)}
.u095-gl span{position:absolute;right:0;top:-7px;transition:opacity .3s;font-size:10.5px;font-weight:700;color:var(--ux-ink-3);font-variant-numeric:tabular-nums}
.u095-gl:first-child{border-top-style:solid}
.u095-avg{position:absolute;left:0;right:42px;bottom:calc(26px + var(--a,0) * (100% - 26px));height:0;border-top:1.5px dashed var(--ux-accent);transition:bottom .6s var(--ux-spring);z-index:2;pointer-events:none}
.u095-avg span{position:absolute;right:-46px;top:-10px;height:20px;padding:0 6px;border-radius:6px;display:grid;place-items:center;background:var(--ux-accent);color:var(--ux-accent-ink);font-size:10px;font-weight:800;font-variant-numeric:tabular-nums}
.u095-bars{position:absolute;left:0;right:46px;top:0;bottom:0;display:flex;align-items:stretch}
.u095-b{position:relative;flex:var(--on,1) 1 0;min-width:0;padding:0 var(--pad,3px);border:0;background:transparent;display:flex;flex-direction:column;justify-content:flex-end;transition:flex-grow .55s var(--ux-ease),padding .55s var(--ux-ease),opacity .3s}
.u095-b.off{--on:0;padding:0;opacity:0;pointer-events:none}
.u095-b i{display:block;height:calc(var(--h,0) * (100% - 26px));margin-bottom:26px;border-radius:8px 8px 4px 4px;background:color-mix(in srgb,var(--ux-accent) 32%,var(--ux-surface-3));transition:height .65s var(--ux-spring),background-color .25s,opacity .25s;transition-delay:calc(var(--d,0) * 24ms),0s,0s}
.u095-b.first i{background:var(--ux-grad)}
.u095-b em{position:absolute;left:-4px;right:-4px;bottom:4px;font-style:normal;text-align:center;font-size:10px;font-weight:700;color:var(--ux-ink-3);white-space:nowrap;font-variant-numeric:tabular-nums;transition:color .2s}
@media (max-width:520px){
  .u095-b:nth-child(even) em{opacity:0}
  .u095-b.on em{opacity:1!important}
}
.u095.has .u095-b:not(.on) i{opacity:.46}
.u095-b.on i{background:var(--ux-accent);opacity:1}
.u095-b.on em{color:var(--ux-ink)}
.u095-b.pin i{box-shadow:0 0 0 2px var(--ux-surface),0 0 0 4px var(--ux-accent)}
.u095-b:focus-visible{outline:none}
.u095-b:focus-visible i{box-shadow:0 0 0 2px var(--ux-surface),0 0 0 4px var(--ux-accent)}
.u095-tip{position:absolute;left:0;top:0;z-index:3;height:28px;padding:0 10px;border-radius:9px;display:flex;align-items:center;gap:6px;background:var(--ux-ink);color:var(--ux-page);font-size:11.5px;font-weight:800;white-space:nowrap;pointer-events:none;font-variant-numeric:tabular-nums;transform:translate(var(--tx,0px),var(--ty,0px));opacity:0;transition:opacity .2s,transform .3s var(--ux-ease)}
.u095.has .u095-tip{opacity:1}
.u095-tip small{font-size:10.5px;font-weight:800;color:var(--ux-mint)}
.u095-tip small.dn{color:#93C5FD}

/* #227 Live table with incoming orders (adapted for live multi-city & backend sync telemetry) */
.u227{position:relative;width:100%;max-width:100%;padding:16px 14px 14px;border-radius:26px;overflow:hidden;background:var(--ux-surface);box-shadow:0 0 0 1px var(--ux-line),0 26px 52px -34px var(--ux-shadow-strong);color:var(--ux-ink)}
.u227-hd{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:0 4px 12px}
.u227-hd b{margin-right:auto;display:flex;align-items:center;gap:8px;font-size:15px;font-weight:800;letter-spacing:-.015em}
.u227-hd b i{width:8px;height:8px;flex:none;border-radius:50%;background:var(--ux-mint);box-shadow:0 0 0 3px color-mix(in srgb,var(--ux-mint) 25%,transparent);animation:u227-lv 1.6s ease-in-out infinite}
.u227.is-pause .u227-hd b i{animation:none;background:var(--ux-ink-3);box-shadow:none}
@keyframes u227-lv{50%{opacity:.35}}
.u227-pz{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 12px;border:0;border-radius:999px;background:var(--ux-surface-2);box-shadow:inset 0 0 0 1px var(--ux-line);color:var(--ux-ink-2);font:inherit;font-size:11.5px;font-weight:750;cursor:pointer;transition:background-color .2s,color .2s,transform .25s var(--ux-spring)}
.u227-pz:hover{background:var(--ux-accent-soft);color:var(--ux-accent)}
.u227-pz:active{transform:scale(.97)}
.u227-tb{position:relative;border-radius:16px;background:var(--ux-surface-2);overflow:hidden;border:1px solid var(--ux-line)}
.u227-hr,.u227-r{display:grid;grid-template-columns:1.35fr .75fr 1fr;align-items:center;gap:8px;padding:0 12px}
@media (max-width:440px){
  .u227-hr,.u227-r{grid-template-columns:1.25fr .7fr 1.05fr;padding:0 10px;gap:6px}
}
.u227-hr{height:36px;border-bottom:1px solid var(--ux-line);font-size:11px;font-weight:800;color:var(--ux-ink-3)}
.u227-th{display:inline-flex;align-items:center;gap:4px;padding:0;border:0;background:none;color:inherit;font:inherit;cursor:pointer;text-align:left}
.u227-th[aria-sort="ascending"],.u227-th[aria-sort="descending"]{color:var(--ux-ink)}
.u227-th svg{width:9px;height:9px;opacity:.4;transition:transform .35s cubic-bezier(.3,1.6,.5,1),opacity .2s}
.u227-th[aria-sort="ascending"] svg{opacity:1;transform:rotate(180deg)}
.u227-th[aria-sort="descending"] svg{opacity:1}
.u227-th:focus-visible{outline:2px solid var(--ux-accent);outline-offset:2px;border-radius:4px}
.u227-bd{position:relative;transition:height .35s var(--ux-ease)}
.u227-r{position:absolute;left:0;right:0;top:0;height:48px;border:0;width:100%;background:transparent;text-align:left;border-bottom:1px solid var(--ux-line);transition:transform .45s cubic-bezier(.3,1.1,.4,1),opacity .35s,background-color .2s;font-size:12px;font-weight:700;color:var(--ux-ink)}
.u227-r.is-clickable{cursor:pointer}
.u227-r.is-clickable:hover{background:color-mix(in srgb,var(--ux-accent) 7%,transparent)}
.u227-r.is-active{background:color-mix(in srgb,var(--ux-accent) 12%,transparent);box-shadow:inset 3px 0 0 var(--ux-accent)}
.u227-r.is-new{animation:u227-gl 1.2s ease}
@keyframes u227-gl{0%{background:color-mix(in srgb,var(--ux-accent) 22%,transparent)}100%{background:transparent}}
.u227-r .nm{display:flex;flex-direction:column;min-width:0}
.u227-r .nm b{font-size:13px;font-weight:780;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ux-ink)}
.u227-r .nm small{font-size:11px;font-weight:600;color:var(--ux-ink-3);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.u227-r .am{font-size:14px;font-weight:820;font-variant-numeric:tabular-nums;color:var(--ux-ink)}
.u227-r .st{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:750;color:var(--c,var(--ux-accent));min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.u227-r .st::before{content:"";width:6px;height:6px;flex:none;border-radius:50%;background:var(--c,var(--ux-accent))}
@media (prefers-reduced-motion:reduce){.u227-r{transition:none}.u227-r.is-new,.u227-hd b i{animation:none}}
`;

export function ensureLucianHubStyles(): void {
  injectLucianElementCss(LUCIAN_HUB_STYLE_ID, LUCIAN_HUB_SCOPED_CSS);
}

function useLucianHubStyleMount(): void {
  useEffect(() => {
    ensureLucianHubStyles();
  }, []);
}

export type LucianIconKind =
  | 'sun'
  | 'snowflake'
  | 'flame'
  | 'zap'
  | 'cloud'
  | 'globe'
  | 'key'
  | 'layout'
  | 'bookmark'
  | 'monitor'
  | 'smartphone'
  | 'clock'
  | 'search'
  | 'shuffle'
  | 'layers'
  | 'refresh';

function renderLucianSvgIcon(kind: LucianIconKind): React.ReactNode {
  switch (kind) {
    case 'snowflake':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2v20M4.9 4.9l14.2 14.2M19.1 4.9L4.9 19.1M2 12h20" />
        </svg>
      );
    case 'flame':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3c2.5 3.2 5.5 6 5.5 10.2a5.5 5.5 0 1 1-11 0c0-2.6 1.5-5 3-6.7 0 2 1.2 3 2.5 3 0-2.4-.5-4.3 0-6.5z" />
        </svg>
      );
    case 'zap':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" />
        </svg>
      );
    case 'cloud':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M17.5 19H7a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 11a3.5 3.5 0 0 1-.5 8z" />
        </svg>
      );
    case 'globe':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
      );
    case 'key':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="8" cy="15" r="4.5" />
          <path d="M11.3 11.7L20 3m-3 3l3 3m-5.5-.5l2.5 2.5" />
        </svg>
      );
    case 'layout':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <path d="M3 9.5h18M9 9.5V20" />
        </svg>
      );
    case 'bookmark':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z" />
        </svg>
      );
    case 'monitor':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="4" width="18" height="13" rx="2.5" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      );
    case 'smartphone':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
          <path d="M11 18.5h2" />
        </svg>
      );
    case 'clock':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.2 2" />
        </svg>
      );
    case 'search':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </svg>
      );
    case 'shuffle':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M16 4h4v4M4 19L20 4M20 16v4h-4M14.5 14.5L20 20M4 5l5.5 5.5" />
        </svg>
      );
    case 'layers':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3l9 4.5-9 4.5-9-4.5L12 3zM3 12l9 4.5 9-4.5M3 16.5L12 21l9-4.5" />
        </svg>
      );
    case 'refresh':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 11a8 8 0 0 0-14.6-4.5M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5M20 20v-4h-4" />
        </svg>
      );
    case 'sun':
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" />
        </svg>
      );
  }
}

/* ============================================================================
 * 1. Lucian #015 — Plan radio cards
 * ============================================================================ */

export interface LucianRadioOption<T extends string = string> {
  id: T;
  title: string;
  subtitle: string;
  badge?: string;
  metaPrimary?: string;
  metaSecondary?: string;
  icon?: LucianIconKind;
  gradient?: string;
}

export interface LucianPlanRadioCardsProps<T extends string = string> {
  ariaLabel: string;
  options: ReadonlyArray<LucianRadioOption<T>>;
  value: T;
  onChange: (next: T) => void;
  columns?: 1 | 2 | 3;
  compact?: boolean;
  summaryLeft?: string;
  summaryRight?: string;
  isDark?: boolean;
}

export function LucianPlanRadioCards<T extends string = string>({
  ariaLabel,
  options,
  value,
  onChange,
  columns = 1,
  compact = false,
  summaryLeft,
  summaryRight,
  isDark = false,
}: LucianPlanRadioCardsProps<T>): React.ReactElement {
  useLucianHubStyleMount();
  const rootRef = useRef<HTMLDivElement>(null);
  const grpRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLSpanElement>(null);
  const didMountRef = useRef<boolean>(false);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    const grp = grpRef.current;
    const frame = frameRef.current;
    if (!grp || !frame) {
      return;
    }

    let raf1 = 0;
    let raf2 = 0;

    const placeActive = () => {
      const activeBtn = grp.querySelector<HTMLButtonElement>(
        '.u015-opt[aria-checked="true"]'
      );
      if (!activeBtn) {
        return;
      }
      frame.style.left = `${activeBtn.offsetLeft}px`;
      frame.style.top = `${activeBtn.offsetTop}px`;
      frame.style.width = `${activeBtn.offsetWidth}px`;
      frame.style.height = `${activeBtn.offsetHeight}px`;
    };

    if (!didMountRef.current) {
      didMountRef.current = true;
      frame.style.transition = 'none';
      placeActive();
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          if (frameRef.current) {
            frameRef.current.style.transition = '';
          }
        });
      });
    } else {
      placeActive();
    }

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => placeActive());
      ro.observe(grp);
    }

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      if (ro) {
        ro.disconnect();
      }
    };
  }, [value, options.length, columns]);

  if (Platform.OS !== 'web') {
    return (
      <View style={nativeStyles.stack}>
        {options.map((opt) => {
          const checked = opt.id === value;
          return (
            <Pressable
              key={opt.id}
              accessibilityRole="radio"
              accessibilityState={{ checked }}
              onPress={() => onChange(opt.id)}
              style={[
                nativeStyles.radioCard,
                checked && nativeStyles.radioCardActive,
              ]}
            >
              <Text
                style={[
                  nativeStyles.radioTitle,
                  checked && nativeStyles.radioTitleActive,
                ]}
              >
                {opt.title}
              </Text>
              <Text style={nativeStyles.radioSub}>{opt.subtitle}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    const delta =
      e.key === 'ArrowDown' || e.key === 'ArrowRight'
        ? 1
        : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
          ? -1
          : 0;
    if (!delta) {
      return;
    }
    e.preventDefault();
    const nextIdx = (idx + delta + options.length) % options.length;
    const nextOpt = options[nextIdx];
    onChange(nextOpt.id);
    const buttons = grpRef.current?.querySelectorAll<HTMLButtonElement>('.u015-opt');
    buttons?.[nextIdx]?.focus();
  };

  return (
    <div
      ref={rootRef}
      className="ux u015"
      data-cols={String(columns)}
      data-compact={String(compact)}
      data-palette-dark={String(isDark)}
    >
      <div ref={grpRef} className="u015-grp" role="radiogroup" aria-label={ariaLabel}>
        <span ref={frameRef} className="u015-frame" aria-hidden="true" />
        {options.map((opt, idx) => {
          const checked = opt.id === value;
          return (
            <button
              key={opt.id}
              className="u015-opt"
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => onChange(opt.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
            >
              <span className="u015-dot" aria-hidden="true" />
              {opt.icon && (
                <span
                  className="u015-ic"
                  style={
                    {
                      '--g':
                        opt.gradient ||
                        'linear-gradient(140deg,#2F8FE0,#185ADB)',
                    } as React.CSSProperties
                  }
                  aria-hidden="true"
                >
                  {renderLucianSvgIcon(opt.icon)}
                </span>
              )}
              <span className="u015-txt">
                <b>
                  <span>{opt.title}</span>
                  {opt.badge ? <em>{opt.badge}</em> : null}
                </b>
                <small>{opt.subtitle}</small>
              </span>
              {opt.metaPrimary ? (
                <span className="u015-price">
                  <b>{opt.metaPrimary}</b>
                  {opt.metaSecondary ? <small>{opt.metaSecondary}</small> : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {(summaryLeft || summaryRight) && (
        <p className="u015-cta" aria-live="polite">
          <span className="u015-sel">{summaryLeft}</span>
          <b className="u015-sum">{summaryRight}</b>
        </p>
      )}
    </div>
  );
}

/* ============================================================================
 * 2. Lucian #023 — Expanding notification settings (Feature Customization Matrix)
 * ============================================================================ */

export interface LucianFeatureSwitchRow {
  key: string;
  title: string;
  subtitle: string;
  enabled: boolean;
  icon: LucianIconKind;
  gradient: string;
  subOptions?: {
    ariaLabel: string;
    choices: ReadonlyArray<{ id: string; label: string }>;
    selectedId: string;
    onSelect: (id: string) => void;
  };
}

export interface LucianFeatureSettingsCardProps {
  title: string;
  rows: ReadonlyArray<LucianFeatureSwitchRow>;
  onToggleRow: (key: string, nextValue?: boolean) => void;
  isDark?: boolean;
}

export const LucianFeatureSettingsCard: React.FC<LucianFeatureSettingsCardProps> = ({
  title,
  rows,
  onToggleRow,
  isDark = false,
}) => {
  useLucianHubStyleMount();
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  const enabledCount = rows.filter((r) => r.enabled).length;
  const allEnabled = enabledCount === rows.length;

  const handleCascadeAll = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
    const targetVal = !allEnabled;
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    rows.forEach((row, idx) => {
      if (row.enabled === targetVal) {
        return;
      }
      if (reduced) {
        onToggleRow(row.key, targetVal);
      } else {
        const timer = setTimeout(() => {
          onToggleRow(row.key, targetVal);
        }, idx * 95);
        timersRef.current.push(timer);
      }
    });
  };

  if (Platform.OS !== 'web') {
    return (
      <View style={nativeStyles.stack}>
        {rows.map((row) => (
          <Pressable
            key={row.key}
            accessibilityRole="switch"
            accessibilityState={{ checked: row.enabled }}
            onPress={() => onToggleRow(row.key, !row.enabled)}
            style={nativeStyles.radioCard}
          >
            <Text style={nativeStyles.radioTitle}>
              {row.enabled ? '✓ ' : '○ '}
              {row.title}
            </Text>
            <Text style={nativeStyles.radioSub}>{row.subtitle}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <div className="ux u023" data-palette-dark={String(isDark)}>
      <div className="u023-top">
        <b>{title}</b>
        <span className="u023-badge" aria-live="polite">
          {enabledCount ? `${enabledCount}/${rows.length} đang bật` : 'Đang tắt hết'}
        </span>
      </div>

      {rows.map((row) => {
        const sub = row.subOptions;
        const activeSubIdx = sub
          ? Math.max(
              0,
              sub.choices.findIndex((c) => c.id === sub.selectedId)
            )
          : 0;

        return (
          <div
            key={row.key}
            className={`u023-item${row.enabled ? '' : ' is-off'}`}
          >
            <div className="u023-head">
              <span
                className="u023-ic"
                style={{ '--g': row.gradient } as React.CSSProperties}
                aria-hidden="true"
              >
                {renderLucianSvgIcon(row.icon)}
              </span>
              <div className="u023-t">
                <b>{row.title}</b>
                <small>{row.subtitle}</small>
              </div>
              <button
                className="u023-sw"
                type="button"
                role="switch"
                aria-checked={row.enabled}
                aria-label={row.title}
                onClick={() => onToggleRow(row.key, !row.enabled)}
              />
            </div>

            {sub ? (
              <div className={`u023-more${row.enabled ? ' is-open' : ''}`}>
                <div>
                  <div
                    className="u023-opts"
                    role="radiogroup"
                    aria-label={sub.ariaLabel}
                    style={
                      {
                        '--count': sub.choices.length,
                      } as React.CSSProperties
                    }
                  >
                    <span
                      className="u023-pill"
                      style={{ '--i': activeSubIdx } as React.CSSProperties}
                      aria-hidden="true"
                    />
                    {sub.choices.map((choice, cIdx) => {
                      const isSel = choice.id === sub.selectedId;
                      return (
                        <button
                          key={choice.id}
                          className="u023-opt"
                          type="button"
                          role="radio"
                          aria-checked={isSel}
                          tabIndex={row.enabled && isSel ? 0 : -1}
                          onClick={() => sub.onSelect(choice.id)}
                          onKeyDown={(e) => {
                            const dir =
                              e.key === 'ArrowRight'
                                ? 1
                                : e.key === 'ArrowLeft'
                                  ? -1
                                  : 0;
                            if (!dir) return;
                            e.preventDefault();
                            const nextIdx =
                              (cIdx + dir + sub.choices.length) %
                              sub.choices.length;
                            sub.onSelect(sub.choices[nextIdx].id);
                            const parent = e.currentTarget.parentElement;
                            parent
                              ?.querySelectorAll<HTMLButtonElement>('.u023-opt')
                              ?.[nextIdx]?.focus();
                          }}
                        >
                          {choice.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}

      <button className="u023-all" type="button" onClick={handleCascadeAll}>
        {allEnabled ? 'Tắt tuần tự các module phụ' : 'Bật đầy đủ tất cả module'}
      </button>
    </div>
  );
};

/* ============================================================================
 * 3. Lucian #036 — Password strength meter (Masked Blank-by-Default API Key Input)
 * ============================================================================ */

export interface LucianApiKeyFieldProps {
  label: string;
  value: string;
  placeholder: string;
  onChange: (val: string) => void;
  showSecret: boolean;
  onToggleSecret: () => void;
  isDark?: boolean;
}

export const LucianApiKeyField: React.FC<LucianApiKeyFieldProps> = ({
  label,
  value,
  placeholder,
  onChange,
  showSecret,
  onToggleSecret,
  isDark = false,
}) => {
  useLucianHubStyleMount();
  const inputId = useId();

  const keyStrength = useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      return {
        level: 0,
        color: 'var(--ux-line-2)',
        statusText: 'Trống · Tự dùng Open-Meteo Free',
      };
    }
    let score = 0;
    if (trimmed.length >= 8) score += 1;
    if (trimmed.length >= 16) score += 1;
    if (/[A-Za-z]/.test(trimmed) && /\d/.test(trimmed)) score += 1;
    if (!/\s/.test(value) && trimmed.length >= 20) score += 1;
    const clamped = Math.max(1, Math.min(4, score));
    const paletteMap: ReadonlyArray<[string, string]> = [
      ['var(--ux-line-2)', 'Trống · Tự dùng Open-Meteo Free'],
      ['#E5484D', 'Khóa quá ngắn'],
      ['#F07A3E', 'Đang nhập khóa...'],
      ['#2F8FE0', 'Định dạng hợp lệ'],
      ['var(--ux-mint)', 'Sẵn sàng · Chỉ lưu cục bộ'],
    ];
    return {
      level: clamped,
      color: paletteMap[clamped][0],
      statusText: paletteMap[clamped][1],
    };
  }, [value]);

  if (Platform.OS !== 'web') {
    return (
      <View style={{ gap: 6 }}>
        <Text style={nativeStyles.radioTitle}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={!showSecret}
          style={nativeStyles.input}
        />
      </View>
    );
  }

  return (
    <div
      className={`ux u036${showSecret ? ' is-show' : ''}`}
      data-palette-dark={String(isDark)}
      style={{ '--lv': keyStrength.color } as React.CSSProperties}
    >
      <label className="u036-lab" htmlFor={inputId}>
        <span>{label}</span>
      </label>
      <div className="u036-box">
        <input
          id={inputId}
          className="u036-in"
          type={showSecret ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          className="u036-eye"
          type="button"
          aria-label={showSecret ? `Ẩn ${label}` : `Hiện ${label}`}
          aria-pressed={showSecret}
          onClick={onToggleSecret}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <g className="u036-lid">
              <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
            </g>
            <circle className="u036-pupil" cx="12" cy="12" r="3" />
            <path className="u036-slash" d="M4 4l16 16" />
          </svg>
        </button>
      </div>
      <div className="u036-meter" aria-hidden="true">
        {[0, 1, 2, 3].map((segIdx) => (
          <i
            key={segIdx}
            className={segIdx < keyStrength.level ? 'on' : undefined}
          />
        ))}
      </div>
      <p className="u036-lv">
        <span>Bảo mật cục bộ</span>
        <b className="u036-word" aria-live="polite">
          {keyStrength.statusText}
        </b>
      </p>
    </div>
  );
};

/* ============================================================================
 * 4. Lucian #044 — FAQ accordion (Native Setup & Widget Guide)
 * ============================================================================ */

export interface LucianAccordionSection {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  steps: ReadonlyArray<string>;
}

export interface LucianFaqAccordionProps {
  sections: ReadonlyArray<LucianAccordionSection>;
  openId: string;
  onChangeOpenId: (nextId: string) => void;
  isDark?: boolean;
}

export const LucianFaqAccordion: React.FC<LucianFaqAccordionProps> = ({
  sections,
  openId,
  onChangeOpenId,
  isDark = false,
}) => {
  useLucianHubStyleMount();
  const baseId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  if (Platform.OS !== 'web') {
    return (
      <View style={nativeStyles.stack}>
        {sections.map((sec) => {
          const isOpen = sec.id === openId;
          return (
            <View key={sec.id} style={nativeStyles.radioCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                onPress={() => onChangeOpenId(isOpen ? '' : sec.id)}
              >
                <Text style={nativeStyles.radioTitle}>
                  [{sec.tag}] {sec.title}
                </Text>
              </Pressable>
              {isOpen ? (
                <View style={{ marginTop: 8, gap: 4 }}>
                  {sec.steps.map((s, idx) => (
                    <Text key={idx} style={nativeStyles.radioSub}>
                      {idx + 1}. {sanitizeCopy(s)}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <div
      ref={containerRef}
      className="ux u044"
      data-palette-dark={String(isDark)}
    >
      {sections.map((sec, idx) => {
        const isOpen = sec.id === openId;
        const qId = `${baseId}-q-${idx}`;
        const bodyId = `${baseId}-a-${idx}`;

        return (
          <div key={sec.id} className={`u044-it${isOpen ? ' open' : ''}`}>
            <button
              id={qId}
              className="u044-q"
              type="button"
              aria-expanded={isOpen}
              aria-controls={bodyId}
              onClick={() => onChangeOpenId(isOpen ? '' : sec.id)}
              onKeyDown={(e) => {
                const targetIdx =
                  e.key === 'ArrowDown'
                    ? idx + 1
                    : e.key === 'ArrowUp'
                      ? idx - 1
                      : e.key === 'Home'
                        ? 0
                        : e.key === 'End'
                          ? sections.length - 1
                          : -99;
                if (targetIdx === -99) return;
                e.preventDefault();
                const wrapped =
                  (targetIdx + sections.length) % sections.length;
                containerRef.current
                  ?.querySelectorAll<HTMLButtonElement>('.u044-q')
                  ?.[wrapped]?.focus();
              }}
            >
              <span className="u044-n">{sec.tag}</span>
              <span className="u044-t">{sanitizeCopy(sec.title)}</span>
              <span className="u044-pm" aria-hidden="true" />
            </button>
            <div
              id={bodyId}
              className="u044-body"
              role="region"
              aria-labelledby={qId}
            >
              <div>
                <div className="u044-a">
                  <p>{sanitizeCopy(sec.subtitle)}</p>
                  <ol className="u044-steps">
                    {sec.steps.map((step, sIdx) => (
                      <li key={sIdx} className="u044-step">
                        <i aria-hidden="true">{sIdx + 1}</i>
                        <span>{sanitizeCopy(step.trim())}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ============================================================================
 * 5. Lucian #095 — Bar chart that changes shape (24h Weather Morphing Chart)
 * ============================================================================ */

export interface LucianMorphingForecastChartProps {
  series: ReadonlyArray<HourlyForecastPoint>;
  currentFeelsLikeC: number;
  selectedHourIdx: number;
  onSelectHour: (idx: number) => void;
  isDark?: boolean;
}

function formatShortHour(iso: string | undefined, idx: number): string {
  if (!iso) return `+${idx + 1}h`;
  const hasExplicitTz = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso.trim());
  if (!hasExplicitTz) {
    const match = iso.match(/T(\d{2}):(\d{2})/);
    if (match) return `${match[1]}h`;
  }
  const parsed = new Date(iso);
  if (!Number.isNaN(parsed.getTime())) {
    return `${String(parsed.getHours()).padStart(2, '0')}h`;
  }
  return `+${idx + 1}h`;
}

export const LucianMorphingForecastChart: React.FC<LucianMorphingForecastChartProps> = ({
  series,
  currentFeelsLikeC,
  selectedHourIdx,
  onSelectHour,
  isDark = false,
}) => {
  useLucianHubStyleMount();
  const rootRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelectHour);
  onSelectRef.current = onSelectHour;

  const points = useMemo(() => series.slice(0, 12), [series]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    const root = rootRef.current;
    if (!root || points.length === 0) {
      return;
    }

    const lab = root.querySelector<HTMLElement>('.u095-lab');
    const big = root.querySelector<HTMLElement>('.u095-v b');
    const dl = root.querySelector<HTMLElement>('.u095-dl');
    const segWrap = root.querySelector<HTMLElement>('.u095-seg');
    const segs = Array.from(
      root.querySelectorAll<HTMLButtonElement>('.u095-seg button')
    );
    const grid = root.querySelector<HTMLElement>('.u095-grid');
    const bars = root.querySelector<HTMLElement>('.u095-bars');
    const avg = root.querySelector<HTMLElement>('.u095-avg');
    const tip = root.querySelector<HTMLElement>('.u095-tip');
    const ch = root.querySelector<HTMLElement>('.u095-ch');

    if (!lab || !big || !dl || !segWrap || !grid || !bars || !avg || !tip || !ch) {
      return;
    }

    const rm =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const labelsShort = points.map((pt, idx) => formatShortHour(pt.timeIso, idx));
    const labelsFull = points.map(
      (pt, idx) =>
        `Khung giờ ${formatShortHour(pt.timeIso, idx)} · Mưa ${Math.round(
          pt.precipProbPct || 0
        )}% (${Number(pt.precipMm || 0).toFixed(1)} mm)`
    );

    const tempVals = points.map((pt) => Math.round(pt.temperatureC * 10) / 10);
    const rainVals = points.map((pt) =>
      Math.max(0, Math.min(100, Math.round(pt.precipProbPct || 0)))
    );
    const tempDelta =
      points.length > 0 ? currentFeelsLikeC - points[0].temperatureC : 0;
    const feelsVals = points.map(
      (pt) => Math.round((pt.temperatureC + tempDelta) * 10) / 10
    );

    const datasets = [
      {
        title: 'Trung bình 12 giờ tới',
        unit: '°C',
        vals: tempVals,
        summarySub: `Biên độ ${Math.round(Math.min(...tempVals))}° - ${Math.round(
          Math.max(...tempVals)
        )}°C`,
      },
      {
        title: 'Xác suất mưa theo giờ',
        unit: '%',
        vals: rainVals,
        summarySub: `Đỉnh mưa ${Math.max(...rainVals)}%`,
      },
      {
        title: 'Nhiệt độ cảm nhận thực',
        unit: '°C',
        vals: feelsVals,
        summarySub: `Lệch cảm nhận ${tempDelta >= 0 ? '+' : ''}${tempDelta.toFixed(1)}°C`,
      },
    ];

    while (bars.firstChild) bars.removeChild(bars.firstChild);
    while (grid.firstChild) grid.removeChild(grid.firstChild);

    const barButtons: HTMLButtonElement[] = [];
    for (let i = 0; i < 12; i += 1) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'u095-b off';
      b.tabIndex = -1;
      const barFill = document.createElement('i');
      const barEm = document.createElement('em');
      b.appendChild(barFill);
      b.appendChild(barEm);
      bars.appendChild(b);
      barButtons.push(b);
    }

    const gridLines = [0, 1, 2, 3].map((k) => {
      const g = document.createElement('div');
      g.className = 'u095-gl';
      g.style.bottom = `${((k / 3) * 100).toFixed(3)}%`;
      const sp = document.createElement('span');
      g.appendChild(sp);
      grid.appendChild(g);
      return sp;
    });

    let activeSet = 0;
    let hoverIdx = -1;
    let pinIdx = Math.min(Math.max(0, selectedHourIdx), points.length - 1);
    let shownVal = tempVals[0] || 0;
    let rafRoll = 0;
    let rafInit1 = 0;
    let rafInit2 = 0;

    const fmtVal = (val: number, unit: string) =>
      unit === '%' ? `${Math.round(val)}%` : `${val.toFixed(1)}°C`;

    const computeBounds = (vals: number[], unit: string) => {
      if (unit === '%') {
        return { min: 0, max: 100 };
      }
      const rawMin = Math.min(...vals);
      const rawMax = Math.max(...vals);
      const min = Math.floor(rawMin - 3);
      const max = Math.max(min + 6, Math.ceil(rawMax + 2));
      return { min, max };
    };

    const rollNumber = (target: number, unit: string) => {
      cancelAnimationFrame(rafRoll);
      const from = shownVal;
      const t0 = performance.now();
      const dur = rm ? 1 : 360;
      const tick = (now: number) => {
        if (!root.isConnected) return;
        const k = Math.min(1, (now - t0) / dur);
        const eased = 1 - Math.pow(1 - k, 3);
        shownVal = from + (target - from) * eased;
        big.textContent = fmtVal(shownVal, unit);
        if (k < 1) {
          rafRoll = requestAnimationFrame(tick);
        }
      };
      tick(t0);
    };

    const diffLabel = (curr: number, prev: number, unit: string) => {
      const diff = Math.round((curr - prev) * 10) / 10;
      const sign = diff >= 0 ? '+' : '';
      return `${sign}${unit === '%' ? Math.round(diff) : diff.toFixed(1)}${unit}`;
    };

    const updateHeader = () => {
      const d = datasets[activeSet];
      const idx = hoverIdx >= 0 ? hoverIdx : pinIdx;
      if (idx >= 0 && idx < d.vals.length) {
        lab.textContent = labelsFull[idx];
        rollNumber(d.vals[idx], d.unit);
        dl.textContent =
          idx > 0
            ? `${diffLabel(d.vals[idx], d.vals[idx - 1], d.unit)} so với giờ trước`
            : d.summarySub;
        dl.classList.toggle('dn', idx > 0 && d.vals[idx] < d.vals[idx - 1]);
      } else {
        const mean =
          d.vals.reduce((acc, v) => acc + v, 0) / Math.max(1, d.vals.length);
        lab.textContent = d.title;
        rollNumber(mean, d.unit);
        dl.textContent = d.summarySub;
        dl.classList.remove('dn');
      }
    };

    const showBar = (idx: number) => {
      hoverIdx = idx;
      const effIdx = idx >= 0 ? idx : pinIdx;
      barButtons.forEach((b, k) => {
        b.classList.toggle('on', k === effIdx);
        b.classList.toggle('pin', k === pinIdx);
      });
      root.classList.toggle('has', effIdx >= 0);

      if (effIdx >= 0 && effIdx < datasets[activeSet].vals.length) {
        const d = datasets[activeSet];
        const b = barButtons[effIdx];
        const tipMain = tip.querySelector('span');
        const tipSmall = tip.querySelector('small');
        if (tipMain) {
          tipMain.textContent = `${labelsShort[effIdx]} · ${fmtVal(
            d.vals[effIdx],
            d.unit
          )}`;
        }
        if (tipSmall) {
          tipSmall.textContent =
            effIdx > 0
              ? diffLabel(d.vals[effIdx], d.vals[effIdx - 1], d.unit)
              : '';
          tipSmall.classList.toggle(
            'dn',
            effIdx > 0 && d.vals[effIdx] < d.vals[effIdx - 1]
          );
        }
        const cw = ch.clientWidth;
        const tw2 = tip.offsetWidth || 96;
        const cx = b.offsetLeft + b.offsetWidth / 2;
        const hRatio = parseFloat(b.style.getPropertyValue('--h') || '0.5');
        const hh = hRatio * (ch.clientHeight - 26);
        tip.style.setProperty(
          '--tx',
          `${Math.max(0, Math.min(cw - tw2, cx - tw2 / 2)).toFixed(1)}px`
        );
        tip.style.setProperty(
          '--ty',
          `${Math.max(-4, ch.clientHeight - 26 - hh - 34).toFixed(1)}px`
        );
      }
      updateHeader();
    };

    const drawSet = (setIdx: number, firstRender: boolean) => {
      activeSet = setIdx;
      hoverIdx = -1;
      const d = datasets[setIdx];
      const n = d.vals.length;
      const { min, max } = computeBounds(d.vals, d.unit);
      const span = Math.max(1, max - min);
      const mean = d.vals.reduce((a, b) => a + b, 0) / Math.max(1, n);

      segs.forEach((s, j) => s.setAttribute('aria-pressed', String(j === setIdx)));
      segWrap.style.setProperty('--k', String(setIdx));

      barButtons.forEach((b, j) => {
        const on = j < n;
        b.classList.toggle('off', !on);
        b.classList.toggle('first', j === 0);
        b.style.setProperty('--d', String(j));
        b.style.setProperty('--pad', n > 9 ? '2.5px' : '4px');
        if (on) {
          const em = b.querySelector('em');
          if (em) em.textContent = labelsShort[j];
          b.setAttribute(
            'aria-label',
            `${labelsShort[j]} ${fmtVal(d.vals[j], d.unit)}`
          );
          const ratio = Math.max(0.08, Math.min(1, (d.vals[j] - min) / span));
          b.style.setProperty('--h', firstRender ? '0' : ratio.toFixed(3));
        } else {
          b.style.setProperty('--h', '0');
        }
        b.tabIndex = on && j === Math.max(0, pinIdx) ? 0 : -1;
      });

      if (firstRender) {
        rafInit1 = requestAnimationFrame(() => {
          rafInit2 = requestAnimationFrame(() => {
            barButtons.forEach((b, j) => {
              if (j < n) {
                const ratio = Math.max(
                  0.08,
                  Math.min(1, (d.vals[j] - min) / span)
                );
                b.style.setProperty('--h', ratio.toFixed(3));
              }
            });
            showBar(-1);
          });
        });
      }

      gridLines.forEach((sp, j) => {
        const gVal = min + (span * j) / 3;
        sp.textContent =
          d.unit === '%' ? `${Math.round(gVal)}%` : `${Math.round(gVal)}°`;
      });

      const avgRatio = Math.max(0.05, Math.min(0.95, (mean - min) / span));
      avg.style.setProperty('--a', avgRatio.toFixed(3));
      const avgSpan = avg.querySelector('span');
      if (avgSpan) {
        avgSpan.textContent =
          d.unit === '%' ? `TB ${Math.round(mean)}%` : `TB ${mean.toFixed(1)}°`;
      }

      showBar(-1);
    };

    const idxAtClientX = (clientX: number) => {
      const n = datasets[activeSet].vals.length;
      let best = 0;
      for (let j = 0; j < n; j += 1) {
        const r = barButtons[j].getBoundingClientRect();
        if (clientX >= r.left) best = j;
      }
      return best;
    };

    const onPointerMove = (e: PointerEvent) => {
      showBar(idxAtClientX(e.clientX));
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') {
        try {
          bars.setPointerCapture(e.pointerId);
        } catch {
          // Ignore pointer capture restriction
        }
        const j = idxAtClientX(e.clientX);
        pinIdx = j;
        onSelectRef.current(j);
        showBar(j);
      }
    };
    const onPointerLeave = () => showBar(-1);
    const onClickBars = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest('.u095-b');
      if (!target) return;
      const j = barButtons.indexOf(target as HTMLButtonElement);
      if (j < 0) return;
      pinIdx = j;
      onSelectRef.current(j);
      showBar(j);
    };
    const onKeyDownBars = (e: KeyboardEvent) => {
      const n = datasets[activeSet].vals.length;
      const curr = barButtons.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        e.key === 'ArrowRight'
          ? curr + 1
          : e.key === 'ArrowLeft'
            ? curr - 1
            : e.key === 'Home'
              ? 0
              : e.key === 'End'
                ? n - 1
                : null;
      if (next === null) return;
      e.preventDefault();
      const clamped = Math.max(0, Math.min(n - 1, next));
      pinIdx = clamped;
      barButtons.forEach((b, k) => {
        b.tabIndex = k === clamped ? 0 : -1;
      });
      barButtons[clamped].focus();
      onSelectRef.current(clamped);
      showBar(clamped);
    };

    bars.addEventListener('pointermove', onPointerMove);
    bars.addEventListener('pointerdown', onPointerDown);
    bars.addEventListener('pointerleave', onPointerLeave);
    bars.addEventListener('click', onClickBars);
    bars.addEventListener('keydown', onKeyDownBars);

    const segHandlers = segs.map((btn, k) => {
      const fn = () => {
        if (k !== activeSet) drawSet(k, false);
      };
      btn.addEventListener('click', fn);
      return { btn, fn };
    });

    drawSet(0, !rm);

    return () => {
      cancelAnimationFrame(rafRoll);
      cancelAnimationFrame(rafInit1);
      cancelAnimationFrame(rafInit2);
      bars.removeEventListener('pointermove', onPointerMove);
      bars.removeEventListener('pointerdown', onPointerDown);
      bars.removeEventListener('pointerleave', onPointerLeave);
      bars.removeEventListener('click', onClickBars);
      bars.removeEventListener('keydown', onKeyDownBars);
      segHandlers.forEach(({ btn, fn }) => btn.removeEventListener('click', fn));
    };
  }, [points, currentFeelsLikeC]);

  if (Platform.OS !== 'web') {
    return (
      <View style={nativeStyles.radioCard}>
        <Text style={nativeStyles.radioTitle}>Dự báo 12 giờ tới</Text>
        <Text style={nativeStyles.radioSub}>
          {points
            .slice(0, 6)
            .map(
              (pt, idx) =>
                `${formatShortHour(pt.timeIso, idx)}: ${Math.round(pt.temperatureC)}°C`
            )
            .join(' · ')}
        </Text>
      </View>
    );
  }

  return (
    <div ref={rootRef} className="ux u095" data-palette-dark={String(isDark)}>
      <div className="u095-h">
        <div>
          <div className="u095-top">
            <small className="u095-lab">Trung bình 12 giờ tới</small>
            <span className="u095-dl" />
          </div>
          <div className="u095-v">
            <b>--°C</b>
          </div>
        </div>
        <div
          className="u095-seg"
          role="group"
          aria-label="Chọn thông số biểu đồ"
        >
          <button type="button" aria-pressed="true">
            Nhiệt độ
          </button>
          <button type="button" aria-pressed="false">
            Mưa %
          </button>
          <button type="button" aria-pressed="false">
            Cảm giác
          </button>
        </div>
      </div>
      <div className="u095-ch">
        <div className="u095-grid" aria-hidden="true" />
        <div
          className="u095-bars"
          role="group"
          aria-label="Biểu đồ dự báo theo giờ"
        />
        <div className="u095-avg" aria-hidden="true">
          <span />
        </div>
        <div className="u095-tip" aria-hidden="true">
          <span />
          <small />
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 6. Lucian #227 — Live table with incoming orders (Sortable Live Telemetry Table)
 * ============================================================================ */

export interface LucianSortableRow {
  id: string;
  primaryText: string;
  secondaryText: string;
  metricDisplay: string;
  metricNumeric: number;
  sortTimeOrOrder: number;
  statusText: string;
  statusColor: string;
  isSelected?: boolean;
}

export interface LucianLiveSortableTableProps {
  title: string;
  col0Label: string;
  col1Label: string;
  col2Label: string;
  rows: ReadonlyArray<LucianSortableRow>;
  actionButtonLabel?: string;
  onPressActionButton?: () => void;
  onSelectRow?: (rowId: string) => void;
  paused?: boolean;
  isDark?: boolean;
}

const ROW_HEIGHT_PX = 48;

export const LucianLiveSortableTable: React.FC<LucianLiveSortableTableProps> = ({
  title,
  col0Label,
  col1Label,
  col2Label,
  rows,
  actionButtonLabel,
  onPressActionButton,
  onSelectRow,
  paused = false,
  isDark = false,
}) => {
  useLucianHubStyleMount();
  const [sortCol, setSortCol] = useState<0 | 1>(0);
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const rankById = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      const diff =
        sortCol === 1
          ? a.metricNumeric - b.metricNumeric
          : a.sortTimeOrOrder - b.sortTimeOrOrder;
      if (diff !== 0) {
        return diff * sortDir;
      }
      return a.id.localeCompare(b.id);
    });
    const map = new Map<string, number>();
    sorted.forEach((r, idx) => map.set(r.id, idx));
    return map;
  }, [rows, sortCol, sortDir]);

  const toggleSort = (col: 0 | 1) => {
    if (sortCol === col) {
      setSortDir((prev) => (prev === 1 ? -1 : 1));
    } else {
      setSortCol(col);
      setSortDir(-1);
    }
  };

  if (Platform.OS !== 'web') {
    return (
      <View style={nativeStyles.stack}>
        {rows.map((r) => (
          <Pressable
            key={r.id}
            disabled={!onSelectRow}
            onPress={() => onSelectRow?.(r.id)}
            style={[
              nativeStyles.radioCard,
              r.isSelected && nativeStyles.radioCardActive,
            ]}
          >
            <Text
              style={[
                nativeStyles.radioTitle,
                r.isSelected && nativeStyles.radioTitleActive,
              ]}
            >
              {r.primaryText} · {r.metricDisplay}
            </Text>
            <Text style={nativeStyles.radioSub}>
              {r.secondaryText} · {r.statusText}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <div
      className={`ux u227${paused ? ' is-pause' : ''}`}
      data-palette-dark={String(isDark)}
    >
      <div className="u227-hd">
        <b>
          <i aria-hidden="true" />
          <span>{title}</span>
        </b>
        {actionButtonLabel && onPressActionButton ? (
          <button
            type="button"
            className="u227-pz"
            onClick={onPressActionButton}
          >
            <span>{actionButtonLabel}</span>
          </button>
        ) : null}
      </div>

      <div className="u227-tb" role="table" aria-label={title}>
        <div className="u227-hr" role="row">
          <button
            type="button"
            className="u227-th"
            role="columnheader"
            aria-sort={
              sortCol === 0
                ? sortDir > 0
                  ? 'ascending'
                  : 'descending'
                : 'none'
            }
            onClick={() => toggleSort(0)}
          >
            <span>{col0Label}</span>
            <svg viewBox="0 0 9 9" aria-hidden="true">
              <path
                d="M2 3.5l2.5 2.5L7 3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            type="button"
            className="u227-th"
            role="columnheader"
            aria-sort={
              sortCol === 1
                ? sortDir > 0
                  ? 'ascending'
                  : 'descending'
                : 'none'
            }
            onClick={() => toggleSort(1)}
          >
            <span>{col1Label}</span>
            <svg viewBox="0 0 9 9" aria-hidden="true">
              <path
                d="M2 3.5l2.5 2.5L7 3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <span role="columnheader">{col2Label}</span>
        </div>

        <div
          className="u227-bd"
          role="rowgroup"
          style={{ height: Math.max(1, rows.length) * ROW_HEIGHT_PX }}
        >
          {rows.map((r) => {
            const rank = rankById.get(r.id) ?? 0;
            const translateY = rank * ROW_HEIGHT_PX;
            const rowClass = `u227-r${onSelectRow ? ' is-clickable' : ''}${
              r.isSelected ? ' is-active' : ''
            }`;
            const rowStyle = {
              transform: `translateY(${translateY}px)`,
              '--c': r.statusColor,
            } as React.CSSProperties;

            if (onSelectRow) {
              return (
                <button
                  key={r.id}
                  type="button"
                  role="row"
                  className={rowClass}
                  style={rowStyle}
                  onClick={() => onSelectRow(r.id)}
                >
                  <span className="nm" role="cell">
                    <b>{r.primaryText}</b>
                    <small>{r.secondaryText}</small>
                  </span>
                  <span className="am" role="cell">
                    {r.metricDisplay}
                  </span>
                  <span className="st" role="cell">
                    {r.statusText}
                  </span>
                </button>
              );
            }

            return (
              <div
                key={r.id}
                role="row"
                className={rowClass}
                style={rowStyle}
              >
                <span className="nm" role="cell">
                  <b>{r.primaryText}</b>
                  <small>{r.secondaryText}</small>
                </span>
                <span className="am" role="cell">
                  {r.metricDisplay}
                </span>
                <span className="st" role="cell">
                  {r.statusText}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/**
 * Helper resolving dark theme state from palette + live document[data-theme] attribute.
 */
export function useResolvedLucianDark(palette?: AtmosphericPalette): boolean {
  const [docTheme, setDocTheme] = useState<'light' | 'dark' | null>(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return null;
    }
    const attr = document.documentElement.getAttribute('data-theme');
    return attr === 'dark' ? 'dark' : attr === 'light' ? 'light' : null;
  });

  useEffect(() => {
    if (
      Platform.OS !== 'web' ||
      typeof document === 'undefined' ||
      typeof MutationObserver === 'undefined'
    ) {
      return;
    }
    const sync = () => {
      const attr = document.documentElement.getAttribute('data-theme');
      setDocTheme(attr === 'dark' ? 'dark' : attr === 'light' ? 'light' : null);
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => obs.disconnect();
  }, []);

  if (docTheme === 'dark') return true;
  if (docTheme === 'light') return false;
  return Boolean(palette?.isDark);
}

const nativeStyles = StyleSheet.create({
  stack: {
    gap: 8,
  },
  radioCard: {
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    gap: 3,
  },
  radioCardActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  radioTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  radioTitleActive: {
    color: '#F8FAFC',
  },
  radioSub: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
    lineHeight: 17,
    color: '#475569',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13.5,
    color: '#0F172A',
    ...(WEB_NO_OUTLINE as object),
  },
});

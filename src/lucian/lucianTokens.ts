/* Lucian UX/UI Prompt theme tokens · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/ */
import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import type { AtmosphericPalette } from '../components/themeTokens';

export type LucianThemeMode = 'auto' | 'light' | 'dark';
export type ResolvedLucianTheme = 'light' | 'dark';

const LUCIAN_TOKENS_STYLE_ID = 'lucian-uxui-tokens';

/**
 * Official `--ux-*` light & dark tokens + `.ux` base rules from `lucian-uxui.mjs tokens`,
 * paired with explicit `[data-theme="light"]` and `[data-theme="dark"]` selectors and
 * WeatherBuddy's Plus Jakarta Sans geometric Vietnamese font stack.
 */
export const LUCIAN_TOKENS_CSS = `/* Lucian UX/UI Prompt theme tokens · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/
   Calibrated with pbakaus/impeccable OKLCH perceptual color system & strict WCAG AA+ contrast. */
:root,
:root[data-theme="light"]{
  color-scheme:light;
  --ux-page:var(--wb-page,#F7F5F0);
  --ux-surface:var(--wb-surface,#FCFBF8);
  --ux-surface-2:var(--wb-surface-2,#F3EFE8);
  --ux-surface-3:var(--wb-surface-3,#ECE8DF);
  --ux-ink:var(--wb-ink,#141D2B);
  --ux-ink-2:var(--wb-ink-2,#36455C);
  --ux-ink-3:var(--wb-ink-3,#53647D);
  --ux-line:var(--wb-line,rgba(20,29,43,.09));
  --ux-line-2:var(--wb-line-2,rgba(20,29,43,.17));
  --ux-accent:var(--wb-accent,#1E6BB8);
  --ux-accent-2:#2A7AC9;
  --ux-accent-soft:var(--wb-accent-soft,rgba(30,107,184,.11));
  --ux-accent-ink:var(--wb-accent-ink,#FCFBF8);
  --ux-mint:#13845E;
  --ux-warn:#B86B1D;
  --ux-danger:#C4384B;
  --ux-glass:rgba(252,251,248,.76);
  --ux-glass-line:rgba(252,251,248,.90);
  --ux-shadow:rgba(20,29,43,.10);
  --ux-shadow-strong:rgba(20,29,43,.22);
  --ux-grad:linear-gradient(120deg,#1E6BB8,#2A7AC9 55%,#13845E);
  --ux-ease:cubic-bezier(.2,.8,.2,1);
  --ux-spring:cubic-bezier(.34,1.45,.64,1);
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    color-scheme:dark;
    --ux-page:var(--wb-page,#0B1220);
    --ux-surface:var(--wb-surface,#152033);
    --ux-surface-2:var(--wb-surface-2,#1C2A42);
    --ux-surface-3:var(--wb-surface-3,#22324D);
    --ux-ink:var(--wb-ink,#EEF3FA);
    --ux-ink-2:var(--wb-ink-2,#B2C1D6);
    --ux-ink-3:var(--wb-ink-3,#7E91AC);
    --ux-line:var(--wb-line,rgba(203,221,245,.08));
    --ux-line-2:var(--wb-line-2,rgba(203,221,245,.15));
    --ux-accent:var(--wb-accent,#6BA9E8);
    --ux-accent-2:#7EB6EE;
    --ux-accent-soft:var(--wb-accent-soft,rgba(107,169,232,.14));
    --ux-accent-ink:var(--wb-accent-ink,#0D1524);
    --ux-mint:#38B889;
    --ux-warn:#E5A23C;
    --ux-danger:#E26D7A;
    --ux-glass:rgba(21,32,51,.76);
    --ux-glass-line:rgba(203,221,245,.16);
    --ux-shadow:rgba(5,10,20,.44);
    --ux-shadow-strong:rgba(5,10,20,.68);
    --ux-grad:linear-gradient(120deg,#6BA9E8,#5899DA 55%,#38B889);
  }
}
:root[data-theme="dark"]{
  color-scheme:dark;
  --ux-page:var(--wb-page,#0B1220);
  --ux-surface:var(--wb-surface,#152033);
  --ux-surface-2:var(--wb-surface-2,#1C2A42);
  --ux-surface-3:var(--wb-surface-3,#22324D);
  --ux-ink:var(--wb-ink,#EEF3FA);
  --ux-ink-2:var(--wb-ink-2,#B2C1D6);
  --ux-ink-3:var(--wb-ink-3,#7E91AC);
  --ux-line:var(--wb-line,rgba(203,221,245,.08));
  --ux-line-2:var(--wb-line-2,rgba(203,221,245,.15));
  --ux-accent:var(--wb-accent,#6BA9E8);
  --ux-accent-2:#7EB6EE;
  --ux-accent-soft:var(--wb-accent-soft,rgba(107,169,232,.14));
  --ux-accent-ink:var(--wb-accent-ink,#0D1524);
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
`;

export function ensureLucianTokensInjected(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }
  const existing = document.getElementById(LUCIAN_TOKENS_STYLE_ID);
  if (existing) {
    if (existing.textContent !== LUCIAN_TOKENS_CSS) {
      existing.textContent = LUCIAN_TOKENS_CSS;
    }
    return;
  }
  const styleEl = document.createElement('style');
  styleEl.id = LUCIAN_TOKENS_STYLE_ID;
  styleEl.textContent = LUCIAN_TOKENS_CSS;
  document.head.appendChild(styleEl);
}

export function injectLucianElementCss(styleId: string, cssText: string): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }
  ensureLucianTokensInjected();
  const existing = document.getElementById(styleId);
  if (existing) {
    if (existing.textContent !== cssText) {
      existing.textContent = cssText;
    }
    return;
  }
  const styleEl = document.createElement('style');
  styleEl.id = styleId;
  styleEl.textContent = cssText;
  document.head.appendChild(styleEl);
}

export function resolveLucianTheme(
  themeMode: LucianThemeMode,
  skyIsDark: boolean
): ResolvedLucianTheme {
  if (themeMode === 'light') {
    return 'light';
  }
  if (themeMode === 'dark') {
    return 'dark';
  }
  return skyIsDark ? 'dark' : 'light';
}

export function syncLucianDocumentTheme(
  resolvedTheme: ResolvedLucianTheme,
  palette?: AtmosphericPalette
): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }
  ensureLucianTokensInjected();
  const root = document.documentElement;
  root.setAttribute('data-theme', resolvedTheme);
  root.style.colorScheme = resolvedTheme;

  if (palette) {
    root.style.setProperty('--wb-page', palette.skyStops[2]);
    root.style.setProperty('--wb-surface', palette.coreSurfaceBg);
    root.style.setProperty('--wb-surface-2', palette.coreElevatedBg);
    root.style.setProperty('--wb-surface-3', palette.pillIdleBg);
    root.style.setProperty('--wb-ink', palette.inkPrimary);
    root.style.setProperty('--wb-ink-2', palette.inkSecondary);
    root.style.setProperty('--wb-ink-3', palette.inkMuted);
    root.style.setProperty('--wb-line', palette.hairline);
    root.style.setProperty('--wb-line-2', palette.bezelOuterBorder);
    root.style.setProperty('--wb-accent', palette.accent);
    root.style.setProperty('--wb-accent-soft', palette.accentSoftBg);
    root.style.setProperty('--wb-accent-ink', palette.accentContrastInk);
  }
}

export function prefersReducedMotionWeb(): boolean {
  if (
    Platform.OS !== 'web' ||
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useLucianThemeSync(
  themeMode: LucianThemeMode,
  skyIsDark: boolean,
  palette?: AtmosphericPalette
): ResolvedLucianTheme {
  const resolvedTheme = useMemo(
    () => resolveLucianTheme(themeMode, skyIsDark),
    [themeMode, skyIsDark]
  );

  useEffect(() => {
    syncLucianDocumentTheme(resolvedTheme, palette);
  }, [resolvedTheme, palette]);

  return resolvedTheme;
}

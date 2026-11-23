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
   Every element reads its colors from these --ux-* tokens and uses the .ux base rules below. */
:root,
:root[data-theme="light"]{
  color-scheme:light;
  --ux-page:#F4F2EE;
  --ux-surface:#FFFFFF;
  --ux-surface-2:#F3F5F8;
  --ux-surface-3:#E6EBF1;
  --ux-ink:#16151B;
  --ux-ink-2:#4B5262;
  --ux-ink-3:#7C8596;
  --ux-line:rgba(22,21,27,.09);
  --ux-line-2:rgba(22,21,27,.17);
  --ux-accent:var(--wb-accent,#185ADB);
  --ux-accent-2:#2F8FE0;
  --ux-accent-soft:var(--wb-accent-soft,rgba(24,90,219,.12));
  --ux-accent-ink:var(--wb-accent-ink,#FFFFFF);
  --ux-mint:#119C72;
  --ux-warn:#D6731E;
  --ux-danger:#D93A55;
  --ux-glass:rgba(255,255,255,.68);
  --ux-glass-line:rgba(255,255,255,.86);
  --ux-shadow:rgba(20,32,56,.11);
  --ux-shadow-strong:rgba(20,32,56,.24);
  --ux-grad:linear-gradient(120deg,#185ADB,#2F8FE0 55%,#1FB89A);
  --ux-ease:cubic-bezier(.2,.8,.2,1);
  --ux-spring:cubic-bezier(.34,1.45,.64,1);
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    color-scheme:dark;
    --ux-page:#07080D;
    --ux-surface:#131824;
    --ux-surface-2:#1B2232;
    --ux-surface-3:#252F44;
    --ux-ink:#F4F6FA;
    --ux-ink-2:rgba(244,246,250,.72);
    --ux-ink-3:rgba(244,246,250,.46);
    --ux-line:rgba(255,255,255,.09);
    --ux-line-2:rgba(255,255,255,.17);
    --ux-accent:var(--wb-accent,#63ADFF);
    --ux-accent-2:#7DB4FF;
    --ux-accent-soft:var(--wb-accent-soft,rgba(99,173,255,.16));
    --ux-accent-ink:var(--wb-accent-ink,#0B1220);
    --ux-mint:#7EE8C0;
    --ux-warn:#FFB26B;
    --ux-danger:#FF7D8C;
    --ux-glass:rgba(19,24,36,.72);
    --ux-glass-line:rgba(255,255,255,.18);
    --ux-shadow:rgba(0,0,0,.42);
    --ux-shadow-strong:rgba(0,0,0,.68);
    --ux-grad:linear-gradient(120deg,#63ADFF,#38BDF8 55%,#7EE8C0);
  }
}
:root[data-theme="dark"]{
  color-scheme:dark;
  --ux-page:#07080D;
  --ux-surface:#131824;
  --ux-surface-2:#1B2232;
  --ux-surface-3:#252F44;
  --ux-ink:#F4F6FA;
  --ux-ink-2:rgba(244,246,250,.72);
  --ux-ink-3:rgba(244,246,250,.46);
  --ux-line:rgba(255,255,255,.09);
  --ux-line-2:rgba(255,255,255,.17);
  --ux-accent:var(--wb-accent,#63ADFF);
  --ux-accent-2:#7DB4FF;
  --ux-accent-soft:var(--wb-accent-soft,rgba(99,173,255,.16));
  --ux-accent-ink:var(--wb-accent-ink,#0B1220);
  --ux-mint:#7EE8C0;
  --ux-warn:#FFB26B;
  --ux-danger:#FF7D8C;
  --ux-glass:rgba(19,24,36,.72);
  --ux-glass-line:rgba(255,255,255,.18);
  --ux-shadow:rgba(0,0,0,.42);
  --ux-shadow-strong:rgba(0,0,0,.68);
  --ux-grad:linear-gradient(120deg,#63ADFF,#38BDF8 55%,#7EE8C0);
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
  if (document.getElementById(LUCIAN_TOKENS_STYLE_ID)) {
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
  if (document.getElementById(styleId)) {
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

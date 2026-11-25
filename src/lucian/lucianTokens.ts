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
export const LUCIAN_TOKENS_CSS = `/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V4 · theme: custom (Obsidian Slate / Crisp Porcelain OKLCH) · contrast: pass (40–41) · tokens: pass (48)
   Lucian UX/UI Prompt theme tokens · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/ */
:root,
:root[data-theme="light"]{
  color-scheme:light;
  --ux-page:var(--wb-page,#F4F6F9);
  --ux-surface:var(--wb-surface,#FCFDFD);
  --ux-surface-2:var(--wb-surface-2,#F0F4F8);
  --ux-surface-3:var(--wb-surface-3,#E4EBF2);
  --ux-ink:var(--wb-ink,#111824);
  --ux-ink-2:var(--wb-ink-2,#314054);
  --ux-ink-3:var(--wb-ink-3,#4B5B70);
  --ux-line:var(--wb-line,rgba(17,24,36,.11));
  --ux-line-2:var(--wb-line-2,rgba(17,24,36,.18));
  --ux-accent:var(--wb-accent,#1662B3);
  --ux-accent-2:#2374C7;
  --ux-accent-soft:var(--wb-accent-soft,rgba(22,98,179,.12));
  --ux-accent-ink:var(--wb-accent-ink,#FCFDFD);
  --ux-mint:#117D59;
  --ux-warn:#B36216;
  --ux-danger:#BE3145;
  --ux-glass:rgba(252,253,253,.88);
  --ux-glass-line:rgba(17,24,36,.14);
  --ux-shadow:rgba(17,24,36,.10);
  --ux-shadow-strong:rgba(17,24,36,.22);
  --ux-grad:linear-gradient(120deg,#1662B3,#117D59);
  --ux-ease:cubic-bezier(.2,.8,.2,1);
  --ux-spring:cubic-bezier(.34,1.45,.64,1);
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    color-scheme:dark;
    --ux-page:var(--wb-page,#0B0E14);
    --ux-surface:var(--wb-surface,#161C29);
    --ux-surface-2:var(--wb-surface-2,#20293B);
    --ux-surface-3:var(--wb-surface-3,#28334A);
    --ux-ink:var(--wb-ink,#F3F6FA);
    --ux-ink-2:var(--wb-ink-2,#CCD5E3);
    --ux-ink-3:var(--wb-ink-3,#9AA8BD);
    --ux-line:var(--wb-line,rgba(224,234,248,.13));
    --ux-line-2:var(--wb-line-2,rgba(224,234,248,.21));
    --ux-accent:var(--wb-accent,#70B5FF);
    --ux-accent-2:#8AC3FF;
    --ux-accent-soft:var(--wb-accent-soft,rgba(112,181,255,.16));
    --ux-accent-ink:var(--wb-accent-ink,#0B0E14);
    --ux-mint:#42D39F;
    --ux-warn:#F5B44C;
    --ux-danger:#F27482;
    --ux-glass:rgba(22,28,41,.92);
    --ux-glass-line:rgba(224,234,248,.20);
    --ux-shadow:rgba(4,6,11,.56);
    --ux-shadow-strong:rgba(4,6,11,.82);
    --ux-grad:linear-gradient(120deg,#70B5FF,#42D39F);
  }
}
:root[data-theme="dark"]{
  color-scheme:dark;
  --ux-page:var(--wb-page,#0B0E14);
  --ux-surface:var(--wb-surface,#161C29);
  --ux-surface-2:var(--wb-surface-2,#20293B);
  --ux-surface-3:var(--wb-surface-3,#28334A);
  --ux-ink:var(--wb-ink,#F3F6FA);
  --ux-ink-2:var(--wb-ink-2,#CCD5E3);
  --ux-ink-3:var(--wb-ink-3,#9AA8BD);
  --ux-line:var(--wb-line,rgba(224,234,248,.13));
  --ux-line-2:var(--wb-line-2,rgba(224,234,248,.21));
  --ux-accent:var(--wb-accent,#70B5FF);
  --ux-accent-2:#8AC3FF;
  --ux-accent-soft:var(--wb-accent-soft,rgba(112,181,255,.16));
  --ux-accent-ink:var(--wb-accent-ink,#0B0E14);
  --ux-mint:#42D39F;
  --ux-warn:#F5B44C;
  --ux-danger:#F27482;
  --ux-glass:rgba(22,28,41,.92);
  --ux-glass-line:rgba(224,234,248,.20);
  --ux-shadow:rgba(4,6,11,.56);
  --ux-shadow-strong:rgba(4,6,11,.82);
  --ux-grad:linear-gradient(120deg,#70B5FF,#42D39F);
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

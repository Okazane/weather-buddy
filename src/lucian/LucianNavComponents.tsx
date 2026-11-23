/* Lucian UX/UI Prompt #416 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#416 */
/* Lucian UX/UI Prompt #031 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#031 */
/* Lucian UX/UI Prompt #039 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#039 */
/* Lucian UX/UI Prompt #242 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#242 */
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { PresetCity } from '../core';
import {
  FONT_FAMILY_SANS,
  WEB_NO_OUTLINE,
  type AtmosphericPalette,
} from '../components/themeTokens';
import {
  injectLucianElementCss,
  prefersReducedMotionWeb,
} from './lucianTokens';

const LUCIAN_NAV_STYLE_ID = 'lucian-uxui-nav-elements';

/**
 * Genuine scoped `.u416`, `.u031`, `.u039`, and `.u242` CSS ported from Lucian UX/UI Prompt,
 * preserving exact radii, shadows, durations, and spring/ease motion curves, adapted to fit
 * responsive header & scenario strip slots (`max-width: 100%` from `375px` mobile to `1360px` desktop).
 */
const LUCIAN_NAV_ELEMENTS_CSS = `
/* #416 Tabs · https://lucianlabs.dev/uxui-prompt/#416 */
.u416{position:relative;width:100%;max-width:100%;display:flex;flex-direction:column;color:var(--ux-ink)}
.u416-tl{position:relative;display:flex;width:100%;padding:4px;border-radius:14px;background:var(--ux-surface-2);box-shadow:inset 0 0 0 1px var(--ux-line)}
.u416-th{position:absolute;top:4px;bottom:4px;left:var(--l,4px);right:var(--r,4px);border-radius:10px;background:var(--ux-surface);box-shadow:0 0 0 1px var(--ux-line),0 1px 2px var(--ux-shadow),0 6px 14px -8px var(--ux-shadow-strong);transition:left var(--tl,.5s) cubic-bezier(.3,1.25,.45,1),right var(--tr,.5s) cubic-bezier(.3,1.25,.45,1);pointer-events:none}
.u416-tab{position:relative;z-index:1;flex:1 1 0%;min-width:0;height:38px;padding:0 12px;border:0;border-radius:10px;background:none;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:13px;font-weight:650;color:var(--ux-ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .25s}
.u416-tab:hover{color:var(--ux-ink-2)}
.u416-tab[aria-selected="true"]{color:var(--ux-ink);font-weight:720}
.u416-tab:focus-visible{outline:2px solid var(--ux-accent);outline-offset:2px}
.u416-ico{display:inline-flex;align-items:center;justify-content:center;flex:none;color:var(--ux-ink-3);transition:color .25s}
.u416-tab[aria-selected="true"] .u416-ico{color:var(--ux-accent)}
@media (max-width:640px){
  .u416-tab{height:36px;padding:0 5px;gap:4px;font-size:12px}
}
@media (max-width:395px){
  .u416-ico{display:none}
  .u416-tab{padding:0 3px;font-size:11.5px}
}
@media (prefers-reduced-motion:reduce){.u416-th{transition:none!important}}

/* #031 Custom select listbox · https://lucianlabs.dev/uxui-prompt/#031 */
.u031{position:relative;width:236px;max-width:100%;z-index:70}
.u031.is-open{z-index:140}
.u031-f{position:relative;margin:0}
.u031-btn{display:flex;align-items:center;gap:10px;width:100%;height:42px;padding:0 12px;border:0;border-radius:14px;background:var(--ux-surface);color:var(--ux-ink);text-align:left;
  box-shadow:0 0 0 1px var(--ux-line),0 4px 12px -8px var(--ux-shadow);transition:box-shadow .25s var(--ux-ease),background-color .25s}
.u031-btn:hover{box-shadow:0 0 0 1.5px var(--ux-line-2),0 6px 14px -8px var(--ux-shadow)}
.u031-btn:focus-visible,.u031.is-open .u031-btn[aria-expanded="true"]{outline:0;background:var(--ux-surface);box-shadow:inset 0 0 0 2px var(--ux-accent),0 0 0 4px var(--ux-accent-soft)}
.u031-flag{width:27px;height:27px;flex:none;border-radius:8px;display:grid;place-items:center;font-size:9.5px;font-weight:800;letter-spacing:.02em;color:#fff;background:var(--c)}
.u031-v{flex:1;min-width:0}
.u031-v b{display:block;font-size:13.5px;font-weight:720;line-height:1.18;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.u031-v small{display:block;font-size:11px;line-height:1.15;color:var(--ux-ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.u031-car{width:17px;height:17px;flex:none;fill:none;stroke:var(--ux-ink-3);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;transition:transform .45s var(--ux-spring)}
.u031-btn[aria-expanded="true"] .u031-car{transform:rotate(180deg)}
.u031-list{position:absolute;z-index:150;left:0;min-width:252px;max-width:calc(100vw - 28px);width:max(100%,252px);top:calc(100% + 8px);margin:0;padding:6px;list-style:none;border-radius:18px;background:var(--ux-surface);
  box-shadow:0 0 0 1px var(--ux-line-2),0 28px 56px -24px var(--ux-shadow-strong);transform-origin:50% 0;outline:none;
  opacity:0;transform:translateY(-6px) scaleY(.92);visibility:hidden;pointer-events:none;transition:opacity .2s var(--ux-ease),transform .4s var(--ux-spring),visibility 0s .4s}
.u031-list.is-open{opacity:1;transform:none;visibility:visible;pointer-events:auto;transition:opacity .2s var(--ux-ease),transform .45s var(--ux-spring)}
.u031-hl{position:absolute;left:6px;right:6px;top:6px;height:46px;border-radius:12px;background:var(--ux-surface-2);transform:translateY(calc(var(--i,0) * 46px));transition:transform .35s var(--ux-spring);pointer-events:none}
.u031-o{position:relative;display:flex;align-items:center;gap:11px;height:46px;padding:0 10px;border-radius:12px;cursor:pointer;font-size:14px;font-weight:640;color:var(--ux-ink);user-select:none}
.u031-o .u031-flag{width:26px;height:26px;border-radius:8px;font-size:9.5px}
.u031-o small{margin-left:2px;font-size:11.5px;font-weight:500;color:var(--ux-ink-3);white-space:nowrap}
.u031-ck{margin-left:auto;width:18px;height:18px;flex:none;fill:none;stroke:var(--ux-accent);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;opacity:0;transform:scale(.4);transition:opacity .2s,transform .4s var(--ux-spring)}
.u031-o[aria-selected="true"] .u031-ck{opacity:1;transform:none}
@media (max-width:640px){
  .u031{width:100%;flex:1 1 172px}
}

/* #039 Sliding pill tabs · https://lucianlabs.dev/uxui-prompt/#039 */
.u039{position:relative;display:inline-flex;max-width:100%}
.u039-tabs{position:relative;display:inline-flex;align-items:center;padding:4px;border-radius:999px;background:var(--ux-surface);box-shadow:0 0 0 1px var(--ux-line),0 4px 12px -8px var(--ux-shadow);max-width:100%}
.u039-pill{position:absolute;left:0;top:4px;bottom:4px;width:var(--w,64px);border-radius:999px;background:var(--ux-ink);transform:translateX(var(--x,4px));box-shadow:0 8px 16px -10px var(--ux-shadow-strong);transition:transform .5s var(--ux-spring),width .5s var(--ux-spring);pointer-events:none}
.u039-tab{position:relative;z-index:1;flex:none;height:30px;border:0;padding:0 11px;border-radius:999px;background:none;display:inline-flex;align-items:center;justify-content:center;gap:4px;font-size:12.5px;font-weight:680;color:var(--ux-ink-2);white-space:nowrap;transition:color .35s var(--ux-ease)}
.u039-tab:hover{color:var(--ux-ink)}
.u039-tab[aria-selected="true"]{color:var(--ux-page)}
.u039-tab:focus-visible{outline:2px solid var(--ux-accent);outline-offset:2px}
@media (max-width:440px){
  .u039-tab{height:28px;padding:0 8.5px;font-size:11.5px}
}

/* #242 Category chip bar that follows scroll · https://lucianlabs.dev/uxui-prompt/#242 */
.u242{position:relative;width:100%;max-width:100%;min-width:0;border-radius:18px;overflow:hidden;background:var(--ux-surface);box-shadow:0 0 0 1px var(--ux-line),0 12px 28px -20px var(--ux-shadow-strong);color:var(--ux-ink)}
.u242-cb{position:relative;z-index:2;width:100%;max-width:100%;background:transparent;transition:box-shadow .25s}
.u242-cr{position:relative;isolation:isolate;display:flex;align-items:center;gap:4px;width:100%;max-width:100%;padding:6px 8px;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.u242-cr::-webkit-scrollbar{display:none}
.u242-ch{position:relative;z-index:1;flex:none;height:34px;padding:0 12px;border:0;border-radius:999px;background:none;color:var(--ux-ink-3);font:inherit;font-size:12.5px;font-weight:750;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:6px;transition:color .2s}
.u242-ch:hover{color:var(--ux-ink-2)}
.u242-ch[aria-current="true"]{color:var(--ux-ink);font-weight:820}
.u242-ch:focus-visible{outline:2px solid var(--ux-accent);outline-offset:-2px}
.u242-dot{width:7px;height:7px;border-radius:50%;background:var(--ux-mint);box-shadow:0 0 0 3px rgba(17,156,114,.18);flex:none}
.u242-ul{position:absolute;left:0;top:6px;height:34px;border-radius:999px;background:var(--ux-surface-2);box-shadow:inset 0 0 0 1px var(--ux-line-2);transition:transform .35s cubic-bezier(.3,1.2,.5,1),width .35s cubic-bezier(.3,1.2,.5,1);z-index:0;pointer-events:none}
@media (max-width:480px){
  .u242-cr{padding:5px 6px}
  .u242-ch{height:32px;padding:0 10.5px;font-size:12px}
  .u242-ul{top:5px;height:32px}
}
@media (prefers-reduced-motion: reduce){.u242-ul,.u242-cb{transition:none!important}}
`;

function normalizeTypeahead(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

const CITY_BADGE_META: Record<string, { code: string; gradient: string }> = {
  ha_noi: {
    code: 'HN',
    gradient: 'linear-gradient(140deg,#185ADB,#2F8FE0)',
  },
  tp_hcm: {
    code: 'HCM',
    gradient: 'linear-gradient(140deg,#EA580C,#F59E0B)',
  },
  da_lat: {
    code: 'ĐL',
    gradient: 'linear-gradient(140deg,#0D9488,#22C55E)',
  },
  da_nang: {
    code: 'ĐN',
    gradient: 'linear-gradient(140deg,#0284C7,#22C3A6)',
  },
  sa_pa: {
    code: 'SP',
    gradient: 'linear-gradient(140deg,#2563EB,#38BDF8)',
  },
  can_tho: {
    code: 'CT',
    gradient: 'linear-gradient(140deg,#16A34A,#14B8A6)',
  },
};

/* ============================================================================
 * 1. #416 — LucianViewTabs (Main 4-View Jelly Segmented Navigation Tabs)
 * ========================================================================== */

export interface LucianTabOption<T extends string> {
  id: T;
  label: string;
  compactLabel: string;
  featherIcon: React.ComponentProps<typeof Feather>['name'];
}

export interface LucianViewTabsProps<T extends string> {
  options: ReadonlyArray<LucianTabOption<T>>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
  isCompactLabels?: boolean;
  palette: AtmosphericPalette;
}

export function LucianViewTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  isCompactLabels = false,
  palette,
}: LucianViewTabsProps<T>): React.ReactElement {
  const uid = useId().replace(/:/g, '');
  const listRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLSpanElement | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const prevIdxRef = useRef<number>(-1);
  const mountedOnceRef = useRef<boolean>(false);

  const selectedIndex = useMemo(() => {
    const idx = options.findIndex((opt) => opt.id === value);
    return idx >= 0 ? idx : 0;
  }, [options, value]);

  const updateThumb = useCallback((idx: number, dir: number, animate: boolean) => {
    const tl = listRef.current;
    const th = thumbRef.current;
    const tabEl = tabRefs.current[idx];
    if (!tl || !th || !tabEl) {
      return;
    }
    const totalWidth = tl.clientWidth;
    if (!animate || prefersReducedMotionWeb()) {
      th.style.transition = 'none';
    }
    th.style.setProperty('--tl', dir > 0 ? '.62s' : '.38s');
    th.style.setProperty('--tr', dir > 0 ? '.38s' : '.62s');
    th.style.setProperty('--l', `${tabEl.offsetLeft}px`);
    th.style.setProperty(
      '--r',
      `${Math.max(4, totalWidth - tabEl.offsetLeft - tabEl.offsetWidth)}px`
    );
    if (!animate || prefersReducedMotionWeb()) {
      void th.offsetWidth;
      th.style.transition = '';
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    injectLucianElementCss(LUCIAN_NAV_STYLE_ID, LUCIAN_NAV_ELEMENTS_CSS);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    const prev = prevIdxRef.current;
    const isFirst = !mountedOnceRef.current;
    mountedOnceRef.current = true;
    const dir = prev < 0 || prev === selectedIndex ? 1 : selectedIndex > prev ? 1 : -1;
    prevIdxRef.current = selectedIndex;

    updateThumb(selectedIndex, dir, !isFirst);
  }, [selectedIndex, isCompactLabels, updateThumb]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    const tl = listRef.current;
    if (!tl) {
      return;
    }
    let rafId = 0;
    const syncLayout = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        updateThumb(prevIdxRef.current >= 0 ? prevIdxRef.current : 0, 1, false);
      });
    };
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(syncLayout);
      ro.observe(tl);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', syncLayout);
    }
    syncLayout();

    return () => {
      cancelAnimationFrame(rafId);
      if (ro) {
        ro.disconnect();
      } else if (typeof window !== 'undefined') {
        window.removeEventListener('resize', syncLayout);
      }
    };
  }, [updateThumb]);

  if (Platform.OS !== 'web') {
    return (
      <View
        style={[
          nativeStyles.tabShell,
          {
            backgroundColor: palette.bezelOuterBg,
            borderColor: palette.bezelOuterBorder,
          },
        ]}
      >
        {options.map((opt) => {
          const isSelected = opt.id === value;
          return (
            <Pressable
              key={opt.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onChange(opt.id)}
              style={[
                nativeStyles.tabBtn,
                isSelected && { backgroundColor: palette.coreElevatedBg },
              ]}
            >
              <Feather
                name={opt.featherIcon}
                size={13}
                color={isSelected ? palette.accent : palette.inkSecondary}
              />
              <Text
                numberOfLines={1}
                style={[
                  nativeStyles.tabText,
                  {
                    color: isSelected ? palette.inkPrimary : palette.inkSecondary,
                    fontWeight: isSelected ? '700' : '500',
                  },
                ]}
              >
                {isCompactLabels ? opt.compactLabel : opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const count = options.length;
    if (count === 0) {
      return;
    }
    const nextIdx =
      e.key === 'ArrowRight'
        ? (selectedIndex + 1) % count
        : e.key === 'ArrowLeft'
          ? (selectedIndex - 1 + count) % count
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? count - 1
              : null;
    if (nextIdx === null) {
      return;
    }
    e.preventDefault();
    onChange(options[nextIdx].id);
    tabRefs.current[nextIdx]?.focus({ preventScroll: true });
  };

  return (
    <div className="ux u416">
      <div
        ref={listRef}
        className="u416-tl"
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={handleKeyDown}
      >
        <span ref={thumbRef} className="u416-th" aria-hidden="true" />
        {options.map((opt, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={opt.id}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              id={`${uid}-tab-${opt.id}`}
              className="u416-tab"
              type="button"
              role="tab"
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onChange(opt.id)}
            >
              <span className="u416-ico" aria-hidden="true">
                <Feather name={opt.featherIcon} size={14} color="currentColor" />
              </span>
              <span>{isCompactLabels ? opt.compactLabel : opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================================
 * 2. #031 — LucianCityListbox (Custom Select Listbox for Vietnam Cities)
 * ========================================================================== */

export interface LucianCityListboxProps {
  cities: ReadonlyArray<PresetCity>;
  selectedCityId: string;
  locationLabel: string;
  isLiveMode: boolean;
  isGpsActive: boolean;
  onSelectCity: (cityId: string) => void;
  onRequestGps: () => void;
  gpsLoading: boolean;
  palette: AtmosphericPalette;
}

export const LucianCityListbox: React.FC<LucianCityListboxProps> = ({
  cities,
  selectedCityId,
  locationLabel,
  isLiveMode,
  isGpsActive,
  onSelectCity,
  onRequestGps,
  gpsLoading,
  palette,
}) => {
  const listboxId = useId().replace(/:/g, '');
  const [isOpen, setIsOpen] = useState(false);
  const selectedPresetIndex = useMemo(
    () => cities.findIndex((c) => c.id === selectedCityId),
    [cities, selectedCityId]
  );
  const [activeIndex, setActiveIndex] = useState<number>(
    selectedPresetIndex >= 0 ? selectedPresetIndex : 0
  );

  const rootRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const valueWrapRef = useRef<HTMLSpanElement | null>(null);
  const typedBufRef = useRef<string>('');
  const typedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    injectLucianElementCss(LUCIAN_NAV_STYLE_ID, LUCIAN_NAV_ELEMENTS_CSS);
  }, []);

  useEffect(() => {
    if (selectedPresetIndex >= 0) {
      setActiveIndex(selectedPresetIndex);
    }
  }, [selectedPresetIndex]);

  const closeListbox = useCallback((refocusBtn: boolean) => {
    setIsOpen(false);
    if (refocusBtn && btnRef.current) {
      btnRef.current.focus({ preventScroll: true });
    }
  }, []);

  const openListbox = useCallback(() => {
    const startIdx = selectedPresetIndex >= 0 ? selectedPresetIndex : 0;
    setActiveIndex(startIdx);
    setIsOpen(true);
    requestAnimationFrame(() => {
      listRef.current?.focus({ preventScroll: true });
    });
  }, [selectedPresetIndex]);

  const chooseIndex = useCallback(
    (idx: number) => {
      const target = cities[idx];
      if (!target) {
        return;
      }
      setActiveIndex(idx);
      onSelectCity(target.id);
      const valEl = valueWrapRef.current;
      if (valEl && typeof valEl.animate === 'function' && !prefersReducedMotionWeb()) {
        valEl.animate(
          [
            { transform: 'translateY(8px)', opacity: 0 },
            { transform: 'none', opacity: 1 },
          ],
          { duration: 380, easing: 'cubic-bezier(.34,1.45,.64,1)' }
        );
      }
      closeListbox(true);
    },
    [cities, closeListbox, onSelectCity]
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }
    const onPointerDown = (e: PointerEvent) => {
      if (
        isOpen &&
        fieldRef.current &&
        e.target instanceof Node &&
        !fieldRef.current.contains(e.target)
      ) {
        closeListbox(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      if (typedTimerRef.current) {
        clearTimeout(typedTimerRef.current);
      }
      if (blurTimerRef.current) {
        clearTimeout(blurTimerRef.current);
      }
    };
  }, [closeListbox, isOpen]);

  const matchedPreset = selectedPresetIndex >= 0 ? cities[selectedPresetIndex] : null;
  const activeBadge = isGpsActive
    ? { code: 'GPS', gradient: 'linear-gradient(140deg,#119C72,#0EA5E9)' }
    : !isLiveMode
      ? { code: 'MẪU', gradient: 'linear-gradient(140deg,#2F8FE0,#185ADB)' }
      : matchedPreset
        ? CITY_BADGE_META[matchedPreset.id] ?? {
            code: 'VN',
            gradient: 'linear-gradient(140deg,#185ADB,#2F8FE0)',
          }
        : { code: 'VN', gradient: 'linear-gradient(140deg,#185ADB,#2F8FE0)' };

  const subLabel = !isLiveMode
    ? 'Kịch bản thử nghiệm'
    : isGpsActive
      ? 'Định vị GPS chính xác'
      : matchedPreset?.regionVi ?? 'Việt Nam';

  if (Platform.OS !== 'web') {
    return (
      <View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chọn thành phố"
          onPress={() => setIsOpen(true)}
          style={[
            nativeStyles.cityTrigger,
            WEB_NO_OUTLINE,
            {
              backgroundColor: palette.coreElevatedBg,
              borderColor: palette.bezelOuterBorder,
            },
          ]}
        >
          <Feather
            name={isGpsActive ? 'navigation' : 'map-pin'}
            size={14}
            color={palette.accent}
          />
          <Text
            numberOfLines={1}
            style={[nativeStyles.cityTriggerText, { color: palette.inkPrimary }]}
          >
            {locationLabel}
          </Text>
          <Feather name="chevron-down" size={14} color={palette.inkSecondary} />
        </Pressable>

        <Modal
          visible={isOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsOpen(false)}
        >
          <Pressable
            style={nativeStyles.modalBackdrop}
            onPress={() => setIsOpen(false)}
          >
            <Pressable
              onPress={(ev) => ev.stopPropagation()}
              style={nativeStyles.modalCard}
            >
              <View style={nativeStyles.modalHeader}>
                <Text style={nativeStyles.modalTitle}>Chọn thành phố</Text>
                <Pressable onPress={() => setIsOpen(false)}>
                  <Feather name="x" size={18} color="#0F172A" />
                </Pressable>
              </View>
              <Pressable
                onPress={() => {
                  onRequestGps();
                  setIsOpen(false);
                }}
                style={nativeStyles.nativeGpsRow}
              >
                <Text style={nativeStyles.nativeGpsText}>
                  {gpsLoading ? '📍 Đang định vị...' : '📍 Vị trí hiện tại (GPS)'}
                </Text>
              </Pressable>
              <ScrollView style={{ maxHeight: 280 }}>
                {cities.map((city) => {
                  const selected = isLiveMode && selectedCityId === city.id;
                  return (
                    <Pressable
                      key={city.id}
                      onPress={() => {
                        onSelectCity(city.id);
                        setIsOpen(false);
                      }}
                      style={[
                        nativeStyles.nativeCityOption,
                        selected && nativeStyles.nativeCityOptionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          nativeStyles.nativeCityName,
                          selected && { color: '#FFFFFF' },
                        ]}
                      >
                        {city.nameVi} · {city.regionVi}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
  }

  const handleListKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const count = cities.length;
    if (count === 0) {
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(count - 1, prev + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(0, prev - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(count - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      chooseIndex(activeIndex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeListbox(true);
    } else if (e.key === 'Tab') {
      closeListbox(false);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      typedBufRef.current += normalizeTypeahead(e.key);
      if (typedTimerRef.current) {
        clearTimeout(typedTimerRef.current);
      }
      typedTimerRef.current = setTimeout(() => {
        typedBufRef.current = '';
      }, 600);
      const query = typedBufRef.current;
      const hit = cities.findIndex((city) => {
        const badge = CITY_BADGE_META[city.id]?.code ?? '';
        return (
          normalizeTypeahead(city.nameVi).startsWith(query) ||
          normalizeTypeahead(badge).startsWith(query)
        );
      });
      if (hit >= 0) {
        setActiveIndex(hit);
      }
    }
  };

  const activeDescendantId = `${listboxId}-opt-${activeIndex}`;

  return (
    <div ref={rootRef} className={`ux u031${isOpen ? ' is-open' : ''}`}>
      <div ref={fieldRef} className="u031-f">
        <button
          ref={btnRef}
          className="u031-btn"
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-label={`Chọn thành phố: ${locationLabel}`}
          onClick={() => (isOpen ? closeListbox(true) : openListbox())}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              openListbox();
            }
          }}
        >
          <span
            className="u031-flag"
            style={{ '--c': activeBadge.gradient } as React.CSSProperties}
            aria-hidden="true"
          >
            {activeBadge.code}
          </span>
          <span ref={valueWrapRef} className="u031-v">
            <b>{locationLabel}</b>
            <small>{subLabel}</small>
          </span>
          <svg className="u031-car" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M4.5 7l4.5 4.5L13.5 7" />
          </svg>
        </button>

        <ul
          ref={listRef}
          id={listboxId}
          className={`u031-list${isOpen ? ' is-open' : ''}`}
          role="listbox"
          tabIndex={-1}
          aria-label="Chọn thành phố Việt Nam"
          aria-activedescendant={isOpen ? activeDescendantId : undefined}
          onKeyDown={handleListKeyDown}
          onBlur={() => {
            if (blurTimerRef.current) {
              clearTimeout(blurTimerRef.current);
            }
            blurTimerRef.current = setTimeout(() => {
              if (
                rootRef.current &&
                typeof document !== 'undefined' &&
                !rootRef.current.contains(document.activeElement)
              ) {
                closeListbox(false);
              }
            }, 0);
          }}
        >
          <li
            className="u031-hl"
            role="presentation"
            aria-hidden="true"
            style={{ '--i': activeIndex } as React.CSSProperties}
          />
          {cities.map((city, idx) => {
            const meta = CITY_BADGE_META[city.id] ?? {
              code: 'VN',
              gradient: 'linear-gradient(140deg,#185ADB,#2F8FE0)',
            };
            const isSelected = isLiveMode && !isGpsActive && selectedCityId === city.id;
            return (
              <li
                key={city.id}
                id={`${listboxId}-opt-${idx}`}
                className="u031-o"
                role="option"
                aria-selected={isSelected}
                onPointerMove={() => {
                  if (activeIndex !== idx) {
                    setActiveIndex(idx);
                  }
                }}
                onClick={() => chooseIndex(idx)}
              >
                <span
                  className="u031-flag"
                  style={{ '--c': meta.gradient } as React.CSSProperties}
                  aria-hidden="true"
                >
                  {meta.code}
                </span>
                <span>{city.nameVi}</span>
                <small>{city.regionVi}</small>
                <svg className="u031-ck" viewBox="0 0 18 18" aria-hidden="true">
                  <path d="M4 9.5l3.5 3.5L14 6" />
                </svg>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. #039 — LucianSlidingPillSwitch (Gender & Explicit Theme Mode Switchers)
 * ========================================================================== */

export interface LucianPillOption<T extends string> {
  id: T;
  label: string;
  ariaLabel?: string;
}

export interface LucianSlidingPillSwitchProps<T extends string> {
  options: ReadonlyArray<LucianPillOption<T>>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
  palette: AtmosphericPalette;
}

export function LucianSlidingPillSwitch<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  palette,
}: LucianSlidingPillSwitchProps<T>): React.ReactElement {
  const tabsWrapRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLSpanElement | null>(null);
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const didMountRef = useRef<boolean>(false);

  const selectedIndex = useMemo(() => {
    const idx = options.findIndex((o) => o.id === value);
    return idx >= 0 ? idx : 0;
  }, [options, value]);

  const movePill = useCallback((idx: number, animate: boolean) => {
    const pill = pillRef.current;
    const targetBtn = btnRefs.current[idx];
    if (!pill || !targetBtn) {
      return;
    }
    const skipAnim = !animate || prefersReducedMotionWeb();
    if (skipAnim) {
      pill.style.transition = 'none';
    }
    pill.style.setProperty('--x', `${targetBtn.offsetLeft}px`);
    pill.style.setProperty('--w', `${targetBtn.offsetWidth}px`);
    if (skipAnim) {
      void pill.offsetWidth;
      pill.style.transition = '';
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    injectLucianElementCss(LUCIAN_NAV_STYLE_ID, LUCIAN_NAV_ELEMENTS_CSS);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    const first = !didMountRef.current;
    didMountRef.current = true;
    movePill(selectedIndex, !first);
  }, [selectedIndex, options, movePill]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    const wrap = tabsWrapRef.current;
    if (!wrap) {
      return;
    }
    let rafId = 0;
    const sync = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        movePill(selectedIndex, false);
      });
    };
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(sync);
      ro.observe(wrap);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', sync);
    }
    sync();

    return () => {
      cancelAnimationFrame(rafId);
      if (ro) {
        ro.disconnect();
      } else if (typeof window !== 'undefined') {
        window.removeEventListener('resize', sync);
      }
    };
  }, [movePill, selectedIndex]);

  if (Platform.OS !== 'web') {
    return (
      <View
        style={[
          nativeStyles.pillGroup,
          {
            backgroundColor: palette.bezelOuterBg,
            borderColor: palette.bezelOuterBorder,
          },
        ]}
      >
        {options.map((opt) => {
          const selected = opt.id === value;
          return (
            <Pressable
              key={opt.id}
              accessibilityRole="button"
              accessibilityLabel={opt.ariaLabel ?? opt.label}
              accessibilityState={{ selected }}
              onPress={() => onChange(opt.id)}
              style={[
                nativeStyles.pillBtn,
                selected && { backgroundColor: palette.pillActiveBg },
              ]}
            >
              <Text
                style={[
                  nativeStyles.pillText,
                  {
                    color: selected ? palette.pillActiveInk : palette.inkPrimary,
                  },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <div className="ux u039">
      <div
        ref={tabsWrapRef}
        className="u039-tabs"
        role="tablist"
        aria-label={ariaLabel}
      >
        <span ref={pillRef} className="u039-pill" aria-hidden="true" />
        {options.map((opt, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={opt.id}
              ref={(el) => {
                btnRefs.current[idx] = el;
              }}
              className="u039-tab"
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-label={opt.ariaLabel ?? opt.label}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onChange(opt.id)}
              onKeyDown={(e) => {
                const len = options.length;
                const delta =
                  e.key === 'ArrowRight'
                    ? 1
                    : e.key === 'ArrowLeft'
                      ? -1
                      : e.key === 'Home'
                        ? -idx
                        : e.key === 'End'
                          ? len - 1 - idx
                          : 0;
                if (delta !== 0) {
                  e.preventDefault();
                  const nextIdx = (idx + delta + len) % len;
                  onChange(options[nextIdx].id);
                  btnRefs.current[nextIdx]?.focus({ preventScroll: true });
                }
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================================
 * 4. #242 — LucianScenarioChipBar (Smooth Auto-Centering Scenario Chip Strip)
 * ========================================================================== */

export interface LucianScenarioChipItem<T extends string> {
  id: T;
  label: string;
  isLive?: boolean;
}

export interface LucianScenarioChipBarProps<T extends string> {
  items: ReadonlyArray<LucianScenarioChipItem<T>>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
  palette: AtmosphericPalette;
}

export function LucianScenarioChipBar<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  palette,
}: LucianScenarioChipBarProps<T>): React.ReactElement {
  const railRef = useRef<HTMLElement | null>(null);
  const ulRef = useRef<HTMLSpanElement | null>(null);
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const scrollRafRef = useRef<number>(0);
  const didMountRef = useRef<boolean>(false);

  const selectedIndex = useMemo(() => {
    const idx = items.findIndex((item) => item.id === value);
    return idx >= 0 ? idx : 0;
  }, [items, value]);

  const markChip = useCallback((idx: number, animateScroll: boolean) => {
    const cr = railRef.current;
    const ul = ulRef.current;
    const btn = chipRefs.current[idx];
    if (!cr || !ul || !btn) {
      return;
    }
    const rm = prefersReducedMotionWeb();
    if (!animateScroll || rm) {
      ul.style.transition = 'none';
    }
    ul.style.width = `${btn.offsetWidth}px`;
    ul.style.transform = `translateX(${btn.offsetLeft}px)`;
    if (!animateScroll || rm) {
      void ul.offsetWidth;
      ul.style.transition = '';
    }

    cancelAnimationFrame(scrollRafRef.current);
    const maxScroll = Math.max(0, cr.scrollWidth - cr.clientWidth);
    const targetScroll = Math.max(
      0,
      Math.min(maxScroll, btn.offsetLeft - (cr.clientWidth - btn.offsetWidth) / 2)
    );

    if (!animateScroll || rm) {
      cr.scrollLeft = targetScroll;
      return;
    }

    const startScroll = cr.scrollLeft;
    const startTime = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - startTime) / 320);
      const eased = 1 - Math.pow(1 - k, 3);
      cr.scrollLeft = startScroll + (targetScroll - startScroll) * eased;
      if (k < 1) {
        scrollRafRef.current = requestAnimationFrame(step);
      }
    };
    scrollRafRef.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    injectLucianElementCss(LUCIAN_NAV_STYLE_ID, LUCIAN_NAV_ELEMENTS_CSS);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    const first = !didMountRef.current;
    didMountRef.current = true;
    markChip(selectedIndex, !first);
    return () => {
      cancelAnimationFrame(scrollRafRef.current);
    };
  }, [selectedIndex, items, markChip]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    const cr = railRef.current;
    if (!cr) {
      return;
    }
    let layoutRaf = 0;
    const onResize = () => {
      cancelAnimationFrame(layoutRaf);
      layoutRaf = requestAnimationFrame(() => {
        markChip(selectedIndex, false);
      });
    };
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(onResize);
      ro.observe(cr);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', onResize);
    }
    onResize();

    return () => {
      cancelAnimationFrame(layoutRaf);
      cancelAnimationFrame(scrollRafRef.current);
      if (ro) {
        ro.disconnect();
      } else if (typeof window !== 'undefined') {
        window.removeEventListener('resize', onResize);
      }
    };
  }, [markChip, selectedIndex]);

  if (Platform.OS !== 'web') {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={nativeStyles.scenarioScroll}
      >
        {items.map((item) => {
          const selected = item.id === value;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(item.id)}
              style={[
                nativeStyles.scenarioChip,
                WEB_NO_OUTLINE,
                {
                  backgroundColor: selected
                    ? palette.pillActiveBg
                    : palette.pillIdleBg,
                  borderColor: selected
                    ? palette.pillActiveBg
                    : palette.bezelOuterBorder,
                },
              ]}
            >
              <Text
                style={[
                  nativeStyles.scenarioChipText,
                  {
                    color: selected ? palette.pillActiveInk : palette.inkPrimary,
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }

  return (
    <div className="ux u242">
      <div className="u242-cb">
        <nav
          ref={railRef}
          className="u242-cr"
          aria-label={ariaLabel}
          onKeyDown={(e) => {
            const len = items.length;
            if (len === 0) {
              return;
            }
            const nextIdx =
              e.key === 'ArrowRight'
                ? (selectedIndex + 1) % len
                : e.key === 'ArrowLeft'
                  ? (selectedIndex - 1 + len) % len
                  : e.key === 'Home'
                    ? 0
                    : e.key === 'End'
                      ? len - 1
                      : null;
            if (nextIdx !== null) {
              e.preventDefault();
              onChange(items[nextIdx].id);
              chipRefs.current[nextIdx]?.focus({ preventScroll: true });
            }
          }}
        >
          <span ref={ulRef} className="u242-ul" aria-hidden="true" />
          {items.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={item.id}
                ref={(el) => {
                  chipRefs.current[idx] = el;
                }}
                type="button"
                className="u242-ch"
                aria-current={isSelected ? 'true' : 'false'}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => onChange(item.id)}
              >
                {item.isLive ? (
                  <span className="u242-dot" aria-hidden="true" />
                ) : null}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

const nativeStyles = StyleSheet.create({
  tabShell: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    width: '100%',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  tabText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12,
  },
  cityTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
  },
  cityTriggerText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13.5,
    fontWeight: '700',
    maxWidth: 170,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 19, 32, 0.56)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    gap: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  nativeGpsRow: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  nativeGpsText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  nativeCityOption: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
  },
  nativeCityOptionSelected: {
    backgroundColor: '#185ADB',
  },
  nativeCityName: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0F172A',
  },
  pillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillBtn: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '700',
  },
  scenarioScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  scenarioChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  scenarioChipText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    fontWeight: '600',
  },
});

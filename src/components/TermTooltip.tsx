import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Info } from './AppIcons';
import {
  FONT_FAMILY_SANS,
  sanitizeCopy,
  WEB_NO_OUTLINE,
  type AtmosphericPalette,
} from './themeTokens';

type CreatePortalFn = (
  children: React.ReactNode,
  container: Element
) => React.ReactPortal;

const webCreatePortal: CreatePortalFn | null = (() => {
  if (Platform.OS !== 'web') {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const domModule = require('react-dom') as {
      createPortal?: CreatePortalFn;
    };
    return typeof domModule?.createPortal === 'function'
      ? domModule.createPortal
      : null;
  } catch {
    return null;
  }
})();

export interface TermTooltipProps {
  termTitleVi: string;
  explanationVi: string;
  palette: AtmosphericPalette;
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;
  placement?: 'top' | 'bottom';
  containerStyle?: StyleProp<ViewStyle>;
}

interface FixedPopoverCoords {
  top: number;
  left: number;
  width: number;
  ready: boolean;
}

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Instant Hover + Focus + Tap Vietnamese Meteorological Explanation Popover.
 * - On Web: renders a viewport-clamped `position: fixed` floating card via `createPortal(..., document.body)`
 *   at `zIndex: 99999` so it can never be covered by sibling React Native Web `<View>` stacking contexts
 *   or clipped by parent `overflow: hidden` / `backdrop-filter` containers.
 * - On Native: opens a clean translucent fade Modal dismissing on backdrop tap.
 */
export const TermTooltip: React.FC<TermTooltipProps> = ({
  termTitleVi,
  explanationVi,
  palette,
  children,
  align = 'left',
  maxWidth = 276,
  placement = 'top',
  containerStyle,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const wrapperRef = useRef<View | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<FixedPopoverCoords>({
    top: -9999,
    left: -9999,
    width: maxWidth,
    ready: false,
  });

  const open = isHovered || isFocused || isPinned;

  const updateWebPosition = useCallback(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }
    const triggerEl = wrapperRef.current as unknown as HTMLElement | null;
    if (!triggerEl || typeof triggerEl.getBoundingClientRect !== 'function') {
      return;
    }
    const rect = triggerEl.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      return;
    }

    const vw = window.innerWidth || document.documentElement.clientWidth || 375;
    const vh = window.innerHeight || document.documentElement.clientHeight || 667;
    const edgeMargin = 12;
    const triggerGap = 8;
    const actualWidth = Math.max(180, Math.min(maxWidth, vw - edgeMargin * 2));
    const popHeight = popoverRef.current?.offsetHeight || 88;

    let idealLeft = rect.left;
    if (align === 'right') {
      idealLeft = rect.right - actualWidth;
    } else if (align === 'center') {
      idealLeft = rect.left + rect.width / 2 - actualWidth / 2;
    }
    const clampedLeft = Math.max(
      edgeMargin,
      Math.min(vw - actualWidth - edgeMargin, idealLeft)
    );

    const aboveTop = rect.top - triggerGap - popHeight;
    const belowTop = rect.bottom + triggerGap;
    let targetTop: number;

    if (placement === 'bottom') {
      if (
        belowTop + popHeight > vh - edgeMargin &&
        aboveTop >= edgeMargin
      ) {
        targetTop = aboveTop;
      } else {
        targetTop = Math.max(
          edgeMargin,
          Math.min(vh - popHeight - edgeMargin, belowTop)
        );
      }
    } else {
      if (aboveTop >= edgeMargin) {
        targetTop = aboveTop;
      } else if (belowTop + popHeight <= vh - edgeMargin) {
        targetTop = belowTop;
      } else {
        targetTop = Math.max(
          edgeMargin,
          Math.min(vh - popHeight - edgeMargin, belowTop)
        );
      }
    }

    setCoords({
      top: Math.round(targetTop),
      left: Math.round(clampedLeft),
      width: Math.round(actualWidth),
      ready: true,
    });
  }, [align, maxWidth, placement]);

  useIsomorphicLayoutEffect(() => {
    if (Platform.OS !== 'web' || !open) {
      return;
    }
    updateWebPosition();
    const rafId = requestAnimationFrame(() => {
      updateWebPosition();
    });
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [open, updateWebPosition, termTitleVi, explanationVi]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !open || typeof window === 'undefined') {
      return;
    }
    const onScrollOrResize = () => {
      updateWebPosition();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPinned(false);
        setIsHovered(false);
        setIsFocused(false);
      }
    };
    const onDocPointerDown = (e: PointerEvent) => {
      const triggerEl = wrapperRef.current as unknown as HTMLElement | null;
      const target = e.target as Node | null;
      if (triggerEl && target && !triggerEl.contains(target)) {
        setIsPinned(false);
        setIsHovered(false);
      }
    };

    window.addEventListener('scroll', onScrollOrResize, {
      capture: true,
      passive: true,
    });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onDocPointerDown);

    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onDocPointerDown);
    };
  }, [open, updateWebPosition]);

  const handleHoverIn = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleHoverOut = useCallback(() => {
    setIsHovered(false);
    setIsPinned(false);
  }, []);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    setIsPinned(false);
  }, []);

  const handlePress = useCallback(() => {
    setIsPinned((prev) => !prev);
  }, []);

  const handleDismissModal = useCallback(() => {
    setIsPinned(false);
    setIsHovered(false);
    setIsFocused(false);
  }, []);

  const cleanTitle = sanitizeCopy(termTitleVi);
  const cleanExplanation = sanitizeCopy(explanationVi);

  const popoverBg = palette.isDark ? '#0F172A' : '#FFFFFF';
  const popoverBorder = palette.isDark
    ? 'rgba(148, 163, 184, 0.36)'
    : palette.bezelOuterBorder;

  const webMouseProps =
    Platform.OS === 'web'
      ? ({
          onMouseEnter: handleHoverIn,
          onMouseLeave: handleHoverOut,
        } as Record<string, unknown>)
      : {};

  const renderWebPopoverPortal = () => {
    if (
      Platform.OS !== 'web' ||
      !open ||
      typeof document === 'undefined' ||
      !document.body
    ) {
      return null;
    }

    const portalCard = (
      <div
        ref={popoverRef}
        role="tooltip"
        aria-hidden={!open}
        style={{
          position: 'fixed',
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          width: `${coords.width}px`,
          maxWidth: 'calc(100vw - 24px)',
          zIndex: 99999,
          pointerEvents: 'none',
          backgroundColor: popoverBg,
          border: `1px solid ${popoverBorder}`,
          borderRadius: '14px',
          padding: '10px 12px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          opacity: coords.ready ? 1 : 0,
          transform: coords.ready ? 'translateY(0)' : 'translateY(3px)',
          transition:
            'opacity 80ms cubic-bezier(0.16, 1, 0.3, 1), transform 80ms cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: palette.isDark
            ? '0 16px 36px rgba(2, 6, 23, 0.68), 0 0 0 1px rgba(255, 255, 255, 0.08)'
            : '0 16px 36px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(15, 23, 42, 0.08)',
          fontFamily: FONT_FAMILY_SANS,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Info size={13.5} weight="duotone" color={palette.accent} />
          <span
            style={{
              fontFamily: FONT_FAMILY_SANS,
              fontSize: '12px',
              lineHeight: '16px',
              fontWeight: 700,
              color: palette.accent,
            }}
          >
            {cleanTitle}
          </span>
        </div>
        <span
          style={{
            fontFamily: FONT_FAMILY_SANS,
            fontSize: '11.5px',
            lineHeight: '16.5px',
            fontWeight: 500,
            color: palette.inkPrimary,
          }}
        >
          {cleanExplanation}
        </span>
      </div>
    );

    if (webCreatePortal) {
      return webCreatePortal(portalCard, document.body);
    }
    return portalCard;
  };

  return (
    <View
      ref={wrapperRef}
      style={[
        styles.wrapper,
        { zIndex: open ? 60 : 1 },
        containerStyle,
      ]}
      {...webMouseProps}
    >
      <Pressable
        onPress={handlePress}
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
        onFocus={handleFocus}
        onBlur={handleBlur}
        accessibilityRole="button"
        accessibilityLabel={`${cleanTitle}. ${cleanExplanation}`}
        style={[styles.triggerPressable, WEB_NO_OUTLINE]}
      >
        {children}
      </Pressable>

      {open ? renderWebPopoverPortal() : null}

      {Platform.OS !== 'web' && (
        <Modal
          visible={open}
          transparent
          animationType="fade"
          onRequestClose={handleDismissModal}
        >
          <Pressable
            style={styles.nativeModalBackdrop}
            onPress={handleDismissModal}
          >
            <View
              style={[
                styles.nativeModalCard,
                {
                  backgroundColor: popoverBg,
                  borderColor: popoverBorder,
                  shadowColor: palette.shadowColor,
                },
              ]}
            >
              <View style={styles.titleRow}>
                <Info size={15} weight="duotone" color={palette.accent} />
                <Text style={[styles.nativeTitleText, { color: palette.accent }]}>
                  {cleanTitle}
                </Text>
              </View>
              <Text
                style={[
                  styles.nativeExplanationText,
                  { color: palette.inkPrimary },
                ]}
              >
                {cleanExplanation}
              </Text>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    overflow: 'visible',
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  triggerPressable: {
    maxWidth: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nativeModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 14, 26, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  nativeModalCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 12,
  },
  nativeTitleText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '700',
    flexShrink: 1,
  },
  nativeExplanationText: {
    fontFamily: FONT_FAMILY_SANS,
    fontSize: 12.5,
    lineHeight: 18.5,
    fontWeight: '500',
  },
});

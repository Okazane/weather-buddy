import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';
import {
  CHARACTER_PROFILES,
  COMPANION_SPRITES,
  getCharacterSprite,
  SCENE_MOTION_PROFILES,
  SCENE_VISUAL_META,
  type CharacterSceneId,
  type Gender,
  type NpcActionId,
} from '../art/characterAssets';
import { useNpcStageController } from '../hooks/useWeatherBuddy';
import { type AtmosphericPalette } from './themeTokens';

export interface LivingCharacterRigProps {
  gender: Gender;
  sceneId: CharacterSceneId;
  palette: AtmosphericPalette;
  size: number;
  reduceMotion?: boolean;
  interactive?: boolean;
  showAmbientProps?: boolean;
  /** Enables 5-minute rotating NPC companion/idle behaviors + interactive tap reaction */
  npcMode?: boolean;
}

/**
 * Canonical 768x768 Master 3D Vinyl Landmarks
 * Locked identically across Male (Cậu bé Mây) & Female (Cô bé Nắng) and all 7 weather states.
 */
export const CANONICAL_CHIBI_LANDMARKS = {
  canvasSize: 768,
  centerX: 384,
  leftEyeX: 327,
  rightEyeX: 441,
  eyeY: 296,
  ipd: 114,
  neckY: 374,
  soleY: 692,
} as const;

interface LiveRigFrame {
  breathScaleX: number;
  breathScaleY: number;
  swayDeg: number;
  hopOffsetY: number;
  gazeX: number;
  gazeY: number;
  blinkAmount: number;
  happyBounce: number;
  sparkleProgress: number;
  petProgress: number; // 0 = offstage, 1 = seated cozily beside character
  petBobY: number;
  notePhase: number;
}

interface InternalMutableState {
  startTimeMs: number;
  lastFrameMs: number;
  gazeX: number;
  gazeY: number;
  targetGazeX: number;
  targetGazeY: number;
  pointerActiveUntilMs: number;
  nextSaccadeAtMs: number;
  saccadeX: number;
  saccadeY: number;
  nextBlinkAtMs: number;
  blinkStartMs: number;
  blinkDurationMs: number;
  pendingDoubleBlink: boolean;
  hopStartMs: number;
  sparkleStartMs: number;
  lastPointerX: number;
  strokeAccum: number;
  activePetKind: 'cat' | 'puppy' | null;
  petEnteredAtMs: number;
}

const INITIAL_FRAME: LiveRigFrame = {
  breathScaleX: 1,
  breathScaleY: 1,
  swayDeg: 0,
  hopOffsetY: 0,
  gazeX: 0,
  gazeY: 0,
  blinkAmount: 0,
  happyBounce: 0,
  sparkleProgress: -1,
  petProgress: 0,
  petBobY: 0,
  notePhase: 0,
};

export function createCanonicalChibiFrame() {
  return INITIAL_FRAME;
}

export const LivingCharacterRig: React.FC<LivingCharacterRigProps> = ({
  gender,
  sceneId,
  palette,
  size,
  reduceMotion = false,
  interactive = true,
  showAmbientProps = true,
  npcMode = false,
}) => {
  const npcStage = useNpcStageController();
  const isStanding = npcMode ? npcStage.isStanding : true;
  const npcAction: NpcActionId = npcStage.npcAction;

  const profile = CHARACTER_PROFILES[gender];
  const sceneMeta = SCENE_VISUAL_META[sceneId];
  const sceneMotion =
    SCENE_MOTION_PROFILES[sceneId] ?? SCENE_MOTION_PROFILES.pleasant_sunny;

  const spriteSource = useMemo(
    () => getCharacterSprite(gender, sceneId),
    [gender, sceneId]
  );

  const stageRef = useRef<View | null>(null);
  const propsRef = useRef({
    gender,
    sceneId,
    isStanding,
    npcAction,
    npcMode,
    reduceMotion,
    interactive,
  });
  propsRef.current = {
    gender,
    sceneId,
    isStanding,
    npcAction,
    npcMode,
    reduceMotion,
    interactive,
  };

  const nowInit = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const rigRef = useRef<InternalMutableState>({
    startTimeMs: nowInit,
    lastFrameMs: nowInit,
    gazeX: 0,
    gazeY: 0,
    targetGazeX: 0,
    targetGazeY: 0,
    pointerActiveUntilMs: 0,
    nextSaccadeAtMs: nowInit + 1300,
    saccadeX: 0,
    saccadeY: 0,
    nextBlinkAtMs: nowInit + 2500,
    blinkStartMs: -1,
    blinkDurationMs: 130,
    pendingDoubleBlink: false,
    hopStartMs: -1,
    sparkleStartMs: -1,
    lastPointerX: 0,
    strokeAccum: 0,
    activePetKind: null,
    petEnteredAtMs: nowInit,
  });

  const [frame, setFrame] = useState<LiveRigFrame>(INITIAL_FRAME);

  // Trigger joyful bounce whenever weather outfit changes or user taps character
  const prevSceneRef = useRef<CharacterSceneId>(sceneId);
  const prevGenderRef = useRef<Gender>(gender);
  const prevTriggerRef = useRef<number>(npcStage.standTriggerCount);

  useEffect(() => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const changed =
      prevSceneRef.current !== sceneId ||
      prevGenderRef.current !== gender ||
      prevTriggerRef.current !== npcStage.standTriggerCount;
    prevSceneRef.current = sceneId;
    prevGenderRef.current = gender;
    prevTriggerRef.current = npcStage.standTriggerCount;

    if (changed && !reduceMotion) {
      const st = rigRef.current;
      st.hopStartMs = now;
      st.sparkleStartMs = now;
    }
  }, [sceneId, gender, npcStage.standTriggerCount, reduceMotion]);

  // Track 3D companion arrival when 5-minute NPC mode enters petting_cat or petting_puppy
  useEffect(() => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const st = rigRef.current;
    const wantedPet =
      npcMode && !isStanding
        ? npcAction === 'petting_cat'
          ? 'cat'
          : npcAction === 'petting_puppy'
            ? 'puppy'
            : null
        : null;
    if (st.activePetKind !== wantedPet) {
      st.activePetKind = wantedPet;
      st.petEnteredAtMs = now;
    }
  }, [npcMode, isStanding, npcAction]);

  // Global cursor eye-tracking on Web so living eyes smoothly follow the user's pointer
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || reduceMotion || !interactive) {
      return;
    }

    const onWinMove = (evt: PointerEvent) => {
      const node = stageRef.current as unknown as HTMLElement | null;
      if (!node || typeof node.getBoundingClientRect !== 'function') {
        return;
      }
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }
      const eyeCenterX = rect.left + rect.width * 0.5;
      const eyeCenterY = rect.top + rect.height * (CANONICAL_CHIBI_LANDMARKS.eyeY / 768);
      const dx = (evt.clientX - eyeCenterX) / (rect.width * 0.72);
      const dy = (evt.clientY - eyeCenterY) / (rect.height * 0.72);

      if (Math.abs(dx) <= 2.6 && Math.abs(dy) <= 2.4) {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const st = rigRef.current;
        st.targetGazeX = Math.max(-1, Math.min(1, dx));
        st.targetGazeY = Math.max(-1, Math.min(1, dy));
        st.pointerActiveUntilMs = now + 2600;
      }
    };

    window.addEventListener('pointermove', onWinMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onWinMove);
    };
  }, [reduceMotion, interactive]);

  // 60fps Live 2.5D Vinyl Animation Loop
  useEffect(() => {
    if (reduceMotion) {
      setFrame(INITIAL_FRAME);
      return;
    }

    let rafId: number | null = null;
    let mounted = true;

    const tick = (nowMs: number) => {
      if (!mounted) {
        return;
      }

      const st = rigRef.current;
      const p = propsRef.current;
      const dtSec = Math.min(0.064, Math.max(0.004, (nowMs - st.lastFrameMs) / 1000));
      st.lastFrameMs = nowMs;
      const elapsedSec = (nowMs - st.startTimeMs) / 1000;

      // 1. Natural autonomous blinking (130ms smooth close-open, occasional double blink)
      if (st.blinkStartMs < 0 && nowMs >= st.nextBlinkAtMs) {
        st.blinkStartMs = nowMs;
        st.blinkDurationMs = 132;
        st.pendingDoubleBlink = !st.pendingDoubleBlink && Math.random() < 0.2;
      }

      let blinkAmount = 0;
      if (st.blinkStartMs >= 0) {
        const bt = (nowMs - st.blinkStartMs) / st.blinkDurationMs;
        if (bt >= 1) {
          st.blinkStartMs = -1;
          st.nextBlinkAtMs = st.pendingDoubleBlink
            ? nowMs + 90
            : nowMs + 2600 + Math.random() * 2800;
        } else {
          blinkAmount = Math.sin(bt * Math.PI);
        }
      }

      // 2. Living eye saccades when pointer is idle
      const inNpcIdle = p.npcMode && !p.isStanding;
      if (nowMs > st.pointerActiveUntilMs) {
        if (nowMs >= st.nextSaccadeAtMs) {
          if (inNpcIdle && p.npcAction === 'petting_cat') {
            const glanceUser = Math.random() < 0.28;
            st.saccadeX = glanceUser ? 0.05 : 0.62 + Math.random() * 0.16;
            st.saccadeY = glanceUser ? 0 : 0.56 + Math.random() * 0.14;
            st.nextSaccadeAtMs = nowMs + 1200 + Math.random() * 1400;
          } else if (inNpcIdle && p.npcAction === 'petting_puppy') {
            const glanceUser = Math.random() < 0.28;
            st.saccadeX = glanceUser ? -0.05 : -0.62 - Math.random() * 0.16;
            st.saccadeY = glanceUser ? 0 : 0.56 + Math.random() * 0.14;
            st.nextSaccadeAtMs = nowMs + 1200 + Math.random() * 1400;
          } else if (inNpcIdle && p.npcAction === 'reading_book') {
            const glanceUp = Math.random() < 0.25;
            st.saccadeX = glanceUp ? 0 : (Math.random() - 0.5) * 0.72;
            st.saccadeY = glanceUp ? -0.04 : 0.42 + Math.random() * 0.12;
            st.nextSaccadeAtMs = nowMs + (glanceUp ? 1100 : 750 + Math.random() * 800);
          } else if (inNpcIdle && p.npcAction === 'scrolling_phone') {
            const peekUp = Math.random() < 0.26;
            st.saccadeX = peekUp ? 0 : (Math.random() - 0.5) * 0.28;
            st.saccadeY = peekUp ? -0.04 : 0.45 + Math.random() * 0.12;
            st.nextSaccadeAtMs = nowMs + (peekUp ? 1150 : 850 + Math.random() * 950);
          } else if (inNpcIdle && p.npcAction === 'listening_music') {
            st.saccadeX = Math.sin(elapsedSec * 1.2) * 0.45;
            st.saccadeY = -0.08 + Math.cos(elapsedSec * 0.9) * 0.14;
            st.nextSaccadeAtMs = nowMs + 950;
          } else {
            const lookSky =
              (p.sceneId === 'light_rain_umbrella' || p.sceneId === 'storm_raincoat') &&
              Math.random() < 0.4;
            st.saccadeX = (Math.random() - 0.5) * 0.62;
            st.saccadeY = lookSky ? -0.36 : (Math.random() - 0.5) * 0.3;
            st.nextSaccadeAtMs = nowMs + 1500 + Math.random() * 1900;
          }
        }
        st.targetGazeX = st.saccadeX;
        st.targetGazeY = st.saccadeY;
      }

      const gazeLerp = Math.min(1, dtSec * 10.5);
      st.gazeX += (st.targetGazeX - st.gazeX) * gazeLerp;
      st.gazeY += (st.targetGazeY - st.gazeY) * gazeLerp;

      // 3. Volume-preserving 2.5D breathing + gentle natural sway (foot-anchored!)
      const breathWave = (Math.sin(elapsedSec * 2.15) + 1) * 0.5; // 0..1
      const breathScaleY = 1 + breathWave * 0.022;
      const breathScaleX = 1 - breathWave * 0.011;

      let swayDeg = Math.sin(elapsedSec * 1.35) * 1.45 + st.gazeX * 1.15;
      if (inNpcIdle && p.npcAction === 'listening_music') {
        swayDeg = Math.sin(elapsedSec * 3.1) * 2.65 + st.gazeX * 0.9;
      } else if (inNpcIdle && p.npcAction === 'petting_cat') {
        swayDeg = 1.6 + Math.sin(elapsedSec * 1.8) * 1.1;
      } else if (inNpcIdle && p.npcAction === 'petting_puppy') {
        swayDeg = -1.6 + Math.sin(elapsedSec * 1.8) * 1.1;
      } else if (p.sceneId === 'storm_raincoat') {
        swayDeg = -2.1 + Math.sin(elapsedSec * 2.6) * 2.2;
      } else if (p.sceneId === 'freezing_puffer') {
        swayDeg = Math.sin(elapsedSec * 1.5) * 1.1 + Math.sin(elapsedSec * 17) * 0.28;
      }

      // 4. Interactive Hop & Sparkle Burst
      let hopOffsetY = 0;
      let happyBounce = 0;
      if (st.hopStartMs >= 0) {
        const ht = (nowMs - st.hopStartMs) / 460;
        if (ht >= 1) {
          st.hopStartMs = -1;
        } else {
          hopOffsetY = -Math.sin(ht * Math.PI) * 13 * (1 - ht * 0.3);
          happyBounce = Math.sin(ht * Math.PI);
        }
      }

      let sparkleProgress = -1;
      if (st.sparkleStartMs >= 0) {
        const sp = (nowMs - st.sparkleStartMs) / 950;
        if (sp >= 1) {
          st.sparkleStartMs = -1;
        } else {
          sparkleProgress = sp;
        }
      }

      // 5. 3D Companion Pet Trot-In & Happy Bobbing
      let petProgress = 0;
      let petBobY = 0;
      if (st.activePetKind !== null) {
        const walkT = Math.min(1, Math.max(0, (nowMs - st.petEnteredAtMs) / 1550));
        petProgress = 1 - Math.pow(1 - walkT, 2.6);
        if (walkT < 0.98) {
          petBobY = -Math.abs(Math.sin(elapsedSec * 9.5)) * 5.5;
        } else {
          petBobY = Math.sin(elapsedSec * 2.9) * 1.8;
        }
      }

      setFrame({
        breathScaleX,
        breathScaleY,
        swayDeg,
        hopOffsetY,
        gazeX: st.gazeX,
        gazeY: st.gazeY,
        blinkAmount,
        happyBounce,
        sparkleProgress,
        petProgress,
        petBobY,
        notePhase: elapsedSec,
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [reduceMotion]);

  const handleCharacterPress = useCallback(() => {
    if (!interactive) {
      return;
    }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const st = rigRef.current;
    st.hopStartMs = now;
    st.sparkleStartMs = now;
    if (npcMode) {
      npcStage.interactWithCharacter();
    }
  }, [interactive, npcMode, npcStage]);

  const webPointerHandlers = useMemo(() => {
    if (Platform.OS !== 'web' || !interactive || reduceMotion) {
      return {};
    }
    return {
      onPointerMove: (evt: any) => {
        const target = evt?.currentTarget;
        const nativeEvt = evt?.nativeEvent ?? evt;
        if (!target || typeof target.getBoundingClientRect !== 'function') {
          return;
        }
        const rect = target.getBoundingClientRect();
        if (!rect.width || !rect.height) {
          return;
        }
        const cx = nativeEvt.clientX ?? rect.left + rect.width / 2;
        const cy = nativeEvt.clientY ?? rect.top + rect.height * 0.385;
        const nx = Math.max(-1, Math.min(1, ((cx - rect.left) / rect.width - 0.5) * 2.1));
        const ny = Math.max(-1, Math.min(1, ((cy - rect.top) / rect.height - 0.385) * 2.2));

        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const st = rigRef.current;
        st.targetGazeX = nx;
        st.targetGazeY = ny;
        st.pointerActiveUntilMs = now + 2600;

        // Head-petting stroke detector triggers sparkle joy
        if (ny < 0.02 && Math.abs(nx) < 0.52) {
          const deltaX = Math.abs(nx - st.lastPointerX);
          st.strokeAccum = Math.min(2.5, st.strokeAccum + deltaX);
          if (st.strokeAccum > 0.9) {
            st.sparkleStartMs = now;
            st.strokeAccum = 0;
          }
        } else {
          st.strokeAccum *= 0.86;
        }
        st.lastPointerX = nx;
      },
      onPointerLeave: () => {
        rigRef.current.pointerActiveUntilMs = 0;
      },
    };
  }, [interactive, reduceMotion]);

  const auraColor = palette.isDark
    ? sceneMotion.auraTintDark
    : sceneMotion.auraTintLight;

  const isWearingSunglasses = sceneId === 'hot_sunny';
  const showCat = npcMode && !isStanding && npcAction === 'petting_cat';
  const showPuppy = npcMode && !isStanding && npcAction === 'petting_puppy';
  const showMusicNotes = npcMode && !isStanding && npcAction === 'listening_music';

  // Foot-anchored pivot approximation (sole Y = 692 on 768 canvas -> +40% below center)
  const pivotOffsetY = size * 0.4;
  const charTransform = [
    { translateY: frame.hopOffsetY + pivotOffsetY },
    { rotate: `${frame.swayDeg.toFixed(2)}deg` },
    { scaleX: frame.breathScaleX },
    { scaleY: frame.breathScaleY },
    { translateY: -pivotOffsetY },
  ];

  // Live 3D eye gaze shift inside 768x768 coordinate space
  const gazeShiftX = frame.gazeX * 5.6;
  const gazeShiftY = frame.gazeY * 4.4;
  const eyelidCoverR = 23 * frame.blinkAmount;

  const petSize = Math.round(size * 0.28);
  const solePx = Math.round(size * (CANONICAL_CHIBI_LANDMARKS.soleY / 768));

  return (
    <View style={styles.rigOuterStack}>
      <View
        ref={stageRef}
        style={[styles.rigCanvas, { width: size * 1.08, height: size }]}
      >
        {/* Soft Atmospheric Backlight Halo */}
        <View
          pointerEvents="none"
          style={[
            styles.auraOrb,
            {
              width: size * 0.82,
              height: size * 0.82,
              borderRadius: size * 0.41,
              backgroundColor: auraColor,
              opacity: 0.62,
              transform: [
                { translateX: -frame.gazeX * 3.5 },
                { translateY: -frame.gazeY * 2.5 },
                { scale: frame.breathScaleY },
              ],
            },
          ]}
        />

        {/* Subtle Daytime / Starlight Rim Ring */}
        {showAmbientProps &&
          (sceneMotion.ambientProp === 'sun_halo' ||
            sceneMotion.ambientProp === 'heat_shimmer' ||
            sceneMotion.ambientProp === 'starlight_aura') && (
            <View
              pointerEvents="none"
              style={[
                styles.ambientRing,
                {
                  width: size * 0.9,
                  height: size * 0.9,
                  borderRadius: size * 0.45,
                  borderColor:
                    sceneMotion.ambientProp === 'starlight_aura'
                      ? 'rgba(147, 197, 253, 0.22)'
                      : sceneMotion.ambientProp === 'heat_shimmer'
                        ? 'rgba(251, 146, 60, 0.28)'
                        : 'rgba(251, 191, 36, 0.25)',
                },
              ]}
            />
          )}

        {/* Grounded Elliptical Contact Shadow right beneath Sole Y = 692 */}
        <View
          pointerEvents="none"
          style={[
            styles.contactShadow,
            {
              width: size * 0.42,
              height: size * 0.068,
              borderRadius: size * 0.21,
              top: solePx - size * 0.026,
              backgroundColor: palette.isDark
                ? 'rgba(2, 6, 23, 0.56)'
                : 'rgba(15, 23, 42, 0.14)',
              transform: [
                { scaleX: (1 - Math.abs(frame.hopOffsetY) * 0.014) * frame.breathScaleX },
              ],
            },
          ]}
        />

        {/* Interactive 3D Pop Mart Vinyl Character + Synchronized 2.5D Live Eye Gaze & Blinking */}
        <Pressable
          disabled={!interactive}
          onPress={handleCharacterPress}
          accessibilityRole={interactive ? 'button' : 'image'}
          accessibilityLabel={`${profile?.nameVi ?? gender} · ${sceneMeta?.labelVi ?? sceneId}`}
          {...(webPointerHandlers as object)}
          style={[
            styles.pressableStage,
            { width: size, height: size },
            Platform.OS === 'web'
              ? ({
                  outlineStyle: 'none',
                  cursor: interactive ? 'pointer' : 'default',
                  WebkitTapHighlightColor: 'transparent',
                } as any)
              : null,
          ]}
        >
          <View
            style={[
              styles.characterTransformGroup,
              {
                width: size,
                height: size,
                transform: charTransform as any,
              },
            ]}
          >
            <Image
              source={spriteSource}
              resizeMode="contain"
              style={{ width: size, height: size }}
            />

            {/* Sub-pixel Locked 2.5D Live Eye Catchlights & 3D Eyelid Blink Overlay (768x768 space) */}
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { width: size, height: size }]}
            >
              <Svg width={size} height={size} viewBox="0 0 768 768">
                <Defs>
                  <LinearGradient id="wbSkinLid" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor="#F5C3AC" stopOpacity="0.98" />
                    <Stop offset="100%" stopColor="#FAD6C4" stopOpacity="0.98" />
                  </LinearGradient>
                </Defs>

                {!isWearingSunglasses ? (
                  <G>
                    {/* Live Moving Glossy Specular Catchlights inside Left (327,296) & Right (441,296) 3D Irises */}
                    {frame.blinkAmount < 0.72 && (
                      <G>
                        {/* Soft espresso mask over static studio dot so the catchlight genuinely moves with gaze */}
                        <Circle cx={320} cy={289} r={9.5} fill="#2A150E" opacity={0.76} />
                        <Circle cx={434} cy={289} r={9.5} fill="#2A150E" opacity={0.76} />

                        {/* Primary glossy Pixar specular catchlight following cursor / pet / book */}
                        <Circle
                          cx={321 + gazeShiftX}
                          cy={289 + gazeShiftY}
                          r={7.4}
                          fill="#FFFFFF"
                          opacity={0.96}
                        />
                        <Circle
                          cx={435 + gazeShiftX}
                          cy={289 + gazeShiftY}
                          r={7.4}
                          fill="#FFFFFF"
                          opacity={0.96}
                        />

                        {/* Secondary micro rim sparkle */}
                        <Circle
                          cx={334 + gazeShiftX * 0.65}
                          cy={304 + gazeShiftY * 0.65}
                          r={3.1}
                          fill="#FFF7ED"
                          opacity={0.82}
                        />
                        <Circle
                          cx={448 + gazeShiftX * 0.65}
                          cy={304 + gazeShiftY * 0.65}
                          r={3.1}
                          fill="#FFF7ED"
                          opacity={0.82}
                        />
                      </G>
                    )}

                    {/* Natural 3D Smooth Blinking Eyelids */}
                    {frame.blinkAmount > 0.06 && (
                      <G>
                        <Ellipse
                          cx={327}
                          cy={295 - (1 - frame.blinkAmount) * 14}
                          rx={25}
                          ry={eyelidCoverR}
                          fill="url(#wbSkinLid)"
                        />
                        <Ellipse
                          cx={441}
                          cy={295 - (1 - frame.blinkAmount) * 14}
                          rx={25}
                          ry={eyelidCoverR}
                          fill="url(#wbSkinLid)"
                        />
                        {frame.blinkAmount > 0.55 && (
                          <G>
                            <Path
                              d="M 303 299 Q 327 310 351 299"
                              stroke="#432015"
                              strokeWidth={4.5}
                              strokeLinecap="round"
                              fill="none"
                            />
                            <Path
                              d="M 417 299 Q 441 310 465 299"
                              stroke="#432015"
                              strokeWidth={4.5}
                              strokeLinecap="round"
                              fill="none"
                            />
                          </G>
                        )}
                      </G>
                    )}
                  </G>
                ) : (
                  /* Subtle Moving Specular Sun Glint on Hot Sunny Sunglasses Lenses */
                  <G opacity={0.55}>
                    <Ellipse
                      cx={316 + gazeShiftX * 1.2}
                      cy={284 + gazeShiftY * 0.9}
                      rx={10}
                      ry={5.5}
                      transform={`rotate(-22 ${316 + gazeShiftX * 1.2} ${284 + gazeShiftY * 0.9})`}
                      fill="#FFFFFF"
                    />
                    <Ellipse
                      cx={430 + gazeShiftX * 1.2}
                      cy={284 + gazeShiftY * 0.9}
                      rx={10}
                      ry={5.5}
                      transform={`rotate(-22 ${430 + gazeShiftX * 1.2} ${284 + gazeShiftY * 0.9})`}
                      fill="#FFFFFF"
                    />
                  </G>
                )}

                {/* Subtle Floating Musical Notes during 5-minute `listening_music` NPC rotation */}
                {showMusicNotes && (
                  <G opacity={0.85}>
                    <Circle
                      cx={236 + Math.sin(frame.notePhase * 2.2) * 10}
                      cy={235 - ((frame.notePhase * 26) % 55)}
                      r={6.5}
                      fill={palette.accent}
                    />
                    <Circle
                      cx={532 + Math.cos(frame.notePhase * 2.0) * 10}
                      cy={225 - (((frame.notePhase * 26) + 28) % 55)}
                      r={6.5}
                      fill="#F472B6"
                    />
                  </G>
                )}

                {/* Interactive Tap / Petting Joyful Sparkle Hearts */}
                {frame.sparkleProgress >= 0 && (
                  <G opacity={Math.max(0, 1 - frame.sparkleProgress)}>
                    <Path
                      d={`M 248 ${210 - frame.sparkleProgress * 36} C 248 201, 235 201, 235 210 C 235 219, 248 226, 248 231 C 248 226, 261 219, 261 210 C 261 201, 248 201, 248 ${210 - frame.sparkleProgress * 36} Z`}
                      fill="#FB7185"
                    />
                    <Circle
                      cx={526 + frame.sparkleProgress * 18}
                      cy={196 - frame.sparkleProgress * 34}
                      r={6.5}
                      fill="#FBBF24"
                    />
                  </G>
                )}
              </Svg>
            </View>
          </View>

          {/* 3D Pop Mart Ginger Kitten Trotting In Beside Character (`petting_cat`) */}
          {showCat && (
            <View
              pointerEvents="none"
              style={[
                styles.companionWrap,
                {
                  width: petSize,
                  height: petSize,
                  top: solePx - petSize + Math.round(petSize * 0.05),
                  left:
                    size * 0.62 +
                    (1 - frame.petProgress) * (size * 0.34),
                  opacity: Math.min(1, frame.petProgress * 1.4),
                  transform: [{ translateY: frame.petBobY }],
                },
              ]}
            >
              <Image
                source={COMPANION_SPRITES.cat}
                resizeMode="contain"
                style={{ width: petSize, height: petSize }}
              />
            </View>
          )}

          {/* 3D Pop Mart Corgi Puppy Trotting In Beside Character (`petting_puppy`) */}
          {showPuppy && (
            <View
              pointerEvents="none"
              style={[
                styles.companionWrap,
                {
                  width: petSize,
                  height: petSize,
                  top: solePx - petSize + Math.round(petSize * 0.05),
                  left:
                    size * 0.1 -
                    (1 - frame.petProgress) * (size * 0.34),
                  opacity: Math.min(1, frame.petProgress * 1.4),
                  transform: [{ translateY: frame.petBobY }],
                },
              ]}
            >
              <Image
                source={COMPANION_SPRITES.puppy}
                resizeMode="contain"
                style={{ width: petSize, height: petSize }}
              />
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  rigOuterStack: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rigCanvas: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  auraOrb: {
    position: 'absolute',
  },
  ambientRing: {
    position: 'absolute',
    borderWidth: 1,
  },
  contactShadow: {
    position: 'absolute',
  },
  pressableStage: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  characterTransformGroup: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  companionWrap: {
    position: 'absolute',
  },
});

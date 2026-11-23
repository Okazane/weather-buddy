import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { NPC_ACTION_META } from '../core';
import {
  CHARACTER_PROFILES,
  CHARACTER_SPRITES,
  NPC_SPRITES,
  SCENE_MOTION_PROFILES,
  SCENE_VISUAL_META,
  type CharacterSceneId,
  type Gender,
  type NpcActionId,
  type TapBurstKind,
} from '../art/characterAssets';
import { useNpcStageController } from '../hooks/useWeatherBuddy';
import {
  WEB_NO_OUTLINE,
  type AtmosphericPalette,
} from './themeTokens';

export interface LivingCharacterRigProps {
  gender: Gender;
  sceneId: CharacterSceneId;
  palette: AtmosphericPalette;
  size: number;
  reduceMotion?: boolean;
  interactive?: boolean;
  showAmbientProps?: boolean;
  /** Enables cozy Chibi NPC idle mode (5 actions rotating every 5m) + stand-up-on-tap */
  npcMode?: boolean;
}

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

interface NpcMotionSpec {
  breathScaleY: number;
  breathScaleX: number;
  inhaleMs: number;
  exhaleMs: number;
  rotateMinDeg: number;
  rotateMaxDeg: number;
  swayMs: number;
  anchorRatio: number;
}

const NPC_MOTION_SPECS: Record<NpcActionId, NpcMotionSpec> = {
  reading_book: {
    breathScaleY: 1.018,
    breathScaleX: 0.991,
    inhaleMs: 2400,
    exhaleMs: 3000,
    rotateMinDeg: -0.9,
    rotateMaxDeg: 1.2,
    swayMs: 3600,
    anchorRatio: 0.34,
  },
  petting_cat: {
    breathScaleY: 1.024,
    breathScaleX: 0.988,
    inhaleMs: 2050,
    exhaleMs: 2500,
    rotateMinDeg: -1.6,
    rotateMaxDeg: 1.8,
    swayMs: 2900,
    anchorRatio: 0.36,
  },
  petting_puppy: {
    breathScaleY: 1.026,
    breathScaleX: 0.987,
    inhaleMs: 1900,
    exhaleMs: 2350,
    rotateMinDeg: -1.8,
    rotateMaxDeg: 2.0,
    swayMs: 2650,
    anchorRatio: 0.36,
  },
  scrolling_phone: {
    breathScaleY: 1.019,
    breathScaleX: 0.991,
    inhaleMs: 2350,
    exhaleMs: 2950,
    rotateMinDeg: -1.1,
    rotateMaxDeg: 1.1,
    swayMs: 3800,
    anchorRatio: 0.34,
  },
  listening_music: {
    breathScaleY: 1.025,
    breathScaleX: 0.988,
    inhaleMs: 1650,
    exhaleMs: 1950,
    rotateMinDeg: -2.4,
    rotateMaxDeg: 2.4,
    swayMs: 1050,
    anchorRatio: 0.36,
  },
};

interface BurstParticleSpec {
  id: string;
  dx: number;
  dy: number;
  startX: number;
  startY: number;
  scalePeak: number;
  rotateDeg: string;
  isSecondary?: boolean;
}

const BURST_SPECS: readonly BurstParticleSpec[] = [
  {
    id: 'p0',
    startX: -32,
    startY: -20,
    dx: -34,
    dy: -42,
    scalePeak: 1.1,
    rotateDeg: '-18deg',
  },
  {
    id: 'p1',
    startX: -12,
    startY: -40,
    dx: -14,
    dy: -50,
    scalePeak: 0.92,
    rotateDeg: '14deg',
    isSecondary: true,
  },
  {
    id: 'p2',
    startX: 16,
    startY: -38,
    dx: 18,
    dy: -48,
    scalePeak: 1.06,
    rotateDeg: '-12deg',
  },
  {
    id: 'p3',
    startX: 34,
    startY: -18,
    dx: 36,
    dy: -38,
    scalePeak: 0.9,
    rotateDeg: '22deg',
    isSecondary: true,
  },
];

function resolveBurstIcon(kind: TapBurstKind): React.ComponentProps<typeof Feather>['name'] {
  switch (kind) {
    case 'sunbeam':
      return 'sun';
    case 'droplet':
      return 'droplet';
    case 'snowflake':
      return 'wind';
    case 'sparkle':
    default:
      return 'star';
  }
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
  const npcAction = npcStage.npcAction;

  const standingSprite = CHARACTER_SPRITES[gender]?.[sceneId];
  const npcSprite = NPC_SPRITES[gender]?.[npcAction];
  const profile = CHARACTER_PROFILES[gender];
  const sceneMeta = SCENE_VISUAL_META[sceneId];
  const sceneMotion =
    SCENE_MOTION_PROFILES[sceneId] ?? SCENE_MOTION_PROFILES.pleasant_sunny;
  const npcMotion = NPC_MOTION_SPECS[npcAction] ?? NPC_MOTION_SPECS.reading_book;

  // --- 1. Continuous Rig Channels (GPU-only transform + opacity) ---
  const breathAnim = useRef(new Animated.Value(0)).current;
  const swayAnim = useRef(new Animated.Value(0)).current;
  const shiverAnim = useRef(new Animated.Value(0)).current;
  const npcNodAnim = useRef(new Animated.Value(0)).current;
  const auraPulseAnim = useRef(new Animated.Value(0)).current;
  const ambientClockA = useRef(new Animated.Value(0)).current;
  const ambientClockB = useRef(new Animated.Value(0)).current;
  const ambientClockC = useRef(new Animated.Value(0)).current;

  // --- 2. Posture Crossfade (0 = NPC Idle, 1 = Standing Weather Pose) ---
  const postureBlend = useRef(new Animated.Value(isStanding ? 1 : 0)).current;
  const prevStandingRef = useRef<boolean>(isStanding);
  const prevNpcActionRef = useRef<NpcActionId>(npcAction);

  // --- 3. Scene / Gender / NPC Switch Entrance Crossfade + Spring ---
  const entranceScale = useRef(new Animated.Value(1)).current;
  const entranceOpacity = useRef(new Animated.Value(1)).current;
  const isFirstMount = useRef(true);

  // --- 4. Stand-Up / Settle-Down / Hop Squash & Stretch + Burst ---
  const tapTranslateY = useRef(new Animated.Value(0)).current;
  const tapScaleX = useRef(new Animated.Value(1)).current;
  const tapScaleY = useRef(new Animated.Value(1)).current;
  const tapRotate = useRef(new Animated.Value(0)).current;
  const tapShadowLift = useRef(new Animated.Value(0)).current;
  const burstProgress = useRef(new Animated.Value(0)).current;
  const tapCountRef = useRef(0);

  // --- 5. Web 2.5D Pointer Parallax ---
  const pointerX = useRef(new Animated.Value(0)).current;
  const pointerY = useRef(new Animated.Value(0)).current;

  // Gender / Scene / Shuffled NPC Action subtle pop transition
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      prevNpcActionRef.current = npcAction;
      return;
    }

    const actionChangedWhileIdle =
      npcMode && !isStanding && prevNpcActionRef.current !== npcAction;
    prevNpcActionRef.current = npcAction;

    if (reduceMotion) {
      entranceOpacity.setValue(1);
      entranceScale.setValue(1);
      return;
    }

    entranceOpacity.setValue(actionChangedWhileIdle ? 0.48 : 0.42);
    entranceScale.setValue(actionChangedWhileIdle ? 0.95 : 0.93);

    Animated.parallel([
      Animated.timing(entranceOpacity, {
        toValue: 1,
        duration: 185,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.spring(entranceScale, {
        toValue: 1,
        tension: 145,
        friction: 8,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [gender, sceneId, npcAction, npcMode, isStanding, reduceMotion, entranceOpacity, entranceScale]);

  // Posture transition when `isStanding` changes (including automatic 8.5s settle-down!)
  useEffect(() => {
    if (!npcMode) {
      postureBlend.setValue(1);
      prevStandingRef.current = true;
      return;
    }

    const wasStanding = prevStandingRef.current;
    prevStandingRef.current = isStanding;

    if (wasStanding === isStanding) {
      return;
    }

    postureBlend.stopAnimation();

    if (isStanding) {
      // Crossfade into standing weather outfit right after the 90ms anticipation dip
      if (reduceMotion) {
        postureBlend.setValue(1);
      } else {
        Animated.sequence([
          Animated.delay(75),
          Animated.timing(postureBlend, {
            toValue: 1,
            duration: 165,
            easing: Easing.out(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]).start();
      }
    } else {
      // Smoothly crossfade & settle back down (translateY: 0 -> +4 -> 0) into NPC Idle mode after 8.5s
      if (reduceMotion) {
        postureBlend.setValue(0);
      } else {
        tapTranslateY.stopAnimation();
        tapScaleX.stopAnimation();
        tapScaleY.stopAnimation();

        Animated.parallel([
          Animated.timing(postureBlend, {
            toValue: 0,
            duration: 240,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.sequence([
            Animated.parallel([
              Animated.timing(tapTranslateY, {
                toValue: 4,
                duration: 130,
                easing: Easing.out(Easing.quad),
                useNativeDriver: USE_NATIVE_DRIVER,
              }),
              Animated.timing(tapScaleX, {
                toValue: 1.03,
                duration: 130,
                easing: Easing.out(Easing.quad),
                useNativeDriver: USE_NATIVE_DRIVER,
              }),
              Animated.timing(tapScaleY, {
                toValue: 0.97,
                duration: 130,
                easing: Easing.out(Easing.quad),
                useNativeDriver: USE_NATIVE_DRIVER,
              }),
            ]),
            Animated.parallel([
              Animated.spring(tapTranslateY, {
                toValue: 0,
                tension: 150,
                friction: 10,
                useNativeDriver: USE_NATIVE_DRIVER,
              }),
              Animated.spring(tapScaleX, {
                toValue: 1,
                tension: 150,
                friction: 10,
                useNativeDriver: USE_NATIVE_DRIVER,
              }),
              Animated.spring(tapScaleY, {
                toValue: 1,
                tension: 150,
                friction: 10,
                useNativeDriver: USE_NATIVE_DRIVER,
              }),
            ]),
          ]),
        ]).start();
      }
    }
  }, [
    isStanding,
    npcMode,
    reduceMotion,
    postureBlend,
    tapTranslateY,
    tapScaleX,
    tapScaleY,
  ]);

  // Continuous Organic Breathing + NPC / Weather Choreography + Ambient Micro-Props
  useEffect(() => {
    breathAnim.stopAnimation();
    swayAnim.stopAnimation();
    shiverAnim.stopAnimation();
    npcNodAnim.stopAnimation();
    auraPulseAnim.stopAnimation();
    ambientClockA.stopAnimation();
    ambientClockB.stopAnimation();
    ambientClockC.stopAnimation();

    if (reduceMotion) {
      breathAnim.setValue(0);
      swayAnim.setValue(0);
      shiverAnim.setValue(0);
      npcNodAnim.setValue(0);
      auraPulseAnim.setValue(0.35);
      ambientClockA.setValue(0.4);
      ambientClockB.setValue(0.7);
      ambientClockC.setValue(0.2);
      return;
    }

    const activeInhaleMs = isStanding ? sceneMotion.inhaleDurationMs : npcMotion.inhaleMs;
    const activeExhaleMs = isStanding ? sceneMotion.exhaleDurationMs : npcMotion.exhaleMs;
    const activeSwayMs = isStanding ? sceneMotion.swayDurationMs : npcMotion.swayMs;

    // A. Volume-preserving asymmetric breath
    breathAnim.setValue(0);
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, {
          toValue: 1,
          duration: activeInhaleMs,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(breathAnim, {
          toValue: 0,
          duration: activeExhaleMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );
    breathLoop.start();

    // B. Posture sway (NPC action rhythm vs Standing weather motion)
    swayAnim.setValue(0);
    shiverAnim.setValue(0);
    npcNodAnim.setValue(0);

    let swayLoop: Animated.CompositeAnimation | null = null;
    let shiverLoop: Animated.CompositeAnimation | null = null;
    let nodLoop: Animated.CompositeAnimation | null = null;

    if (!isStanding && npcMode) {
      if (npcAction === 'listening_music') {
        // Rhythmic 2-beat head/body sway (±2.4deg)
        swayLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(swayAnim, {
              toValue: 1,
              duration: activeSwayMs,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(swayAnim, {
              toValue: -1,
              duration: activeSwayMs,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ])
        );
        swayLoop.start();
      } else {
        swayLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(swayAnim, {
              toValue: 1,
              duration: activeSwayMs,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(swayAnim, {
              toValue: -1,
              duration: Math.round(activeSwayMs * 1.06),
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(swayAnim, {
              toValue: 0,
              duration: Math.round(activeSwayMs * 0.6),
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ])
        );
        swayLoop.start();
      }

      if (npcAction === 'reading_book') {
        // Calm seated gentle head/page nod rhythm
        nodLoop = Animated.loop(
          Animated.sequence([
            Animated.delay(1400),
            Animated.timing(npcNodAnim, {
              toValue: 1,
              duration: 520,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(npcNodAnim, {
              toValue: 0,
              duration: 640,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.delay(1600),
          ])
        );
        nodLoop.start();
      } else if (npcAction === 'petting_cat' || npcAction === 'petting_puppy') {
        // Gentle crouched patting rhythm
        nodLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(npcNodAnim, {
              toValue: 1,
              duration: 460,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(npcNodAnim, {
              toValue: 0,
              duration: 460,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(npcNodAnim, {
              toValue: 0.85,
              duration: 440,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(npcNodAnim, {
              toValue: 0,
              duration: 520,
              easing: Easing.out(Easing.quad),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.delay(950),
          ])
        );
        nodLoop.start();
      }
    } else if (sceneMotion.mode === 'wind_gust') {
      swayLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(swayAnim, {
            toValue: 0.9,
            duration: 650,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(swayAnim, {
            toValue: 0.62,
            duration: 280,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(swayAnim, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(swayAnim, {
            toValue: -0.22,
            duration: 1450,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(swayAnim, {
            toValue: 0,
            duration: 520,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.delay(920),
        ])
      );
      swayLoop.start();
    } else {
      swayLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(swayAnim, {
            toValue: 1,
            duration: activeSwayMs,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(swayAnim, {
            toValue: -1,
            duration: Math.round(activeSwayMs * 1.08),
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(swayAnim, {
            toValue: 0,
            duration: Math.round(activeSwayMs * 0.62),
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ])
      );
      swayLoop.start();

      if (sceneMotion.mode === 'shiver_pulse') {
        shiverLoop = Animated.loop(
          Animated.sequence([
            Animated.delay(2400),
            Animated.timing(shiverAnim, {
              toValue: -1,
              duration: 55,
              easing: Easing.linear,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(shiverAnim, {
              toValue: 1,
              duration: 60,
              easing: Easing.linear,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(shiverAnim, {
              toValue: -0.72,
              duration: 55,
              easing: Easing.linear,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(shiverAnim, {
              toValue: 0.72,
              duration: 55,
              easing: Easing.linear,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(shiverAnim, {
              toValue: 0,
              duration: 65,
              easing: Easing.out(Easing.quad),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.delay(1900),
          ])
        );
        shiverLoop.start();
      }
    }

    // C. Backlight aura & phone glow pulse
    auraPulseAnim.setValue(0);
    const auraLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(auraPulseAnim, {
          toValue: 1,
          duration: !isStanding && npcAction === 'scrolling_phone' ? 2100 : 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(auraPulseAnim, {
          toValue: 0,
          duration: !isStanding && npcAction === 'scrolling_phone' ? 2100 : 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );
    auraLoop.start();

    // D. Ambient prop clocks (NPC floating hearts/music notes & weather ripples/steam/frost)
    let propLoopA: Animated.CompositeAnimation | null = null;
    let propLoopB: Animated.CompositeAnimation | null = null;
    let propLoopC: Animated.CompositeAnimation | null = null;

    if (showAmbientProps) {
      const cycleDuration =
        !isStanding && npcMode
          ? npcAction === 'listening_music'
            ? 2300
            : 2600
          : sceneMotion.ambientProp === 'storm_puddle'
            ? 1650
            : sceneMotion.ambientProp === 'rain_ripples'
              ? 2400
              : sceneMotion.ambientProp === 'warm_steam'
                ? 2700
                : 3100;

      ambientClockA.setValue(0);
      propLoopA = Animated.loop(
        Animated.timing(ambientClockA, {
          toValue: 1,
          duration: cycleDuration,
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        })
      );
      propLoopA.start();

      ambientClockB.setValue(0);
      propLoopB = Animated.loop(
        Animated.sequence([
          Animated.delay(Math.round(cycleDuration * 0.48)),
          Animated.timing(ambientClockB, {
            toValue: 1,
            duration: cycleDuration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ])
      );
      propLoopB.start();

      ambientClockC.setValue(0);
      propLoopC = Animated.loop(
        Animated.sequence([
          Animated.delay(Math.round(cycleDuration * 0.24)),
          Animated.timing(ambientClockC, {
            toValue: 1,
            duration: Math.round(cycleDuration * 0.92),
            easing: Easing.out(Easing.cubic),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ])
      );
      propLoopC.start();
    }

    return () => {
      breathLoop.stop();
      swayLoop?.stop();
      shiverLoop?.stop();
      nodLoop?.stop();
      auraLoop.stop();
      propLoopA?.stop();
      propLoopB?.stop();
      propLoopC?.stop();
    };
  }, [
    sceneId,
    sceneMotion,
    npcAction,
    npcMotion,
    npcMode,
    isStanding,
    reduceMotion,
    showAmbientProps,
    breathAnim,
    swayAnim,
    shiverAnim,
    npcNodAnim,
    auraPulseAnim,
    ambientClockA,
    ambientClockB,
    ambientClockC,
  ]);

  // Stand-Up On Tap (from NPC Idle) OR Cute Wave/Hop (when already standing) — ZERO text bubbles!
  const handleCharacterPress = useCallback(() => {
    if (!interactive) {
      return;
    }

    const idx = tapCountRef.current;
    tapCountRef.current += 1;

    const wasNpcIdle = npcMode && !isStanding;

    if (npcMode) {
      npcStage.interactWithCharacter();
    }

    if (reduceMotion) {
      return;
    }

    const tiltDir = idx % 2 === 0 ? 1 : -1;

    tapTranslateY.stopAnimation();
    tapScaleX.stopAnimation();
    tapScaleY.stopAnimation();
    tapRotate.stopAnimation();
    tapShadowLift.stopAnimation();
    burstProgress.stopAnimation();

    burstProgress.setValue(0);
    Animated.timing(burstProgress, {
      toValue: 1,
      duration: 640,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();

    if (wasNpcIdle) {
      // Lively Stand-Up Transition:
      // 1. Anticipation dip (scaleX: 1.07, scaleY: 0.90, translateY: +6 over 90ms)
      // 2. Energetic upward spring stand-up (translateY: -18 -> 0, scaleY: 1.05 -> 1.0)
      Animated.sequence([
        Animated.parallel([
          Animated.timing(tapScaleX, {
            toValue: 1.07,
            duration: 90,
            easing: Easing.out(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(tapScaleY, {
            toValue: 0.9,
            duration: 90,
            easing: Easing.out(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(tapTranslateY, {
            toValue: 6,
            duration: 90,
            easing: Easing.out(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
        Animated.parallel([
          Animated.timing(tapTranslateY, {
            toValue: -18,
            duration: 155,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(tapScaleX, {
            toValue: 0.96,
            duration: 155,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(tapScaleY, {
            toValue: 1.05,
            duration: 155,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(tapRotate, {
            toValue: tiltDir * 0.65,
            duration: 155,
            easing: Easing.out(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(tapShadowLift, {
            toValue: 1,
            duration: 155,
            easing: Easing.out(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
        Animated.parallel([
          Animated.spring(tapTranslateY, {
            toValue: 0,
            tension: 185,
            friction: 9,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.spring(tapScaleX, {
            toValue: 1,
            tension: 180,
            friction: 8,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.spring(tapScaleY, {
            toValue: 1,
            tension: 180,
            friction: 8,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.spring(tapRotate, {
            toValue: 0,
            tension: 165,
            friction: 9,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.spring(tapShadowLift, {
            toValue: 0,
            tension: 180,
            friction: 9,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
      ]).start();
    } else {
      // Already standing: cute little wave/hop & reset stand timer (zero text bubble!)
      const squashOffsetPx = Math.round(size * sceneMotion.footAnchorRatio * 0.065);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(tapScaleX, {
            toValue: 1.05,
            duration: 75,
            easing: Easing.out(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(tapScaleY, {
            toValue: 0.94,
            duration: 75,
            easing: Easing.out(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(tapTranslateY, {
            toValue: squashOffsetPx,
            duration: 75,
            easing: Easing.out(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
        Animated.parallel([
          Animated.timing(tapTranslateY, {
            toValue: -14,
            duration: 145,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(tapScaleX, {
            toValue: 0.96,
            duration: 145,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(tapScaleY, {
            toValue: 1.045,
            duration: 145,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(tapRotate, {
            toValue: tiltDir,
            duration: 145,
            easing: Easing.out(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(tapShadowLift, {
            toValue: 0.85,
            duration: 145,
            easing: Easing.out(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
        Animated.parallel([
          Animated.spring(tapTranslateY, {
            toValue: 0,
            tension: 180,
            friction: 9,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.spring(tapScaleX, {
            toValue: 1,
            tension: 175,
            friction: 8,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.spring(tapScaleY, {
            toValue: 1,
            tension: 175,
            friction: 8,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.spring(tapRotate, {
            toValue: 0,
            tension: 160,
            friction: 9,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.spring(tapShadowLift, {
            toValue: 0,
            tension: 180,
            friction: 9,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
      ]).start();
    }
  }, [
    interactive,
    npcMode,
    isStanding,
    npcStage,
    reduceMotion,
    size,
    sceneMotion,
    tapTranslateY,
    tapScaleX,
    tapScaleY,
    tapRotate,
    tapShadowLift,
    burstProgress,
  ]);

  // Web 2.5D pointer depth handlers (zero state updates)
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
        const clientX = nativeEvt.clientX ?? rect.left + rect.width / 2;
        const clientY = nativeEvt.clientY ?? rect.top + rect.height / 2;
        const nx = Math.max(-1, Math.min(1, ((clientX - rect.left) / rect.width - 0.5) * 2));
        const ny = Math.max(-1, Math.min(1, ((clientY - rect.top) / rect.height - 0.5) * 2));

        Animated.spring(pointerX, {
          toValue: nx,
          tension: 120,
          friction: 14,
          useNativeDriver: false,
        }).start();
        Animated.spring(pointerY, {
          toValue: ny,
          tension: 120,
          friction: 14,
          useNativeDriver: false,
        }).start();
      },
      onPointerLeave: () => {
        Animated.spring(pointerX, {
          toValue: 0,
          tension: 110,
          friction: 12,
          useNativeDriver: false,
        }).start();
        Animated.spring(pointerY, {
          toValue: 0,
          tension: 110,
          friction: 12,
          useNativeDriver: false,
        }).start();
      },
    };
  }, [interactive, reduceMotion, pointerX, pointerY]);

  // --- Interpolations ---
  const activeBreathScaleY = isStanding ? sceneMotion.breathScaleY : npcMotion.breathScaleY;
  const activeBreathScaleX = isStanding ? sceneMotion.breathScaleX : npcMotion.breathScaleX;
  const activeAnchorRatio = isStanding ? sceneMotion.footAnchorRatio : npcMotion.anchorRatio;

  const breathScaleY = breathAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, activeBreathScaleY],
  });
  const breathScaleX = breathAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, activeBreathScaleX],
  });
  const footAnchorLiftPx = -(activeBreathScaleY - 1) * (size * activeAnchorRatio);
  const breathTranslateY = breathAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, footAnchorLiftPx],
  });

  // Gentle head/patting nod offset in NPC mode
  const npcNodTranslateY = npcNodAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 2.2],
  });

  // Secondary posture sway
  const negDeg = !isStanding
    ? npcMotion.rotateMinDeg
    : sceneMotion.mode === 'wind_gust'
      ? 3.8
      : sceneMotion.rotateMinDeg;
  const posDeg = !isStanding
    ? npcMotion.rotateMaxDeg
    : sceneMotion.mode === 'wind_gust'
      ? sceneMotion.rotateMinDeg
      : sceneMotion.rotateMaxDeg;

  const swayRotate = swayAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [`${negDeg}deg`, '0deg', `${posDeg}deg`],
  });
  const ankleRadiusPx = size * (isStanding ? 0.32 : 0.22);
  const negShiftPx = Math.sin((negDeg * Math.PI) / 180) * ankleRadiusPx;
  const posShiftPx = Math.sin((posDeg * Math.PI) / 180) * ankleRadiusPx;
  const swayTranslateX = swayAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [negShiftPx, 0, posShiftPx],
  });

  // Shiver micro-tremor (freezing_puffer when standing)
  const shiverTranslateX = shiverAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-2.4, 0, 2.4],
  });
  const shiverRotate = shiverAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-1.3deg', '0deg', '1.3deg'],
  });

  // Tap hop tilt
  const tapRotateDeg = tapRotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-3.2deg', '0deg', '3.2deg'],
  });

  // Web 2.5D pointer depth
  const parallaxTranslateX = pointerX.interpolate({
    inputRange: [-1, 1],
    outputRange: [-4.2, 4.2],
  });
  const parallaxTranslateY = pointerY.interpolate({
    inputRange: [-1, 1],
    outputRange: [-3.2, 3.2],
  });
  const parallaxRotate = pointerX.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-1.4deg', '1.4deg'],
  });
  const auraCounterX = pointerX.interpolate({
    inputRange: [-1, 1],
    outputRange: [3.0, -3.0],
  });
  const auraCounterY = pointerY.interpolate({
    inputRange: [-1, 1],
    outputRange: [2.2, -2.2],
  });

  // Posture layer opacities (silk-smooth crossfade between NPC Idle & Standing Weather)
  const standingLayerOpacity = npcMode
    ? postureBlend
    : 1;
  const npcLayerOpacity = npcMode
    ? postureBlend.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
      })
    : 0;

  // Aura & Ground Contact Shadow
  const auraScale = auraPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, sceneMotion.ambientProp === 'heat_shimmer' ? 1.09 : 1.05],
  });
  const auraOpacity = auraPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.48, 0.80],
  });

  const breathShadowScale = breathAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.02, 0.95],
  });
  const tapShadowScale = tapShadowLift.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.72],
  });
  const shadowOpacity = tapShadowLift.interpolate({
    inputRange: [0, 1],
    outputRange: [palette.isDark ? 0.30 : 0.16, palette.isDark ? 0.12 : 0.07],
  });

  const burstIconName = resolveBurstIcon(sceneMotion.burstKind);
  const auraColor = palette.isDark
    ? sceneMotion.auraTintDark
    : sceneMotion.auraTintLight;
  const groundBottomPx = Math.round(size * 0.068);
  const rippleBottomPx = Math.round(size * 0.048);

  const npcLabelVi = NPC_ACTION_META[npcAction]?.labelVi ?? 'Đang thư giãn';
  const a11yDescription = npcMode
    ? isStanding
      ? `${profile?.nameVi ?? gender} · ${sceneMeta?.labelVi ?? sceneId}`
      : `${profile?.nameVi ?? gender} · ${npcLabelVi}. Chạm để đứng dậy`
    : `${profile?.nameVi ?? gender} · ${sceneMeta?.labelVi ?? sceneId}`;

  return (
    <View style={styles.rigOuterStack}>
      <View style={[styles.rigCanvas, { width: size * 1.08, height: size }]}>
        {/* Ambient Atmospheric Backlight Halo */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.auraOrb,
            {
              width: size * 0.84,
              height: size * 0.84,
              borderRadius: size * 0.42,
              backgroundColor: auraColor,
              opacity: auraOpacity,
              transform: [
                { translateX: auraCounterX },
                { translateY: auraCounterY },
                { scale: auraScale },
              ],
            },
          ]}
        />

        {/* Daytime-only Solar / Heat Shimmer Ring (NEVER on clear_night!) */}
        {showAmbientProps &&
          isStanding &&
          (sceneMotion.ambientProp === 'sun_halo' ||
            sceneMotion.ambientProp === 'heat_shimmer') && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.solarShimmerRing,
                {
                  width: size * 0.92,
                  height: size * 0.92,
                  borderRadius: size * 0.46,
                  borderColor:
                    sceneMotion.ambientProp === 'heat_shimmer'
                      ? 'rgba(251, 146, 60, 0.32)'
                      : 'rgba(251, 191, 36, 0.28)',
                  opacity: auraPulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.20, 0.56],
                  }),
                  transform: [
                    {
                      scale: auraPulseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.93, 1.06],
                      }),
                    },
                  ],
                },
              ]}
            />
          )}

        {/* Calm Night Starlight Ring (clear_night — zero sun rays!) */}
        {showAmbientProps && sceneMotion.ambientProp === 'starlight_aura' && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.solarShimmerRing,
              {
                width: size * 0.90,
                height: size * 0.90,
                borderRadius: size * 0.45,
                borderColor: 'rgba(147, 197, 253, 0.22)',
                opacity: auraPulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.18, 0.48],
                }),
                transform: [
                  {
                    scale: auraPulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.95, 1.03],
                    }),
                  },
                ],
              },
            ]}
          />
        )}

        {/* Ground-Plane Concentric Water Ripples (Light Rain & Storm) */}
        {showAmbientProps &&
          (sceneMotion.ambientProp === 'rain_ripples' ||
            sceneMotion.ambientProp === 'storm_puddle') && (
            <View
              pointerEvents="none"
              style={[
                styles.groundPropPlane,
                {
                  bottom: rippleBottomPx,
                  width: size * 0.84,
                },
              ]}
            >
              {[ambientClockA, ambientClockB].map((clock, idx) => (
                <Animated.View
                  key={`ripple_${idx}`}
                  style={[
                    styles.waterRippleRing,
                    {
                      width: size * 0.58,
                      height: Math.max(14, size * 0.085),
                      borderRadius: 999,
                      borderColor: palette.isDark
                        ? 'rgba(186, 230, 253, 0.50)'
                        : 'rgba(56, 189, 248, 0.48)',
                      opacity: clock.interpolate({
                        inputRange: [0, 0.15, 1],
                        outputRange: [0, 0.62, 0],
                      }),
                      transform: [
                        {
                          scaleX: clock.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.35, 1.35],
                          }),
                        },
                        {
                          scaleY: clock.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.45, 1.25],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              ))}

              {isStanding &&
                sceneMotion.ambientProp === 'storm_puddle' &&
                [-1, 0, 1].map((dir, sIdx) => {
                  const splashClock =
                    sIdx === 0
                      ? ambientClockA
                      : sIdx === 1
                        ? ambientClockC
                        : ambientClockB;
                  const arcX = dir === 0 ? 10 : dir * (size * 0.15);
                  return (
                    <Animated.View
                      key={`splash_${sIdx}`}
                      style={[
                        styles.puddleSplashDrop,
                        {
                          backgroundColor: palette.isDark
                            ? 'rgba(191, 219, 254, 0.82)'
                            : 'rgba(59, 130, 246, 0.66)',
                          opacity: splashClock.interpolate({
                            inputRange: [0, 0.2, 0.75, 1],
                            outputRange: [0, 0.88, 0.34, 0],
                          }),
                          transform: [
                            {
                              translateX: splashClock.interpolate({
                                inputRange: [0, 1],
                                outputRange: [dir * 8, arcX],
                              }),
                            },
                            {
                              translateY: splashClock.interpolate({
                                inputRange: [0, 0.48, 1],
                                outputRange: [0, -18, -3],
                              }),
                            },
                            {
                              scale: splashClock.interpolate({
                                inputRange: [0, 0.4, 1],
                                outputRange: [0.5, 1.1, 0.4],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  );
                })}
            </View>
          )}

        {/* Grounded Diffused Contact Shadow Ellipse */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.contactShadowWrap,
            {
              bottom: groundBottomPx,
              opacity: shadowOpacity,
              transform: [{ scaleX: tapShadowScale }],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.contactShadowCore,
              Platform.OS === 'web'
                ? ({ filter: 'blur(9px)' } as unknown as object)
                : null,
              {
                width: size * (isStanding ? 0.46 : 0.54),
                backgroundColor: palette.shadowColor,
                transform: [
                  { scaleX: breathShadowScale },
                  { translateX: swayTranslateX },
                ],
              },
            ]}
          />
        </Animated.View>

        {/* Interactive Accessible Pressable Wrapping the 2.5D Rig Hierarchy */}
        <Pressable
          disabled={!interactive}
          onPress={handleCharacterPress}
          accessibilityRole={interactive ? 'button' : 'image'}
          accessibilityLabel={a11yDescription}
          {...(webPointerHandlers as object)}
          style={[
            styles.pressableStage,
            Platform.OS === 'web'
              ? ({
                  outlineStyle: 'none',
                  cursor: interactive ? 'pointer' : 'default',
                  WebkitTapHighlightColor: 'transparent',
                } as any)
              : null,
          ]}
        >
          {/* Joint 1: Scene / Gender / NPC Shuffle Crossfade + Pop */}
          <Animated.View
            style={{
              opacity: entranceOpacity,
              transform: [{ scale: entranceScale }],
            }}
          >
            {/* Joint 2: Web 2.5D Pointer Depth Parallax */}
            <Animated.View
              style={{
                transform: [
                  { translateX: parallaxTranslateX },
                  { translateY: parallaxTranslateY },
                  { rotate: parallaxRotate },
                ],
              }}
            >
              {/* Joint 3: Stand-Up / Settle-Down / Hop Squash & Stretch */}
              <Animated.View
                style={{
                  transform: [
                    { translateY: tapTranslateY },
                    { rotate: tapRotateDeg },
                    { scaleX: tapScaleX },
                    { scaleY: tapScaleY },
                  ],
                }}
              >
                {/* Joint 4: Micro-Shiver Tremor (Freezing Puffer) */}
                <Animated.View
                  style={{
                    transform: [
                      { translateX: shiverTranslateX },
                      { rotate: shiverRotate },
                    ],
                  }}
                >
                  {/* Joint 5: Pendulum / Music Groove / Storm Wind Sway */}
                  <Animated.View
                    style={{
                      transform: [
                        { translateX: swayTranslateX },
                        { rotate: swayRotate },
                      ],
                    }}
                  >
                    {/* Joint 6: Volume-Preserving Organic Breathing + Seated Nod */}
                    <Animated.View
                      style={{
                        position: 'relative',
                        width: size,
                        height: size,
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: [
                          { translateY: breathTranslateY },
                          { translateY: npcNodTranslateY },
                          { scaleX: breathScaleX },
                          { scaleY: breathScaleY },
                        ],
                      }}
                    >
                      {/* Layer A: Chibi NPC Idle Sprite (Active by default when npcMode=true) */}
                      {npcMode && npcSprite && (
                        <Animated.View
                          pointerEvents="none"
                          style={[
                            StyleSheet.absoluteFill,
                            styles.spriteLayerCenter,
                            { opacity: npcLayerOpacity },
                          ]}
                        >
                          <Image
                            source={npcSprite}
                            resizeMode="contain"
                            style={{ width: size, height: size }}
                          />

                          {/* Per-NPC Micro-Animation 1: Petting Cat / Puppy floating hearts & sparkles */}
                          {showAmbientProps &&
                            (npcAction === 'petting_cat' ||
                              npcAction === 'petting_puppy') && (
                              <View
                                pointerEvents="none"
                                style={[
                                  styles.npcAccentAnchor,
                                  {
                                    left: size * 0.60,
                                    top: size * 0.56,
                                  },
                                ]}
                              >
                                {[ambientClockA, ambientClockB].map((clock, hIdx) => {
                                  const driftX = hIdx === 0 ? 6 : -8;
                                  return (
                                    <Animated.View
                                      key={`pet_accent_${hIdx}`}
                                      style={{
                                        position: 'absolute',
                                        opacity: clock.interpolate({
                                          inputRange: [0, 0.22, 0.78, 1],
                                          outputRange: [0, 0.88, 0.45, 0],
                                        }),
                                        transform: [
                                          {
                                            translateX: clock.interpolate({
                                              inputRange: [0, 1],
                                              outputRange: [0, driftX],
                                            }),
                                          },
                                          {
                                            translateY: clock.interpolate({
                                              inputRange: [0, 1],
                                              outputRange: [0, -26],
                                            }),
                                          },
                                          {
                                            scale: clock.interpolate({
                                              inputRange: [0, 0.4, 1],
                                              outputRange: [0.65, 1.08, 0.75],
                                            }),
                                          },
                                        ],
                                      }}
                                    >
                                      <Feather
                                        name={hIdx === 0 ? 'heart' : 'star'}
                                        size={hIdx === 0 ? 13 : 11}
                                        color={
                                          hIdx === 0
                                            ? '#FB7185'
                                            : palette.isDark
                                              ? '#FDE68A'
                                              : '#F59E0B'
                                        }
                                      />
                                    </Animated.View>
                                  );
                                })}
                              </View>
                            )}

                          {/* Per-NPC Micro-Animation 2: Scrolling Phone soft screen glow near hands */}
                          {showAmbientProps && npcAction === 'scrolling_phone' && (
                            <Animated.View
                              pointerEvents="none"
                              style={[
                                styles.phoneScreenGlow,
                                Platform.OS === 'web'
                                  ? ({ filter: 'blur(10px)' } as unknown as object)
                                  : null,
                                {
                                  width: size * 0.22,
                                  height: size * 0.16,
                                  borderRadius: size * 0.11,
                                  left: size * 0.39,
                                  top: size * 0.50,
                                  backgroundColor: palette.isDark
                                    ? 'rgba(125, 211, 252, 0.42)'
                                    : 'rgba(56, 189, 248, 0.30)',
                                  opacity: auraPulseAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0.22, 0.68],
                                  }),
                                  transform: [
                                    {
                                      scale: auraPulseAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.9, 1.14],
                                      }),
                                    },
                                  ],
                                },
                              ]}
                            />
                          )}

                          {/* Per-NPC Micro-Animation 3: Listening Music floating vector music notes */}
                          {showAmbientProps && npcAction === 'listening_music' && (
                            <View
                              pointerEvents="none"
                              style={[
                                styles.npcAccentAnchor,
                                {
                                  left: size * 0.66,
                                  top: size * 0.28,
                                },
                              ]}
                            >
                              {[ambientClockA, ambientClockB].map((clock, mIdx) => {
                                const waveDir = mIdx === 0 ? 1 : -1;
                                return (
                                  <Animated.View
                                    key={`music_note_${mIdx}`}
                                    style={{
                                      position: 'absolute',
                                      opacity: clock.interpolate({
                                        inputRange: [0, 0.2, 0.78, 1],
                                        outputRange: [0, 0.9, 0.45, 0],
                                      }),
                                      transform: [
                                        {
                                          translateX: clock.interpolate({
                                            inputRange: [0, 0.5, 1],
                                            outputRange: [
                                              mIdx === 0 ? 0 : -14,
                                              (mIdx === 0 ? 0 : -14) + waveDir * 9,
                                              (mIdx === 0 ? 0 : -14) + waveDir * 15,
                                            ],
                                          }),
                                        },
                                        {
                                          translateY: clock.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [mIdx * 8, -30 + mIdx * 4],
                                          }),
                                        },
                                        {
                                          rotate: clock.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [
                                              `${-8 * waveDir}deg`,
                                              `${12 * waveDir}deg`,
                                            ],
                                          }),
                                        },
                                      ],
                                    }}
                                  >
                                    <Feather
                                      name="music"
                                      size={mIdx === 0 ? 13 : 11}
                                      color={palette.accent}
                                    />
                                  </Animated.View>
                                );
                              })}
                            </View>
                          )}
                        </Animated.View>
                      )}

                      {/* Layer B: Standing Weather-Outfit Sprite */}
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          StyleSheet.absoluteFill,
                          styles.spriteLayerCenter,
                          { opacity: standingLayerOpacity },
                        ]}
                      >
                        {standingSprite ? (
                          <Image
                            source={standingSprite}
                            resizeMode="contain"
                            style={{ width: size, height: size }}
                          />
                        ) : (
                          <View
                            style={[
                              styles.fallbackAvatarBox,
                              {
                                width: size * 0.75,
                                height: size * 0.75,
                                backgroundColor: palette.coreElevatedBg,
                              },
                            ]}
                          >
                            <Text style={styles.fallbackEmoji}>
                              {sceneMeta?.emoji ?? '🌤️'}
                            </Text>
                          </View>
                        )}

                        {/* Cozy Rising Warm Steam Wisps (Chilly Cozy standing pose) */}
                        {showAmbientProps &&
                          sceneMotion.ambientProp === 'warm_steam' && (
                            <View
                              pointerEvents="none"
                              style={[
                                styles.midTorsoPropLayer,
                                {
                                  left: size * 0.395,
                                  top:
                                    gender === 'female'
                                      ? size * 0.39
                                      : size * 0.435,
                                },
                              ]}
                            >
                              {[ambientClockA, ambientClockB, ambientClockC].map(
                                (clock, wIdx) => {
                                  const xOffset = (wIdx - 1) * 7;
                                  const swayDir = wIdx % 2 === 0 ? 1 : -1;
                                  return (
                                    <Animated.View
                                      key={`steam_${wIdx}`}
                                      style={[
                                        styles.steamWisp,
                                        {
                                          backgroundColor: palette.isDark
                                            ? 'rgba(255, 247, 237, 0.44)'
                                            : 'rgba(255, 255, 255, 0.74)',
                                          opacity: clock.interpolate({
                                            inputRange: [0, 0.25, 0.75, 1],
                                            outputRange: [0, 0.62, 0.3, 0],
                                          }),
                                          transform: [
                                            {
                                              translateX: clock.interpolate({
                                                inputRange: [0, 0.5, 1],
                                                outputRange: [
                                                  xOffset,
                                                  xOffset + swayDir * 6,
                                                  xOffset - swayDir * 4,
                                                ],
                                              }),
                                            },
                                            {
                                              translateY: clock.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0, -34],
                                              }),
                                            },
                                            {
                                              scale: clock.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0.5, 1.28],
                                              }),
                                            },
                                          ],
                                        },
                                      ]}
                                    />
                                  );
                                }
                              )}
                            </View>
                          )}

                        {/* Soft Drifting Frost Puffs (Freezing Puffer standing pose) */}
                        {showAmbientProps &&
                          sceneMotion.ambientProp === 'frost_puffs' && (
                            <View
                              pointerEvents="none"
                              style={[
                                styles.midTorsoPropLayer,
                                {
                                  left: size * 0.56,
                                  top: size * 0.405,
                                },
                              ]}
                            >
                              {[ambientClockA, ambientClockB].map((clock, fIdx) => {
                                const yBias = fIdx === 0 ? 0 : 4;
                                return (
                                  <Animated.View
                                    key={`frost_${fIdx}`}
                                    style={[
                                      styles.frostPuff,
                                      {
                                        backgroundColor: palette.isDark
                                          ? 'rgba(224, 242, 254, 0.46)'
                                          : 'rgba(255, 255, 255, 0.80)',
                                        opacity: clock.interpolate({
                                          inputRange: [0, 0.22, 0.7, 1],
                                          outputRange: [0, 0.64, 0.26, 0],
                                        }),
                                        transform: [
                                          {
                                            translateX: clock.interpolate({
                                              inputRange: [0, 1],
                                              outputRange: [2, 24],
                                            }),
                                          },
                                          {
                                            translateY: clock.interpolate({
                                              inputRange: [0, 1],
                                              outputRange: [yBias, yBias - 20],
                                            }),
                                          },
                                          {
                                            scale: clock.interpolate({
                                              inputRange: [0, 1],
                                              outputRange: [0.45, 1.35],
                                            }),
                                          },
                                        ],
                                      },
                                    ]}
                                  />
                                );
                              })}
                            </View>
                          )}
                      </Animated.View>
                    </Animated.View>
                  </Animated.View>
                </Animated.View>
              </Animated.View>
            </Animated.View>
          </Animated.View>

          {/* Subtle Tap Micro-Particles Burst (No text bubbles!) */}
          {interactive && !reduceMotion && (
            <View
              pointerEvents="none"
              style={[styles.burstAnchor, { top: size * 0.34 }]}
            >
              {BURST_SPECS.map((spec) => {
                const pOpacity = burstProgress.interpolate({
                  inputRange: [0, 0.14, 0.72, 1],
                  outputRange: [0, 0.92, 0.55, 0],
                });
                const pTranslateX = burstProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [spec.startX, spec.startX + spec.dx],
                });
                const pTranslateY = burstProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [spec.startY, spec.startY + spec.dy],
                });
                const pScale = burstProgress.interpolate({
                  inputRange: [0, 0.35, 1],
                  outputRange: [0.35, spec.scalePeak, 0.5],
                });

                return (
                  <Animated.View
                    key={spec.id}
                    style={[
                      styles.burstParticleBadge,
                      {
                        backgroundColor: spec.isSecondary
                          ? sceneMotion.burstSecondaryColor
                          : palette.coreElevatedBg,
                        borderColor: sceneMotion.burstPrimaryColor,
                        opacity: pOpacity,
                        transform: [
                          { translateX: pTranslateX },
                          { translateY: pTranslateY },
                          { scale: pScale },
                          { rotate: spec.rotateDeg },
                        ],
                      },
                    ]}
                  >
                    <Feather
                      name={burstIconName}
                      size={10}
                      color={sceneMotion.burstPrimaryColor}
                    />
                  </Animated.View>
                );
              })}
            </View>
          )}
        </Pressable>

        {/* Subtle 28px Icon-Only Shuffle Pill in Stage Corner to Cycle Random NPC Actions */}
        {npcMode && interactive && (
          <Pressable
            onPress={npcStage.shuffleNpcAction}
            accessibilityRole="button"
            accessibilityLabel={`Đổi hoạt động ngẫu nhiên (${npcLabelVi})`}
            hitSlop={8}
            style={({ pressed }) => [
              styles.shuffleCornerBtn,
              WEB_NO_OUTLINE,
              Platform.OS === 'web'
                ? ({
                    outlineStyle: 'none',
                    cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                  } as any)
                : null,
              {
                backgroundColor: palette.pillIdleBg,
                borderColor: palette.bezelOuterBorder,
                opacity: pressed ? 0.86 : 0.78,
                transform: [{ scale: pressed ? 0.92 : 1 }],
              },
            ]}
          >
            <Feather name="shuffle" size={12} color={palette.inkSecondary} />
          </Pressable>
        )}
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
  pressableStage: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 3,
  },
  spriteLayerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shuffleCornerBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
  },
  auraOrb: {
    position: 'absolute',
    zIndex: 1,
  },
  solarShimmerRing: {
    position: 'absolute',
    borderWidth: 1.5,
    zIndex: 1,
  },
  groundPropPlane: {
    position: 'absolute',
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  waterRippleRing: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  puddleSplashDrop: {
    position: 'absolute',
    width: 5.5,
    height: 8,
    borderRadius: 4,
  },
  contactShadowWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  contactShadowCore: {
    height: 12,
    borderRadius: 999,
  },
  midTorsoPropLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  npcAccentAnchor: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  phoneScreenGlow: {
    position: 'absolute',
    zIndex: 4,
  },
  steamWisp: {
    position: 'absolute',
    width: 11,
    height: 18,
    borderRadius: 999,
  },
  frostPuff: {
    position: 'absolute',
    width: 14,
    height: 10,
    borderRadius: 999,
  },
  burstAnchor: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  burstParticleBadge: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackAvatarBox: {
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackEmoji: {
    fontSize: 64,
  },
});

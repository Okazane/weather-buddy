import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { NPC_ACTION_META } from '../core';
import {
  CHARACTER_PROFILES,
  SCENE_MOTION_PROFILES,
  SCENE_VISUAL_META,
  type CharacterSceneId,
  type Gender,
  type NpcActionId,
} from '../art/characterAssets';
import { useNpcStageController } from '../hooks/useWeatherBuddy';
import {
  ArticulatedChibiSvg,
  CANONICAL_CHIBI_LANDMARKS,
  createCanonicalChibiFrame,
  type ChibiKinematicFrame,
} from './ArticulatedChibiSvg';
import {
  FONT_FAMILY_SANS,
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

const NATURAL_NPC_LABELS: Record<NpcActionId, string> = {
  reading_book: 'Đọc sách',
  petting_cat: 'Xoa đầu mèo',
  petting_puppy: 'Chơi với cún',
  scrolling_phone: 'Xem điện thoại',
  listening_music: 'Nghe nhạc',
};

interface InternalRigMutableState {
  startTimeMs: number;
  lastFrameMs: number;
  standBlend: number;
  gazeX: number;
  gazeY: number;
  targetGazeX: number;
  targetGazeY: number;
  pointerActiveUntilMs: number;
  nextSaccadeAtMs: number;
  saccadeX: number;
  saccadeY: number;
  headTiltDeg: number;
  secondaryLagDeg: number;
  prevHeadTiltDeg: number;
  leftArmDeg: number;
  rightArmDeg: number;
  // Autonomous blinking
  nextBlinkAtMs: number;
  blinkStartMs: number;
  blinkDurationMs: number;
  pendingDoubleBlink: boolean;
  // Interactive wave / happy squint / hop
  waveUntilMs: number;
  happySquintUntilMs: number;
  hopStartMs: number;
  // Head-petting stroke detector
  lastPointerX: number;
  strokeAccum: number;
  // Companion walking state (cat from right 295 -> 212, puppy from left 25 -> 106)
  activePetAction: NpcActionId | null;
  petEnteredAtMs: number;
  petNextBlinkAtMs: number;
  petBlinkUntilMs: number;
}

function createInitialFrame(isStanding: boolean, npcAction: NpcActionId): ChibiKinematicFrame {
  return createCanonicalChibiFrame({ isStanding, npcAction });
}

export { CANONICAL_CHIBI_LANDMARKS, createCanonicalChibiFrame };

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

  const profile = CHARACTER_PROFILES[gender];
  const sceneMeta = SCENE_VISUAL_META[sceneId];
  const sceneMotion =
    SCENE_MOTION_PROFILES[sceneId] ?? SCENE_MOTION_PROFILES.pleasant_sunny;

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
  const rigRef = useRef<InternalRigMutableState>({
    startTimeMs: nowInit,
    lastFrameMs: nowInit,
    standBlend: isStanding ? 1 : 0,
    gazeX: 0,
    gazeY: 0,
    targetGazeX: 0,
    targetGazeY: 0,
    pointerActiveUntilMs: 0,
    nextSaccadeAtMs: nowInit + 1200,
    saccadeX: 0,
    saccadeY: 0,
    headTiltDeg: 0,
    secondaryLagDeg: 0,
    prevHeadTiltDeg: 0,
    leftArmDeg: isStanding ? 18 : -28,
    rightArmDeg: isStanding ? -18 : 28,
    nextBlinkAtMs: nowInit + 2600,
    blinkStartMs: -1,
    blinkDurationMs: 135,
    pendingDoubleBlink: false,
    waveUntilMs: 0,
    happySquintUntilMs: 0,
    hopStartMs: -1,
    lastPointerX: 0,
    strokeAccum: 0,
    activePetAction: null,
    petEnteredAtMs: nowInit,
    petNextBlinkAtMs: nowInit + 3100,
    petBlinkUntilMs: 0,
  });

  const [frame, setFrame] = useState<ChibiKinematicFrame>(() =>
    createInitialFrame(isStanding, npcAction)
  );

  // Trigger wave + hop whenever weather sceneId changes or user clicks character
  const prevSceneIdRef = useRef<CharacterSceneId>(sceneId);
  const prevStandTriggerRef = useRef<number>(npcStage.standTriggerCount);

  useEffect(() => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const sceneChanged = prevSceneIdRef.current !== sceneId;
    const standTriggered = prevStandTriggerRef.current !== npcStage.standTriggerCount;
    prevSceneIdRef.current = sceneId;
    prevStandTriggerRef.current = npcStage.standTriggerCount;

    if (sceneChanged || standTriggered) {
      const st = rigRef.current;
      st.waveUntilMs = now + 2400;
      st.happySquintUntilMs = now + (standTriggered ? 1650 : 1200);
      st.hopStartMs = now;
    }
  }, [sceneId, npcStage.standTriggerCount]);

  // Reset walking companion entrance whenever entering `petting_cat` or `petting_puppy` in seated NPC mode
  useEffect(() => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const st = rigRef.current;
    if (!isStanding && (npcAction === 'petting_cat' || npcAction === 'petting_puppy')) {
      if (st.activePetAction !== npcAction) {
        st.activePetAction = npcAction;
        st.petEnteredAtMs = now;
      }
    } else {
      st.activePetAction = null;
    }
  }, [npcAction, isStanding]);

  // Global Web cursor eye-tracking listener so the character's living eyes follow the cursor smoothly
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || reduceMotion || !interactive) {
      return;
    }

    const handleWindowPointerMove = (evt: PointerEvent) => {
      const node = stageRef.current as unknown as HTMLElement | null;
      if (!node || typeof node.getBoundingClientRect !== 'function') {
        return;
      }
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }
      const centerX = rect.left + rect.width * 0.5;
      const centerY = rect.top + rect.height * 0.42;
      const dx = (evt.clientX - centerX) / (rect.width * 0.65);
      const dy = (evt.clientY - centerY) / (rect.height * 0.65);

      // Only track cursor when within reasonable proximity of the stage card
      if (Math.abs(dx) <= 2.4 && Math.abs(dy) <= 2.2) {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const st = rigRef.current;
        st.targetGazeX = Math.max(-1, Math.min(1, dx));
        st.targetGazeY = Math.max(-1, Math.min(1, dy));
        st.pointerActiveUntilMs = now + 2500;
      }
    };

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
    };
  }, [reduceMotion, interactive]);

  // 60fps requestAnimationFrame Kinematic & Autonomous Gaze/Blink/Companion Engine
  useEffect(() => {
    if (reduceMotion) {
      setFrame(createInitialFrame(isStanding, npcAction));
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

      // 1. Posture blend (1 = Standing Weather Showcase, 0 = Seated Cozy NPC Behavior in same weather outfit!)
      const targetStand = p.npcMode ? (p.isStanding ? 1 : 0) : 1;
      const blendSpeed = targetStand > st.standBlend ? 8.5 : 6.2; // ~320ms stand up, ~400ms settle down
      st.standBlend += (targetStand - st.standBlend) * Math.min(1, dtSec * blendSpeed);
      if (Math.abs(targetStand - st.standBlend) < 0.003) {
        st.standBlend = targetStand;
      }

      const isSeated = st.standBlend < 0.5;

      // 2. Natural Autonomous Eye Blinking (every 2.4s - 5.2s, 130ms curve, 20% double-blink)
      if (st.blinkStartMs < 0 && nowMs >= st.nextBlinkAtMs) {
        st.blinkStartMs = nowMs;
        st.blinkDurationMs = 130;
        if (!st.pendingDoubleBlink && Math.random() < 0.22) {
          st.pendingDoubleBlink = true;
        } else {
          st.pendingDoubleBlink = false;
        }
      }

      let blinkAmount = 0;
      if (st.blinkStartMs >= 0) {
        const blinkT = (nowMs - st.blinkStartMs) / st.blinkDurationMs;
        if (blinkT >= 1) {
          st.blinkStartMs = -1;
          if (st.pendingDoubleBlink) {
            st.nextBlinkAtMs = nowMs + 85;
          } else {
            st.nextBlinkAtMs = nowMs + 2400 + Math.random() * 2800;
          }
        } else {
          blinkAmount = Math.sin(blinkT * Math.PI);
        }
      }

      // 3. Autonomous Eye Saccades when user cursor is idle
      if (nowMs > st.pointerActiveUntilMs) {
        if (nowMs >= st.nextSaccadeAtMs) {
          if (isSeated) {
            switch (p.npcAction) {
              case 'reading_book': {
                // Scan left-to-right across book lines, occasionally glance at user
                const glanceUp = Math.random() < 0.18;
                st.saccadeX = glanceUp ? 0 : (Math.random() - 0.5) * 0.85;
                st.saccadeY = glanceUp ? -0.05 : 0.44 + Math.random() * 0.12;
                st.nextSaccadeAtMs = nowMs + (glanceUp ? 900 : 650 + Math.random() * 750);
                break;
              }
              case 'petting_cat': {
                // Look warmly down-right at the ginger kitten (or glance at user)
                const lookAtUser = Math.random() < 0.25;
                st.saccadeX = lookAtUser ? 0.08 : 0.52 + Math.random() * 0.16;
                st.saccadeY = lookAtUser ? 0 : 0.48 + Math.random() * 0.12;
                st.nextSaccadeAtMs = nowMs + 1100 + Math.random() * 1300;
                break;
              }
              case 'petting_puppy': {
                // Look warmly down-left at the Corgi puppy (or glance at user)
                const lookAtUser = Math.random() < 0.25;
                st.saccadeX = lookAtUser ? -0.08 : -0.52 - Math.random() * 0.16;
                st.saccadeY = lookAtUser ? 0 : 0.48 + Math.random() * 0.12;
                st.nextSaccadeAtMs = nowMs + 1100 + Math.random() * 1300;
                break;
              }
              case 'scrolling_phone': {
                // Look down at smartphone feed, occasionally peek up at user
                const peekUser = Math.random() < 0.24;
                st.saccadeX = peekUser ? 0 : (Math.random() - 0.5) * 0.24;
                st.saccadeY = peekUser ? -0.04 : 0.46 + Math.random() * 0.12;
                st.nextSaccadeAtMs = nowMs + (peekUser ? 1050 : 800 + Math.random() * 900);
                break;
              }
              case 'listening_music':
              default: {
                st.saccadeX = Math.sin(elapsedSec * 1.1) * 0.42;
                st.saccadeY = -0.1 + Math.cos(elapsedSec * 0.8) * 0.14;
                st.nextSaccadeAtMs = nowMs + 950;
                break;
              }
            }
          } else {
            // Standing weather observation saccades
            if (p.sceneId === 'light_rain_umbrella' || p.sceneId === 'storm_raincoat') {
              const checkSky = Math.random() < 0.45;
              st.saccadeX = (Math.random() - 0.5) * 0.65;
              st.saccadeY = checkSky ? -0.38 : 0.05;
            } else {
              st.saccadeX = (Math.random() - 0.5) * 0.58;
              st.saccadeY = (Math.random() - 0.5) * 0.32;
            }
            st.nextSaccadeAtMs = nowMs + 1400 + Math.random() * 1800;
          }
        }
        st.targetGazeX = st.saccadeX;
        st.targetGazeY = st.saccadeY;
      }

      // Smooth spring interpolation for Eye Gaze
      const gazeLerp = Math.min(1, dtSec * 10.5);
      st.gazeX += (st.targetGazeX - st.gazeX) * gazeLerp;
      st.gazeY += (st.targetGazeY - st.gazeY) * gazeLerp;

      // 4. Breathing, Body Sway & Head Tilt
      const breathPhase = elapsedSec * 2.2;
      let swayDeg = Math.sin(elapsedSec * 1.35) * 1.6;
      let targetHeadTilt = st.gazeX * 5.2 + Math.sin(elapsedSec * 1.1) * 1.4;

      if (isSeated) {
        if (p.npcAction === 'listening_music') {
          swayDeg = Math.sin(elapsedSec * 3.1) * 3.1;
          targetHeadTilt = Math.sin(elapsedSec * 3.1 + 0.4) * 5.4 + st.gazeX * 3.5;
        } else if (p.npcAction === 'reading_book') {
          swayDeg = Math.sin(elapsedSec * 1.1) * 1.1;
          targetHeadTilt = st.gazeX * 4.2 + Math.sin(elapsedSec * 1.8) * 1.6;
        } else if (p.npcAction === 'petting_cat') {
          swayDeg = 1.4 + Math.sin(elapsedSec * 1.6) * 1.4;
          targetHeadTilt = 4.2 + Math.sin(elapsedSec * 2.1) * 2.2;
        } else if (p.npcAction === 'petting_puppy') {
          swayDeg = -1.4 + Math.sin(elapsedSec * 1.7) * 1.4;
          targetHeadTilt = -4.2 + Math.sin(elapsedSec * 2.2) * 2.2;
        }
      } else {
        if (p.sceneId === 'storm_raincoat') {
          swayDeg = -2.4 + Math.sin(elapsedSec * 2.8) * 2.6;
          targetHeadTilt = -3.2 + Math.sin(elapsedSec * 2.6) * 2.4 + st.gazeX * 3.5;
        } else if (p.sceneId === 'freezing_puffer') {
          swayDeg = Math.sin(elapsedSec * 1.5) * 1.3 + Math.sin(elapsedSec * 18) * 0.35;
        }
      }

      st.prevHeadTiltDeg = st.headTiltDeg;
      st.headTiltDeg += (targetHeadTilt - st.headTiltDeg) * Math.min(1, dtSec * 8.5);

      // Secondary hair / twin-bun / scarf physics lag
      const headVelocity = (st.headTiltDeg - st.prevHeadTiltDeg) / dtSec;
      const targetLag =
        -st.headTiltDeg * 0.45 -
        Math.max(-12, Math.min(12, headVelocity * 0.08)) +
        Math.sin(elapsedSec * (p.sceneId === 'storm_raincoat' ? 4.2 : 2.1)) *
          (p.sceneId === 'storm_raincoat' ? 5.5 : 2.2);
      st.secondaryLagDeg += (targetLag - st.secondaryLagDeg) * Math.min(1, dtSec * 7.5);

      // 5. Walking Cat & Corgi Puppy Companion Kinematics
      let petX = p.npcAction === 'petting_cat' ? 212 : 106;
      let petWalking = false;
      const petFacingLeft = p.npcAction === 'petting_cat';
      let petBeingPetted = false;

      if (isSeated && (p.npcAction === 'petting_cat' || p.npcAction === 'petting_puppy')) {
        const walkDurationMs = 1750;
        const walkProgress = Math.min(1, Math.max(0, (nowMs - st.petEnteredAtMs) / walkDurationMs));
        const easedWalk = 1 - Math.pow(1 - walkProgress, 2.4);
        if (p.npcAction === 'petting_cat') {
          petX = 295 + (212 - 295) * easedWalk;
        } else {
          petX = 25 + (106 - 25) * easedWalk;
        }
        petWalking = walkProgress < 0.98;
        petBeingPetted = walkProgress >= 0.92;
      }

      if (nowMs >= st.petNextBlinkAtMs) {
        st.petBlinkUntilMs = nowMs + 140;
        st.petNextBlinkAtMs = nowMs + 2700 + Math.random() * 2300;
      }
      const petBlinkClosed = nowMs < st.petBlinkUntilMs;

      // 6. Articulated Left & Right Arm Joint Kinematics
      const isWaving = nowMs < st.waveUntilMs;
      let targetLeftArm = 18 + Math.sin(elapsedSec * 1.6) * 4.5;
      let targetRightArm = -18 - Math.sin(elapsedSec * 1.6) * 4.5;

      if (isWaving) {
        // Enthusiastic right-arm greeting wave (-135deg <-> -105deg)
        targetRightArm = -120 + Math.sin(elapsedSec * 11.5) * 16;
        targetLeftArm = 22 + Math.sin(elapsedSec * 3.2) * 5;
      } else if (isSeated) {
        switch (p.npcAction) {
          case 'reading_book':
            targetLeftArm = -34 + Math.sin(elapsedSec * 1.2) * 2.5;
            targetRightArm = 32 + Math.max(0, Math.sin(elapsedSec * 1.9)) * 12;
            break;
          case 'petting_cat':
            targetLeftArm = 16 + Math.sin(elapsedSec * 1.4) * 3;
            // Reach down toward the kitten at x=212 and stroke its head up and down!
            targetRightArm = petBeingPetted
              ? -44 + Math.sin(elapsedSec * 4.6) * 13
              : -26;
            break;
          case 'petting_puppy':
            // Reach down toward the Corgi puppy at x=106 and stroke its head up and down!
            targetLeftArm = petBeingPetted
              ? 44 + Math.sin(elapsedSec * 4.8) * 13
              : 26;
            targetRightArm = -16 - Math.sin(elapsedSec * 1.4) * 3;
            break;
          case 'scrolling_phone':
            targetLeftArm = -36 + Math.sin(elapsedSec * 1.5) * 2;
            targetRightArm = 28 + Math.sin(elapsedSec * 3.4) * 9.5;
            break;
          case 'listening_music':
          default:
            targetLeftArm = -28 + Math.sin(elapsedSec * 3.1) * 4;
            targetRightArm = 26 - Math.sin(elapsedSec * 3.1) * 4;
            break;
        }
      } else {
        // Weather-specific standing outfit showcase gesture
        switch (p.sceneId) {
          case 'light_rain_umbrella':
            targetRightArm = -46 + Math.sin(elapsedSec * 1.8) * 3.5;
            targetLeftArm = 28 + Math.sin(elapsedSec * 1.5) * 5;
            break;
          case 'storm_raincoat':
            targetRightArm = -108 + Math.sin(elapsedSec * 3.4) * 7;
            targetLeftArm = 26 + Math.cos(elapsedSec * 2.8) * 6;
            break;
          case 'freezing_puffer':
            targetLeftArm = -38 + Math.sin(elapsedSec * 5.5) * 3;
            targetRightArm = 38 - Math.sin(elapsedSec * 5.5) * 3;
            break;
          case 'chilly_cozy':
            targetLeftArm = -24 + Math.sin(elapsedSec * 1.5) * 3;
            targetRightArm = 24 - Math.sin(elapsedSec * 1.5) * 3;
            break;
          default:
            targetLeftArm = 18 + Math.sin(elapsedSec * 1.6) * 4.5;
            targetRightArm = -18 - Math.sin(elapsedSec * 1.6) * 4.5;
            break;
        }
      }

      st.leftArmDeg += (targetLeftArm - st.leftArmDeg) * Math.min(1, dtSec * 11);
      st.rightArmDeg += (targetRightArm - st.rightArmDeg) * Math.min(1, dtSec * 11);

      // 7. Interactive Hop Bounce Curve
      let hopOffsetY = 0;
      if (st.hopStartMs >= 0) {
        const hopElapsed = (nowMs - st.hopStartMs) / 420;
        if (hopElapsed >= 1) {
          st.hopStartMs = -1;
        } else {
          hopOffsetY = -Math.sin(hopElapsed * Math.PI) * 14 * (1 - hopElapsed * 0.35);
        }
      }

      const happySquint = nowMs < st.happySquintUntilMs;

      setFrame({
        standBlend: st.standBlend,
        breathPhase,
        swayDeg,
        headTiltDeg: st.headTiltDeg,
        gazeX: st.gazeX,
        gazeY: st.gazeY,
        blinkAmount,
        happySquint,
        leftArmDeg: st.leftArmDeg,
        rightArmDeg: st.rightArmDeg,
        secondaryLagDeg: st.secondaryLagDeg,
        propClock: elapsedSec * 2.2,
        hopOffsetY,
        petX,
        petWalking,
        petFacingLeft,
        petBeingPetted,
        petBlinkClosed,
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
  }, [reduceMotion, isStanding, npcAction]);

  // Interactive Tap / Click -> Stand up (or wave/hop if already standing) with happy squint & waving right arm!
  const handleCharacterPress = useCallback(() => {
    if (!interactive) {
      return;
    }

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const st = rigRef.current;
    st.waveUntilMs = now + 2600;
    st.happySquintUntilMs = now + 1850;
    st.hopStartMs = now;

    if (npcMode) {
      npcStage.interactWithCharacter();
    }
  }, [interactive, npcMode, npcStage]);

  // Direct stage pointer tracking + head-petting stroke detector
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

        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const st = rigRef.current;
        st.targetGazeX = nx;
        st.targetGazeY = ny;
        st.pointerActiveUntilMs = now + 2600;

        // Detect back-and-forth head petting gesture across the upper half of the character
        if (ny < 0.05 && Math.abs(nx) < 0.55) {
          const deltaX = Math.abs(nx - st.lastPointerX);
          st.strokeAccum = Math.min(2.5, st.strokeAccum + deltaX);
          if (st.strokeAccum > 0.85) {
            st.happySquintUntilMs = now + 1500;
            st.strokeAccum = 0;
          }
        } else {
          st.strokeAccum *= 0.85;
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

  const npcLabelVi =
    NATURAL_NPC_LABELS[npcAction] ??
    NPC_ACTION_META[npcAction]?.labelVi ??
    'Đang thư giãn';
  const a11yDescription = npcMode
    ? isStanding
      ? `${profile?.nameVi ?? gender} · ${sceneMeta?.labelVi ?? sceneId}`
      : `${profile?.nameVi ?? gender} · ${npcLabelVi} (${sceneMeta?.labelVi ?? sceneId}). Chạm để tương tác`
    : `${profile?.nameVi ?? gender} · ${sceneMeta?.labelVi ?? sceneId}`;

  return (
    <View style={styles.rigOuterStack}>
      <View
        ref={stageRef}
        style={[styles.rigCanvas, { width: size * 1.08, height: size }]}
      >
        {/* Ambient Atmospheric Backlight Halo */}
        <View
          pointerEvents="none"
          style={[
            styles.auraOrb,
            {
              width: size * 0.84,
              height: size * 0.84,
              borderRadius: size * 0.42,
              backgroundColor: auraColor,
              opacity: 0.64 + Math.sin(frame.breathPhase) * 0.12,
              transform: [
                { translateX: -frame.gazeX * 3 },
                { translateY: -frame.gazeY * 2 },
                { scale: 1 + Math.sin(frame.breathPhase) * 0.03 },
              ],
            },
          ]}
        />

        {/* Daytime-only Solar / Heat Shimmer Ring (NEVER on clear_night!) */}
        {showAmbientProps &&
          (sceneMotion.ambientProp === 'sun_halo' ||
            sceneMotion.ambientProp === 'heat_shimmer') && (
            <View
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
                  opacity: 0.38 + Math.sin(frame.breathPhase) * 0.14,
                },
              ]}
            />
          )}

        {/* Calm Night Starlight Ring (clear_night — zero sun rays!) */}
        {showAmbientProps && sceneMotion.ambientProp === 'starlight_aura' && (
          <View
            pointerEvents="none"
            style={[
              styles.solarShimmerRing,
              {
                width: size * 0.9,
                height: size * 0.9,
                borderRadius: size * 0.45,
                borderColor: 'rgba(147, 197, 253, 0.24)',
                opacity: 0.34 + Math.sin(frame.breathPhase) * 0.12,
              },
            ]}
          />
        )}

        {/* Interactive Accessible Pressable Wrapping the 60fps Articulated Chibi SVG Rig */}
        <Pressable
          disabled={!interactive}
          onPress={handleCharacterPress}
          accessibilityRole={interactive ? 'button' : 'image'}
          accessibilityLabel={a11yDescription}
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
          <Svg
            width={size}
            height={size}
            viewBox="0 0 320 320"
          >
            <ArticulatedChibiSvg
              gender={gender}
              sceneId={sceneId}
              npcAction={npcAction}
              frame={frame}
            />
          </Svg>
        </Pressable>

        {/* Subtle 28px Shuffle Button (🔀) in Top-Right Stage Corner */}
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
                opacity: pressed ? 0.92 : 0.82,
                transform: [{ scale: pressed ? 0.92 : 1 }],
              },
            ]}
          >
            <Feather name="shuffle" size={12} color={palette.inkSecondary} />
          </Pressable>
        )}

        {/* Compact Natural NPC Activity / Weather Showcase Pill in Bottom Corner */}
        {npcMode && interactive && (
          <Pressable
            onPress={npcStage.shuffleNpcAction}
            accessibilityRole="button"
            accessibilityLabel={`Hoạt động hiện tại: ${
              isStanding ? sceneMeta?.labelVi ?? 'Trang phục thời tiết' : npcLabelVi
            }. Chạm để đổi hoạt động`}
            style={({ pressed }) => [
              styles.npcActionPill,
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
                opacity: pressed ? 0.95 : 0.88,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              },
            ]}
          >
            <View
              style={[
                styles.npcLiveDot,
                {
                  backgroundColor: isStanding ? palette.accent : '#10B981',
                },
              ]}
            />
            <Text
              numberOfLines={1}
              style={[styles.npcActionPillText, { color: palette.inkPrimary }]}
            >
              {isStanding ? sceneMeta?.labelVi ?? 'Đổi trang phục' : npcLabelVi}
            </Text>
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
  npcActionPill: {
    position: 'absolute',
    bottom: 4,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    zIndex: 6,
  },
  npcLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  npcActionPillText: {
    fontFamily: FONT_FAMILY_SANS,
    fontWeight: '600',
    fontSize: 11,
    lineHeight: 14,
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
});

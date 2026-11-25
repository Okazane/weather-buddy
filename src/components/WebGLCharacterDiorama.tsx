import React, { useEffect, useMemo, useRef } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
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
import type { WeatherSnapshot } from '../core';
import type { AtmosphericPalette } from './themeTokens';

export interface WebGLCharacterDioramaProps {
  gender: Gender;
  sceneId: CharacterSceneId;
  palette: AtmosphericPalette;
  size: number;
  weather?: WeatherSnapshot;
  customVrmUrl?: string | null;
  reduceMotion?: boolean;
  interactive?: boolean;
  showAmbientProps?: boolean;
  npcMode?: boolean;
  isStanding?: boolean;
  npcAction?: NpcActionId;
  standTriggerCount?: number;
  onInteract?: () => void;
  onWebGLUnavailable?: () => void;
}

const CANONICAL_LANDMARKS = {
  canvasSize: 768,
  leftEyeX: 327,
  rightEyeX: 441,
  eyeY: 296,
  soleY: 692,
} as const;

type HitZoneKind = 'head' | 'cheek' | 'body';

interface BurstParticleState {
  active: boolean;
  kind: HitZoneKind;
  startedAtMs: number;
  positions: Float32Array;
  velocities: Float32Array;
}

function resolveWebAssetUri(asset: any): string {
  if (!asset) {
    return '';
  }
  if (typeof asset === 'string') {
    return asset;
  }
  if (typeof asset === 'object') {
    if (typeof asset.uri === 'string') {
      return asset.uri;
    }
    if (typeof asset.default === 'string') {
      return asset.default;
    }
    if (asset.default && typeof asset.default.uri === 'string') {
      return asset.default.uri;
    }
  }
  const resolveFn = (Image as any)?.resolveAssetSource;
  if (typeof resolveFn === 'function') {
    const resolved = resolveFn(asset);
    if (resolved && typeof resolved.uri === 'string') {
      return resolved.uri;
    }
  }
  return String(asset);
}

function createSoftRadialTexture(
  innerColor: string,
  outerColor: string,
  size = 128
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  const half = size * 0.5;
  const grad = ctx.createRadialGradient(half, half, 1, half, half, half);
  grad.addColorStop(0, innerColor);
  grad.addColorStop(0.55, innerColor);
  grad.addColorStop(1, outerColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createFootAnchoredReliefGeometry(
  width: number,
  height: number,
  segX: number,
  segY: number,
  convexDepth: number,
  soleRatio = CANONICAL_LANDMARKS.soleY / CANONICAL_LANDMARKS.canvasSize
): {
  geometry: THREE.PlaneGeometry;
  basePositions: Float32Array;
} {
  const geometry = new THREE.PlaneGeometry(width, height, segX, segY);
  // Shift plane vertically so y = 0 in local space corresponds to the character's soles
  const soleOffsetFromCenterY = (0.5 - soleRatio) * height;
  geometry.translate(0, -soleOffsetFromCenterY, 0);

  const posAttr = geometry.attributes.position as THREE.BufferAttribute;
  const arr = posAttr.array as Float32Array;
  const centerY = height * 0.45;
  const halfW = width * 0.46;
  const halfH = height * 0.5;

  for (let i = 0; i < posAttr.count; i += 1) {
    const idx = i * 3;
    const vx = arr[idx];
    const vy = arr[idx + 1];
    const nx = vx / halfW;
    const ny = (vy - centerY) / halfH;
    const r2 = nx * nx + ny * ny;
    const dome = Math.max(0, 1 - r2 * 0.68);
    arr[idx + 2] = Math.pow(dome, 1.25) * convexDepth;
  }

  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();

  return {
    geometry,
    basePositions: new Float32Array(arr),
  };
}

/**
 * Eye blinking disabled per user preference: always returns 0 so studio 3D eyes remain 100% open.
 */
export function evaluateAsymmetricBlinkCurve(_bt: number): number {
  return 0;
}

function compositeCharacterFaceCanvas(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  opts: {
    gazeX: number;
    gazeY: number;
    cheekBlushAmount: number;
    isWearingSunglasses: boolean;
  }
) {
  const S = CANONICAL_LANDMARKS.canvasSize;
  ctx.clearRect(0, 0, S, S);
  ctx.drawImage(img, 0, 0, S, S);

  const gazeShiftX = opts.gazeX * 5.8;
  const gazeShiftY = opts.gazeY * 4.5;

  // Warm rosy cheek glow on head-pat or cheek-poke
  if (opts.cheekBlushAmount > 0.02) {
    ctx.save();
    const alpha = Math.min(0.68, opts.cheekBlushAmount * 0.65);
    const drawCheek = (cx: number, cy: number) => {
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 34);
      grad.addColorStop(0, `rgba(251, 113, 133, ${alpha})`);
      grad.addColorStop(0.6, `rgba(244, 114, 182, ${alpha * 0.45})`);
      grad.addColorStop(1, 'rgba(251, 113, 133, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 34, 0, Math.PI * 2);
      ctx.fill();
    };
    drawCheek(284, 332);
    drawCheek(484, 332);
    ctx.restore();
  }

  if (opts.isWearingSunglasses) {
    // Moving 3D specular sun glint on sunglasses lenses
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    const drawLensGlint = (lx: number, ly: number) => {
      ctx.save();
      ctx.translate(lx + gazeShiftX * 1.25, ly + gazeShiftY * 0.95);
      ctx.rotate((-22 * Math.PI) / 180);
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    drawLensGlint(316, 284);
    drawLensGlint(430, 284);
    ctx.restore();
  }
}

export const WebGLCharacterDiorama: React.FC<WebGLCharacterDioramaProps> = ({
  gender,
  sceneId,
  palette,
  size,
  weather,
  customVrmUrl = null,
  reduceMotion = false,
  interactive = true,
  showAmbientProps = true,
  npcMode = false,
  isStanding = true,
  npcAction = 'reading_book',
  standTriggerCount = 0,
  onInteract,
  onWebGLUnavailable,
}) => {
  const hostRef = useRef<View | null>(null);
  const profile = CHARACTER_PROFILES[gender];
  const sceneMeta = SCENE_VISUAL_META[sceneId];
  const sceneMotion =
    SCENE_MOTION_PROFILES[sceneId] ?? SCENE_MOTION_PROFILES.pleasant_sunny;

  const spriteAsset = useMemo(
    () => getCharacterSprite(gender, sceneId),
    [gender, sceneId]
  );
  const spriteUri = useMemo(() => resolveWebAssetUri(spriteAsset), [spriteAsset]);
  const catUri = useMemo(() => resolveWebAssetUri(COMPANION_SPRITES.cat), []);
  const puppyUri = useMemo(() => resolveWebAssetUri(COMPANION_SPRITES.puppy), []);

  const windSpeedKmh = weather?.windSpeedKmh ?? (sceneId === 'storm_raincoat' ? 34 : 10);
  const precipMmPerHr =
    weather?.precipMmPerHr ??
    (sceneId === 'storm_raincoat'
      ? 6.0
      : sceneId === 'light_rain_umbrella'
        ? 1.5
        : 0);

  const livePropsRef = useRef({
    gender,
    sceneId,
    palette,
    size,
    windSpeedKmh,
    precipMmPerHr,
    customVrmUrl,
    reduceMotion,
    interactive,
    showAmbientProps,
    npcMode,
    isStanding,
    npcAction,
    spriteUri,
    catUri,
    puppyUri,
    sceneMotion,
    onInteract,
  });
  livePropsRef.current = {
    gender,
    sceneId,
    palette,
    size,
    windSpeedKmh,
    precipMmPerHr,
    customVrmUrl,
    reduceMotion,
    interactive,
    showAmbientProps,
    npcMode,
    isStanding,
    npcAction,
    spriteUri,
    catUri,
    puppyUri,
    sceneMotion,
    onInteract,
  };

  const nowInit = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const stateRef = useRef({
    startTimeMs: nowInit,
    lastFrameMs: nowInit,
    // Turntable drag rotation & cursor parallax
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragMovedPx: 0,
    turntableAngleY: 0,
    targetTurntableAngleY: 0,
    pointerNdcX: 0,
    pointerNdcY: 0,
    gazeX: 0,
    gazeY: 0,
    targetGazeX: 0,
    targetGazeY: 0,
    pointerActiveUntilMs: 0,
    nextSaccadeAtMs: nowInit + 1400,
    saccadeX: 0,
    saccadeY: 0,
    lastCanvasGazeX: -99,
    lastCanvasGazeY: -99,
    lastCanvasBlush: -1,
    // 3 Hit-Zone interactive reactions
    headPatUntilMs: 0,
    cheekPokeUntilMs: 0,
    bodyHopStartMs: -1,
    strokeAccum: 0,
    lastStrokeX: 0,
    // Companion pet state
    activePetKind: null as 'cat' | 'puppy' | null,
    petEnteredAtMs: nowInit,
    // Loaded image reference for offscreen 768x768 face compositor
    loadedCharImage: null as HTMLImageElement | null,
    loadedCharUri: '',
    faceCanvasDirty: true,
    // Loaded VRM instance (Mode B)
    activeVrm: null as VRM | null,
    activeVrmUrl: null as string | null,
    activeVrmBaseY: 0,
    // Burst trigger
    pendingBurstZone: null as HitZoneKind | null,
  });

  // Trigger joyful bounce when outfit/gender/standTriggerCount changes
  const prevSceneRef = useRef(sceneId);
  const prevGenderRef = useRef(gender);
  const prevTriggerRef = useRef(standTriggerCount);

  useEffect(() => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const changed =
      prevSceneRef.current !== sceneId ||
      prevGenderRef.current !== gender ||
      prevTriggerRef.current !== standTriggerCount;
    prevSceneRef.current = sceneId;
    prevGenderRef.current = gender;
    prevTriggerRef.current = standTriggerCount;

    if (changed && !reduceMotion) {
      stateRef.current.bodyHopStartMs = now;
      stateRef.current.headPatUntilMs = now + 1150;
      stateRef.current.pendingBurstZone = 'body';
    }
  }, [sceneId, gender, standTriggerCount, reduceMotion]);

  // Track 3D companion arrival when 5-minute NPC mode enters petting_cat or petting_puppy
  useEffect(() => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const wantedPet =
      npcMode && !isStanding
        ? npcAction === 'petting_cat'
          ? 'cat'
          : npcAction === 'petting_puppy'
            ? 'puppy'
            : null
        : null;
    if (stateRef.current.activePetKind !== wantedPet) {
      stateRef.current.activePetKind = wantedPet;
      stateRef.current.petEnteredAtMs = now;
    }
  }, [npcMode, isStanding, npcAction]);

  // Load 768x768 character image for dynamic face canvas compositor
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !spriteUri) {
      return;
    }
    let cancelled = false;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!cancelled) {
        stateRef.current.loadedCharImage = img;
        stateRef.current.loadedCharUri = spriteUri;
        stateRef.current.faceCanvasDirty = true;
      }
    };
    img.src = spriteUri;
    return () => {
      cancelled = true;
    };
  }, [spriteUri]);

  // Main WebGL Three.js + @pixiv/three-vrm Diorama Setup
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }
    const container = hostRef.current as unknown as HTMLElement | null;
    if (!container) {
      return;
    }

    const canvas = document.createElement('canvas');
    const stageWidth = Math.round(livePropsRef.current.size * 1.08);
    const stageHeight = Math.round(livePropsRef.current.size);
    canvas.style.width = `${stageWidth}px`;
    canvas.style.height = `${stageHeight}px`;
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    canvas.style.userSelect = 'none';
    canvas.style.cursor = livePropsRef.current.interactive ? 'grab' : 'default';

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      onWebGLUnavailable?.();
      return;
    }

    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(stageWidth, stageHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setClearColor(0x000000, 0);

    container.innerHTML = '';
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      34,
      stageWidth / Math.max(1, stageHeight),
      0.1,
      25
    );
    camera.position.set(0, 0.22, 3.85);
    camera.lookAt(0, 0.14, 0);

    // 1. Studio 3-Point Pop Mart Collectible Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.35);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfffaf0, 1.45);
    keyLight.position.set(1.8, 2.6, 2.8);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.72);
    fillLight.position.set(-2.2, 1.2, 1.8);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0x93c5fd, 1.2, 7);
    rimLight.position.set(0, 1.1, -1.5);
    scene.add(rimLight);

    // 3D LookAt Target for @pixiv/three-vrm Mode B
    const lookAtTarget = new THREE.Object3D();
    lookAtTarget.position.set(0, 0.35, 2.5);
    scene.add(lookAtTarget);

    // 2. Sculpted 3D Blind-Box Collectible Turntable Pedestal Group
    const turntableGroup = new THREE.Group();
    scene.add(turntableGroup);

    const pedestalY = -0.74;

    // Outer chamfered vinyl/ceramic base cylinder
    const baseGeo = new THREE.CylinderGeometry(0.88, 0.96, 0.14, 56);
    const baseMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(livePropsRef.current.palette.isDark ? '#1e293b' : '#f8fafc'),
      roughness: 0.3,
      metalness: 0.1,
      clearcoat: 0.5,
      clearcoatRoughness: 0.22,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = pedestalY - 0.07;
    turntableGroup.add(baseMesh);

    // Upper inset platter disc
    const platterGeo = new THREE.CylinderGeometry(0.81, 0.84, 0.036, 56);
    const platterMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(livePropsRef.current.palette.isDark ? '#0f172a' : '#ffffff'),
      roughness: 0.38,
      metalness: 0.06,
    });
    const platterMesh = new THREE.Mesh(platterGeo, platterMat);
    platterMesh.position.y = pedestalY + 0.008;
    turntableGroup.add(platterMesh);

    // Glowing accent rim ring around turntable
    const rimRingGeo = new THREE.TorusGeometry(0.855, 0.015, 16, 72);
    const rimRingMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(livePropsRef.current.palette.accent),
      emissive: new THREE.Color(livePropsRef.current.palette.accent),
      emissiveIntensity: 0.7,
      roughness: 0.2,
      metalness: 0.2,
    });
    const rimRingMesh = new THREE.Mesh(rimRingGeo, rimRingMat);
    rimRingMesh.rotation.x = Math.PI * 0.5;
    rimRingMesh.position.y = pedestalY + 0.012;
    turntableGroup.add(rimRingMesh);

    // Soft grounded contact shadow disc on top of pedestal platter
    const shadowTex = createSoftRadialTexture('rgba(15, 23, 42, 0.46)', 'rgba(15, 23, 42, 0)');
    const shadowGeo = new THREE.CircleGeometry(0.5, 40);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.72,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI * 0.5;
    shadowMesh.position.y = pedestalY + 0.028;
    turntableGroup.add(shadowMesh);

    // Atmospheric Backlight Halo Disc + Rotating Sunbeam / Starlight Ring
    const haloTex = createSoftRadialTexture('rgba(255, 255, 255, 0.52)', 'rgba(255, 255, 255, 0)');
    const haloGeo = new THREE.PlaneGeometry(2.15, 2.15);
    const haloMat = new THREE.MeshBasicMaterial({
      map: haloTex,
      color: new THREE.Color(livePropsRef.current.palette.accent),
      transparent: true,
      depthWrite: false,
      opacity: 0.35,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.position.set(0, 0.25, -0.35);
    scene.add(haloMesh);

    const sunHaloRingGeo = new THREE.TorusGeometry(0.95, 0.008, 12, 72);
    const sunHaloRingMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(livePropsRef.current.palette.accent),
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    });
    const sunHaloRingMesh = new THREE.Mesh(sunHaloRingGeo, sunHaloRingMat);
    sunHaloRingMesh.position.set(0, 0.25, -0.25);
    scene.add(sunHaloRingMesh);

    // 3. Mode A: Curved 3D Relief Diorama Character Mesh (24x24 grid anchored at feet y=0)
    const charCanvas = document.createElement('canvas');
    charCanvas.width = CANONICAL_LANDMARKS.canvasSize;
    charCanvas.height = CANONICAL_LANDMARKS.canvasSize;
    const charCtx = charCanvas.getContext('2d');

    const charTexture = new THREE.CanvasTexture(charCanvas);
    charTexture.colorSpace = THREE.SRGBColorSpace;
    charTexture.minFilter = THREE.LinearFilter;
    charTexture.magFilter = THREE.LinearFilter;
    charTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

    const { geometry: charGeo } =
      createFootAnchoredReliefGeometry(2.08, 2.08, 24, 24, 0.14);

    // GPU Vertex Shader uniforms: zero CPU vertex loop & zero per-frame buffer upload
    const charWindUniforms = {
      uWindBendX: { value: 0 },
      uWindBendZ: { value: 0 },
      uUpperTiltX: { value: 0 },
      uUpperLiftZ: { value: 0 },
    };

    const charMat = new THREE.MeshStandardMaterial({
      map: charTexture,
      transparent: true,
      alphaTest: 0.03,
      roughness: 0.42,
      metalness: 0.04,
      side: THREE.DoubleSide,
    });
    charMat.onBeforeCompile = (shader) => {
      shader.uniforms.uWindBendX = charWindUniforms.uWindBendX;
      shader.uniforms.uWindBendZ = charWindUniforms.uWindBendZ;
      shader.uniforms.uUpperTiltX = charWindUniforms.uUpperTiltX;
      shader.uniforms.uUpperLiftZ = charWindUniforms.uUpperLiftZ;
      shader.vertexShader =
        `uniform float uWindBendX;\nuniform float uWindBendZ;\nuniform float uUpperTiltX;\nuniform float uUpperLiftZ;\n` +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float wbHFactor = clamp(position.y / 1.95, 0.0, 1.0);
          float wbUpperFactor = max(0.0, (wbHFactor - 0.38) / 0.62);
          transformed.x += wbHFactor * wbHFactor * uWindBendX + wbUpperFactor * uUpperTiltX;
          transformed.z += wbHFactor * uWindBendZ + wbUpperFactor * uUpperLiftZ;`
        );
    };
    const characterMesh = new THREE.Mesh(charGeo, charMat);
    characterMesh.position.set(0, pedestalY + 0.025, 0.02);
    turntableGroup.add(characterMesh);

    // 4. Mode A: 3D Companion Depth Layer (Ginger Kitten & Corgi Puppy on Pedestal at +Z)
    const texLoader = new THREE.TextureLoader();
    const catTexture = texLoader.load(livePropsRef.current.catUri);
    catTexture.colorSpace = THREE.SRGBColorSpace;
    const puppyTexture = texLoader.load(livePropsRef.current.puppyUri);
    puppyTexture.colorSpace = THREE.SRGBColorSpace;

    const { geometry: petGeo } = createFootAnchoredReliefGeometry(
      0.66,
      0.66,
      12,
      12,
      0.07,
      0.9
    );
    const petMat = new THREE.MeshStandardMaterial({
      map: catTexture,
      transparent: true,
      alphaTest: 0.04,
      roughness: 0.42,
      metalness: 0.04,
      side: THREE.DoubleSide,
    });
    const petMesh = new THREE.Mesh(petGeo, petMat);
    petMesh.position.set(0.45, pedestalY + 0.03, 0.28);
    petMesh.visible = false;
    turntableGroup.add(petMesh);

    const petShadowGeo = new THREE.CircleGeometry(0.19, 24);
    const petShadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    });
    const petShadowMesh = new THREE.Mesh(petShadowGeo, petShadowMat);
    petShadowMesh.rotation.x = -Math.PI * 0.5;
    petShadowMesh.position.set(0.45, pedestalY + 0.029, 0.28);
    petShadowMesh.visible = false;
    turntableGroup.add(petShadowMesh);

    // 5. Dynamic 3D Weather Particle & Ripple System
    // 5a. 3D Slanted Rain Streaks
    const RAIN_COUNT = 84;
    const rainPositions = new Float32Array(RAIN_COUNT * 6);
    const rainSeeds = new Float32Array(RAIN_COUNT * 4);
    for (let i = 0; i < RAIN_COUNT; i += 1) {
      rainSeeds[i * 4] = (Math.random() - 0.5) * 2.5; // x
      rainSeeds[i * 4 + 1] = -0.7 + Math.random() * 2.4; // y
      rainSeeds[i * 4 + 2] = (Math.random() - 0.5) * 1.4; // z
      rainSeeds[i * 4 + 3] = 2.6 + Math.random() * 1.6; // speed
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rainMat = new THREE.LineBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    });
    const rainLines = new THREE.LineSegments(rainGeo, rainMat);
    scene.add(rainLines);

    // 5b. Concentric 3D Water-Ripple Rings on Pedestal Surface
    const RIPPLE_COUNT = 3;
    const rippleMeshes: THREE.Mesh[] = [];
    const rippleSeeds = [
      { x: -0.32, z: 0.25, phase: 0 },
      { x: 0.36, z: 0.22, phase: 0.33 },
      { x: 0.05, z: 0.38, phase: 0.66 },
    ];
    const rippleGeo = new THREE.RingGeometry(0.055, 0.075, 32);
    for (let i = 0; i < RIPPLE_COUNT; i += 1) {
      const rMat = new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const rMesh = new THREE.Mesh(rippleGeo, rMat);
      rMesh.rotation.x = -Math.PI * 0.5;
      rMesh.position.set(rippleSeeds[i].x, pedestalY + 0.031, rippleSeeds[i].z);
      turntableGroup.add(rMesh);
      rippleMeshes.push(rMesh);
    }

    // 5c. 3D Atmospheric Motes (Snowflakes / Warm Steam / Golden Sun-Motes / Night Stars)
    const MOTE_COUNT = 56;
    const motePositions = new Float32Array(MOTE_COUNT * 3);
    const moteSeeds = new Float32Array(MOTE_COUNT * 4);
    for (let i = 0; i < MOTE_COUNT; i += 1) {
      const x = (Math.random() - 0.5) * 2.4;
      const y = -0.65 + Math.random() * 2.2;
      const z = (Math.random() - 0.5) * 1.4;
      motePositions[i * 3] = x;
      motePositions[i * 3 + 1] = y;
      motePositions[i * 3 + 2] = z;
      moteSeeds[i * 4] = x;
      moteSeeds[i * 4 + 1] = y;
      moteSeeds[i * 4 + 2] = z;
      moteSeeds[i * 4 + 3] = Math.random() * Math.PI * 2;
    }
    const moteTex = createSoftRadialTexture('rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0)', 64);
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
    const moteMat = new THREE.PointsMaterial({
      map: moteTex,
      size: 0.085,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const motePoints = new THREE.Points(moteGeo, moteMat);
    scene.add(motePoints);

    // 6. 3D Interactive Reaction Burst Particles (Hearts on Head Pat / Sparkles on Cheek / Stars on Body Tap)
    const BURST_COUNT = 16;
    const burstState: BurstParticleState = {
      active: false,
      kind: 'head',
      startedAtMs: 0,
      positions: new Float32Array(BURST_COUNT * 3),
      velocities: new Float32Array(BURST_COUNT * 3),
    };
    const burstGeo = new THREE.BufferGeometry();
    burstGeo.setAttribute('position', new THREE.BufferAttribute(burstState.positions, 3));
    const burstMat = new THREE.PointsMaterial({
      map: moteTex,
      size: 0.13,
      color: 0xfb7185,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const burstPoints = new THREE.Points(burstGeo, burstMat);
    turntableGroup.add(burstPoints);

    const trigger3DBurst = (zone: HitZoneKind, nowMs: number) => {
      burstState.active = true;
      burstState.kind = zone;
      burstState.startedAtMs = nowMs;
      const originY = zone === 'head' ? 0.85 : zone === 'cheek' ? 0.52 : 0.15;
      burstMat.color.set(
        zone === 'head' ? '#fb7185' : zone === 'cheek' ? '#f472b6' : livePropsRef.current.palette.accent
      );

      for (let i = 0; i < BURST_COUNT; i += 1) {
        const angle = (i / BURST_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
        const speed = 0.45 + Math.random() * 0.65;
        burstState.positions[i * 3] = (Math.random() - 0.5) * 0.28;
        burstState.positions[i * 3 + 1] = originY + (Math.random() - 0.5) * 0.15;
        burstState.positions[i * 3 + 2] = 0.22 + Math.random() * 0.12;

        burstState.velocities[i * 3] = Math.cos(angle) * speed * 0.7;
        burstState.velocities[i * 3 + 1] =
          zone === 'head'
            ? 0.55 + Math.random() * 0.6
            : Math.sin(angle) * speed * 0.65 + 0.35;
        burstState.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.35;
      }
      (burstGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    };

    // 7. Raycaster & Pointer Event Handlers (3D Turntable Drag-to-Rotate + 3 Distinct Hit-Zones)
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();

    const evalHitZone = (clientX: number, clientY: number): HitZoneKind => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return 'body';
      }
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);

      const targetObj = stateRef.current.activeVrm
        ? stateRef.current.activeVrm.scene
        : characterMesh;
      const hits = raycaster.intersectObject(targetObj, true);
      if (hits.length > 0) {
        const hit = hits[0];
        if (hit.uv && !stateRef.current.activeVrm) {
          if (hit.uv.y >= 0.64) {
            return 'head';
          }
          if (hit.uv.y >= 0.46) {
            return 'cheek';
          }
          return 'body';
        }
        // World-space fallback for VRM meshes (pedestalY = -0.74 to top = +1.1)
        const normH = (hit.point.y - pedestalY) / 1.82;
        if (normH >= 0.64) {
          return 'head';
        }
        if (normH >= 0.46) {
          return 'cheek';
        }
        return 'body';
      }

      // Fallback screen-space Y zone
      const ny = (clientY - rect.top) / rect.height;
      if (ny <= 0.38) {
        return 'head';
      }
      if (ny <= 0.56) {
        return 'cheek';
      }
      return 'body';
    };

    const onPointerDown = (evt: PointerEvent) => {
      if (!livePropsRef.current.interactive) {
        return;
      }
      const st = stateRef.current;
      st.isDragging = true;
      st.dragStartX = evt.clientX;
      st.dragStartY = evt.clientY;
      st.dragMovedPx = 0;
      canvas.style.cursor = 'grabbing';
      try {
        canvas.setPointerCapture(evt.pointerId);
      } catch {
        // Ignore pointer capture failure on synthetic events
      }
    };

    const onPointerMove = (evt: PointerEvent) => {
      if (!livePropsRef.current.interactive) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const st = stateRef.current;

      const nx = Math.max(-1, Math.min(1, ((evt.clientX - rect.left) / rect.width - 0.5) * 2.1));
      const ny = Math.max(-1, Math.min(1, ((evt.clientY - rect.top) / rect.height - 0.39) * 2.2));
      st.pointerNdcX = nx;
      st.pointerNdcY = ny;
      st.targetGazeX = nx;
      st.targetGazeY = ny;
      st.pointerActiveUntilMs = now + 2600;

      if (st.isDragging) {
        const dx = evt.clientX - st.dragStartX;
        const dy = evt.clientY - st.dragStartY;
        st.dragMovedPx = Math.hypot(dx, dy);
        // Rotate 3D turntable ±28° (±0.49 rad)
        const maxRad = (28 * Math.PI) / 180;
        st.targetTurntableAngleY = Math.max(
          -maxRad,
          Math.min(maxRad, (dx / (rect.width * 0.42)) * maxRad)
        );
      }

      // Head-patting stroke detector on top 36% of character
      if (ny < -0.02 && Math.abs(nx) < 0.55) {
        const deltaX = Math.abs(nx - st.lastStrokeX);
        st.strokeAccum = Math.min(2.4, st.strokeAccum + deltaX);
        if (st.strokeAccum > 0.78) {
          st.headPatUntilMs = now + 1350;
          st.strokeAccum = 0;
          trigger3DBurst('head', now);
        }
      } else {
        st.strokeAccum *= 0.86;
      }
      st.lastStrokeX = nx;
    };

    const onPointerUpOrCancel = (evt: PointerEvent) => {
      const st = stateRef.current;
      if (!st.isDragging) {
        return;
      }
      st.isDragging = false;
      st.targetTurntableAngleY = 0;
      canvas.style.cursor = livePropsRef.current.interactive ? 'grab' : 'default';

      if (st.dragMovedPx < 9 && livePropsRef.current.interactive) {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const zone = evalHitZone(evt.clientX, evt.clientY);
        if (zone === 'head') {
          st.headPatUntilMs = now + 1400;
          trigger3DBurst('head', now);
        } else if (zone === 'cheek') {
          st.cheekPokeUntilMs = now + 1250;
          trigger3DBurst('cheek', now);
        } else {
          st.bodyHopStartMs = now;
          trigger3DBurst('body', now);
        }
        livePropsRef.current.onInteract?.();
      }
    };

    const onWinPointerMove = (evt: PointerEvent) => {
      if (!livePropsRef.current.interactive || livePropsRef.current.reduceMotion) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }
      const eyeCenterX = rect.left + rect.width * 0.5;
      const eyeCenterY = rect.top + rect.height * (CANONICAL_LANDMARKS.eyeY / 768);
      const dx = (evt.clientX - eyeCenterX) / (rect.width * 0.72);
      const dy = (evt.clientY - eyeCenterY) / (rect.height * 0.72);
      if (Math.abs(dx) <= 2.6 && Math.abs(dy) <= 2.4) {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const st = stateRef.current;
        st.targetGazeX = Math.max(-1, Math.min(1, dx));
        st.targetGazeY = Math.max(-1, Math.min(1, dy));
        st.pointerNdcX = st.targetGazeX;
        st.pointerNdcY = st.targetGazeY;
        st.pointerActiveUntilMs = now + 2400;
      }
    };

    const onContextLost = (evt: Event) => {
      evt.preventDefault();
      onWebGLUnavailable?.();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUpOrCancel);
    canvas.addEventListener('pointercancel', onPointerUpOrCancel);
    canvas.addEventListener('webglcontextlost', onContextLost, false);
    window.addEventListener('pointermove', onWinPointerMove, { passive: true });

    // 8. 60fps WebGL Three.js + @pixiv/three-vrm Render Loop
    let rafId: number | null = null;
    let mounted = true;
    const gltfLoader = new GLTFLoader();
    gltfLoader.register((parser) => new VRMLoaderPlugin(parser));

    const tick = (nowMs: number) => {
      if (!mounted) {
        return;
      }

      const st = stateRef.current;
      const p = livePropsRef.current;
      const dtSec = Math.min(0.064, Math.max(0.004, (nowMs - st.lastFrameMs) / 1000));
      st.lastFrameMs = nowMs;
      const elapsedSec = (nowMs - st.startTimeMs) / 1000;

      // Sync dynamic canvas dimensions if prop size changed
      const wantedW = Math.round(p.size * 1.08);
      const wantedH = Math.round(p.size);
      if (
        Math.abs(canvas.clientWidth - wantedW) > 2 ||
        Math.abs(canvas.clientHeight - wantedH) > 2
      ) {
        canvas.style.width = `${wantedW}px`;
        canvas.style.height = `${wantedH}px`;
        renderer.setSize(wantedW, wantedH, false);
        camera.aspect = wantedW / Math.max(1, wantedH);
        camera.updateProjectionMatrix();
      }

      // Sync Mode B Custom .vrm Avatar Loader
      if (p.customVrmUrl !== st.activeVrmUrl) {
        st.activeVrmUrl = p.customVrmUrl ?? null;
        if (st.activeVrm) {
          turntableGroup.remove(st.activeVrm.scene);
          VRMUtils.deepDispose(st.activeVrm.scene);
          st.activeVrm = null;
        }
        if (!st.activeVrmUrl) {
          characterMesh.visible = true;
        } else {
          const loadingUrl = st.activeVrmUrl;
          gltfLoader.load(
            loadingUrl,
            (gltf) => {
              if (!mounted || stateRef.current.activeVrmUrl !== loadingUrl) {
                if (gltf?.scene) {
                  VRMUtils.deepDispose(gltf.scene);
                }
                return;
              }
              const vrm = gltf.userData.vrm as VRM | undefined;
              if (!vrm) {
                if (gltf?.scene) {
                  VRMUtils.deepDispose(gltf.scene);
                }
                return;
              }
              VRMUtils.removeUnnecessaryVertices(gltf.scene);
              VRMUtils.combineSkeletons(gltf.scene);
              VRMUtils.rotateVRM0(vrm);

              // Auto-scale and plant feet on the 3D turntable pedestal
              const boxBefore = new THREE.Box3().setFromObject(vrm.scene);
              const sizeVec = new THREE.Vector3();
              boxBefore.getSize(sizeVec);
              const rawHeight = Math.max(0.4, sizeVec.y);
              const vrmScale = 1.78 / rawHeight;
              vrm.scene.scale.setScalar(vrmScale);

              const boxAfter = new THREE.Box3().setFromObject(vrm.scene);
              const centerAfter = new THREE.Vector3();
              boxAfter.getCenter(centerAfter);
              const baseY = pedestalY + 0.028 - boxAfter.min.y;
              vrm.scene.position.set(
                -centerAfter.x,
                baseY,
                -centerAfter.z
              );

              vrm.scene.traverse((obj) => {
                obj.frustumCulled = false;
              });

              if (vrm.lookAt) {
                vrm.lookAt.target = lookAtTarget;
                vrm.lookAt.autoUpdate = true;
              }

              turntableGroup.add(vrm.scene);
              stateRef.current.activeVrm = vrm;
              stateRef.current.activeVrmBaseY = baseY;
              characterMesh.visible = false;
            },
            undefined,
            () => {
              if (mounted) {
                characterMesh.visible = true;
              }
            }
          );
        }
      }

      if (st.pendingBurstZone) {
        trigger3DBurst(st.pendingBurstZone, nowMs);
        st.pendingBurstZone = null;
      }

      // Sync palette & lighting tints dynamically
      baseMat.color.set(p.palette.isDark ? '#1e293b' : '#f1f5f9');
      platterMat.color.set(p.palette.isDark ? '#0f172a' : '#ffffff');
      rimRingMat.color.set(p.palette.accent);
      rimRingMat.emissive.set(p.palette.accent);
      haloMat.color.set(p.palette.accent);
      sunHaloRingMat.color.set(
        p.sceneId === 'clear_night'
          ? '#93c5fd'
          : p.sceneId === 'hot_sunny'
            ? '#fb923c'
            : '#fbbf24'
      );
      rimLight.color.set(p.sceneId === 'clear_night' ? '#93c5fd' : p.palette.accent);

      // 1. Eye Saccades & Cursor Gaze Follow (eye blinking permanently disabled: studio 3D eyes stay 100% open)
      const inNpcIdle = p.npcMode && !p.isStanding;
      if (nowMs > st.pointerActiveUntilMs && !p.reduceMotion) {
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
            st.saccadeX = glanceUp ? 0 : (Math.random() - 0.5) * 0.7;
            st.saccadeY = glanceUp ? -0.04 : 0.42 + Math.random() * 0.12;
            st.nextSaccadeAtMs = nowMs + 850 + Math.random() * 800;
          } else if (inNpcIdle && p.npcAction === 'listening_music') {
            st.saccadeX = Math.sin(elapsedSec * 1.2) * 0.45;
            st.saccadeY = -0.08 + Math.cos(elapsedSec * 0.9) * 0.14;
            st.nextSaccadeAtMs = nowMs + 950;
          } else {
            const lookSky =
              (p.sceneId === 'light_rain_umbrella' || p.sceneId === 'storm_raincoat') &&
              Math.random() < 0.4;
            st.saccadeX = (Math.random() - 0.5) * 0.6;
            st.saccadeY = lookSky ? -0.35 : (Math.random() - 0.5) * 0.3;
            st.nextSaccadeAtMs = nowMs + 1500 + Math.random() * 1800;
          }
        }
        st.targetGazeX = st.saccadeX;
        st.targetGazeY = st.saccadeY;
      }

      const gazeLerp = Math.min(1, dtSec * 10.5);
      st.gazeX += (st.targetGazeX - st.gazeX) * gazeLerp;
      st.gazeY += (st.targetGazeY - st.gazeY) * gazeLerp;

      // Update 3D LookAt target position
      lookAtTarget.position.set(st.gazeX * 1.35, 0.34 - st.gazeY * 0.85, 2.5);

      // 3. Turntable Spring Rotation & Camera Parallax
      const angleLerp = Math.min(1, dtSec * (st.isDragging ? 18 : 7.5));
      st.turntableAngleY += (st.targetTurntableAngleY - st.turntableAngleY) * angleLerp;
      turntableGroup.rotation.y = st.turntableAngleY + st.gazeX * 0.08;
      turntableGroup.rotation.x = st.gazeY * 0.04;

      camera.position.x = st.gazeX * 0.12;
      camera.position.y = 0.22 - st.gazeY * 0.08;
      camera.lookAt(0, 0.15, 0);

      // 4. Multi-Layered Natural Motion (Asymmetric Breathing + Wind Lean + Hit-Zone Reactions)
      const headPatRem = Math.max(0, (st.headPatUntilMs - nowMs) / 1400);
      const cheekPokeRem = Math.max(0, (st.cheekPokeUntilMs - nowMs) / 1250);
      const happySmileAmount = Math.min(1, headPatRem * 1.45);
      const cheekBlushAmount = Math.min(1, Math.max(headPatRem * 0.9, cheekPokeRem * 1.5));

      let hopOffsetY = 0;
      let hopSquashX = 1;
      let hopStretchY = 1;
      if (st.bodyHopStartMs >= 0 && !p.reduceMotion) {
        const ht = (nowMs - st.bodyHopStartMs) / 480;
        if (ht >= 1) {
          st.bodyHopStartMs = -1;
        } else {
          hopOffsetY = Math.sin(ht * Math.PI) * 0.22 * (1 - ht * 0.25);
          hopStretchY = 1 + Math.sin(ht * Math.PI * 2) * 0.045;
          hopSquashX = 1 - Math.sin(ht * Math.PI * 2) * 0.026;
        }
      }

      // Asymmetric organic breathing (faster inhale, slower relaxed exhale)
      const breathPhase = (elapsedSec * 1.9) % (Math.PI * 2);
      const rawWave = Math.sin(breathPhase);
      const breathWave = p.reduceMotion
        ? 0
        : Math.pow((rawWave + 1) * 0.5, 1.35);
      const breathScaleY = (1 + breathWave * 0.024) * hopStretchY;
      const breathScaleX = (1 - breathWave * 0.012) * hopSquashX;

      // Wind force proportional to weather.windSpeedKmh
      const windNorm = Math.min(1.4, p.windSpeedKmh / 36);
      const windGustRad = p.reduceMotion
        ? 0
        : (windNorm * 0.035 + Math.sin(elapsedSec * 2.4) * windNorm * 0.025);

      let swayRad = p.reduceMotion
        ? 0
        : Math.sin(elapsedSec * 1.35) * 0.024 + st.gazeX * 0.018 - windGustRad;
      if (!p.reduceMotion) {
        if (inNpcIdle && p.npcAction === 'listening_music') {
          swayRad = Math.sin(elapsedSec * 3.1) * 0.048 + st.gazeX * 0.015;
        } else if (inNpcIdle && p.npcAction === 'petting_cat') {
          swayRad = -0.028 + Math.sin(elapsedSec * 1.8) * 0.018;
        } else if (inNpcIdle && p.npcAction === 'petting_puppy') {
          swayRad = 0.028 + Math.sin(elapsedSec * 1.8) * 0.018;
        } else if (p.sceneId === 'freezing_puffer') {
          swayRad += Math.sin(elapsedSec * 17) * 0.005;
        }
      }

      // Apply Mode A 3D Relief Mesh Deformation & Face Canvas Texture Update
      if (!st.activeVrm && characterMesh.visible) {
        characterMesh.position.y = pedestalY + 0.025 + hopOffsetY;
        characterMesh.scale.set(breathScaleX, breathScaleY, 1);
        characterMesh.rotation.z = swayRad;
        characterMesh.rotation.x = 0;

        // GPU-accelerated vertex shader uniforms (0% CPU vertex loop & 0 PCIe buffer uploads)
        const headTiltX =
          headPatRem > 0 ? Math.sin(elapsedSec * 7.5) * 0.055 * headPatRem : 0;
        const cheekWiggleX =
          cheekPokeRem > 0 ? Math.sin(elapsedSec * 18) * 0.065 * cheekPokeRem : 0;
        charWindUniforms.uWindBendX.value = p.reduceMotion
          ? 0
          : Math.sin(elapsedSec * 2.5) * windNorm * 0.032;
        charWindUniforms.uWindBendZ.value = p.reduceMotion
          ? 0
          : Math.cos(elapsedSec * 2.1) * windNorm * 0.022;
        charWindUniforms.uUpperTiltX.value = headTiltX + cheekWiggleX;
        charWindUniforms.uUpperLiftZ.value = Math.abs(headTiltX) * 0.35;

        // Composite 768x768 Pop Mart Studio Texture + Blush (pure open studio 3D eyes)
        const isWearingSunglasses = p.sceneId === 'hot_sunny';
        const needFaceRedraw =
          st.faceCanvasDirty ||
          Math.abs(cheekBlushAmount - st.lastCanvasBlush) > 0.005 ||
          (isWearingSunglasses &&
            (Math.abs(st.gazeX - st.lastCanvasGazeX) > 0.004 ||
              Math.abs(st.gazeY - st.lastCanvasGazeY) > 0.004));

        if (charCtx && st.loadedCharImage && needFaceRedraw) {
          compositeCharacterFaceCanvas(charCtx, st.loadedCharImage, {
            gazeX: st.gazeX,
            gazeY: st.gazeY,
            cheekBlushAmount,
            isWearingSunglasses,
          });
          charTexture.needsUpdate = true;
          st.faceCanvasDirty = false;
          st.lastCanvasGazeX = st.gazeX;
          st.lastCanvasGazeY = st.gazeY;
          st.lastCanvasBlush = cheekBlushAmount;
        }
      }

      // Apply Mode B @pixiv/three-vrm Full Skeletal Avatar Animation & SpringBone Wind Physics
      if (st.activeVrm) {
        const vrm = st.activeVrm;
        if (vrm.expressionManager) {
          vrm.expressionManager.setValue('blink', 0);
          vrm.expressionManager.setValue(
            'happy',
            Math.min(1, Math.max(happySmileAmount, cheekPokeRem))
          );
          vrm.expressionManager.setValue(
            'relaxed',
            happySmileAmount > 0.1 ? 0 : 0.25 + breathWave * 0.15
          );
        }

        const humanoid = vrm.humanoid;
        if (humanoid) {
          const spine = humanoid.getNormalizedBoneNode('spine');
          const chest = humanoid.getNormalizedBoneNode('chest');
          const neck = humanoid.getNormalizedBoneNode('neck');
          const head = humanoid.getNormalizedBoneNode('head');
          const leftUpperArm = humanoid.getNormalizedBoneNode('leftUpperArm');
          const rightUpperArm = humanoid.getNormalizedBoneNode('rightUpperArm');
          const rightLowerArm = humanoid.getNormalizedBoneNode('rightLowerArm');

          if (spine) {
            spine.rotation.x = breathWave * 0.04;
            spine.rotation.z = swayRad * 0.65;
          }
          if (chest) {
            chest.rotation.x = breathWave * 0.03;
            chest.rotation.z = swayRad * 0.45;
          }
          if (neck) {
            neck.rotation.y = st.gazeX * 0.16;
            neck.rotation.x = st.gazeY * 0.1;
          }
          if (head) {
            const headReactionZ =
              headPatRem > 0
                ? Math.sin(elapsedSec * 7) * 0.16 * headPatRem
                : cheekPokeRem > 0
                  ? Math.sin(elapsedSec * 16) * 0.18 * cheekPokeRem
                  : 0;
            head.rotation.y = st.gazeX * 0.22;
            head.rotation.x =
              st.gazeY * 0.14 +
              (inNpcIdle && p.npcAction === 'reading_book' ? 0.22 : 0);
            head.rotation.z = swayRad * 0.4 + headReactionZ;
          }
          if (leftUpperArm) {
            leftUpperArm.rotation.z = -1.14 - breathWave * 0.04;
          }
          if (rightUpperArm) {
            const isWaving = headPatRem > 0 || st.bodyHopStartMs >= 0;
            rightUpperArm.rotation.z = isWaving
              ? 0.45 + Math.sin(elapsedSec * 9) * 0.22
              : 1.14 + breathWave * 0.04;
          }
          if (rightLowerArm) {
            const isWaving = headPatRem > 0 || st.bodyHopStartMs >= 0;
            rightLowerArm.rotation.z = isWaving
              ? 0.65 + Math.sin(elapsedSec * 9) * 0.25
              : 0.08;
          }
        }

        // Real-time wind vector applied to @pixiv/three-vrm SpringBone hair & clothing joints
        if (vrm.springBoneManager) {
          const gust =
            windNorm * (0.65 + 0.35 * Math.sin(elapsedSec * 2.9));
          for (const joint of vrm.springBoneManager.joints) {
            joint.settings.gravityDir
              .set(-0.65 * gust, -1.0, 0.25 * Math.cos(elapsedSec * 2.1) * gust)
              .normalize();
            joint.settings.gravityPower = Math.max(
              0.08,
              0.12 + gust * 0.28
            );
          }
        }

        vrm.scene.position.y = st.activeVrmBaseY + hopOffsetY;
        vrm.update(dtSec);
      }

      // Update Ground Contact Shadow Scale
      const shadowScale = (1 - hopOffsetY * 0.85) * breathScaleX;
      shadowMesh.scale.set(shadowScale, shadowScale, 1);

      // 5. Update 3D Companion Depth Layer (`petting_cat` / `petting_puppy`)
      if (st.activePetKind !== null) {
        const walkT = Math.min(1, Math.max(0, (nowMs - st.petEnteredAtMs) / 1450));
        const petProgress = 1 - Math.pow(1 - walkT, 2.6);
        const isCat = st.activePetKind === 'cat';
        petMat.map = isCat ? catTexture : puppyTexture;

        const targetX = isCat ? 0.46 : -0.46;
        const startX = isCat ? 1.05 : -1.05;
        const currentX = startX + (targetX - startX) * petProgress;
        const currentZ = 0.05 + 0.23 * Math.sin(petProgress * Math.PI * 0.5);
        const bobY =
          walkT < 0.98
            ? Math.abs(Math.sin(elapsedSec * 9.5)) * 0.07
            : Math.max(0, Math.sin(elapsedSec * 3.1)) * 0.022;

        petMesh.visible = true;
        petMesh.position.set(currentX, pedestalY + 0.03 + bobY, currentZ);
        petMesh.rotation.z = Math.sin(elapsedSec * 2.8) * 0.04;
        petMat.opacity = Math.min(1, petProgress * 1.45);

        petShadowMesh.visible = true;
        petShadowMesh.position.set(currentX, pedestalY + 0.029, currentZ);
        petShadowMat.opacity = Math.min(0.55, petProgress * 0.55);
      } else {
        petMesh.visible = false;
        petShadowMesh.visible = false;
      }

      // 6. Update Dynamic 3D Weather Particles & Pedestal Water Ripples
      const isRainScene =
        p.sceneId === 'light_rain_umbrella' ||
        p.sceneId === 'storm_raincoat' ||
        p.precipMmPerHr > 0.2;

      rainLines.visible = isRainScene && p.showAmbientProps;
      for (const rMesh of rippleMeshes) {
        rMesh.visible = isRainScene && p.showAmbientProps;
      }

      if (rainLines.visible) {
        const windSlantX = -Math.min(0.62, (p.windSpeedKmh / 42) * 0.45);
        const streakLen = p.sceneId === 'storm_raincoat' ? 0.24 : 0.17;
        const rainPosAttr = rainGeo.attributes.position as THREE.BufferAttribute;
        const rArr = rainPosAttr.array as Float32Array;

        for (let i = 0; i < RAIN_COUNT; i += 1) {
          let rx = rainSeeds[i * 4];
          let ry = rainSeeds[i * 4 + 1];
          const rz = rainSeeds[i * 4 + 2];
          const rSpeed = rainSeeds[i * 4 + 3];

          if (!p.reduceMotion) {
            ry -= dtSec * rSpeed;
            rx += dtSec * rSpeed * windSlantX;
            if (ry < pedestalY + 0.04) {
              ry = 1.65;
              rx = (Math.random() - 0.5) * 2.5;
            }
            rainSeeds[i * 4] = rx;
            rainSeeds[i * 4 + 1] = ry;
          }

          const idx = i * 6;
          rArr[idx] = rx;
          rArr[idx + 1] = ry;
          rArr[idx + 2] = rz;
          rArr[idx + 3] = rx + windSlantX * streakLen;
          rArr[idx + 4] = ry - streakLen;
          rArr[idx + 5] = rz;
        }
        rainPosAttr.needsUpdate = true;

        // Expanding 3D concentric water ripples on pedestal surface
        for (let i = 0; i < RIPPLE_COUNT; i += 1) {
          const rMesh = rippleMeshes[i];
          const rPhase = (elapsedSec * 0.85 + rippleSeeds[i].phase) % 1;
          const rScale = 0.5 + rPhase * 2.4;
          rMesh.scale.set(rScale, rScale, 1);
          (rMesh.material as THREE.MeshBasicMaterial).opacity =
            (1 - rPhase) * 0.52;
        }
      }

      // Update 3D Snow / Chilly Steam / Sunny Motes / Clear Night Stars
      motePoints.visible = !isRainScene && p.showAmbientProps;
      if (motePoints.visible) {
        const mPosAttr = moteGeo.attributes.position as THREE.BufferAttribute;
        const mArr = mPosAttr.array as Float32Array;

        if (p.sceneId === 'freezing_puffer') {
          moteMat.color.set('#f8fafc');
          moteMat.size = 0.095;
          moteMat.opacity = 0.85;
          for (let i = 0; i < MOTE_COUNT; i += 1) {
            const phase = moteSeeds[i * 4 + 3];
            let my = mArr[i * 3 + 1] - (p.reduceMotion ? 0 : dtSec * 0.45);
            if (my < pedestalY + 0.05) {
              my = 1.55;
            }
            mArr[i * 3] =
              moteSeeds[i * 4] + Math.sin(elapsedSec * 1.4 + phase) * 0.14;
            mArr[i * 3 + 1] = my;
            mArr[i * 3 + 2] =
              moteSeeds[i * 4 + 2] + Math.cos(elapsedSec * 1.1 + phase) * 0.08;
          }
        } else if (p.sceneId === 'chilly_cozy') {
          moteMat.color.set('#fed7aa');
          moteMat.size = 0.09;
          moteMat.opacity = 0.62;
          for (let i = 0; i < MOTE_COUNT; i += 1) {
            const phase = moteSeeds[i * 4 + 3];
            let my = mArr[i * 3 + 1] + (p.reduceMotion ? 0 : dtSec * 0.28);
            if (my > 1.55) {
              my = pedestalY + 0.08;
            }
            mArr[i * 3] =
              moteSeeds[i * 4] + Math.sin(elapsedSec * 1.6 + phase) * 0.12;
            mArr[i * 3 + 1] = my;
            mArr[i * 3 + 2] = moteSeeds[i * 4 + 2];
          }
        } else if (p.sceneId === 'clear_night') {
          moteMat.color.set('#bae6fd');
          moteMat.size = 0.082 + Math.sin(elapsedSec * 2.8) * 0.016;
          moteMat.opacity = 0.68 + Math.sin(elapsedSec * 2.2) * 0.18;
          for (let i = 0; i < MOTE_COUNT; i += 1) {
            const phase = moteSeeds[i * 4 + 3];
            mArr[i * 3] =
              moteSeeds[i * 4] + Math.sin(elapsedSec * 0.4 + phase) * 0.04;
            mArr[i * 3 + 1] =
              moteSeeds[i * 4 + 1] + Math.cos(elapsedSec * 0.5 + phase) * 0.04;
          }
        } else {
          // pleasant_sunny / hot_sunny golden sun-motes
          moteMat.color.set(p.sceneId === 'hot_sunny' ? '#fdba74' : '#fde68a');
          moteMat.size = 0.082;
          moteMat.opacity = 0.68;
          for (let i = 0; i < MOTE_COUNT; i += 1) {
            const phase = moteSeeds[i * 4 + 3];
            mArr[i * 3] =
              moteSeeds[i * 4] + Math.sin(elapsedSec * 0.9 + phase) * 0.09;
            mArr[i * 3 + 1] =
              moteSeeds[i * 4 + 1] + Math.cos(elapsedSec * 0.8 + phase) * 0.09;
          }
        }
        mPosAttr.needsUpdate = true;
      }

      // Rotating 3D sunbeam / starlight halo ring
      sunHaloRingMesh.visible =
        p.showAmbientProps &&
        (p.sceneId === 'pleasant_sunny' ||
          p.sceneId === 'hot_sunny' ||
          p.sceneId === 'clear_night');
      if (sunHaloRingMesh.visible && !p.reduceMotion) {
        sunHaloRingMesh.rotation.z = elapsedSec * 0.25;
        sunHaloRingMesh.rotation.y = Math.sin(elapsedSec * 0.7) * 0.14;
      }

      // 7. Update 3D Reaction Burst Particles
      if (burstState.active) {
        const bt = (nowMs - burstState.startedAtMs) / 950;
        if (bt >= 1) {
          burstState.active = false;
          burstMat.opacity = 0;
        } else {
          burstMat.opacity = (1 - bt) * 0.95;
          const bPosAttr = burstGeo.attributes.position as THREE.BufferAttribute;
          const bArr = bPosAttr.array as Float32Array;
          for (let i = 0; i < BURST_COUNT; i += 1) {
            bArr[i * 3] += burstState.velocities[i * 3] * dtSec;
            bArr[i * 3 + 1] += burstState.velocities[i * 3 + 1] * dtSec;
            bArr[i * 3 + 2] += burstState.velocities[i * 3 + 2] * dtSec;
          }
          bPosAttr.needsUpdate = true;
        }
      }

      renderer.render(scene, camera);
      if (isInViewport && (typeof document === 'undefined' || !document.hidden)) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = null;
      }
    };

    let isInViewport = true;
    const syncAnimationState = () => {
      if (!mounted) return;
      const shouldRun =
        isInViewport && (typeof document === 'undefined' || !document.hidden);
      if (!shouldRun) {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      } else if (rafId === null) {
        stateRef.current.lastFrameMs =
          typeof performance !== 'undefined' ? performance.now() : Date.now();
        rafId = requestAnimationFrame(tick);
      }
    };

    const onVisibilityChange = () => {
      syncAnimationState();
    };

    const intersectionObserver =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              const entry = entries[0];
              if (entry) {
                isInViewport = entry.isIntersecting;
                syncAnimationState();
              }
            },
            { threshold: 0.02 }
          )
        : null;
    intersectionObserver?.observe(container);

    document.addEventListener('visibilitychange', onVisibilityChange);
    if (!document.hidden) {
      rafId = requestAnimationFrame(tick);
    }

    return () => {
      mounted = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      intersectionObserver?.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUpOrCancel);
      canvas.removeEventListener('pointercancel', onPointerUpOrCancel);
      canvas.removeEventListener('webglcontextlost', onContextLost, false);
      window.removeEventListener('pointermove', onWinPointerMove);

      if (stateRef.current.activeVrm) {
        VRMUtils.deepDispose(stateRef.current.activeVrm.scene);
        stateRef.current.activeVrm = null;
      }
      stateRef.current.activeVrmUrl = null;

      baseGeo.dispose();
      baseMat.dispose();
      platterGeo.dispose();
      platterMat.dispose();
      rimRingGeo.dispose();
      rimRingMat.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
      shadowTex?.dispose();
      haloGeo.dispose();
      haloMat.dispose();
      haloTex?.dispose();
      sunHaloRingGeo.dispose();
      sunHaloRingMat.dispose();
      charGeo.dispose();
      charMat.dispose();
      charTexture.dispose();
      petGeo.dispose();
      petMat.dispose();
      catTexture.dispose();
      puppyTexture.dispose();
      petShadowGeo.dispose();
      petShadowMat.dispose();
      rainGeo.dispose();
      rainMat.dispose();
      rippleGeo.dispose();
      for (const rMesh of rippleMeshes) {
        (rMesh.material as THREE.Material).dispose();
      }
      moteGeo.dispose();
      moteMat.dispose();
      moteTex?.dispose();
      burstGeo.dispose();
      burstMat.dispose();
      renderer.dispose();
      if (canvas.parentNode === container) {
        container.removeChild(canvas);
      }
    };
  }, [onWebGLUnavailable]);

  return (
    <View
      ref={hostRef}
      accessibilityRole={interactive ? 'button' : 'image'}
      accessibilityLabel={`${profile?.nameVi ?? gender} · ${sceneMeta?.labelVi ?? sceneId}`}
      style={[
        styles.dioramaHost,
        {
          width: Math.round(size * 1.08),
          height: Math.round(size),
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  dioramaHost: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
});

import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { CharacterSceneId, SkyTheme } from '../core';
import { SCENE_VISUAL_META } from '../art/characterAssets';
import { SKY_PALETTES } from './themeTokens';

interface AmbientSkyBackdropProps {
  skyTheme: SkyTheme;
  sceneId: CharacterSceneId;
  reduceMotion: boolean;
  children: React.ReactNode;
}

type ParticleKind = 'sun' | 'heat' | 'night' | 'rain' | 'storm' | 'leaf' | 'snow';

function resolveParticleKind(sceneId: CharacterSceneId): ParticleKind {
  return SCENE_VISUAL_META[sceneId]?.particleType ?? 'sun';
}

interface DropSpec {
  id: string;
  leftPct: number;
  delayFrac: number;
  lengthPx: number;
  opacity: number;
  driftPx: number;
}

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export const AmbientSkyBackdrop: React.FC<AmbientSkyBackdropProps> = ({
  skyTheme,
  sceneId,
  reduceMotion,
  children,
}) => {
  const palette = SKY_PALETTES[skyTheme] ?? SKY_PALETTES.day_sunny;
  const particleKind = resolveParticleKind(sceneId);
  const { height: winHeight } = useWindowDimensions();

  const masterClock = useRef(new Animated.Value(0)).current;
  const sunPulse = useRef(new Animated.Value(0)).current;
  const stormFlash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      masterClock.setValue(0.35);
      sunPulse.setValue(0.5);
      stormFlash.setValue(0);
      return;
    }

    masterClock.setValue(0);
    const duration =
      particleKind === 'storm'
        ? 1100
        : particleKind === 'rain'
          ? 1650
          : particleKind === 'snow'
            ? 6800
            : 7600;

    const loop = Animated.loop(
      Animated.timing(masterClock, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: USE_NATIVE_DRIVER,
      })
    );
    loop.start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sunPulse, {
          toValue: 1,
          duration: 3400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(sunPulse, {
          toValue: 0,
          duration: 3400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );
    pulseLoop.start();

    let flashLoop: Animated.CompositeAnimation | null = null;
    if (particleKind === 'storm') {
      flashLoop = Animated.loop(
        Animated.sequence([
          Animated.delay(3800),
          Animated.timing(stormFlash, {
            toValue: 0.14,
            duration: 90,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(stormFlash, {
            toValue: 0.02,
            duration: 70,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(stormFlash, {
            toValue: 0.18,
            duration: 110,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(stormFlash, {
            toValue: 0,
            duration: 420,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.delay(2400),
        ])
      );
      flashLoop.start();
    } else {
      stormFlash.setValue(0);
    }

    return () => {
      loop.stop();
      pulseLoop.stop();
      flashLoop?.stop();
    };
  }, [particleKind, reduceMotion, masterClock, sunPulse, stormFlash]);

  const particles = useMemo((): DropSpec[] => {
    const count =
      particleKind === 'storm'
        ? 22
        : particleKind === 'rain'
          ? 15
          : particleKind === 'snow'
            ? 14
            : particleKind === 'leaf'
              ? 8
              : 0;

    const list: DropSpec[] = [];
    for (let i = 0; i < count; i += 1) {
      const seed = (i * 37 + 13) % 97;
      list.push({
        id: `${particleKind}_${i}`,
        leftPct: 4 + ((i * 93) % 92),
        delayFrac: (seed % 20) / 20,
        lengthPx:
          particleKind === 'storm'
            ? 28 + (seed % 18)
            : particleKind === 'rain'
              ? 20 + (seed % 14)
              : 8 + (seed % 6),
        opacity:
          particleKind === 'storm'
            ? 0.22 + (seed % 20) / 100
            : particleKind === 'rain'
              ? 0.20 + (seed % 18) / 100
              : 0.38 + (seed % 30) / 100,
        driftPx:
          particleKind === 'leaf'
            ? 28 + (seed % 24)
            : particleKind === 'snow'
              ? 14 + (seed % 14)
              : -24,
      });
    }
    return list;
  }, [particleKind]);

  const travelHeight = Math.max(640, Math.min(winHeight, 980));

  const haloScale = sunPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.07],
  });
  const haloOpacity = sunPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.48, 0.78],
  });

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[palette.skyStops[0], palette.skyStops[1], palette.skyStops[2]]}
        locations={[0, 0.54, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient atmospheric sun / moon orb */}
      {(particleKind === 'sun' ||
        particleKind === 'heat' ||
        particleKind === 'night' ||
        skyTheme === 'night') && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.celestialOrb,
            {
              backgroundColor:
                skyTheme === 'night' || particleKind === 'night'
                  ? 'rgba(186, 214, 255, 0.16)'
                  : particleKind === 'heat'
                    ? 'rgba(253, 186, 116, 0.44)'
                    : 'rgba(254, 240, 188, 0.58)',
              opacity: haloOpacity,
              transform: [{ scale: haloScale }],
            },
          ]}
        />
      )}

      {/* Subtle horizon glow */}
      <View
        pointerEvents="none"
        style={[styles.horizonOrb, { backgroundColor: palette.horizonGlow }]}
      />

      {/* GPU-accelerated weather particles (transform + opacity only) */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {particles.map((item) => {
          const shifted = Animated.modulo(
            Animated.add(masterClock, item.delayFrac),
            1
          );
          const translateY = shifted.interpolate({
            inputRange: [0, 1],
            outputRange: [-60, travelHeight],
          });
          const translateX = shifted.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, item.driftPx, item.driftPx * 1.4],
          });

          if (particleKind === 'rain' || particleKind === 'storm') {
            return (
              <Animated.View
                key={item.id}
                style={[
                  styles.rainStreak,
                  {
                    left: `${item.leftPct}%`,
                    height: item.lengthPx,
                    opacity: item.opacity,
                    backgroundColor: palette.isDark
                      ? 'rgba(191, 219, 254, 0.65)'
                      : 'rgba(30, 64, 115, 0.28)',
                    transform: [
                      { translateY },
                      { translateX },
                      { rotate: '14deg' },
                    ],
                  },
                ]}
              />
            );
          }

          if (particleKind === 'snow') {
            return (
              <Animated.View
                key={item.id}
                style={[
                  styles.snowFlake,
                  {
                    left: `${item.leftPct}%`,
                    width: item.lengthPx,
                    height: item.lengthPx,
                    borderRadius: item.lengthPx / 2,
                    opacity: item.opacity,
                    backgroundColor: palette.isDark
                      ? 'rgba(241, 245, 249, 0.85)'
                      : 'rgba(255, 255, 255, 0.92)',
                    transform: [{ translateY }, { translateX }],
                  },
                ]}
              />
            );
          }

          return (
            <Animated.View
              key={item.id}
              style={[
                styles.autumnLeaf,
                {
                  left: `${item.leftPct}%`,
                  opacity: item.opacity * 0.72,
                  backgroundColor:
                    item.leftPct % 2 === 0
                      ? 'rgba(217, 119, 6, 0.42)'
                      : 'rgba(180, 83, 9, 0.32)',
                  transform: [
                    { translateY },
                    { translateX },
                    { rotate: '32deg' },
                  ],
                },
              ]}
            />
          );
        })}
      </View>

      {/* Subtle distant sheet-lightning flash during heavy storm */}
      {particleKind === 'storm' && !reduceMotion && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: '#E0F2FE',
              opacity: stormFlash,
            },
          ]}
        />
      )}

      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: Platform.OS === 'web' ? ('100dvh' as unknown as number) : '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  celestialOrb: {
    position: 'absolute',
    top: -110,
    right: -70,
    width: 380,
    height: 380,
    borderRadius: 190,
  },
  horizonOrb: {
    position: 'absolute',
    bottom: -140,
    left: '12%',
    width: '76%',
    height: 280,
    borderRadius: 200,
  },
  rainStreak: {
    position: 'absolute',
    top: 0,
    width: 1.6,
    borderRadius: 2,
  },
  snowFlake: {
    position: 'absolute',
    top: 0,
  },
  autumnLeaf: {
    position: 'absolute',
    top: 0,
    width: 11,
    height: 6,
    borderRadius: 6,
  },
});

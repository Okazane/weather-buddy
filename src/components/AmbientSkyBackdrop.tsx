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
    } else {
      stormFlash.setValue(0);
    }

    const startAllLoops = () => {
      loop.start();
      pulseLoop.start();
      flashLoop?.start();
    };

    const stopAllLoops = () => {
      loop.stop();
      pulseLoop.stop();
      flashLoop?.stop();
    };

    if (Platform.OS === 'web' && typeof document !== 'undefined' && document.hidden) {
      stopAllLoops();
    } else {
      startAllLoops();
    }

    const onVisibilityChange = () => {
      if (typeof document === 'undefined') {
        return;
      }
      if (document.hidden) {
        stopAllLoops();
      } else {
        startAllLoops();
      }
    };

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    return () => {
      stopAllLoops();
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
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

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }
    const bottomSky = palette.skyStops[2];
    document.documentElement.style.backgroundColor = bottomSky;
    if (document.body) {
      document.body.style.backgroundColor = bottomSky;
    }
  }, [palette.skyStops]);

  const haloScale = sunPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.97, 1.05],
  });
  const haloOpacity = sunPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.32, 0.54],
  });

  return (
    <View style={[styles.root, { backgroundColor: palette.skyStops[2] }]}>
      <View pointerEvents="none" style={styles.backdropLayer}>
        <LinearGradient
          colors={[palette.skyStops[0], palette.skyStops[1], palette.skyStops[2]]}
          locations={[0, 0.54, 1]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Soft daytime rain-mist cloud canopy when raining during daytime */}
        {skyTheme === 'day_rain' && (
          <View pointerEvents="none" style={styles.dayRainCanopy} />
        )}

        {/* Restrained atmospheric sunlight / moonlight glow (no harsh neon orbs) */}
        {(particleKind === 'sun' ||
          particleKind === 'heat' ||
          particleKind === 'night' ||
          skyTheme === 'dawn' ||
          skyTheme === 'sunset' ||
          skyTheme === 'night') &&
          skyTheme !== 'day_rain' &&
          skyTheme !== 'rain_storm' && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.celestialOrb,
              {
                backgroundColor:
                  skyTheme === 'night' || particleKind === 'night'
                    ? 'rgba(168, 201, 240, 0.11)'
                    : skyTheme === 'sunset'
                      ? 'rgba(238, 172, 108, 0.30)'
                      : skyTheme === 'dawn'
                        ? 'rgba(244, 192, 158, 0.28)'
                        : particleKind === 'heat'
                          ? 'rgba(245, 184, 118, 0.28)'
                          : 'rgba(250, 232, 178, 0.36)',
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
                        ? 'rgba(186, 212, 244, 0.58)'
                        : 'rgba(35, 76, 128, 0.24)',
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
                        ? 'rgba(238, 243, 250, 0.82)'
                        : 'rgba(250, 251, 252, 0.88)',
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
                    opacity: item.opacity * 0.68,
                    backgroundColor:
                      item.leftPct % 2 === 0
                        ? 'rgba(196, 114, 34, 0.36)'
                        : 'rgba(168, 84, 28, 0.28)',
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
                backgroundColor: palette.isDark ? '#D8E8FA' : '#F2F6FA',
                opacity: stormFlash,
              },
            ]}
          />
        )}
      </View>

      <View style={styles.foregroundContent}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: Platform.OS === 'web' ? ('100dvh' as unknown as number) : '100%',
    position: 'relative',
    borderRadius: 0,
  },
  backdropLayer: {
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed' as any,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100dvh',
          minHeight: '100vh',
          zIndex: 0,
          overflow: 'hidden',
          borderRadius: 0,
          pointerEvents: 'none',
        } as any)
      : {
          ...StyleSheet.absoluteFillObject,
          overflow: 'hidden',
        }),
  },
  foregroundContent: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
  },
  dayRainCanopy: {
    position: 'absolute',
    top: -90,
    left: '-8%',
    width: '116%',
    height: 240,
    borderRadius: 180,
    backgroundColor: 'rgba(156, 178, 202, 0.20)',
    ...(Platform.OS === 'web' ? ({ filter: 'blur(36px)' } as any) : null),
  },
  celestialOrb: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 420,
    height: 420,
    borderRadius: 210,
    ...(Platform.OS === 'web' ? ({ filter: 'blur(54px)' } as any) : null),
  },
  horizonOrb: {
    position: 'absolute',
    bottom: -140,
    left: '10%',
    width: '80%',
    height: 280,
    borderRadius: 200,
    ...(Platform.OS === 'web' ? ({ filter: 'blur(48px)' } as any) : null),
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

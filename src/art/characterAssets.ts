/**
 * WeatherBuddy - 2.5D Vinyl Character & Chibi NPC Sprite Registry
 *
 * Static `require(...)` map so Metro / Expo Web / iOS / Android bundle all 24
 * transparent 768x768 RGBA sprites deterministically (14 weather poses + 10 NPC idle actions).
 */

export type Gender = 'male' | 'female';

export type CharacterSceneId =
  | 'storm_raincoat'
  | 'light_rain_umbrella'
  | 'hot_sunny'
  | 'pleasant_sunny'
  | 'clear_night'
  | 'chilly_cozy'
  | 'freezing_puffer';

export type NpcActionId =
  | 'reading_book'
  | 'petting_cat'
  | 'petting_puppy'
  | 'scrolling_phone'
  | 'listening_music';

export type SceneAmbientPropKind =
  | 'sun_halo'
  | 'heat_shimmer'
  | 'starlight_aura'
  | 'rain_ripples'
  | 'storm_puddle'
  | 'warm_steam'
  | 'frost_puffs';

export type SceneMotionMode = 'pendulum' | 'wind_gust' | 'shiver_pulse';

export type TapBurstKind = 'sunbeam' | 'droplet' | 'sparkle' | 'snowflake';

export interface SceneMotionProfile {
  mode: SceneMotionMode;
  /** Peak inhale vertical stretch (volume-preserving paired with breathScaleX) */
  breathScaleY: number;
  /** Peak inhale horizontal compression so volume stays organic */
  breathScaleX: number;
  /** Asymmetric inhale duration in ms */
  inhaleDurationMs: number;
  /** Asymmetric exhale duration in ms */
  exhaleDurationMs: number;
  /** Pendulum / wind rotation bounds in degrees */
  rotateMinDeg: number;
  rotateMaxDeg: number;
  /** Half-cycle pendulum sway duration in ms */
  swayDurationMs: number;
  /** Ground-pivot ratio from center */
  footAnchorRatio: number;
  /** Grounded or atmospheric secondary prop rendered by LivingCharacterRig */
  ambientProp: SceneAmbientPropKind;
  /** Ambient halo tint behind the vinyl figure */
  auraTintLight: string;
  auraTintDark: string;
  /** Tap reaction burst styling */
  burstKind: TapBurstKind;
  burstPrimaryColor: string;
  burstSecondaryColor: string;
}

export const CHARACTER_SPRITES: Record<Gender, Record<CharacterSceneId, any>> = {
  male: {
    pleasant_sunny: require('../../assets/characters/male_pleasant_sunny.png'),
    hot_sunny: require('../../assets/characters/male_hot_sunny.png'),
    clear_night: require('../../assets/characters/male_clear_night.png'),
    light_rain_umbrella: require('../../assets/characters/male_light_rain_umbrella.png'),
    storm_raincoat: require('../../assets/characters/male_storm_raincoat.png'),
    chilly_cozy: require('../../assets/characters/male_chilly_cozy.png'),
    freezing_puffer: require('../../assets/characters/male_freezing_puffer.png'),
  },
  female: {
    pleasant_sunny: require('../../assets/characters/female_pleasant_sunny.png'),
    hot_sunny: require('../../assets/characters/female_hot_sunny.png'),
    clear_night: require('../../assets/characters/female_clear_night.png'),
    light_rain_umbrella: require('../../assets/characters/female_light_rain_umbrella.png'),
    storm_raincoat: require('../../assets/characters/female_storm_raincoat.png'),
    chilly_cozy: require('../../assets/characters/female_chilly_cozy.png'),
    freezing_puffer: require('../../assets/characters/female_freezing_puffer.png'),
  },
};

export const NPC_SPRITES: Record<Gender, Record<NpcActionId, any>> = {
  male: {
    reading_book: require('../../assets/characters/npc_male_reading_book.png'),
    petting_cat: require('../../assets/characters/npc_male_petting_cat.png'),
    petting_puppy: require('../../assets/characters/npc_male_petting_puppy.png'),
    scrolling_phone: require('../../assets/characters/npc_male_scrolling_phone.png'),
    listening_music: require('../../assets/characters/npc_male_listening_music.png'),
  },
  female: {
    reading_book: require('../../assets/characters/npc_female_reading_book.png'),
    petting_cat: require('../../assets/characters/npc_female_petting_cat.png'),
    petting_puppy: require('../../assets/characters/npc_female_petting_puppy.png'),
    scrolling_phone: require('../../assets/characters/npc_female_scrolling_phone.png'),
    listening_music: require('../../assets/characters/npc_female_listening_music.png'),
  },
};

export const CHARACTER_PROFILES: Record<
  Gender,
  {
    nameVi: string;
    subtitleVi: string;
    accentColor: string;
  }
> = {
  male: {
    nameVi: 'Cậu bé Mây',
    subtitleVi: 'Nhân vật Nam',
    accentColor: '#56B4F9',
  },
  female: {
    nameVi: 'Cô bé Nắng',
    subtitleVi: 'Nhân vật Nữ',
    accentColor: '#FF85A9',
  },
};

export const SCENE_VISUAL_META: Record<
  CharacterSceneId,
  {
    labelVi: string;
    emoji: string;
    particleType: 'sun' | 'heat' | 'night' | 'rain' | 'storm' | 'leaf' | 'snow';
    lockScreenSymbol: string;
  }
> = {
  pleasant_sunny: {
    labelVi: 'Nắng đẹp',
    emoji: '🌤️',
    particleType: 'sun',
    lockScreenSymbol: 'sun.max.fill',
  },
  hot_sunny: {
    labelVi: 'Trời oi nóng',
    emoji: '🌡️',
    particleType: 'heat',
    lockScreenSymbol: 'sun.max.trianglebadge.exclamationmark.fill',
  },
  clear_night: {
    labelVi: 'Đêm quang đãng',
    emoji: '🌙',
    particleType: 'night',
    lockScreenSymbol: 'moon.stars.fill',
  },
  light_rain_umbrella: {
    labelVi: 'Mưa nhỏ',
    emoji: '☂️',
    particleType: 'rain',
    lockScreenSymbol: 'umbrella.fill',
  },
  storm_raincoat: {
    labelVi: 'Mưa lớn',
    emoji: '⛈️',
    particleType: 'storm',
    lockScreenSymbol: 'cloud.bolt.rain.fill',
  },
  chilly_cozy: {
    labelVi: 'Trời se lạnh',
    emoji: '🧣',
    particleType: 'leaf',
    lockScreenSymbol: 'wind',
  },
  freezing_puffer: {
    labelVi: 'Trời rét đậm',
    emoji: '❄️',
    particleType: 'snow',
    lockScreenSymbol: 'snowflake',
  },
};

export const SCENE_MOTION_PROFILES: Record<CharacterSceneId, SceneMotionProfile> = {
  pleasant_sunny: {
    mode: 'pendulum',
    breathScaleY: 1.028,
    breathScaleX: 0.986,
    inhaleDurationMs: 1900,
    exhaleDurationMs: 2400,
    rotateMinDeg: -1.8,
    rotateMaxDeg: 2.2,
    swayDurationMs: 3200,
    footAnchorRatio: 0.44,
    ambientProp: 'sun_halo',
    auraTintLight: 'rgba(253, 224, 130, 0.52)',
    auraTintDark: 'rgba(251, 191, 36, 0.16)',
    burstKind: 'sunbeam',
    burstPrimaryColor: '#F59E0B',
    burstSecondaryColor: '#FDE68A',
  },
  hot_sunny: {
    mode: 'pendulum',
    breathScaleY: 1.032,
    breathScaleX: 0.985,
    inhaleDurationMs: 1650,
    exhaleDurationMs: 2000,
    rotateMinDeg: -1.4,
    rotateMaxDeg: 1.8,
    swayDurationMs: 2550,
    footAnchorRatio: 0.44,
    ambientProp: 'heat_shimmer',
    auraTintLight: 'rgba(253, 186, 116, 0.50)',
    auraTintDark: 'rgba(251, 146, 60, 0.20)',
    burstKind: 'sunbeam',
    burstPrimaryColor: '#F97316',
    burstSecondaryColor: '#FDE047',
  },
  clear_night: {
    mode: 'pendulum',
    breathScaleY: 1.024,
    breathScaleX: 0.988,
    inhaleDurationMs: 2300,
    exhaleDurationMs: 2850,
    rotateMinDeg: -1.3,
    rotateMaxDeg: 1.4,
    swayDurationMs: 3900,
    footAnchorRatio: 0.44,
    ambientProp: 'starlight_aura',
    auraTintLight: 'rgba(147, 197, 253, 0.36)',
    auraTintDark: 'rgba(125, 211, 252, 0.18)',
    burstKind: 'sparkle',
    burstPrimaryColor: '#93C5FD',
    burstSecondaryColor: '#E0F2FE',
  },
  light_rain_umbrella: {
    mode: 'pendulum',
    breathScaleY: 1.026,
    breathScaleX: 0.987,
    inhaleDurationMs: 2050,
    exhaleDurationMs: 2550,
    rotateMinDeg: -2.4,
    rotateMaxDeg: 1.6,
    swayDurationMs: 3400,
    footAnchorRatio: 0.44,
    ambientProp: 'rain_ripples',
    auraTintLight: 'rgba(186, 230, 253, 0.44)',
    auraTintDark: 'rgba(125, 211, 252, 0.14)',
    burstKind: 'droplet',
    burstPrimaryColor: '#38BDF8',
    burstSecondaryColor: '#BAE6FD',
  },
  storm_raincoat: {
    mode: 'wind_gust',
    breathScaleY: 1.028,
    breathScaleX: 0.986,
    inhaleDurationMs: 1750,
    exhaleDurationMs: 2150,
    rotateMinDeg: -5.8,
    rotateMaxDeg: 1.2,
    swayDurationMs: 1850,
    footAnchorRatio: 0.44,
    ambientProp: 'storm_puddle',
    auraTintLight: 'rgba(147, 197, 253, 0.40)',
    auraTintDark: 'rgba(96, 165, 250, 0.16)',
    burstKind: 'droplet',
    burstPrimaryColor: '#60A5FA',
    burstSecondaryColor: '#FDE047',
  },
  chilly_cozy: {
    mode: 'pendulum',
    breathScaleY: 1.026,
    breathScaleX: 0.987,
    inhaleDurationMs: 2200,
    exhaleDurationMs: 2700,
    rotateMinDeg: -1.2,
    rotateMaxDeg: 1.4,
    swayDurationMs: 3800,
    footAnchorRatio: 0.44,
    ambientProp: 'warm_steam',
    auraTintLight: 'rgba(254, 215, 170, 0.48)',
    auraTintDark: 'rgba(251, 191, 147, 0.16)',
    burstKind: 'sparkle',
    burstPrimaryColor: '#F59E0B',
    burstSecondaryColor: '#FBCFE8',
  },
  freezing_puffer: {
    mode: 'shiver_pulse',
    breathScaleY: 1.024,
    breathScaleX: 0.988,
    inhaleDurationMs: 2100,
    exhaleDurationMs: 2600,
    rotateMinDeg: -1.4,
    rotateMaxDeg: 1.4,
    swayDurationMs: 3600,
    footAnchorRatio: 0.44,
    ambientProp: 'frost_puffs',
    auraTintLight: 'rgba(224, 242, 254, 0.60)',
    auraTintDark: 'rgba(186, 230, 253, 0.18)',
    burstKind: 'snowflake',
    burstPrimaryColor: '#93C5FD',
    burstSecondaryColor: '#F8FAFC',
  },
};

export const ALL_CHARACTER_SCENES: CharacterSceneId[] = [
  'pleasant_sunny',
  'hot_sunny',
  'clear_night',
  'light_rain_umbrella',
  'storm_raincoat',
  'chilly_cozy',
  'freezing_puffer',
];

export const ALL_NPC_ACTION_IDS: NpcActionId[] = [
  'reading_book',
  'petting_cat',
  'petting_puppy',
  'scrolling_phone',
  'listening_music',
];

export function getCharacterSprite(gender: Gender, sceneId: CharacterSceneId): any {
  return CHARACTER_SPRITES[gender]?.[sceneId] ?? CHARACTER_SPRITES.male.pleasant_sunny;
}

export function getNpcSprite(gender: Gender, actionId: NpcActionId): any {
  return NPC_SPRITES[gender]?.[actionId] ?? NPC_SPRITES.male.reading_book;
}

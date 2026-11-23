import React from 'react';
import {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import type { CharacterSceneId, Gender, NpcActionId } from '../art/characterAssets';

export interface OutfitPalette {
  topLight: string;
  topMid: string;
  topDark: string;
  collarColor: string;
  accentColor: string;
  bottomLight: string;
  bottomDark: string;
  shoeMain: string;
  shoeAccent: string;
  isDress: boolean;
  isRaincoat: boolean;
  isPuffer: boolean;
  isCardigan: boolean;
  hasSunglasses: boolean;
  hasSunVisor: boolean;
  hasEarmuffs: boolean;
  hasScarf: boolean;
  hasUmbrella: boolean;
  umbrellaColor: string;
  umbrellaRimColor: string;
  hasNightStarBadge: boolean;
}

export function getOutfitSpec(gender: Gender, sceneId: CharacterSceneId): OutfitPalette {
  const isFemale = gender === 'female';

  switch (sceneId) {
    case 'storm_raincoat':
      return {
        topLight: '#FFF078',
        topMid: '#FACC15',
        topDark: '#CA8A04',
        collarColor: '#FEF08A',
        accentColor: '#EA580C',
        bottomLight: '#334155',
        bottomDark: '#1E293B',
        shoeMain: '#FACC15',
        shoeAccent: '#A16207',
        isDress: false,
        isRaincoat: true,
        isPuffer: false,
        isCardigan: false,
        hasSunglasses: false,
        hasSunVisor: false,
        hasEarmuffs: false,
        hasScarf: false,
        hasUmbrella: false,
        umbrellaColor: '#93C5FD',
        umbrellaRimColor: '#FFFFFF',
        hasNightStarBadge: false,
      };

    case 'light_rain_umbrella':
      return isFemale
        ? {
            topLight: '#FFE0EC',
            topMid: '#F9A8C9',
            topDark: '#DB709B',
            collarColor: '#FFF1F5',
            accentColor: '#F43F5E',
            bottomLight: '#FFFBEB',
            bottomDark: '#FDE68A',
            shoeMain: '#F472B6',
            shoeAccent: '#FFF1F5',
            isDress: true,
            isRaincoat: false,
            isPuffer: false,
            isCardigan: false,
            hasSunglasses: false,
            hasSunVisor: false,
            hasEarmuffs: false,
            hasScarf: false,
            hasUmbrella: true,
            umbrellaColor: '#F9A8D4',
            umbrellaRimColor: '#FFF1F5',
            hasNightStarBadge: false,
          }
        : {
            topLight: '#D1FAE5',
            topMid: '#6EE7B7',
            topDark: '#059669',
            collarColor: '#ECFEFF',
            accentColor: '#0D9488',
            bottomLight: '#334155',
            bottomDark: '#1E293B',
            shoeMain: '#34D399',
            shoeAccent: '#ECFDF5',
            isDress: false,
            isRaincoat: false,
            isPuffer: false,
            isCardigan: false,
            hasSunglasses: false,
            hasSunVisor: false,
            hasEarmuffs: false,
            hasScarf: false,
            hasUmbrella: true,
            umbrellaColor: '#6EE7B7',
            umbrellaRimColor: '#ECFDF5',
            hasNightStarBadge: false,
          };

    case 'hot_sunny':
      return isFemale
        ? {
            topLight: '#FFE4E6',
            topMid: '#FDA4AF',
            topDark: '#F43F5E',
            collarColor: '#FFF1F2',
            accentColor: '#FB7185',
            bottomLight: '#FFE4E6',
            bottomDark: '#FB7185',
            shoeMain: '#FFF1F2',
            shoeAccent: '#F43F5E',
            isDress: true,
            isRaincoat: false,
            isPuffer: false,
            isCardigan: false,
            hasSunglasses: true,
            hasSunVisor: true,
            hasEarmuffs: false,
            hasScarf: false,
            hasUmbrella: false,
            umbrellaColor: '#FDA4AF',
            umbrellaRimColor: '#FFF1F2',
            hasNightStarBadge: false,
          }
        : {
            topLight: '#FFEDD5',
            topMid: '#FB923C',
            topDark: '#EA580C',
            collarColor: '#FFFFFF',
            accentColor: '#F97316',
            bottomLight: '#FDE68A',
            bottomDark: '#D97706',
            shoeMain: '#FFFFFF',
            shoeAccent: '#FB923C',
            isDress: false,
            isRaincoat: false,
            isPuffer: false,
            isCardigan: false,
            hasSunglasses: true,
            hasSunVisor: false,
            hasEarmuffs: false,
            hasScarf: false,
            hasUmbrella: false,
            umbrellaColor: '#93C5FD',
            umbrellaRimColor: '#FFFFFF',
            hasNightStarBadge: false,
          };

    case 'clear_night':
      return isFemale
        ? {
            topLight: '#EDE9FE',
            topMid: '#C4B5FD',
            topDark: '#7C3AED',
            collarColor: '#F5F3FF',
            accentColor: '#FDE047',
            bottomLight: '#EDE9FE',
            bottomDark: '#A78BFA',
            shoeMain: '#F5F3FF',
            shoeAccent: '#8B5CF6',
            isDress: true,
            isRaincoat: false,
            isPuffer: false,
            isCardigan: false,
            hasSunglasses: false,
            hasSunVisor: false,
            hasEarmuffs: false,
            hasScarf: false,
            hasUmbrella: false,
            umbrellaColor: '#C4B5FD',
            umbrellaRimColor: '#F5F3FF',
            hasNightStarBadge: true,
          }
        : {
            topLight: '#DBEAFE',
            topMid: '#93C5FD',
            topDark: '#2563EB',
            collarColor: '#EFF6FF',
            accentColor: '#FDE047',
            bottomLight: '#475569',
            bottomDark: '#334155',
            shoeMain: '#F1F5F9',
            shoeAccent: '#60A5FA',
            isDress: false,
            isRaincoat: false,
            isPuffer: false,
            isCardigan: false,
            hasSunglasses: false,
            hasSunVisor: false,
            hasEarmuffs: false,
            hasScarf: false,
            hasUmbrella: false,
            umbrellaColor: '#93C5FD',
            umbrellaRimColor: '#EFF6FF',
            hasNightStarBadge: true,
          };

    case 'chilly_cozy':
      return isFemale
        ? {
            topLight: '#FFF1F2',
            topMid: '#FDA4AF',
            topDark: '#E11D48',
            collarColor: '#FFFBEB',
            accentColor: '#9F1239',
            bottomLight: '#D97706',
            bottomDark: '#92400E',
            shoeMain: '#92400E',
            shoeAccent: '#FDE68A',
            isDress: true,
            isRaincoat: false,
            isPuffer: false,
            isCardigan: true,
            hasSunglasses: false,
            hasSunVisor: false,
            hasEarmuffs: false,
            hasScarf: false,
            hasUmbrella: false,
            umbrellaColor: '#FECDD3',
            umbrellaRimColor: '#FFF1F2',
            hasNightStarBadge: false,
          }
        : {
            topLight: '#FEF9C3',
            topMid: '#FDE047',
            topDark: '#CA8A04',
            collarColor: '#E0F2FE',
            accentColor: '#854D0E',
            bottomLight: '#B45309',
            bottomDark: '#78350F',
            shoeMain: '#78350F',
            shoeAccent: '#FDE68A',
            isDress: false,
            isRaincoat: false,
            isPuffer: false,
            isCardigan: true,
            hasSunglasses: false,
            hasSunVisor: false,
            hasEarmuffs: false,
            hasScarf: false,
            hasUmbrella: false,
            umbrellaColor: '#93C5FD',
            umbrellaRimColor: '#FFFFFF',
            hasNightStarBadge: false,
          };

    case 'freezing_puffer':
      return isFemale
        ? {
            topLight: '#FCE7F3',
            topMid: '#F472B6',
            topDark: '#BE185D',
            collarColor: '#FFFBEB',
            accentColor: '#FFF1F2',
            bottomLight: '#475569',
            bottomDark: '#1E293B',
            shoeMain: '#FBCFE8',
            shoeAccent: '#FFFFFF',
            isDress: false,
            isRaincoat: false,
            isPuffer: true,
            isCardigan: false,
            hasSunglasses: false,
            hasSunVisor: false,
            hasEarmuffs: true,
            hasScarf: true,
            hasUmbrella: false,
            umbrellaColor: '#F9A8D4',
            umbrellaRimColor: '#FFF1F2',
            hasNightStarBadge: false,
          }
        : {
            topLight: '#E0F2FE',
            topMid: '#38BDF8',
            topDark: '#0369A1',
            collarColor: '#F8FAFC',
            accentColor: '#F43F5E',
            bottomLight: '#1E293B',
            bottomDark: '#0F172A',
            shoeMain: '#92400E',
            shoeAccent: '#FEF3C7',
            isDress: false,
            isRaincoat: false,
            isPuffer: true,
            isCardigan: false,
            hasSunglasses: false,
            hasSunVisor: false,
            hasEarmuffs: true,
            hasScarf: true,
            hasUmbrella: false,
            umbrellaColor: '#7DD3FC',
            umbrellaRimColor: '#F0F9FF',
            hasNightStarBadge: false,
          };

    case 'pleasant_sunny':
    default:
      return isFemale
        ? {
            topLight: '#FEF9C3',
            topMid: '#FDE047',
            topDark: '#EAB308',
            collarColor: '#FFFFFF',
            accentColor: '#F59E0B',
            bottomLight: '#FEF9C3',
            bottomDark: '#FACC15',
            shoeMain: '#FFFBEB',
            shoeAccent: '#FACC15',
            isDress: true,
            isRaincoat: false,
            isPuffer: false,
            isCardigan: false,
            hasSunglasses: false,
            hasSunVisor: false,
            hasEarmuffs: false,
            hasScarf: false,
            hasUmbrella: false,
            umbrellaColor: '#FDE047',
            umbrellaRimColor: '#FFFFFF',
            hasNightStarBadge: false,
          }
        : {
            topLight: '#E0F2FE',
            topMid: '#93C5FD',
            topDark: '#3B82F6',
            collarColor: '#FFFFFF',
            accentColor: '#2563EB',
            bottomLight: '#E7E5E4',
            bottomDark: '#A8A29E',
            shoeMain: '#FFFFFF',
            shoeAccent: '#60A5FA',
            isDress: false,
            isRaincoat: false,
            isPuffer: false,
            isCardigan: false,
            hasSunglasses: false,
            hasSunVisor: false,
            hasEarmuffs: false,
            hasScarf: false,
            hasUmbrella: false,
            umbrellaColor: '#93C5FD',
            umbrellaRimColor: '#FFFFFF',
            hasNightStarBadge: false,
          };
  }
}

export const ChibiSvgDefs: React.FC<{ outfit: OutfitPalette }> = ({ outfit }) => (
  <Defs>
    {/* Soft-Clay Subsurface Vinyl Skin */}
    <RadialGradient id="skinGrad" cx="44%" cy="34%" rx="60%" ry="60%">
      <Stop offset="0%" stopColor="#FFF7F2" />
      <Stop offset="55%" stopColor="#FFE4D4" />
      <Stop offset="88%" stopColor="#F5C3AB" />
      <Stop offset="100%" stopColor="#E8AE92" />
    </RadialGradient>

    <RadialGradient id="cheekBlush" cx="50%" cy="50%" rx="50%" ry="50%">
      <Stop offset="0%" stopColor="#FF7563" stopOpacity="0.68" />
      <Stop offset="62%" stopColor="#FF9482" stopOpacity="0.28" />
      <Stop offset="100%" stopColor="#FF9482" stopOpacity="0" />
    </RadialGradient>

    {/* Sculpted Warm Chestnut Hair with Soft Highlights */}
    <RadialGradient id="hairGrad" cx="38%" cy="26%" rx="66%" ry="66%">
      <Stop offset="0%" stopColor="#B0724E" />
      <Stop offset="48%" stopColor="#7C492D" />
      <Stop offset="85%" stopColor="#522D1A" />
      <Stop offset="100%" stopColor="#3D2011" />
    </RadialGradient>

    {/* Deep Glossy Espresso-Amber Iris */}
    <LinearGradient id="irisGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <Stop offset="0%" stopColor="#21100A" />
      <Stop offset="48%" stopColor="#592F1C" />
      <Stop offset="85%" stopColor="#9C5733" />
      <Stop offset="100%" stopColor="#C87A4B" />
    </LinearGradient>

    {/* Dynamic Weather Outfit Gradients */}
    <LinearGradient id="outfitTopGrad" x1="18%" y1="0%" x2="82%" y2="100%">
      <Stop offset="0%" stopColor={outfit.topLight} />
      <Stop offset="52%" stopColor={outfit.topMid} />
      <Stop offset="100%" stopColor={outfit.topDark} />
    </LinearGradient>

    <LinearGradient id="outfitBottomGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <Stop offset="0%" stopColor={outfit.bottomLight} />
      <Stop offset="100%" stopColor={outfit.bottomDark} />
    </LinearGradient>

    <LinearGradient id="umbrellaCanopyGrad" x1="20%" y1="0%" x2="80%" y2="100%">
      <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.92" />
      <Stop offset="45%" stopColor={outfit.umbrellaColor} stopOpacity="0.82" />
      <Stop offset="100%" stopColor={outfit.topDark} stopOpacity="0.76" />
    </LinearGradient>

    {/* Kitten & Puppy Soft Clay Gradients */}
    <RadialGradient id="catFurGrad" cx="40%" cy="32%" rx="62%" ry="62%">
      <Stop offset="0%" stopColor="#FFF0E0" />
      <Stop offset="52%" stopColor="#FDBA74" />
      <Stop offset="100%" stopColor="#EA580C" />
    </RadialGradient>

    <RadialGradient id="corgiFurGrad" cx="40%" cy="32%" rx="62%" ry="62%">
      <Stop offset="0%" stopColor="#FEF3C7" />
      <Stop offset="54%" stopColor="#F59E0B" />
      <Stop offset="100%" stopColor="#B45309" />
    </RadialGradient>
  </Defs>
);

export interface CompanionPetProps {
  kind: 'cat' | 'puppy';
  x: number;
  y: number;
  walkPhase: number;
  isWalking: boolean;
  facingLeft: boolean;
  beingPetted: boolean;
  wagPhase: number;
  blinkClosed: boolean;
}

export const WalkingPetCompanion: React.FC<CompanionPetProps> = ({
  kind,
  x,
  y,
  walkPhase,
  isWalking,
  facingLeft,
  beingPetted,
  wagPhase,
  blinkClosed,
}) => {
  const flipX = facingLeft ? -1 : 1;
  // Diagonal 4-paw walking cycle + joyful bounce
  const strideA = isWalking ? Math.sin(walkPhase * 2.2) : 0;
  const strideB = isWalking ? Math.sin(walkPhase * 2.2 + Math.PI) : 0;
  const liftA = isWalking ? Math.max(0, -Math.cos(walkPhase * 2.2)) * 3.8 : 0;
  const liftB = isWalking ? Math.max(0, Math.cos(walkPhase * 2.2)) * 3.8 : 0;

  const bobY = isWalking
    ? Math.abs(Math.sin(walkPhase * 2.2)) * -4.2
    : Math.sin(wagPhase * 0.65) * -1.3;
  const tailAngle =
    Math.sin(wagPhase * (beingPetted ? 3.5 : 1.9)) * (beingPetted ? 24 : 14);
  const headSquishY = beingPetted
    ? 1 - Math.abs(Math.sin(wagPhase * 1.5)) * 0.085
    : 1;
  const headTilt = beingPetted
    ? Math.sin(wagPhase * 1.5) * 4.5
    : isWalking
      ? Math.sin(walkPhase * 2.2) * 2.2
      : 0;

  if (kind === 'cat') {
    return (
      <G transform={`translate(${x}, ${y + bobY}) scale(${flipX}, 1)`}>
        {/* Ground contact shadow */}
        <Ellipse cx={0} cy={22.5} rx={23} ry={5.2} fill="#0F172A" opacity={0.18} />

        {/* Wagging Curled Ginger Cat Tail */}
        <G transform={`translate(-16, 7) rotate(${tailAngle})`}>
          <Path
            d="M 0 0 C -14 -4, -19 -20, -9 -25 C -3 -27, -2 -18, -6 -15"
            stroke="#EA580C"
            strokeWidth={6.8}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 0 0 C -14 -4, -19 -20, -9 -25"
            stroke="#FDBA74"
            strokeWidth={4.2}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={-9} cy={-24} r={3.2} fill="#FFF7ED" />
        </G>

        {/* 4 Articulated Walking Paws (Back-Far, Front-Far, Plump Body, Back-Near, Front-Near) */}
        {/* Far-side Back & Front Paws */}
        <Ellipse
          cx={-11 + strideB * 5.2}
          cy={18.5 - liftB * 0.7}
          rx={4.8}
          ry={3.8}
          fill="#FED7AA"
        />
        <Ellipse
          cx={7 + strideA * 5.2}
          cy={18.5 - liftA * 0.7}
          rx={4.8}
          ry={3.8}
          fill="#FED7AA"
        />

        {/* Plump Ginger Tabby Body + Cream Belly Bib */}
        <Ellipse cx={0} cy={8} rx={16.5} ry={12.8} fill="url(#catFurGrad)" />
        <Path
          d="M -6 -3 Q -5 4 -6 10 M 0 -4 Q 1 4 0 11"
          stroke="#C2410C"
          strokeWidth={1.8}
          strokeLinecap="round"
          opacity={0.45}
          fill="none"
        />
        <Ellipse cx={4} cy={9.5} rx={9.5} ry={8.8} fill="#FFF7ED" />

        {/* Near-side Back & Front Paws */}
        <Ellipse
          cx={-7 + strideA * 5.8}
          cy={19.8 - liftA}
          rx={5.4}
          ry={4.1}
          fill="#FFF7ED"
          stroke="#FDBA74"
          strokeWidth={1}
        />
        <Ellipse
          cx={11 + strideB * 5.8}
          cy={19.8 - liftB}
          rx={5.4}
          ry={4.1}
          fill="#FFF7ED"
          stroke="#FDBA74"
          strokeWidth={1}
        />

        {/* Cat Head */}
        <G transform={`translate(6, -10) rotate(${headTilt}) scale(1, ${headSquishY})`}>
          {/* Pointy Ears with Inner Pink */}
          <Path
            d="M -14 -7 L -18 -22 L -4 -14 Z"
            fill="#EA580C"
            stroke="#EA580C"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <Path d="M -13 -9 L -15.5 -18.5 L -6 -13 Z" fill="#FDA4AF" />
          <Path
            d="M 14 -7 L 18 -22 L 4 -14 Z"
            fill="#EA580C"
            stroke="#EA580C"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <Path d="M 13 -9 L 15.5 -18.5 L 6 -13 Z" fill="#FDA4AF" />

          {/* Plump Cheeks & Whiskers */}
          <Ellipse cx={0} cy={0} rx={17.8} ry={14.6} fill="url(#catFurGrad)" />
          <Ellipse cx={0} cy={4.2} rx={12.4} ry={8.6} fill="#FFF7ED" />
          {/* Tabby M Forehead Stripes */}
          <Path
            d="M -4.2 -12.2 L -3 -7.2 M 0 -13.2 L 0 -7.2 M 4.2 -12.2 L 3 -7.2"
            stroke="#C2410C"
            strokeWidth={2}
            strokeLinecap="round"
          />
          {/* Cute Whiskers */}
          <Path
            d="M -14 2 L -20 0.5 M -14 4.5 L -20 5.5 M 14 2 L 20 0.5 M 14 4.5 L 20 5.5"
            stroke="#9A3412"
            strokeWidth={1.1}
            strokeLinecap="round"
            opacity={0.55}
          />

          {/* Cat Eyes (Happy squint when petted!) */}
          {beingPetted || blinkClosed ? (
            <G>
              <Path
                d="M -10.5 -1 Q -6.8 -5.5 -3 -1"
                stroke="#3B1D11"
                strokeWidth={2.3}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d="M 3 -1 Q 6.8 -5.5 10.5 -1"
                stroke="#3B1D11"
                strokeWidth={2.3}
                strokeLinecap="round"
                fill="none"
              />
            </G>
          ) : (
            <G>
              <Circle cx={-6.8} cy={-1} r={3.8} fill="#29150E" />
              <Circle cx={-7.9} cy={-2.3} r={1.4} fill="#FFFFFF" />
              <Circle cx={6.8} cy={-1} r={3.8} fill="#29150E" />
              <Circle cx={5.7} cy={-2.3} r={1.4} fill="#FFFFFF" />
            </G>
          )}

          {/* Rosy Cheeks & Cute ":3" Mouth */}
          <Ellipse cx={-11.2} cy={3.2} rx={3.6} ry={2.1} fill="#FB7185" opacity={0.52} />
          <Ellipse cx={11.2} cy={3.2} rx={3.6} ry={2.1} fill="#FB7185" opacity={0.52} />
          <Path d="M -2 1.5 L 2 1.5 L 0 3.4 Z" fill="#F43F5E" />
          <Path
            d="M -3.8 4.4 Q -1.9 6.8 0 4.3 Q 1.9 6.8 3.8 4.4"
            stroke="#431407"
            strokeWidth={1.6}
            strokeLinecap="round"
            fill="none"
          />

          {/* Red Collar & Golden Bell */}
          <Path
            d="M -11.5 12 Q 0 15.2 11.5 12"
            stroke="#F43F5E"
            strokeWidth={3.2}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={1} cy={14.8} r={3} fill="#FACC15" stroke="#B45309" strokeWidth={0.8} />
        </G>

        {/* Floating Purr Heart when being petted */}
        {beingPetted && (
          <G transform={`translate(9, ${-35 + Math.sin(wagPhase * 1.6) * 3.5})`}>
            <Path
              d="M 0 3 C -4 -2, -9 1, -5 6 L 0 11 L 5 6 C 9 1, 4 -2, 0 3 Z"
              fill="#FB7185"
            />
          </G>
        )}
      </G>
    );
  }

  // Corgi Puppy Companion with 4 Trotting Paws
  return (
    <G transform={`translate(${x}, ${y + bobY}) scale(${flipX}, 1)`}>
      <Ellipse cx={0} cy={22.5} rx={25} ry={5.4} fill="#0F172A" opacity={0.18} />

      {/* Fast-Wagging Corgi Fluffy Nub Tail */}
      <G transform={`translate(-17.5, 4) rotate(${tailAngle * 1.35})`}>
        <Ellipse cx={-4} cy={-2} rx={6.2} ry={4.6} fill="#D97706" />
        <Ellipse cx={-6.2} cy={-3} rx={3.6} ry={2.9} fill="#FFFBEB" />
      </G>

      {/* Far-side Back & Front Trotting Corgi Paws */}
      <Ellipse
        cx={-12 + strideB * 5.6}
        cy={18.5 - liftB * 0.75}
        rx={4.8}
        ry={4.1}
        fill="#FDE68A"
      />
      <Ellipse
        cx={8 + strideA * 5.6}
        cy={18.5 - liftA * 0.75}
        rx={4.8}
        ry={4.1}
        fill="#FDE68A"
      />

      {/* Plump Corgi Loaf Body + Cream Saddle & Chest Bib */}
      <Ellipse cx={0} cy={8} rx={18.5} ry={12.6} fill="url(#corgiFurGrad)" />
      <Ellipse cx={6.5} cy={9.2} rx={10.8} ry={9.6} fill="#FFFBEB" />

      {/* Near-side Back & Front Trotting Corgi Paws */}
      <Ellipse
        cx={-8 + strideA * 6.2}
        cy={19.8 - liftA}
        rx={5.3}
        ry={4.4}
        fill="#FFFBEB"
        stroke="#F59E0B"
        strokeWidth={1}
      />
      <Ellipse
        cx={12 + strideB * 6.2}
        cy={19.8 - liftB}
        rx={5.3}
        ry={4.4}
        fill="#FFFBEB"
        stroke="#F59E0B"
        strokeWidth={1}
      />

      {/* Corgi Head */}
      <G transform={`translate(7.5, -10) rotate(${headTilt}) scale(1, ${headSquishY})`}>
        {/* Big Perked Corgi Ears */}
        <Path d="M -15 -5 C -22 -23, -10 -26, -4 -12 Z" fill="#D97706" />
        <Path d="M -13 -7 C -17.5 -18.5, -10 -20.5, -6 -12 Z" fill="#FDE68A" />
        <Path d="M 15 -5 C 22 -23, 10 -26, 4 -12 Z" fill="#D97706" />
        <Path d="M 13 -7 C 17.5 -18.5, 10 -20.5, 6 -12 Z" fill="#FDE68A" />

        <Ellipse cx={0} cy={0} rx={18.2} ry={14.6} fill="url(#corgiFurGrad)" />
        {/* White Facial Blaze & Muzzle */}
        <Path
          d="M -3 -12 C -2 -4, -9.5 1, -9.5 7.2 C -9.5 12.2, 9.5 12.2, 9.5 7.2 C 9.5 1, 2 -4, 3 -12 Z"
          fill="#FFFBEB"
        />

        {/* Cute Eyebrow Puffs */}
        <Ellipse cx={-6.5} cy={-6} rx={2.4} ry={1.4} fill="#FEF3C7" />
        <Ellipse cx={6.5} cy={-6} rx={2.4} ry={1.4} fill="#FEF3C7" />

        {beingPetted || blinkClosed ? (
          <G>
            <Path
              d="M -10.8 -1 Q -7 -5.5 -3.5 -1"
              stroke="#29150E"
              strokeWidth={2.4}
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d="M 3.5 -1 Q 7 -5.5 10.8 -1"
              stroke="#29150E"
              strokeWidth={2.4}
              strokeLinecap="round"
              fill="none"
            />
          </G>
        ) : (
          <G>
            <Circle cx={-7} cy={-1.2} r={3.8} fill="#29150E" />
            <Circle cx={-8.1} cy={-2.5} r={1.4} fill="#FFFFFF" />
            <Circle cx={7} cy={-1.2} r={3.8} fill="#29150E" />
            <Circle cx={5.9} cy={-2.5} r={1.4} fill="#FFFFFF" />
          </G>
        )}

        {/* Button Nose & Happy Panting Pink Tongue */}
        <Ellipse cx={0} cy={2.2} rx={2.9} ry={2.1} fill="#29150E" />
        <Path d="M -2.6 5.2 Q 0 11.4 2.6 5.2 Z" fill="#FB7185" />
        <Path
          d="M -4.2 4.5 Q 0 7.2 4.2 4.5"
          stroke="#29150E"
          strokeWidth={1.6}
          strokeLinecap="round"
          fill="none"
        />

        {/* Sky-Blue Collar & Bone Tag */}
        <Path
          d="M -12 11.8 Q 0 15 12 11.8"
          stroke="#38BDF8"
          strokeWidth={3.2}
          strokeLinecap="round"
          fill="none"
        />
        <Circle cx={0.5} cy={14.6} r={2.8} fill="#FDE047" stroke="#CA8A04" strokeWidth={0.8} />
      </G>

      {beingPetted && (
        <G transform={`translate(10, ${-36 + Math.sin(wagPhase * 1.7) * 3.5})`}>
          <Path
            d="M 0 3 C -4 -2, -9 1, -5 6 L 0 11 L 5 6 C 9 1, 4 -2, 0 3 Z"
            fill="#FB7185"
          />
        </G>
      )}
    </G>
  );
};

export interface HeldNpcPropProps {
  npcAction: NpcActionId;
  isSittingNpc: boolean;
  propPhase: number;
}

export const NpcHeldCenterProp: React.FC<HeldNpcPropProps> = ({
  npcAction,
  isSittingNpc,
  propPhase,
}) => {
  if (!isSittingNpc) return null;

  if (npcAction === 'reading_book') {
    const flipCycle = (Math.sin(propPhase * 0.85) + 1) * 0.5; // 0..1 smooth page turn
    const flipArcX = 24 - flipCycle * 46;
    const flipArcY = -10 - Math.sin(flipCycle * Math.PI) * 11;
    return (
      <G transform="translate(160, 215)">
        {/* Open Hardcover Book Cover & Spine */}
        <Path
          d="M -31 -8 Q -15 -15 0 -6 Q 15 -15 31 -8 L 29 17 Q 14 10 0 19 Q -14 10 -29 17 Z"
          fill="#F43F5E"
          stroke="#9F1239"
          strokeWidth={1.6}
        />
        {/* Dangling Golden Bookmark Ribbon */}
        <Path
          d="M 0 18 Q 2 25 6 28 L 9 26 L 8 22"
          stroke="#FACC15"
          strokeWidth={2.2}
          strokeLinecap="round"
          fill="none"
        />
        {/* Left & Right Cream Pages */}
        <Path d="M -28 -10 Q -13 -16 0 -7 L 0 15 Q -13 8 -26 14 Z" fill="#FFFBEB" />
        <Path d="M 28 -10 Q 13 -16 0 -7 L 0 15 Q 13 8 26 14 Z" fill="#FEF3C7" />
        {/* Subtle Printed Text Lines on Left & Right Pages */}
        <Path
          d="M -22 -4 Q -13 -7 -5 -2 M -21 1 Q -13 -2 -5 3 M -20 6 Q -13 3 -6 7 M 5 -2 Q 13 -7 22 -4 M 5 3 Q 13 -2 21 1"
          stroke="#D97706"
          strokeOpacity={0.38}
          strokeWidth={1.3}
          strokeLinecap="round"
          fill="none"
        />
        {/* Animated Turning Page */}
        <Path
          d={`M 0 -7 Q ${flipArcX * 0.55} ${flipArcY - 5} ${flipArcX} ${flipArcY} L ${
            flipArcX * 0.88
          } ${flipArcY + 20} L 0 15 Z`}
          fill="#FFFFFF"
          opacity={0.95}
          stroke="#FDE68A"
          strokeWidth={0.8}
        />
        <Path d="M 0 -7 L 0 16.5" stroke="#B45309" strokeWidth={1.7} />
      </G>
    );
  }

  if (npcAction === 'scrolling_phone') {
    const glowOpacity = 0.24 + Math.sin(propPhase * 2.2) * 0.09;
    const scrollOffset = ((propPhase * 9) % 16) - 8;
    return (
      <G transform="translate(160, 206) rotate(-7)">
        {/* Soft Screen Illumination Bounce on Face/Chest */}
        <Ellipse cx={0} cy={-18} rx={28} ry={19} fill="#38BDF8" opacity={glowOpacity} />
        {/* Pastel Smartphone Case */}
        <Rect
          x={-13.5}
          y={-21}
          width={27}
          height={42}
          rx={6.5}
          fill="#A78BFA"
          stroke="#6D28D9"
          strokeWidth={1.5}
        />
        <Rect x={-11} y={-18} width={22} height={36} rx={4.5} fill="#E0F2FE" />
        {/* Animated Scrolling Feed Pills on Screen */}
        <Rect
          x={-7.5}
          y={-8 + scrollOffset * 0.45}
          width={15}
          height={6}
          rx={2}
          fill="#7DD3FC"
          opacity={0.65}
        />
        <Rect
          x={-7.5}
          y={1 + scrollOffset * 0.45}
          width={12}
          height={5}
          rx={2}
          fill="#BAE6FD"
          opacity={0.75}
        />
        {/* Dual Camera Lens Module */}
        <Rect x={-9} y={-15.5} width={7.5} height={11} rx={3} fill="#8B5CF6" />
        <Circle cx={-5.2} cy={-12.4} r={2} fill="#3B0764" />
        <Circle cx={-5.2} cy={-7.5} r={2} fill="#3B0764" />
      </G>
    );
  }

  if (npcAction === 'listening_music') {
    const steamDrift = Math.sin(propPhase * 1.6) * 2.5;
    return (
      <G transform="translate(155, 211)">
        {/* Cozy Ceramic Mug with Kraft Sleeve */}
        <Path
          d="M 9 -4 Q 15 -4 15 2 Q 15 8 8 8"
          stroke="#FFFBEB"
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M -10 -10 L 10 -10 L 8 14 Q 0 17 -8 14 Z"
          fill="#FFFBEB"
          stroke="#D97706"
          strokeWidth={1.4}
        />
        <Path d="M -9 -3 L 9 -3 L 8.2 8 L -8.2 8 Z" fill="#FDBA74" />
        <Ellipse cx={0} cy={-10} rx={10} ry={3.2} fill="#FEF3C7" stroke="#D97706" strokeWidth={1} />
        <Ellipse cx={0} cy={-10} rx={7.5} ry={2} fill="#92400E" opacity={0.75} />
        {/* Rising Warm Steam Curl */}
        <Path
          d={`M ${-2 + steamDrift * 0.4} -14 Q ${-5 + steamDrift} -20 ${-1 + steamDrift * 0.6} -26`}
          stroke="#FFFFFF"
          strokeOpacity={0.65}
          strokeWidth={1.8}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d={`M ${4 - steamDrift * 0.4} -13 Q ${7 - steamDrift} -19 ${3 - steamDrift * 0.6} -24`}
          stroke="#FFFFFF"
          strokeOpacity={0.5}
          strokeWidth={1.5}
          strokeLinecap="round"
          fill="none"
        />
      </G>
    );
  }

  return null;
};

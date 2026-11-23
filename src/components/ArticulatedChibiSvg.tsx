import React from 'react';
import {
  Circle,
  Ellipse,
  G,
  Line,
  Path,
  Rect,
} from 'react-native-svg';
import type { CharacterSceneId, Gender, NpcActionId } from '../art/characterAssets';
import {
  ChibiSvgDefs,
  NpcHeldCenterProp,
  WalkingPetCompanion,
  getOutfitSpec,
} from './chibiRigParts';

/**
 * 100% Mathematical Canonical Anatomy Landmarks (in 320x320 / 320x340 SVG space).
 * Identical across BOTH genders (Nam & Nữ) and ALL 7 weather states:
 * - Crown top: y = 63 (head center 122 - 59)
 * - Eye horizontal axis: y = 127 (head center 122 + 5)
 * - Chin bottom: y = 172 (head center 122 + 50)
 * - Left & right shoulder pivots: (128, 184) & (192, 184)
 * - Hip baseline: y = 234
 * - Shoe/boot sole bottom: y = 281 (hip 234 + 47)
 */
export const CANONICAL_CHIBI_LANDMARKS = {
  centerX: 160,
  headCenterY: 122,
  crownTopY: 63,
  eyeAxisY: 127,
  chinBottomY: 172,
  leftShoulder: { x: 128, y: 184 },
  rightShoulder: { x: 192, y: 184 },
  torsoTopY: 173,
  hipBaselineY: 234,
  leftLegX: 145,
  rightLegX: 175,
  soleBottomY: 281,
} as const;

export interface ChibiKinematicFrame {
  /** 0 = seated/crouched NPC posture, 1 = standing alert posture */
  standBlend: number;
  breathPhase: number;
  swayDeg: number;
  headTiltDeg: number;
  /** Eye pupil & face 2.5D parallax (-1..+1) */
  gazeX: number;
  gazeY: number;
  /** 0 = open eyes, 1 = closed blink */
  blinkAmount: number;
  /** Happy squint (^ ^) when tapped / petted */
  happySquint: boolean;
  /** Left & right shoulder angles in degrees */
  leftArmDeg: number;
  rightArmDeg: number;
  /** Secondary hair / bun / scarf lag angle */
  secondaryLagDeg: number;
  /** Prop / hand cycle clock (radians) */
  propClock: number;
  /** Vertical jump offset (negative = up) */
  hopOffsetY: number;
  /** Walking companion state (active when npcAction is petting_cat or petting_puppy) */
  petX: number;
  petWalking: boolean;
  petFacingLeft: boolean;
  petBeingPetted: boolean;
  petBlinkClosed: boolean;
}

/**
 * Pure deterministic canonical frame generator for both live initial state and
 * pixel-locked static sprite synchronization across all 7 weather outfits and 5 NPC actions.
 */
export function createCanonicalChibiFrame(options?: {
  isStanding?: boolean;
  npcAction?: NpcActionId;
}): ChibiKinematicFrame {
  const isStanding = options?.isStanding ?? true;
  const npcAction = options?.npcAction ?? 'reading_book';

  let leftArmDeg = 18;
  let rightArmDeg = -18;
  if (!isStanding) {
    switch (npcAction) {
      case 'reading_book':
        leftArmDeg = -34;
        rightArmDeg = 34;
        break;
      case 'petting_cat':
        leftArmDeg = 16;
        rightArmDeg = -44;
        break;
      case 'petting_puppy':
        leftArmDeg = 44;
        rightArmDeg = -16;
        break;
      case 'scrolling_phone':
        leftArmDeg = -36;
        rightArmDeg = 30;
        break;
      case 'listening_music':
      default:
        leftArmDeg = -28;
        rightArmDeg = 26;
        break;
    }
  }

  return {
    standBlend: isStanding ? 1 : 0,
    breathPhase: 0,
    swayDeg: 0,
    headTiltDeg: 0,
    gazeX: 0,
    gazeY: 0,
    blinkAmount: 0,
    happySquint: false,
    leftArmDeg,
    rightArmDeg,
    secondaryLagDeg: 0,
    propClock: 0,
    hopOffsetY: 0,
    petX: npcAction === 'petting_cat' ? 212 : 106,
    petWalking: false,
    petFacingLeft: npcAction === 'petting_cat',
    petBeingPetted: !isStanding && (npcAction === 'petting_cat' || npcAction === 'petting_puppy'),
    petBlinkClosed: false,
  };
}

export interface ArticulatedChibiSvgProps {
  gender: Gender;
  sceneId: CharacterSceneId;
  npcAction: NpcActionId;
  frame: ChibiKinematicFrame;
}

export const ArticulatedChibiSvg: React.FC<ArticulatedChibiSvgProps> = ({
  gender,
  sceneId,
  npcAction,
  frame,
}) => {
  const isFemale = gender === 'female';
  const outfit = getOutfitSpec(gender, sceneId);

  const isSeatedNpc = frame.standBlend < 0.5;
  // Smooth vertical body settle when sitting down into NPC activity (0 when standing!)
  const bodySitDropY = (1 - frame.standBlend) * 20;
  const breathScaleY = 1 + Math.sin(frame.breathPhase) * 0.018;
  const breathScaleX = 1 - Math.sin(frame.breathPhase) * 0.01;
  const bodyY = bodySitDropY + frame.hopOffsetY - Math.sin(frame.breathPhase) * 1.8;

  // 2.5D Face Parallax from gaze (-1..1)
  const faceShiftX = frame.gazeX * 4.2;
  const faceShiftY = frame.gazeY * 2.6;
  const pupilShiftX = frame.gazeX * 3.8;
  const pupilShiftY = frame.gazeY * 2.7;

  const showHeadphones = isSeatedNpc && npcAction === 'listening_music';
  const showPetKind: 'cat' | 'puppy' | null =
    isSeatedNpc && npcAction === 'petting_cat'
      ? 'cat'
      : isSeatedNpc && npcAction === 'petting_puppy'
        ? 'puppy'
        : null;

  const renderArticulatedArm = (side: 'left' | 'right', angleDeg: number) => {
    const isLeft = side === 'left';
    const pivotX = isLeft
      ? CANONICAL_CHIBI_LANDMARKS.leftShoulder.x
      : CANONICAL_CHIBI_LANDMARKS.rightShoulder.x;
    const pivotY = isLeft
      ? CANONICAL_CHIBI_LANDMARKS.leftShoulder.y
      : CANONICAL_CHIBI_LANDMARKS.rightShoulder.y;
    const thumbX = isLeft ? 5.5 : -5.5;
    return (
      <G transform={`translate(${pivotX}, ${pivotY}) rotate(${angleDeg})`}>
        {/* Seamless Spherical Shoulder Joint Cap */}
        <Circle cx={0} cy={0} r={9.5} fill="url(#outfitTopGrad)" />
        {/* Tapered Sculpted Sleeve (Unified Limb Thickness Across All 7 Weather States) */}
        <Path
          d="M -9.2 0 L -8.0 33 Q 0 37.2 8.0 33 L 9.2 0 Z"
          fill="url(#outfitTopGrad)"
        />
        {/* Puffer / Raincoat / Cardigan Cuff Detail */}
        {outfit.isRaincoat ? (
          <Rect x={-8.2} y={29} width={16.4} height={4.2} rx={2} fill="#FEF08A" />
        ) : outfit.isPuffer ? (
          <Path
            d="M -8.5 15 Q 0 18 8.5 15 M -8.2 27 Q 0 30 8.2 27"
            stroke="#FFFFFF"
            strokeOpacity={0.55}
            strokeWidth={1.6}
            fill="none"
          />
        ) : outfit.isCardigan ? (
          <Rect x={-8.0} y={30} width={16.0} height={4} rx={2} fill={outfit.collarColor} />
        ) : null}
        {/* Cute Chubby Vinyl Hand / Winter Mitten with Thumb Nub */}
        <Circle
          cx={thumbX}
          cy={36.5}
          r={3.5}
          fill={outfit.isPuffer ? '#FDA4AF' : 'url(#skinGrad)'}
        />
        <Circle
          cx={0}
          cy={39}
          r={8.2}
          fill={outfit.isPuffer ? '#FDA4AF' : 'url(#skinGrad)'}
        />
      </G>
    );
  };

  // Bring left arm in front of torso when holding props or petting the Corgi puppy on the left
  const leftArmInFront =
    isSeatedNpc &&
    (npcAction === 'petting_puppy' ||
      npcAction === 'reading_book' ||
      npcAction === 'scrolling_phone' ||
      npcAction === 'listening_music');

  return (
    <>
      <ChibiSvgDefs outfit={outfit} />

      {/* Ground Contact Shadow */}
      <Ellipse
        cx={160}
        cy={294}
        rx={isSeatedNpc ? 54 : 45 + frame.hopOffsetY * 0.4}
        ry={isSeatedNpc ? 10.5 : 8.8}
        fill="#0F172A"
        opacity={0.18}
      />

      {/* Ambient Scene Floating Charm (Golden Sun in Sunny / Crescent Moon in Night / Snowflake in Freezing) */}
      {sceneId === 'pleasant_sunny' || sceneId === 'hot_sunny' ? (
        <G
          transform={`translate(${isFemale ? 238 : 82}, ${
            70 + Math.sin(frame.propClock * 0.8) * 4
          }) rotate(${frame.propClock * 12})`}
        >
          <Circle cx={0} cy={0} r={14.5} fill="#FDE047" opacity={0.32} />
          <Circle cx={0} cy={0} r={9.5} fill="#FACC15" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <Line
              key={deg}
              x1={0}
              y1={-12.5}
              x2={0}
              y2={-16.2}
              stroke="#FACC15"
              strokeWidth={2.4}
              strokeLinecap="round"
              transform={`rotate(${deg})`}
            />
          ))}
        </G>
      ) : sceneId === 'clear_night' ? (
        <G
          transform={`translate(${isFemale ? 236 : 84}, ${
            72 + Math.sin(frame.propClock * 0.7) * 3.5
          })`}
        >
          <Path
            d="M 4 -10 A 11 11 0 1 0 12 8 A 8.5 8.5 0 1 1 4 -10 Z"
            fill="#FDE047"
          />
          <Circle cx={-9} cy={-8} r={2.2} fill="#FEF08A" />
          <Circle cx={15} cy={-6} r={1.6} fill="#FEF08A" />
        </G>
      ) : sceneId === 'freezing_puffer' ? (
        <G
          transform={`translate(${isFemale ? 236 : 84}, ${
            74 + Math.sin(frame.propClock * 0.9) * 3.5
          }) rotate(${frame.propClock * 10})`}
          opacity={0.85}
        >
          {[0, 60, 120].map((deg) => (
            <Line
              key={deg}
              x1={0}
              y1={-10}
              x2={0}
              y2={10}
              stroke="#BAE6FD"
              strokeWidth={2.4}
              strokeLinecap="round"
              transform={`rotate(${deg})`}
            />
          ))}
          <Circle cx={0} cy={0} r={3} fill="#FFFFFF" />
        </G>
      ) : null}

      {/* Main Articulated Body Root (Anchored at y = 281 sole baseline) */}
      <G
        transform={`translate(160, 281) translate(0, ${bodyY}) rotate(${frame.swayDeg}) scale(${breathScaleX}, ${breathScaleY}) translate(-160, -281)`}
      >
        {/* 1. Translucent Dome Umbrella Canopy Behind Character (keeps them dry in Standing & NPC modes!) */}
        {outfit.hasUmbrella && (
          <G
            transform={`translate(168, ${isSeatedNpc ? 94 : 80}) rotate(${
              8 + frame.secondaryLagDeg * 0.65
            })`}
          >
            {/* Umbrella Handle Shaft */}
            <Line
              x1={0}
              y1={-20}
              x2={-6}
              y2={96}
              stroke="#94A3B8"
              strokeWidth={3.4}
              strokeLinecap="round"
            />
            {/* Curved J-Hook Umbrella Handle */}
            <Path
              d="M -6 96 Q -6 105 -14.5 105 Q -21 105 -21 97.5"
              stroke={outfit.topDark}
              strokeWidth={4.4}
              strokeLinecap="round"
              fill="none"
            />
            {/* Frosted Translucent Dome Canopy */}
            <Path
              d="M -80 17 C -76 -46, 76 -46, 80 17 Q 53 6 27 17 Q 0 6 -27 17 Q -53 6 -80 17 Z"
              fill="url(#umbrellaCanopyGrad)"
              stroke={outfit.umbrellaRimColor}
              strokeWidth={2.2}
            />
            {/* Canopy Ribs & Specular Highlight */}
            <Path
              d="M 0 -30 C -27 -15, -29 4, -27 17 M 0 -30 C 27 -15, 29 4, 27 17"
              stroke="#FFFFFF"
              strokeOpacity={0.7}
              strokeWidth={1.6}
              fill="none"
            />
            <Path
              d="M -56 -8 C -42 -26, -18 -31, -4 -29"
              stroke="#FFFFFF"
              strokeOpacity={0.55}
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
            />
            <Circle cx={0} cy={-32} r={3.8} fill="#FFFFFF" />
          </G>
        )}

        {/* 2. Storm Raincoat Open Hood Collar Backing (Frames behind head without hiding hair or altering crown y=63!) */}
        {outfit.isRaincoat && (
          <G transform={`translate(160, 122) rotate(${frame.headTiltDeg})`}>
            {/* Open Yellow Storm Hood Backing Ring (Top at local y = -57 -> global y = 65, below crown y = 63!) */}
            <Ellipse
              cx={0}
              cy={0}
              rx={63}
              ry={55}
              fill="url(#outfitTopGrad)"
              stroke="#CA8A04"
              strokeWidth={2}
            />
            <Ellipse cx={0} cy={1} rx={58} ry={50} fill="#CA8A04" opacity={0.35} />
            {isFemale && (
              <>
                {/* Cute Bear-Ear Raincoat Hood Pouches Behind Cô bé Nắng's Twin-Buns */}
                <Circle
                  cx={-46}
                  cy={-38}
                  r={24}
                  fill="#FACC15"
                  stroke="#CA8A04"
                  strokeWidth={1.6}
                />
                <Circle
                  cx={46}
                  cy={-38}
                  r={24}
                  fill="#FACC15"
                  stroke="#CA8A04"
                  strokeWidth={1.6}
                />
              </>
            )}
          </G>
        )}

        {/* 3. Signature Female High Twin-Buns Layer (ALWAYS visible across all 7 weather states!) */}
        {isFemale && (
          <G transform={`translate(160, 122) rotate(${frame.headTiltDeg})`}>
            <G transform={`translate(-46, -38) rotate(${frame.secondaryLagDeg * 1.45})`}>
              <Circle cx={0} cy={0} r={20.5} fill="url(#hairGrad)" />
              <Circle cx={-5.5} cy={-6} r={6.2} fill="#C68660" opacity={0.38} />
              {/* Ribbon Scrunchie & Cute Star Hairclip */}
              <Circle cx={12.5} cy={9.5} r={4.6} fill="#FDE047" />
              <Circle cx={7} cy={13.5} r={3.1} fill="#FDA4AF" />
            </G>
            <G transform={`translate(46, -38) rotate(${frame.secondaryLagDeg * 1.45})`}>
              <Circle cx={0} cy={0} r={20.5} fill="url(#hairGrad)" />
              <Circle cx={-5.5} cy={-6} r={6.2} fill="#C68660" opacity={0.38} />
              <Circle cx={-12.5} cy={9.5} r={4.6} fill="#FDA4AF" />
              <Circle cx={-7} cy={13.5} r={3.1} fill="#FDE047" />
            </G>
          </G>
        )}

        {/* 4. Legs & Shoes (Locked Hip Baseline y = 234, Locked Standing Sole Bottom y = 281 across ALL 7 states & both genders!) */}
        {isSeatedNpc ? (
          <G>
            {/* Seated Crossed / Tucked Chibi Legs */}
            <Path
              d="M 132 238 Q 112 248 118 264 Q 126 274 152 268"
              stroke="url(#outfitBottomGrad)"
              strokeWidth={19.5}
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d="M 188 238 Q 208 248 202 264 Q 194 274 168 268"
              stroke="url(#outfitBottomGrad)"
              strokeWidth={19.5}
              strokeLinecap="round"
              fill="none"
            />
            {/* Cute Seated Shoes / Rain Boots Peeking Out with Rhythm Tap */}
            <G
              transform={`translate(131, ${
                270 + Math.sin(frame.propClock * 1.8) * (npcAction === 'listening_music' ? 2.8 : 0.7)
              }) rotate(-8)`}
            >
              <Ellipse
                cx={0}
                cy={0}
                rx={14.5}
                ry={9.5}
                fill={outfit.shoeMain}
                stroke={outfit.shoeAccent}
                strokeWidth={2.2}
              />
              <Ellipse cx={-3} cy={-3} rx={5} ry={2.2} fill="#FFFFFF" opacity={0.45} />
            </G>
            <G
              transform={`translate(189, ${
                270 - Math.sin(frame.propClock * 1.8) * (npcAction === 'listening_music' ? 2.8 : 0.7)
              }) rotate(8)`}
            >
              <Ellipse
                cx={0}
                cy={0}
                rx={14.5}
                ry={9.5}
                fill={outfit.shoeMain}
                stroke={outfit.shoeAccent}
                strokeWidth={2.2}
              />
              <Ellipse cx={-3} cy={-3} rx={5} ry={2.2} fill="#FFFFFF" opacity={0.45} />
            </G>
          </G>
        ) : (
          <G>
            {/* Left Leg (Pivot at 145, 234 -> Sole bottom at local y = 47 => exact global y = 281.0) */}
            <G transform={`translate(145, 234) rotate(${Math.sin(frame.breathPhase) * 0.9})`}>
              <Rect x={-9.5} y={0} width={19} height={38} rx={9.5} fill="url(#skinGrad)" />
              {!outfit.isDress && (
                <Rect x={-11} y={-2} width={22} height={25} rx={8} fill="url(#outfitBottomGrad)" />
              )}
              {/* Cute Sock Cuff */}
              <Rect x={-9.8} y={24} width={19.6} height={7} rx={3} fill="#FFFFFF" />
              {/* Canonical Shoe / Boot Silhouette (Bottom locked at local y = 47 -> global y = 281) */}
              <Path
                d="M -12.5 29 L 12.5 29 Q 15.5 29 15.5 40 Q 15.5 47 0 47 L -10.5 47 Q -15.5 47 -15.5 39 Z"
                fill={outfit.shoeMain}
              />
              <Rect x={-13.5} y={42} width={27} height={5} rx={2.5} fill={outfit.shoeAccent} />
            </G>

            {/* Right Leg (Pivot at 175, 234 -> Sole bottom at local y = 47 => exact global y = 281.0) */}
            <G transform={`translate(175, 234) rotate(${-Math.sin(frame.breathPhase) * 0.9})`}>
              <Rect x={-9.5} y={0} width={19} height={38} rx={9.5} fill="url(#skinGrad)" />
              {!outfit.isDress && (
                <Rect x={-11} y={-2} width={22} height={25} rx={8} fill="url(#outfitBottomGrad)" />
              )}
              <Rect x={-9.8} y={24} width={19.6} height={7} rx={3} fill="#FFFFFF" />
              <Path
                d="M -12.5 29 L 12.5 29 Q 15.5 29 15.5 40 Q 15.5 47 0 47 L -10.5 47 Q -15.5 47 -15.5 39 Z"
                fill={outfit.shoeMain}
              />
              <Rect x={-13.5} y={42} width={27} height={5} rx={2.5} fill={outfit.shoeAccent} />
            </G>
          </G>
        )}

        {/* 5. Left Articulated Arm (Behind Torso when standing or idle; Pivot locked at 128, 184) */}
        {!leftArmInFront && renderArticulatedArm('left', frame.leftArmDeg)}

        {/* 6. Sculpted Chibi Torso & Modular Weather Outfit (Strictly Unified Proportions ±3-5px Across All 7 States!) */}
        <G>
          {outfit.isRaincoat ? (
            /* Tailored Glossy Yellow Storm Raincoat (Top width 70px at y=173, Hem width 80px at y=240) */
            <G>
              <Path
                d="M 125 173 Q 160 168 195 173 L 200 240 Q 160 247 120 240 Z"
                fill="url(#outfitTopGrad)"
              />
              {/* Reflective Safety Hem Strip */}
              <Path
                d="M 122 234 Q 160 241 198 234"
                stroke="#FEF08A"
                strokeWidth={4}
                strokeLinecap="round"
                fill="none"
              />
              {/* Glossy Specular Highlight & Duffle Toggle Clasps */}
              <Path
                d="M 130 182 L 125 229"
                stroke="#FFFFFF"
                strokeWidth={3.2}
                strokeLinecap="round"
                opacity={0.48}
              />
              <Line x1={160} y1={175} x2={160} y2={242} stroke="#CA8A04" strokeWidth={2} />
              {[190, 207, 224].map((by) => (
                <G key={by}>
                  <Line x1={149} y1={by + 2.2} x2={171} y2={by + 2.2} stroke="#A16207" strokeWidth={1.6} />
                  <Rect
                    x={153.5}
                    y={by}
                    width={13}
                    height={4.6}
                    rx={2.3}
                    fill="#FFFBEB"
                    stroke="#B45309"
                    strokeWidth={1.1}
                  />
                </G>
              ))}
              {/* Cute Raincoat Hood Drawstrings */}
              <Path
                d="M 148 175 Q 146 186 147 193 M 172 175 Q 174 186 173 193"
                stroke="#FFFBEB"
                strokeWidth={2}
                strokeLinecap="round"
                fill="none"
              />
            </G>
          ) : outfit.isPuffer ? (
            /* Tailored 3D Quilted Winter Down Puffer Jacket (Width 74px: x=123..197, y=173..239) */
            <G>
              <Rect x={123} y={173} width={74} height={66} rx={23} fill="url(#outfitTopGrad)" />
              {/* Plush Shearling Collar Trim */}
              <Path
                d="M 135 174 Q 160 185 185 174"
                stroke="#FFFBEB"
                strokeWidth={6.5}
                strokeLinecap="round"
                fill="none"
              />
              {/* Quilted Down Baffle Seams & Center Zipper */}
              <Line x1={160} y1={178} x2={160} y2={238} stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={1.8} />
              <Path
                d="M 125 195 Q 160 201 195 195 M 125 216 Q 160 222 195 216"
                stroke="#FFFFFF"
                strokeOpacity={0.55}
                strokeWidth={2.1}
                fill="none"
              />
              {/* Side Handwarmer Pockets */}
              <Path
                d="M 133 221 L 137 233 M 187 221 L 183 233"
                stroke={outfit.topDark}
                strokeWidth={2}
                strokeLinecap="round"
              />
            </G>
          ) : outfit.isDress ? (
            /* Tailored A-Line Sundress / Trench-Dress / Cardigan Dress (Top 68px: x=126..194, Hem 78px: x=121..199, y=173..240) */
            <G>
              <Path
                d="M 126 173 Q 160 168 194 173 L 199 240 Q 160 247 121 240 Z"
                fill="url(#outfitTopGrad)"
              />
              {/* Pleated Skirt Hem Accent */}
              <Path
                d="M 124 234 Q 160 241 196 234"
                stroke={outfit.collarColor}
                strokeOpacity={0.75}
                strokeWidth={2.4}
                strokeLinecap="round"
                fill="none"
              />
              {outfit.isCardigan ? (
                /* Cozy Knit Cardigan Open Front Over Cream Inner Top + Cable Stitches */
                <G>
                  <Path d="M 148 174 L 146 240 L 174 240 L 172 174 Z" fill={outfit.collarColor} />
                  <Path
                    d="M 135 184 L 133 230 M 185 184 L 187 230"
                    stroke={outfit.topLight}
                    strokeOpacity={0.6}
                    strokeWidth={2}
                    strokeDasharray="4,4"
                  />
                  {[195, 210, 225].map((by) => (
                    <Circle key={by} cx={143} cy={by} r={2.3} fill={outfit.accentColor} />
                  ))}
                </G>
              ) : outfit.hasUmbrella ? (
                /* Double-Breasted Rain Trench Buttons */
                <G>
                  {[194, 211].map((by) => (
                    <G key={by}>
                      <Circle cx={151} cy={by} r={2.4} fill="#FFF1F5" />
                      <Circle cx={169} cy={by} r={2.4} fill="#FFF1F5" />
                    </G>
                  ))}
                </G>
              ) : null}

              {/* Peter Pan Collar & Brooch */}
              <Path
                d="M 142 174 Q 151 186 160 178 Q 169 186 178 174"
                stroke={outfit.collarColor}
                strokeWidth={4.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <Circle cx={160} cy={182} r={3.5} fill={outfit.accentColor} />
            </G>
          ) : (
            /* Tailored Layered Tee / Cable-Knit Cardigan / Waterproof Windbreaker (Width 70px: x=125..195, y=173..238) */
            <G>
              <Rect x={125} y={173} width={70} height={65} rx={21} fill="url(#outfitTopGrad)" />
              {outfit.isCardigan ? (
                /* Mustard Cable-Knit Cardigan over Oxford Shirt Collar */
                <G>
                  <Path d="M 148 174 L 160 202 L 172 174 Z" fill={outfit.collarColor} />
                  <Line x1={160} y1={202} x2={160} y2={237} stroke={outfit.accentColor} strokeWidth={2.2} />
                  {[208, 220, 232].map((by) => (
                    <Circle key={by} cx={160} cy={by} r={2.4} fill={outfit.accentColor} />
                  ))}
                  <Path
                    d="M 137 186 L 137 228 M 183 186 L 183 228"
                    stroke={outfit.topLight}
                    strokeOpacity={0.65}
                    strokeWidth={2}
                    strokeDasharray="4,4"
                  />
                </G>
              ) : outfit.hasUmbrella ? (
                /* Mint Waterproof Windbreaker Zipper & Chest Flap */
                <G>
                  <Line x1={160} y1={176} x2={160} y2={237} stroke="#ECFDF5" strokeWidth={2.2} />
                  <Path d="M 134 198 L 152 198 M 168 198 L 186 198" stroke="#ECFDF5" strokeWidth={2} strokeLinecap="round" />
                </G>
              ) : (
                <G>
                  <Path
                    d="M 144 174 Q 160 186 176 174"
                    stroke={outfit.collarColor}
                    strokeWidth={4.8}
                    strokeLinecap="round"
                    fill="none"
                  />
                  {/* Chest Pocket Emblem (Golden Crescent Star at Night / Fluffy Cloud in Daytime) */}
                  {outfit.hasNightStarBadge ? (
                    <Circle cx={174} cy={198} r={4.5} fill="#FDE047" />
                  ) : (
                    <G transform="translate(172, 198)">
                      <Ellipse cx={0} cy={0} rx={6.5} ry={4} fill="#FFFFFF" opacity={0.85} />
                      <Circle cx={-2} cy={-2} r={3.2} fill="#FFFFFF" opacity={0.85} />
                      <Circle cx={2.5} cy={-1.5} r={2.6} fill="#FFFFFF" opacity={0.85} />
                    </G>
                  )}
                </G>
              )}
            </G>
          )}

          {/* Winter Knitted Scarf with Secondary Flutter & Fringe */}
          {outfit.hasScarf && (
            <G transform="translate(160, 174)">
              <Rect
                x={-30}
                y={-6.5}
                width={60}
                height={17.5}
                rx={8.8}
                fill={isFemale ? '#FFFBEB' : '#F43F5E'}
                stroke={isFemale ? '#FDE68A' : '#BE123C'}
                strokeWidth={1.2}
              />
              <G transform={`translate(16, 4) rotate(${-14 + frame.secondaryLagDeg * 1.85})`}>
                <Rect
                  x={-7.2}
                  y={0}
                  width={15}
                  height={32}
                  rx={6}
                  fill={isFemale ? '#FEF3C7' : '#FB7185'}
                />
                {/* Cute Scarf Fringe */}
                <Line x1={-4} y1={31} x2={-4} y2={35} stroke={isFemale ? '#FDE68A' : '#FDA4AF'} strokeWidth={2} strokeLinecap="round" />
                <Line x1={0} y1={31} x2={0} y2={35} stroke={isFemale ? '#FDE68A' : '#FDA4AF'} strokeWidth={2} strokeLinecap="round" />
                <Line x1={4} y1={31} x2={4} y2={35} stroke={isFemale ? '#FDE68A' : '#FDA4AF'} strokeWidth={2} strokeLinecap="round" />
              </G>
            </G>
          )}
        </G>

        {/* 7. Held NPC Book / Smartphone / Drink Prop */}
        <NpcHeldCenterProp
          npcAction={npcAction}
          isSittingNpc={isSeatedNpc}
          propPhase={frame.propClock}
        />

        {/* 8. Articulated Arms in Front of Torso (Pivots locked at (128, 184) & (192, 184)) */}
        {leftArmInFront && renderArticulatedArm('left', frame.leftArmDeg)}
        {renderArticulatedArm('right', frame.rightArmDeg)}

        {/* 9. Canonical Pop-Mart Squircle Head (Center (160, 122), Crown y = 63, Eye Axis y = 127, Chin y = 172) */}
        <G transform={`translate(160, 122) rotate(${frame.headTiltDeg})`}>
          {/* Soft Vinyl Ears */}
          <Circle cx={-56} cy={8} r={11.5} fill="url(#skinGrad)" />
          <Circle cx={-55} cy={8} r={5.5} fill="#F5A996" opacity={0.48} />
          <Circle cx={56} cy={8} r={11.5} fill="url(#skinGrad)" />
          <Circle cx={55} cy={8} r={5.5} fill="#F5A996" opacity={0.48} />

          {/* Plump Baby-Cheek Squircle Head Silhouette (Bottom locked at local y = 50 -> global y = 172) */}
          <Path
            d="M 0 -52 C 38 -52, 56 -28, 56 4 C 58 34, 40 50, 0 50 C -40 50, -58 34, -56 4 C -56 -28, -38 -52, 0 -52 Z"
            fill="url(#skinGrad)"
          />

          {/* Crown Hair Volume (Top locked at local y = -59 -> global y = 63 across ALL 7 weather states!) */}
          <Path
            d="M -57 -2 C -60 -38, -34 -59, 0 -59 C 34 -59, 60 -38, 57 -2 C 48 -24, -48 -24, -57 -2 Z"
            fill="url(#hairGrad)"
          />

          {/* Gender-Consistent Side Hair Locks (ALWAYS visible across all 7 weather states!) */}
          {isFemale ? (
            <G>
              <Path
                d="M -55 -3 C -59 15, -54 33, -45 42 C -41 33, -46 15, -49 -3 Z"
                fill="url(#hairGrad)"
              />
              <Path
                d="M 55 -3 C 59 15, 54 33, 45 42 C 41 33, 46 15, 49 -3 Z"
                fill="url(#hairGrad)"
              />
            </G>
          ) : (
            <G>
              <Path d="M -55 -4 L -52 13 L -46 1 Z" fill="url(#hairGrad)" />
              <Path d="M 55 -4 L 52 13 L 46 1 Z" fill="url(#hairGrad)" />
            </G>
          )}

          {/* 2.5D Gaze-Shifted Facial Features Group (Identical across all 7 weather states!) */}
          <G transform={`translate(${faceShiftX}, ${faceShiftY})`}>
            {/* Warm Subsurface Rosy Cheeks */}
            <Ellipse
              cx={-31}
              cy={19}
              rx={frame.happySquint ? 15.5 : 13}
              ry={8.8}
              fill="url(#cheekBlush)"
            />
            <Ellipse
              cx={31}
              cy={19}
              rx={frame.happySquint ? 15.5 : 13}
              ry={8.8}
              fill="url(#cheekBlush)"
            />
            <Circle cx={-34} cy={17.5} r={1.8} fill="#FFFFFF" opacity={0.45} />
            <Circle cx={34} cy={17.5} r={1.8} fill="#FFFFFF" opacity={0.45} />

            {/* Expressive Eyebrows */}
            <Path
              d={`M -31 ${frame.happySquint ? -13.5 : -11 - frame.gazeY * 1.4} Q -22 ${
                frame.happySquint ? -18.5 : -15.5 - frame.gazeY * 1.8
              } -13 -11`}
              stroke="#5A331F"
              strokeWidth={2.5}
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d={`M 13 -11 Q 22 ${
                frame.happySquint ? -18.5 : -15.5 - frame.gazeY * 1.8
              } 31 ${frame.happySquint ? -13.5 : -11 - frame.gazeY * 1.4}`}
              stroke="#5A331F"
              strokeWidth={2.5}
              strokeLinecap="round"
              fill="none"
            />

            {/* LIVING EYES: Horizontal Axis locked at local cy = 5 (global y = 127) */}
            {frame.happySquint || frame.blinkAmount > 0.72 ? (
              <G>
                <Path
                  d={
                    frame.happySquint
                      ? 'M -32 5 Q -22 -6 -12 5'
                      : 'M -32 5 Q -22 10 -12 5'
                  }
                  stroke="#2B160F"
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  fill="none"
                />
                <Path
                  d={
                    frame.happySquint
                      ? 'M 12 5 Q 22 -6 32 5'
                      : 'M 12 5 Q 22 10 32 5'
                  }
                  stroke="#2B160F"
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  fill="none"
                />
              </G>
            ) : (
              <G
                transform={`translate(0, ${frame.blinkAmount * 2}) scale(1, ${
                  1 - frame.blinkAmount * 0.85
                })`}
              >
                {/* Left Eye Sclera + Moving Iris + Dual Specular Catchlights (Center cy = 5 -> global y = 127) */}
                <Ellipse cx={-22} cy={5} rx={11.8} ry={12.8} fill="#FFFFFF" />
                <G transform={`translate(${pupilShiftX}, ${pupilShiftY})`}>
                  <Ellipse cx={-22} cy={5} rx={8.8} ry={9.8} fill="url(#irisGrad)" />
                  <Path
                    d="M -27.5 8.5 Q -22 13.5 -16.5 8.5"
                    stroke="#F59E0B"
                    strokeOpacity={0.55}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    fill="none"
                  />
                  <Circle cx={-22} cy={5} r={4.5} fill="#1C0D08" />
                  <Circle cx={-25.2} cy={1.4} r={3.3} fill="#FFFFFF" />
                  <Circle cx={-18.4} cy={9.0} r={1.6} fill="#FFFFFF" opacity={0.92} />
                </G>
                {/* Sculpted Upper Eyelash */}
                <Path
                  d={
                    isFemale
                      ? 'M -34 3 Q -22 -9.5 -11 2 L -36.5 0.8'
                      : 'M -33.5 3 Q -22 -8.5 -11 3'
                  }
                  stroke="#2A150E"
                  strokeWidth={3.3}
                  strokeLinecap="round"
                  fill="none"
                />

                {/* Right Eye Sclera + Moving Iris + Dual Specular Catchlights (Center cy = 5 -> global y = 127) */}
                <Ellipse cx={22} cy={5} rx={11.8} ry={12.8} fill="#FFFFFF" />
                <G transform={`translate(${pupilShiftX}, ${pupilShiftY})`}>
                  <Ellipse cx={22} cy={5} rx={8.8} ry={9.8} fill="url(#irisGrad)" />
                  <Path
                    d="M 16.5 8.5 Q 22 13.5 27.5 8.5"
                    stroke="#F59E0B"
                    strokeOpacity={0.55}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    fill="none"
                  />
                  <Circle cx={22} cy={5} r={4.5} fill="#1C0D08" />
                  <Circle cx={18.8} cy={1.4} r={3.3} fill="#FFFFFF" />
                  <Circle cx={25.6} cy={9.0} r={1.6} fill="#FFFFFF" opacity={0.92} />
                </G>
                <Path
                  d={
                    isFemale
                      ? 'M 11 2 Q 22 -9.5 34 3 L 36.5 0.8'
                      : 'M 11 3 Q 22 -8.5 33.5 3'
                  }
                  stroke="#2A150E"
                  strokeWidth={3.3}
                  strokeLinecap="round"
                  fill="none"
                />
              </G>
            )}

            {/* Cute Sculpted Button Nose + Specular Dot */}
            <Ellipse cx={0} cy={14.5} rx={2.9} ry={2} fill="#EAA08C" />
            <Circle cx={-0.8} cy={13.9} r={0.9} fill="#FFF5EE" opacity={0.75} />

            {/* Expressive Mouth */}
            {frame.happySquint ? (
              <G>
                <Path
                  d="M -8.5 22 Q 0 33.5 8.5 22 Z"
                  fill="#F43F5E"
                  stroke="#7F1D1D"
                  strokeWidth={1.5}
                />
                <Ellipse cx={0} cy={26.5} rx={4.5} ry={2.4} fill="#FDA4AF" />
              </G>
            ) : (
              <Path
                d="M -6.5 23 Q 0 28.8 6.5 23"
                stroke="#6D3724"
                strokeWidth={2.3}
                strokeLinecap="round"
                fill="none"
              />
            )}

            {/* Stylish Tinted Sunglasses ONLY in Daytime Hot Sunny (centered on eye axis cy = 5, semi-transparent so eyes stay visible!) */}
            {outfit.hasSunglasses && (
              <G transform="translate(0, 5)">
                <Circle
                  cx={-22}
                  cy={0}
                  r={14.2}
                  fill="#1E1B18"
                  fillOpacity={0.38}
                  stroke={isFemale ? '#FDA4AF' : '#D97706'}
                  strokeWidth={2.6}
                />
                <Path
                  d="M -29 -6 L -19 4"
                  stroke="#FFFFFF"
                  strokeOpacity={0.45}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                />
                <Circle
                  cx={22}
                  cy={0}
                  r={14.2}
                  fill="#1E1B18"
                  fillOpacity={0.38}
                  stroke={isFemale ? '#FDA4AF' : '#D97706'}
                  strokeWidth={2.6}
                />
                <Path
                  d="M 15 -6 L 25 4"
                  stroke="#FFFFFF"
                  strokeOpacity={0.45}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                />
                <Path
                  d="M -7.8 0 Q 0 -3.2 7.8 0"
                  stroke={isFemale ? '#FDA4AF' : '#D97706'}
                  strokeWidth={2.4}
                  fill="none"
                />
              </G>
            )}
          </G>

          {/* Sculpted Front Bangs + Bouncy Top Cowlick (ALWAYS visible in all 7 weather states!) */}
          <G transform={`rotate(${frame.secondaryLagDeg * 0.65})`}>
            <Path
              d="M -52 -12 C -42 -42, 42 -42, 52 -12 C 36 -22, 22 -6, 12 -18 C 2 -4, -10 -4, -20 -18 C -30 -6, -42 -20, -52 -12 Z"
              fill="url(#hairGrad)"
            />
            {/* Soft Angel-Ring Hair Sheen Arc */}
            <Path
              d="M -33 -30 Q 0 -38.5 33 -30"
              stroke="#D4956E"
              strokeWidth={3.4}
              strokeLinecap="round"
              opacity={0.48}
              fill="none"
            />
            {!isFemale && (
              /* Cậu bé Mây's Signature Bouncy Top Cowlick Tuft (ALWAYS visible across all 7 weather states!) */
              <Path
                d={`M 2 -54 Q ${12 + frame.secondaryLagDeg * 1.25} -71 ${
                  21 + frame.secondaryLagDeg * 1.55
                } -59 Q 14 -50 6 -52 Z`}
                fill="#7C4A2D"
              />
            )}
          </G>

          {/* Woven Straw Sun Visor with Ribbon Trim (Fits cleanly across forehead without hiding bangs or crown!) */}
          {outfit.hasSunVisor && (
            <G>
              <Path
                d="M -52 -24 Q 0 -41 52 -24 Q 0 -16 -52 -24 Z"
                fill="#FDE68A"
                stroke="#D97706"
                strokeWidth={1.6}
              />
              <Path
                d="M -40 -26 Q 0 -34 40 -26"
                stroke="#FB7185"
                strokeWidth={2.4}
                strokeLinecap="round"
                fill="none"
              />
            </G>
          )}

          {/* Fuzzy Winter Earmuffs (Fits cleanly on ears while preserving full crown hair, bangs, twin-buns & cowlick!) */}
          {outfit.hasEarmuffs && (
            <G>
              <Path
                d="M -56 2 C -55 -52, 55 -52, 56 2"
                stroke="#F8FAFC"
                strokeWidth={4.5}
                fill="none"
              />
              <Ellipse cx={-58} cy={7} rx={11} ry={14} fill="#FFFBEB" stroke="#E2E8F0" strokeWidth={1.5} />
              <Ellipse cx={58} cy={7} rx={11} ry={14} fill="#FFFBEB" stroke="#E2E8F0" strokeWidth={1.5} />
            </G>
          )}

          {/* Wireless Pastel Headphones (NPC Listening to Music) */}
          {showHeadphones && (
            <G>
              <Path
                d="M -58 4 C -57 -54, 57 -54, 58 4"
                stroke={isFemale ? '#F9A8D4' : '#7DD3FC'}
                strokeWidth={5.5}
                strokeLinecap="round"
                fill="none"
              />
              <Rect
                x={-66}
                y={-8}
                width={14}
                height={26}
                rx={7}
                fill={isFemale ? '#F472B6' : '#38BDF8'}
                stroke="#FFFFFF"
                strokeWidth={2}
              />
              <Rect
                x={52}
                y={-8}
                width={14}
                height={26}
                rx={7}
                fill={isFemale ? '#F472B6' : '#38BDF8'}
                stroke="#FFFFFF"
                strokeWidth={2}
              />
            </G>
          )}
        </G>
      </G>

      {/* 10. Animated Walking Kitten / Corgi Puppy Companion! */}
      {showPetKind && (
        <WalkingPetCompanion
          kind={showPetKind}
          x={frame.petX}
          y={272}
          walkPhase={frame.propClock * 3.2}
          isWalking={frame.petWalking}
          facingLeft={frame.petFacingLeft}
          beingPetted={frame.petBeingPetted}
          wagPhase={frame.propClock * 2.4}
          blinkClosed={frame.petBlinkClosed}
        />
      )}

      {/* 11. Floating Musical Notes when Listening to Music */}
      {showHeadphones && (
        <G opacity={0.88}>
          <G
            transform={`translate(${224 + Math.sin(frame.propClock * 1.4) * 6}, ${
              92 - ((frame.propClock * 18) % 36)
            })`}
          >
            <Circle cx={0} cy={8} r={4} fill="#F472B6" />
            <Line x1={3.5} y1={8} x2={3.5} y2={-6} stroke="#F472B6" strokeWidth={2.2} />
            <Line x1={3.5} y1={-6} x2={11} y2={-3} stroke="#F472B6" strokeWidth={2.5} />
          </G>
          <G
            transform={`translate(${94 - Math.cos(frame.propClock * 1.2) * 6}, ${
              104 - (((frame.propClock + 2) * 16) % 36)
            })`}
          >
            <Circle cx={0} cy={8} r={3.8} fill="#38BDF8" />
            <Line x1={3.2} y1={8} x2={3.2} y2={-5} stroke="#38BDF8" strokeWidth={2.2} />
          </G>
        </G>
      )}
    </>
  );
};

import React from 'react';
import { Platform } from 'react-native';
import Svg, {
  Circle as RnsvgCircle,
  Defs,
  G,
  Line as RnsvgLine,
  LinearGradient,
  Path as RnsvgPath,
  Polygon as RnsvgPolygon,
  Polyline as RnsvgPolyline,
  Rect as RnsvgRect,
  Stop,
} from 'react-native-svg';
import type {
  Icon as PhosphorIconComponent,
  IconWeight,
} from '@phosphor-icons/react';

import { ArrowClockwiseIcon } from '@phosphor-icons/react/dist/csr/ArrowClockwise';
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import { ArrowSquareOutIcon } from '@phosphor-icons/react/dist/csr/ArrowSquareOut';
import { ArrowsClockwiseIcon } from '@phosphor-icons/react/dist/csr/ArrowsClockwise';
import { BackpackIcon } from '@phosphor-icons/react/dist/csr/Backpack';
import { BookmarkSimpleIcon } from '@phosphor-icons/react/dist/csr/BookmarkSimple';
import { BroadcastIcon } from '@phosphor-icons/react/dist/csr/Broadcast';
import { CameraIcon } from '@phosphor-icons/react/dist/csr/Camera';
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown';
import { ChartBarIcon } from '@phosphor-icons/react/dist/csr/ChartBar';
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check';
import { CheckCircleIcon } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { CircleIcon } from '@phosphor-icons/react/dist/csr/Circle';
import { ClockIcon } from '@phosphor-icons/react/dist/csr/Clock';
import { CloudIcon } from '@phosphor-icons/react/dist/csr/Cloud';
import { CloudArrowDownIcon } from '@phosphor-icons/react/dist/csr/CloudArrowDown';
import { CloudFogIcon } from '@phosphor-icons/react/dist/csr/CloudFog';
import { CloudLightningIcon } from '@phosphor-icons/react/dist/csr/CloudLightning';
import { CloudMoonIcon } from '@phosphor-icons/react/dist/csr/CloudMoon';
import { CloudRainIcon } from '@phosphor-icons/react/dist/csr/CloudRain';
import { CloudSnowIcon } from '@phosphor-icons/react/dist/csr/CloudSnow';
import { CloudSunIcon } from '@phosphor-icons/react/dist/csr/CloudSun';
import { CompassIcon } from '@phosphor-icons/react/dist/csr/Compass';
import { CpuIcon } from '@phosphor-icons/react/dist/csr/Cpu';
import { CrosshairIcon } from '@phosphor-icons/react/dist/csr/Crosshair';
import { CubeIcon } from '@phosphor-icons/react/dist/csr/Cube';
import { DesktopIcon } from '@phosphor-icons/react/dist/csr/Desktop';
import { DeviceMobileIcon } from '@phosphor-icons/react/dist/csr/DeviceMobile';
import { DownloadSimpleIcon } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { DropIcon } from '@phosphor-icons/react/dist/csr/Drop';
import { EyeIcon } from '@phosphor-icons/react/dist/csr/Eye';
import { EyeSlashIcon } from '@phosphor-icons/react/dist/csr/EyeSlash';
import { FaceMaskIcon } from '@phosphor-icons/react/dist/csr/FaceMask';
import { FileCodeIcon } from '@phosphor-icons/react/dist/csr/FileCode';
import { FileTextIcon } from '@phosphor-icons/react/dist/csr/FileText';
import { FlameIcon } from '@phosphor-icons/react/dist/csr/Flame';
import { GearSixIcon } from '@phosphor-icons/react/dist/csr/GearSix';
import { GenderFemaleIcon } from '@phosphor-icons/react/dist/csr/GenderFemale';
import { GenderMaleIcon } from '@phosphor-icons/react/dist/csr/GenderMale';
import { GlobeIcon } from '@phosphor-icons/react/dist/csr/Globe';
import { InfoIcon } from '@phosphor-icons/react/dist/csr/Info';
import { KeyIcon } from '@phosphor-icons/react/dist/csr/Key';
import { LayoutIcon } from '@phosphor-icons/react/dist/csr/Layout';
import { LeafIcon } from '@phosphor-icons/react/dist/csr/Leaf';
import { LightningIcon } from '@phosphor-icons/react/dist/csr/Lightning';
import { LockIcon } from '@phosphor-icons/react/dist/csr/Lock';
import { LockSimpleIcon } from '@phosphor-icons/react/dist/csr/LockSimple';
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { MapPinIcon } from '@phosphor-icons/react/dist/csr/MapPin';
import { MonitorIcon } from '@phosphor-icons/react/dist/csr/Monitor';
import { MoonIcon } from '@phosphor-icons/react/dist/csr/Moon';
import { MoonStarsIcon } from '@phosphor-icons/react/dist/csr/MoonStars';
import { NavigationArrowIcon } from '@phosphor-icons/react/dist/csr/NavigationArrow';
import { PackageIcon } from '@phosphor-icons/react/dist/csr/Package';
import { PulseIcon } from '@phosphor-icons/react/dist/csr/Pulse';
import { ShieldIcon } from '@phosphor-icons/react/dist/csr/Shield';
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { ShieldWarningIcon } from '@phosphor-icons/react/dist/csr/ShieldWarning';
import { ShuffleIcon } from '@phosphor-icons/react/dist/csr/Shuffle';
import { SlidersIcon } from '@phosphor-icons/react/dist/csr/Sliders';
import { SlidersHorizontalIcon } from '@phosphor-icons/react/dist/csr/SlidersHorizontal';
import { SnowflakeIcon } from '@phosphor-icons/react/dist/csr/Snowflake';
import { SparkleIcon } from '@phosphor-icons/react/dist/csr/Sparkle';
import { SquaresFourIcon } from '@phosphor-icons/react/dist/csr/SquaresFour';
import { StackIcon } from '@phosphor-icons/react/dist/csr/Stack';
import { SunIcon } from '@phosphor-icons/react/dist/csr/Sun';
import { SunDimIcon } from '@phosphor-icons/react/dist/csr/SunDim';
import { SunHorizonIcon } from '@phosphor-icons/react/dist/csr/SunHorizon';
import { SunglassesIcon } from '@phosphor-icons/react/dist/csr/Sunglasses';
import { ThermometerIcon } from '@phosphor-icons/react/dist/csr/Thermometer';
import { ThermometerColdIcon } from '@phosphor-icons/react/dist/csr/ThermometerCold';
import { ThermometerHotIcon } from '@phosphor-icons/react/dist/csr/ThermometerHot';
import { TrashIcon } from '@phosphor-icons/react/dist/csr/Trash';
import { UmbrellaIcon } from '@phosphor-icons/react/dist/csr/Umbrella';
import { UserIcon } from '@phosphor-icons/react/dist/csr/User';
import { UserCircleIcon } from '@phosphor-icons/react/dist/csr/UserCircle';
import { WindIcon } from '@phosphor-icons/react/dist/csr/Wind';
import { XIcon } from '@phosphor-icons/react/dist/csr/X';

import type { CharacterSceneId, Gender, SkyTheme } from '../core';

export type AppIconWeight = IconWeight;

export interface UniversalIconProps {
  size?: number | string;
  color?: string;
  weight?: AppIconWeight;
  mirrored?: boolean;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  'aria-hidden'?: boolean | 'true' | 'false';
}

function convertDomSvgChildToNative(
  node: React.ReactNode,
  fallbackFill: string,
  keyPrefix: string
): React.ReactNode {
  if (!node || typeof node === 'boolean' || typeof node === 'string' || typeof node === 'number') {
    return null;
  }
  if (Array.isArray(node)) {
    return node.map((child, i) =>
      convertDomSvgChildToNative(child, fallbackFill, `${keyPrefix}_${i}`)
    );
  }
  if (!React.isValidElement(node)) {
    return null;
  }
  const el = node as React.ReactElement<Record<string, unknown>>;
  if (el.type === React.Fragment) {
    return React.Children.map(el.props.children as React.ReactNode, (child, i) =>
      convertDomSvgChildToNative(child, fallbackFill, `${keyPrefix}_f${i}`)
    );
  }
  if (typeof el.type !== 'string') {
    return null;
  }

  const p = el.props;
  const opacity = p.opacity !== undefined ? Number(p.opacity) : undefined;
  const fill = typeof p.fill === 'string' ? p.fill : fallbackFill;
  const stroke = typeof p.stroke === 'string' ? p.stroke : undefined;
  const strokeWidth = p.strokeWidth !== undefined ? Number(p.strokeWidth) : undefined;

  switch (el.type) {
    case 'path':
      return (
        <RnsvgPath
          key={keyPrefix}
          d={String(p.d ?? '')}
          fill={fill}
          opacity={opacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case 'circle':
      return (
        <RnsvgCircle
          key={keyPrefix}
          cx={Number(p.cx ?? 0)}
          cy={Number(p.cy ?? 0)}
          r={Number(p.r ?? 0)}
          fill={fill}
          opacity={opacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case 'rect':
      return (
        <RnsvgRect
          key={keyPrefix}
          x={Number(p.x ?? 0)}
          y={Number(p.y ?? 0)}
          width={Number(p.width ?? 0)}
          height={Number(p.height ?? 0)}
          rx={p.rx !== undefined ? Number(p.rx) : undefined}
          fill={fill}
          opacity={opacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case 'line':
      return (
        <RnsvgLine
          key={keyPrefix}
          x1={Number(p.x1 ?? 0)}
          y1={Number(p.y1 ?? 0)}
          x2={Number(p.x2 ?? 0)}
          y2={Number(p.y2 ?? 0)}
          stroke={stroke ?? fallbackFill}
          strokeWidth={strokeWidth ?? 16}
          opacity={opacity}
        />
      );
    case 'polyline':
      return (
        <RnsvgPolyline
          key={keyPrefix}
          points={String(p.points ?? '')}
          fill={fill}
          opacity={opacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case 'polygon':
      return (
        <RnsvgPolygon
          key={keyPrefix}
          points={String(p.points ?? '')}
          fill={fill}
          opacity={opacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    default:
      return null;
  }
}

function createUniversalIcon(
  RawPhosphor: PhosphorIconComponent,
  defaultWeight: AppIconWeight = 'duotone'
): React.FC<UniversalIconProps> {
  const UniversalIcon: React.FC<UniversalIconProps> = ({
    size = 16,
    color = 'currentColor',
    weight = defaultWeight,
    mirrored = false,
    alt,
    className,
    style,
    'aria-hidden': ariaHidden,
  }) => {
    if (Platform.OS === 'web') {
      return (
        <RawPhosphor
          size={size}
          color={color}
          weight={weight}
          mirrored={mirrored}
          alt={alt}
          className={className}
          aria-hidden={alt ? undefined : (ariaHidden ?? true)}
          style={{
            flexShrink: 0,
            display: 'inline-block',
            verticalAlign: 'middle',
            ...style,
          }}
        />
      );
    }

    const numericSize = typeof size === 'number' ? size : parseFloat(String(size)) || 16;
    const nativeColor = color === 'currentColor' ? '#63ADFF' : color;
    const renderFn = (
      RawPhosphor as unknown as {
        render?: (props: Record<string, unknown>, ref: null) => React.ReactElement<{ children?: React.ReactNode }> | null;
      }
    ).render;
    const rawTree = typeof renderFn === 'function'
      ? renderFn({ size: numericSize, color: nativeColor, weight, mirrored }, null)
      : null;
    const innerDomSvg =
      rawTree && React.isValidElement(rawTree) && typeof rawTree.type === 'object' && rawTree.type !== null && 'render' in rawTree.type
        ? (rawTree.type as { render: (p: unknown, r: null) => React.ReactElement<{ children?: React.ReactNode }> }).render(
            rawTree.props,
            null
          )
        : rawTree;

    return (
      <Svg
        width={numericSize}
        height={numericSize}
        viewBox="0 0 256 256"
        fill={nativeColor}
        style={mirrored ? { transform: [{ scaleX: -1 }] } : undefined}
      >
        {innerDomSvg?.props?.children
          ? convertDomSvgChildToNative(innerDomSvg.props.children, nativeColor, 'p')
          : null}
      </Svg>
    );
  };

  UniversalIcon.displayName = RawPhosphor.displayName ?? 'PhosphorUniversalIcon';
  return UniversalIcon;
}

/* ============================================================================
 * Named Phosphor Duotone Weather & Atmospheric Icons (Default: duotone)
 * ========================================================================== */
export const Sun = createUniversalIcon(SunIcon, 'duotone');
export const SunDim = createUniversalIcon(SunDimIcon, 'duotone');
export const SunHorizon = createUniversalIcon(SunHorizonIcon, 'duotone');
export const Cloud = createUniversalIcon(CloudIcon, 'duotone');
export const CloudSun = createUniversalIcon(CloudSunIcon, 'duotone');
export const CloudMoon = createUniversalIcon(CloudMoonIcon, 'duotone');
export const CloudRain = createUniversalIcon(CloudRainIcon, 'duotone');
export const CloudLightning = createUniversalIcon(CloudLightningIcon, 'duotone');
export const CloudSnow = createUniversalIcon(CloudSnowIcon, 'duotone');
export const CloudFog = createUniversalIcon(CloudFogIcon, 'duotone');
export const Moon = createUniversalIcon(MoonIcon, 'duotone');
export const MoonStars = createUniversalIcon(MoonStarsIcon, 'duotone');
export const Umbrella = createUniversalIcon(UmbrellaIcon, 'duotone');
export const Thermometer = createUniversalIcon(ThermometerIcon, 'duotone');
export const ThermometerHot = createUniversalIcon(ThermometerHotIcon, 'duotone');
export const ThermometerCold = createUniversalIcon(ThermometerColdIcon, 'duotone');
export const Wind = createUniversalIcon(WindIcon, 'duotone');
export const Drop = createUniversalIcon(DropIcon, 'duotone');
export const Shield = createUniversalIcon(ShieldIcon, 'duotone');
export const ShieldCheck = createUniversalIcon(ShieldCheckIcon, 'duotone');
export const ShieldWarning = createUniversalIcon(ShieldWarningIcon, 'duotone');
export const Sparkle = createUniversalIcon(SparkleIcon, 'duotone');
export const Lightning = createUniversalIcon(LightningIcon, 'duotone');
export const Flame = createUniversalIcon(FlameIcon, 'duotone');
export const Snowflake = createUniversalIcon(SnowflakeIcon, 'duotone');
export const Sunglasses = createUniversalIcon(SunglassesIcon, 'duotone');
export const Leaf = createUniversalIcon(LeafIcon, 'duotone');
export const FaceMask = createUniversalIcon(FaceMaskIcon, 'duotone');
export const Backpack = createUniversalIcon(BackpackIcon, 'duotone');
export const Broadcast = createUniversalIcon(BroadcastIcon, 'duotone');

/* ============================================================================
 * Named Phosphor Navigation, Device, Telemetry & Action Icons
 * ========================================================================== */
export const Compass = createUniversalIcon(CompassIcon, 'duotone');
export const Crosshair = createUniversalIcon(CrosshairIcon, 'duotone');
export const NavigationArrow = createUniversalIcon(NavigationArrowIcon, 'duotone');
export const MapPin = createUniversalIcon(MapPinIcon, 'duotone');
export const ArrowsClockwise = createUniversalIcon(ArrowsClockwiseIcon, 'bold');
export const ArrowClockwise = createUniversalIcon(ArrowClockwiseIcon, 'bold');
export const ArrowCounterClockwise = createUniversalIcon(ArrowCounterClockwiseIcon, 'bold');
export const GearSix = createUniversalIcon(GearSixIcon, 'duotone');
export const Sliders = createUniversalIcon(SlidersIcon, 'duotone');
export const SlidersHorizontal = createUniversalIcon(SlidersHorizontalIcon, 'duotone');
export const ChartBar = createUniversalIcon(ChartBarIcon, 'duotone');
export const SquaresFour = createUniversalIcon(SquaresFourIcon, 'duotone');
export const DeviceMobile = createUniversalIcon(DeviceMobileIcon, 'duotone');
export const Desktop = createUniversalIcon(DesktopIcon, 'duotone');
export const Monitor = createUniversalIcon(MonitorIcon, 'duotone');
export const DownloadSimple = createUniversalIcon(DownloadSimpleIcon, 'duotone');
export const CloudArrowDown = createUniversalIcon(CloudArrowDownIcon, 'duotone');
export const ArrowSquareOut = createUniversalIcon(ArrowSquareOutIcon, 'bold');
export const FileCode = createUniversalIcon(FileCodeIcon, 'duotone');
export const FileText = createUniversalIcon(FileTextIcon, 'duotone');
export const Cube = createUniversalIcon(CubeIcon, 'duotone');
export const Eye = createUniversalIcon(EyeIcon, 'duotone');
export const EyeSlash = createUniversalIcon(EyeSlashIcon, 'duotone');
export const Trash = createUniversalIcon(TrashIcon, 'duotone');
export const Check = createUniversalIcon(CheckIcon, 'bold');
export const CheckCircle = createUniversalIcon(CheckCircleIcon, 'duotone');
export const X = createUniversalIcon(XIcon, 'bold');
export const Info = createUniversalIcon(InfoIcon, 'duotone');
export const Package = createUniversalIcon(PackageIcon, 'duotone');
export const Cpu = createUniversalIcon(CpuIcon, 'duotone');
export const MagnifyingGlass = createUniversalIcon(MagnifyingGlassIcon, 'duotone');
export const Clock = createUniversalIcon(ClockIcon, 'duotone');
export const Shuffle = createUniversalIcon(ShuffleIcon, 'duotone');
export const Stack = createUniversalIcon(StackIcon, 'duotone');
export const GenderMale = createUniversalIcon(GenderMaleIcon, 'duotone');
export const GenderFemale = createUniversalIcon(GenderFemaleIcon, 'duotone');
export const User = createUniversalIcon(UserIcon, 'duotone');
export const UserCircle = createUniversalIcon(UserCircleIcon, 'duotone');
export const Globe = createUniversalIcon(GlobeIcon, 'duotone');
export const Key = createUniversalIcon(KeyIcon, 'duotone');
export const Layout = createUniversalIcon(LayoutIcon, 'duotone');
export const BookmarkSimple = createUniversalIcon(BookmarkSimpleIcon, 'duotone');
export const Lock = createUniversalIcon(LockIcon, 'duotone');
export const LockSimple = createUniversalIcon(LockSimpleIcon, 'duotone');
export const Camera = createUniversalIcon(CameraIcon, 'duotone');
export const CaretDown = createUniversalIcon(CaretDownIcon, 'bold');
export const Pulse = createUniversalIcon(PulseIcon, 'duotone');
export const Circle = createUniversalIcon(CircleIcon, 'regular');

/* ============================================================================
 * Typed Registry & <AppIcon name="..." /> Component
 * ========================================================================== */
const APP_ICON_REGISTRY = {
  // Weather & atmospheric
  sun: Sun,
  'sun-dim': SunDim,
  'sun-horizon': SunHorizon,
  cloud: Cloud,
  'cloud-sun': CloudSun,
  'cloud-moon': CloudMoon,
  'cloud-rain': CloudRain,
  'cloud-lightning': CloudLightning,
  'cloud-snow': CloudSnow,
  'cloud-fog': CloudFog,
  moon: MoonStars,
  'moon-stars': MoonStars,
  'moon-simple': Moon,
  umbrella: Umbrella,
  thermometer: Thermometer,
  'thermometer-hot': ThermometerHot,
  'thermometer-cold': ThermometerCold,
  wind: Wind,
  drop: Drop,
  shield: ShieldCheck,
  'shield-check': ShieldCheck,
  'shield-warning': ShieldWarning,
  sparkle: Sparkle,
  lightning: Lightning,
  zap: Lightning,
  flame: Flame,
  snowflake: Snowflake,
  sunglasses: Sunglasses,
  leaf: Leaf,
  'face-mask': FaceMask,
  backpack: Backpack,
  broadcast: Broadcast,
  pulse: Pulse,

  // Navigation, devices & actions (including semantic + legacy alias names)
  compass: Compass,
  crosshair: Crosshair,
  navigation: NavigationArrow,
  'navigation-arrow': NavigationArrow,
  'map-pin': MapPin,
  'arrows-clockwise': ArrowsClockwise,
  'refresh-cw': ArrowsClockwise,
  refresh: ArrowsClockwise,
  'arrow-clockwise': ArrowClockwise,
  'rotate-cw': ArrowClockwise,
  'arrow-counter-clockwise': ArrowCounterClockwise,
  'rotate-ccw': ArrowCounterClockwise,
  settings: GearSix,
  'gear-six': GearSix,
  sliders: SlidersHorizontal,
  'sliders-horizontal': SlidersHorizontal,
  'chart-bar': ChartBar,
  'bar-chart-2': ChartBar,
  'squares-four': SquaresFour,
  grid: SquaresFour,
  'device-mobile': DeviceMobile,
  smartphone: DeviceMobile,
  desktop: Desktop,
  monitor: Desktop,
  'download-simple': DownloadSimple,
  download: DownloadSimple,
  'cloud-arrow-down': CloudArrowDown,
  'download-cloud': CloudArrowDown,
  'arrow-square-out': ArrowSquareOut,
  'external-link': ArrowSquareOut,
  'file-code': FileCode,
  'file-text': FileText,
  cube: Cube,
  box: Cube,
  eye: Eye,
  'eye-slash': EyeSlash,
  'eye-off': EyeSlash,
  trash: Trash,
  'trash-2': Trash,
  check: Check,
  'check-circle': CheckCircle,
  circle: Circle,
  x: X,
  info: Info,
  package: Package,
  cpu: Cpu,
  'magnifying-glass': MagnifyingGlass,
  search: MagnifyingGlass,
  clock: Clock,
  shuffle: Shuffle,
  stack: Stack,
  layers: Stack,
  'gender-male': GenderMale,
  'gender-female': GenderFemale,
  user: User,
  'user-circle': UserCircle,
  globe: Globe,
  key: Key,
  layout: Layout,
  bookmark: BookmarkSimple,
  'bookmark-simple': BookmarkSimple,
  lock: LockSimple,
  'lock-simple': LockSimple,
  camera: Camera,
  'chevron-down': CaretDown,
  'caret-down': CaretDown,
} as const;

export type AppIconName = keyof typeof APP_ICON_REGISTRY;

export interface AppIconProps extends UniversalIconProps {
  name: AppIconName;
}

export const AppIcon: React.FC<AppIconProps> = ({ name, ...rest }) => {
  const Component = APP_ICON_REGISTRY[name] ?? Sparkle;
  return <Component {...rest} />;
};

/* ============================================================================
 * Semantic Multi-Tone Helpers: WeatherIcon, SceneBadgeIcon, ScenarioIcon, GenderIcon
 * ========================================================================== */

function extractHourFromIso(iso?: string, utcOffsetSeconds?: number): number | null {
  if (!iso) {
    return null;
  }
  const trimmed = iso.trim();
  const endsWithZ = /Z$/i.test(trimmed);
  if (!endsWithZ) {
    const match = trimmed.match(/T(\d{2}):(\d{2})/);
    if (match) {
      return Number(match[1]);
    }
  }
  const parsedMs = Date.parse(trimmed);
  if (!Number.isNaN(parsedMs)) {
    const offsetSec =
      typeof utcOffsetSeconds === 'number' && Number.isFinite(utcOffsetSeconds)
        ? utcOffsetSeconds
        : -new Date().getTimezoneOffset() * 60;
    const shifted = new Date(parsedMs + offsetSec * 1000);
    return shifted.getUTCHours();
  }
  return null;
}

type BespokeWeatherVariant =
  | 'day_clear'
  | 'horizon_sun'
  | 'hot_sun'
  | 'day_partly_cloudy'
  | 'day_mostly_cloudy'
  | 'night_clear'
  | 'night_partly_cloudy'
  | 'night_mostly_cloudy'
  | 'sky_overcast'
  | 'drizzle'
  | 'rain'
  | 'thunder'
  | 'snow'
  | 'fog'
  | 'breezy_chilly'
  | 'rain_ahead_umbrella';

const CLOUD_COMPACT_PATH =
  'M 9.0 19.6 A 2.8 2.8 0 0 1 6.2 16.8 A 2.8 2.8 0 0 1 9.51 14.05 A 3.8 3.8 0 0 1 17.02 13.50 A 3.1 3.1 0 0 1 20.9 16.5 A 3.1 3.1 0 0 1 17.8 19.6 Z';

const CLOUD_DAY_FULL_PATH =
  'M 8.2 19.6 A 3.2 3.2 0 0 1 5.0 16.4 A 3.2 3.2 0 0 1 8.64 13.23 A 4.4 4.4 0 0 1 17.24 12.62 A 3.5 3.5 0 0 1 21.1 16.1 A 3.5 3.5 0 0 1 17.6 19.6 Z';

const CLOUD_OVERCAST_FRONT_PATH =
  'M 7.2 19.6 A 3.2 3.2 0 0 1 4.0 16.4 A 3.2 3.2 0 0 1 7.64 13.23 A 4.4 4.4 0 0 1 16.24 12.62 A 3.5 3.5 0 0 1 20.1 16.1 A 3.5 3.5 0 0 1 16.6 19.6 Z';

const CLOUD_PRECIP_PATH =
  'M 7.6 16.2 A 3.2 3.2 0 0 1 4.4 13.0 A 3.2 3.2 0 0 1 8.04 9.83 A 4.4 4.4 0 0 1 16.64 9.22 A 3.5 3.5 0 0 1 20.5 12.7 A 3.5 3.5 0 0 1 17.0 16.2 Z';

interface BespokeWeatherSvgProps {
  variant: BespokeWeatherVariant;
  uid: string;
  isDark: boolean;
  size: number | string;
  mirrored?: boolean;
  alt?: string;
  style?: React.CSSProperties;
  ariaHidden?: boolean | 'true' | 'false';
}

const BespokeWeatherSvg: React.FC<BespokeWeatherSvgProps> = ({
  variant,
  uid,
  isDark,
  size,
  mirrored = false,
  alt,
  style,
  ariaHidden,
}) => {
  const numericSize = typeof size === 'number' ? size : parseFloat(String(size)) || 18;
  const sunId = `${uid}_sun`;
  const cloudId = `${uid}_cld`;
  const moonId = `${uid}_mn`;
  const boltId = `${uid}_blt`;

  const sunRayStroke = isDark ? '#FBBF24' : '#F59E0B';
  const sunCoreStroke = isDark ? '#FBBF24' : '#F59E0B';
  const dayCloudStroke = isDark ? '#7DD3FC' : '#3898EC';
  const nightCloudStroke = isDark ? '#7DD3FC' : '#3B82F6';
  const rainCloudStroke = isDark ? '#60A5FA' : '#2563EB';
  const stormCloudStroke = isDark ? '#60A5FA' : '#1D4ED8';
  const dropColor = isDark ? '#38BDF8' : '#0EA5E9';
  const heavyDropColor = isDark ? '#38BDF8' : '#0284C7';

  let cloudStop0 = '#FFFFFF';
  let cloudStopMid = isDark ? '#F0F9FF' : '#F2FAFF';
  let cloudStopEnd = isDark ? '#E0F2FE' : '#DFF2FE';
  let cloudMidOffset = '52%';

  if (variant === 'thunder') {
    cloudStop0 = '#E0F2FE';
    cloudStopMid = '#BFDBFE';
    cloudStopEnd = '#60A5FA';
    cloudMidOffset = '48%';
  } else if (variant === 'drizzle' || variant === 'rain') {
    cloudStop0 = '#FFFFFF';
    cloudStopMid = '#E0F2FE';
    cloudStopEnd = '#93C5FD';
    cloudMidOffset = '44%';
  } else if (variant === 'sky_overcast') {
    cloudStop0 = isDark ? '#F0F9FF' : '#FFFFFF';
    cloudStopMid = '#E0F2FE';
    cloudStopEnd = '#BAE6FD';
    cloudMidOffset = '48%';
  } else if (variant === 'night_partly_cloudy' || variant === 'night_mostly_cloudy') {
    cloudStop0 = isDark ? '#F8FAFC' : '#FFFFFF';
    cloudStopMid = isDark ? '#E0F2FE' : '#F0F9FF';
    cloudStopEnd = isDark ? '#93C5FD' : '#BAE6FD';
    cloudMidOffset = '44%';
  } else if (variant === 'fog') {
    cloudStop0 = '#FFFFFF';
    cloudStopMid = '#F0F9FF';
    cloudStopEnd = '#CFE8FC';
    cloudMidOffset = '48%';
  } else if (variant === 'rain_ahead_umbrella') {
    cloudStop0 = isDark ? '#E0F2FE' : '#BAE6FD';
    cloudStopMid = isDark ? '#60A5FA' : '#3898EC';
    cloudStopEnd = isDark ? '#38BDF8' : '#2563EB';
    cloudMidOffset = '52%';
  }

  const webSvgProps =
    Platform.OS === 'web'
      ? ({
          'aria-hidden': alt ? undefined : (ariaHidden ?? true),
          role: alt ? 'img' : undefined,
          'aria-label': alt,
          style: {
            flexShrink: 0,
            display: 'inline-block',
            verticalAlign: 'middle',
            ...(mirrored ? { transform: 'scaleX(-1)' } : null),
            ...style,
          },
        } as Record<string, unknown>)
      : {};

  return (
    <Svg
      width={numericSize}
      height={numericSize}
      viewBox="0 0 24 24"
      fill="none"
      style={
        Platform.OS !== 'web' && mirrored
          ? { transform: [{ scaleX: -1 }] }
          : undefined
      }
      {...webSvgProps}
    >
      <Defs>
        <LinearGradient id={sunId} x1="25%" y1="12%" x2="80%" y2="90%">
          <Stop offset="0%" stopColor="#FEF08A" />
          <Stop offset="42%" stopColor="#FDE047" />
          <Stop offset="100%" stopColor={variant === 'hot_sun' || variant === 'horizon_sun' ? '#F97316' : '#F59E0B'} />
        </LinearGradient>

        <LinearGradient id={cloudId} x1="50%" y1="0%" x2="50%" y2="100%">
          <Stop offset="0%" stopColor={cloudStop0} />
          <Stop offset={cloudMidOffset} stopColor={cloudStopMid} />
          <Stop offset="100%" stopColor={cloudStopEnd} />
        </LinearGradient>

        <LinearGradient id={moonId} x1="20%" y1="10%" x2="85%" y2="92%">
          <Stop offset="0%" stopColor={isDark ? '#FEF9C3' : '#FEF08A'} />
          <Stop offset="48%" stopColor={isDark ? '#FDE68A' : '#FCD34D'} />
          <Stop offset="100%" stopColor={isDark ? '#FBBF24' : '#F59E0B'} />
        </LinearGradient>

        <LinearGradient id={boltId} x1="30%" y1="0%" x2="70%" y2="100%">
          <Stop offset="0%" stopColor="#FEF08A" />
          <Stop offset="45%" stopColor="#FDE047" />
          <Stop offset="100%" stopColor="#F59E0B" />
        </LinearGradient>
      </Defs>

      {(variant === 'day_clear' || variant === 'hot_sun') && (
        <G>
          <RnsvgCircle
            cx={12}
            cy={12}
            r={6.6}
            fill={variant === 'hot_sun' ? '#FB923C' : '#FDE047'}
            opacity={isDark ? 0.16 : 0.22}
          />
          <RnsvgLine x1={12} y1={2.3} x2={12} y2={4.7} stroke={variant === 'hot_sun' ? '#F97316' : sunRayStroke} strokeWidth={1.65} strokeLinecap="round" />
          <RnsvgLine x1={12} y1={19.3} x2={12} y2={21.7} stroke={variant === 'hot_sun' ? '#F97316' : sunRayStroke} strokeWidth={1.65} strokeLinecap="round" />
          <RnsvgLine x1={2.3} y1={12} x2={4.7} y2={12} stroke={variant === 'hot_sun' ? '#F97316' : sunRayStroke} strokeWidth={1.65} strokeLinecap="round" />
          <RnsvgLine x1={19.3} y1={12} x2={21.7} y2={12} stroke={variant === 'hot_sun' ? '#F97316' : sunRayStroke} strokeWidth={1.65} strokeLinecap="round" />
          <RnsvgLine x1={17.16} y1={6.84} x2={18.86} y2={5.14} stroke={sunRayStroke} strokeWidth={1.65} strokeLinecap="round" />
          <RnsvgLine x1={6.84} y1={17.16} x2={5.14} y2={18.86} stroke={sunRayStroke} strokeWidth={1.65} strokeLinecap="round" />
          <RnsvgLine x1={6.84} y1={6.84} x2={5.14} y2={5.14} stroke={sunRayStroke} strokeWidth={1.65} strokeLinecap="round" />
          <RnsvgLine x1={17.16} y1={17.16} x2={18.86} y2={18.86} stroke={sunRayStroke} strokeWidth={1.65} strokeLinecap="round" />
          <RnsvgCircle
            cx={12}
            cy={12}
            r={4.85}
            fill={`url(#${sunId})`}
            stroke={variant === 'hot_sun' ? (isDark ? '#FB923C' : '#EA580C') : sunCoreStroke}
            strokeWidth={1.25}
          />
        </G>
      )}

      {variant === 'horizon_sun' && (
        <G>
          <RnsvgLine x1={12} y1={6.2} x2={12} y2={8.5} stroke={sunRayStroke} strokeWidth={1.6} strokeLinecap="round" />
          <RnsvgLine x1={6.95} y1={7.95} x2={8.35} y2={9.75} stroke={sunRayStroke} strokeWidth={1.55} strokeLinecap="round" />
          <RnsvgLine x1={17.05} y1={7.95} x2={15.65} y2={9.75} stroke={sunRayStroke} strokeWidth={1.55} strokeLinecap="round" />
          <RnsvgLine x1={4.0} y1={11.8} x2={6.05} y2={12.65} stroke={sunRayStroke} strokeWidth={1.5} strokeLinecap="round" />
          <RnsvgLine x1={20.0} y1={11.8} x2={17.95} y2={12.65} stroke={sunRayStroke} strokeWidth={1.5} strokeLinecap="round" />
          <RnsvgPath
            d="M 7.1 15.6 A 4.9 4.9 0 0 1 16.9 15.6 Z"
            fill={`url(#${sunId})`}
            stroke={isDark ? '#FB923C' : '#F59E0B'}
            strokeWidth={1.3}
            strokeLinejoin="round"
          />
          <RnsvgLine
            x1={3.2}
            y1={17.6}
            x2={20.8}
            y2={17.6}
            stroke={dayCloudStroke}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
          <RnsvgLine
            x1={6.8}
            y1={20.2}
            x2={17.2}
            y2={20.2}
            stroke={isDark ? '#38BDF8' : '#60A5FA'}
            strokeWidth={1.4}
            strokeLinecap="round"
            opacity={0.9}
          />
        </G>
      )}

      {variant === 'day_partly_cloudy' && (
        <G>
          <RnsvgLine x1={8.0} y1={2.1} x2={8.0} y2={3.45} stroke={sunRayStroke} strokeWidth={1.55} strokeLinecap="round" />
          <RnsvgLine x1={3.76} y1={3.96} x2={4.68} y2={4.88} stroke={sunRayStroke} strokeWidth={1.55} strokeLinecap="round" />
          <RnsvgLine x1={2.0} y1={8.2} x2={3.35} y2={8.2} stroke={sunRayStroke} strokeWidth={1.55} strokeLinecap="round" />
          <RnsvgLine x1={3.76} y1={12.44} x2={4.68} y2={11.52} stroke={sunRayStroke} strokeWidth={1.55} strokeLinecap="round" />
          <RnsvgLine x1={12.24} y1={3.96} x2={11.32} y2={4.88} stroke={sunRayStroke} strokeWidth={1.55} strokeLinecap="round" />
          <RnsvgLine x1={14.0} y1={8.2} x2={12.65} y2={8.2} stroke={sunRayStroke} strokeWidth={1.55} strokeLinecap="round" />
          <RnsvgCircle
            cx={8.0}
            cy={8.2}
            r={3.55}
            fill={`url(#${sunId})`}
            stroke={sunCoreStroke}
            strokeWidth={1.2}
          />
          <RnsvgPath
            d={CLOUD_COMPACT_PATH}
            fill={`url(#${cloudId})`}
            stroke={dayCloudStroke}
            strokeWidth={1.45}
            strokeLinejoin="round"
          />
          <RnsvgPath
            d="M 10.7 13.5 A 2.5 2.5 0 0 1 15.5 13.1"
            stroke="#FFFFFF"
            strokeWidth={1.05}
            strokeLinecap="round"
            opacity={0.92}
          />
        </G>
      )}

      {variant === 'day_mostly_cloudy' && (
        <G>
          <RnsvgLine x1={7.0} y1={2.2} x2={7.0} y2={3.4} stroke={sunRayStroke} strokeWidth={1.5} strokeLinecap="round" />
          <RnsvgLine x1={3.39} y1={3.79} x2={4.17} y2={4.57} stroke={sunRayStroke} strokeWidth={1.5} strokeLinecap="round" />
          <RnsvgLine x1={1.9} y1={7.4} x2={3.05} y2={7.4} stroke={sunRayStroke} strokeWidth={1.5} strokeLinecap="round" />
          <RnsvgLine x1={3.39} y1={11.01} x2={4.17} y2={10.23} stroke={sunRayStroke} strokeWidth={1.5} strokeLinecap="round" />
          <RnsvgLine x1={10.61} y1={3.79} x2={9.83} y2={4.57} stroke={sunRayStroke} strokeWidth={1.5} strokeLinecap="round" />
          <RnsvgCircle
            cx={7.0}
            cy={7.4}
            r={3.05}
            fill={`url(#${sunId})`}
            stroke={sunCoreStroke}
            strokeWidth={1.15}
          />
          <RnsvgPath
            d={CLOUD_DAY_FULL_PATH}
            fill={`url(#${cloudId})`}
            stroke={dayCloudStroke}
            strokeWidth={1.45}
            strokeLinejoin="round"
          />
          <RnsvgPath
            d="M 10.2 12.1 A 3.0 3.0 0 0 1 15.6 11.7"
            stroke="#FFFFFF"
            strokeWidth={1.1}
            strokeLinecap="round"
            opacity={0.92}
          />
        </G>
      )}

      {variant === 'night_clear' && (
        <G>
          <RnsvgPath
            d="M 12.8 5.2 A 6.5 6.5 0 1 0 18.4 13.8 A 5.4 5.4 0 0 1 12.8 5.2 Z"
            fill={`url(#${moonId})`}
            stroke={isDark ? '#FCD34D' : '#D97706'}
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
          <RnsvgPath
            d="M 17.6 4.2 L 18.15 5.65 L 19.6 6.2 L 18.15 6.75 L 17.6 8.2 L 17.05 6.75 L 15.6 6.2 L 17.05 5.65 Z"
            fill={isDark ? '#FDE68A' : '#6366F1'}
          />
          <RnsvgCircle
            cx={14.8}
            cy={9.2}
            r={0.95}
            fill={isDark ? '#BAE6FD' : '#38BDF8'}
          />
        </G>
      )}

      {(variant === 'night_partly_cloudy' || variant === 'night_mostly_cloudy') && (
        <G>
          <RnsvgPath
            d="M 8.5 3.6 A 4.3 4.3 0 1 0 12.3 9.5 A 3.7 3.7 0 0 1 8.5 3.6 Z"
            fill={`url(#${moonId})`}
            stroke={isDark ? '#FCD34D' : '#F59E0B'}
            strokeWidth={1.15}
            strokeLinejoin="round"
          />
          <RnsvgPath
            d="M 18.2 4.35 L 18.65 5.55 L 19.85 6.0 L 18.65 6.45 L 18.2 7.65 L 17.75 6.45 L 16.55 6.0 L 17.75 5.55 Z"
            fill={isDark ? '#FDE68A' : '#6366F1'}
          />
          <RnsvgPath
            d={variant === 'night_partly_cloudy' ? CLOUD_COMPACT_PATH : CLOUD_DAY_FULL_PATH}
            fill={`url(#${cloudId})`}
            stroke={nightCloudStroke}
            strokeWidth={1.45}
            strokeLinejoin="round"
          />
          <RnsvgPath
            d={
              variant === 'night_partly_cloudy'
                ? 'M 10.7 13.5 A 2.5 2.5 0 0 1 15.5 13.1'
                : 'M 10.2 12.1 A 3.0 3.0 0 0 1 15.6 11.7'
            }
            stroke="#FFFFFF"
            strokeWidth={1.05}
            strokeLinecap="round"
            opacity={0.85}
          />
        </G>
      )}

      {variant === 'sky_overcast' && (
        <G>
          <RnsvgPath
            d="M 11.2 12.2 A 3.4 3.4 0 0 1 17.8 10.6 A 2.8 2.8 0 0 1 21.4 13.6 A 2.6 2.6 0 0 1 19.0 16.2 Z"
            fill={isDark ? '#93C5FD' : '#BAE6FD'}
            stroke={isDark ? '#60A5FA' : '#3B82F6'}
            strokeWidth={1.25}
            strokeLinejoin="round"
            opacity={0.9}
          />
          <RnsvgPath
            d={CLOUD_OVERCAST_FRONT_PATH}
            fill={`url(#${cloudId})`}
            stroke={rainCloudStroke}
            strokeWidth={1.45}
            strokeLinejoin="round"
          />
          <RnsvgPath
            d="M 9.2 12.1 A 3.0 3.0 0 0 1 14.6 11.7"
            stroke="#FFFFFF"
            strokeWidth={1.05}
            strokeLinecap="round"
            opacity={0.88}
          />
        </G>
      )}

      {variant === 'drizzle' && (
        <G>
          <RnsvgPath
            d={CLOUD_PRECIP_PATH}
            fill={`url(#${cloudId})`}
            stroke={rainCloudStroke}
            strokeWidth={1.45}
            strokeLinejoin="round"
          />
          <RnsvgLine x1={10.3} y1={18.2} x2={9.2} y2={20.9} stroke={dropColor} strokeWidth={1.75} strokeLinecap="round" />
          <RnsvgLine x1={14.9} y1={18.2} x2={13.8} y2={20.9} stroke={dropColor} strokeWidth={1.75} strokeLinecap="round" />
        </G>
      )}

      {variant === 'rain' && (
        <G>
          <RnsvgPath
            d={CLOUD_PRECIP_PATH}
            fill={`url(#${cloudId})`}
            stroke={rainCloudStroke}
            strokeWidth={1.45}
            strokeLinejoin="round"
          />
          <RnsvgLine x1={8.5} y1={18.0} x2={7.2} y2={21.3} stroke={heavyDropColor} strokeWidth={1.75} strokeLinecap="round" />
          <RnsvgLine x1={12.6} y1={18.3} x2={11.3} y2={21.8} stroke={dropColor} strokeWidth={1.8} strokeLinecap="round" />
          <RnsvgLine x1={16.7} y1={18.0} x2={15.4} y2={21.3} stroke={heavyDropColor} strokeWidth={1.75} strokeLinecap="round" />
        </G>
      )}

      {variant === 'thunder' && (
        <G>
          <RnsvgPath
            d={CLOUD_PRECIP_PATH}
            fill={`url(#${cloudId})`}
            stroke={stormCloudStroke}
            strokeWidth={1.45}
            strokeLinejoin="round"
          />
          <RnsvgLine x1={7.5} y1={18.2} x2={6.6} y2={20.5} stroke={dropColor} strokeWidth={1.55} strokeLinecap="round" />
          <RnsvgLine x1={17.5} y1={18.2} x2={16.6} y2={20.5} stroke={dropColor} strokeWidth={1.55} strokeLinecap="round" />
          <RnsvgPath
            d="M 13.0 14.1 L 9.9 18.6 L 12.3 18.6 L 11.1 22.4 L 15.1 17.5 L 12.6 17.5 Z"
            fill={`url(#${boltId})`}
            stroke={isDark ? '#FBBF24' : '#D97706'}
            strokeWidth={0.9}
            strokeLinejoin="round"
          />
        </G>
      )}

      {variant === 'snow' && (
        <G>
          <RnsvgPath
            d={CLOUD_PRECIP_PATH}
            fill={`url(#${cloudId})`}
            stroke={isDark ? '#7DD3FC' : '#0284C7'}
            strokeWidth={1.45}
            strokeLinejoin="round"
          />
          <RnsvgCircle cx={8.6} cy={19.3} r={1.25} fill={dropColor} />
          <RnsvgCircle cx={12.4} cy={20.8} r={1.3} fill={isDark ? '#BAE6FD' : '#38BDF8'} />
          <RnsvgCircle cx={16.2} cy={19.3} r={1.25} fill={dropColor} />
        </G>
      )}

      {variant === 'fog' && (
        <G>
          <RnsvgPath
            d={CLOUD_PRECIP_PATH}
            fill={`url(#${cloudId})`}
            stroke={isDark ? '#7DD3FC' : '#4B9CE2'}
            strokeWidth={1.45}
            strokeLinejoin="round"
          />
          <RnsvgLine
            x1={5.6}
            y1={18.7}
            x2={18.4}
            y2={18.7}
            stroke={isDark ? '#7DD3FC' : '#3898EC'}
            strokeWidth={1.55}
            strokeLinecap="round"
          />
          <RnsvgLine
            x1={8.0}
            y1={21.1}
            x2={16.6}
            y2={21.1}
            stroke={isDark ? '#38BDF8' : '#60A5FA'}
            strokeWidth={1.45}
            strokeLinecap="round"
            opacity={0.9}
          />
        </G>
      )}

      {variant === 'breezy_chilly' && (
        <G>
          <RnsvgPath
            d={CLOUD_PRECIP_PATH}
            fill={`url(#${cloudId})`}
            stroke={dayCloudStroke}
            strokeWidth={1.45}
            strokeLinejoin="round"
          />
          <RnsvgPath
            d="M 5.8 18.8 H 15.6 A 1.25 1.25 0 1 0 14.35 17.55"
            stroke={isDark ? '#2DD4BF' : '#0D9488'}
            strokeWidth={1.45}
            strokeLinecap="round"
            fill="none"
          />
          <RnsvgPath
            d="M 8.2 21.1 H 17.4 A 1.15 1.15 0 1 1 16.25 22.25"
            stroke={isDark ? '#5EEAD4' : '#14B8A6'}
            strokeWidth={1.4}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      )}

      {variant === 'rain_ahead_umbrella' && (
        <G>
          <RnsvgLine x1={12} y1={3.3} x2={12} y2={4.9} stroke={sunRayStroke} strokeWidth={1.55} strokeLinecap="round" />
          <RnsvgPath
            d="M 3.8 13.2 A 8.2 8.2 0 0 1 20.2 13.2 Q 17.5 11.9 14.8 13.2 Q 12.0 11.9 9.2 13.2 Q 6.5 11.9 3.8 13.2 Z"
            fill={`url(#${cloudId})`}
            stroke={isDark ? '#7DD3FC' : '#1D4ED8'}
            strokeWidth={1.35}
            strokeLinejoin="round"
          />
          <RnsvgPath
            d="M 12 13.2 V 18.6 A 1.9 1.9 0 0 1 8.2 18.6"
            stroke={isDark ? '#FBBF24' : '#D97706'}
            strokeWidth={1.6}
            strokeLinecap="round"
            fill="none"
          />
          <RnsvgLine x1={17.8} y1={4.4} x2={16.9} y2={6.7} stroke={dropColor} strokeWidth={1.55} strokeLinecap="round" />
        </G>
      )}
    </Svg>
  );
};

export interface WeatherIconProps extends UniversalIconProps {
  code?: string | null;
  isDay?: boolean;
  timeIso?: string;
  utcOffsetSeconds?: number;
  precipProbPct?: number;
  isDark?: boolean;
}

/**
 * Renders a joyful, multi-tone luminous SVG weather condition icon mapped from provider
 * condition codes, local timezone hour, and precipitation probability when `color` is omitted
 * (falling back to monochrome Phosphor when an explicit monochrome `color` tint is passed).
 */
export const WeatherIcon: React.FC<WeatherIconProps> = ({
  code,
  isDay,
  timeIso,
  utcOffsetSeconds,
  precipProbPct,
  isDark = false,
  size = 18,
  color,
  weight = 'duotone',
  mirrored,
  alt,
  style,
  'aria-hidden': ariaHidden,
  ...rest
}) => {
  const rawId = React.useId();
  const uid = `wi_${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const upper = (code ?? '').toUpperCase();
  const parsedHour = extractHourFromIso(timeIso, utcOffsetSeconds);
  const effectiveIsDay =
    typeof isDay === 'boolean'
      ? isDay
      : parsedHour !== null
        ? parsedHour >= 6 && parsedHour < 18
        : true;
  const rainProb =
    typeof precipProbPct === 'number' && Number.isFinite(precipProbPct)
      ? precipProbPct
      : 0;

  if (color) {
    if (upper.includes('THUNDER') || upper.includes('STORM')) {
      return <CloudLightning size={size} weight={weight} color={color} mirrored={mirrored} alt={alt} style={style} aria-hidden={ariaHidden} {...rest} />;
    }
    if (upper.includes('HEAVY_RAIN') || (upper.includes('RAIN') && !upper.includes('LIGHT'))) {
      return <CloudRain size={size} weight={weight} color={color} mirrored={mirrored} alt={alt} style={style} aria-hidden={ariaHidden} {...rest} />;
    }
    if (upper.includes('DRIZZLE') || upper.includes('LIGHT_RAIN') || upper.includes('SHOWER')) {
      return <CloudRain size={size} weight={weight} color={color} mirrored={mirrored} alt={alt} style={style} aria-hidden={ariaHidden} {...rest} />;
    }
    if (upper.includes('SNOW') || upper.includes('ICE') || upper.includes('SLEET')) {
      return <CloudSnow size={size} weight={weight} color={color} mirrored={mirrored} alt={alt} style={style} aria-hidden={ariaHidden} {...rest} />;
    }
    if (upper.includes('FOG') || upper.includes('MIST') || upper.includes('HAZE')) {
      return <CloudFog size={size} weight={weight} color={color} mirrored={mirrored} alt={alt} style={style} aria-hidden={ariaHidden} {...rest} />;
    }
    if (upper.includes('PARTLY') || upper.includes('MOSTLY_CLEAR') || (upper.includes('CLOUD') && rainProb < 35)) {
      const Comp = effectiveIsDay ? CloudSun : CloudMoon;
      return <Comp size={size} weight={weight} color={color} mirrored={mirrored} alt={alt} style={style} aria-hidden={ariaHidden} {...rest} />;
    }
    if (upper.includes('CLOUD') || upper.includes('OVERCAST')) {
      return <Cloud size={size} weight={weight} color={color} mirrored={mirrored} alt={alt} style={style} aria-hidden={ariaHidden} {...rest} />;
    }
    if (!effectiveIsDay) {
      return <MoonStars size={size} weight={weight} color={color} mirrored={mirrored} alt={alt} style={style} aria-hidden={ariaHidden} {...rest} />;
    }
    if (parsedHour !== null && (parsedHour === 6 || parsedHour === 17)) {
      return <SunHorizon size={size} weight={weight} color={color} mirrored={mirrored} alt={alt} style={style} aria-hidden={ariaHidden} {...rest} />;
    }
    return <SunDim size={size} weight={weight} color={color} mirrored={mirrored} alt={alt} style={style} aria-hidden={ariaHidden} {...rest} />;
  }

  let variant: BespokeWeatherVariant;
  if (upper.includes('THUNDER') || upper.includes('STORM')) {
    variant = 'thunder';
  } else if (upper.includes('HEAVY_RAIN') || (upper.includes('RAIN') && !upper.includes('LIGHT'))) {
    variant = 'rain';
  } else if (upper.includes('DRIZZLE') || upper.includes('LIGHT_RAIN') || upper.includes('SHOWER')) {
    variant = 'drizzle';
  } else if (upper.includes('SNOW') || upper.includes('ICE') || upper.includes('SLEET')) {
    variant = 'snow';
  } else if (upper.includes('FOG') || upper.includes('MIST') || upper.includes('HAZE')) {
    variant = 'fog';
  } else if (upper.includes('MOSTLY_CLEAR')) {
    variant = effectiveIsDay ? 'day_partly_cloudy' : 'night_clear';
  } else if (upper.includes('PARTLY')) {
    variant =
      rainProb >= 35
        ? 'sky_overcast'
        : effectiveIsDay
          ? 'day_partly_cloudy'
          : 'night_partly_cloudy';
  } else if (upper.includes('MOSTLY_CLOUDY')) {
    variant =
      rainProb >= 35
        ? 'sky_overcast'
        : effectiveIsDay
          ? 'day_mostly_cloudy'
          : 'night_mostly_cloudy';
  } else if (upper.includes('OVERCAST')) {
    variant =
      rainProb >= 35
        ? 'sky_overcast'
        : effectiveIsDay
          ? 'day_mostly_cloudy'
          : 'night_mostly_cloudy';
  } else if (upper.includes('CLOUD')) {
    variant =
      rainProb >= 35
        ? 'sky_overcast'
        : effectiveIsDay
          ? 'day_mostly_cloudy'
          : 'night_mostly_cloudy';
  } else if (!effectiveIsDay) {
    variant = 'night_clear';
  } else if (parsedHour !== null && (parsedHour === 6 || parsedHour === 17)) {
    variant = 'horizon_sun';
  } else {
    variant = 'day_clear';
  }

  return (
    <BespokeWeatherSvg
      variant={variant}
      uid={uid}
      isDark={isDark}
      size={size}
      mirrored={mirrored}
      alt={alt}
      style={style}
      ariaHidden={ariaHidden}
    />
  );
};

export interface SceneBadgeIconProps extends UniversalIconProps {
  sceneId: CharacterSceneId;
  isDay?: boolean;
  skyTheme?: SkyTheme;
  hasRainAhead?: boolean;
  hasAqiMask?: boolean;
  isDark?: boolean;
}

/**
 * Maps a `CharacterSceneId` (and optional rain-ahead / AQI flags) to a cohesive
 * multi-tone SVG icon for hero pills and outfit chips, or a monochrome Phosphor icon
 * when an explicit `color` tint is passed (e.g. frosted Lock Screen widgets).
 */
export const SceneBadgeIcon: React.FC<SceneBadgeIconProps> = ({
  sceneId,
  isDay = true,
  skyTheme,
  hasRainAhead = false,
  hasAqiMask = false,
  isDark = false,
  size = 15,
  color,
  weight = 'duotone',
  mirrored,
  alt,
  style,
  'aria-hidden': ariaHidden,
  ...rest
}) => {
  const rawId = React.useId();
  const uid = `sb_${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  if (color) {
    if (hasRainAhead && sceneId !== 'storm_raincoat' && sceneId !== 'light_rain_umbrella') {
      return <Umbrella size={size} weight={weight} color={color} mirrored={mirrored} alt={alt} style={style} aria-hidden={ariaHidden} {...rest} />;
    }

    switch (sceneId) {
      case 'storm_raincoat':
        return <CloudLightning size={size} weight={weight} color={color} mirrored={mirrored} alt={alt} style={style} aria-hidden={ariaHidden} {...rest} />;
      case 'light_rain_umbrella':
        return <Umbrella size={size} weight={weight} color={color} mirrored={mirrored} alt={alt} style={style} aria-hidden={ariaHidden} {...rest} />;
      case 'clear_night':
        return <MoonStars size={size} weight={weight} color={color} mirrored={mirrored} alt={alt} style={style} aria-hidden={ariaHidden} {...rest} />;
      case 'hot_sunny':
        return <ThermometerHot size={size} weight={weight} color={color} mirrored={mirrored} alt={alt} style={style} aria-hidden={ariaHidden} {...rest} />;
      case 'chilly_cozy':
        return <Wind size={size} weight={weight} color={color} mirrored={mirrored} alt={alt} style={style} aria-hidden={ariaHidden} {...rest} />;
      case 'freezing_puffer':
        return <Snowflake size={size} weight={weight} color={color} mirrored={mirrored} alt={alt} style={style} aria-hidden={ariaHidden} {...rest} />;
      case 'pleasant_sunny':
      default: {
        if (hasAqiMask) {
          return <ShieldWarning size={size} weight={weight} color={color} mirrored={mirrored} alt={alt} style={style} aria-hidden={ariaHidden} {...rest} />;
        }
        if (!isDay || skyTheme === 'night') {
          return <MoonStars size={size} weight={weight} color={color} mirrored={mirrored} alt={alt} style={style} aria-hidden={ariaHidden} {...rest} />;
        }
        if (skyTheme === 'dawn' || skyTheme === 'sunset') {
          return <SunHorizon size={size} weight={weight} color={color} mirrored={mirrored} alt={alt} style={style} aria-hidden={ariaHidden} {...rest} />;
        }
        if (skyTheme === 'day_cloudy') {
          return <CloudSun size={size} weight={weight} color={color} mirrored={mirrored} alt={alt} style={style} aria-hidden={ariaHidden} {...rest} />;
        }
        return <SunDim size={size} weight={weight} color={color} mirrored={mirrored} alt={alt} style={style} aria-hidden={ariaHidden} {...rest} />;
      }
    }
  }

  if (hasAqiMask && sceneId === 'pleasant_sunny') {
    return (
      <ShieldWarning
        size={size}
        weight={weight}
        color={isDark ? '#F87171' : '#DC2626'}
        mirrored={mirrored}
        alt={alt}
        style={style}
        aria-hidden={ariaHidden}
        {...rest}
      />
    );
  }

  let variant: BespokeWeatherVariant;
  if (hasRainAhead && sceneId !== 'storm_raincoat' && sceneId !== 'light_rain_umbrella') {
    variant = 'rain_ahead_umbrella';
  } else {
    switch (sceneId) {
      case 'storm_raincoat':
        variant = 'thunder';
        break;
      case 'light_rain_umbrella':
        variant = 'drizzle';
        break;
      case 'clear_night':
        variant = 'night_clear';
        break;
      case 'hot_sunny':
        variant = 'hot_sun';
        break;
      case 'chilly_cozy':
        variant = isDay ? 'breezy_chilly' : 'night_partly_cloudy';
        break;
      case 'freezing_puffer':
        variant = 'snow';
        break;
      case 'pleasant_sunny':
      default:
        if (!isDay || skyTheme === 'night') {
          variant = 'night_clear';
        } else if (skyTheme === 'dawn' || skyTheme === 'sunset') {
          variant = 'horizon_sun';
        } else if (skyTheme === 'day_cloudy') {
          variant = 'day_partly_cloudy';
        } else {
          variant = 'day_clear';
        }
        break;
    }
  }

  return (
    <BespokeWeatherSvg
      variant={variant}
      uid={uid}
      isDark={isDark}
      size={size}
      mirrored={mirrored}
      alt={alt}
      style={style}
      ariaHidden={ariaHidden}
    />
  );
};

export interface ScenarioIconProps extends UniversalIconProps {
  scenarioId: string;
  isDark?: boolean;
}

/**
 * Renders the dedicated Phosphor Duotone icon for each scenario chip in `ScenarioStrip`.
 */
export const ScenarioIcon: React.FC<ScenarioIconProps> = ({
  scenarioId,
  isDark = false,
  size = 15,
  color,
  weight = 'duotone',
  ...rest
}) => {
  switch (scenarioId) {
    case 'sunny':
      return (
        <CloudSun
          size={size}
          weight={weight}
          color={color ?? (isDark ? '#FBBF24' : '#D97706')}
          {...rest}
        />
      );
    case 'hot_uv':
      return (
        <Sunglasses
          size={size}
          weight={weight}
          color={color ?? (isDark ? '#FB923C' : '#EA580C')}
          {...rest}
        />
      );
    case 'light_rain':
      return (
        <Umbrella
          size={size}
          weight={weight}
          color={color ?? (isDark ? '#38BDF8' : '#0284C7')}
          {...rest}
        />
      );
    case 'heavy_storm':
      return (
        <CloudLightning
          size={size}
          weight={weight}
          color={color ?? (isDark ? '#63ADFF' : '#1D4ED8')}
          {...rest}
        />
      );
    case 'sunny_rain_ahead':
      return (
        <CloudRain
          size={size}
          weight={weight}
          color={color ?? (isDark ? '#60A5FA' : '#2563EB')}
          {...rest}
        />
      );
    case 'chilly_dalat':
      return (
        <Leaf
          size={size}
          weight={weight}
          color={color ?? (isDark ? '#34D399' : '#0D9488')}
          {...rest}
        />
      );
    case 'freezing_sapa':
      return (
        <ThermometerCold
          size={size}
          weight={weight}
          color={color ?? (isDark ? '#7DD3FC' : '#0284C7')}
          {...rest}
        />
      );
    case 'high_aqi_hanoi':
      return (
        <ShieldWarning
          size={size}
          weight={weight}
          color={color ?? (isDark ? '#F87171' : '#DC2626')}
          {...rest}
        />
      );
    case 'live':
    default:
      return (
        <Broadcast
          size={size}
          weight={weight}
          color={color ?? (isDark ? '#34D399' : '#119C72')}
          {...rest}
        />
      );
  }
};

export interface GenderIconProps extends UniversalIconProps {
  gender: Gender;
}

export const GenderIcon: React.FC<GenderIconProps> = ({
  gender,
  size = 14,
  color = 'currentColor',
  weight = 'duotone',
  ...rest
}) =>
  gender === 'male' ? (
    <GenderMale size={size} color={color} weight={weight} {...rest} />
  ) : (
    <GenderFemale size={size} color={color} weight={weight} {...rest} />
  );

/**
 * Strips leading raw emoji symbols (such as `⛈️ `, `☔ `, `🌤️ `, `📍 `) from copy strings
 * so Phosphor Duotone SVG icons can sit cleanly beside Vietnamese labels without duplication.
 */
export function stripLeadingEmoji(text: string | null | undefined): string {
  if (!text) {
    return '';
  }
  return text
    .replace(/^[\p{Extended_Pictographic}\u2600-\u27BF\uFE0F\u200D]+\s*/gu, '')
    .trim();
}

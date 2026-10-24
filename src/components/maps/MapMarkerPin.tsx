import {
  type CSSProperties,
  type KeyboardEventHandler,
  type MouseEventHandler,
} from 'react';
import { type LucideIcon } from 'lucide-react';

export type MapMarkerPinTone = {
  backgroundColor: string;
  borderColor: string;
  iconColor: string;
  iconFill: string;
  opacity?: number;
  labelBorderColor?: string;
  labelBackgroundColor?: string;
  labelTextColor?: string;
  shadowColor?: string;
  haloColor?: string;
};

type MapMarkerPinProps = {
  icon: LucideIcon;
  tone: MapMarkerPinTone;
  size: number;
  iconSize: number;
  shape?: 'pin' | 'vehicle';
  iconStrokeWidth?: number;
  label?: string | null;
  title?: string;
  className?: string;
  interactive?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLDivElement>;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
};

const PIN_VIEW_BOX_WIDTH = 40;
const PIN_VIEW_BOX_HEIGHT = 54;
const PIN_PATH = 'M20 1.75C11.301 1.75 4.25 8.801 4.25 17.5c0 11.947 11.159 26.428 14.911 31.007a1.09 1.09 0 0 0 1.678 0C24.591 43.928 35.75 29.447 35.75 17.5 35.75 8.801 28.699 1.75 20 1.75Z';

// Deliveries use pins; vehicles use circles so shape also communicates their role.
export function MapMarkerPin({
  icon: Icon,
  tone,
  size,
  iconSize,
  iconStrokeWidth = 1.5,
  shape = 'pin',
  label = null,
  title,
  className,
  interactive = false,
  selected = false,
  dimmed = false,
  style,
  onClick,
  onKeyDown,
}: MapMarkerPinProps) {
  const vehicle = shape === 'vehicle';
  const markerHeight = vehicle ? size : Math.round(size * 1.35);
  const iconBoxSize = Math.max(16, Math.round(size * 0.5));
  const wrapperStyle: CSSProperties = {
    position: 'relative',
    width: `${size}px`,
    height: `${markerHeight}px`,
    overflow: 'visible',
    opacity: selected ? 1 : Math.max(0.14, (tone.opacity ?? 1) * (dimmed ? (vehicle ? 0.72 : 0.42) : 1)),
    transform: selected ? 'translateY(-1px) scale(1.08)' : 'scale(1)',
    transition: 'transform 140ms ease, opacity 140ms ease, filter 140ms ease',
    filter: selected
      ? `drop-shadow(0 0 10px ${tone.shadowColor || 'rgba(15, 23, 42, 0.25)'}) drop-shadow(0 12px 20px rgba(15, 23, 42, 0.22))`
      : tone.shadowColor === 'transparent' ? 'none' : `drop-shadow(0 3px 5px ${tone.shadowColor || 'rgba(15, 23, 42, 0.18)'})`,
    ...style,
  };

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? title : undefined}
      title={title}
      className={className}
      onClick={onClick}
      onKeyDown={onKeyDown}
      style={wrapperStyle}
    >
      <svg
        viewBox={`0 0 ${PIN_VIEW_BOX_WIDTH} ${vehicle ? 40 : PIN_VIEW_BOX_HEIGHT}`}
        width={size}
        height={markerHeight}
        aria-hidden="true"
        style={{ display: 'block', overflow: 'visible' }}
      >
        {vehicle ? <>
          <circle cx="20" cy="20" r="17" fill={tone.backgroundColor} stroke={tone.haloColor || '#ffffff'} strokeWidth="7" />
          <circle cx="20" cy="20" r="17" fill={tone.backgroundColor} stroke={tone.borderColor} strokeWidth="3" />
        </> : <>
          {tone.haloColor ? <path d={PIN_PATH} fill="none" stroke={tone.haloColor} strokeWidth="6" strokeLinejoin="round" /> : null}
          <path d={PIN_PATH} fill={tone.backgroundColor} stroke={tone.borderColor} strokeWidth="2.25" strokeLinejoin="round" />
        </>}
      </svg>

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '50%',
          top: vehicle ? '50%' : `${Math.round(markerHeight * 0.15)}px`,
          width: `${iconBoxSize}px`,
          height: `${iconBoxSize}px`,
          transform: vehicle ? 'translate(-50%, -50%)' : 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <Icon
          size={iconSize}
          strokeWidth={iconStrokeWidth}
          color={tone.iconColor}
          fill={tone.iconFill}
        />
      </div>

      {label ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: `calc(100% + 4px)`,
            transform: 'translateX(-50%)',
            borderRadius: '999px',
            border: `1px solid ${tone.labelBorderColor || tone.borderColor}`,
            backgroundColor: tone.labelBackgroundColor || '#ffffff',
            color: tone.labelTextColor || '#334155',
            padding: vehicle ? '4px 10px' : '2px 8px',
            fontSize: vehicle ? '12px' : '10px',
            fontWeight: 700,
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.12)',
            pointerEvents: 'none',
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
}

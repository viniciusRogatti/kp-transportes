import {
  Building2,
  Check,
  MapPin,
  Navigation,
  Package,
  Truck,
  RotateCcw,
  FileClock,
  type LucideIcon,
} from 'lucide-react';
import type { MapMarkerPinTone } from '../../components/maps/MapMarkerPin';
import type {
  GoogleDeliveryMapItem,
  GoogleDriverLocation,
} from './googleMapAdapter';
import { type DeliveryStage } from './mapStyles';

const DEFAULT_BORDER = '#0f172a';
const DEFAULT_ICON_COLOR = '#111827';
const DEFAULT_ICON_FILL = '#ffffff';
const DRIVER_OPACITY = 1;
const DELIVERY_OPACITY = 0.9;

const RETURN_STATUSES = new Set(['returned', 'redelivery', 'cancelled']);
const RETAINED_STATUSES = new Set(['retained']);

const MARKER_COLOR = {
  yellow: '#facc15',
  blue: '#3b82f6',
  green: '#22c55e',
  orange: '#f97316',
  red: '#ef4444',
  gray: '#94a3b8',
  company: '#ffffff',
} as const;

export const DELIVERY_STAGE_ICONS: Record<DeliveryStage, LucideIcon> = {
  unassigned: Package,
  assigned: Package,
  on_the_way: Navigation,
  on_site: MapPin,
  pending_receipt: Check,
  completed: Check,
};

export const DRIVER_MARKER_ICON = Truck;
export const COMPANY_MARKER_ICON = Building2;

type DeliveryMarkerVisualInput = Pick<
  GoogleDeliveryMapItem,
  'status' | 'driverId' | 'driverColor' | 'stopStatus' | 'danfeStatus'
>;

const normalizeStatus = (value: string | null | undefined) => String(value || '').trim().toLowerCase();

const isReturnFlow = (delivery: DeliveryMarkerVisualInput) => {
  const stopStatus = normalizeStatus(delivery.stopStatus);
  const danfeStatus = normalizeStatus(delivery.danfeStatus);
  return RETURN_STATUSES.has(stopStatus) || RETURN_STATUSES.has(danfeStatus);
};

const isRetainedFlow = (delivery: DeliveryMarkerVisualInput) => {
  const stopStatus = normalizeStatus(delivery.stopStatus);
  const danfeStatus = normalizeStatus(delivery.danfeStatus);
  return RETAINED_STATUSES.has(stopStatus) || RETAINED_STATUSES.has(danfeStatus);
};

// Priority matters because the same delivery can be assigned and also be in a stronger operational state.
export const getDeliveryMarkerStyleByStatus = (
  delivery: DeliveryMarkerVisualInput,
): MapMarkerPinTone => {
  if (isReturnFlow(delivery)) {
    return {
      backgroundColor: '#fecaca',
      borderColor: DEFAULT_BORDER,
      iconColor: DEFAULT_ICON_COLOR,
      iconFill: DEFAULT_ICON_FILL,
      opacity: 0.34,
      shadowColor: 'transparent',
    };
  }

  if (isRetainedFlow(delivery)) {
    return {
      backgroundColor: '#fed7aa',
      borderColor: DEFAULT_BORDER,
      iconColor: DEFAULT_ICON_COLOR,
      iconFill: DEFAULT_ICON_FILL,
      opacity: 0.4,
      shadowColor: 'transparent',
    };
  }

  if (delivery.status === 'on_the_way') {
    return {
      backgroundColor: MARKER_COLOR.yellow,
      borderColor: delivery.driverColor || DEFAULT_BORDER,
      iconColor: DEFAULT_ICON_COLOR,
      iconFill: DEFAULT_ICON_FILL,
      opacity: 1, haloColor: '#ffffff',
      shadowColor: 'rgba(250, 204, 21, 0.42)',
    };
  }

  if (delivery.status === 'on_site') {
    return {
      backgroundColor: MARKER_COLOR.blue,
      borderColor: DEFAULT_BORDER,
      iconColor: DEFAULT_ICON_COLOR,
      iconFill: DEFAULT_ICON_FILL,
      opacity: 1, haloColor: '#ffffff',
      shadowColor: 'rgba(59, 130, 246, 0.35)',
    };
  }

  if (delivery.status === 'completed') {
    return {
      backgroundColor: '#bbf7d0',
      borderColor: DEFAULT_BORDER,
      iconColor: DEFAULT_ICON_COLOR,
      iconFill: DEFAULT_ICON_FILL,
      opacity: 0.32,
      shadowColor: 'transparent',
    };
  }

  if (delivery.status === 'pending_receipt') {
    return {
      backgroundColor: '#bbf7d0', borderColor: '#16a34a', iconColor: '#166534', iconFill: 'transparent',
      opacity: 0.4, shadowColor: 'transparent',
    };
  }

  if (delivery.status === 'assigned' && delivery.driverId) {
    return {
      backgroundColor: delivery.driverColor || MARKER_COLOR.gray,
      borderColor: DEFAULT_BORDER,
      iconColor: DEFAULT_ICON_COLOR,
      iconFill: DEFAULT_ICON_FILL,
      opacity: DELIVERY_OPACITY,
      shadowColor: 'rgba(15, 23, 42, 0.22)',
    };
  }

  return {
    backgroundColor: MARKER_COLOR.gray,
    borderColor: '#475569',
    iconColor: DEFAULT_ICON_COLOR,
    iconFill: DEFAULT_ICON_FILL,
    opacity: DELIVERY_OPACITY,
    shadowColor: 'rgba(15, 23, 42, 0.18)',
  };
};

export const getDeliveryMarkerIcon = (delivery: DeliveryMarkerVisualInput): LucideIcon => {
  if (isReturnFlow(delivery)) return RotateCcw;
  if (isRetainedFlow(delivery)) return FileClock;
  return DELIVERY_STAGE_ICONS[delivery.status];
};

// Operational priority controls size and stacking as well as color.
export const getDeliveryMarkerPriority = (delivery: DeliveryMarkerVisualInput) => {
  if (isReturnFlow(delivery) || isRetainedFlow(delivery) || delivery.status === 'completed' || delivery.status === 'pending_receipt') return { scale: 0.8, zIndex: 200 };
  if (delivery.status === 'on_the_way' || delivery.status === 'on_site') return { scale: 1.25, zIndex: 700 };
  return { scale: 1, zIndex: 450 };
};

export const getDriverMarkerStyle = (driver: Pick<GoogleDriverLocation, 'color' | 'attentionLevel'>): MapMarkerPinTone => {
  const attentionBorder = driver.attentionLevel === 'CRITICAL'
    ? '#e11d48'
    : driver.attentionLevel === 'WARNING'
      ? '#d97706'
      : DEFAULT_BORDER;

  return {
    backgroundColor: '#0f172a',
    borderColor: driver.color || '#64748b',
    haloColor: driver.attentionLevel === 'CRITICAL' || driver.attentionLevel === 'WARNING' ? attentionBorder : '#ffffff',
    iconColor: '#ffffff',
    iconFill: 'none',
    opacity: DRIVER_OPACITY,
    labelBorderColor: driver.color || '#64748b',
    labelBackgroundColor: '#0f172a',
    labelTextColor: '#ffffff',
    shadowColor: attentionBorder,
  };
};

export const getCompanyMarkerStyle = (): MapMarkerPinTone => ({
  backgroundColor: MARKER_COLOR.company,
  borderColor: '#475569',
  iconColor: DEFAULT_ICON_COLOR,
  iconFill: '#e2e8f0',
  opacity: 1,
  labelBorderColor: '#94a3b8',
  labelBackgroundColor: '#ffffff',
  labelTextColor: '#334155',
  shadowColor: 'rgba(71, 85, 105, 0.2)',
});

export const getLegendMarkerVisual = (stage: DeliveryStage): MapMarkerPinTone => {
  return getDeliveryMarkerStyleByStatus({
    status: stage,
    driverId: stage === 'assigned' || stage === 'on_the_way' ? 1 : null,
    driverColor: stage === 'assigned' ? '#0f766e' : '#0f766e',
    stopStatus: stage === 'completed' ? 'delivered' : stage === 'pending_receipt' ? 'delivered_pending_receipt' : null,
    danfeStatus: stage === 'completed' ? 'delivered' : null,
  });
};

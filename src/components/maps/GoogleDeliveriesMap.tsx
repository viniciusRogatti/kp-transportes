import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GoogleMap,
  InfoWindowF,
  OverlayView,
  OverlayViewF,
  PolylineF,
  useJsApiLoader,
} from '@react-google-maps/api';
import {
  Check,
  MapPin,
  Navigation,
  Package,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import {
  DeliveryStage,
  STAGE_LABELS,
  STAGE_STYLE,
} from '../../pages/deliveryMonitoring/mapStyles';
import {
  GoogleDeliveryMapItem,
  GoogleDeliveryRoute,
} from '../../pages/deliveryMonitoring/googleMapAdapter';

export type GoogleMapBoundsPayload = {
  zoom: number;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  } | null;
};

type GoogleDeliveriesMapProps = {
  apiKey: string;
  center: { lat: number; lng: number };
  initialZoom?: number;
  datasetKey?: string;
  deliveries: GoogleDeliveryMapItem[];
  routes?: GoogleDeliveryRoute[];
  selectedDriverId: number | null;
  selectedDeliveryId: string | null;
  onMarkerClick: (deliveryId: string) => void;
  onMapBoundsChange?: (payload: GoogleMapBoundsPayload) => void;
};

const mapContainerStyle = { width: '100%', height: '100%' };
const MAP_MIN_ZOOM = 4;
const MAP_MAX_ZOOM = 20;

const STAGE_ICONS: Record<DeliveryStage, LucideIcon> = {
  unassigned: Package,
  assigned: Truck,
  on_the_way: Navigation,
  on_site: MapPin,
  completed: Check,
};

const resolveMarkerSize = (zoom: number) => {
  if (zoom <= 7) return 20;
  if (zoom <= 10) return 22;
  if (zoom <= 12) return 24;
  if (zoom <= 14) return 28;
  return 32;
};

const resolveMarkerBorderColor = (delivery: GoogleDeliveryMapItem) => {
  if (delivery.driverId) {
    return delivery.driverColor || STAGE_STYLE[delivery.status].border;
  }
  return STAGE_STYLE[delivery.status].border;
};

const resolveMarkerOpacity = (delivery: GoogleDeliveryMapItem, isDimmed: boolean) => {
  const statusOpacity = delivery.status === 'completed'
    ? Math.min(STAGE_STYLE[delivery.status].opacity, 0.65)
    : 1;
  if (!isDimmed) return statusOpacity;
  return Math.max(0.16, statusOpacity * 0.35);
};

function GoogleDeliveriesMap({
  apiKey,
  center,
  initialZoom = 10,
  datasetKey = 'default',
  deliveries,
  routes = [],
  selectedDriverId,
  selectedDeliveryId,
  onMarkerClick,
  onMapBoundsChange,
}: GoogleDeliveriesMapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [hoveredDeliveryId, setHoveredDeliveryId] = useState<string | null>(null);
  const hasFittedBoundsRef = useRef(false);
  const activeDatasetKeyRef = useRef<string>(datasetKey);
  const fitControlContainerRef = useRef<HTMLDivElement | null>(null);
  const fitControlButtonRef = useRef<HTMLButtonElement | null>(null);
  const fitControlListenerRef = useRef<(() => void) | null>(null);
  const fitBoundsActionRef = useRef<() => void>(() => undefined);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-deliveries-map-script',
    googleMapsApiKey: apiKey,
  });

  const hoveredDelivery = useMemo(() => {
    if (!hoveredDeliveryId) return null;
    return deliveries.find((delivery) => delivery.id === hoveredDeliveryId) || null;
  }, [deliveries, hoveredDeliveryId]);

  const mapOptions = useMemo<google.maps.MapOptions>(() => ({
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    zoomControl: true,
    gestureHandling: 'greedy',
    clickableIcons: true,
    minZoom: MAP_MIN_ZOOM,
    maxZoom: MAP_MAX_ZOOM,
  }), []);

  const emitBoundsChange = useCallback(() => {
    if (!map || !onMapBoundsChange) return;
    const zoom = map.getZoom() || initialZoom;
    const bounds = map.getBounds();
    if (!bounds) {
      onMapBoundsChange({ zoom, bounds: null });
      return;
    }

    onMapBoundsChange({
      zoom,
      bounds: {
        north: bounds.getNorthEast().lat(),
        east: bounds.getNorthEast().lng(),
        south: bounds.getSouthWest().lat(),
        west: bounds.getSouthWest().lng(),
      },
    });
  }, [initialZoom, map, onMapBoundsChange]);

  useEffect(() => {
    if (activeDatasetKeyRef.current === datasetKey) return;
    activeDatasetKeyRef.current = datasetKey;
    hasFittedBoundsRef.current = false;
  }, [datasetKey]);

  const fitBoundsToDeliveries = useCallback(() => {
    if (!map) return;
    if (!deliveries.length) {
      map.setCenter(center);
      map.setZoom(initialZoom);
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    deliveries.forEach((delivery) => {
      bounds.extend({ lat: delivery.lat, lng: delivery.lng });
    });
    map.fitBounds(bounds, 52);

    const currentZoom = map.getZoom();
    if (currentZoom && currentZoom > 15) {
      map.setZoom(15);
    }
  }, [center, deliveries, initialZoom, map]);

  useEffect(() => {
    if (!map) return;
    if (hasFittedBoundsRef.current) return;
    if (!deliveries.length) return;
    fitBoundsToDeliveries();
    hasFittedBoundsRef.current = true;
  }, [deliveries, fitBoundsToDeliveries, map]);

  const handleManualFitBounds = useCallback(() => {
    fitBoundsToDeliveries();
    hasFittedBoundsRef.current = true;
  }, [fitBoundsToDeliveries]);

  useEffect(() => {
    fitBoundsActionRef.current = handleManualFitBounds;
  }, [handleManualFitBounds]);

  useEffect(() => {
    if (!map) return undefined;
    if (fitControlContainerRef.current) return undefined;

    const container = document.createElement('div');
    container.style.margin = '10px 10px 0 0';

    const controlButton = document.createElement('button');
    controlButton.type = 'button';
    controlButton.textContent = 'Enquadrar entregas';
    controlButton.style.backgroundColor = '#fff';
    controlButton.style.border = '1px solid rgba(15, 23, 42, 0.25)';
    controlButton.style.borderRadius = '4px';
    controlButton.style.boxShadow = '0 1px 4px rgba(15, 23, 42, 0.25)';
    controlButton.style.color = '#334155';
    controlButton.style.cursor = 'pointer';
    controlButton.style.fontSize = '12px';
    controlButton.style.fontWeight = '600';
    controlButton.style.lineHeight = '30px';
    controlButton.style.padding = '0 12px';
    controlButton.style.height = '30px';

    const onControlClick = () => {
      fitBoundsActionRef.current();
    };

    controlButton.addEventListener('click', onControlClick);
    fitControlListenerRef.current = onControlClick;

    container.appendChild(controlButton);
    map.controls[window.google.maps.ControlPosition.TOP_RIGHT].push(container);

    fitControlContainerRef.current = container;
    fitControlButtonRef.current = controlButton;

    return () => {
      if (fitControlListenerRef.current && fitControlButtonRef.current) {
        fitControlButtonRef.current.removeEventListener('click', fitControlListenerRef.current);
      }
      fitControlListenerRef.current = null;
      fitControlButtonRef.current = null;

      if (fitControlContainerRef.current) {
        const controls = map.controls[window.google.maps.ControlPosition.TOP_RIGHT];
        const index = controls.getArray().indexOf(fitControlContainerRef.current);
        if (index > -1) {
          controls.removeAt(index);
        }
      }
      fitControlContainerRef.current = null;
    };
  }, [map]);

  if (!apiKey) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-2 p-4 text-center text-sm text-muted">
        Configure `REACT_APP_GOOGLE_MAPS_API_KEY` (ou `VITE_GOOGLE_MAPS_API_KEY`) para carregar o mapa Google.
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-2 p-4 text-center text-sm text-red-700">
        Falha ao carregar Google Maps API.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-2 p-4 text-center text-sm text-muted">
        Carregando mapa Google...
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        options={mapOptions}
        onLoad={(instance) => {
          instance.setCenter(center);
          instance.setZoom(initialZoom);
          instance.setOptions({
            zoomControlOptions: {
              position: window.google.maps.ControlPosition.TOP_RIGHT,
            },
          });
          setMap(instance);
        }}
        onUnmount={() => setMap(null)}
        onIdle={emitBoundsChange}
      >
        {routes.map((route) => (
          <PolylineF
            key={route.id}
            path={route.points}
            options={{
              strokeColor: route.color,
              strokeOpacity: 0.9,
              strokeWeight: 4,
              geodesic: false,
            }}
          />
        ))}

        {deliveries.map((delivery) => {
          const zoom = map?.getZoom() || initialZoom;
          const markerSize = resolveMarkerSize(zoom);
          const iconSize = Math.max(12, Math.round(markerSize * 0.46));
          const Icon = STAGE_ICONS[delivery.status];
          const borderColor = resolveMarkerBorderColor(delivery);
          const iconColor = STAGE_STYLE[delivery.status].border;
          const isDimmed = selectedDriverId !== null && Number(delivery.driverId) !== Number(selectedDriverId);
          const isSelected = selectedDeliveryId === delivery.id;
          const markerOpacity = resolveMarkerOpacity(delivery, isDimmed);

          return (
            <OverlayViewF
              key={delivery.id}
              position={{ lat: delivery.lat, lng: delivery.lng }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              getPixelPositionOffset={(width, height) => ({
                x: Math.round(width / -2),
                y: Math.round(height / -2),
              })}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => onMarkerClick(delivery.id)}
                onMouseEnter={() => setHoveredDeliveryId(delivery.id)}
                onMouseLeave={() => setHoveredDeliveryId((current) => (current === delivery.id ? null : current))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onMarkerClick(delivery.id);
                  }
                }}
                aria-label={`Selecionar entrega ${delivery.label}`}
                className="flex items-center justify-center rounded-full bg-white"
                style={{
                  width: markerSize,
                  height: markerSize,
                  border: `${isSelected ? 3 : 2}px solid ${borderColor}`,
                  boxShadow: isSelected
                    ? '0 0 0 2px rgba(15,23,42,0.2), 0 6px 16px rgba(15,23,42,0.28)'
                    : '0 3px 10px rgba(15,23,42,0.2)',
                  opacity: markerOpacity,
                  transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                  transition: 'transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease',
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                  zIndex: isSelected ? 950 : isDimmed ? 120 : 500,
                }}
              >
                <Icon size={iconSize} strokeWidth={2.4} color={iconColor} />
              </div>
            </OverlayViewF>
          );
        })}

        {hoveredDelivery ? (
          <InfoWindowF
            position={{ lat: hoveredDelivery.lat, lng: hoveredDelivery.lng }}
            onCloseClick={() => setHoveredDeliveryId(null)}
            options={{
              pixelOffset: new window.google.maps.Size(
                0,
                -Math.round(resolveMarkerSize(map?.getZoom() || initialZoom) * 0.62),
              ),
            }}
          >
            <div className="space-y-0.5 text-xs">
              <div className="font-semibold">{hoveredDelivery.label}</div>
              <div>{hoveredDelivery.customerName}</div>
              <div className="text-slate-600">{`${hoveredDelivery.city} • ${hoveredDelivery.neighborhood}`}</div>
              <div>{`Motorista: ${hoveredDelivery.driverName || 'Nao atribuido'}`}</div>
              <div>{`Status: ${STAGE_LABELS[hoveredDelivery.status]}`}</div>
            </div>
          </InfoWindowF>
        ) : null}
      </GoogleMap>

    </div>
  );
}

export default GoogleDeliveriesMap;

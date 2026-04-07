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
  STAGE_LABELS,
} from '../../pages/deliveryMonitoring/mapStyles';
import {
  GoogleDeliveryMapItem,
  GoogleDriverLocation,
  GoogleDeliveryRoute,
} from '../../pages/deliveryMonitoring/googleMapAdapter';
import { MapMarkerPin } from './MapMarkerPin';
import {
  COMPANY_MARKER_ICON,
  DELIVERY_STAGE_ICONS,
  DRIVER_MARKER_ICON,
  getCompanyMarkerStyle,
  getDeliveryMarkerStyleByStatus,
  getDriverMarkerStyle,
} from '../../pages/deliveryMonitoring/googleMarkerVisuals';

export type GoogleMapBoundsPayload = {
  zoom: number;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  } | null;
};

export type GoogleCompanyMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  address?: string;
};

type GoogleDeliveriesMapProps = {
  apiKey: string;
  center: { lat: number; lng: number };
  initialZoom?: number;
  datasetKey?: string;
  deliveries: GoogleDeliveryMapItem[];
  driverLocations?: GoogleDriverLocation[];
  companyMarker?: GoogleCompanyMarker | null;
  routes?: GoogleDeliveryRoute[];
  selectedDriverId: number | null;
  selectedDeliveryId: string | null;
  onMarkerClick: (deliveryId: string) => void;
  onMapBoundsChange?: (payload: GoogleMapBoundsPayload) => void;
};

const mapContainerStyle = { width: '100%', height: '100%' };
const MAP_MIN_ZOOM = 4;
const MAP_MAX_ZOOM = 20;
const MAP_MARKER_ICON_SCALE = 0.38;
const MAP_MARKER_ICON_MIN_SIZE = 11;
const MAP_MARKER_PIN_MIN_SIZE = 18;
const MAP_MARKER_ICON_STROKE_WIDTH = 1.4;
const DRIVER_MARKER_ICON_SCALE = 0.4;
const DRIVER_MARKER_PIN_MIN_SIZE = 24;
const DRIVER_MARKER_ICON_MIN_SIZE = 12;
const DRIVER_MARKER_ICON_STROKE_WIDTH = 1.5;
const COMPANY_MARKER_ICON_SCALE = 0.38;
const COMPANY_MARKER_PIN_MIN_SIZE = 22;
const COMPANY_MARKER_ICON_MIN_SIZE = 12;
const COMPANY_MARKER_ICON_STROKE_WIDTH = 1.4;
const PIN_HEIGHT_RATIO = 1.35;

const resolveMarkerSize = (zoom: number) => {
  if (zoom <= 7) return 18;
  if (zoom <= 10) return 20;
  if (zoom <= 12) return 22;
  if (zoom <= 14) return 25;
  return 28;
};

function GoogleDeliveriesMap({
  apiKey,
  center,
  initialZoom = 10,
  datasetKey = 'default',
  deliveries,
  driverLocations = [],
  companyMarker = null,
  routes = [],
  selectedDriverId,
  selectedDeliveryId,
  onMarkerClick,
  onMapBoundsChange,
}: GoogleDeliveriesMapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [openedInfoDeliveryId, setOpenedInfoDeliveryId] = useState<string | null>(null);
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

  const openedInfoDelivery = useMemo(() => {
    if (!openedInfoDeliveryId) return null;
    return deliveries.find((delivery) => delivery.id === openedInfoDeliveryId) || null;
  }, [deliveries, openedInfoDeliveryId]);

  useEffect(() => {
    if (selectedDeliveryId) return;
    setOpenedInfoDeliveryId(null);
  }, [selectedDeliveryId]);

  useEffect(() => {
    if (!openedInfoDeliveryId) return;
    if (deliveries.some((delivery) => delivery.id === openedInfoDeliveryId)) return;
    setOpenedInfoDeliveryId(null);
  }, [deliveries, openedInfoDeliveryId]);

  const mapOptions = useMemo<google.maps.MapOptions>(() => ({
    // Keep the base map unstyled so the custom pins sit on top of the stock Google roadmap look.
    mapTypeControl: true,
    streetViewControl: false,
    fullscreenControl: true,
    zoomControl: true,
    gestureHandling: 'greedy',
    clickableIcons: false,
    mapTypeId: 'roadmap',
    backgroundColor: '#f5f3ef',
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

  const fitBoundsToMapItems = useCallback(() => {
    if (!map) return;
    if (!deliveries.length && !driverLocations.length) {
      map.setCenter(center);
      map.setZoom(initialZoom);
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    deliveries.forEach((delivery) => {
      bounds.extend({ lat: delivery.lat, lng: delivery.lng });
    });
    driverLocations.forEach((driverLocation) => {
      bounds.extend({ lat: driverLocation.lat, lng: driverLocation.lng });
    });
    map.fitBounds(bounds, 52);

    const currentZoom = map.getZoom();
    if (currentZoom && currentZoom > 15) {
      map.setZoom(15);
    }
  }, [center, deliveries, driverLocations, initialZoom, map]);

  useEffect(() => {
    if (!map) return;
    if (hasFittedBoundsRef.current) return;
    if (!deliveries.length && !driverLocations.length) return;
    fitBoundsToMapItems();
    hasFittedBoundsRef.current = true;
  }, [deliveries, driverLocations, fitBoundsToMapItems, map]);

  const handleManualFitBounds = useCallback(() => {
    fitBoundsToMapItems();
    hasFittedBoundsRef.current = true;
  }, [fitBoundsToMapItems]);

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
    controlButton.textContent = 'Enquadrar mapa';
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
          setMap(instance);
        }}
        onUnmount={() => setMap(null)}
        onClick={() => setOpenedInfoDeliveryId(null)}
        onIdle={emitBoundsChange}
      >
        {routes.map((route) => (
          route.segments.map((segment) => (
            <PolylineF
              key={segment.id}
              path={segment.points}
              options={{
                strokeColor: route.color,
                strokeOpacity: segment.completed ? 0.26 : 0.92,
                strokeWeight: segment.completed ? 3 : 4,
                geodesic: false,
                icons: segment.completed ? [] : [{
                  icon: {
                    path: 'M 0,-1 0,1',
                    strokeOpacity: 1,
                    strokeWeight: 3,
                    scale: 1,
                  },
                  offset: '0',
                  repeat: '14px',
                }],
              }}
            />
          ))
        ))}

        {deliveries.map((delivery) => {
          const zoom = map?.getZoom() || initialZoom;
          const markerSize = Math.max(MAP_MARKER_PIN_MIN_SIZE, resolveMarkerSize(zoom));
          const iconSize = Math.max(MAP_MARKER_ICON_MIN_SIZE, Math.round(markerSize * MAP_MARKER_ICON_SCALE));
          const Icon = DELIVERY_STAGE_ICONS[delivery.status];
          const markerTone = getDeliveryMarkerStyleByStatus(delivery);
          const isDimmed = selectedDriverId !== null && Number(delivery.driverId) !== Number(selectedDriverId);
          const isSelected = selectedDeliveryId === delivery.id;

          return (
            <OverlayViewF
              key={delivery.id}
              position={{ lat: delivery.lat, lng: delivery.lng }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              getPixelPositionOffset={(width, height) => ({
                x: Math.round(width / -2),
                y: Math.round(-height),
              })}
            >
              <MapMarkerPin
                icon={Icon}
                tone={markerTone}
                size={markerSize}
                iconSize={iconSize}
                iconStrokeWidth={MAP_MARKER_ICON_STROKE_WIDTH}
                interactive
                selected={isSelected}
                dimmed={isDimmed}
                title={`Selecionar entrega ${delivery.label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onMarkerClick(delivery.id);
                  setOpenedInfoDeliveryId(delivery.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onMarkerClick(delivery.id);
                    setOpenedInfoDeliveryId(delivery.id);
                  }
                }}
                style={{
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                  zIndex: isSelected ? 950 : isDimmed ? 120 : 500,
                }}
              />
            </OverlayViewF>
          );
        })}

        {companyMarker ? (() => {
          const zoom = map?.getZoom() || initialZoom;
          const companyMarkerSize = Math.max(
            COMPANY_MARKER_PIN_MIN_SIZE,
            Math.round(resolveMarkerSize(zoom) * 0.96),
          );
          const companyIconSize = Math.max(COMPANY_MARKER_ICON_MIN_SIZE, Math.round(companyMarkerSize * COMPANY_MARKER_ICON_SCALE));
          const companyTone = getCompanyMarkerStyle();

          return (
            <OverlayViewF
              key={companyMarker.id}
              position={{ lat: companyMarker.lat, lng: companyMarker.lng }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              getPixelPositionOffset={(width, height) => ({
                x: Math.round(width / -2),
                y: Math.round(-height),
              })}
            >
              <MapMarkerPin
                icon={COMPANY_MARKER_ICON}
                tone={companyTone}
                size={companyMarkerSize}
                iconSize={companyIconSize}
                iconStrokeWidth={COMPANY_MARKER_ICON_STROKE_WIDTH}
                label={companyMarker.label}
                title={companyMarker.address ? `${companyMarker.label} - ${companyMarker.address}` : companyMarker.label}
                style={{ pointerEvents: 'none', zIndex: 640 }}
              />
            </OverlayViewF>
          );
        })() : null}

        {driverLocations.map((driverLocation) => {
          const zoom = map?.getZoom() || initialZoom;
          const driverMarkerSize = Math.max(
            DRIVER_MARKER_PIN_MIN_SIZE,
            Math.round(resolveMarkerSize(zoom) * 1.12),
          );
          const driverIconSize = Math.max(
            DRIVER_MARKER_ICON_MIN_SIZE,
            Math.round(driverMarkerSize * DRIVER_MARKER_ICON_SCALE),
          );
          const isSelected = selectedDriverId !== null && Number(driverLocation.driverId) === Number(selectedDriverId);
          const isDimmed = selectedDriverId !== null && Number(driverLocation.driverId) !== Number(selectedDriverId);
          const driverTone = getDriverMarkerStyle(driverLocation);

          return (
            <OverlayViewF
              key={driverLocation.id}
              position={{ lat: driverLocation.lat, lng: driverLocation.lng }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              getPixelPositionOffset={(width, height) => ({
                x: Math.round(width / -2),
                y: Math.round(-height),
              })}
            >
              <MapMarkerPin
                icon={DRIVER_MARKER_ICON}
                tone={driverTone}
                size={driverMarkerSize}
                iconSize={driverIconSize}
                iconStrokeWidth={DRIVER_MARKER_ICON_STROKE_WIDTH}
                label={driverLocation.driverName}
                selected={isSelected}
                dimmed={isDimmed}
                title={driverLocation.driverName}
                style={{ pointerEvents: 'none', zIndex: isSelected ? 980 : 760 }}
              />
            </OverlayViewF>
          );
        })}

        {openedInfoDelivery ? (
          <InfoWindowF
            position={{ lat: openedInfoDelivery.lat, lng: openedInfoDelivery.lng }}
            onCloseClick={() => setOpenedInfoDeliveryId(null)}
            options={{
              pixelOffset: new window.google.maps.Size(
                0,
                -Math.round(resolveMarkerSize(map?.getZoom() || initialZoom) * PIN_HEIGHT_RATIO),
              ),
            }}
          >
            <div className="space-y-0.5 text-xs" style={{ color: '#000000' }}>
              <div className="font-semibold">{openedInfoDelivery.label}</div>
              <div>{openedInfoDelivery.customerName}</div>
              <div>{`${openedInfoDelivery.city} • ${openedInfoDelivery.neighborhood}`}</div>
              <div>{`Motorista: ${openedInfoDelivery.driverName || 'Nao atribuido'}`}</div>
              <div>{`Status: ${STAGE_LABELS[openedInfoDelivery.status]}`}</div>
            </div>
          </InfoWindowF>
        ) : null}
      </GoogleMap>

    </div>
  );
}

export default GoogleDeliveriesMap;

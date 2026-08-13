'use client';

/**
 * Draws/edits a partner territory's service-area boundary on Google Maps — either a draggable,
 * resizable radius circle, or a drawn/editable polygon. Follows the same "mount vanilla
 * google.maps.* overlay inside a useMap() hook" pattern as branch-address-editor.tsx, since
 * @vis.gl/react-google-maps has no first-class Circle/Polygon/DrawingManager wrapper.
 */

import { APIProvider, Map, Marker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useEffect, useRef, useState } from 'react';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export type LngLat = [number, number];

interface RadiusOverlayProps {
  center: { lat: number; lng: number };
  radiusKm: number;
  onChange: (center: { lat: number; lng: number }, radiusKm: number) => void;
}

/** Draggable center + resizable circle for radius-mode territories. */
function RadiusOverlay({ center, radiusKm, onChange }: RadiusOverlayProps) {
  const map = useMap();
  const circleRef = useRef<google.maps.Circle | null>(null);
  const suppressNextRef = useRef(false);

  useEffect(() => {
    if (!map) return;
    const circle = new google.maps.Circle({
      map,
      center,
      radius: radiusKm * 1000,
      editable: true,
      draggable: false,
      strokeColor: '#4f46e5',
      strokeWeight: 2,
      fillColor: '#4f46e5',
      fillOpacity: 0.12,
    });
    circleRef.current = circle;

    const emit = () => {
      if (suppressNextRef.current) return;
      const c = circle.getCenter();
      const r = circle.getRadius();
      if (!c) return;
      onChange({ lat: c.lat(), lng: c.lng() }, Math.round((r / 1000) * 100) / 100);
    };

    const listeners = [
      circle.addListener('radius_changed', emit),
      circle.addListener('center_changed', emit),
    ];

    return () => {
      listeners.forEach((l) => l.remove());
      circle.setMap(null);
      circleRef.current = null;
    };
    // Mount once per map instance; prop-driven updates are synced by the effect below instead of
    // being torn down/recreated (which would drop the user's in-progress drag).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    const circle = circleRef.current;
    if (!circle) return;
    suppressNextRef.current = true;
    const currentCenter = circle.getCenter();
    if (!currentCenter || currentCenter.lat() !== center.lat || currentCenter.lng() !== center.lng) {
      circle.setCenter(center);
    }
    const currentRadius = circle.getRadius();
    const nextRadius = radiusKm * 1000;
    if (Math.abs(currentRadius - nextRadius) > 1) {
      circle.setRadius(nextRadius);
    }
    suppressNextRef.current = false;
  }, [center, radiusKm]);

  return null;
}

/** @types/google.maps ships a stub `DrawingManager` (no constructor args, no setMap/
 * setDrawingMode) despite the real runtime API supporting them — this is the minimal shape we
 * actually use. */
interface DrawingManagerLike {
  setMap(map: google.maps.Map | null): void;
  setDrawingMode(mode: google.maps.drawing.OverlayType | null): void;
}

interface PolygonOverlayProps {
  /** Closed ring [lng, lat][] (first point repeated at the end), or null when no polygon yet. */
  path: LngLat[] | null;
  drawing: boolean;
  onDrawingStarted: () => void;
  onChange: (path: LngLat[]) => void;
}

/** Editable polygon; supports drawing a fresh one via the Drawing library when `drawing` is true. */
function PolygonOverlay({ path, drawing, onDrawingStarted, onChange }: PolygonOverlayProps) {
  const map = useMap();
  const drawingLib = useMapsLibrary('drawing');
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const drawingManagerRef = useRef<DrawingManagerLike | null>(null);

  const emitFromPolygon = (polygon: google.maps.Polygon) => {
    const latLngs = polygon.getPath().getArray();
    if (latLngs.length < 3) return;
    const ring: LngLat[] = latLngs.map((p) => [p.lng(), p.lat()]);
    ring.push(ring[0]);
    onChange(ring);
  };

  // Render/update the editable polygon from `path`.
  useEffect(() => {
    if (!map) return;
    if (!path || path.length < 4) {
      polygonRef.current?.setMap(null);
      polygonRef.current = null;
      return;
    }
    const ring = path.slice(0, -1).map(([lng, lat]) => ({ lat, lng }));
    if (!polygonRef.current) {
      const polygon = new google.maps.Polygon({
        map,
        paths: ring,
        editable: true,
        draggable: true,
        strokeColor: '#4f46e5',
        strokeWeight: 2,
        fillColor: '#4f46e5',
        fillOpacity: 0.12,
      });
      polygonRef.current = polygon;
      const emit = () => emitFromPolygon(polygon);
      polygon.getPath().addListener('set_at', emit);
      polygon.getPath().addListener('insert_at', emit);
      polygon.getPath().addListener('remove_at', emit);
      polygon.addListener('dragend', emit);
    } else {
      polygonRef.current.setPath(ring);
    }
  }, [map, path]);

  useEffect(() => {
    return () => {
      polygonRef.current?.setMap(null);
      polygonRef.current = null;
    };
  }, [map]);

  // Drawing-mode: let the admin trace a new polygon from scratch.
  // @types/google.maps' DrawingManager stub is incomplete (no constructor args, no
  // setMap/setDrawingMode) even though the real runtime class supports them — cast through the
  // permissive constructor below rather than fighting the stub.
  useEffect(() => {
    if (!map || !drawingLib || !drawing) return;
    const DrawingManagerCtor = drawingLib.DrawingManager as unknown as new (
      opts: Record<string, unknown>,
    ) => DrawingManagerLike;
    const manager = new DrawingManagerCtor({
      drawingMode: google.maps.drawing.OverlayType.POLYGON,
      drawingControl: false,
      polygonOptions: {
        editable: true,
        draggable: true,
        strokeColor: '#4f46e5',
        strokeWeight: 2,
        fillColor: '#4f46e5',
        fillOpacity: 0.12,
      },
    });
    manager.setMap(map);
    drawingManagerRef.current = manager;

    const completeListener = google.maps.event.addListener(
      manager,
      'polygoncomplete',
      (polygon: google.maps.Polygon) => {
        manager.setDrawingMode(null);
        polygonRef.current?.setMap(null);
        polygonRef.current = polygon;
        const emit = () => emitFromPolygon(polygon);
        polygon.getPath().addListener('set_at', emit);
        polygon.getPath().addListener('insert_at', emit);
        polygon.getPath().addListener('remove_at', emit);
        polygon.addListener('dragend', emit);
        emit();
        onDrawingStarted();
      },
    );

    return () => {
      google.maps.event.removeListener(completeListener);
      manager.setMap(null);
      drawingManagerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, drawingLib, drawing]);

  return null;
}

export interface TerritoryMapEditorProps {
  boundaryType: 'radius' | 'polygon';
  center: { lat: number; lng: number };
  radiusKm: number;
  onRadiusChange: (center: { lat: number; lng: number }, radiusKm: number) => void;
  polygonPath: LngLat[] | null;
  onPolygonChange: (path: LngLat[]) => void;
  heightClass?: string;
}

export function TerritoryMapEditor({
  boundaryType,
  center,
  radiusKm,
  onRadiusChange,
  polygonPath,
  onPolygonChange,
  heightClass = 'h-80',
}: TerritoryMapEditorProps) {
  const [drawing, setDrawing] = useState(false);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env to draw the territory boundary on a map.
      </p>
    );
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['drawing', 'marker']}>
      <div className="space-y-2">
        {boundaryType === 'polygon' ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => setDrawing(true)}
              disabled={drawing}
            >
              {polygonPath ? 'Redraw boundary' : 'Draw boundary'}
            </button>
            {drawing ? <span className="text-xs text-muted">Click the map to trace the boundary; double-click to finish.</span> : null}
            {!drawing && polygonPath ? (
              <span className="text-xs text-muted">Drag the points to fine-tune, or redraw from scratch.</span>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted">Drag the pin to move the center, or drag the circle&apos;s edge to resize.</p>
        )}

        <div className={heightClass}>
          <Map
            defaultCenter={center}
            defaultZoom={12}
            gestureHandling="greedy"
            disableDefaultUI={false}
            style={{ width: '100%', height: '100%', borderRadius: '0.5rem' }}
          >
            {boundaryType === 'radius' ? (
              <>
                <Marker
                  position={center}
                  draggable
                  onDragEnd={(e) => {
                    const pos = e.latLng;
                    if (pos) onRadiusChange({ lat: pos.lat(), lng: pos.lng() }, radiusKm);
                  }}
                />
                <RadiusOverlay center={center} radiusKm={radiusKm} onChange={onRadiusChange} />
              </>
            ) : (
              <PolygonOverlay
                path={polygonPath}
                drawing={drawing}
                onDrawingStarted={() => setDrawing(false)}
                onChange={onPolygonChange}
              />
            )}
          </Map>
        </div>
      </div>
    </APIProvider>
  );
}

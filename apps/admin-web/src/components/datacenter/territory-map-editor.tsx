'use client';

/**
 * Draws/edits a partner territory's service-area boundary on Google Maps — either a draggable,
 * resizable radius circle, or a drawn/editable polygon. Follows the same "mount vanilla
 * google.maps.* overlay inside a useMap() hook" pattern as branch-address-editor.tsx, since
 * @vis.gl/react-google-maps has no first-class Circle/Polygon wrapper.
 *
 * Polygon tracing is implemented by hand (plain map click listeners building up a
 * `google.maps.Polygon`) rather than `google.maps.drawing.DrawingManager` — Google deprecated the
 * Drawing library in Aug 2025 and is removing it entirely, so `importLibrary('drawing')` no longer
 * resolves.
 */

import { APIProvider, Map, Marker, useMap } from '@vis.gl/react-google-maps';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

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

export interface PolygonDrawHandle {
  /** Closes off the in-progress trace (needs >= 3 points) and commits it as the editable polygon. */
  finish(): void;
  /** Discards the in-progress trace without changing the existing polygon. */
  cancel(): void;
}

interface PolygonOverlayProps {
  /** Closed ring [lng, lat][] (first point repeated at the end), or null when no polygon yet. */
  path: LngLat[] | null;
  drawing: boolean;
  onPointCountChange: (count: number) => void;
  onDrawingFinished: () => void;
  onChange: (path: LngLat[]) => void;
}

/** Editable polygon; while `drawing` is true, clicks on the map append vertices to a fresh trace. */
const PolygonOverlay = forwardRef<PolygonDrawHandle, PolygonOverlayProps>(function PolygonOverlay(
  { path, drawing, onPointCountChange, onDrawingFinished, onChange },
  ref,
) {
  const map = useMap();
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const drawPointsRef = useRef<google.maps.LatLng[]>([]);
  const tracePolygonRef = useRef<google.maps.Polygon | null>(null);
  const keptRef = useRef(false);

  const emitFromPolygon = (polygon: google.maps.Polygon) => {
    const latLngs = polygon.getPath().getArray();
    if (latLngs.length < 3) return;
    const ring: LngLat[] = latLngs.map((p) => [p.lng(), p.lat()]);
    ring.push(ring[0]);
    onChange(ring);
  };

  const attachEditableListeners = (polygon: google.maps.Polygon) => {
    const emit = () => emitFromPolygon(polygon);
    polygon.getPath().addListener('set_at', emit);
    polygon.getPath().addListener('insert_at', emit);
    polygon.getPath().addListener('remove_at', emit);
    polygon.addListener('dragend', emit);
  };

  // Render/update the editable polygon from `path` (only while not actively tracing a new one).
  useEffect(() => {
    if (!map || drawing) return;
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
      attachEditableListeners(polygon);
    } else {
      polygonRef.current.setPath(ring);
    }
  }, [map, path, drawing]);

  useEffect(() => {
    return () => {
      polygonRef.current?.setMap(null);
      polygonRef.current = null;
    };
  }, [map]);

  // Tracing mode: collect click points into a plain (non-editable) polygon preview.
  useEffect(() => {
    if (!map || !drawing) return;
    drawPointsRef.current = [];
    keptRef.current = false;
    const trace = new google.maps.Polygon({
      map,
      paths: [],
      editable: false,
      draggable: false,
      clickable: false,
      strokeColor: '#4f46e5',
      strokeWeight: 2,
      fillColor: '#4f46e5',
      fillOpacity: 0.12,
    });
    tracePolygonRef.current = trace;

    const clickListener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      drawPointsRef.current.push(e.latLng);
      trace.setPath(drawPointsRef.current);
      onPointCountChange(drawPointsRef.current.length);
    });

    return () => {
      clickListener.remove();
      if (!keptRef.current) {
        trace.setMap(null);
      }
      tracePolygonRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, drawing]);

  useImperativeHandle(ref, () => ({
    finish() {
      const trace = tracePolygonRef.current;
      if (!trace || drawPointsRef.current.length < 3) return;
      keptRef.current = true;
      trace.setOptions({ editable: true, draggable: true, clickable: true });
      polygonRef.current?.setMap(null);
      polygonRef.current = trace;
      attachEditableListeners(trace);
      emitFromPolygon(trace);
      onDrawingFinished();
    },
    cancel() {
      onPointCountChange(0);
      onDrawingFinished();
    },
  }));

  return null;
});

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
  const [pointCount, setPointCount] = useState(0);
  const drawHandleRef = useRef<PolygonDrawHandle>(null);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env to draw the territory boundary on a map.
      </p>
    );
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['marker']}>
      <div className="space-y-2">
        {boundaryType === 'polygon' ? (
          <div className="flex flex-wrap items-center gap-2">
            {!drawing ? (
              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={() => {
                  setPointCount(0);
                  setDrawing(true);
                }}
              >
                {polygonPath ? 'Redraw boundary' : 'Draw boundary'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={pointCount < 3}
                  onClick={() => drawHandleRef.current?.finish()}
                >
                  Finish ({pointCount} point{pointCount === 1 ? '' : 's'})
                </button>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={() => drawHandleRef.current?.cancel()}
                >
                  Cancel
                </button>
              </>
            )}
            {drawing ? (
              <span className="text-xs text-muted">
                Click the map to place boundary points, then Finish (needs at least 3).
              </span>
            ) : polygonPath ? (
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
            disableDoubleClickZoom={drawing}
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
                ref={drawHandleRef}
                path={polygonPath}
                drawing={drawing}
                onPointCountChange={setPointCount}
                onDrawingFinished={() => setDrawing(false)}
                onChange={onPolygonChange}
              />
            )}
          </Map>
        </div>
      </div>
    </APIProvider>
  );
}

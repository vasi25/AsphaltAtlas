import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

type Mode = 'road' | 'straight'

interface Props {
  onChange: (geojson: { type: 'LineString'; coordinates: number[][] } | null, distanceKm: number) => void
  initialGeojson?: { type: 'LineString'; coordinates: number[][] } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function haversine([lng1, lat1]: number[], [lng2, lat2]: number[]): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function totalDistance(pts: number[][]): number {
  let d = 0
  for (let i = 1; i < pts.length; i++) d += haversine(pts[i - 1], pts[i])
  return Math.round(d * 10) / 10
}

async function fetchRoadSegment(from: number[], to: number[]): Promise<number[][] | null> {
  try {
    const coords = `${from[0]},${from[1]};${to[0]},${to[1]}`
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
    )
    const json = await res.json()
    if (json.code !== 'Ok' || !json.routes?.[0]) return null
    return json.routes[0].geometry.coordinates as number[][]
  } catch {
    return null
  }
}

// Concatenate per-segment coords into one line; uses straight fallback for null (still computing)
function buildRouteCoords(waypoints: number[][], segmentCoords: (number[][] | null)[]): number[][] {
  if (waypoints.length < 2) return waypoints
  const all: number[][] = []
  for (let i = 0; i < segmentCoords.length; i++) {
    const coords = segmentCoords[i] ?? [waypoints[i], waypoints[i + 1]]
    if (i === 0) {
      all.push(...coords)
    } else {
      all.push(...coords.slice(1)) // skip duplicate junction point
    }
  }
  return all
}

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RouteMapDraw({ onChange, initialGeojson }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])

  const [waypoints, setWaypoints] = useState<number[][]>([])
  // Per-segment mode and computed coords — index i = segment between waypoint[i] and waypoint[i+1]
  const [segmentModes, setSegmentModes] = useState<Mode[]>([])
  const [segmentCoords, setSegmentCoords] = useState<(number[][] | null)[]>([])

  const [mode, setMode] = useState<Mode>('road') // mode for the NEXT segment placed
  const [isDrawing, setIsDrawing] = useState(false)
  const [isRouting, setIsRouting] = useState(false)

  // Refs so map callbacks always see current values
  const isDrawingRef = useRef(false)
  isDrawingRef.current = isDrawing
  const modeRef = useRef<Mode>('road')
  modeRef.current = mode
  const waypointsRef = useRef<number[][]>([])
  waypointsRef.current = waypoints
  const initialGeojsonRef = useRef(initialGeojson)
  initialGeojsonRef.current = initialGeojson

  // ── Existing-route reference layer (edit mode) ─────────────────────────────────

  function applyInitialGeojson() {
    const map = mapRef.current
    const geo = initialGeojsonRef.current
    if (!map?.isStyleLoaded()) return
    const src = map.getSource('route-existing') as maplibregl.GeoJSONSource | undefined
    if (!src) return

    if (!geo || geo.coordinates.length < 2) {
      src.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } })
      return
    }

    src.setData({ type: 'Feature', properties: {}, geometry: geo })
    const bounds = geo.coordinates.reduce(
      (b, c) => b.extend(c as [number, number]),
      new maplibregl.LngLatBounds(geo.coordinates[0] as [number, number], geo.coordinates[0] as [number, number])
    )
    map.fitBounds(bounds, { padding: 60, duration: 0 })
  }

  useEffect(() => {
    applyInitialGeojson()
  }, [initialGeojson]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Init map ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [20, 48],
      zoom: 4,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    map.on('load', () => {
      map.addSource('route-existing', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
      })
      map.addLayer({
        id: 'route-existing-line',
        type: 'line',
        source: 'route-existing',
        paint: { 'line-color': '#9ca3af', 'line-width': 3, 'line-dasharray': [2, 1.5] },
      })

      map.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
      })
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#16a34a', 'line-width': 4, 'line-opacity': 0.9 },
      })

      applyInitialGeojson()

      map.on('click', (e) => {
        if (!isDrawingRef.current) return
        const pt = [e.lngLat.lng, e.lngLat.lat]
        const current = waypointsRef.current
        // Add new waypoint
        setWaypoints([...current, pt])
        // If there's already at least one point, a new segment is created
        if (current.length >= 1) {
          setSegmentModes((sm) => [...sm, modeRef.current])
          setSegmentCoords((sc) => [...sc, null]) // null = pending computation
        }
      })
    })

    mapRef.current = map
    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      map.remove()
    }
  }, [])

  // ── Compute pending segments ──────────────────────────────────────────────────

  useEffect(() => {
    const pendingIndices = segmentCoords
      .map((c, i) => (c === null ? i : -1))
      .filter((i) => i !== -1)

    if (pendingIndices.length === 0) return

    let cancelled = false
    setIsRouting(true)

    async function compute() {
      for (const i of pendingIndices) {
        if (cancelled) break
        const from = waypoints[i]
        const to = waypoints[i + 1]
        if (!from || !to) continue

        let coords: number[][]
        if (segmentModes[i] === 'straight') {
          coords = [from, to]
        } else {
          const road = await fetchRoadSegment(from, to)
          if (cancelled) break
          coords = road ?? [from, to]
        }

        if (!cancelled) {
          setSegmentCoords((prev) => {
            const next = [...prev]
            next[i] = coords
            return next
          })
        }
      }
      if (!cancelled) setIsRouting(false)
    }

    compute()
    return () => { cancelled = true }
  }, [segmentCoords]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync map line and call onChange ───────────────────────────────────────────

  useEffect(() => {
    if (waypoints.length < 2) {
      onChange(null, 0)
      const map = mapRef.current
      if (map?.isStyleLoaded()) {
        const src = map.getSource('route') as maplibregl.GeoJSONSource | undefined
        src?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } })
      }
      return
    }

    const routeCoords = buildRouteCoords(waypoints, segmentCoords)

    // Update map immediately (straight placeholders shown while road routes load)
    const map = mapRef.current
    if (map?.isStyleLoaded()) {
      const src = map.getSource('route') as maplibregl.GeoJSONSource | undefined
      src?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeCoords } })
    }

    // Only report to parent when all segments are resolved
    if (segmentCoords.every((c) => c !== null)) {
      onChange({ type: 'LineString', coordinates: routeCoords }, totalDistance(routeCoords))
    }
  }, [segmentCoords, waypoints]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync numbered waypoint markers ───────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    waypoints.forEach((pt, i) => {
      const el = document.createElement('div')
      el.style.cssText = [
        'width:26px', 'height:26px', 'background:#16a34a',
        'border:2px solid white', 'border-radius:50%',
        'display:flex', 'align-items:center', 'justify-content:center',
        'color:white', 'font-size:11px', 'font-weight:700',
        'box-shadow:0 1px 4px rgba(0,0,0,0.3)', 'cursor:default',
      ].join(';')
      el.textContent = String(i + 1)

      markersRef.current.push(
        new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat(pt as [number, number])
          .addTo(map)
      )
    })
  }, [waypoints])

  // ── Cursor ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = mapRef.current?.getCanvas()
    if (canvas) canvas.style.cursor = isDrawing ? 'crosshair' : ''
  }, [isDrawing])

  // ── Actions ───────────────────────────────────────────────────────────────────

  const undo = () => {
    setWaypoints((p) => p.slice(0, -1))
    setSegmentModes((p) => p.slice(0, -1))
    setSegmentCoords((p) => p.slice(0, -1))
  }

  const clear = () => {
    setWaypoints([])
    setSegmentModes([])
    setSegmentCoords([])
    onChange(null, 0)
  }

  const routeCoords = buildRouteCoords(waypoints, segmentCoords)
  const dist = waypoints.length < 2 ? 0 : totalDistance(routeCoords)

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden border border-gray-200">

      {/* Row 1: draw controls */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-white border-b border-gray-100 flex-wrap">
        <button
          type="button"
          onClick={() => setIsDrawing((d) => !d)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            isDrawing ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {isDrawing ? '✏️ Click map to add waypoints' : '✏️ Draw Route'}
        </button>

        {waypoints.length > 0 && (
          <>
            <button type="button" onClick={undo} className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">
              ↩ Undo
            </button>
            <button type="button" onClick={clear} className="px-3 py-1.5 text-sm rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
              ✕ Clear
            </button>
            <span className="ml-auto text-xs text-gray-400 flex items-center gap-1.5">
              {isRouting && (
                <span className="inline-block w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              )}
              {waypoints.length} waypoint{waypoints.length !== 1 ? 's' : ''} · {dist} km
            </span>
          </>
        )}

        {!isDrawing && waypoints.length === 0 && (
          <span className="text-xs text-gray-400">
            {initialGeojson
              ? 'Existing route shown in gray — draw a new path to replace it, or leave as is'
              : 'Click "Draw Route" then place waypoints on the map'}
          </span>
        )}
      </div>

      {/* Row 2: mode toggle — applies to the NEXT segment only */}
      <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-xs text-gray-500 font-medium">Next segment:</span>
        <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-medium">
          <button
            type="button"
            onClick={() => setMode('road')}
            className={`px-3 py-1.5 transition-colors ${
              mode === 'road' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            🛣️ Road routing
          </button>
          <button
            type="button"
            onClick={() => setMode('straight')}
            className={`px-3 py-1.5 border-l border-gray-200 transition-colors ${
              mode === 'straight' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            📏 Straight line
          </button>
        </div>
        <span className="text-xs text-gray-400">
          {mode === 'road' ? 'Next segment follows roads' : 'Next segment is a straight line'}
        </span>
      </div>

      {/* Map */}
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  )
}

import { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

type Mode = 'road' | 'straight'

interface Props {
  onChange: (geojson: { type: 'LineString'; coordinates: number[][] } | null, distanceKm: number) => void
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

async function fetchRoadRoute(waypoints: number[][]): Promise<number[][] | null> {
  if (waypoints.length < 2) return null
  try {
    const coords = waypoints.map((p) => `${p[0]},${p[1]}`).join(';')
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

export default function RouteMapDraw({ onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])

  const [waypoints, setWaypoints] = useState<number[][]>([])
  const [routeCoords, setRouteCoords] = useState<number[][]>([])
  const [mode, setMode] = useState<Mode>('road')
  const [isDrawing, setIsDrawing] = useState(false)
  const [isRouting, setIsRouting] = useState(false)

  const isDrawingRef = useRef(false)
  isDrawingRef.current = isDrawing

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

      map.on('click', (e) => {
        if (!isDrawingRef.current) return
        setWaypoints((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]])
      })
    })

    mapRef.current = map
    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      map.remove()
    }
  }, [])

  // ── Recompute route whenever waypoints or mode changes ────────────────────────

  useEffect(() => {
    let cancelled = false

    async function update() {
      if (waypoints.length < 2) {
        setRouteCoords(waypoints)
        onChange(null, 0)
        return
      }

      if (mode === 'straight') {
        setRouteCoords(waypoints)
        onChange({ type: 'LineString', coordinates: waypoints }, totalDistance(waypoints))
        return
      }

      // Road mode
      setIsRouting(true)
      const road = await fetchRoadRoute(waypoints)
      if (cancelled) return

      const coords = road ?? waypoints // fallback to straight lines if OSRM fails
      setRouteCoords(coords)
      onChange({ type: 'LineString', coordinates: coords }, totalDistance(coords))
      setIsRouting(false)
    }

    update()
    return () => { cancelled = true }
  }, [waypoints, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync route line on map ────────────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const src = map.getSource('route') as maplibregl.GeoJSONSource | undefined
    if (!src) return
    src.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: routeCoords },
    })
  }, [routeCoords])

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

  // ── Cursor ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = mapRef.current?.getCanvas()
    if (canvas) canvas.style.cursor = isDrawing ? 'crosshair' : ''
  }, [isDrawing])

  // ── Actions ──────────────────────────────────────────────────────────────────

  const undo = () => setWaypoints((p) => p.slice(0, -1))

  const clear = useCallback(() => {
    setWaypoints([])
    setRouteCoords([])
    onChange(null, 0)
  }, [onChange])

  const dist = totalDistance(routeCoords)

  // ── Render ───────────────────────────────────────────────────────────────────

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
          <span className="text-xs text-gray-400">Click "Draw Route" then place waypoints on the map</span>
        )}
      </div>

      {/* Row 2: mode toggle */}
      <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-xs text-gray-500 font-medium">Connect via:</span>
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
          {mode === 'road' ? 'Follows real roads · good for paved & gravel routes' : 'Direct connection · good for offroad, desert or unmapped tracks'}
        </span>
      </div>

      {/* Map */}
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  )
}

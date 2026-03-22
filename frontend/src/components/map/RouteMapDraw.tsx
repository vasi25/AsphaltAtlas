import { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

interface Props {
  onChange: (geojson: { type: 'LineString'; coordinates: number[][] } | null, distanceKm: number) => void
}

function haversine([lng1, lat1]: number[], [lng2, lat2]: number[]): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function totalDistance(pts: number[][]): number {
  let d = 0
  for (let i = 1; i < pts.length; i++) d += haversine(pts[i - 1], pts[i])
  return Math.round(d * 10) / 10
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

export default function RouteMapDraw({ onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [points, setPoints] = useState<number[][]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const isDrawingRef = useRef(false)
  const pointsRef = useRef<number[][]>([])

  isDrawingRef.current = isDrawing
  pointsRef.current = points

  // Init map
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

      map.addSource('points', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'points-layer',
        type: 'circle',
        source: 'points',
        paint: {
          'circle-radius': 5,
          'circle-color': '#16a34a',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
        },
      })

      map.on('click', (e) => {
        if (!isDrawingRef.current) return
        const newPt = [e.lngLat.lng, e.lngLat.lat]
        setPoints((prev) => [...prev, newPt])
      })
    })

    mapRef.current = map
    return () => map.remove()
  }, [])

  // Update map sources + notify parent when points change
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    const routeSource = map.getSource('route') as maplibregl.GeoJSONSource | undefined
    const pointsSource = map.getSource('points') as maplibregl.GeoJSONSource | undefined
    if (!routeSource || !pointsSource) return

    routeSource.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: points },
    })

    pointsSource.setData({
      type: 'FeatureCollection',
      features: points.map((p) => ({
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'Point' as const, coordinates: p },
      })),
    })

    if (points.length >= 2) {
      onChange({ type: 'LineString', coordinates: points }, totalDistance(points))
    } else {
      onChange(null, 0)
    }
  }, [points, onChange])

  // Cursor
  useEffect(() => {
    const canvas = mapRef.current?.getCanvas()
    if (canvas) canvas.style.cursor = isDrawing ? 'crosshair' : ''
  }, [isDrawing])

  const undo = () => setPoints((p) => p.slice(0, -1))
  const clear = useCallback(() => {
    setPoints([])
    onChange(null, 0)
  }, [onChange])

  const dist = totalDistance(points)

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden border border-gray-200">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-white border-b border-gray-200 flex-wrap">
        <button
          type="button"
          onClick={() => setIsDrawing((d) => !d)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            isDrawing
              ? 'bg-brand-600 text-white hover:bg-brand-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {isDrawing ? '✏️ Click map to add points' : '✏️ Draw Route'}
        </button>

        {points.length > 0 && (
          <>
            <button
              type="button"
              onClick={undo}
              className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              ↩ Undo
            </button>
            <button
              type="button"
              onClick={clear}
              className="px-3 py-1.5 text-sm rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
            >
              ✕ Clear
            </button>
            <span className="ml-auto text-xs text-gray-400">
              {points.length} pts · {dist} km
            </span>
          </>
        )}

        {!isDrawing && points.length === 0 && (
          <span className="text-xs text-gray-400">
            Click "Draw Route" then click the map to trace your route
          </span>
        )}
      </div>

      {/* Map */}
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  )
}

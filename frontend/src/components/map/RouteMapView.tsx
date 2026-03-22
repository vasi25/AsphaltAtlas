import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

interface Props {
  geojson: { type: 'LineString'; coordinates: number[][] } | null
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

export default function RouteMapView({ geojson }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const geojsonRef = useRef(geojson)
  geojsonRef.current = geojson

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
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [] },
        },
      })
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#16a34a',
          'line-width': 4,
          'line-opacity': 0.9,
        },
      })

      map.addSource('endpoints', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'endpoints-layer',
        type: 'circle',
        source: 'endpoints',
        paint: {
          'circle-radius': 7,
          'circle-color': '#16a34a',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
        },
      })

      // Apply geojson if already available when the map loads
      const current = geojsonRef.current
      if (current && current.coordinates.length >= 2) {
        applyGeojson(map, current)
      }
    })

    mapRef.current = map
    return () => map.remove()
  }, [])

  // Watch for geojson changes and update source
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    if (geojson && geojson.coordinates.length >= 2) {
      applyGeojson(map, geojson)
    } else {
      clearSources(map)
    }
  }, [geojson])

  if (!geojson) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50 rounded-xl border border-gray-200">
        <p className="text-gray-400 text-sm">No route drawn for this road</p>
      </div>
    )
  }

  return <div ref={containerRef} className="h-full w-full" />
}

function applyGeojson(map: maplibregl.Map, geojson: { type: 'LineString'; coordinates: number[][] }) {
  const routeSource = map.getSource('route') as maplibregl.GeoJSONSource | undefined
  const endpointsSource = map.getSource('endpoints') as maplibregl.GeoJSONSource | undefined
  if (!routeSource || !endpointsSource) return

  routeSource.setData({
    type: 'Feature',
    properties: {},
    geometry: geojson,
  })

  const coords = geojson.coordinates
  const start = coords[0]
  const end = coords[coords.length - 1]

  endpointsSource.setData({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: start },
      },
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: end },
      },
    ],
  })

  // Fit bounds
  const lngs = coords.map((c) => c[0])
  const lats = coords.map((c) => c[1])
  map.fitBounds(
    [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ],
    { padding: 40, animate: false }
  )
}

function clearSources(map: maplibregl.Map) {
  const routeSource = map.getSource('route') as maplibregl.GeoJSONSource | undefined
  const endpointsSource = map.getSource('endpoints') as maplibregl.GeoJSONSource | undefined
  if (routeSource) {
    routeSource.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } })
  }
  if (endpointsSource) {
    endpointsSource.setData({ type: 'FeatureCollection', features: [] })
  }
}

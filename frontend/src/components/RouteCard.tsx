import { Link } from 'react-router-dom'
import StarRating from './StarRating'
import type { RouteWithMeta } from '../hooks/useRoutes'

const DIFFICULTY_COLORS: Record<string, string> = {
  easy:     'bg-green-100 text-green-700',
  moderate: 'bg-yellow-100 text-yellow-700',
  hard:     'bg-orange-100 text-orange-700',
  extreme:  'bg-red-100 text-red-700',
}

interface Props {
  route: RouteWithMeta
}

export default function RouteCard({ route }: Props) {
  const cover = route.photos.find(p => p.is_cover) ?? route.photos[0]
  const location = [route.regions?.name, route.countries?.name].filter(Boolean).join(', ')

  return (
    <Link
      to={`/routes/${route.id}`}
      className="group bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col"
    >
      {/* Cover photo */}
      <div className="relative h-48 bg-gray-100 overflow-hidden">
        {cover ? (
          <img
            src={cover.url}
            alt={route.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
            <span className="text-5xl">🛣️</span>
          </div>
        )}

        {route.difficulty && (
          <span className={`absolute top-3 left-3 text-xs font-medium px-2 py-1 rounded-full ${DIFFICULTY_COLORS[route.difficulty]}`}>
            {route.difficulty.charAt(0).toUpperCase() + route.difficulty.slice(1)}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 text-base leading-snug group-hover:text-brand-600 transition-colors line-clamp-2">
          {route.title}
        </h3>

        {location && (
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <span>📍</span> {location}
          </p>
        )}

        {route.description && (
          <p className="text-sm text-gray-500 mt-2 line-clamp-2 flex-1">
            {route.description}
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-3 mt-3 text-xs text-gray-400 flex-wrap">
          {route.distance_km && (
            <span className="flex items-center gap-1">
              <span>📏</span> {route.distance_km} km
            </span>
          )}
          {route.duration_minutes && (
            <span className="flex items-center gap-1">
              <span>⏱</span> {Math.floor(route.duration_minutes / 60)}h{route.duration_minutes % 60 > 0 ? ` ${route.duration_minutes % 60}m` : ''}
            </span>
          )}
          {route.surface && (
            <span className="capitalize">{route.surface}</span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold">
              {route.profiles?.username?.[0]?.toUpperCase()}
            </div>
            <span className="text-xs text-gray-500">{route.profiles?.username}</span>
          </div>

          <div className="flex items-center gap-1">
            <StarRating rating={route.avg_rating} />
            <span className="text-xs text-gray-400">({route.review_count})</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

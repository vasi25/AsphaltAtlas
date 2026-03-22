import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useRoutes } from '../hooks/useRoutes'
import RouteCard from '../components/RouteCard'
import { useAuth } from '../contexts/AuthContext'
import type { Category } from '../types/database'

const DIFFICULTIES = ['easy', 'moderate', 'hard', 'extreme']
const SURFACES = ['paved', 'gravel', 'dirt', 'mixed']

export default function HomePage() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [difficulty, setDifficulty] = useState('')
  const [surface, setSurface] = useState('')

  const { routes, loading } = useRoutes({ search: debouncedSearch, categoryId, difficulty, surface })

  // Fetch categories for filter pills
  useEffect(() => {
    supabase.from('categories').select('*').order('name').then(({ data }) => {
      if (data) setCategories(data)
    })
  }, [])

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  function clearFilters() {
    setSearch('')
    setDebouncedSearch('')
    setCategoryId(null)
    setDifficulty('')
    setSurface('')
  }

  const hasFilters = search || categoryId || difficulty || surface

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Discover roads worth driving
          </h1>
          <p className="mt-4 text-brand-100 text-lg max-w-xl mx-auto">
            A community-driven atlas of scenic routes, offroad trails, mountain passes and hidden gems — shared by drivers, for drivers.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            {user ? (
              <Link
                to="/routes/new"
                className="bg-white text-brand-700 font-semibold px-6 py-3 rounded-xl hover:bg-brand-50 transition-colors"
              >
                + Post a Route
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="bg-white text-brand-700 font-semibold px-6 py-3 rounded-xl hover:bg-brand-50 transition-colors"
                >
                  Join for free
                </Link>
                <Link
                  to="/login"
                  className="border border-white/40 text-white font-medium px-6 py-3 rounded-xl hover:bg-white/10 transition-colors"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="bg-white border-b border-gray-200 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-3">

          {/* Search + dropdowns */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="Search routes…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>

            <select
              value={difficulty}
              onChange={e => setDifficulty(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="">All difficulties</option>
              {DIFFICULTIES.map(d => (
                <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
              ))}
            </select>

            <select
              value={surface}
              onChange={e => setSurface(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="">All surfaces</option>
              {SURFACES.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-gray-400 hover:text-gray-600 px-2 whitespace-nowrap"
              >
                ✕ Clear
              </button>
            )}
          </div>

          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setCategoryId(null)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                categoryId === null
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategoryId(categoryId === cat.id ? null : cat.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  categoryId === cat.id
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Route grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-pulse">
                <div className="h-48 bg-gray-200" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded w-full" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : routes.length === 0 ? (
          <div className="text-center py-24">
            <span className="text-6xl">🗺️</span>
            <h2 className="mt-4 text-xl font-semibold text-gray-700">No routes found</h2>
            <p className="mt-2 text-gray-400 text-sm">
              {hasFilters ? 'Try adjusting your filters.' : 'Be the first to post a route!'}
            </p>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-4 text-brand-600 text-sm font-medium hover:underline">
                Clear filters
              </button>
            )}
            {!hasFilters && user && (
              <Link to="/routes/new" className="mt-4 inline-block bg-brand-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-brand-700 transition-colors">
                Post a Route
              </Link>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-6">
              {routes.length} {routes.length === 1 ? 'route' : 'routes'} found
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {routes.map(route => (
                <RouteCard key={route.id} route={route} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

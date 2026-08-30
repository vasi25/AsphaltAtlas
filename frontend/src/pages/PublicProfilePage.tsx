import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import RouteCard from '../components/RouteCard'
import type { RouteWithMeta } from '../hooks/useRoutes'

interface PublicProfile {
  id: string
  username: string
  avatar_url: string | null
  car_model: string | null
  car_photo_url: string | null
  location_country_code: string | null
  location_city: string | null
  created_at: string
}

function countryFlag(code: string): string {
  return code.toUpperCase().split('').map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('')
}

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [countryName, setCountryName] = useState<string | null>(null)
  const [routes, setRoutes] = useState<RouteWithMeta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    async function load() {
      setLoading(true)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, car_model, car_photo_url, location_country_code, location_city, created_at')
        .eq('id', id)
        .single()

      if (!profileData) { navigate('/'); return }
      setProfile(profileData as PublicProfile)

      // Resolve country name
      if (profileData.location_country_code) {
        const { data: countryData } = await supabase
          .from('countries')
          .select('name')
          .eq('code', profileData.location_country_code)
          .single()
        if (countryData) setCountryName(countryData.name)
      }

      // Load their public routes
      const { data: routesData } = await supabase
        .from('routes')
        .select(`*, profiles!routes_user_id_fkey(username, avatar_url), countries(name), regions(name), photos(url, is_cover), route_categories(category_id)`)
        .eq('user_id', id)
        .eq('is_published', true)
        .order('created_at', { ascending: false })

      setRoutes((routesData ?? []) as RouteWithMeta[])
      setLoading(false)
    }

    load()
  }, [id, navigate])

  if (loading) return <Skeleton />

  if (!profile) return null

  const memberSince = new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const flag = profile.location_country_code ? countryFlag(profile.location_country_code) : null
  const locationParts = [flag, profile.location_city, countryName].filter(Boolean)

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8">

            {/* Photos */}
            <div className="flex items-end gap-4 flex-shrink-0">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-2">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.username} className="w-36 h-36 rounded-full object-cover shadow-md" />
                ) : (
                  <div className="w-36 h-36 rounded-full bg-brand-600 flex items-center justify-center text-white text-5xl font-bold uppercase shadow-md">
                    {profile.username[0]}
                  </div>
                )}
                <span className="text-xs text-gray-400 font-medium">Profile photo</span>
              </div>

              {/* Car photo */}
              <div className="flex flex-col items-center gap-2">
                {profile.car_photo_url ? (
                  <img src={profile.car_photo_url} alt="Car" className="w-52 h-36 rounded-2xl object-cover shadow-md" />
                ) : (
                  <div className="w-52 h-36 rounded-2xl shadow-md overflow-hidden">
                    <CarPlaceholder />
                  </div>
                )}
                <span className="text-xs text-gray-400 font-medium">Car photo</span>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{profile.username}</h1>

              <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-gray-400 mb-5 flex-wrap">
                <span>Member since {memberSince}</span>
              </div>

              <div className="space-y-2.5">
                {locationParts.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-base">📍</span>
                    <span className="text-sm text-gray-700">{locationParts.join(' ')}</span>
                  </div>
                )}
                {profile.car_model && (
                  <div className="flex items-center gap-2">
                    <span className="text-base">🚗</span>
                    <span className="text-sm text-gray-700">{profile.car_model}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Routes */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-5">
          Routes by {profile.username}
          <span className="ml-2 text-sm font-normal text-gray-400">({routes.length})</span>
        </h2>

        {routes.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <span className="text-4xl">🛣️</span>
            <p className="mt-3 text-sm">No routes posted yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {routes.map((route) => <RouteCard key={route.id} route={route} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function CarPlaceholder() {
  return (
    <svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="200" height="100" fill="#f1f5f9" />
      <rect x="20" y="50" width="160" height="32" rx="8" fill="#cbd5e1" />
      <path d="M55 50 Q65 24 90 22 L115 22 Q138 24 148 50 Z" fill="#94a3b8" />
      <path d="M70 48 Q76 30 90 28 L108 28 Q122 30 132 48 Z" fill="#e2e8f0" opacity="0.8" />
      <circle cx="58" cy="82" r="14" fill="#475569" />
      <circle cx="58" cy="82" r="7" fill="#94a3b8" />
      <circle cx="142" cy="82" r="14" fill="#475569" />
      <circle cx="142" cy="82" r="7" fill="#94a3b8" />
      <rect x="20" y="58" width="12" height="6" rx="3" fill="#fef08a" />
      <rect x="168" y="58" width="12" height="6" rx="3" fill="#fca5a5" />
    </svg>
  )
}

function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex gap-8">
          <div className="w-36 h-36 rounded-full bg-gray-200 flex-shrink-0" />
          <div className="flex-1 space-y-3 pt-2">
            <div className="h-7 bg-gray-200 rounded w-40" />
            <div className="h-4 bg-gray-200 rounded w-28" />
            <div className="h-4 bg-gray-200 rounded w-36" />
          </div>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-3 gap-5">
        {[1,2,3].map(i => <div key={i} className="h-64 bg-gray-200 rounded-2xl" />)}
      </div>
    </div>
  )
}

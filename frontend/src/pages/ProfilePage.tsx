import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import RouteCard from '../components/RouteCard'
import type { RouteWithMeta } from '../hooks/useRoutes'
import heroRoad from '../assets/hero-road.jpeg'

// ── Helpers ───────────────────────────────────────────────────────────────────

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('')
}

// ── Generic car SVG placeholder ──────────────────────────────────────────────

function CarPlaceholder() {
  return (
    <svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="200" height="100" fill="#f1f5f9" />
      {/* Body */}
      <rect x="20" y="50" width="160" height="32" rx="8" fill="#cbd5e1" />
      {/* Cabin */}
      <path d="M55 50 Q65 24 90 22 L115 22 Q138 24 148 50 Z" fill="#94a3b8" />
      {/* Windows */}
      <path d="M70 48 Q76 30 90 28 L108 28 Q122 30 132 48 Z" fill="#e2e8f0" opacity="0.8" />
      {/* Wheels */}
      <circle cx="58" cy="82" r="14" fill="#475569" />
      <circle cx="58" cy="82" r="7" fill="#94a3b8" />
      <circle cx="142" cy="82" r="14" fill="#475569" />
      <circle cx="142" cy="82" r="7" fill="#94a3b8" />
      {/* Headlights */}
      <rect x="20" y="58" width="12" height="6" rx="3" fill="#fef08a" />
      <rect x="168" y="58" width="12" height="6" rx="3" fill="#fca5a5" />
    </svg>
  )
}

// ── Photo upload card ─────────────────────────────────────────────────────────

function PhotoCard({
  label, photoUrl, uploading, shape = 'circle', placeholder, onUpload,
}: {
  label: string
  photoUrl: string | null
  uploading: boolean
  shape?: 'circle' | 'rect'
  placeholder?: string   // initial letter for circle placeholder
  onUpload: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`group relative overflow-hidden focus:outline-none shadow-md ${
          shape === 'circle' ? 'w-36 h-36 rounded-full' : 'w-52 h-36 rounded-2xl'
        }`}
        title={`Change ${label}`}
      >
        {photoUrl ? (
          <img src={photoUrl} alt={label} className="w-full h-full object-cover" />
        ) : shape === 'circle' ? (
          <div className="w-full h-full bg-brand-600 flex items-center justify-center text-white text-5xl font-bold uppercase">
            {placeholder ?? '?'}
          </div>
        ) : (
          <CarPlaceholder />
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
          {uploading
            ? <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <><span className="text-white text-2xl">📷</span><span className="text-white text-xs font-medium">Change photo</span></>}
        </div>
      </button>
      <span className="text-xs text-gray-400 font-medium">{label}</span>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { onUpload(f); e.target.value = '' } }} />
    </div>
  )
}

// ── Inline editable text field (car model, etc.) ──────────────────────────────

function EditableField({
  label, icon, value, placeholder, onSave,
}: {
  label: string; icon: string; value: string | null; placeholder: string
  onSave: (val: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setDraft(value ?? '') }, [value])

  async function save() {
    setSaving(true)
    await onSave(draft.trim())
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-base flex-shrink-0">{icon}</span>
      {editing ? (
        <>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            autoFocus
            className="flex-1 min-w-0 text-sm text-gray-700 border-b border-brand-400 bg-transparent outline-none pb-0.5"
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') { setEditing(false); setDraft(value ?? '') }
            }}
          />
          <button onClick={save} disabled={saving} className="text-xs text-brand-600 font-medium hover:text-brand-700 disabled:opacity-50 flex-shrink-0">
            {saving ? '…' : 'Save'}
          </button>
          <button onClick={() => { setEditing(false); setDraft(value ?? '') }} className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0">
            Cancel
          </button>
        </>
      ) : (
        <>
          <span className={`text-sm flex-1 min-w-0 truncate ${value ? 'text-gray-700' : 'text-gray-400 italic'}`}>
            {value || placeholder}
          </span>
          <button onClick={() => setEditing(true)} className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors" title={`Edit ${label}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
        </>
      )}
    </div>
  )
}

// ── Location field: country dropdown + free-text city ────────────────────────

interface Country { id: number; name: string; code: string }

function LocationField({
  countryCode, city, onSave,
}: {
  countryCode: string | null; city: string | null
  onSave: (code: string, city: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [countries, setCountries] = useState<Country[]>([])
  const [draftCode, setDraftCode] = useState(countryCode ?? '')
  const [draftCity, setDraftCity] = useState(city ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setDraftCode(countryCode ?? ''); setDraftCity(city ?? '') }, [countryCode, city])

  useEffect(() => {
    if (!editing || countries.length) return
    supabase.from('countries').select('id, name, code').order('name').then(({ data }) => {
      if (data) setCountries(data as Country[])
    })
  }, [editing, countries.length])

  async function save() {
    setSaving(true)
    await onSave(draftCode, draftCity.trim())
    setSaving(false)
    setEditing(false)
  }

  const displayCountry = countries.find((c) => c.code === countryCode)?.name ?? countryCode
  const flag = countryCode ? countryFlag(countryCode) : null
  const hasLocation = countryCode || city

  return (
    <div className="flex items-start gap-2 min-w-0">
      <span className="text-base flex-shrink-0 mt-0.5">📍</span>
      {editing ? (
        <div className="flex-1 min-w-0 space-y-2">
          <select
            value={draftCode}
            onChange={(e) => setDraftCode(e.target.value)}
            className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="">Select country…</option>
            {countries.map((c) => (
              <option key={c.id} value={c.code}>
                {countryFlag(c.code)} {c.name}
              </option>
            ))}
          </select>
          <input
            value={draftCity}
            onChange={(e) => setDraftCity(e.target.value)}
            placeholder="City or region (optional)"
            className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-brand-400"
            onKeyDown={(e) => { if (e.key === 'Enter') save() }}
          />
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="text-xs text-brand-600 font-medium hover:text-brand-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => { setEditing(false); setDraftCode(countryCode ?? ''); setDraftCity(city ?? '') }} className="text-xs text-gray-400 hover:text-gray-600">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <span className={`text-sm flex-1 min-w-0 ${hasLocation ? 'text-gray-700' : 'text-gray-400 italic'}`}>
            {hasLocation
              ? [flag, city, displayCountry].filter(Boolean).join(' ')
              : 'Add your location'}
          </span>
          <button onClick={() => setEditing(true)} className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors mt-0.5" title="Edit location">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
        </>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  const [searchParams] = useSearchParams()

  const [username, setUsername] = useState('')
  const [editingUsername, setEditingUsername] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [savingUsername, setSavingUsername] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [carPhotoUploading, setCarPhotoUploading] = useState(false)

  const [activeTab, setActiveTab] = useState<'routes' | 'saved'>(
    searchParams.get('tab') === 'saved' ? 'saved' : 'routes'
  )
  const [myRoutes, setMyRoutes] = useState<RouteWithMeta[]>([])
  const [savedRoutes, setSavedRoutes] = useState<RouteWithMeta[]>([])
  const [routesLoading, setRoutesLoading] = useState(true)
  const [savedLoading, setSavedLoading] = useState(true)

  useEffect(() => { if (profile?.username) setUsername(profile.username) }, [profile?.username])

  useEffect(() => {
    if (!user) return
    setRoutesLoading(true)
    supabase
      .from('routes')
      .select(`*, profiles!routes_user_id_fkey(username, avatar_url), countries(name), regions(name), photos(url, is_cover), route_categories(category_id)`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setMyRoutes((data ?? []) as RouteWithMeta[]); setRoutesLoading(false) })
  }, [user])

  useEffect(() => {
    if (!user) return
    setSavedLoading(true)
    supabase
      .from('favourites')
      .select(`routes(*, profiles!routes_user_id_fkey(username, avatar_url), countries(name), regions(name), photos(url, is_cover), route_categories(category_id))`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }) => { setSavedRoutes((data ?? []).map((f: any) => f.routes).filter(Boolean) as RouteWithMeta[]); setSavedLoading(false) })
  }, [user])

  async function handleSaveUsername() {
    if (!user || !username.trim()) return
    setSavingUsername(true)
    setUsernameError(null)
    const { error } = await supabase.from('profiles').update({ username: username.trim() }).eq('id', user.id)
    if (error) { setUsernameError(error.message) } else { await refreshProfile(); setEditingUsername(false) }
    setSavingUsername(false)
  }

  async function uploadProfilePhoto(file: File, pathKey: string, dbField: 'avatar_url' | 'car_photo_url', setUploading: (v: boolean) => void) {
    if (!user) return
    setUploading(true)
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${pathKey}/${user.id}.${ext}`
    const { error } = await supabase.storage.from('route-photos').upload(path, file, { upsert: true, contentType: file.type })
    if (!error) {
      const { data: urlData } = supabase.storage.from('route-photos').getPublicUrl(path)
      await supabase.from('profiles').update({ [dbField]: urlData.publicUrl }).eq('id', user.id)
      await refreshProfile()
    }
    setUploading(false)
  }

  async function saveCarModel(val: string) {
    if (!user) return
    await supabase.from('profiles').update({ car_model: val || null }).eq('id', user.id)
    await refreshProfile()
  }

  async function saveLocation(code: string, city: string) {
    if (!user) return
    await supabase.from('profiles').update({ location_country_code: code || null, location_city: city || null }).eq('id', user.id)
    await refreshProfile()
  }

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : null

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Profile header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8">

            {/* Profile photo + Car photo */}
            <div className="flex items-end gap-4 flex-shrink-0">
              <PhotoCard
                label="Profile photo"
                photoUrl={profile?.avatar_url ?? null}
                uploading={avatarUploading}
                shape="circle"
                placeholder={profile?.username?.[0]}
                onUpload={(f) => uploadProfilePhoto(f, 'avatars', 'avatar_url', setAvatarUploading)}
              />
              <PhotoCard
                label="Car photo"
                photoUrl={profile?.car_photo_url ?? null}
                uploading={carPhotoUploading}
                shape="rect"
                onUpload={(f) => uploadProfilePhoto(f, 'car-photos', 'car_photo_url', setCarPhotoUploading)}
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 text-center sm:text-left">

              {/* Username */}
              {editingUsername ? (
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap mb-1">
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="text-2xl font-bold text-gray-900 border-b-2 border-brand-500 bg-transparent outline-none pb-0.5 w-48"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveUsername()
                      if (e.key === 'Escape') { setEditingUsername(false); setUsername(profile?.username ?? '') }
                    }}
                  />
                  <button onClick={handleSaveUsername} disabled={savingUsername} className="px-3 py-1.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50">
                    {savingUsername ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => { setEditingUsername(false); setUsername(profile?.username ?? '') }} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-gray-900 truncate">{profile?.username}</h1>
                  <button onClick={() => setEditingUsername(true)} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0" title="Edit username">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                </div>
              )}
              {usernameError && <p className="mb-2 text-sm text-red-600">{usernameError}</p>}

              <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-gray-400 mb-5 flex-wrap">
                {memberSince && <span>Member since {memberSince}</span>}
                <span>·</span>
                <span>{user?.email}</span>
              </div>

              {/* Location + Car model — stacked */}
              <div className="space-y-3 max-w-xs">
                <LocationField
                  countryCode={profile?.location_country_code ?? null}
                  city={profile?.location_city ?? null}
                  onSave={saveLocation}
                />
                <EditableField
                  label="Car model"
                  icon="🚗"
                  value={profile?.car_model ?? null}
                  placeholder="Add your car model"
                  onSave={saveCarModel}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs + route grids */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex border-b border-gray-200 mb-6">
          <TabButton label="My Routes" count={routesLoading ? null : myRoutes.length} active={activeTab === 'routes'} onClick={() => setActiveTab('routes')} />
          <TabButton label="Saved Routes" count={savedLoading ? null : savedRoutes.length} active={activeTab === 'saved'} onClick={() => setActiveTab('saved')} />
        </div>

        {activeTab === 'routes' && (
          routesLoading ? <RoutesSkeleton /> :
          myRoutes.length === 0 ? (
            <EmptyState image={heroRoad} title="No routes posted yet" description="Share your favourite driving roads with the community." linkTo="/routes/new" linkLabel="Post your first route" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {myRoutes.map((route) => <RouteCard key={route.id} route={route} />)}
            </div>
          )
        )}

        {activeTab === 'saved' && (
          savedLoading ? <RoutesSkeleton /> :
          savedRoutes.length === 0 ? (
            <EmptyState emoji="♡" title="No saved routes yet" description="Explore routes and save the ones you want to drive." linkTo="/" linkLabel="Explore routes" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {savedRoutes.map((route) => <RouteCard key={route.id} route={route} />)}
            </div>
          )
        )}
      </div>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function TabButton({ label, count, active, onClick }: { label: string; count: number | null; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${active ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
      {label}{count !== null ? ` (${count})` : ''}
    </button>
  )
}

function RoutesSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="h-48 bg-gray-200" />
          <div className="p-4 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
            <div className="h-3 bg-gray-200 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ emoji, image, title, description, linkTo, linkLabel }: { emoji?: string; image?: string; title: string; description: string; linkTo: string; linkLabel: string }) {
  return (
    <div className="text-center py-16">
      {image ? (
        <img src={image} alt="" className="mx-auto w-20 h-20 rounded-xl object-cover shadow-sm" />
      ) : (
        <span className="text-5xl">{emoji}</span>
      )}
      <h3 className="mt-4 text-lg font-semibold text-gray-700">{title}</h3>
      <p className="mt-1 text-sm text-gray-400">{description}</p>
      <Link to={linkTo} className="mt-5 inline-block px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors">{linkLabel}</Link>
    </div>
  )
}

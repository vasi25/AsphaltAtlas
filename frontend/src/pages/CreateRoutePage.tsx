import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import RouteMapDraw from '../components/map/RouteMapDraw'
import type { Category, Country, Region } from '../types/database'

const DIFFICULTIES = ['easy', 'moderate', 'hard', 'extreme'] as const
const SURFACES = ['paved', 'gravel', 'dirt', 'mixed'] as const

interface ExistingPhoto {
  id: string
  url: string
  storagePath: string
  isCover: boolean
}

interface NewPhoto {
  file: File
  preview: string
  isCover: boolean
}

type PhotoItem =
  | { kind: 'existing'; photo: ExistingPhoto }
  | { kind: 'new'; photo: NewPhoto }

export default function CreateRoutePage() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const { id: routeId } = useParams<{ id: string }>()
  const isEditMode = Boolean(routeId)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tips, setTips] = useState('')
  const [countryId, setCountryId] = useState<number | ''>('')
  const [regionId, setRegionId] = useState<number | ''>('')
  const [distanceKm, setDistanceKm] = useState<number | ''>('')
  const [durationHours, setDurationHours] = useState<number | ''>('')
  const [durationMinutes, setDurationMinutes] = useState<number | ''>('')
  const [difficulty, setDifficulty] = useState<string>('')
  const [surface, setSurface] = useState<string>('')
  const [selectedCategories, setSelectedCategories] = useState<number[]>([])
  const [isAdminEdit, setIsAdminEdit] = useState(false)

  // Lookup data
  const [countries, setCountries] = useState<Country[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const pendingRegionRef = useRef<number | null>(null)

  // Map / geometry
  const [geometry, setGeometry] = useState<{ type: 'LineString'; coordinates: number[][] } | null>(null)
  const [geometryTouched, setGeometryTouched] = useState(false)
  const [existingGeojson, setExistingGeojson] = useState<{ type: 'LineString'; coordinates: number[][] } | null>(null)
  const [mapDistance, setMapDistance] = useState(0)

  // Photos
  const [photoItems, setPhotoItems] = useState<PhotoItem[]>([])
  const [removedExistingPhotos, setRemovedExistingPhotos] = useState<ExistingPhoto[]>([])

  // Page / submission
  const [pageLoading, setPageLoading] = useState(isEditMode)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('countries').select('*').order('name').then(({ data }) => {
      if (data) setCountries(data)
    })
    supabase.from('categories').select('*').order('name').then(({ data }) => {
      if (data) setCategories(data)
    })
  }, [])

  useEffect(() => {
    if (!countryId) { setRegions([]); setRegionId(''); return }
    supabase.from('regions').select('*').eq('country_id', countryId).order('name').then(({ data }) => {
      setRegions(data ?? [])
      if (pendingRegionRef.current != null) {
        setRegionId(pendingRegionRef.current)
        pendingRegionRef.current = null
      } else {
        setRegionId('')
      }
    })
  }, [countryId])

  // Load existing route data when editing
  useEffect(() => {
    if (!routeId || !user) return
    let cancelled = false

    async function load() {
      setPageLoading(true)

      const { data, error: fetchErr } = await supabase
        .from('routes')
        .select('*, photos(id, url, storage_path, is_cover, order_index), route_categories(category_id)')
        .eq('id', routeId)
        .single()

      if (cancelled) return

      if (fetchErr || !data) {
        navigate('/')
        return
      }

      const owner = data.user_id === user!.id
      if (!owner && !isAdmin) {
        navigate(`/routes/${routeId}`)
        return
      }
      setIsAdminEdit(!owner && isAdmin)

      setTitle(data.title ?? '')
      setDescription(data.description ?? '')
      setTips(data.tips ?? '')
      pendingRegionRef.current = data.region_id ?? null
      setCountryId(data.country_id ?? '')
      setDistanceKm(data.distance_km ?? '')
      if (data.duration_minutes != null) {
        setDurationHours(Math.floor(data.duration_minutes / 60))
        setDurationMinutes(data.duration_minutes % 60)
      }
      setDifficulty(data.difficulty ?? '')
      setSurface(data.surface ?? '')
      setSelectedCategories((data.route_categories ?? []).map((rc: { category_id: number }) => rc.category_id))
      setPhotoItems(
        (data.photos ?? [])
          .slice()
          .sort(
            (a: { is_cover: boolean; order_index: number }, b: { is_cover: boolean; order_index: number }) =>
              (b.is_cover ? 1 : 0) - (a.is_cover ? 1 : 0) || a.order_index - b.order_index
          )
          .map((p: { id: string; url: string; storage_path: string; is_cover: boolean }) => ({
            kind: 'existing' as const,
            photo: { id: p.id, url: p.url, storagePath: p.storage_path, isCover: p.is_cover },
          }))
      )

      const { data: geoData } = await supabase.rpc('get_route_geojson', { p_route_id: routeId })
      if (geoData && !cancelled) {
        try {
          const parsed = typeof geoData === 'string' ? JSON.parse(geoData) : geoData
          setExistingGeojson(parsed)
        } catch {
          // ignore parse errors
        }
      }

      setPageLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [routeId, user, isAdmin, navigate])

  const handleRouteChange = useCallback(
    (geo: { type: 'LineString'; coordinates: number[][] } | null, dist: number) => {
      if (geo) setGeometryTouched(true)
      setGeometry(geo)
      setMapDistance(dist)
      if (dist > 0 && distanceKm === '') setDistanceKm(Math.round(dist * 10) / 10)
    },
    [distanceKm]
  )

  function toggleCategory(id: number) {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  function handlePhotoAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const hasCover = photoItems.some((p) => p.photo.isCover)
    const newItems: PhotoItem[] = files.map((file, i) => ({
      kind: 'new',
      photo: {
        file,
        preview: URL.createObjectURL(file),
        isCover: !hasCover && i === 0,
      },
    }))
    setPhotoItems((prev) => [...prev, ...newItems])
    e.target.value = ''
  }

  function removePhoto(index: number) {
    setPhotoItems((prev) => {
      const removed = prev[index]
      const updated = prev.filter((_, i) => i !== index)
      if (removed.kind === 'existing') {
        setRemovedExistingPhotos((r) => [...r, removed.photo])
      }
      if (removed.photo.isCover && updated.length > 0) updated[0].photo.isCover = true
      return updated
    })
  }

  function setCover(index: number) {
    setPhotoItems((prev) =>
      prev.map((item, i) =>
        item.kind === 'existing'
          ? { kind: 'existing', photo: { ...item.photo, isCover: i === index } }
          : { kind: 'new', photo: { ...item.photo, isCover: i === index } }
      )
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!title.trim()) { setError('Title is required'); return }
    if (!description.trim()) { setError('Description is required'); return }
    if (!countryId) { setError('Country is required'); return }
    if (!distanceKm || !difficulty || !surface || (!durationHours && !durationMinutes)) {
      setError('Road details are required'); return
    }
    if (selectedCategories.length === 0) { setError('Select at least one category'); return }
    if (photoItems.length === 0) { setError('At least one photo is required'); return }

    setError('')
    setSubmitting(true)

    try {
      const totalMinutes =
        (Number(durationHours) || 0) * 60 + (Number(durationMinutes) || 0)

      const routeFields = {
        title: title.trim(),
        description: description.trim() || null,
        tips: tips.trim() || null,
        country_id: countryId || null,
        region_id: regionId || null,
        distance_km: distanceKm || null,
        duration_minutes: totalMinutes || null,
        difficulty: difficulty || null,
        surface: surface || null,
      }

      let currentRouteId: string

      if (isEditMode && routeId) {
        const { error: updateErr } = await supabase.from('routes').update(routeFields).eq('id', routeId)
        if (updateErr) throw updateErr
        currentRouteId = routeId
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('routes')
          .insert({
            user_id: user.id,
            ...routeFields,
            is_published: isAdmin,
            moderation_status: isAdmin ? 'approved' : 'pending',
          })
          .select()
          .single()
        if (insertErr) throw insertErr
        currentRouteId = inserted.id
      }

      // Geometry — only touch if a new route was actually drawn this session
      if (geometryTouched && geometry) {
        const { error: geoErr } = await supabase.rpc('insert_route_geometry', {
          p_route_id: currentRouteId,
          p_geojson: JSON.stringify(geometry),
        })
        if (geoErr) console.warn('Geometry update failed:', geoErr)
      }

      // Categories — clear and re-insert
      if (isEditMode) {
        await supabase.from('route_categories').delete().eq('route_id', currentRouteId)
      }
      if (selectedCategories.length > 0) {
        await supabase.from('route_categories').insert(
          selectedCategories.map((catId) => ({ route_id: currentRouteId, category_id: catId }))
        )
      }

      // Photos removed during editing
      for (const removed of removedExistingPhotos) {
        await supabase.storage.from('route-photos').remove([removed.storagePath])
        await supabase.from('photos').delete().eq('id', removed.id)
      }

      // Existing photos (order/cover) + newly added uploads
      for (let i = 0; i < photoItems.length; i++) {
        const item = photoItems[i]

        if (item.kind === 'existing') {
          await supabase
            .from('photos')
            .update({ is_cover: item.photo.isCover, order_index: i })
            .eq('id', item.photo.id)
          continue
        }

        const ext = item.photo.file.name.split('.').pop() ?? 'jpg'
        const path = `${user.id}/${currentRouteId}/${crypto.randomUUID()}.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from('route-photos')
          .upload(path, item.photo.file, { contentType: item.photo.file.type })

        if (uploadErr) { console.warn('Photo upload failed:', uploadErr); continue }

        const { data: urlData } = supabase.storage.from('route-photos').getPublicUrl(path)

        await supabase.from('photos').insert({
          route_id: currentRouteId,
          user_id: user.id,
          storage_path: path,
          url: urlData.publicUrl,
          is_cover: item.photo.isCover,
          order_index: i,
        })
      }

      navigate(`/routes/${currentRouteId}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition bg-white'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditMode ? (isAdminEdit ? 'Edit Route (admin)' : 'Edit Route') : 'Post a Route'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {isEditMode ? 'Update the details of this road' : 'Share a road you love with the community'}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Left: Form ── */}
          <div className="lg:w-2/5 space-y-5">

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            {/* Title */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
              <div>
                <label className={labelClass}>Title <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Transfăgărășan Highway"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Description <span className="text-red-400">*</span></label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell the story of this road — what makes it special?"
                  rows={4}
                  className={inputClass + ' resize-none'}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Tips & Recommendations</label>
                <textarea
                  value={tips}
                  onChange={(e) => setTips(e.target.value)}
                  placeholder="Best time to drive, what to watch out for, must-stop viewpoints..."
                  rows={3}
                  className={inputClass + ' resize-none'}
                />
              </div>
            </div>

            {/* Location */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
              <h2 className="font-semibold text-gray-800">Location</h2>

              <div>
                <label className={labelClass}>Country <span className="text-red-400">*</span></label>
                <select
                  value={countryId}
                  onChange={(e) => setCountryId(e.target.value ? Number(e.target.value) : '')}
                  className={inputClass}
                  required
                >
                  <option value="">Select country…</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {regions.length > 0 && (
                <div>
                  <label className={labelClass}>Region</label>
                  <select
                    value={regionId}
                    onChange={(e) => setRegionId(e.target.value ? Number(e.target.value) : '')}
                    className={inputClass}
                  >
                    <option value="">Select region…</option>
                    {regions.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Road details */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
              <h2 className="font-semibold text-gray-800">Road Details <span className="text-red-400">*</span></h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Distance (km)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(e.target.value ? Number(e.target.value) : '')}
                    placeholder={mapDistance > 0 ? String(mapDistance) : '0'}
                    className={inputClass}
                  />
                  {mapDistance > 0 && (
                    <p className="text-xs text-brand-600 mt-1">
                      ~{mapDistance} km from drawn route
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Duration</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      value={durationHours}
                      onChange={(e) => setDurationHours(e.target.value ? Number(e.target.value) : '')}
                      placeholder="h"
                      className={inputClass}
                    />
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(e.target.value ? Number(e.target.value) : '')}
                      placeholder="min"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Difficulty</label>
                  <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={inputClass}>
                    <option value="">Select…</option>
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Surface</label>
                  <select value={surface} onChange={(e) => setSurface(e.target.value)} className={inputClass}>
                    <option value="">Select…</option>
                    {SURFACES.map((s) => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Categories */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Categories <span className="text-red-400">*</span></h2>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      selectedCategories.includes(cat.id)
                        ? 'bg-brand-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Photos */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-1">Photos <span className="text-red-400">*</span></h2>
              <p className="text-xs text-gray-400 mb-3">First photo is the cover. Click a photo to set it as cover.</p>

              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-4 cursor-pointer hover:border-brand-400 transition-colors text-sm text-gray-500 hover:text-brand-600">
                <span>📷</span> Add photos
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={handlePhotoAdd}
                />
              </label>

              {photoItems.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {photoItems.map((item, i) => (
                    <div
                      key={item.kind === 'existing' ? item.photo.id : i}
                      className={`relative rounded-xl overflow-hidden aspect-square cursor-pointer border-2 transition-colors ${
                        item.photo.isCover ? 'border-brand-500' : 'border-transparent'
                      }`}
                      onClick={() => setCover(i)}
                    >
                      <img
                        src={item.kind === 'existing' ? item.photo.url : item.photo.preview}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                      {item.photo.isCover && (
                        <span className="absolute bottom-1 left-1 bg-brand-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                          Cover
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removePhoto(i) }}
                        className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-black/70"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {submitting ? 'Saving…' : isEditMode ? 'Save Changes' : 'Publish Route'}
            </button>
          </div>

          {/* ── Right: Map ── */}
          <div className="lg:w-3/5 lg:sticky lg:top-24 h-[500px] lg:h-[calc(100vh-8rem)]">
            <RouteMapDraw onChange={handleRouteChange} initialGeojson={existingGeojson} />
            {!geometry && !existingGeojson && (
              <p className="text-xs text-gray-400 text-center mt-2">
                Drawing a route is optional but highly recommended
              </p>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}

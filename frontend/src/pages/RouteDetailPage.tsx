import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import StarRating from '../components/StarRating'
import RouteMapView from '../components/map/RouteMapView'
import QASection from '../components/QASection'
import type { Difficulty, Surface } from '../types/database'

// ── Types ──────────────────────────────────────────────────────────────────────

interface PhotoRow {
  id: string
  url: string
  is_cover: boolean
  caption: string | null
  order_index: number
}

interface ReviewRow {
  id: string
  route_id: string
  user_id: string
  rating: number
  comment: string | null
  created_at: string
  updated_at: string
  profiles: { username: string; avatar_url: string | null } | null
}

interface RouteDetail {
  id: string
  user_id: string
  title: string
  description: string | null
  distance_km: number | null
  duration_minutes: number | null
  difficulty: Difficulty | null
  surface: Surface | null
  tips: string | null
  avg_rating: number
  review_count: number
  created_at: string
  profiles: { username: string; avatar_url: string | null } | null
  countries: { name: string } | null
  regions: { name: string } | null
  photos: PhotoRow[]
  route_categories: { category_id: number; categories: { name: string } | null }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: 'bg-green-100 text-green-700',
  moderate: 'bg-yellow-100 text-yellow-700',
  hard: 'bg-orange-100 text-orange-700',
  extreme: 'bg-red-100 text-red-700',
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function AvatarInitial({ username, avatarUrl }: { username: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={username} className="w-9 h-9 rounded-full object-cover" />
  }
  return (
    <div className="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-semibold uppercase">
      {username.charAt(0)}
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-72 bg-gray-200 w-full" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex gap-8">
        <div className="flex-1 space-y-4">
          <div className="h-5 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
          <div className="h-96 bg-gray-200 rounded-xl" />
        </div>
        <div className="w-80 space-y-4">
          <div className="h-48 bg-gray-200 rounded-xl" />
          <div className="h-32 bg-gray-200 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function RouteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [route, setRoute] = useState<RouteDetail | null>(null)
  const [geojson, setGeojson] = useState<{ type: 'LineString'; coordinates: number[][] } | null>(null)
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [isFavourited, setIsFavourited] = useState(false)
  const [myReview, setMyReview] = useState<ReviewRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [favLoading, setFavLoading] = useState(false)

  // Review form state
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)

  // Display avg rating (can be updated after review submission)
  const [displayAvgRating, setDisplayAvgRating] = useState(0)

  // ── Fetch all data ───────────────────────────────────────────────────────────

  async function fetchReviews() {
    if (!id) return
    const { data } = await supabase
      .from('reviews')
      .select('*, profiles!reviews_user_id_fkey(username, avatar_url)')
      .eq('route_id', id)
      .order('created_at', { ascending: false })
    if (data) setReviews(data as ReviewRow[])
  }

  useEffect(() => {
    if (!id) return

    async function load() {
      setLoading(true)

      // 1. Route + joined data
      const { data: routeData, error: routeError } = await supabase
        .from('routes')
        .select(`
          *,
          profiles!routes_user_id_fkey(username, avatar_url),
          countries(name),
          regions(name),
          photos(id, url, is_cover, caption, order_index),
          route_categories(category_id, categories(name))
        `)
        .eq('id', id)
        .single()

      if (routeError || !routeData) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setRoute(routeData as unknown as RouteDetail)
      setDisplayAvgRating((routeData as unknown as RouteDetail).avg_rating)

      // 2. Route geometry
      const { data: geoData } = await supabase.rpc('get_route_geojson', { p_route_id: id })
      if (geoData) {
        try {
          const parsed = typeof geoData === 'string' ? JSON.parse(geoData) : geoData
          setGeojson(parsed)
        } catch {
          // silently ignore parse errors
        }
      }

      // 3. Reviews
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('*, profiles!reviews_user_id_fkey(username, avatar_url)')
        .eq('route_id', id)
        .order('created_at', { ascending: false })
      if (reviewsData) setReviews(reviewsData as ReviewRow[])

      // 4 & 5. User-specific data
      if (user) {
        const [favResult, myReviewResult] = await Promise.all([
          supabase
            .from('favourites')
            .select('route_id')
            .eq('user_id', user.id)
            .eq('route_id', id)
            .maybeSingle(),
          supabase
            .from('reviews')
            .select('*, profiles!reviews_user_id_fkey(username, avatar_url)')
            .eq('route_id', id)
            .eq('user_id', user.id)
            .maybeSingle(),
        ])
        setIsFavourited(!!favResult.data)
        if (myReviewResult.data) setMyReview(myReviewResult.data as ReviewRow)
      }

      setLoading(false)
    }

    load()
  }, [id, user])

  // ── Favourite toggle ─────────────────────────────────────────────────────────

  async function toggleFavourite() {
    if (!user) {
      navigate('/login')
      return
    }
    if (!id || favLoading) return

    const prev = isFavourited
    setIsFavourited(!prev)
    setFavLoading(true)

    try {
      if (prev) {
        const { error } = await supabase
          .from('favourites')
          .delete()
          .eq('user_id', user.id)
          .eq('route_id', id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('favourites')
          .insert({ user_id: user.id, route_id: id })
        if (error) throw error
      }
    } catch {
      setIsFavourited(prev) // revert on error
    } finally {
      setFavLoading(false)
    }
  }

  // ── Submit review ────────────────────────────────────────────────────────────

  async function submitReview(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !id || reviewRating === 0) return
    setReviewSubmitting(true)
    setReviewError(null)

    const { error } = await supabase.from('reviews').insert({
      route_id: id,
      user_id: user.id,
      rating: reviewRating,
      comment: reviewComment.trim() || null,
    })

    if (error) {
      setReviewError(error.message)
      setReviewSubmitting(false)
      return
    }

    // Refresh reviews and my review
    await fetchReviews()

    const { data: myNew } = await supabase
      .from('reviews')
      .select('*, profiles!reviews_user_id_fkey(username, avatar_url)')
      .eq('route_id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (myNew) setMyReview(myNew as ReviewRow)

    // Refresh avg_rating from route
    const { data: updatedRoute } = await supabase
      .from('routes')
      .select('avg_rating')
      .eq('id', id)
      .single()
    if (updatedRoute) setDisplayAvgRating(updatedRoute.avg_rating)

    setReviewRating(0)
    setReviewComment('')
    setReviewSubmitting(false)
  }

  // ── Delete review ────────────────────────────────────────────────────────────

  async function deleteReview(reviewId: string) {
    if (!user) return
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId)
      .eq('user_id', user.id)
    if (error) return

    setMyReview(null)
    await fetchReviews()

    const { data: updatedRoute } = await supabase
      .from('routes')
      .select('avg_rating')
      .eq('id', id)
      .single()
    if (updatedRoute) setDisplayAvgRating(updatedRoute.avg_rating)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) return <Skeleton />

  if (notFound || !route) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <span className="text-6xl">🗺️</span>
        <h2 className="mt-4 text-xl font-semibold text-gray-700">Route not found</h2>
        <p className="mt-2 text-gray-400 text-sm">This route may have been removed or doesn't exist.</p>
      </div>
    )
  }

  const coverPhoto = route.photos.find((p) => p.is_cover) ?? route.photos[0] ?? null
  const galleryPhotos = route.photos.filter((p) => !p.is_cover).sort((a, b) => a.order_index - b.order_index)

  const location = [route.regions?.name, route.countries?.name].filter(Boolean).join(', ')
  const categories = route.route_categories.map((rc) => rc.categories?.name).filter(Boolean)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cover photo + title overlay */}
      <div className="relative h-72 bg-gray-800 overflow-hidden">
        {coverPhoto ? (
          <img src={coverPhoto.url} alt={route.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-brand-700 to-brand-500" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-white drop-shadow">{route.title}</h1>
          {location && <p className="mt-1 text-white/80 text-sm">{location}</p>}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* ── LEFT ───────────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-8">

            {/* Description */}
            {route.description && (
              <section>
                <h2 className="text-lg font-semibold text-gray-800 mb-2">About this route</h2>
                <p className="text-gray-600 leading-relaxed whitespace-pre-line">{route.description}</p>
              </section>
            )}

            {/* Map */}
            <section>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Route map</h2>
              <div className="h-96 rounded-xl overflow-hidden border border-gray-200">
                <RouteMapView geojson={geojson} />
              </div>
            </section>

            {/* Photo gallery */}
            {galleryPhotos.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-gray-800 mb-3">Photos</h2>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {galleryPhotos.map((photo) => (
                    <a
                      key={photo.id}
                      href={photo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 group"
                    >
                      <div className="w-48 h-32 rounded-lg overflow-hidden border border-gray-200 group-hover:border-brand-400 transition-colors">
                        <img
                          src={photo.url}
                          alt={photo.caption ?? ''}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>
                      {photo.caption && (
                        <p className="mt-1 text-xs text-gray-400 w-48 truncate">{photo.caption}</p>
                      )}
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Reviews */}
            <section>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Reviews</h2>

              {/* Review form */}
              {user && !myReview && (
                <form onSubmit={submitReview} className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Write a review</h3>

                  {/* Star picker */}
                  <div className="flex gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        className={`text-2xl transition-colors ${
                          star <= reviewRating ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-300'
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Share your experience (optional)"
                    rows={3}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  />

                  {reviewError && (
                    <p className="mt-2 text-sm text-red-600">{reviewError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={reviewRating === 0 || reviewSubmitting}
                    className="mt-3 px-5 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {reviewSubmitting ? 'Submitting…' : 'Submit review'}
                  </button>
                </form>
              )}

              {/* Review list */}
              {reviews.length === 0 ? (
                <p className="text-gray-400 text-sm">No reviews yet. Be the first!</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div
                      key={review.id}
                      className="bg-white border border-gray-200 rounded-xl p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <AvatarInitial
                            username={review.profiles?.username ?? '?'}
                            avatarUrl={review.profiles?.avatar_url ?? null}
                          />
                          <div>
                            <p className="text-sm font-semibold text-gray-800">
                              {review.profiles?.username ?? 'Unknown'}
                            </p>
                            <p className="text-xs text-gray-400">{formatDate(review.created_at)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StarRating rating={review.rating} size="sm" />
                          {user && review.user_id === user.id && (
                            <button
                              onClick={() => deleteReview(review.id)}
                              className="text-xs text-red-400 hover:text-red-600 transition-colors"
                              title="Delete review"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="mt-3 text-sm text-gray-600 leading-relaxed">{review.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="mt-8">
              <QASection routeId={id!} />
            </div>
          </div>

          {/* ── RIGHT ──────────────────────────────────────────────────────── */}
          <div className="w-full lg:w-80 space-y-5 flex-shrink-0">

            {/* Stats card */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Route stats</h3>
              <div className="space-y-3">
                {/* Rating */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Rating</span>
                  <div className="flex items-center gap-1.5">
                    <StarRating rating={displayAvgRating} size="sm" />
                    <span className="text-sm text-gray-700 font-medium">
                      {displayAvgRating > 0 ? displayAvgRating.toFixed(1) : '—'}
                    </span>
                    <span className="text-xs text-gray-400">({route.review_count})</span>
                  </div>
                </div>

                {/* Distance */}
                {route.distance_km != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Distance</span>
                    <span className="text-sm font-medium text-gray-700">{route.distance_km} km</span>
                  </div>
                )}

                {/* Duration */}
                {route.duration_minutes != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Duration</span>
                    <span className="text-sm font-medium text-gray-700">{formatDuration(route.duration_minutes)}</span>
                  </div>
                )}

                {/* Difficulty */}
                {route.difficulty && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Difficulty</span>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${DIFFICULTY_COLORS[route.difficulty]}`}>
                      {route.difficulty}
                    </span>
                  </div>
                )}

                {/* Surface */}
                {route.surface && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Surface</span>
                    <span className="text-sm font-medium text-gray-700 capitalize">{route.surface}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Author card */}
            {route.profiles && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Posted by</h3>
                <div className="flex items-center gap-3">
                  <AvatarInitial
                    username={route.profiles.username}
                    avatarUrl={route.profiles.avatar_url}
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{route.profiles.username}</p>
                    <p className="text-xs text-gray-400">{formatDate(route.created_at)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Categories */}
            {categories.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Categories</h3>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat, i) => (
                    <span key={i} className="px-3 py-1 bg-brand-50 text-brand-700 text-xs font-medium rounded-full">
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tips */}
            {route.tips && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Tips</h3>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{route.tips}</p>
              </div>
            )}

            {/* Favourite button */}
            <button
              onClick={toggleFavourite}
              disabled={favLoading}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border transition-colors disabled:opacity-60 ${
                isFavourited
                  ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="text-lg">{isFavourited ? '♥' : '♡'}</span>
              {isFavourited ? 'Saved to favourites' : 'Add to favourites'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

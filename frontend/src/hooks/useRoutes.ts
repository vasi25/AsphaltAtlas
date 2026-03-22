import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Route } from '../types/database'

export interface RouteWithMeta extends Route {
  profiles: { username: string; avatar_url: string | null } | null
  countries: { name: string } | null
  regions: { name: string } | null
  photos: { url: string; is_cover: boolean }[]
  route_categories: { category_id: number }[]
}

interface Filters {
  search: string
  categoryId: number | null
  difficulty: string
  surface: string
}

export function useRoutes(filters: Filters) {
  const [routes, setRoutes] = useState<RouteWithMeta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetch() {
      setLoading(true)

      let query = supabase
        .from('routes')
        .select(`
          *,
          profiles!routes_user_id_fkey(username, avatar_url),
          countries(name),
          regions(name),
          photos(url, is_cover),
          route_categories(category_id)
        `)
        .eq('is_published', true)
        .order('created_at', { ascending: false })

      if (filters.search) query = query.ilike('title', `%${filters.search}%`)
      if (filters.difficulty) query = query.eq('difficulty', filters.difficulty)
      if (filters.surface) query = query.eq('surface', filters.surface)

      const { data, error } = await query

      if (cancelled) return

      if (error) {
        console.error('useRoutes error:', error)
        setLoading(false)
        return
      }

      let results = (data ?? []) as RouteWithMeta[]

      if (filters.categoryId) {
        results = results.filter(r =>
          r.route_categories.some(rc => rc.category_id === filters.categoryId)
        )
      }

      setRoutes(results)
      setLoading(false)
    }

    fetch()
    return () => { cancelled = true }
  }, [filters.search, filters.categoryId, filters.difficulty, filters.surface])

  return { routes, loading }
}

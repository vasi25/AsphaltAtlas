import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import RouteCard from '../components/RouteCard'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import AIOverviewButton from '../components/AIOverviewButton'
import type { RouteWithMeta } from '../hooks/useRoutes'

interface ReportRow {
  id: string
  reason: string
  created_at: string
  profiles: { username: string } | null
  routes: RouteWithMeta | null
}

const ROUTE_SELECT = `
  *,
  profiles!routes_user_id_fkey(username, avatar_url),
  countries(name),
  regions(name),
  photos(url, is_cover),
  route_categories(category_id)
`

function TabButton({ label, count, active, onClick }: { label: string; count: number | null; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        active ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {label} {count !== null && `(${count})`}
    </button>
  )
}

function EmptyState({ emoji, title, description }: { emoji: string; title: string; description: string }) {
  return (
    <div className="text-center py-16">
      <span className="text-5xl">{emoji}</span>
      <h3 className="mt-4 text-lg font-semibold text-gray-700">{title}</h3>
      <p className="mt-1 text-sm text-gray-400">{description}</p>
    </div>
  )
}

export default function AdminPanelPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'pending' | 'reported'>('pending')

  const [pendingRoutes, setPendingRoutes] = useState<RouteWithMeta[]>([])
  const [pendingLoading, setPendingLoading] = useState(true)

  const [reports, setReports] = useState<ReportRow[]>([])
  const [reportsLoading, setReportsLoading] = useState(true)

  const [actioningId, setActioningId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<RouteWithMeta | null>(null)

  function loadPending() {
    setPendingLoading(true)
    supabase
      .from('routes')
      .select(ROUTE_SELECT)
      .eq('moderation_status', 'pending')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setPendingRoutes((data ?? []) as unknown as RouteWithMeta[])
        setPendingLoading(false)
      })
  }

  function loadReports() {
    setReportsLoading(true)
    supabase
      .from('reports')
      .select(`
        id, reason, created_at,
        profiles!reports_user_id_fkey(username),
        routes!reports_route_id_fkey(${ROUTE_SELECT})
      `)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setReports((data ?? []) as unknown as ReportRow[])
        setReportsLoading(false)
      })
  }

  useEffect(() => {
    loadPending()
    loadReports()
  }, [])

  async function acceptRoute(routeId: string) {
    setActioningId(routeId)
    const { error } = await supabase
      .from('routes')
      .update({ moderation_status: 'approved', is_published: true })
      .eq('id', routeId)
    if (!error) setPendingRoutes((prev) => prev.filter((r) => r.id !== routeId))
    setActioningId(null)
  }

  async function confirmReject() {
    if (!rejectTarget) return
    const routeId = rejectTarget.id
    setActioningId(routeId)
    const { error } = await supabase.from('routes').delete().eq('id', routeId)
    if (!error) {
      setPendingRoutes((prev) => prev.filter((r) => r.id !== routeId))
      setRejectTarget(null)
    }
    setActioningId(null)
  }

  async function dismissReport(reportId: string) {
    setActioningId(reportId)
    const { error } = await supabase.from('reports').update({ status: 'dismissed' }).eq('id', reportId)
    if (!error) setReports((prev) => prev.filter((r) => r.id !== reportId))
    setActioningId(null)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-gray-500 text-sm mt-1">Review pending routes and user reports</p>
      </div>

      <div className="flex border-b border-gray-200 mb-6">
        <TabButton
          label="Pending routes"
          count={pendingLoading ? null : pendingRoutes.length}
          active={tab === 'pending'}
          onClick={() => setTab('pending')}
        />
        <TabButton
          label="Reported routes"
          count={reportsLoading ? null : reports.length}
          active={tab === 'reported'}
          onClick={() => setTab('reported')}
        />
      </div>

      {tab === 'pending' && (
        pendingLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 h-80 animate-pulse" />
            ))}
          </div>
        ) : pendingRoutes.length === 0 ? (
          <EmptyState emoji="✅" title="Nothing pending" description="No routes are waiting for review right now." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {pendingRoutes.map((route) => (
              <RouteCard
                key={route.id}
                route={route}
                footer={
                  <div className="space-y-2">
                    <AIOverviewButton
                      routeId={route.id}
                      initialVerdict={route.ai_overview}
                      initialCheckedAt={route.ai_overview_checked_at}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => acceptRoute(route.id)}
                        disabled={actioningId === route.id}
                        className="flex-1 py-2 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
                      >
                        ✓ Accept
                      </button>
                      <button
                        onClick={() => setRejectTarget(route)}
                        disabled={actioningId === route.id}
                        className="flex-1 py-2 rounded-lg text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 transition-colors"
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                }
              />
            ))}
          </div>
        )
      )}

      {tab === 'reported' && (
        reportsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 h-80 animate-pulse" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <EmptyState emoji="🚩" title="No open reports" description="Nothing has been reported by users right now." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {reports.map((report) => (
              report.routes && (
                <RouteCard
                  key={report.id}
                  route={report.routes}
                  footer={
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">
                        Reported by{' '}
                        <span className="font-medium text-gray-700">{report.profiles?.username ?? 'a user'}</span>
                      </p>
                      <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-2 leading-relaxed">
                        "{report.reason}"
                      </p>
                      <AIOverviewButton
                        routeId={report.routes.id}
                        initialVerdict={report.routes.ai_overview}
                        initialCheckedAt={report.routes.ai_overview_checked_at}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/routes/${report.routes!.id}`)}
                          className="flex-1 text-center py-2 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          View route
                        </button>
                        <button
                          onClick={() => dismissReport(report.id)}
                          disabled={actioningId === report.id}
                          className="flex-1 py-2 rounded-lg text-xs font-semibold bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-60 transition-colors"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  }
                />
              )
            ))}
          </div>
        )
      )}

      {rejectTarget && (
        <ConfirmDeleteModal
          title={`Reject "${rejectTarget.title}"?`}
          description="This will permanently remove the route and everything attached to it — photos, reviews, and questions. This cannot be undone."
          requireTyped={false}
          confirmLabel="Reject route"
          confirmingLabel="Rejecting…"
          confirming={actioningId === rejectTarget.id}
          onConfirm={confirmReject}
          onCancel={() => setRejectTarget(null)}
        />
      )}
    </div>
  )
}

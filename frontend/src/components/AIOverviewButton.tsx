import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { AIOverviewVerdict } from '../types/database'

interface Props {
  routeId: string
  initialVerdict: AIOverviewVerdict | null
  initialCheckedAt: string | null
}

const API_URL = import.meta.env.VITE_API_URL

function formatCheckedAt(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default function AIOverviewButton({ routeId, initialVerdict, initialCheckedAt }: Props) {
  const { session } = useAuth()
  const [loading, setLoading] = useState(false)
  const [verdict, setVerdict] = useState<AIOverviewVerdict | null>(initialVerdict)
  const [checkedAt, setCheckedAt] = useState<string | null>(initialCheckedAt)
  const [error, setError] = useState<string | null>(null)

  async function runOverview() {
    if (!session) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/moderation/routes/${routeId}/ai-overview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.detail ?? `Request failed (${res.status})`)
      }
      const { checked_at, ...result } = await res.json()
      setVerdict(result)
      setCheckedAt(checked_at)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={runOverview}
        disabled={loading}
        className="w-full py-2 rounded-lg text-xs font-semibold border border-purple-200 text-purple-700 hover:bg-purple-50 disabled:opacity-60 transition-colors"
      >
        {loading ? 'Analyzing…' : verdict ? '🤖 Re-run AI Overview' : '🤖 AI Overview'}
      </button>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {verdict && (
        <div
          className={`mt-2 rounded-lg px-2.5 py-2 text-xs leading-relaxed ${
            verdict.flagged ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">{verdict.flagged ? '⚠️ Flagged' : '✅ Looks fine'}</p>
            {checkedAt && (
              <span className="text-[10px] font-normal opacity-70 whitespace-nowrap">
                checked {formatCheckedAt(checkedAt)}
              </span>
            )}
          </div>
          <p className="mt-1">{verdict.summary}</p>
          {verdict.issues.length > 0 && (
            <ul className="mt-1.5 space-y-1 list-disc list-inside">
              {verdict.issues.map((issue, i) => (
                <li key={i}>
                  <span className="font-medium">{issue.category}:</span> {issue.detail}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

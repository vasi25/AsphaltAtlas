import { useState } from 'react'

interface Props {
  routeTitle: string
  submitting: boolean
  onSubmit: (reason: string) => void
  onCancel: () => void
}

export default function ReportRouteModal({ routeTitle, submitting, onSubmit, onCancel }: Props) {
  const [reason, setReason] = useState('')

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900">Report "{routeTitle}"</h2>
        <p className="mt-2 text-sm text-gray-500">
          Let us know what's wrong with this route — an admin will review it.
        </p>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explicit content, spam, incorrect information..."
          rows={4}
          autoFocus
          className="mt-3 w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(reason.trim())}
            disabled={!reason.trim() || submitting}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Reporting…' : 'Submit report'}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'

interface Props {
  title: string
  description: string
  confirmWord?: string
  confirmLabel?: string
  confirmingLabel?: string
  requireTyped?: boolean
  confirming: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDeleteModal({
  title,
  description,
  confirmWord = 'DELETE',
  confirmLabel = 'Delete route',
  confirmingLabel = 'Deleting…',
  requireTyped = true,
  confirming,
  onConfirm,
  onCancel,
}: Props) {
  const [value, setValue] = useState('')
  const canConfirm = !requireTyped || value === confirmWord

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="mt-2 text-sm text-gray-500">{description}</p>

        {requireTyped && (
          <>
            <p className="mt-4 text-sm text-gray-600">
              Type <span className="font-semibold text-gray-900">{confirmWord}</span> to confirm.
            </p>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={confirmWord}
              autoFocus
              className="mt-2 w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </>
        )}

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
            onClick={onConfirm}
            disabled={!canConfirm || confirming}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {confirming ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

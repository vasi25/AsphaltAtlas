import { useEffect, useCallback } from 'react'

interface Photo {
  id: string
  url: string
  caption: string | null
}

interface Props {
  photos: Photo[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
}

export default function Lightbox({ photos, index, onClose, onNavigate }: Props) {
  const photo = photos[index]
  const hasPrev = index > 0
  const hasNext = index < photos.length - 1

  const prev = useCallback(() => { if (hasPrev) onNavigate(index - 1) }, [hasPrev, index, onNavigate])
  const next = useCallback(() => { if (hasNext) onNavigate(index + 1) }, [hasNext, index, onNavigate])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, onClose])

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl leading-none z-10"
        aria-label="Close"
      >
        ✕
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
        {index + 1} / {photos.length}
      </div>

      {/* Photo + arrows */}
      <div
        className="relative flex items-center gap-3 max-w-5xl max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Prev */}
        <button
          onClick={(e) => { e.stopPropagation(); prev() }}
          disabled={!hasPrev}
          className="w-11 h-11 flex-shrink-0 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center text-xl transition-colors disabled:opacity-0 disabled:pointer-events-none"
          aria-label="Previous photo"
        >
          ‹
        </button>

        <div className="flex flex-col items-center gap-3 min-w-0">
          <img
            src={photo.url}
            alt={photo.caption ?? ''}
            className="max-h-[78vh] max-w-full object-contain rounded-lg shadow-2xl"
          />
          {photo.caption && (
            <p className="text-white/70 text-sm text-center">{photo.caption}</p>
          )}
        </div>

        {/* Next */}
        <button
          onClick={(e) => { e.stopPropagation(); next() }}
          disabled={!hasNext}
          className="w-11 h-11 flex-shrink-0 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center text-xl transition-colors disabled:opacity-0 disabled:pointer-events-none"
          aria-label="Next photo"
        >
          ›
        </button>
      </div>
    </div>
  )
}

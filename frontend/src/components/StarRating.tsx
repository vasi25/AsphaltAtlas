interface Props {
  rating: number
  max?: number
  size?: 'sm' | 'md'
}

export default function StarRating({ rating, max = 5, size = 'sm' }: Props) {
  const sz = size === 'sm' ? 'text-sm' : 'text-base'

  return (
    <span className={`inline-flex items-center gap-0.5 ${sz}`}>
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < Math.floor(rating)
        const half = !filled && i < rating

        return (
          <span key={i} className={filled || half ? 'text-yellow-400' : 'text-gray-300'}>
            {half ? '½' : '★'}
          </span>
        )
      })}
    </span>
  )
}

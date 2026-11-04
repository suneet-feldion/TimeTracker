type IconProps = { size?: number }

export function IconPlus({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 3.2v9.6M3.2 8h9.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function IconTrash({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3.5 4.5h9M6.2 4.4V3.2h3.6v1.2M5.2 4.5l.4 8h4.8l.4-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconGrip({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 16" aria-hidden="true">
      <g fill="currentColor">
        <circle cx="3.5" cy="3" r="1.1" />
        <circle cx="8.5" cy="3" r="1.1" />
        <circle cx="3.5" cy="8" r="1.1" />
        <circle cx="8.5" cy="8" r="1.1" />
        <circle cx="3.5" cy="13" r="1.1" />
        <circle cx="8.5" cy="13" r="1.1" />
      </g>
    </svg>
  )
}

export function IconChevron({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.2 6.2 8 10l3.8-3.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconArrow({ direction, size = 16 }: IconProps & { direction: 'left' | 'right' }) {
  const path = direction === 'left' ? 'M10 3.2 5.2 8 10 12.8' : 'M6 3.2 10.8 8 6 12.8'
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

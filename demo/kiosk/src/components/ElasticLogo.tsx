interface Props {
  size?: number
  variant?: 'mark' | 'horizontal'
  // Use the dark-background variant of the horizontal lockup (no white backing,
  // white wordmark). Defaults to true since the kiosk is always on dark.
  dark?: boolean
}

// Official Elastic brand assets live in /public:
//   /elastic-mark.svg                — petals only (square)
//   /elastic-horizontal.svg          — petals + "elastic" wordmark (light bg)
//   /elastic-horizontal-dark.svg     — same, retuned for dark surfaces
export function ElasticLogo({ size = 48, variant = 'mark', dark = true }: Props) {
  if (variant === 'horizontal') {
    const height = size
    const width = Math.round(size * (500 / 171.38))
    return (
      <img
        src={dark ? '/elastic-horizontal-dark.svg' : '/elastic-horizontal.svg'}
        alt="elastic"
        width={width}
        height={height}
        draggable={false}
      />
    )
  }
  return (
    <img
      src="/elastic-mark.svg"
      alt="Elastic"
      width={size}
      height={size}
      draggable={false}
    />
  )
}

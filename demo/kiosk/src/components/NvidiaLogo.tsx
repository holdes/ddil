interface Props {
  size?: number
  variant?: 'mark' | 'vertical'
}

// Official NVIDIA assets in /public:
//   /nvidia-mark.svg      — green eye only (~3:2 aspect)
//   /nvidia-vertical.svg  — eye + "NVIDIA" wordmark stacked (white wordmark for dark bg)
export function NvidiaLogo({ size = 36, variant = 'mark' }: Props) {
  if (variant === 'vertical') {
    // Vertical lockup viewBox is 260x232 → roughly 1.12:1
    const height = size
    const width = Math.round(size * (260 / 232))
    return (
      <img
        src="/nvidia-vertical.svg"
        alt="NVIDIA"
        width={width}
        height={height}
        draggable={false}
      />
    )
  }
  // Mark viewBox 135x100 → 1.35:1
  const height = size
  const width = Math.round(size * (135 / 100))
  return (
    <img
      src="/nvidia-mark.svg"
      alt="NVIDIA"
      width={width}
      height={height}
      draggable={false}
    />
  )
}

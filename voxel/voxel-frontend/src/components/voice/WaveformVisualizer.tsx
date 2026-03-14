'use client'

interface WaveformVisualizerProps {
  audioLevel?: number   // 0–100
  barCount?: number
  active?: boolean
  height?: number
}

export function WaveformVisualizer({
  audioLevel = 50,
  barCount   = 20,
  active     = true,
  height     = 64,
}: WaveformVisualizerProps) {
  return (
    <div
      className="flex items-end justify-center gap-1 w-full"
      style={{ height }}
      aria-hidden="true"
    >
      {Array.from({ length: barCount }).map((_, i) => {
        // Each bar gets a slightly different height based on position + audioLevel
        const wave   = Math.sin((i / barCount) * Math.PI * 2) * 0.5 + 0.5
        const barH   = active
          ? Math.max(6, (audioLevel * 0.4 * wave) + 6)
          : 4

        return (
          <div
            key={i}
            className="flex-1 rounded-full wave-bar"
            style={{
              height:           `${barH}px`,
              animationDelay:   active ? `${i * 0.06}s` : '0s',
              animationPlayState: active ? 'running' : 'paused',
              background:       active
                ? 'linear-gradient(to top, #0b9488, #5eead4)'
                : 'var(--border)',
              transition:       'height 0.1s ease',
            }}
          />
        )
      })}
    </div>
  )
}

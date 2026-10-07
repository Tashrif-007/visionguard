import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { ChevronsLeftRight } from 'lucide-react'

interface BeforeAfterSliderProps {
  beforeSrc: string
  afterSrc: string
  beforeLabel: string
  afterLabel: string
  alt: string
  // Rendered over both images (e.g. a camera HUD), beneath the divider.
  overlay?: ReactNode
}

const KEY_STEP = 5

const clamp = (value: number) => Math.min(100, Math.max(0, value))

// Two aligned images stacked; the "before" one is clipped to the left of a
// vertical divider that follows the cursor (or a drag on touch screens).
export function BeforeAfterSlider({ beforeSrc, afterSrc, beforeLabel, afterLabel, alt, overlay }: BeforeAfterSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(50)

  const moveTo = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    setPosition(clamp(((clientX - rect.left) / rect.width) * 100))
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    // Mouse follows on hover; touch/pen only while pressed, so the page can still scroll.
    if (e.pointerType === 'mouse' || e.buttons > 0) moveTo(e.clientX)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    moveTo(e.clientX)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') setPosition((p) => clamp(p - KEY_STEP))
    else if (e.key === 'ArrowRight') setPosition((p) => clamp(p + KEY_STEP))
    else if (e.key === 'Home') setPosition(0)
    else if (e.key === 'End') setPosition(100)
    else return
    e.preventDefault()
  }

  return (
    <div
      ref={containerRef}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      className="relative aspect-video cursor-ew-resize touch-pan-y select-none overflow-hidden rounded-lg border border-border bg-muted"
    >
      <img src={afterSrc} alt={`${alt} — ${afterLabel}`} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      <img
        src={beforeSrc}
        alt={`${alt} — ${beforeLabel}`}
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      />

      {overlay}

      <span className="pointer-events-none absolute left-4 top-4 label-mono rounded-sm bg-card/80 px-2 py-1 text-muted-foreground">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute right-4 top-4 label-mono rounded-sm bg-card/80 px-2 py-1 text-primary">
        {afterLabel}
      </span>

      <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.25)]" style={{ left: `${position}%` }}>
        <div
          role="slider"
          tabIndex={0}
          aria-label={`Comparison position: ${beforeLabel} to ${afterLabel}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(position)}
          onKeyDown={onKeyDown}
          className="pointer-events-auto absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-primary text-primary-foreground shadow-lg outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
        >
          <ChevronsLeftRight className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

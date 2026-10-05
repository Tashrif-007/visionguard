import { cn } from 'cn'

// The one purposeful animated element in the app — a pulsing "live" status
// dot, used in VideoFeed, CameraTile, and CameraChipBar.
export function LiveDot({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const dimension = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2'
  return (
    <span className={cn('relative flex shrink-0', dimension)}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
      <span className={cn('relative inline-flex rounded-full bg-success', dimension)} />
    </span>
  )
}

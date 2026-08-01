import { Video as VideoIcon } from 'lucide-react'
import { CameraTile } from '@/components/CameraTile'
import type { VideoSource } from '@/types'

export function CameraGrid({ cameras }: { cameras: VideoSource[] }) {
  if (cameras.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-sm border border-dashed border-[var(--border)] p-10 text-[var(--muted-foreground)]">
        <VideoIcon className="h-8 w-8" />
        <span className="text-sm">No active cameras — add one from the sidebar</span>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
      {cameras.map((camera) => (
        <CameraTile key={camera.id} camera={camera} />
      ))}
    </div>
  )
}

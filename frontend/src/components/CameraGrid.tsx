import { Video as VideoIcon } from 'lucide-react'
import { CameraTile } from '@/components/CameraTile'
import type { VideoSource } from '@/types'

export function CameraGrid({ cameras }: { cameras: VideoSource[] }) {
  if (cameras.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card p-10 text-muted-foreground">
        <VideoIcon className="h-8 w-8" />
        <span className="text-sm">No active cameras — use &ldquo;Add camera&rdquo; above to start one</span>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-3">
      {cameras.map((camera) => (
        <CameraTile key={camera.id} camera={camera} />
      ))}
    </div>
  )
}

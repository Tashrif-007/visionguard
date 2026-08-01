import { Square } from 'lucide-react'
import { VideoFeed } from '@/components/VideoFeed'
import { useStopCamera } from '@/hooks/useCamera'
import type { VideoSource } from '@/types'

const TYPE_LABELS: Record<string, string> = {
  webcam: 'Webcam',
  ip_camera: 'IP Camera',
  upload: 'Upload',
}

export function CameraTile({ camera }: { camera: VideoSource }) {
  const stopCamera = useStopCamera()

  return (
    <div className="group relative overflow-hidden rounded-sm border border-[var(--border)]">
      <VideoFeed sourceId={camera.id} />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-2 pt-8">
        <span className="flex min-w-0 items-center gap-1.5 truncate font-mono text-xs font-semibold uppercase tracking-wide text-white">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
          </span>
          <span className="truncate">{camera.name}</span>
        </span>
        <span className="pointer-events-auto flex shrink-0 items-center gap-1.5">
          <span className="rounded-sm border border-white/30 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white/80">
            {TYPE_LABELS[camera.source_type] ?? camera.source_type}
          </span>
          <button
            type="button"
            onClick={() => stopCamera.mutate(camera.id)}
            disabled={stopCamera.isPending}
            title="Stop camera"
            aria-label="Stop camera"
            className="flex h-6 w-6 items-center justify-center rounded-sm bg-black/50 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/80 focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Square className="h-3 w-3" />
          </button>
        </span>
      </div>
    </div>
  )
}

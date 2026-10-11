import { VideoFeed } from '@/components/VideoFeed'
import type { Camera } from '@/types'

/** Small live preview used in focus mode; clicking it makes that camera the focused one. */
export function CameraThumb({ camera, onSelect }: { camera: Camera; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      title={`Focus ${camera.name}`}
      className="relative block w-full overflow-hidden rounded-md border border-border text-left transition-colors hover:border-primary/60"
    >
      <VideoFeed cameraId={camera.id} />
      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-6 font-mono text-[11px] font-semibold uppercase tracking-wide text-white">
        {camera.name}
      </span>
    </button>
  )
}

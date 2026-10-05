import { useMemo } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { LiveDot } from '@/components/LiveDot'
import { cn } from 'cn'
import type { VideoSource } from '@/types'

const TYPE_LABELS: Record<string, string> = {
  webcam: 'Webcam',
  ip_camera: 'IP',
  upload: 'Upload',
}

export function CameraChipBar({
  cameras,
  search,
  onSearchChange,
  selectedId,
  onSelect,
}: {
  cameras: VideoSource[]
  search: string
  onSearchChange: (value: string) => void
  selectedId: number | null
  onSelect: (id: number | null) => void
}) {
  const filtered = useMemo(
    () => cameras.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase())),
    [cameras, search],
  )

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cn(
            'label-mono shrink-0 rounded-sm px-2.5 py-1.5 transition-colors',
            selectedId === null
              ? 'bg-primary font-medium text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground',
          )}
        >
          All sources ({cameras.length})
        </button>
        {filtered.map((camera) => (
          <button
            key={camera.id}
            type="button"
            onClick={() => onSelect(selectedId === camera.id ? null : camera.id)}
            className={cn(
              'label-mono flex shrink-0 items-center gap-2 rounded-sm px-2.5 py-1.5 transition-colors',
              selectedId === camera.id
                ? 'bg-primary font-medium text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            <LiveDot />
            <span className="max-w-[10rem] truncate">{camera.name}</span>
            <span className="opacity-70">{TYPE_LABELS[camera.source_type] ?? camera.source_type}</span>
          </button>
        ))}
        {cameras.length === 0 && (
          <span className="label-mono text-muted-foreground">No active cameras yet</span>
        )}
      </div>
      <div className="relative w-full shrink-0 lg:w-72">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search cameras…"
          className="h-8 pl-8 font-mono text-xs"
        />
      </div>
    </div>
  )
}

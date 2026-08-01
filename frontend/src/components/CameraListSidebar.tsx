import { useMemo } from 'react'
import { Plus, Search, Video as VideoIcon, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/utils/cn'
import type { VideoSource } from '@/types'

const GROUP_LABELS: Record<string, string> = {
  webcam: 'Webcams',
  ip_camera: 'IP Cameras',
  upload: 'Uploaded Videos',
}

function groupBySourceType(cameras: VideoSource[]): [string, VideoSource[]][] {
  const map = new Map<string, VideoSource[]>()
  for (const camera of cameras) {
    const group = map.get(camera.source_type) ?? []
    group.push(camera)
    map.set(camera.source_type, group)
  }
  return Array.from(map.entries())
}

export function CameraListSidebar({
  cameras,
  search,
  onSearchChange,
  selectedId,
  onSelect,
  isAddOpen,
  onAddClick,
}: {
  cameras: VideoSource[]
  search: string
  onSearchChange: (value: string) => void
  selectedId: number | null
  onSelect: (id: number | null) => void
  isAddOpen: boolean
  onAddClick: () => void
}) {
  const filtered = useMemo(
    () => cameras.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase())),
    [cameras, search],
  )
  const groups = useMemo(() => groupBySourceType(filtered), [filtered])

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)]">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Live Monitoring</h2>
          <p className="font-mono text-[11px] text-[var(--muted-foreground)]">
            {cameras.length} active source{cameras.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          onClick={onAddClick}
          title={isAddOpen ? 'Close' : 'Add camera'}
          aria-label={isAddOpen ? 'Close' : 'Add camera'}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
        >
          {isAddOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>

      <div className="shrink-0 border-b border-[var(--border)] p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search camera"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {cameras.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-[var(--muted-foreground)]">
            <VideoIcon className="h-6 w-6" />
            <span className="text-xs">No active cameras</span>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-[var(--muted-foreground)]">
            No cameras match &ldquo;{search}&rdquo;
          </p>
        ) : (
          groups.map(([type, list]) => (
            <div key={type} className="py-2">
              <p className="px-4 pb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                {GROUP_LABELS[type] ?? type}
              </p>
              {list.map((camera) => (
                <button
                  key={camera.id}
                  type="button"
                  onClick={() => onSelect(selectedId === camera.id ? null : camera.id)}
                  className={cn(
                    'flex w-full items-center gap-2 px-4 py-1.5 text-left text-xs transition-colors hover:bg-[var(--muted)]',
                    selectedId === camera.id && 'bg-[var(--primary)]/10 text-[var(--primary)]',
                  )}
                >
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                  </span>
                  <span className="truncate">{camera.name}</span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </aside>
  )
}

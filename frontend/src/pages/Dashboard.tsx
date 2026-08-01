import { useMemo, useState } from 'react'
import { LayoutGrid, Maximize2 } from 'lucide-react'
import { CameraGrid } from '@/components/CameraGrid'
import { CameraTile } from '@/components/CameraTile'
import { CameraControls } from '@/components/CameraControls'
import { CameraListSidebar } from '@/components/CameraListSidebar'
import { SystemStatusPanel } from '@/components/SystemStatusPanel'
import { Timeline } from '@/components/Timeline'
import { useActiveCameras } from '@/hooks/useCamera'
import { useEvents } from '@/hooks/useEvents'
import { cn } from '@/utils/cn'

type ViewMode = 'grid' | 'focus'

export function Dashboard() {
  const [showAddCamera, setShowAddCamera] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  const { data: cameras, isLoading } = useActiveCameras()
  const { data: recentEvents } = useEvents({ limit: 8 })

  const list = cameras ?? []
  const focusCamera = useMemo(() => list.find((c) => c.id === selectedId) ?? null, [list, selectedId])

  const handleSelect = (id: number | null) => {
    setSelectedId(id)
    if (id !== null) setViewMode('focus')
  }

  return (
    <div className="flex h-full">
      <CameraListSidebar
        cameras={list}
        search={search}
        onSearchChange={setSearch}
        selectedId={selectedId}
        onSelect={handleSelect}
        isAddOpen={showAddCamera}
        onAddClick={() => setShowAddCamera((v) => !v)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-6 py-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              {focusCamera ? focusCamera.name : 'All cameras'}
            </h2>
            <p className="font-mono text-sm">
              {list.length} active source{list.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex items-center rounded-sm border border-[var(--border)]">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Grid view"
              aria-label="Grid view"
              className={cn(
                'flex h-8 w-8 items-center justify-center transition-colors',
                viewMode === 'grid'
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]',
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => focusCamera && setViewMode('focus')}
              disabled={!focusCamera}
              title="Focus view"
              aria-label="Focus view"
              className={cn(
                'flex h-8 w-8 items-center justify-center border-l border-[var(--border)] transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                viewMode === 'focus'
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]',
              )}
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {showAddCamera && (
          <div className="shrink-0 border-b border-[var(--border)] bg-[var(--muted)]/40 px-6 py-4">
            <CameraControls onAdded={() => setShowAddCamera(false)} />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <p className="text-sm text-[var(--muted-foreground)]">Loading cameras…</p>
          ) : viewMode === 'focus' && focusCamera ? (
            <div className="mx-auto max-w-4xl">
              <CameraTile camera={focusCamera} />
            </div>
          ) : (
            <CameraGrid cameras={list} />
          )}
        </div>
      </div>

      <aside className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l border-[var(--border)] bg-[var(--card)] xl:flex">
        <div className="shrink-0 border-b border-[var(--border)] p-4">
          <SystemStatusPanel />
        </div>
        <div className="p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Recent events
          </h2>
          <Timeline events={recentEvents?.events ?? []} />
        </div>
      </aside>
    </div>
  )
}

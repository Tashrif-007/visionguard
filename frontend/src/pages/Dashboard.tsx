import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, History, LayoutGrid, Maximize2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { CameraChipBar } from '@/components/CameraChipBar'
import { CameraControls } from '@/components/CameraControls'
import { CameraGrid } from '@/components/CameraGrid'
import { CameraTile } from '@/components/CameraTile'
import { LiveDot } from '@/components/LiveDot'
import { RecentEventsStrip } from '@/components/RecentEventsStrip'
import { useActiveCameras } from '@/hooks/useCamera'
import { useEvents } from '@/hooks/useEvents'
import { cn } from 'cn'

type ViewMode = 'grid' | 'focus'

function ViewToggleButton({
  active,
  disabled,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  icon: typeof LayoutGrid
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`${label} view`}
      aria-label={`${label} view`}
      aria-pressed={active}
      className={cn(
        'label-mono flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        active
          ? 'bg-secondary text-primary shadow-[0_0_12px_color-mix(in_oklab,var(--primary)_20%,transparent)]'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

export function Dashboard() {
  const [addCameraOpen, setAddCameraOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  const { data: cameras, isLoading } = useActiveCameras()
  const { data: recentEvents } = useEvents({ limit: 10 })

  const list = cameras ?? []
  const focusCamera = useMemo(() => list.find((c) => c.id === selectedId) ?? null, [list, selectedId])

  const handleSelect = (id: number | null) => {
    setSelectedId(id)
    if (id !== null) setViewMode('focus')
  }

  return (
    <div className="flex h-full flex-col gap-3 p-5">
      {/* Control deck — title, view mode, add-camera action, camera filter */}
      <section className="flex shrink-0 flex-col gap-3 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <LiveDot size="md" />
            <h2 className="text-sm font-semibold uppercase tracking-wider">Live monitoring</h2>
            <span className="label-mono rounded-sm bg-muted px-2 py-0.5 text-muted-foreground">
              {list.length} active source{list.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
              <ViewToggleButton
                active={viewMode === 'grid'}
                onClick={() => setViewMode('grid')}
                icon={LayoutGrid}
                label="Grid"
              />
              <ViewToggleButton
                active={viewMode === 'focus'}
                disabled={!focusCamera}
                onClick={() => focusCamera && setViewMode('focus')}
                icon={Maximize2}
                label="Focus"
              />
            </div>
            <Button size="sm" onClick={() => setAddCameraOpen(true)}>
              <Plus className="h-4 w-4" />
              Add camera
            </Button>
          </div>
        </div>

        <CameraChipBar
          cameras={list}
          search={search}
          onSearchChange={setSearch}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </section>

      <Dialog open={addCameraOpen} onOpenChange={setAddCameraOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a camera</DialogTitle>
            <DialogDescription>Start a live feed from a webcam, RTSP URL, or upload a video file.</DialogDescription>
          </DialogHeader>
          <CameraControls onAdded={() => setAddCameraOpen(false)} />
        </DialogContent>
      </Dialog>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading cameras…</p>
        ) : viewMode === 'focus' && focusCamera ? (
          <div className="mx-auto max-w-4xl">
            <CameraTile camera={focusCamera} />
          </div>
        ) : (
          <CameraGrid cameras={list} />
        )}
      </div>

      {/* Recent events dock */}
      <section className="shrink-0 rounded-lg border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
            <History className="h-4 w-4 text-primary" />
            Recent events
          </h2>
          <Link to="/events" className="label-mono flex items-center gap-1 text-primary hover:underline">
            View all events
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <RecentEventsStrip events={recentEvents?.events ?? []} />
      </section>
    </div>
  )
}

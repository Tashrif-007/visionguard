import { useMemo, useState } from 'react'
import { EvidenceInspector } from '@/components/EvidenceInspector'
import { SearchBar } from '@/components/SearchBar'
import { Timeline, cameraLabel } from '@/components/Timeline'
import { useCameras } from '@/hooks/useCamera'
import { useEvents } from '@/hooks/useEvents'
import { useEventSearch } from '@/hooks/useEventSearch'

export function EventsPage() {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const isSearching = query.trim().length > 0

  const [cameraId, setCameraId] = useState<number | null>(null)

  const camerasQuery = useCameras()
  const cameraNames = useMemo(
    () => new Map((camerasQuery.data ?? []).map((camera) => [camera.id, camera.name])),
    [camerasQuery.data],
  )

  const eventsQuery = useEvents({ limit: 100, camera_id: cameraId ?? undefined })
  const searchQuery = useEventSearch(query)

  // The search endpoint has no camera filter, so narrow its results here.
  const searchEvents = (searchQuery.data?.events ?? []).filter(
    (event) => cameraId === null || event.camera_id === cameraId,
  )
  const events = (isSearching ? searchEvents : eventsQuery.data?.events) ?? []
  const total = isSearching ? searchEvents.length : eventsQuery.data?.total
  const isLoading = isSearching ? searchQuery.isLoading : eventsQuery.isLoading

  // Fall back to the newest event so the inspector is never empty when there is data.
  const selected = events.find((event) => event.id === selectedId) ?? events[0] ?? null

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-5 lg:overflow-hidden">
      <section className="shrink-0 rounded-lg border border-border bg-card p-3">
        <SearchBar
          value={query}
          onChange={setQuery}
          parsedFilters={searchQuery.data?.parsed_filters}
          resultLabel={
            typeof total === 'number'
              ? `${total} ${isSearching ? 'result' : 'event'}${total === 1 ? '' : 's'}`
              : undefined
          }
        />
      </section>

      <div className="flex shrink-0 flex-wrap gap-2">
        {[{ id: null, name: 'All cameras' }, ...(camerasQuery.data ?? [])].map((camera) => (
          <button
            key={camera.id ?? 'all'}
            type="button"
            onClick={() => setCameraId(camera.id)}
            aria-pressed={cameraId === camera.id}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              cameraId === camera.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:border-primary/50'
            }`}
          >
            {camera.name}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-12">
        <div className="lg:col-span-5 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          {isLoading ? (
            <p className="py-4 text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Timeline
              events={events}
              cameraNames={cameraNames}
              groupByCamera={cameraId === null}
              selectedId={selected?.id ?? null} onSelect={setSelectedId}
            />
          )}
        </div>
        <div className="lg:col-span-7 lg:min-h-0 lg:overflow-y-auto">
          <EvidenceInspector
            event={selected}
            cameraName={selected ? cameraLabel(cameraNames, selected.camera_id) : undefined}
          />
        </div>
      </div>
    </div>
  )
}

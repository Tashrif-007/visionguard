import { useState } from 'react'
import { EvidenceInspector } from '@/components/EvidenceInspector'
import { SearchBar } from '@/components/SearchBar'
import { Timeline } from '@/components/Timeline'
import { useEvents } from '@/hooks/useEvents'
import { useEventSearch } from '@/hooks/useEventSearch'

export function EventsPage() {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const isSearching = query.trim().length > 0

  const eventsQuery = useEvents({ limit: 100 })
  const searchQuery = useEventSearch(query)

  const events = (isSearching ? searchQuery.data?.events : eventsQuery.data?.events) ?? []
  const total = isSearching ? searchQuery.data?.total : eventsQuery.data?.total
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

      <div className="grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-12">
        <div className="lg:col-span-5 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          {isLoading ? (
            <p className="py-4 text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Timeline events={events} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
          )}
        </div>
        <div className="lg:col-span-7 lg:min-h-0 lg:overflow-y-auto">
          <EvidenceInspector event={selected} />
        </div>
      </div>
    </div>
  )
}

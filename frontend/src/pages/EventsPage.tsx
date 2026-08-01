import { useState } from 'react'
import { SearchBar } from '@/components/SearchBar'
import { Timeline } from '@/components/Timeline'
import { useEvents } from '@/hooks/useEvents'
import { useEventSearch } from '@/hooks/useEventSearch'

export function EventsPage() {
  const [query, setQuery] = useState('')
  const isSearching = query.trim().length > 0

  const eventsQuery = useEvents({ limit: 100 })
  const searchQuery = useEventSearch(query)

  const events = isSearching ? searchQuery.data?.events : eventsQuery.data?.events
  const total = isSearching ? searchQuery.data?.total : eventsQuery.data?.total
  const isLoading = isSearching ? searchQuery.isLoading : eventsQuery.isLoading

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-[var(--border)] px-6 py-3">
        <SearchBar value={query} onChange={setQuery} parsedFilters={searchQuery.data?.parsed_filters} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6">
        <div className="flex items-center justify-between border-b border-[var(--border)] py-2">
          <span className="font-mono text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
            {isSearching ? 'Search results' : 'All events'}
            {typeof total === 'number' ? ` (${total})` : ''}
          </span>
        </div>
        {isLoading ? (
          <p className="py-4 text-sm text-[var(--muted-foreground)]">Loading…</p>
        ) : (
          <Timeline events={events ?? []} />
        )}
      </div>
    </div>
  )
}

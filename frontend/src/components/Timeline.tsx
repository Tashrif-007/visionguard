import { EventListItem } from '@/components/EventListItem'
import type { Event } from '@/types'

export function Timeline({ events }: { events: Event[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">No events found.</p>
  }

  return (
    <div className="flex flex-col divide-y divide-[var(--border)]">
      {events.map((event) => (
        <EventListItem key={event.id} event={event} />
      ))}
    </div>
  )
}

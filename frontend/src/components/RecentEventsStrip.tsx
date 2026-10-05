import { Link } from 'react-router-dom'
import { EventThumb } from '@/components/EventThumb'
import { formatRelative } from '@/utils/format'
import type { Event } from '@/types'

export function RecentEventsStrip({ events }: { events: Event[] }) {
  if (events.length === 0) {
    return <p className="label-mono text-muted-foreground">No events logged yet.</p>
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {events.map((event) => (
        <Link
          key={event.id}
          to="/events"
          className="flex shrink-0 gap-2.5 rounded-md border border-border bg-muted p-2 transition-colors hover:border-primary/50"
        >
          <EventThumb event={event} className="h-12 w-20" />
          <span className="flex flex-col justify-center gap-1">
            <span className="label-mono font-semibold text-foreground">{event.event_type}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{formatRelative(event.timestamp)}</span>
          </span>
        </Link>
      ))}
    </div>
  )
}

import { Badge } from '@/components/ui/badge'
import type { Event } from '@/types'
import { formatRelative, formatTimestamp } from '@/utils/format'
import { snapshotUrl } from '@/utils/urls'

export function EventListItem({ event }: { event: Event }) {
  return (
    <a
      href={snapshotUrl(event.image_path)}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 py-2.5 transition-colors hover:bg-[var(--muted)]"
    >
      <img
        src={snapshotUrl(event.image_path)}
        alt={`${event.event_type} event snapshot`}
        className="h-12 w-16 shrink-0 rounded-sm border border-[var(--border)] bg-[var(--muted)] object-cover"
        loading="lazy"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{event.event_type}</Badge>
          <span className="font-mono text-xs text-[var(--muted-foreground)]">
            {formatRelative(event.timestamp)}
          </span>
        </div>
        <div className="truncate font-mono text-[11px] text-[var(--muted-foreground)]">
          {formatTimestamp(event.timestamp)} · ROI {event.roi_width}×{event.roi_height} @ ({event.roi_x},{' '}
          {event.roi_y})
        </div>
      </div>
    </a>
  )
}

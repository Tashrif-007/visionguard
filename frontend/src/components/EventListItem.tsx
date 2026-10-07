import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { EventThumb } from "@/components/EventThumb";
import { useSnapshotObjectUrl } from "@/hooks/useSnapshotObjectUrl";
import type { Event } from "@/types";
import { formatRelative, formatTimestamp } from "@/utils/format";

export function EventListItem({
  event,
  actions,
}: {
  event: Event;
  actions?: ReactNode;
}) {
  // Separate fetch of the same cached query, purely to get an href for
  // "open full size" — EventThumb already renders the image itself.
  const { objectUrl } = useSnapshotObjectUrl(event.id);

  return (
    <TableRow>
      <TableCell>
        <a href={objectUrl ?? undefined} target="_blank" rel="noreferrer">
          <EventThumb event={event} className="h-12 w-16" />
        </a>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{event.event_type}</Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
        {formatTimestamp(event.timestamp)}
        <div>{formatRelative(event.timestamp)}</div>
      </TableCell>
      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
        {event.roi_width}×{event.roi_height} @ ({event.roi_x}, {event.roi_y})
        {event.roi_area_ratio !== null && (
          <div>{(event.roi_area_ratio * 100).toFixed(1)}% of frame</div>
        )}
      </TableCell>
      {actions && <TableCell className="text-right">{actions}</TableCell>}
    </TableRow>
  );
}

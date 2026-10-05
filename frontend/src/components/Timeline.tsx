import { CalendarDays, Film } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EventThumb } from "@/components/EventThumb";
import { cn } from "cn";
import { formatTime, groupByDay } from "@/utils/format";
import type { Event } from "@/types";

function EventCard({
  event,
  selected,
  onSelect,
}: {
  event: Event;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full gap-3 rounded-lg border bg-card p-2.5 text-left transition-colors",
        selected
          ? "border-primary shadow-[0_0_12px_color-mix(in_oklab,var(--primary)_20%,transparent)]"
          : "border-border hover:border-primary/50",
      )}
    >
      <EventThumb event={event} className="h-16 w-24" />
      <span className="flex min-w-0 flex-1 flex-col justify-between gap-1">
        <span className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <Badge variant={selected ? "default" : "outline"}>
              {event.event_type}
            </Badge>
            {event.has_clip && (
              <Badge variant="muted">
                <Film className="h-3 w-3" />
                Clip
              </Badge>
            )}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {formatTime(event.timestamp)}
          </span>
        </span>
        <span className="font-mono text-[11px] text-foreground">
          x:{event.roi_x} · y:{event.roi_y} · {event.roi_width}×
          {event.roi_height}
        </span>
        <span className="label-mono text-muted-foreground">
          Source #{event.source_id}
          {event.frame_number !== null && ` · Frame #${event.frame_number}`}
        </span>
      </span>
    </button>
  );
}

export function Timeline({
  events,
  selectedId,
  onSelect,
}: {
  events: Event[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  if (events.length === 0) {
    return (
      <p className="py-6 text-sm text-muted-foreground">No events found.</p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {groupByDay(events, (event) => event.timestamp).map((group) => (
        <section key={group.key} className="flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
              {group.label}
            </h3>
            <span className="label-mono text-muted-foreground">
              {group.items.length} event{group.items.length === 1 ? "" : "s"}
            </span>
          </div>
          {group.items.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              selected={event.id === selectedId}
              onSelect={() => onSelect(event.id)}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

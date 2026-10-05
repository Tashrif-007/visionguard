import { useState } from "react";
import { ExternalLink, ImageOff, ScanSearch } from "lucide-react";
import { EventClipPlayer } from "@/components/EventClipPlayer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSnapshotObjectUrl } from "@/hooks/useSnapshotObjectUrl";
import { formatRelative, formatTimestamp } from "@/utils/format";
import type { Event } from "@/types";

interface FrameSize {
  width: number;
  height: number;
}

// Snapshots are the full frame, so the ROI can be drawn from its pixel
// coordinates as percentages of the image's natural size. The brackets sit on
// top of video, so they use fixed sky colour rather than a themed one.
function RoiBox({ event, frame }: { event: Event; frame: FrameSize }) {
  const corner = "absolute h-3 w-3 border-[#7bd0ff]";
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: `${(event.roi_x / frame.width) * 100}%`,
        top: `${(event.roi_y / frame.height) * 100}%`,
        width: `${(event.roi_width / frame.width) * 100}%`,
        height: `${(event.roi_height / frame.height) * 100}%`,
      }}
    >
      <span className={`${corner} left-0 top-0 border-l-2 border-t-2`} />
      <span className={`${corner} right-0 top-0 border-r-2 border-t-2`} />
      <span className={`${corner} bottom-0 left-0 border-b-2 border-l-2`} />
      <span className={`${corner} bottom-0 right-0 border-b-2 border-r-2`} />
      <span className="absolute -top-5 left-0 whitespace-nowrap rounded-t-sm bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-[#7bd0ff]">
        ROI {event.roi_width}×{event.roi_height}
      </span>
    </div>
  );
}

function InspectorBody({ event }: { event: Event }) {
  const { objectUrl, isError } = useSnapshotObjectUrl(event.id);
  const [frame, setFrame] = useState<FrameSize | null>(null);
  const [view, setView] = useState<"video" | "frame">(event.has_clip ? "video" : "frame");

  const rows: [string, string][] = [
    ["Event type", event.event_type],
    [
      "Timestamp",
      `${formatTimestamp(event.timestamp)} (${formatRelative(event.timestamp)})`,
    ],
    ["Source", `#${event.source_id}`],
    [
      "ROI",
      `x:${event.roi_x} · y:${event.roi_y} · ${event.roi_width}×${event.roi_height}`,
    ],
  ];
  if (event.roi_area_ratio !== null)
    rows.push([
      "Coverage",
      `${(event.roi_area_ratio * 100).toFixed(1)}% of frame`,
    ]);
  if (event.frame_number !== null)
    rows.push(["Frame", `#${event.frame_number}`]);

  return (
    <>
      {event.has_clip && (
        <div className="flex gap-1 border-b border-border p-2">
          {(["video", "frame"] as const).map((v) => (
            <Button
              key={v}
              type="button"
              size="sm"
              variant={view === v ? "secondary" : "ghost"}
              onClick={() => setView(v)}
            >
              {v === "video" ? "Video clip" : "Snapshot"}
            </Button>
          ))}
        </div>
      )}
      <div className="flex min-h-48 items-center justify-center bg-black">
        {view === "video" && event.has_clip ? (
          <div className="w-full">
            <EventClipPlayer eventId={event.id} />
          </div>
        ) : objectUrl && !isError ? (
          <div className="relative w-fit max-w-full">
            <img
              src={objectUrl}
              alt={`${event.event_type} event snapshot`}
              className="block max-h-[55vh] w-auto max-w-full"
              onLoad={(e) =>
                setFrame({
                  width: e.currentTarget.naturalWidth,
                  height: e.currentTarget.naturalHeight,
                })
              }
            />
            {frame && <RoiBox event={event} frame={frame} />}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 py-12 text-white/60">
            <ImageOff className="h-8 w-8" />
            <span className="label-mono">Snapshot unavailable</span>
          </div>
        ) : (
          <Skeleton className="h-48 w-full rounded-none" />
        )}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 p-4 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="label-mono self-center text-muted-foreground">
              {label}
            </dt>
            <dd className="font-mono text-xs text-foreground">{value}</dd>
          </div>
        ))}
      </dl>

      {objectUrl && (
        <div className="border-t border-border p-3">
          <Button variant="outline" size="sm" asChild>
            <a href={objectUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Open full size
            </a>
          </Button>
        </div>
      )}
    </>
  );
}

export function EvidenceInspector({ event }: { event: Event | null }) {
  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
          <ScanSearch className="h-4 w-4 text-primary" />
          Evidence inspector
        </h2>
        {event && <Badge variant="muted">Event #{event.id}</Badge>}
      </header>
      {event ? (
        // key remounts the body per event so the previous snapshot never lingers
        <InspectorBody key={event.id} event={event} />
      ) : (
        <p className="p-6 text-center text-sm text-muted-foreground">
          Select an event to inspect it.
        </p>
      )}
    </section>
  );
}

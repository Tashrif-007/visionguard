import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCameraConfig, useSaveZones } from "@/hooks/useCameraConfig";
import { useLiveFrameUrl } from "@/hooks/useLiveFrameUrl";
import type { ZoneMode, ZoneWrite } from "@/types";

type Point = [number, number];

// Include = green, exclude = red; fixed colours since they sit on top of video.
const MODE_STYLE: Record<ZoneMode, { stroke: string; fill: string }> = {
  include: { stroke: "#4ade80", fill: "rgba(74,222,128,0.22)" },
  exclude: { stroke: "#f87171", fill: "rgba(248,113,113,0.25)" },
};

function toSvgPoints(points: Point[]): string {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

function errorDetail(error: unknown): string {
  return (
    (error as { response?: { data?: { detail?: string } } } | null)?.response
      ?.data?.detail ?? "Could not save zones"
  );
}

export function ZoneEditor({
  cameraId,
  live,
}: {
  cameraId: number;
  /** Only a running camera has frames to draw over. */
  live: boolean;
}) {
  const { data: config } = useCameraConfig(cameraId);
  const saveZones = useSaveZones(cameraId);
  const frameUrl = useLiveFrameUrl(cameraId, live);

  const [zones, setZones] = useState<ZoneWrite[]>([]);
  const [draft, setDraft] = useState<Point[]>([]);
  const [mode, setMode] = useState<ZoneMode>("exclude");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (config && !dirty) {
      setZones(
        config.zones.map(({ name, mode: m, points }) => ({
          name,
          mode: m,
          points,
        })),
      );
    }
  }, [config, dirty]);

  const addPoint = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setDraft((points) => [...points, [x, y]]);
  };

  const finishZone = () => {
    if (draft.length < 3) return;
    setZones((current) => [
      ...current,
      {
        name: `${mode === "include" ? "Include" : "Exclude"} ${current.length + 1}`,
        mode,
        points: draft,
      },
    ]);
    setDraft([]);
    setDirty(true);
  };

  const removeZone = (index: number) => {
    setZones((current) => current.filter((_, i) => i !== index));
    setDirty(true);
  };

  const handleSave = () => {
    saveZones.mutate(zones, {
      onSuccess: () => {
        setDirty(false);
        toast.success("Zones saved — applied to the live feed");
      },
      onError: (error) => toast.error(errorDetail(error)),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Click the image to outline an area, then finish the zone. <b>Include</b>{" "}
        zones limit detection to that area; <b>exclude</b> zones ignore it
        (trees, roads, sky).
      </p>

      <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-md bg-black">
        {frameUrl ? (
          <img
            src={frameUrl}
            alt="Camera view"
            className="block max-h-[45vh] w-auto max-w-full"
          />
        ) : (
          <div className="flex h-48 w-80 items-center justify-center text-xs text-white/60">
            {live
              ? "Waiting for frames…"
              : "Start the camera to draw over its live view"}
          </div>
        )}
        <svg
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full cursor-crosshair"
          onClick={addPoint}
        >
          {zones.map((zone, i) => (
            <polygon
              key={i}
              points={toSvgPoints(zone.points as Point[])}
              fill={MODE_STYLE[zone.mode].fill}
              stroke={MODE_STYLE[zone.mode].stroke}
              strokeWidth={0.006}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {draft.length > 0 && (
            <polyline
              points={toSvgPoints(draft)}
              fill="none"
              stroke={MODE_STYLE[mode].stroke}
              strokeWidth={2}
              strokeDasharray="6 4"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {draft.map(([x, y], i) => (
          <span
            key={i}
            className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-2 ring-black/60"
            style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-md border border-border">
          {(["exclude", "include"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-1 text-xs font-medium capitalize ${
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={finishZone}
          disabled={draft.length < 3}
        >
          Finish zone ({draft.length} pts)
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setDraft([])}
          disabled={draft.length === 0}
        >
          Clear drawing
        </Button>
      </div>

      {zones.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {zones.map((zone, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-md border border-border px-2 py-1"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ background: MODE_STYLE[zone.mode].stroke }}
                aria-hidden
              />
              <Input
                value={zone.name}
                maxLength={64}
                onChange={(e) => {
                  const name = e.target.value;
                  setZones((current) =>
                    current.map((z, idx) => (idx === i ? { ...z, name } : z)),
                  );
                  setDirty(true);
                }}
                className="h-7 flex-1 border-0 bg-transparent px-1 text-xs shadow-none"
                aria-label="Zone name"
              />
              <span className="label-mono text-muted-foreground">
                {zone.mode}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => removeZone(i)}
                aria-label={`Delete ${zone.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        onClick={handleSave}
        disabled={!dirty || saveZones.isPending}
        className="w-full sm:w-fit"
      >
        {saveZones.isPending ? "Saving…" : "Save zones"}
      </Button>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveCameras } from "@/hooks/useCamera";
import { useEventStats } from "@/hooks/useEventStats";
import type { EventStats } from "@/types";

const RANGES = [
  { label: "Last 24 hours", hours: 24 },
  { label: "Last 7 days", hours: 24 * 7 },
  { label: "Last 30 days", hours: 24 * 30 },
  { label: "All time", hours: 0 },
] as const;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SELECT_CLASS =
  "h-8 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <span className="label-mono text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

interface Bar {
  label: string;
  value: number;
}

function VerticalBars({
  bars,
  labelEvery = 1,
}: {
  bars: Bar[];
  labelEvery?: number;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="flex h-40 items-end gap-1">
      {bars.map((bar, i) => (
        <div
          key={`${bar.label}-${i}`}
          className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1"
        >
          <div
            className="mx-auto w-full max-w-10 rounded-t-sm bg-primary/80"
            style={{
              height: `${(bar.value / max) * 100}%`,
              minHeight: bar.value > 0 ? 2 : 0,
            }}
            title={`${bar.label}: ${bar.value}`}
          />
          <span className="h-3 truncate text-center font-mono text-[9px] text-muted-foreground">
            {i % labelEvery === 0 ? bar.label : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function HorizontalBars({ bars }: { bars: Bar[] }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  if (bars.length === 0)
    return <p className="text-sm text-muted-foreground">No data.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {bars.map((bar, i) => (
        <li key={`${bar.label}-${i}`} className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 truncate" title={bar.label}>
            {bar.label}
          </span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${(bar.value / max) * 100}%` }}
            />
          </span>
          <span className="w-10 shrink-0 text-right font-mono">
            {bar.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Heatmap({ stats }: { stats: EventStats }) {
  const counts = new Map(
    stats.heatmap.map((c) => [`${c.weekday}-${c.hour}`, c.count]),
  );
  const max = Math.max(1, ...stats.heatmap.map((c) => c.count));
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[560px] grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-0.5 text-[9px]">
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="text-center font-mono text-muted-foreground">
            {h % 3 === 0 ? h : ""}
          </span>
        ))}
        {WEEKDAYS.map((day, weekday) => (
          <div key={day} className="contents">
            <span className="self-center font-mono text-muted-foreground">
              {day}
            </span>
            {Array.from({ length: 24 }, (_, hour) => {
              const count = counts.get(`${weekday}-${hour}`) ?? 0;
              return (
                <span
                  key={hour}
                  title={`${day} ${hour}:00 — ${count} event${count === 1 ? "" : "s"}`}
                  className="aspect-square rounded-[2px] bg-primary"
                  style={{
                    opacity: count === 0 ? 0.07 : 0.2 + 0.8 * (count / max),
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const [rangeHours, setRangeHours] = useState<number>(24 * 7);
  const [sourceId, setSourceId] = useState<number | undefined>(undefined);
  const { data: cameras } = useActiveCameras();

  // Computed once per selection so the query key stays stable between renders.
  // Timestamps are stored as naive UTC, so send naive UTC (no trailing Z).
  const fromTs = useMemo(
    () =>
      rangeHours === 0
        ? undefined
        : new Date(Date.now() - rangeHours * 3_600_000)
            .toISOString()
            .slice(0, -1),
    [rangeHours],
  );
  const {
    data: stats,
    isLoading,
    isError,
  } = useEventStats({ source_id: sourceId, from_ts: fromTs });

  const perHour = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, h) => ({
      label: String(h),
      value: 0,
    }));
    stats?.heatmap.forEach((c) => (hours[c.hour].value += c.count));
    return hours;
  }, [stats]);

  const busiestHour = perHour.reduce(
    (best, h) => (h.value > best.value ? h : best),
    perHour[0],
  );
  const topCamera = stats?.per_camera[0];

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={SELECT_CLASS}
            value={rangeHours}
            onChange={(e) => setRangeHours(Number(e.target.value))}
            aria-label="Time range"
          >
            {RANGES.map((r) => (
              <option key={r.label} value={r.hours}>
                {r.label}
              </option>
            ))}
          </select>
          <select
            className={SELECT_CLASS}
            value={sourceId ?? ""}
            onChange={(e) =>
              setSourceId(
                e.target.value === "" ? undefined : Number(e.target.value),
              )
            }
            aria-label="Camera"
          >
            <option value="">All cameras</option>
            {cameras?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {isError && (
          <p className="text-sm text-destructive">Could not load analytics.</p>
        )}
        {isLoading && <Skeleton className="h-64 w-full" />}

        {stats && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Kpi label="Total events" value={String(stats.total)} />
              <Kpi
                label="Busiest hour"
                value={busiestHour.value > 0 ? `${busiestHour.label}:00` : "—"}
                hint={
                  busiestHour.value > 0
                    ? `${busiestHour.value} events`
                    : undefined
                }
              />
              <Kpi
                label="Most active camera"
                value={topCamera ? topCamera.name : "—"}
                hint={topCamera ? `${topCamera.count} events` : undefined}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Events per day">
                {stats.per_day.length > 0 ? (
                  <VerticalBars
                    bars={stats.per_day.map((d) => ({
                      label: d.date.slice(5),
                      value: d.count,
                    }))}
                    labelEvery={Math.max(
                      1,
                      Math.ceil(stats.per_day.length / 8),
                    )}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No events in this range.
                  </p>
                )}
              </ChartCard>
              <ChartCard title="Events by hour of day">
                <VerticalBars bars={perHour} labelEvery={3} />
              </ChartCard>
            </div>

            <ChartCard title="Busiest times (weekday × hour)">
              <Heatmap stats={stats} />
            </ChartCard>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Events per camera">
                <HorizontalBars
                  bars={stats.per_camera.map((c) => ({
                    label: c.name,
                    value: c.count,
                  }))}
                />
              </ChartCard>
              <ChartCard title="Motion size (share of frame)">
                <HorizontalBars
                  bars={stats.coverage.map((c) => ({
                    label: c.label,
                    value: c.count,
                  }))}
                />
              </ChartCard>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

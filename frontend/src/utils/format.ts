// The API sends event timestamps as naive UTC (no "Z"), which `new Date` would
// read as local time. Treat a timestamp without an offset as UTC.
function parseUtc(iso: string): Date {
  return new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`);
}

export function formatTimestamp(iso: string): string {
  return parseUtc(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

export function formatTime(iso: string): string {
  return parseUtc(iso).toLocaleTimeString(undefined, { timeStyle: "medium" });
}

function startOfDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

function formatDayLabel(date: Date): string {
  const dayDiff = Math.round(
    (startOfDay(new Date()) - startOfDay(date)) / 86_400_000,
  );
  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export interface DayGroup<T> {
  key: string;
  label: string;
  items: T[];
}

// Groups items under their local calendar day, keeping the incoming order
// (the API returns events newest-first, so groups come out newest-first too).
export function groupByDay<T>(
  items: T[],
  getIso: (item: T) => string,
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const date = parseUtc(getIso(item));
    const key = String(startOfDay(date));
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(item);
    } else {
      groups.push({ key, label: formatDayLabel(date), items: [item] });
    }
  }
  return groups;
}

export function formatRelative(iso: string): string {
  const diffMs = Date.now() - parseUtc(iso).getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.round(diffHour / 24);
  return `${diffDay}d ago`;
}

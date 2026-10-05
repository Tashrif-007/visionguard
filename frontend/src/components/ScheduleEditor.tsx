import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCameraConfig, useSaveSchedule } from "@/hooks/useCameraConfig";
import { cn } from "cn";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const toInput = (time: string): string => time.slice(0, 5); // "HH:MM:SS" -> "HH:MM"
const toApi = (time: string): string =>
  time.length === 5 ? `${time}:00` : time;

export function ScheduleEditor({ sourceId }: { sourceId: number }) {
  const { data: config } = useCameraConfig(sourceId);
  const saveSchedule = useSaveSchedule(sourceId);

  const [enabled, setEnabled] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>(ALL_DAYS);
  const [start, setStart] = useState("22:00");
  const [end, setEnd] = useState("06:00");

  useEffect(() => {
    const schedule = config?.schedule;
    if (!schedule) return;
    setEnabled(schedule.enabled);
    setWeekdays(schedule.weekdays);
    setStart(toInput(schedule.start_time));
    setEnd(toInput(schedule.end_time));
  }, [config?.schedule]);

  const toggleDay = (day: number) =>
    setWeekdays((current) =>
      current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day],
    );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSchedule.mutate(
      { enabled, weekdays, start_time: toApi(start), end_time: toApi(end) },
      {
        onSuccess: () => toast.success("Schedule saved"),
        onError: (error) =>
          toast.error(
            (error as { response?: { data?: { detail?: string } } } | null)
              ?.response?.data?.detail ?? "Could not save schedule",
          ),
      },
    );
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <p className="text-sm text-muted-foreground">
        Detection and event logging only run inside this window. Outside it the
        camera keeps streaming but is
        <b> disarmed</b>. An end time earlier than the start spans midnight.
      </p>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4"
        />
        Use a schedule (otherwise always armed)
      </label>

      <div className="flex flex-col gap-1.5">
        <Label>Days</Label>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((label, day) => (
            <button
              key={label}
              type="button"
              onClick={() => toggleDay(day)}
              aria-pressed={weekdays.includes(day)}
              className={cn(
                "h-8 w-12 rounded-md border text-xs font-medium transition-colors",
                weekdays.includes(day)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="schedule-start">Armed from</Label>
          <Input
            id="schedule-start"
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="schedule-end">Until</Label>
          <Input
            id="schedule-end"
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            required
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={saveSchedule.isPending || weekdays.length === 0}
        className="w-full sm:w-fit"
      >
        {saveSchedule.isPending ? "Saving…" : "Save schedule"}
      </Button>
    </form>
  );
}

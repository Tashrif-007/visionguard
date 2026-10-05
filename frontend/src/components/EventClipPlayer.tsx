import { Film, Loader2 } from "lucide-react";
import { useEventClipObjectUrl } from "@/hooks/useEventClip";

export function EventClipPlayer({ eventId }: { eventId: number }) {
  const { objectUrl, isError } = useEventClipObjectUrl(eventId);

  if (objectUrl) {
    return (
      <video
        src={objectUrl}
        controls
        autoPlay
        muted
        loop
        playsInline
        className="block max-h-[55vh] w-full bg-black"
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 py-12 text-white/60">
      {isError ? (
        <Film className="h-8 w-8" />
      ) : (
        <Loader2 className="h-8 w-8 animate-spin" />
      )}
      <span className="label-mono">
        {isError ? "Clip unavailable" : "Clip is still being recorded…"}
      </span>
    </div>
  );
}

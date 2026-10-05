import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { useQuery } from "@tanstack/react-query";
import * as eventsApi from "@/api/eventsApi";

const CLIP_NOT_READY = 404;
const MAX_RETRIES = 12;

// The clip is written a few seconds after the event is logged (post-roll), so a
// 404 right after an event means "not ready yet" — retry for a while before giving up.
export function useEventClipObjectUrl(eventId: number) {
  const { data: blob, isError } = useQuery({
    queryKey: ["event-clip", eventId],
    queryFn: () => eventsApi.fetchClip(eventId),
    staleTime: Infinity,
    retry: (count, error) =>
      isAxiosError(error) &&
      error.response?.status === CLIP_NOT_READY &&
      count < MAX_RETRIES,
    retryDelay: 1500,
  });
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  return { objectUrl, isError };
}

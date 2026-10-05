import { useEffect, useRef, useState } from "react";
import { useEventSnapshot } from "@/hooks/useEvents";

// Shared by EventThumb (used in both the vertical timeline and the
// dashboard's horizontal strip) — fetches an event snapshot as an
// authenticated blob and manages the object-URL lifecycle (same
// revoke-on-replace/unmount pattern as VideoFeed's live frame).
export function useSnapshotObjectUrl(eventId: number) {
  const { data: blob, isError } = useEventSnapshot(eventId);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const previousUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    if (previousUrl.current) URL.revokeObjectURL(previousUrl.current);
    previousUrl.current = url;
    setObjectUrl(url);
  }, [blob]);

  useEffect(
    () => () => {
      if (previousUrl.current) URL.revokeObjectURL(previousUrl.current);
    },
    [],
  );

  return { objectUrl, isError };
}

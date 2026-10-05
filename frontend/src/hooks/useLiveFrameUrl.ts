import { useEffect, useRef, useState } from "react";
import { useLiveFrame } from "@/hooks/useCamera";

// Object URL for the latest live frame; revokes the previous URL on each
// replacement and on unmount (same lifecycle as VideoFeed).
export function useLiveFrameUrl(sourceId: number): string | null {
  const { data: blob } = useLiveFrame(sourceId, true);
  const [url, setUrl] = useState<string | null>(null);
  const previous = useRef<string | null>(null);

  useEffect(() => {
    if (!blob) return;
    const next = URL.createObjectURL(blob);
    if (previous.current) URL.revokeObjectURL(previous.current);
    previous.current = next;
    setUrl(next);
  }, [blob]);

  useEffect(
    () => () => {
      if (previous.current) URL.revokeObjectURL(previous.current);
    },
    [],
  );

  return url;
}

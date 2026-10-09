import { Square } from "lucide-react";
import { LiveDot } from "@/components/LiveDot";
import { CameraConfigDialog } from "@/components/CameraConfigDialog";
import { VideoFeed } from "@/components/VideoFeed";
import { useStopCamera } from "@/hooks/useCamera";
import { useCameraConfig } from "@/hooks/useCameraConfig";
import type { Camera } from "@/types";

const TYPE_LABELS: Record<string, string> = {
  webcam: "Webcam",
  ip_camera: "IP Camera",
  upload: "Upload",
  browser: "Browser",
};

export function CameraTile({ camera }: { camera: Camera }) {
  const stopCamera = useStopCamera();
  const { data: config } = useCameraConfig(camera.id);

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-card">
      <VideoFeed cameraId={camera.id} />

      {/* Fixed light-on-dark colours: this overlay sits on top of video, not on a themed surface. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/85 to-transparent p-2.5 pt-10">
        <span className="flex min-w-0 items-center gap-1.5 truncate font-mono text-xs font-semibold uppercase tracking-wide text-white">
          <LiveDot />
          <span className="truncate">{camera.name}</span>
        </span>
        <span className="pointer-events-auto flex shrink-0 items-center gap-1.5">
          {config && !config.armed && (
            <span className="label-mono rounded-sm bg-amber-500/80 px-1.5 py-0.5 text-black">
              Disarmed
            </span>
          )}
          {config && config.zones.length > 0 && (
            <span className="label-mono rounded-sm bg-black/50 px-1.5 py-0.5 text-white/80 backdrop-blur-sm">
              {config.zones.length} zone{config.zones.length > 1 ? "s" : ""}
            </span>
          )}
          <span className="label-mono rounded-sm bg-black/50 px-1.5 py-0.5 text-white/80 backdrop-blur-sm">
            {TYPE_LABELS[camera.source_type] ?? camera.source_type}
          </span>
          <CameraConfigDialog camera={camera} />
          <button
            type="button"
            onClick={() => stopCamera.mutate(camera.id)}
            disabled={stopCamera.isPending}
            title="Stop this camera (it stays saved under Cameras)"
            aria-label="Stop camera"
            className="label-mono flex h-6 items-center gap-1 rounded-sm bg-black/50 px-1.5 text-white backdrop-blur-sm transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            <Square className="h-3 w-3" />
            Stop
          </button>
        </span>
      </div>
    </div>
  );
}

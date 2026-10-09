import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Play, Search, SlidersHorizontal, Square, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BrowserCameraCard } from "@/components/BrowserCameraCard";
import { CameraConfigDialog } from "@/components/CameraConfigDialog";
import { CameraEditDialog } from "@/components/CameraEditDialog";
import { RegisterCameraForm } from "@/components/RegisterCameraForm";
import { useBrowserStream } from "@/hooks/useBrowserStream";
import {
  useCameras,
  useDeleteCamera,
  useStartCamera,
  useStopCamera,
} from "@/hooks/useCamera";
import type { Camera, CameraStatus } from "@/types";

const TYPE_LABELS: Record<string, string> = {
  webcam: "Webcam",
  ip_camera: "IP Camera",
  upload: "Upload",
  browser: "Browser",
};

const STATUS_BADGES: Record<
  CameraStatus,
  { label: string; variant: "success" | "muted" | "warning" | "destructive" }
> = {
  running: { label: "Running", variant: "success" },
  stopped: { label: "Stopped", variant: "muted" },
  ended: { label: "Finished", variant: "muted" },
  offline: { label: "Offline", variant: "warning" },
  error: { label: "Error", variant: "destructive" },
};

function errorDetail(error: unknown): string | undefined {
  return (error as { response?: { data?: { detail?: string } } } | null)
    ?.response?.data?.detail;
}

function CameraActions({ camera }: { camera: Camera }) {
  const startCamera = useStartCamera();
  const stopCamera = useStopCamera();
  const deleteCamera = useDeleteCamera();
  const browserStream = useBrowserStream();
  const running = camera.status === "running";

  const toggle = () => {
    if (!running && camera.source_type === "browser") {
      browserStream
        .start(camera.id)
        .then(() => toast.success(`${camera.name} started`))
        .catch((error: unknown) =>
          toast.error(error instanceof Error ? error.message : "Could not start camera"),
        );
      return;
    }
    const mutation = running ? stopCamera : startCamera;
    mutation.mutate(camera.id, {
      onSuccess: () =>
        toast.success(`${camera.name} ${running ? "stopped" : "started"}`),
      onError: (error) =>
        toast.error(errorDetail(error) ?? "Could not change camera state"),
    });
  };

  return (
    <div className="flex justify-end gap-1.5">
      <Button
        type="button"
        size="sm"
        variant={running ? "outline" : "default"}
        disabled={startCamera.isPending || stopCamera.isPending}
        onClick={toggle}
      >
        {running ? (
          <Square className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
        {running ? "Stop" : "Start"}
      </Button>
      <CameraConfigDialog
        camera={camera}
        trigger={
          <Button
            type="button"
            variant="outline"
            size="sm"
            title="Detection zones & schedule"
            aria-label={`Configure ${camera.name}`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </Button>
        }
      />
      <CameraEditDialog camera={camera} />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            title="Delete camera"
            aria-label={`Delete ${camera.name}`}
            disabled={deleteCamera.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {camera.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The camera is stopped and removed from this list. Its recorded
              events stay on the timeline, and adding the same source again
              restores it with its zones and schedule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteCamera.mutate(camera.id, {
                  onSuccess: () => toast.success(`${camera.name} deleted`),
                  onError: (error) =>
                    toast.error(errorDetail(error) ?? "Could not delete camera"),
                })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function CamerasPage() {
  const [search, setSearch] = useState("");
  const { data: cameras, isLoading } = useCameras();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (cameras ?? []).filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.source_uri.toLowerCase().includes(q),
    );
  }, [cameras, search]);
  const runningCount = (cameras ?? []).filter(
    (c) => c.status === "running",
  ).length;

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto grid w-full max-w-7xl gap-4 lg:grid-cols-12 lg:items-start">
        <div className="flex flex-col gap-4 lg:col-span-4">
          <RegisterCameraForm />
          <BrowserCameraCard />
        </div>

        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle>Saved cameras</CardTitle>
            <CardDescription>
              {cameras?.length ?? 0} camera{cameras?.length === 1 ? "" : "s"}{" "}
              · {runningCount} running
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="relative max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or source"
                className="h-8 pl-8 font-mono text-xs"
              />
            </div>

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading cameras…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {cameras?.length
                  ? <>No cameras match &ldquo;{search}&rdquo;</>
                  : "No cameras yet — add one on the left."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Camera</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((camera) => {
                    const badge = STATUS_BADGES[camera.status];
                    return (
                      <TableRow key={camera.id}>
                        <TableCell className="max-w-[18rem]">
                          <div className="truncate font-medium">
                            {camera.name}
                          </div>
                          <div
                            className="truncate font-mono text-[11px] text-muted-foreground"
                            title={camera.source_uri}
                          >
                            {camera.source_uri}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {TYPE_LABELS[camera.source_type] ??
                              camera.source_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <CameraActions camera={camera} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

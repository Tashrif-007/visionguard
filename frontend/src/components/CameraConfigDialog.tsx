import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { ScheduleEditor } from "@/components/ScheduleEditor";
import { ZoneEditor } from "@/components/ZoneEditor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Camera } from "@/types";

export function CameraConfigDialog({
  camera,
  trigger,
}: {
  camera: Camera;
  /** Custom trigger; defaults to the compact button used over a video tile. */
  trigger?: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            title="Detection zones & schedule"
            aria-label="Configure camera"
            className="label-mono flex h-6 items-center gap-1 rounded-sm bg-black/50 px-1.5 text-white backdrop-blur-sm transition-colors hover:bg-primary"
          >
            <SlidersHorizontal className="h-3 w-3" />
            Configure
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{camera.name}</DialogTitle>
          <DialogDescription>
            Choose where and when motion is detected for this camera.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="zones" className="gap-4">
          <TabsList className="w-full">
            <TabsTrigger value="zones">Zones</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
          </TabsList>
          <TabsContent value="zones">
            <ZoneEditor cameraId={camera.id} live={camera.status === "running"} />
          </TabsContent>
          <TabsContent value="schedule">
            <ScheduleEditor cameraId={camera.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

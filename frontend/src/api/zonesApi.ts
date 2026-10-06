import client from "@/api/client";
import type { CameraConfig, ScheduleConfig, ZoneWrite } from "@/types";

export const getCameraConfig = async (
  cameraId: number,
): Promise<CameraConfig> =>
  (await client.get<CameraConfig>(`/cameras/${cameraId}/config`)).data;

export const saveZones = async (
  cameraId: number,
  zones: ZoneWrite[],
): Promise<CameraConfig> =>
  (await client.put<CameraConfig>(`/cameras/${cameraId}/zones`, zones)).data;

export const saveSchedule = async (
  cameraId: number,
  schedule: ScheduleConfig,
): Promise<CameraConfig> =>
  (await client.put<CameraConfig>(`/cameras/${cameraId}/schedule`, schedule))
    .data;

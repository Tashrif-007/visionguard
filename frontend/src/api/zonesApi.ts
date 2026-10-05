import client from "@/api/client";
import type { CameraConfig, ScheduleConfig, ZoneWrite } from "@/types";

export const getCameraConfig = async (
  sourceId: number,
): Promise<CameraConfig> =>
  (await client.get<CameraConfig>(`/cameras/${sourceId}/config`)).data;

export const saveZones = async (
  sourceId: number,
  zones: ZoneWrite[],
): Promise<CameraConfig> =>
  (await client.put<CameraConfig>(`/cameras/${sourceId}/zones`, zones)).data;

export const saveSchedule = async (
  sourceId: number,
  schedule: ScheduleConfig,
): Promise<CameraConfig> =>
  (await client.put<CameraConfig>(`/cameras/${sourceId}/schedule`, schedule))
    .data;

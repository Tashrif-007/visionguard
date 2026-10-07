import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as zonesApi from "@/api/zonesApi";
import type { ScheduleConfig, ZoneWrite } from "@/types";

const configKey = (cameraId: number) => ["camera-config", cameraId];

export function useCameraConfig(cameraId: number) {
  return useQuery({
    queryKey: configKey(cameraId),
    queryFn: () => zonesApi.getCameraConfig(cameraId),
    // armed/disarmed flips with the clock, so re-check periodically
    refetchInterval: 30_000,
  });
}

export function useSaveZones(cameraId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (zones: ZoneWrite[]) => zonesApi.saveZones(cameraId, zones),
    onSuccess: (config) =>
      queryClient.setQueryData(configKey(cameraId), config),
  });
}

export function useSaveSchedule(cameraId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (schedule: ScheduleConfig) =>
      zonesApi.saveSchedule(cameraId, schedule),
    onSuccess: (config) =>
      queryClient.setQueryData(configKey(cameraId), config),
  });
}

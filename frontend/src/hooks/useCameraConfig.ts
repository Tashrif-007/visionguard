import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as zonesApi from "@/api/zonesApi";
import type { ScheduleConfig, ZoneWrite } from "@/types";

const configKey = (sourceId: number) => ["camera-config", sourceId];

export function useCameraConfig(sourceId: number) {
  return useQuery({
    queryKey: configKey(sourceId),
    queryFn: () => zonesApi.getCameraConfig(sourceId),
    // armed/disarmed flips with the clock, so re-check periodically
    refetchInterval: 30_000,
  });
}

export function useSaveZones(sourceId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (zones: ZoneWrite[]) => zonesApi.saveZones(sourceId, zones),
    onSuccess: (config) =>
      queryClient.setQueryData(configKey(sourceId), config),
  });
}

export function useSaveSchedule(sourceId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (schedule: ScheduleConfig) =>
      zonesApi.saveSchedule(sourceId, schedule),
    onSuccess: (config) =>
      queryClient.setQueryData(configKey(sourceId), config),
  });
}

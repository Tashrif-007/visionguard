import { useQuery } from "@tanstack/react-query";
import * as eventsApi from "@/api/eventsApi";
import type { EventStatsParams } from "@/api/eventsApi";

export function useEventStats(params: EventStatsParams) {
  return useQuery({
    queryKey: ["event-stats", params],
    queryFn: () => eventsApi.getEventStats(params),
  });
}

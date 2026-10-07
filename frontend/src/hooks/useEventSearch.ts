import { useQuery } from "@tanstack/react-query";
import * as eventsApi from "@/api/eventsApi";

export function useEventSearch(query: string) {
  return useQuery({
    queryKey: ["events", "search", query],
    queryFn: () => eventsApi.searchEvents(query),
    enabled: query.trim().length > 0,
  });
}

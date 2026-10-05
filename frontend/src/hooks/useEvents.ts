import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as eventsApi from "@/api/eventsApi";
import type { ListEventsParams } from "@/api/eventsApi";

export function useEvents(params: ListEventsParams = {}) {
  return useQuery({
    queryKey: ["events", params],
    queryFn: () => eventsApi.listEvents(params),
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: number) => eventsApi.deleteEvent(eventId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useEventSnapshot(eventId: number) {
  return useQuery({
    queryKey: ["event-snapshot", eventId],
    queryFn: () => eventsApi.fetchSnapshot(eventId),
    staleTime: Infinity, // a stored event's image never changes
    retry: false,
  });
}

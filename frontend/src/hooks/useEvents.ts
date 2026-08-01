import { useQuery } from '@tanstack/react-query'
import * as eventsApi from '@/api/eventsApi'
import type { ListEventsParams } from '@/api/eventsApi'

export function useEvents(params: ListEventsParams = {}) {
  return useQuery({
    queryKey: ['events', params],
    queryFn: () => eventsApi.listEvents(params),
  })
}

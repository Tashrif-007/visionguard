import client from "@/api/client";
import type { EventListResponse, EventStats, SearchResponse } from "@/types";

export interface ListEventsParams {
  source_id?: number;
  event_type?: string;
  from_ts?: string;
  to_ts?: string;
  limit?: number;
  offset?: number;
}

export const listEvents = async (
  params: ListEventsParams = {},
): Promise<EventListResponse> =>
  (await client.get<EventListResponse>("/events", { params })).data;

export const searchEvents = async (
  q: string,
  limit = 50,
  offset = 0,
): Promise<SearchResponse> =>
  (
    await client.get<SearchResponse>("/events/search", {
      params: { q, limit, offset },
    })
  ).data;

export const fetchSnapshot = async (eventId: number): Promise<Blob> =>
  (
    await client.get<Blob>(`/events/${eventId}/snapshot`, {
      responseType: "blob",
    })
  ).data;

export const deleteEvent = async (eventId: number): Promise<void> => {
  await client.delete(`/events/${eventId}`);
};

export const fetchClip = async (eventId: number): Promise<Blob> =>
  (await client.get<Blob>(`/events/${eventId}/clip`, { responseType: "blob" }))
    .data;

export interface EventStatsParams {
  source_id?: number;
  from_ts?: string;
  to_ts?: string;
}

export const getEventStats = async (
  params: EventStatsParams = {},
): Promise<EventStats> =>
  (await client.get<EventStats>("/events/stats", { params })).data;

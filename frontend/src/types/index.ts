export type UserRole = 'admin' | 'operator'

export interface User {
  id: number
  username: string
  role: UserRole
  created_at: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface UserCreateRequest {
  username: string
  password: string
  role: UserRole
}

export interface VideoSource {
  id: number
  name: string
  source_type: string
  source_uri: string
  is_active: boolean
  created_by: number | null
  created_at: string
}

export interface StartCameraRequest {
  name?: string | null
  source_uri?: string | null
}

export interface Event {
  id: number
  source_id: number
  event_type: string
  timestamp: string
  image_path: string
  roi_x: number
  roi_y: number
  roi_width: number
  roi_height: number
  frame_number: number | null
  created_at: string
}

export interface EventListResponse {
  events: Event[]
  total: number
}

export interface ParsedFilters {
  from_ts: string | null
  to_ts: string | null
  event_type: string | null
}

export interface SearchResponse {
  query: string
  parsed_filters: ParsedFilters
  events: Event[]
  total: number
}

export interface SystemStatus {
  status: string
  database: string
  pipeline: string
}

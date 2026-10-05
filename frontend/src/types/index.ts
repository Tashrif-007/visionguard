export type UserRole = 'admin' | 'operator'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface UserCreateRequest {
  name: string
  email: string
  password: string
  role: UserRole
}

export interface ProfileUpdateRequest {
  name: string
  email: string
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
  roi_area_ratio: number | null
  frame_number: number | null
  has_clip: boolean
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

export type ZoneMode = 'include' | 'exclude'

export interface ZoneWrite {
  name: string
  mode: ZoneMode
  /** Normalized [x, y] points in 0..1 */
  points: [number, number][]
}

export interface Zone extends ZoneWrite {
  id: number
}

export interface ScheduleConfig {
  enabled: boolean
  /** 0 = Monday .. 6 = Sunday */
  weekdays: number[]
  /** "HH:MM:SS" */
  start_time: string
  end_time: string
}

export interface CameraConfig {
  source_id: number
  zones: Zone[]
  schedule: ScheduleConfig | null
  armed: boolean
}

export interface DayCount {
  date: string
  count: number
}

export interface CameraCount {
  source_id: number
  name: string
  count: number
}

export interface HeatmapCell {
  weekday: number
  hour: number
  count: number
}

export interface CoverageBucket {
  label: string
  count: number
}

export interface EventStats {
  total: number
  per_day: DayCount[]
  per_camera: CameraCount[]
  heatmap: HeatmapCell[]
  coverage: CoverageBucket[]
}

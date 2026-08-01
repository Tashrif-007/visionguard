import client from '@/api/client'
import type { SystemStatus } from '@/types'

export const getSystemStatus = async (): Promise<SystemStatus> =>
  (await client.get<SystemStatus>('/system/status')).data

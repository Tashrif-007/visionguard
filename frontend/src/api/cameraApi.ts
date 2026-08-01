import client from '@/api/client'
import type { StartCameraRequest, VideoSource } from '@/types'

export const listCameras = async (): Promise<VideoSource[]> =>
  (await client.get<VideoSource[]>('/cameras')).data

export const startCamera = async (request: StartCameraRequest): Promise<VideoSource> =>
  (await client.post<VideoSource>('/start-camera', request)).data

export const stopCamera = async (sourceId: number): Promise<VideoSource> =>
  (await client.post<VideoSource>(`/stop-camera/${sourceId}`)).data

export const uploadVideo = async (file: File): Promise<VideoSource> => {
  const form = new FormData()
  form.append('file', file)
  return (
    await client.post<VideoSource>('/upload-video', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  ).data
}

export const fetchFrame = async (sourceId: number): Promise<Blob> =>
  (await client.get<Blob>(`/frame/${sourceId}`, { responseType: 'blob' })).data

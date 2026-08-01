import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as cameraApi from '@/api/cameraApi'
import type { StartCameraRequest } from '@/types'

const CAMERAS_KEY = ['cameras']
const SYSTEM_STATUS_KEY = ['system', 'status']

export function useActiveCameras() {
  return useQuery({
    queryKey: CAMERAS_KEY,
    queryFn: cameraApi.listCameras,
    refetchInterval: 4000,
  })
}

export function useStartCamera() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: StartCameraRequest) => cameraApi.startCamera(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CAMERAS_KEY })
      void queryClient.invalidateQueries({ queryKey: SYSTEM_STATUS_KEY })
    },
  })
}

export function useStopCamera() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sourceId: number) => cameraApi.stopCamera(sourceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CAMERAS_KEY })
      void queryClient.invalidateQueries({ queryKey: SYSTEM_STATUS_KEY })
    },
  })
}

export function useUploadVideo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => cameraApi.uploadVideo(file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CAMERAS_KEY })
      void queryClient.invalidateQueries({ queryKey: SYSTEM_STATUS_KEY })
    },
  })
}

export function useLiveFrame(sourceId: number, enabled: boolean) {
  return useQuery({
    queryKey: ['frame', sourceId],
    queryFn: () => cameraApi.fetchFrame(sourceId),
    enabled,
    refetchInterval: 120,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })
}

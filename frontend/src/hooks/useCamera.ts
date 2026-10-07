import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as cameraApi from "@/api/cameraApi";
import type { CameraCreate, CameraUpdate } from "@/types";

const CAMERAS_KEY = ["cameras"];
const SYSTEM_STATUS_KEY = ["system", "status"];

/** Every saved camera with its live status (polled, since a file can end or a stream drop). */
export function useCameras() {
  return useQuery({
    queryKey: CAMERAS_KEY,
    queryFn: cameraApi.listCameras,
    refetchInterval: 4000,
  });
}

function useCameraMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: CAMERAS_KEY });
      void queryClient.invalidateQueries({ queryKey: SYSTEM_STATUS_KEY });
    },
  });
}

export function useRegisterCamera() {
  return useCameraMutation((request: CameraCreate) =>
    cameraApi.registerCamera(request),
  );
}

/** Register a new camera and start it straight away (the dashboard's quick add). */
export function useAddAndStartCamera() {
  return useCameraMutation(async (request: CameraCreate) => {
    const camera = await cameraApi.registerCamera(request);
    return cameraApi.startCamera(camera.id);
  });
}

export function useUpdateCamera() {
  return useCameraMutation(
    ({ cameraId, request }: { cameraId: number; request: CameraUpdate }) =>
      cameraApi.updateCamera(cameraId, request),
  );
}

export function useDeleteCamera() {
  return useCameraMutation((cameraId: number) =>
    cameraApi.deleteCamera(cameraId),
  );
}

export function useStartCamera() {
  return useCameraMutation((cameraId: number) =>
    cameraApi.startCamera(cameraId),
  );
}

export function useStopCamera() {
  return useCameraMutation((cameraId: number) =>
    cameraApi.stopCamera(cameraId),
  );
}

export function useUploadVideo() {
  return useCameraMutation((file: File) => cameraApi.uploadVideo(file));
}

export function useLiveFrame(cameraId: number, enabled: boolean) {
  return useQuery({
    queryKey: ["frame", cameraId],
    queryFn: () => cameraApi.fetchFrame(cameraId),
    enabled,
    refetchInterval: 120,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

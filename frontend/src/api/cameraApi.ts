import client from "@/api/client";
import type { Camera, CameraCreate, CameraUpdate } from "@/types";

export const listCameras = async (): Promise<Camera[]> =>
  (await client.get<Camera[]>("/cameras")).data;

export const registerCamera = async (request: CameraCreate): Promise<Camera> =>
  (await client.post<Camera>("/cameras", request)).data;

export const updateCamera = async (
  cameraId: number,
  request: CameraUpdate,
): Promise<Camera> =>
  (await client.patch<Camera>(`/cameras/${cameraId}`, request)).data;

export const deleteCamera = async (cameraId: number): Promise<void> => {
  await client.delete(`/cameras/${cameraId}`);
};

export const startCamera = async (cameraId: number): Promise<Camera> =>
  (await client.post<Camera>(`/cameras/${cameraId}/start`)).data;

export const stopCamera = async (cameraId: number): Promise<Camera> =>
  (await client.post<Camera>(`/cameras/${cameraId}/stop`)).data;

export const uploadVideo = async (file: File): Promise<Camera> => {
  const form = new FormData();
  form.append("file", file);
  return (
    await client.post<Camera>("/upload-video", form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
  ).data;
};

export const fetchFrame = async (cameraId: number): Promise<Blob> =>
  (
    await client.get<Blob>(`/cameras/${cameraId}/frame`, {
      responseType: "blob",
    })
  ).data;

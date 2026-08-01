const API_URL = import.meta.env.VITE_API_URL as string

// image_path is stored as "snapshots/<uuid>.jpg" and the backend mounts that
// same "snapshots" directory at the "/snapshots" static path, so the stored
// path already lines up with the URL — no extra prefix needed.
export function snapshotUrl(imagePath: string): string {
  return `${API_URL}/${imagePath}`
}

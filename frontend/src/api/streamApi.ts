import { getToken } from "@/api/client";

/** Frame size, rate and quality a browser camera streams to the backend. */
export const STREAM_WIDTH = 640;
export const STREAM_FPS = 8;
export const STREAM_JPEG_QUALITY = 0.6;
/** Skip a frame while this much is still queued on the socket, so a slow link drops frames instead of lagging. */
export const STREAM_MAX_BUFFERED_BYTES = 256_000;

const BROWSER_SOURCE_PREFIX = "browser:";

export const newBrowserSourceUri = (): string =>
  `${BROWSER_SOURCE_PREFIX}${crypto.randomUUID()}`;

function webSocketBase(): string {
  const base = (import.meta.env.VITE_API_URL as string).replace(/\/+$/, "");
  return base.replace(/^http/, "ws");
}

/**
 * Open the frame stream for a browser camera. The bearer token is sent as the
 * first message (a WebSocket cannot carry an Authorization header, and a token
 * in the URL would be logged); the server then answers "ready".
 */
export function openCameraStream(cameraId: number): WebSocket {
  const socket = new WebSocket(`${webSocketBase()}/ws/cameras/${cameraId}/stream`);
  socket.binaryType = "arraybuffer";
  socket.addEventListener("open", () => socket.send(getToken() ?? ""));
  return socket;
}

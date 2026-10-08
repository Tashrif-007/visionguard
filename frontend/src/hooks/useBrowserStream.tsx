import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  openCameraStream,
  STREAM_FPS,
  STREAM_JPEG_QUALITY,
  STREAM_MAX_BUFFERED_BYTES,
  STREAM_WIDTH,
} from '@/api/streamApi'

interface StreamSession {
  socket: WebSocket
  stream: MediaStream
  video: HTMLVideoElement
  canvas: HTMLCanvasElement
  timer: number | null
  encoding: boolean
}

interface BrowserStreamValue {
  /** The camera this browser is currently streaming, or null. */
  activeCameraId: number | null
  /** Ask for the device camera and stream it to `cameraId`; rejects with a readable message. */
  start: (cameraId: number, deviceId?: string) => Promise<void>
  stop: () => void
}

const BrowserStreamContext = createContext<BrowserStreamValue | null>(null)

function sendFrame(session: StreamSession): void {
  const { socket, video, canvas } = session
  if (session.encoding || video.videoWidth === 0) return
  if (socket.readyState !== WebSocket.OPEN || socket.bufferedAmount > STREAM_MAX_BUFFERED_BYTES) return
  if (canvas.width === 0) {
    canvas.width = STREAM_WIDTH
    canvas.height = Math.round((STREAM_WIDTH * video.videoHeight) / video.videoWidth)
  }
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
  session.encoding = true
  canvas.toBlob(
    (blob) => {
      session.encoding = false
      if (blob && socket.readyState === WebSocket.OPEN) socket.send(blob)
    },
    'image/jpeg',
    STREAM_JPEG_QUALITY,
  )
}

function describeCameraError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'Camera permission was denied'
    if (error.name === 'NotFoundError') return 'No camera was found on this device'
    if (error.name === 'NotReadableError') return 'The camera is in use by another application'
  }
  return error instanceof Error ? error.message : 'Could not start the camera'
}

/**
 * Owns the one browser-camera stream of this tab. It lives above the routes so
 * the stream keeps running while the user moves between pages; the tab itself
 * must stay open (the camera, canvas and socket all live in it).
 */
export function BrowserStreamProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const sessionRef = useRef<StreamSession | null>(null)
  const [activeCameraId, setActiveCameraId] = useState<number | null>(null)

  const release = useCallback(
    (session: StreamSession) => {
      if (session.timer !== null) window.clearInterval(session.timer)
      session.stream.getTracks().forEach((track) => track.stop())
      session.video.srcObject = null
      if (session.socket.readyState === WebSocket.OPEN || session.socket.readyState === WebSocket.CONNECTING) {
        session.socket.close()
      }
      if (sessionRef.current === session) {
        sessionRef.current = null
        setActiveCameraId(null)
      }
      void queryClient.invalidateQueries({ queryKey: ['cameras'] })
    },
    [queryClient],
  )

  const stop = useCallback(() => {
    if (sessionRef.current) release(sessionRef.current)
  }, [release])

  const start = useCallback(
    async (cameraId: number, deviceId?: string) => {
      if (sessionRef.current) throw new Error('This browser is already streaming a camera — stop it first')
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access needs a supported browser and a secure (HTTPS) page')
      }

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId ? { deviceId: { exact: deviceId } } : true,
          audio: false,
        })
      } catch (error) {
        throw new Error(describeCameraError(error))
      }

      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.srcObject = stream
      try {
        await video.play()
      } catch (error) {
        stream.getTracks().forEach((track) => track.stop())
        throw new Error(describeCameraError(error))
      }

      const session: StreamSession = {
        socket: openCameraStream(cameraId),
        stream,
        video,
        canvas: document.createElement('canvas'),
        timer: null,
        encoding: false,
      }
      sessionRef.current = session
      setActiveCameraId(cameraId)
      stream.getVideoTracks()[0]?.addEventListener('ended', () => release(session))

      await new Promise<void>((resolve, reject) => {
        let ready = false
        session.socket.addEventListener('message', (event) => {
          if (event.data !== 'ready') return
          ready = true
          session.timer = window.setInterval(() => sendFrame(session), 1000 / STREAM_FPS)
          void queryClient.invalidateQueries({ queryKey: ['cameras'] })
          resolve()
        })
        session.socket.addEventListener('close', (event) => {
          release(session)
          if (ready) toast.info(event.reason || 'Camera stream ended')
          else reject(new Error(event.reason || 'Could not open the camera stream'))
        })
      })
    },
    [queryClient, release],
  )

  useEffect(() => stop, [stop])

  const value = useMemo(() => ({ activeCameraId, start, stop }), [activeCameraId, start, stop])
  return <BrowserStreamContext.Provider value={value}>{children}</BrowserStreamContext.Provider>
}

export function useBrowserStream(): BrowserStreamValue {
  const value = useContext(BrowserStreamContext)
  if (value === null) throw new Error('useBrowserStream must be used inside BrowserStreamProvider')
  return value
}

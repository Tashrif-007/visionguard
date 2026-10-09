import { useState } from 'react'
import { toast } from 'sonner'
import { MonitorSmartphone, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { newBrowserSourceUri } from '@/api/streamApi'
import { useBrowserStream } from '@/hooks/useBrowserStream'
import { useRegisterCamera } from '@/hooks/useCamera'

function errorMessage(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: string } } } | null)?.response?.data?.detail
  return detail ?? (error instanceof Error ? error.message : fallback)
}

/** Lists the cameras of the device running this browser and streams the chosen one to the server. */
export function BrowserCameraCard() {
  const [name, setName] = useState('')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [starting, setStarting] = useState(false)
  const registerCamera = useRegisterCamera()
  const { activeCameraId, start, stop } = useBrowserStream()

  const detectDevices = async () => {
    try {
      // Labels are only exposed once permission was granted, so ask once and release the camera again.
      const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      probe.getTracks().forEach((track) => track.stop())
      const cameras = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput')
      setDevices(cameras)
      setDeviceId(cameras[0]?.deviceId ?? '')
      if (cameras.length === 0) toast.error('No camera was found on this device')
    } catch (error) {
      toast.error(errorMessage(error, 'Could not access the camera — allow it in the browser and use HTTPS'))
    }
  }

  const startStreaming = async () => {
    setStarting(true)
    try {
      const camera = await registerCamera.mutateAsync({
        name: name || 'Browser camera',
        source_uri: newBrowserSourceUri(),
      })
      await start(camera.id, deviceId || undefined)
      setName('')
      toast.success(`${camera.name} is streaming`)
    } catch (error) {
      toast.error(errorMessage(error, 'Could not start streaming'))
    } finally {
      setStarting(false)
    }
  }

  const streaming = activeCameraId !== null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Use this device&apos;s camera</CardTitle>
        <CardDescription>
          Streams this browser&apos;s camera to the server for detection and dehazing. Keep this tab open.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="browser-camera-name">Name (optional)</Label>
          <Input
            id="browser-camera-name"
            placeholder="Laptop webcam"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={255}
            disabled={streaming}
          />
        </div>
        {devices.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="browser-camera-device">Camera</Label>
            <select
              id="browser-camera-device"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              disabled={streaming}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {devices.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${index + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex gap-2">
          {streaming ? (
            <Button type="button" variant="outline" onClick={stop}>
              <Square className="h-3.5 w-3.5" />
              Stop streaming
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => void detectDevices()} disabled={starting}>
                <MonitorSmartphone className="h-4 w-4" />
                Detect cameras
              </Button>
              <Button type="button" onClick={() => void startStreaming()} disabled={starting}>
                {starting ? 'Starting…' : 'Start streaming'}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

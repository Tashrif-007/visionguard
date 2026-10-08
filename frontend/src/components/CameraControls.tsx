import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Play, Plus, Settings2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useBrowserStream } from '@/hooks/useBrowserStream'
import { useAddAndStartCamera, useCameras, useStartCamera, useUploadVideo } from '@/hooks/useCamera'

function errorDetail(error: unknown): string | undefined {
  return (error as { response?: { data?: { detail?: string } } } | null)?.response?.data?.detail
}

function SavedCameraList({ onStarted }: { onStarted?: () => void }) {
  const { data: cameras } = useCameras()
  const startCamera = useStartCamera()
  const browserStream = useBrowserStream()
  const stopped = (cameras ?? []).filter((c) => c.status !== 'running')

  if (stopped.length === 0) {
    return <p className="text-xs text-muted-foreground">Every saved camera is already running.</p>
  }

  return (
    <ul className="flex max-h-48 flex-col divide-y divide-border overflow-y-auto rounded-md border border-border">
      {stopped.map((camera) => (
        <li key={camera.id} className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{camera.name}</span>
            <span className="block truncate font-mono text-[11px] text-muted-foreground">{camera.source_uri}</span>
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={startCamera.isPending}
            onClick={() => {
              if (camera.source_type === 'browser') {
                browserStream
                  .start(camera.id)
                  .then(() => {
                    toast.success(`${camera.name} started`)
                    onStarted?.()
                  })
                  .catch((error: unknown) =>
                    toast.error(error instanceof Error ? error.message : 'Could not start camera'),
                  )
                return
              }
              startCamera.mutate(camera.id, {
                onSuccess: () => {
                  toast.success(`${camera.name} started`)
                  onStarted?.()
                },
                onError: (error) => toast.error(errorDetail(error) ?? 'Could not start camera'),
              })
            }}
          >
            <Play className="h-3.5 w-3.5" />
            Start
          </Button>
        </li>
      ))}
    </ul>
  )
}

export function CameraControls({ onAdded }: { onAdded?: () => void }) {
  const [name, setName] = useState('')
  const [sourceUri, setSourceUri] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addAndStart = useAddAndStartCamera()
  const uploadVideo = useUploadVideo()

  const handleAdd = () => {
    addAndStart.mutate(
      { name: name || null, source_uri: sourceUri || null },
      {
        onSuccess: () => {
          setName('')
          setSourceUri('')
          toast.success('Camera saved and started')
          onAdded?.()
        },
        onError: (error) => toast.error(errorDetail(error) ?? 'Could not add camera'),
      },
    )
  }

  const handleUpload = (file: File | undefined) => {
    if (!file) return
    uploadVideo.mutate(file, {
      onSuccess: () => {
        toast.success('Video uploaded — playback started')
        onAdded?.()
      },
      onError: (error) => toast.error(errorDetail(error) ?? 'Could not upload video'),
    })
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="label-mono text-muted-foreground">Saved cameras</h3>
          <Link to="/cameras" className="label-mono flex items-center gap-1 text-primary hover:underline">
            <Settings2 className="h-3 w-3" />
            Manage cameras
          </Link>
        </div>
        <SavedCameraList onStarted={onAdded} />
      </section>

      <section className="flex min-w-0 flex-col gap-3">
        <h3 className="label-mono text-muted-foreground">New camera</h3>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="camera-name">Name (optional)</Label>
          <Input id="camera-name" placeholder="Front gate" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="source-uri">Source (webcam index, RTSP URL, or file path)</Label>
          <Input id="source-uri" placeholder="0" value={sourceUri} onChange={(e) => setSourceUri(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleAdd} disabled={addAndStart.isPending} className="flex-1">
            <Plus className="h-4 w-4" />
            Save &amp; start
          </Button>
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadVideo.isPending}
            className="flex-1"
          >
            <Upload className="h-4 w-4" />
            Upload video
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files?.[0])}
          />
        </div>
      </section>
    </div>
  )
}

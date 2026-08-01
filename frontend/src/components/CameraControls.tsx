import { useRef, useState } from 'react'
import { Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useStartCamera, useUploadVideo } from '@/hooks/useCamera'

export function CameraControls({ onAdded }: { onAdded?: () => void }) {
  const [name, setName] = useState('')
  const [sourceUri, setSourceUri] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const startCamera = useStartCamera()
  const uploadVideo = useUploadVideo()

  const handleAdd = () => {
    startCamera.mutate(
      { name: name || null, source_uri: sourceUri || null },
      {
        onSuccess: () => {
          setName('')
          setSourceUri('')
          onAdded?.()
        },
      },
    )
  }

  const handleUpload = (file: File | undefined) => {
    if (!file) return
    uploadVideo.mutate(file, { onSuccess: () => onAdded?.() })
  }

  const error =
    (startCamera.error as { response?: { data?: { detail?: string } } } | null)?.response?.data
      ?.detail ??
    (uploadVideo.error as { response?: { data?: { detail?: string } } } | null)?.response?.data
      ?.detail

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
          <Label htmlFor="camera-name">Name (optional)</Label>
          <Input
            id="camera-name"
            placeholder="Front gate"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex min-w-[240px] flex-[2] flex-col gap-1.5">
          <Label htmlFor="source-uri">Source (webcam index, RTSP URL, or file path)</Label>
          <Input
            id="source-uri"
            placeholder="0"
            value={sourceUri}
            onChange={(e) => setSourceUri(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleAdd} disabled={startCamera.isPending}>
            <Plus className="h-4 w-4" />
            Add camera
          </Button>
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadVideo.isPending}
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
      </div>
      {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
    </div>
  )
}

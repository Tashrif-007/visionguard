import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useStartCamera, useUploadVideo } from '@/hooks/useCamera'

function errorDetail(error: unknown): string | undefined {
  return (error as { response?: { data?: { detail?: string } } } | null)?.response?.data?.detail
}

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
          toast.success('Camera started')
          onAdded?.()
        },
        onError: (error) => toast.error(errorDetail(error) ?? 'Could not start camera'),
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="camera-name">Name (optional)</Label>
        <Input
          id="camera-name"
          placeholder="Front gate"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="source-uri">Source (webcam index, RTSP URL, or file path)</Label>
        <Input
          id="source-uri"
          placeholder="0"
          value={sourceUri}
          onChange={(e) => setSourceUri(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={handleAdd} disabled={startCamera.isPending} className="flex-1">
          <Plus className="h-4 w-4" />
          Add camera
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
    </div>
  )
}

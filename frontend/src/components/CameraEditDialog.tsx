import { useState } from 'react'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUpdateCamera } from '@/hooks/useCamera'
import type { Camera } from '@/types'

export function CameraEditDialog({ camera }: { camera: Camera }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(camera.name)
  const [sourceUri, setSourceUri] = useState(camera.source_uri)
  const updateCamera = useUpdateCamera()
  const running = camera.status === 'running'

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setName(camera.name)
      setSourceUri(camera.source_uri)
    }
    setOpen(next)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateCamera.mutate(
      { cameraId: camera.id, request: { name, source_uri: sourceUri } },
      {
        onSuccess: () => {
          toast.success('Camera updated')
          setOpen(false)
        },
        onError: (error) =>
          toast.error(
            (error as { response?: { data?: { detail?: string } } } | null)?.response?.data?.detail ??
              'Could not update camera',
          ),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          title="Rename or change source"
          aria-label={`Edit ${camera.name}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit camera</DialogTitle>
          <DialogDescription>Zones, schedule and past events stay with the camera.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`edit-name-${camera.id}`}>Name</Label>
            <Input
              id={`edit-name-${camera.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`edit-uri-${camera.id}`}>Source</Label>
            <Input
              id={`edit-uri-${camera.id}`}
              value={sourceUri}
              onChange={(e) => setSourceUri(e.target.value)}
              disabled={running}
              required
            />
            {running && <p className="text-xs text-muted-foreground">Stop the camera to change its source.</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={updateCamera.isPending}>
              {updateCamera.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

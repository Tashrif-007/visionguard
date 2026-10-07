import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useRegisterCamera } from '@/hooks/useCamera'

export function RegisterCameraForm() {
  const [name, setName] = useState('')
  const [sourceUri, setSourceUri] = useState('')
  const registerCamera = useRegisterCamera()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    registerCamera.mutate(
      { name: name || null, source_uri: sourceUri },
      {
        onSuccess: (camera) => {
          setName('')
          setSourceUri('')
          toast.success(`${camera.name} saved`)
        },
        onError: (error) =>
          toast.error(
            (error as { response?: { data?: { detail?: string } } } | null)?.response?.data?.detail ??
              'Could not save camera',
          ),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a camera</CardTitle>
        <CardDescription>Saved once, then started and stopped from here or the live view</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="register-name">Name (optional)</Label>
            <Input
              id="register-name"
              placeholder="Front gate"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="register-uri">Source</Label>
            <Input
              id="register-uri"
              placeholder="0 · rtsp://192.168.1.20/stream · uploads/clip.mp4"
              value={sourceUri}
              onChange={(e) => setSourceUri(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={registerCamera.isPending} className="w-fit">
            {registerCamera.isPending ? 'Saving…' : 'Save camera'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

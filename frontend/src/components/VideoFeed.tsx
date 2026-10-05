import { useEffect, useRef, useState } from 'react'
import { Video } from 'lucide-react'
import { LiveDot } from '@/components/LiveDot'
import { useLiveFrame } from '@/hooks/useCamera'

export function VideoFeed({ sourceId }: { sourceId: number }) {
  const { data: frameBlob, isError } = useLiveFrame(sourceId, true)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const previousUrl = useRef<string | null>(null)

  useEffect(() => {
    if (!frameBlob) return
    const url = URL.createObjectURL(frameBlob)
    // Revoke the previous object URL now that a new one is replacing it —
    // otherwise a long-running feed leaks a few MB per minute of polling.
    if (previousUrl.current) URL.revokeObjectURL(previousUrl.current)
    previousUrl.current = url
    setObjectUrl(url)
  }, [frameBlob])

  useEffect(
    () => () => {
      if (previousUrl.current) URL.revokeObjectURL(previousUrl.current)
    },
    [],
  )

  // The frame area is always black (video), so overlay colours are fixed
  // rather than themed: sky reticle brackets, white text.
  return (
    <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-black">
      {objectUrl && !isError ? (
        <img src={objectUrl} alt="Live dehazed feed" className="h-full w-full object-contain" />
      ) : (
        <div className="flex flex-col items-center gap-2 text-white/60">
          <Video className="h-10 w-10" />
          <span className="label-mono">Waiting for frames…</span>
        </div>
      )}

      {/* Viewfinder corner brackets — always framed, reinforces the surveillance identity */}
      <span className="pointer-events-none absolute left-2 top-2 h-4 w-4 border-l-2 border-t-2 border-[#7bd0ff]/70" />
      <span className="pointer-events-none absolute right-2 top-2 h-4 w-4 border-r-2 border-t-2 border-[#7bd0ff]/70" />
      <span className="pointer-events-none absolute bottom-2 left-2 h-4 w-4 border-b-2 border-l-2 border-[#7bd0ff]/70" />
      <span className="pointer-events-none absolute bottom-2 right-2 h-4 w-4 border-b-2 border-r-2 border-[#7bd0ff]/70" />

      {!isError && objectUrl && (
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-sm bg-black/60 px-2 py-1 backdrop-blur-sm">
          <LiveDot size="md" />
          <span className="font-mono text-[10px] font-semibold tracking-widest text-white">LIVE</span>
        </div>
      )}
    </div>
  )
}

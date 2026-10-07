import { ImageOff } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useSnapshotObjectUrl } from '@/hooks/useSnapshotObjectUrl'
import { cn } from 'cn'
import type { Event } from '@/types'

export function EventThumb({ event, className }: { event: Event; className?: string }) {
  const { objectUrl, isError } = useSnapshotObjectUrl(event.id)
  const box = cn('shrink-0 overflow-hidden rounded-sm border border-border bg-muted', className)

  if (objectUrl && !isError) {
    return <img src={objectUrl} alt={`${event.event_type} event snapshot`} className={cn(box, 'object-cover')} />
  }
  if (isError) {
    return (
      <div className={cn(box, 'flex items-center justify-center')}>
        <ImageOff className="h-4 w-4 text-muted-foreground" />
      </div>
    )
  }
  return <Skeleton className={box} />
}

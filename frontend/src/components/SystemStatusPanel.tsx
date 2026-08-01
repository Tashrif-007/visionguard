import { Activity } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useSystemStatus } from '@/hooks/useSystemStatus'

function statusVariant(value: string): 'success' | 'destructive' | 'muted' {
  if (value === 'ok') return 'success'
  if (value === 'error') return 'destructive'
  return 'muted'
}

export function SystemStatusPanel() {
  const { data, isLoading } = useSystemStatus()

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
        <Activity className="h-4 w-4" />
        System status
      </div>
      {isLoading || !data ? (
        <p className="text-xs text-[var(--muted-foreground)]">Checking…</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Badge variant={statusVariant(data.status)}>API: {data.status}</Badge>
          <Badge variant={statusVariant(data.database)}>DB: {data.database}</Badge>
          <Badge variant="muted">Pipeline: {data.pipeline}</Badge>
        </div>
      )}
    </div>
  )
}

import { Badge } from '@/components/ui/badge'
import { LiveDot } from '@/components/LiveDot'
import { useSystemStatus } from '@/hooks/useSystemStatus'

function statusVariant(value: string): 'success' | 'destructive' | 'muted' {
  if (value === 'ok') return 'success'
  if (value === 'error') return 'destructive'
  return 'muted'
}

export function SystemStatusPanel({ compact = false }: { compact?: boolean }) {
  const { data, isLoading } = useSystemStatus()

  if (isLoading || !data) {
    return <p className="label-mono text-muted-foreground">Checking status…</p>
  }

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={statusVariant(data.status)}>API</Badge>
        <Badge variant={statusVariant(data.database)}>DB</Badge>
        <Badge variant="muted">Pipeline: {data.pipeline}</Badge>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted p-3">
      <div className="flex items-center justify-between">
        <span className="label-mono text-muted-foreground">System status</span>
        {data.status === 'ok' && <LiveDot />}
      </div>
      <dl className="label-mono flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">API</dt>
          <dd className={data.status === 'ok' ? 'text-success' : 'text-destructive'}>{data.status}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">DB</dt>
          <dd className={data.database === 'ok' ? 'text-success' : 'text-destructive'}>{data.database}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Pipeline</dt>
          <dd className="text-foreground">{data.pipeline}</dd>
        </div>
      </dl>
    </div>
  )
}

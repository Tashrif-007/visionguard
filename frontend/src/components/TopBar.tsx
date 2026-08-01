import { useEffect, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { UserMenu } from '@/components/UserMenu'

function formatClock(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function TopBar({ title }: { title: string }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-6">
      <h1 className="text-sm font-semibold">{title}</h1>
      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 font-mono text-xs text-[var(--muted-foreground)] sm:flex">
          <CalendarClock className="h-3.5 w-3.5" />
          {formatClock(now)}
        </div>
        <div className="h-6 w-px bg-[var(--border)]" />
        <UserMenu />
      </div>
    </header>
  )
}

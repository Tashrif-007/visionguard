import { useEffect, useState } from 'react'
import { CalendarClock, Moon, Sun } from 'lucide-react'
import { SystemStatusPanel } from '@/components/SystemStatusPanel'
import { UserMenu } from '@/components/UserMenu'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/useTheme'

function formatClock(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function TopBar({ title }: { title: string }) {
  const [now, setNow] = useState(() => new Date())
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-card/90 px-6 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-4">
        <h1 className="truncate text-sm font-semibold tracking-tight">{title}</h1>
        <div className="hidden items-center gap-2 rounded-sm bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground md:flex">
          <CalendarClock className="h-3.5 w-3.5 text-primary" />
          {formatClock(now)}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden xl:block">
          <SystemStatusPanel compact />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <div className="h-6 w-px bg-border" />
        <UserMenu />
      </div>
    </header>
  )
}

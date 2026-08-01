import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { History, LayoutGrid, ShieldHalf } from 'lucide-react'
import { TopBar } from '@/components/TopBar'
import { cn } from '@/utils/cn'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Live Monitoring',
  '/events': 'Event Log',
}

function RailLink({
  to,
  end,
  icon: Icon,
  label,
}: {
  to: string
  end?: boolean
  icon: typeof LayoutGrid
  label: string
}) {
  return (
    <NavLink
      to={to}
      end={end}
      title={label}
      aria-label={label}
      className={({ isActive }) =>
        cn(
          'flex h-10 w-10 items-center justify-center rounded-sm border transition-colors',
          isActive
            ? 'border-[var(--primary)]/50 bg-[var(--primary)]/10 text-[var(--primary)]'
            : 'border-transparent text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]',
        )
      }
    >
      <Icon className="h-4 w-4" />
    </NavLink>
  )
}

export function AppLayout() {
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] ?? 'VisionGuard AI'

  return (
    <div className="flex h-svh">
      <aside className="flex w-14 shrink-0 flex-col items-center gap-4 border-r border-[var(--border)] bg-[var(--card)] py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-[var(--primary)] text-[var(--primary-foreground)]">
          <ShieldHalf className="h-4 w-4" />
        </span>
        <div className="h-px w-6 bg-[var(--border)]" />
        <nav className="flex flex-col gap-1.5">
          <RailLink to="/" end icon={LayoutGrid} label="Dashboard" />
          <RailLink to="/events" icon={History} label="Events" />
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} />
        <main className="min-h-0 min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

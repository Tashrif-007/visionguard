import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BarChart3, Cctv, History, LayoutGrid, ShieldHalf, UserCog, Users } from 'lucide-react'
import { SystemStatusPanel } from '@/components/SystemStatusPanel'
import { TopBar } from '@/components/TopBar'
import { useCurrentUser } from '@/hooks/useAuth'
import { cn } from 'cn'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Live Monitoring',
  '/cameras': 'Cameras',
  '/events': 'Events & Timeline',
  '/analytics': 'Event Analytics',
  '/profile': 'Profile',
  '/admin': 'Admin Console',
}

function SideLink({
  to,
  icon: Icon,
  label,
}: {
  to: string
  icon: typeof LayoutGrid
  label: string
}) {
  return (
    <NavLink
      to={to}
      title={label}
      aria-label={label}
      className={({ isActive }) =>
        cn(
          'flex h-10 items-center justify-center gap-3 rounded-md text-sm font-medium transition-colors lg:justify-start lg:px-3',
          isActive
            ? 'bg-secondary text-primary shadow-[0_0_12px_color-mix(in_oklab,var(--primary)_15%,transparent)]'
            : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="hidden lg:inline">{label}</span>
    </NavLink>
  )
}

export function AppLayout() {
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] ?? 'VisionGuard AI'
  const { data: user } = useCurrentUser()

  return (
    <div className="flex h-svh">
      <aside className="flex w-14 shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:w-64">
        <div className="flex flex-col">
          <div className="flex h-14 items-center justify-center gap-2.5 border-b border-sidebar-border lg:justify-start lg:px-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldHalf className="h-4 w-4" />
            </span>
            <span className="hidden flex-col leading-tight lg:flex">
              <span className="text-sm font-semibold tracking-tight">VisionGuard</span>
              <span className="label-mono text-muted-foreground">AI Surveillance</span>
            </span>
          </div>
          <nav className="flex flex-col gap-1 p-2">
            <SideLink to="/dashboard" icon={LayoutGrid} label="Live Monitoring" />
            <SideLink to="/cameras" icon={Cctv} label="Cameras" />
            <SideLink to="/events" icon={History} label="Events & Timeline" />
            <SideLink to="/analytics" icon={BarChart3} label="Event Analytics" />
            <SideLink to="/profile" icon={UserCog} label="Profile" />
            {user?.role === 'admin' && <SideLink to="/admin" icon={Users} label="Admin Console" />}
          </nav>
        </div>
        <div className="hidden p-3 lg:block">
          <SystemStatusPanel />
        </div>
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

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut, Moon, Sun } from 'lucide-react'
import { useCurrentUser, useLogout } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'

export function UserMenu() {
  const { data: user } = useCurrentUser()
  const logout = useLogout()
  const { theme, toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!user) return null

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-sm px-1.5 py-1 transition-colors hover:bg-[var(--muted)]"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-sm border border-[var(--border)] bg-[var(--muted)] font-mono text-[10px] font-semibold uppercase text-[var(--foreground)]">
          {user.username.slice(0, 2)}
        </span>
        <span className="hidden flex-col items-start leading-tight sm:flex">
          <span className="text-xs font-medium">{user.username}</span>
          <span className="font-mono text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
            {user.role}
          </span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-10 mt-2 w-48 overflow-hidden rounded-sm border border-[var(--border)] bg-[var(--card)] shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              toggleTheme()
              setOpen(false)
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--muted)]"
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              logout()
            }}
            className="flex w-full items-center gap-2 border-t border-[var(--border)] px-3 py-2 text-left text-xs text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      )}
    </div>
  )
}

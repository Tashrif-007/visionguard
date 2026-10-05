import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, LogOut, UserCog } from 'lucide-react'
import { useCurrentUser, useLogout } from '@/hooks/useAuth'

export function UserMenu() {
  const { data: user } = useCurrentUser()
  const logout = useLogout()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

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
        className="flex items-center gap-2.5 rounded-md px-1.5 py-1 transition-colors hover:bg-muted"
      >
        <span className="hidden flex-col items-end leading-tight sm:flex">
          <span className="text-xs font-semibold">{user.name}</span>
          <span className="label-mono text-primary">{user.role}</span>
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary font-mono text-[11px] font-semibold uppercase text-foreground">
          {user.name.slice(0, 2)}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-10 mt-2 w-48 overflow-hidden rounded-lg border border-border bg-popover shadow-[0_12px_32px_-4px_rgb(0_0_0/0.35)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              navigate('/profile')
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-muted"
          >
            <UserCog className="h-3.5 w-3.5" />
            Profile
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              logout()
            }}
            className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-xs text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrandLogo } from '@/components/BrandLogo'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useLogin } from '@/hooks/useAuth'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const login = useLogin()
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    login.mutate(
      { email, password },
      { onSuccess: () => navigate('/dashboard', { replace: true }) },
    )
  }

  const errorMessage =
    (login.error as { response?: { data?: { detail?: string } } } | null)?.response?.data?.detail ??
    (login.isError ? 'Login failed' : null)

  return (
    <div className="grid min-h-svh grid-cols-1 lg:grid-cols-2">
      {/* Brand panel — always dark (the `dark` class scopes the dark theme
          tokens to this subtree), independent of the app's light/dark toggle.
          Reuses the viewfinder corner-bracket motif from the live feed rather
          than inventing a new decorative element. */}
      <div className="dark relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-foreground lg:flex">
        <div className="flex items-center gap-2">
          <BrandLogo />
          <span className="text-sm font-semibold">VisionGuard AI</span>
        </div>

        <div className="relative flex aspect-video w-full items-center justify-center rounded-lg border border-border bg-background/60">
          <span className="pointer-events-none absolute left-3 top-3 h-5 w-5 border-l-2 border-t-2 border-primary/70" />
          <span className="pointer-events-none absolute right-3 top-3 h-5 w-5 border-r-2 border-t-2 border-primary/70" />
          <span className="pointer-events-none absolute bottom-3 left-3 h-5 w-5 border-b-2 border-l-2 border-primary/70" />
          <span className="pointer-events-none absolute bottom-3 right-3 h-5 w-5 border-b-2 border-r-2 border-primary/70" />
          <span className="label-mono rounded-sm border border-border px-2.5 py-1 text-muted-foreground">
            ROI · dehazing in progress
          </span>
        </div>

        <div className="max-w-sm">
          <p className="text-lg font-semibold leading-snug">See clearly through fog and smog.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Hybrid dark channel prior + tiny CNN dehazing, running only on the regions where motion
            happens — CPU-only, 30 FPS.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <BrandLogo className="h-9 w-9" />
            <span className="text-sm font-semibold">VisionGuard AI</span>
          </div>

          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your operator or admin credentials to access the surveillance dashboard.
          </p>

          <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
            <Button type="submit" disabled={login.isPending} className="w-full">
              {login.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

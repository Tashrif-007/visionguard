import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldHalf } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useLogin } from '@/hooks/useAuth'

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const login = useLogin()
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    login.mutate(
      { username, password },
      { onSuccess: () => navigate('/', { replace: true }) },
    )
  }

  const errorMessage =
    (login.error as { response?: { data?: { detail?: string } } } | null)?.response?.data?.detail ??
    (login.isError ? 'Login failed' : null)

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm overflow-hidden">
        <div className="h-1 w-full bg-[var(--primary)]" />
        <CardHeader className="items-center pt-6 text-center">
          <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-sm bg-[var(--primary)] text-[var(--primary-foreground)]">
            <ShieldHalf className="h-6 w-6" />
          </span>
          <CardTitle className="text-base">VisionGuard AI</CardTitle>
          <CardDescription>Sign in to access the surveillance dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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
            {errorMessage && <p className="text-xs text-[var(--destructive)]">{errorMessage}</p>}
            <Button type="submit" disabled={login.isPending} className="w-full">
              {login.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

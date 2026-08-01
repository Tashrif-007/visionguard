import { Navigate } from 'react-router-dom'
import { useCurrentUser } from '@/hooks/useAuth'
import { getToken } from '@/api/client'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, isError } = useCurrentUser()

  if (!getToken()) {
    return <Navigate to="/login" replace />
  }
  if (isLoading) {
    return (
      <div className="flex h-svh items-center justify-center text-sm text-[var(--muted-foreground)]">
        Checking session…
      </div>
    )
  }
  if (isError || !user) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

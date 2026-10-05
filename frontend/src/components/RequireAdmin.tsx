import { Navigate } from 'react-router-dom'
import { useCurrentUser } from '@/hooks/useAuth'

// Assumes it's rendered inside ProtectedRoute (so a valid session already
// exists) — this only adds the role check on top. Purely a UX guard: real
// enforcement is the require_admin dependency on the backend routes this
// page calls, same principle as every other auth check in this app.
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { data: user } = useCurrentUser()

  if (user && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

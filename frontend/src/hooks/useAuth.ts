import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as authApi from '@/api/authApi'
import { clearToken, getToken, setToken } from '@/api/client'
import type { LoginRequest } from '@/types'

export const CURRENT_USER_KEY = ['auth', 'me']

export function useCurrentUser() {
  return useQuery({
    queryKey: CURRENT_USER_KEY,
    queryFn: authApi.getMe,
    enabled: Boolean(getToken()),
    retry: false,
    staleTime: Infinity,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: LoginRequest) => authApi.login(request),
    onSuccess: (token) => {
      setToken(token.access_token)
      void queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY })
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return () => {
    clearToken()
    queryClient.clear()
  }
}

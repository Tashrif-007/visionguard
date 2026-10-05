import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import * as authApi from "@/api/authApi";
import { clearToken, getToken, setToken } from "@/api/client";
import type {
  LoginRequest,
  ProfileUpdateRequest,
  UserCreateRequest,
} from "@/types";

export const CURRENT_USER_KEY = ["auth", "me"];
const USERS_KEY = ["auth", "users"];

export function useCurrentUser() {
  return useQuery({
    queryKey: CURRENT_USER_KEY,
    queryFn: authApi.getMe,
    enabled: Boolean(getToken()),
    retry: false,
    staleTime: Infinity,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: LoginRequest) => authApi.login(request),
    onSuccess: (token) => {
      setToken(token.access_token);
      void queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return () => {
    clearToken();
    queryClient.clear();
    // Navigate explicitly rather than relying on ProtectedRoute to notice the
    // cleared token on its next render — nothing guaranteed that render would
    // happen soon (or at all) on a page with no actively polling query.
    navigate("/login", { replace: true });
  };
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => authApi.changePassword(currentPassword, newPassword),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: UserCreateRequest) => authApi.createUser(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USERS_KEY });
    },
  });
}

export function useUsers() {
  return useQuery({
    queryKey: USERS_KEY,
    queryFn: authApi.listUsers,
  });
}

export function useSetUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: number; isActive: boolean }) =>
      authApi.setUserStatus(userId, isActive),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USERS_KEY });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: ProfileUpdateRequest) =>
      authApi.updateProfile(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY });
    },
  });
}

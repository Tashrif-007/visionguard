import client from "@/api/client";
import type {
  LoginRequest,
  ProfileUpdateRequest,
  TokenResponse,
  User,
  UserCreateRequest,
} from "@/types";

export const login = async (request: LoginRequest): Promise<TokenResponse> =>
  (await client.post<TokenResponse>("/auth/login", request)).data;

export const getMe = async (): Promise<User> =>
  (await client.get<User>("/auth/me")).data;

export const createUser = async (request: UserCreateRequest): Promise<User> =>
  (await client.post<User>("/auth/users", request)).data;

export const changePassword = async (
  currentPassword: string,
  newPassword: string,
): Promise<User> =>
  (
    await client.patch<User>("/auth/password", {
      current_password: currentPassword,
      new_password: newPassword,
    })
  ).data;

export const listUsers = async (): Promise<User[]> =>
  (await client.get<User[]>("/auth/users")).data;

export const setUserStatus = async (
  userId: number,
  isActive: boolean,
): Promise<User> =>
  (
    await client.patch<User>(`/auth/users/${userId}/status`, {
      is_active: isActive,
    })
  ).data;

export const updateProfile = async (
  request: ProfileUpdateRequest,
): Promise<User> => (await client.patch<User>("/auth/profile", request)).data;

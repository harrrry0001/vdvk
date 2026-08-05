import client from "../client";
import type { LoginRequest, LoginResponse, RefreshResponse } from "@/types";

export const authApi = {
  login: (data: LoginRequest) =>
    client.post<LoginResponse>("/auth/login", data),

  refresh: (refreshToken: string) =>
    client.post<RefreshResponse>("/auth/refresh", { refreshToken }),

  logout: () => client.post("/auth/logout"),

  me: () => client.get("/auth/me"),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    client.patch("/auth/password", data),

  updateProfile: (data: { name?: string; mobile?: string; designation?: string }) =>
    client.patch("/auth/profile", data),
};

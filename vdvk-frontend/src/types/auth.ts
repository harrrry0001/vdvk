export interface AuthUser {
  userId: string;
  name: string;
  username: string;
  designation: string;
  roles: string[];
  activeRole: string;
  mandal?: string;
  vdvkCode?: string;
  facilityCode?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser & { id: string; mobile?: string; email?: string };
}

export interface RefreshResponse {
  accessToken: string;
}

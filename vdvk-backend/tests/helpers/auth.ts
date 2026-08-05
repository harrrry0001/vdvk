import { api } from "./client.js";

export const DEFAULT_PASSWORD = "Vdvk@2025";

/** username for each seeded role */
export const SEED_USERS: Record<string, string> = {
  po: "po",
  dpm: "dpm",
  apm: "apm",
  cc: "cc",
  hubsup: "hubsup",
  mda: "mda",
};

const tokenCache = new Map<string, string>();

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; name: string; roles: string[]; activeRole: string };
}

/** Login a seeded user and cache the access token for the process */
export async function login(username: string, password: string = DEFAULT_PASSWORD): Promise<Session> {
  const res = await api<Session>("POST", "/api/auth/login", { body: { username, password } });
  if (res.status !== 200) {
    throw new Error(`Login failed for "${username}": ${res.status} ${JSON.stringify(res.body)}`);
  }
  tokenCache.set(username, res.body.accessToken);
  return res.body;
}

/** Access token for a role, logging in on first use */
export async function tokenFor(role: keyof typeof SEED_USERS | string): Promise<string> {
  const username = SEED_USERS[role] ?? role;
  if (tokenCache.has(username)) return tokenCache.get(username)!;
  const s = await login(username);
  return s.accessToken;
}

/** Clear cached tokens (e.g. after a logout test) */
export function clearTokens() {
  tokenCache.clear();
}

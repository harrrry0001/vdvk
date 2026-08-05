import { app } from "../../src/app.js";

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOpts {
  token?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

export interface ApiResponse<T = any> {
  status: number;
  body: T;
}

// NOTE: must NOT be named BASE_URL — Vite/Vitest injects BASE_URL="/" by default
const API_BASE_URL = process.env.API_BASE_URL;

/**
 * Dual-mode API client:
 *  - Default: in-process via Hono's app.request() (no server needed)
 *  - If API_BASE_URL is set (e.g. API_BASE_URL=http://localhost:3000), hits a live server
 */
export async function api<T = any>(method: Method, path: string, opts: RequestOpts = {}): Promise<ApiResponse<T>> {
  let url = path;
  if (opts.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) qs.set(k, String(v));
    }
    const s = qs.toString();
    if (s) url = path.includes("?") ? `${path}&${s}` : `${path}?${s}`;
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  const init: RequestInit = { method, headers };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);

  const res = API_BASE_URL
    ? await fetch(API_BASE_URL.replace(/\/$/, "") + url, init)
    : await app.request(url, init);

  const text = await res.text();
  let body: any = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text; // non-JSON body (e.g. Hono's plain-text 404)
    }
  }
  return { status: res.status, body };
}

/** Assert helper: expect a specific status and return parsed body */
export async function expectStatus<T = any>(method: Method, path: string, expected: number, opts: RequestOpts = {}): Promise<ApiResponse<T>> {
  const res = await api<T>(method, path, opts);
  if (res.status !== expected) {
    throw new Error(
      `Expected ${expected} for ${method} ${path} but got ${res.status}: ${JSON.stringify(res.body)}`
    );
  }
  return res;
}

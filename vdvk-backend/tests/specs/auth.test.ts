import { describe, expect, it } from "vitest";
import { api, expectStatus } from "../helpers/client.js";
import { clearTokens, DEFAULT_PASSWORD, login, tokenFor } from "../helpers/auth.js";

describe("AUTH", () => {
  it("GET /api/health is public and returns ok", async () => {
    const res = await expectStatus("GET", "/api/health", 200);
    expect(res.body.status).toBe("ok");
  });

  it("login works for every seeded role", async () => {
    for (const [role, username] of Object.entries({ po: "po", dpm: "dpm", apm: "apm", cc: "cc", hubsup: "hubsup", mda: "mda" })) {
      const s = await login(username);
      expect(s.accessToken).toBeTruthy();
      expect(s.refreshToken).toBeTruthy();
      expect(s.user.roles).toContain(role === "hubsup" ? "Hub Supervisor" : role.toUpperCase());
      expect(s.user.activeRole).toBeTruthy();
    }
  });

  it("login rejects wrong password (401)", async () => {
    const res = await api("POST", "/api/auth/login", { body: { username: "mda", password: "WrongPass123" } });
    expect(res.status).toBe(401);
  });

  it("login rejects an unassigned role (403)", async () => {
    const res = await api("POST", "/api/auth/login", {
      body: { username: "mda", password: DEFAULT_PASSWORD, activeRole: "DPM" },
    });
    expect(res.status).toBe(403);
  });

  it("login with missing fields (400)", async () => {
    const res = await api("POST", "/api/auth/login", { body: { username: "mda" } });
    expect(res.status).toBe(400);
  });

  it("GET /api/auth/me returns the profile for the token", async () => {
    const token = await tokenFor("mda");
    const res = await expectStatus("GET", "/api/auth/me", 200, { token });
    expect(res.body.id).toBeTruthy();
    expect(res.body.roles).toContain("MDA");
  });

  it("GET /api/auth/me without token (401)", async () => {
    await expectStatus("GET", "/api/auth/me", 401);
  });

  it("refresh rotates the refresh token", async () => {
    const s = await login("po");
    const res = await expectStatus("POST", "/api/auth/refresh", 200, {
      body: { refreshToken: s.refreshToken },
    });
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.refreshToken).not.toBe(s.refreshToken);
  });

  it("refresh with a garbage token (401)", async () => {
    const res = await api("POST", "/api/auth/refresh", { body: { refreshToken: "not-a-real-token" } });
    expect(res.status).toBe(401);
  });

  it("logout revokes sessions so the refresh token dies", async () => {
    const s = await login("hubsup");
    await expectStatus("POST", "/api/auth/logout", 200, { token: s.accessToken });
    const res = await api("POST", "/api/auth/refresh", { body: { refreshToken: s.refreshToken } });
    expect(res.status).toBe(401);
    clearTokens();
  });

  it("change password works and is restored after", async () => {
    const s = await login("apm");
    const token = s.accessToken;
    const temp = `Temp_${Date.now()}`;
    try {
      // Wrong current password → 401
      const bad = await api("PATCH", "/api/auth/password", {
        token, body: { currentPassword: "WrongPass", newPassword: temp },
      });
      expect(bad.status).toBe(401);

      // Too-short new password → 400
      const short = await api("PATCH", "/api/auth/password", {
        token, body: { currentPassword: DEFAULT_PASSWORD, newPassword: "short" },
      });
      expect(short.status).toBe(400);

      // Successful change
      const ok = await expectStatus("PATCH", "/api/auth/password", 200, {
        token, body: { currentPassword: DEFAULT_PASSWORD, newPassword: temp },
      });
      expect(ok.body.success).toBe(true);

      // New password lets you log in
      const s2 = await login("apm", temp);
      expect(s2.accessToken).toBeTruthy();

      // Change back so subsequent runs keep working
      await expectStatus("PATCH", "/api/auth/password", 200, {
        token: s2.accessToken, body: { currentPassword: temp, newPassword: DEFAULT_PASSWORD },
      });
    } finally {
      // Belt-and-suspenders restore in case an assertion failed mid-way
      try {
        const s3 = await login("apm", temp);
        await api("PATCH", "/api/auth/password", {
          token: s3.accessToken, body: { currentPassword: temp, newPassword: DEFAULT_PASSWORD },
        });
      } catch { /* already restored */ }
      clearTokens();
    }
  });
});

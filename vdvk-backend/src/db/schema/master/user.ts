import { integer, index, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ─── USER ROLES ENUM ──────────────────────────────────────────────────────
export const USER_ROLES = [
  "PO", "APD", "DPM", "APM", "MDA",
  "CC", "Hub Supervisor", "MPC Supervisor",
  "Haat Bazaar Supervisor", "VDVK Head", "VDVK Facility Supervisor",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

// ─── USERS ───────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  mobile: text("mobile"),
  designation: text("designation"),
  mandal: text("mandal"),
  vdvkCode: text("vdvk_code"),
  facilityCode: text("facility_code"),
  status: text("status").notNull().default("Active"),
  // Auth
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: text("locked_until"),
  passwordChangedAt: text("password_changed_at").$defaultFn(() => new Date().toISOString()),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_users_status: index("idx_users_status").on(t.status),
  idx_users_mandal: index("idx_users_mandal").on(t.mandal),
}));

// ─── USER ROLE MAPPINGS ──────────────────────────────────────────────────
export const userRoles = sqliteTable("user_roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id),
  role: text("role").notNull(),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  assignedFrom: text("assigned_from").notNull(),
  assignedTo: text("assigned_to"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_user_roles_user: index("idx_user_roles_user").on(t.userId),
  idx_user_roles_role: index("idx_user_roles_role").on(t.role),
}));

// ─── USER SESSIONS ───────────────────────────────────────────────────────
export const userSessions = sqliteTable("user_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  refreshToken: text("refresh_token").notNull(),
  activeRole: text("active_role"),
  expiresAt: text("expires_at").notNull(),
  isRevoked: integer("is_revoked", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_sessions_user: index("idx_sessions_user").on(t.userId),
  idx_sessions_token: index("idx_sessions_token").on(t.refreshToken),
}));

// ─── USER TRANSFER / CHANGE HISTORY ──────────────────────────────────────
export const userTransferHistory = sqliteTable("user_transfer_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id),
  changedField: text("changed_field").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  reason: text("reason"),
  changedBy: text("changed_by").notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_transfer_user: index("idx_transfer_user").on(t.userId),
}));

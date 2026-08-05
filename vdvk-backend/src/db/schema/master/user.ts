import { boolean, index, integer, pgTable, serial, text, varchar } from "drizzle-orm/pg-core";

// ─── USER ROLES ENUM ──────────────────────────────────────────────────────
export const USER_ROLES = [
  "PO", "APD", "DPM", "APM", "MDA", "Admin",
  "CC", "Hub Supervisor", "Multipurpose Centre Supervisor",
  "Haat Bazaar Supervisor", "VDVK Head", "VDVK Facility Supervisor",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

// ─── USERS ───────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 191 }).notNull(),
  email: varchar("email", { length: 191 }),
  mobile: varchar("mobile", { length: 32 }),
  designation: varchar("designation", { length: 191 }),
  mandal: varchar("mandal", { length: 64 }),
  vdvkCode: varchar("vdvk_code", { length: 64 }),
  facilityCode: varchar("facility_code", { length: 64 }),
  status: text("status").notNull().default("Active"),
  // Auth
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 191 }).notNull(),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: varchar("locked_until", { length: 64 }),
  passwordChangedAt: varchar("password_changed_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
  updatedAt: varchar("updated_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_users_status: index("idx_users_status").on(t.status),
  idx_users_mandal: index("idx_users_mandal").on(t.mandal),
}));

// ─── USER ROLE MAPPINGS ──────────────────────────────────────────────────
export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),
  role: varchar("role", { length: 64 }).notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
  assignedFrom: varchar("assigned_from", { length: 64 }).notNull(),
  assignedTo: varchar("assigned_to", { length: 64 }),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_user_roles_user: index("idx_user_roles_user").on(t.userId),
  idx_user_roles_role: index("idx_user_roles_role").on(t.role),
}));

// ─── USER SESSIONS ───────────────────────────────────────────────────────
export const userSessions = pgTable("user_sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),
  refreshToken: varchar("refresh_token", { length: 500 }).notNull(),
  activeRole: varchar("active_role", { length: 64 }),
  expiresAt: varchar("expires_at", { length: 64 }).notNull(),
  isRevoked: boolean("is_revoked").notNull().default(false),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_sessions_user: index("idx_sessions_user").on(t.userId),
  idx_sessions_token: index("idx_sessions_token").on(t.refreshToken),
}));

// ─── USER TRANSFER / CHANGE HISTORY ──────────────────────────────────────
export const userTransferHistory = pgTable("user_transfer_history", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),
  changedField: varchar("changed_field", { length: 64 }).notNull(),
  oldValue: varchar("old_value", { length: 500 }),
  newValue: varchar("new_value", { length: 500 }),
  reason: varchar("reason", { length: 500 }),
  changedBy: varchar("changed_by", { length: 64 }).notNull(),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_transfer_user: index("idx_transfer_user").on(t.userId),
}));

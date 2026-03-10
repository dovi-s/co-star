import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  passwordHash: varchar("password_hash"),
  googleId: varchar("google_id").unique(),
  authProvider: varchar("auth_provider").default("email"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  stageName: varchar("stage_name"),
  pronouns: varchar("pronouns"),
  ageRange: varchar("age_range"),
  height: varchar("height"),
  eyeColor: varchar("eye_color"),
  hairColor: varchar("hair_color"),
  location: varchar("location"),
  unionStatus: varchar("union_status"),
  specialSkills: text("special_skills"),
  onboardingComplete: varchar("onboarding_complete").default("false"),
  subscriptionTier: varchar("subscription_tier").default("free"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  scriptUsageCount: integer("script_usage_count").default(0),
  scriptUsageLimitBonus: integer("script_usage_limit_bonus").default(0),
  scriptUsageResetAt: timestamp("script_usage_reset_at"),
  blocked: varchar("blocked").default("false"),
  blockedAt: timestamp("blocked_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  tokenHash: varchar("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_reset_tokens_email").on(table.email),
  index("IDX_reset_tokens_expires").on(table.expiresAt),
]);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

export const deviceUsage = pgTable("device_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceFingerprint: varchar("device_fingerprint").notNull(),
  usageCount: integer("usage_count").default(0),
  resetAt: timestamp("reset_at"),
  lastUserId: varchar("last_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_device_usage_fingerprint_unique").on(table.deviceFingerprint),
]);

export type DeviceUsage = typeof deviceUsage.$inferSelect;

export const cancelFeedback = pgTable("cancel_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  reason: varchar("reason").notNull(),
  comment: text("comment"),
  outcome: varchar("outcome").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_cancel_feedback_user").on(table.userId),
]);

export type CancelFeedback = typeof cancelFeedback.$inferSelect;

// Saved scripts for Pro users
export const savedScripts = pgTable("saved_scripts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name").notNull(),
  rawScript: text("raw_script").notNull(),
  rolesJson: jsonb("roles_json"),
  scenesJson: jsonb("scenes_json"),
  userRoleId: varchar("user_role_id"),
  lastPosition: integer("last_position").default(0),
  lastScene: integer("last_scene").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [index("IDX_saved_scripts_user").on(table.userId)]);

export type SavedScript = typeof savedScripts.$inferSelect;
export type InsertSavedScript = typeof savedScripts.$inferInsert;

// Performance runs for tracking improvement
export const performanceRuns = pgTable("performance_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  scriptName: varchar("script_name").notNull(),
  savedScriptId: varchar("saved_script_id").references(() => savedScripts.id),
  accuracy: real("accuracy").notNull(),
  linesTotal: integer("lines_total").notNull(),
  linesCorrect: integer("lines_correct").notNull(),
  linesSkipped: integer("lines_skipped").default(0),
  durationSeconds: integer("duration_seconds"),
  memorizationMode: varchar("memorization_mode").default("off"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_performance_runs_user").on(table.userId),
  index("IDX_performance_runs_script").on(table.savedScriptId),
]);

export type PerformanceRun = typeof performanceRuns.$inferSelect;
export type InsertPerformanceRun = typeof performanceRuns.$inferInsert;

// Feature requests board
export const featureRequests = pgTable("feature_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  authorName: varchar("author_name").notNull(),
  title: varchar("title").notNull(),
  description: text("description"),
  category: varchar("category").default("general"),
  status: varchar("status").default("open"),
  voteCount: integer("vote_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_feature_requests_votes").on(table.voteCount),
  index("IDX_feature_requests_user").on(table.userId),
]);

export type FeatureRequest = typeof featureRequests.$inferSelect;
export type InsertFeatureRequest = typeof featureRequests.$inferInsert;

// Votes on feature requests (one per user per request)
export const featureVotes = pgTable("feature_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  featureRequestId: varchar("feature_request_id").notNull().references(() => featureRequests.id, { onDelete: "cascade" }),
  value: integer("value").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_feature_votes_request").on(table.featureRequestId),
  index("IDX_feature_votes_user_request").on(table.userId, table.featureRequestId),
]);

export type FeatureVote = typeof featureVotes.$inferSelect;

export const recentScripts = pgTable("recent_scripts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name").notNull(),
  rawScript: text("raw_script").notNull(),
  scriptFingerprint: varchar("script_fingerprint").notNull().default(""),
  roleCount: integer("role_count").default(0),
  lineCount: integer("line_count").default(0),
  lastRole: varchar("last_role"),
  lastUsed: timestamp("last_used").defaultNow(),
}, (table) => [
  index("IDX_recent_scripts_user").on(table.userId),
  index("IDX_recent_scripts_user_last_used").on(table.userId, table.lastUsed),
]);

export type RecentScriptRow = typeof recentScripts.$inferSelect;

export const analyticsEvents = pgTable("analytics_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  userId: varchar("user_id"),
  event: varchar("event").notNull(),
  category: varchar("category").notNull(),
  label: varchar("label"),
  value: varchar("value"),
  path: varchar("path"),
  device: varchar("device"),
  browser: varchar("browser"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_events_created").on(table.createdAt),
  index("IDX_events_session").on(table.sessionId),
  index("IDX_events_user").on(table.userId),
  index("IDX_events_event").on(table.event),
  index("IDX_events_category").on(table.category),
]);

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;

export const feedbackMessages = pgTable("feedback_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  userEmail: varchar("user_email"),
  userName: varchar("user_name"),
  type: varchar("type").notNull().default("feedback"),
  subject: varchar("subject"),
  message: text("message").notNull(),
  attachmentData: text("attachment_data"),
  contactEmail: varchar("contact_email"),
  status: varchar("status").default("new"),
  adminNotes: text("admin_notes"),
  device: varchar("device"),
  browser: varchar("browser"),
  path: varchar("path"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_feedback_created").on(table.createdAt),
  index("IDX_feedback_status").on(table.status),
  index("IDX_feedback_type").on(table.type),
]);

export type FeedbackMessage = typeof feedbackMessages.$inferSelect;

export const errorLogs = pgTable("error_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id"),
  userId: varchar("user_id"),
  message: text("message").notNull(),
  stack: text("stack"),
  source: varchar("source"),
  path: varchar("path"),
  device: varchar("device"),
  browser: varchar("browser"),
  userAgent: varchar("user_agent"),
  metadata: jsonb("metadata"),
  resolved: varchar("resolved").default("false"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_errors_created").on(table.createdAt),
  index("IDX_errors_resolved").on(table.resolved),
  index("IDX_errors_session").on(table.sessionId),
]);

export type ErrorLog = typeof errorLogs.$inferSelect;

export const pageviews = pgTable("pageviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  userId: varchar("user_id"),
  path: varchar("path").notNull(),
  referrer: varchar("referrer"),
  userAgent: varchar("user_agent"),
  country: varchar("country"),
  device: varchar("device"),
  browser: varchar("browser"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_pageviews_created").on(table.createdAt),
  index("IDX_pageviews_session").on(table.sessionId),
  index("IDX_pageviews_user").on(table.userId),
  index("IDX_pageviews_path").on(table.path),
]);

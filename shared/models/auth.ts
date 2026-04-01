import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

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
  actorType: varchar("actor_type").default("individual_actor"),
  trialStartedAt: timestamp("trial_started_at"),
  trialEndsAt: timestamp("trial_ends_at"),
  inviteCode: varchar("invite_code").unique(),
  referredBy: varchar("referred_by"),
  blocked: varchar("blocked").default("false"),
  blockedAt: timestamp("blocked_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const ALL_TIERS = ["free", "pro", "comp", "internal"] as const;
export type SubscriptionTier = (typeof ALL_TIERS)[number];
export const PRO_ACCESS_TIERS: SubscriptionTier[] = ["pro", "comp", "internal"];
export function hasProAccess(tier: string | null | undefined): boolean {
  return PRO_ACCESS_TIERS.includes((tier || "free") as SubscriptionTier);
}

export function computeEffectiveTier(user: {
  subscriptionTier?: string | null;
  trialStartedAt?: string | Date | null;
  trialEndsAt?: string | Date | null;
  stripeSubscriptionId?: string | null;
}): string {
  const tier = user.subscriptionTier || "free";
  if (tier === "comp" || tier === "internal") return tier;
  if (tier === "pro" && user.stripeSubscriptionId) return "pro";
  if (user.trialEndsAt) {
    const now = new Date();
    const trialEnd = new Date(user.trialEndsAt);
    if (now < trialEnd) return "pro";
  }
  if (tier === "pro" && !user.stripeSubscriptionId) return "free";
  return tier;
}

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

// Cloud recordings for Pro users
export const recordings = pgTable("recordings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  scriptName: varchar("script_name").notNull(),
  recentScriptId: varchar("recent_script_id"),
  savedScriptId: varchar("saved_script_id"),
  performanceRunId: varchar("performance_run_id"),
  storageKey: varchar("storage_key").notNull(),
  fileSize: integer("file_size").notNull(),
  durationSeconds: integer("duration_seconds"),
  accuracy: real("accuracy"),
  mimeType: varchar("mime_type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_recordings_user").on(table.userId),
]);

export type Recording = typeof recordings.$inferSelect;
export type InsertRecording = typeof recordings.$inferInsert;

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

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminUserId: varchar("admin_user_id").notNull(),
  action: varchar("action").notNull(),
  targetUserId: varchar("target_user_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_audit_admin").on(table.adminUserId),
  index("IDX_audit_target").on(table.targetUserId),
  index("IDX_audit_created").on(table.createdAt),
  index("IDX_audit_action").on(table.action),
]);

export const adminSettings = pgTable("admin_settings", {
  key: varchar("key").primaryKey(),
  value: varchar("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by"),
});

export const ACTOR_TYPES = ["individual_actor", "student", "coach", "school_admin"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

export const changelogEntries = pgTable("changelog_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  category: varchar("category").default("improvement"),
  version: varchar("version"),
  publishedAt: timestamp("published_at").defaultNow(),
  createdBy: varchar("created_by"),
}, (table) => [
  index("IDX_changelog_published").on(table.publishedAt),
]);

export type ChangelogEntry = typeof changelogEntries.$inferSelect;
export type InsertChangelogEntry = typeof changelogEntries.$inferInsert;

export const invites = pgTable("invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  senderName: varchar("sender_name").notNull(),
  recipientEmail: varchar("recipient_email"),
  scriptName: varchar("script_name"),
  roleName: varchar("role_name"),
  status: varchar("status").default("pending"),
  acceptedBy: varchar("accepted_by"),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_invites_sender").on(table.senderId),
  index("IDX_invites_status").on(table.status),
]);

export type Invite = typeof invites.$inferSelect;
export type InsertInvite = typeof invites.$inferInsert;

export const salesInquiries = pgTable("sales_inquiries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  name: varchar("name").notNull(),
  email: varchar("email").notNull(),
  organization: varchar("organization"),
  planType: varchar("plan_type").notNull(),
  teamSize: varchar("team_size"),
  message: text("message"),
  status: varchar("status").default("new"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_sales_inquiries_status").on(table.status),
  index("IDX_sales_inquiries_plan").on(table.planType),
]);

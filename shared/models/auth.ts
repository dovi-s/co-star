import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";

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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

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

import { z } from "zod";

export const voicePresetSchema = z.enum(["natural", "deadpan", "theatrical"]);
export type VoicePreset = z.infer<typeof voicePresetSchema>;

export const emotionStyleSchema = z.enum([
  "neutral",
  "happy", 
  "sad",
  "angry",
  "sarcastic",
  "fearful",
  "excited",
  "whisper",
  "urgent"
]);
export type EmotionStyle = z.infer<typeof emotionStyleSchema>;

export const roleSchema = z.object({
  id: z.string(),
  name: z.string(),
  voicePreset: voicePresetSchema.default("natural"),
  isUserRole: z.boolean().default(false),
  lineCount: z.number().default(0),
});
export type Role = z.infer<typeof roleSchema>;

export const scriptLineSchema = z.object({
  id: z.string(),
  lineNumber: z.number(),
  roleId: z.string(),
  roleName: z.string(),
  text: z.string(),
  direction: z.string().optional(),
  isBookmarked: z.boolean().default(false),
  emotionHint: emotionStyleSchema.optional(),
});
export type ScriptLine = z.infer<typeof scriptLineSchema>;

export const sceneSchema = z.object({
  id: z.string(),
  name: z.string(),
  lines: z.array(scriptLineSchema),
});
export type Scene = z.infer<typeof sceneSchema>;

export const memorizationModeSchema = z.enum(["off", "partial", "cue", "full"]);
export type MemorizationMode = z.infer<typeof memorizationModeSchema>;

export const sessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  roles: z.array(roleSchema),
  scenes: z.array(sceneSchema),
  userRoleId: z.string().nullable(),
  currentLineIndex: z.number().default(0),
  currentSceneIndex: z.number().default(0),
  isPlaying: z.boolean().default(false),
  ambientEnabled: z.boolean().default(false),
  memorizationMode: memorizationModeSchema.default("off"),
  runsCompleted: z.number().default(0),
  linesRehearsed: z.number().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Session = z.infer<typeof sessionSchema>;

export const insertSessionSchema = z.object({
  name: z.string().min(1),
  rawScript: z.string().min(1),
});
export type InsertSession = z.infer<typeof insertSessionSchema>;

export const updateSessionSchema = z.object({
  userRoleId: z.string().optional(),
  currentLineIndex: z.number().optional(),
  currentSceneIndex: z.number().optional(),
  isPlaying: z.boolean().optional(),
  ambientEnabled: z.boolean().optional(),
  memorizationMode: memorizationModeSchema.optional(),
  runsCompleted: z.number().optional(),
  linesRehearsed: z.number().optional(),
  name: z.string().optional(),
});
export type UpdateSession = z.infer<typeof updateSessionSchema>;

export const bookmarkSchema = z.object({
  lineId: z.string(),
  isBookmarked: z.boolean(),
});
export type BookmarkUpdate = z.infer<typeof bookmarkSchema>;

export const roleUpdateSchema = z.object({
  roleId: z.string(),
  voicePreset: voicePresetSchema,
});
export type RoleUpdate = z.infer<typeof roleUpdateSchema>;

export const prosodyParamsSchema = z.object({
  rate: z.number().min(0.5).max(2).default(1),
  pitch: z.number().min(-2).max(2).default(0),
  volume: z.number().min(0).max(1).default(1),
  breakMs: z.number().min(0).max(2000).default(0),
});
export type ProsodyParams = z.infer<typeof prosodyParamsSchema>;

export const parsedScriptSchema = z.object({
  roles: z.array(roleSchema),
  scenes: z.array(sceneSchema),
});
export type ParsedScript = z.infer<typeof parsedScriptSchema>;

export { users, insertUserSchema } from "./user-schema";
export type { User, InsertUser } from "./user-schema";

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
  context: z.string().optional(), // Action/stage direction preceding this line
  isBookmarked: z.boolean().default(false),
  emotionHint: emotionStyleSchema.optional(),
});
export type ScriptLine = z.infer<typeof scriptLineSchema>;

export const sceneSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(), // Scene setting/action after the heading
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
  playbackSpeed: z.number().min(0.5).max(1.5).default(1.0), // 0.5x to 1.5x speed
  runsCompleted: z.number().default(0),
  linesRehearsed: z.number().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const userStatsSchema = z.object({
  currentStreak: z.number().default(0),
  longestStreak: z.number().default(0),
  totalSessions: z.number().default(0),
  totalLinesRehearsed: z.number().default(0),
  totalRunsCompleted: z.number().default(0),
  lastRehearsalDate: z.string().nullable(),
  dailyGoal: z.number().default(50),
  todayLines: z.number().default(0),
  achievements: z.array(z.string()).default([]),
});
export type UserStats = z.infer<typeof userStatsSchema>;
export type Session = z.infer<typeof sessionSchema>;

export const insertSessionSchema = z.object({
  name: z.string().min(1),
  rawScript: z.string().min(1),
});
export type InsertSession = z.infer<typeof insertSessionSchema>;

export const updateSessionSchema = z.object({
  userRoleId: z.string().nullable().optional(),
  currentLineIndex: z.number().optional(),
  currentSceneIndex: z.number().optional(),
  isPlaying: z.boolean().optional(),
  ambientEnabled: z.boolean().optional(),
  memorizationMode: memorizationModeSchema.optional(),
  playbackSpeed: z.number().min(0.5).max(1.5).optional(),
  runsCompleted: z.number().optional(),
  linesRehearsed: z.number().optional(),
  name: z.string().optional(),
  roles: z.array(roleSchema).optional(),
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

// ============================================
// MULTIPLAYER TABLE READ TYPES
// ============================================

export const participantSchema = z.object({
  id: z.string(),
  name: z.string(),
  roleId: z.string().nullable(),
  isHost: z.boolean().default(false),
  isReady: z.boolean().default(false),
  recordingOptOut: z.boolean().default(false), // User opts out of being recorded
  joinedAt: z.string(),
});
export type Participant = z.infer<typeof participantSchema>;

export const roomStateSchema = z.enum(["lobby", "counting_down", "rehearsing", "paused", "completed"]);
export type RoomState = z.infer<typeof roomStateSchema>;

export const roomSchema = z.object({
  id: z.string(),
  code: z.string(), // Short 6-char code for joining
  hostId: z.string(),
  state: roomStateSchema.default("lobby"),
  participants: z.array(participantSchema),
  // Script data (copied from session so room is self-contained)
  scriptName: z.string(),
  roles: z.array(roleSchema),
  scenes: z.array(sceneSchema),
  // Playback state (synced across all participants)
  currentSceneIndex: z.number().default(0),
  currentLineIndex: z.number().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Room = z.infer<typeof roomSchema>;

// WebRTC signaling types
export const rtcOfferSchema = z.object({
  type: z.literal("offer"),
  sdp: z.string(),
});

export const rtcAnswerSchema = z.object({
  type: z.literal("answer"),
  sdp: z.string(),
});

export const rtcIceCandidateSchema = z.object({
  candidate: z.string(),
  sdpMid: z.string().nullable(),
  sdpMLineIndex: z.number().nullable(),
});

// Client -> Server events
export const roomEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("create_room"), scriptName: z.string(), roles: z.array(roleSchema), scenes: z.array(sceneSchema), hostName: z.string() }),
  z.object({ type: z.literal("join_room"), code: z.string(), participantName: z.string() }),
  z.object({ type: z.literal("leave_room") }),
  z.object({ type: z.literal("select_role"), roleId: z.string().nullable() }),
  z.object({ type: z.literal("set_ready"), ready: z.boolean() }),
  z.object({ type: z.literal("start_rehearsal") }), // Host only
  z.object({ type: z.literal("pause_rehearsal") }), // Host only
  z.object({ type: z.literal("resume_rehearsal") }), // Host only
  z.object({ type: z.literal("next_line") }), // Host or current speaker
  z.object({ type: z.literal("prev_line") }), // Host only
  z.object({ type: z.literal("go_to_line"), lineIndex: z.number() }), // Host only
  z.object({ type: z.literal("go_to_scene"), sceneIndex: z.number() }), // Host only
  z.object({ type: z.literal("line_complete"), lineId: z.string() }), // Current speaker signals done
  z.object({ type: z.literal("kick_participant"), participantId: z.string() }), // Host only
  z.object({ type: z.literal("transfer_host"), newHostId: z.string() }), // Host only
  z.object({ type: z.literal("set_recording_opt_out"), optOut: z.boolean() }), // Any participant
  // WebRTC signaling events
  z.object({ type: z.literal("rtc_offer"), targetId: z.string(), offer: rtcOfferSchema }),
  z.object({ type: z.literal("rtc_answer"), targetId: z.string(), answer: rtcAnswerSchema }),
  z.object({ type: z.literal("rtc_ice_candidate"), targetId: z.string(), candidate: rtcIceCandidateSchema }),
]);
export type RoomEvent = z.infer<typeof roomEventSchema>;

// Server -> Client events
export const roomUpdateSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("room_created"), room: roomSchema, participantId: z.string() }),
  z.object({ type: z.literal("room_joined"), room: roomSchema, participantId: z.string() }),
  z.object({ type: z.literal("room_updated"), room: roomSchema }),
  z.object({ type: z.literal("room_error"), message: z.string() }),
  z.object({ type: z.literal("kicked") }),
  z.object({ type: z.literal("room_closed") }),
  // WebRTC signaling events (relayed from other participants)
  z.object({ type: z.literal("rtc_offer"), fromId: z.string(), offer: rtcOfferSchema }),
  z.object({ type: z.literal("rtc_answer"), fromId: z.string(), answer: rtcAnswerSchema }),
  z.object({ type: z.literal("rtc_ice_candidate"), fromId: z.string(), candidate: rtcIceCandidateSchema }),
  z.object({ type: z.literal("participant_joined"), participantId: z.string() }), // Trigger peer connection
  z.object({ type: z.literal("participant_left"), participantId: z.string() }), // Close peer connection
]);
export type RoomUpdate = z.infer<typeof roomUpdateSchema>;

export { users, insertUserSchema } from "./user-schema";
export type { User, InsertUser } from "./user-schema";

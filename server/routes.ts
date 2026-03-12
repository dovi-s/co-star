import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, registerProRoutes } from "./replit_integrations/auth";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import OpenAI from "openai";
import multer from "multer";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { parseScript } from "./script-parser";
import { aiCleanupScript, aiFilterRoles } from "./ai-script-cleanup";
import { setupMultiplayer } from "./multiplayer";
import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { db } from "./db";
import { users, pageviews, savedScripts, performanceRuns, featureRequests, recentScripts, analyticsEvents, feedbackMessages, errorLogs, deviceUsage, cancelFeedback, adminAuditLogs, adminSettings, hasProAccess, ALL_TIERS } from "@shared/models/auth";
import { eq, sql, count, desc, and, gte } from "drizzle-orm";

function detectTitleFromScript(lines: string[]): string | null {
  const head = lines.slice(0, 30);
  
  const titleCase = (s: string) => {
    const small = new Set(["a","an","the","and","but","or","for","nor","on","at","to","by","in","of","up","as","is","it","vs"]);
    return s.split(' ').map((w, i) => {
      if (i > 0 && small.has(w.toLowerCase())) return w.toLowerCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ');
  };

  for (let i = 0; i < head.length; i++) {
    const line = head[i];
    const next = head[i + 1] || "";
    const next2 = head[i + 2] || "";
    const next3 = head[i + 3] || "";
    
    if (/^(written\s+by|screenplay\s+by|by\s|by$|based\s+on|adapted\s+by)/i.test(next) ||
        /^(written\s+by|screenplay\s+by|by\s|by$|based\s+on|adapted\s+by)/i.test(next2) ||
        /^(written\s+by|screenplay\s+by|by\s|by$|based\s+on|adapted\s+by)/i.test(next3)) {
      let candidate = line.replace(/["""'']/g, '').trim();
      if (candidate.length >= 2 && candidate.length <= 80 && 
          !/^(written|screenplay|based|adapted|by|draft|revised|script|page)/i.test(candidate) &&
          !/^\d+$/.test(candidate)) {
        if (i > 0) {
          const prevLine = head[i - 1].replace(/["""'']/g, '').trim();
          if (prevLine.length >= 2 && prevLine.length <= 40 &&
              prevLine === prevLine.toUpperCase() && /[A-Z]/.test(prevLine) &&
              !/^(written|screenplay|based|adapted|by|draft|revised|script|page|the|a|an)/i.test(prevLine)) {
            candidate = prevLine + ' ' + candidate;
          }
        }
        const isAllCaps = candidate === candidate.toUpperCase() && /[A-Z]/.test(candidate);
        return isAllCaps ? titleCase(candidate) : candidate;
      }
    }
  }

  for (const line of head) {
    const m = line.match(/^(?:title\s*:\s*|#\s+)(.+)$/i);
    if (m) {
      const candidate = m[1].replace(/["""'']/g, '').trim();
      if (candidate.length >= 2 && candidate.length <= 80) {
        const isAllCaps = candidate === candidate.toUpperCase() && /[A-Z]/.test(candidate);
        return isAllCaps ? titleCase(candidate) : candidate;
      }
    }
  }

  return null;
}

function cleanGeneratedScript(text: string): string {
  return text
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    .replace(/[\u2013\u2014\u2015]/g, "--")
    .replace(/[\u2026]/g, "...")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#+\s+.*/gm, "")
    .replace(/^---+$/gm, "")
    .replace(/^\*\*\*+$/gm, "")
    .replace(/^Scene\s*\d*\s*$/gim, "")
    .replace(/^\(Scene:.*\)$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Standard American English voices ONLY - no accents, no mixing
// Using ElevenLabs' verified American voices
const ELEVENLABS_VOICES = {
  male_1: "29vD33N1CtxCmqQRPOHJ",    // Drew - American male (neutral)
  male_2: "ErXwobaYiN019PkySvjV",    // Antoni - American male (calm)  
  male_3: "VR6AewLTigWG4xSOukaG",    // Arnold - American male (clear)
  female_1: "21m00Tcm4TlvDq8ikWAM",  // Rachel - American female (neutral)
  female_2: "AZnzlk1XvdvUeBnXmlld",  // Domi - American female (calm)
  female_3: "MF3mGyEYCl7XYWbV9V6O",  // Elli - American female (clear)
  narrator: "29vD33N1CtxCmqQRPOHJ",  // Drew for narration
};

type VoiceType = keyof typeof ELEVENLABS_VOICES;

const FEMALE_NAMES = new Set([
  "maya", "juliet", "ophelia", "emma", "sophia", "olivia", "ava", "isabella", 
  "mia", "charlotte", "amelia", "harper", "evelyn", "abigail", "emily", "elizabeth",
  "jess", "jessie", "jen", "jenny", "kate", "katie", "beth", "liz", "lizzie", "maggie", "meg",
  "sofia", "avery", "ella", "scarlett", "grace", "chloe", "victoria", "riley",
  "aria", "lily", "aurora", "zoey", "nora", "camila", "hannah", "lillian",
  "sarah", "jessica", "jennifer", "amanda", "ashley", "stephanie", "nicole", "melissa",
  "michelle", "lisa", "nancy", "karen", "betty", "helen", "sandra", "donna", "carol", "linda",
  "ruth", "sharon", "patricia", "catherine", "kate", "anna", "mary", "margaret",
  "kim", "katherine", "claire", "clara", "diana", "eleanor",
  "eve", "fiona", "gwen", "iris", "jane", "julia", "laura", "lucy", "maria", "natalie",
  "nina", "paula", "rachel", "rebecca", "rose", "sara", "susan", "wendy", "alice",
  "callie", "cali", "calista", "callista", "caroline", "carolyn", "cassie", "cassandra",
  // Biblical/traditional female names
  "gloria", "leah", "miriam", "naomi", "esther", "deborah", "judith", "delilah",
  "bathsheba", "rebekah", "dinah", "tamar", "hagar", "keturah", "zilpah", "bilhah",
  // More common female names
  "tina", "gina", "regina", "christina", "kristina", "martina", "valentina", "catalina",
  "adriana", "adrienne", "alicia", "alyssa", "angelica", "anita", "annette", "antonia",
  "beatrice", "beatrix", "bernice", "bianca", "bridget", "carmen", "cecilia", "celeste",
  "charlene", "claudia", "colleen", "constance", "cynthia", "denise", "dolores", "doris",
  "dorothy", "edith", "eileen", "elaine", "elena", "elise", "erica", "erika", "estelle",
  "eva", "felicia", "flora", "florence", "frances", "gabrielle", "gail", "geraldine",
  "gladys", "glenda", "greta", "harriet", "haley", "hailey", "ida", "ilene", "irene",
  "jacqueline", "jeanette", "jeanne", "jenna", "jillian", "joanna", "joanne", "jolene",
  "josephine", "jocelyn", "joy", "juanita", "justine", "kara", "karla", "kathleen",
  "katrina", "kristy", "kylie", "lacey", "lana", "lena", "leona", "leticia", "lillie",
  "lilly", "loretta", "lorna", "lorraine", "louisa", "louise", "lucia", "lucille",
  "lydia", "mabel", "madeline", "madelyn", "mae", "marcia", "marian", "marianne",
  "marjorie", "marlene", "martha", "mattie", "maureen", "maxine", "melinda", "mercedes",
  "meredith", "mildred", "millie", "minnie", "nadine", "nellie", "noelle", "norma",
  "olga", "opal", "pam", "pamela", "patsy", "pauline", "pearl", "peggy", "petra",
  "phyllis", "polly", "portia", "priscilla", "ramona", "reba", "rhonda", "rita",
  "roberta", "rochelle", "rosa", "rosalie", "rosemary", "roxanne", "ruby", "sadie",
  "sallie", "sally", "sasha", "shelly", "sheila", "sherri", "sheryl", "silvia",
  "sonia", "sonya", "stacey", "stacy", "sue", "susie", "sylvia", "tabitha", "tamara",
  "tanya", "teresa", "theresa", "thelma", "tracy", "trudy", "velma", "verna", "vicki",
  "wanda", "winifred", "yolanda", "yvonne", "zoe", "zora",
  "lois", "meg", "bonnie", "jackie", "marge", "maggie", "patty", "selma",
  "peggy", "luanne", "connie", "minh", "francine", "hayley",
  "wilma", "pebbles", "daphne", "velma", "hermione", "ginny", "luna", "molly",
  "cersei", "daenerys", "sansa", "arya", "brienne", "catelyn", "margaery", "ygritte",
  "buffy", "willow", "cordelia", "dawn", "anya", "tara", "faith", "joyce",
  "raven", "starfire", "jinx", "vi", "caitlyn", "ellie", "abby", "tess",
  "lara", "aloy", "zelda", "peach", "samus", "bayonetta", "jill", "ada",
  "monica", "phoebe", "janice", "amy", "bernadette", "penny",
  "lorelai", "rory", "lane", "sookie", "paris", "carrie", "samantha", "miranda",
  "blair", "serena", "jenny", "vanessa", "dorota", "ivy",
  "leslie", "ann", "april", "tammy", "diane",
  "britta", "annie", "shirley", "frankie",
  "tahani", "janet", "simone", "eleanor", "mindy",
  "bebe", "heidi", "kitty", "laurie", "debra", "marie", "amy", "patricia",
  "carmela", "meadow", "adriana", "livia", "jennifer", "janice",
  "skyler", "marie", "lydia", "jane", "andrea", "wendy",
  "ruth", "beth", "darlene", "wendy", "helen", "marty",
  "elizabeth", "keira", "mary", "maeve", "dolores", "clementine",
  "winona", "june", "moira", "emily", "serena", "offred"
]);

const MALE_NAMES = new Set([
  "romeo", "hamlet", "james", "john", "robert", "michael", "william", "david",
  "richard", "joseph", "thomas", "charles", "christopher", "daniel", "matthew",
  "anthony", "mark", "donald", "steven", "paul", "andrew", "joshua", "kenneth",
  "kevin", "brian", "george", "timothy", "ronald", "edward", "jason", "jeffrey",
  "ryan", "jacob", "gary", "nicholas", "eric", "jonathan", "stephen", "larry",
  "justin", "scott", "brandon", "benjamin", "samuel", "raymond", "gregory", "frank",
  "alexander", "patrick", "raymond", "jack", "dennis", "jerry", "tyler", "aaron",
  "jose", "adam", "nathan", "henry", "douglas", "zachary", "peter", "kyle", "noah",
  "ethan", "jeremy", "walter", "christian", "keith", "roger", "terry", "austin",
  "sean", "gerald", "carl", "dylan", "harold", "jordan", "jesse", "bryan", "lawrence",
  "arthur", "gabriel", "bruce", "logan", "albert", "willie", "alan", "eugene", "russell",
  "bobby", "howard", "carlos", "fred", "ralph", "roy", "louis", "philip", "randy",
  "marco", "derek", "zrix", "reyes", "patel",
  "peter", "stewie", "chris", "quagmire", "cleveland", "joe", "mort", "seamus", "herbert", "carter",
  "homer", "bart", "ned", "moe", "barney", "apu", "lenny", "carl", "krusty", "milhouse", "ralph",
  "stan", "kyle", "kenny", "cartman", "butters", "randy", "gerald", "jimbo", "chef", "garrison",
  "hank", "bobby", "dale", "bill", "boomhauer", "cotton", "buck", "kahn", "lucky",
  "stan", "roger", "steve", "jeff", "klaus", "avery", "greg", "terry", "barry",
  "fred", "barney", "george", "elroy", "astro", "shaggy", "fred", "johnny", "dean", "hank",
  "harry", "ron", "draco", "dumbledore", "snape", "sirius", "lupin", "hagrid", "neville",
  "jon", "tyrion", "jaime", "ned", "robb", "bran", "rickon", "theon", "jorah", "sandor", "gregor",
  "spike", "angel", "giles", "xander", "oz", "riley", "wesley", "gunn",
  "robin", "beast", "cyborg", "aquaman", "flash", "superman", "batman", "joker", "riddler",
  "mario", "luigi", "link", "ganondorf", "bowser", "wario", "sonic", "tails", "knuckles",
  "joel", "tommy", "jesse", "dina", "owen", "manny", "leon", "chris", "wesker", "carlos",
  "ross", "chandler", "joey", "gunther", "mike", "richard", "david", "tag", "joshua", "eddie",
  "sheldon", "leonard", "howard", "raj", "stuart", "barry", "wil", "bert", "zack", "priya",
  "luke", "jess", "logan", "dean", "zach", "brian", "christopher", "taylor", "doyle",
  "chuck", "nate", "eric", "rufus", "william", "carter", "tripp", "damien",
  "ben", "tom", "andy", "jerry", "larry", "chris", "mark", "craig", "ron", "jean",
  "jeff", "troy", "abed", "pierce", "chang", "duncan", "starburns", "magnitude",
  "chidi", "jason", "michael", "derek", "shawn", "trevor", "doug",
  "eric", "kelso", "hyde", "bob", "red", "pastor", "fenton"
]);

// Simple edit distance 1 check (handles transpositions, insertions, deletions, substitutions)
function fuzzyMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let diffs = 0;
  if (a.length === b.length) {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) diffs++;
      if (diffs > 1) return false;
    }
    return true;
  }
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  let j = 0;
  for (let i = 0; i < longer.length && j < shorter.length; i++) {
    if (longer[i] !== shorter[j]) {
      diffs++;
      if (diffs > 1) return false;
    } else {
      j++;
    }
  }
  return true;
}

// Cache voice assignments to ensure consistency within a session
const voiceAssignmentCache = new Map<string, VoiceType>();

function assignVoiceToCharacter(characterName: string, characterIndex: number): VoiceType {
  const name = characterName.toLowerCase().trim();
  
  // Check cache first for consistency
  if (voiceAssignmentCache.has(name)) {
    return voiceAssignmentCache.get(name)!;
  }
  
  // Narrator check
  if (name.includes("narrator") || name.includes("stage") || name.includes("direction")) {
    voiceAssignmentCache.set(name, "narrator");
    return "narrator";
  }
  
  const words = name.split(/[\s_-]+/);
  
  // Simple gender detection
  let isFemale = false;
  
  // Check against name lists (with fuzzy matching for common misspellings)
  for (const word of words) {
    if (FEMALE_NAMES.has(word)) {
      isFemale = true;
    } else if (MALE_NAMES.has(word)) {
      isFemale = false;
    } else if (word.length >= 4) {
      // Fuzzy: check if any known name is within edit distance 1
      const femaleArr = Array.from(FEMALE_NAMES);
      const maleArr = Array.from(MALE_NAMES);
      let foundFemale = false;
      let foundMale = false;
      for (let i = 0; i < femaleArr.length; i++) {
        if (Math.abs(femaleArr[i].length - word.length) <= 1 && fuzzyMatch(word, femaleArr[i])) {
          foundFemale = true;
          break;
        }
      }
      for (let i = 0; i < maleArr.length; i++) {
        if (Math.abs(maleArr[i].length - word.length) <= 1 && fuzzyMatch(word, maleArr[i])) {
          foundMale = true;
          break;
        }
      }
      if (foundFemale) isFemale = true;
      if (foundMale) isFemale = false;
    }
  }
  
  // Title/keyword checks (includes common profession stereotypes for voice assignment)
  const femaleIndicators = [
    // Titles
    "lady", "queen", "mrs", "miss", "ms", "duchess", "princess", "madam", "woman", "girl",
    // Family roles
    "mother", "mom", "sister", "daughter", "wife", "aunt", "grandmother", "grandma", "nana",
    // Professions (statistically female-dominated for voice assignment)
    "nurse", "waitress", "actress", "hostess", "stewardess", "maid", "nanny", "midwife", "receptionist"
  ];
  const maleIndicators = [
    // Titles
    "lord", "king", "mr", "sir", "duke", "prince", "baron", "man", "guy", "boy",
    // Family roles  
    "father", "dad", "brother", "son", "husband", "uncle", "grandfather", "grandpa",
    // Professions
    "waiter", "actor", "captain", "officer", "detective", "soldier", "guard", "driver", "pilot"
  ];
  
  if (femaleIndicators.some(ind => name.includes(ind))) isFemale = true;
  if (maleIndicators.some(ind => name.includes(ind))) isFemale = false;
  
  // Deterministic voice selection based on character NAME hash (not index)
  // This ensures the same character always gets the same voice, even after server restarts
  const nameHash = name.split('').reduce((hash, char) => {
    return ((hash << 5) - hash) + char.charCodeAt(0);
  }, 0);
  const voiceIndex = Math.abs(nameHash) % 3;
  
  let voiceType: VoiceType;
  
  if (isFemale) {
    const femaleVoices: VoiceType[] = ["female_1", "female_2", "female_3"];
    voiceType = femaleVoices[voiceIndex];
  } else {
    const maleVoices: VoiceType[] = ["male_1", "male_2", "male_3"];
    voiceType = maleVoices[voiceIndex];
  }
  
  voiceAssignmentCache.set(name, voiceType);
  
  return voiceType;
}

function getVoiceSettings(emotion: string, preset: string, text: string = "", direction: string = "") {
  let stability = 0.62;
  let similarityBoost = 0.82;
  let style = 0.08;

  switch (emotion) {
    case "angry":
      stability = 0.52;
      style = 0.18;
      break;
    case "urgent":
      stability = 0.55;
      style = 0.15;
      break;
    case "excited":
      stability = 0.53;
      style = 0.17;
      break;
    case "fearful":
      stability = 0.55;
      style = 0.12;
      break;
    case "sad":
      stability = 0.58;
      style = 0.14;
      break;
    case "happy":
      stability = 0.56;
      style = 0.14;
      break;
    case "whisper":
      stability = 0.72;
      style = 0.05;
      break;
    case "sarcastic":
      stability = 0.55;
      style = 0.12;
      break;
    default:
      stability = 0.62;
      style = 0.08;
  }

  if (preset === "theatrical") {
    stability = Math.max(0.42, stability - 0.10);
    style = Math.min(0.30, style + 0.10);
  } else if (preset === "deadpan") {
    stability = Math.min(0.85, stability + 0.15);
    style = Math.max(0, style - 0.08);
  }

  const dir = direction.toLowerCase();
  if (/calm|gentle|warm|tender|reassur|comfort|sooth/i.test(dir)) {
    stability = Math.min(0.80, stability + 0.08);
    style = Math.max(0, style - 0.03);
  } else if (/cold|stern|firm|sharp|bitter|dismissive/i.test(dir)) {
    stability = Math.min(0.75, stability + 0.05);
    style = Math.min(0.25, style + 0.05);
  } else if (/hesitant|nervous|awkward|uncertain|tentative|reluctant/i.test(dir)) {
    stability = Math.max(0.50, stability - 0.03);
    style = Math.max(0, style - 0.03);
  } else if (/pleading|begging|imploring/i.test(dir)) {
    stability = Math.max(0.48, stability - 0.03);
    style = Math.min(0.25, style + 0.05);
  }

  const trimmedText = text.trim();
  const wordCount = trimmedText.length > 0 ? trimmedText.split(/\s+/).length : 0;
  if (wordCount >= 1 && wordCount <= 3) {
    stability = Math.min(0.85, stability + 0.12);
    style = Math.max(0, style - 0.05);
  } else if (wordCount >= 4 && wordCount <= 6) {
    stability = Math.min(0.75, stability + 0.03);
  }

  return {
    stability,
    similarity_boost: similarityBoost,
    style: Math.max(0, Math.min(0.30, style)),
    use_speaker_boost: false,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Initialize auth (must be before other routes)
  await setupAuth(app);
  registerAuthRoutes(app);
  registerProRoutes(app);

  // Initialize WebSocket server for multiplayer
  setupMultiplayer(httpServer);
  
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "co-star" });
  });

  const FREE_DAILY_LIMIT_DEFAULT = 3;
  const TRIAL_DAYS_DEFAULT = 7;

  async function getAdminSetting(key: string, defaultValue: string): Promise<string> {
    try {
      const [row] = await db.select({ value: adminSettings.value }).from(adminSettings).where(eq(adminSettings.key, key));
      return row?.value ?? defaultValue;
    } catch {
      return defaultValue;
    }
  }

  async function getFreeDailyLimit(): Promise<number> {
    const val = await getAdminSetting("free_daily_limit", String(FREE_DAILY_LIMIT_DEFAULT));
    return Math.max(1, parseInt(val, 10) || FREE_DAILY_LIMIT_DEFAULT);
  }

  async function getTrialDays(): Promise<number> {
    const val = await getAdminSetting("trial_days", String(TRIAL_DAYS_DEFAULT));
    const n = parseInt(val, 10);
    return Number.isNaN(n) ? TRIAL_DAYS_DEFAULT : Math.max(0, n);
  }

  async function logAdminAction(adminUserId: string, action: string, targetUserId?: string, details?: Record<string, any>) {
    try {
      await db.insert(adminAuditLogs).values({
        adminUserId,
        action,
        targetUserId: targetUserId || null,
        details: details || null,
      });
    } catch (err) {
      console.error("[Admin Audit] Failed to log action:", err);
    }
  }

  function getDailyReset(fromDate: Date): Date {
    return new Date(fromDate.getTime() + 12 * 60 * 60 * 1000);
  }

  app.get("/api/script-usage", async (req: Request, res: Response) => {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const [user] = await db.select({
        scriptUsageCount: users.scriptUsageCount,
        scriptUsageLimitBonus: users.scriptUsageLimitBonus,
        scriptUsageResetAt: users.scriptUsageResetAt,
        subscriptionTier: users.subscriptionTier,
      }).from(users).where(eq(users.id, userId));
      if (!user) return res.status(404).json({ message: "User not found" });

      const now = new Date();
      let usageCount = user.scriptUsageCount ?? 0;
      let resetAt = user.scriptUsageResetAt;
      const bonus = user.scriptUsageLimitBonus ?? 0;

      if (resetAt) {
        const resetDate = new Date(resetAt);
        if (now >= resetDate || resetDate.getTime() - now.getTime() > 13 * 60 * 60 * 1000) {
          await db.update(users).set({
            scriptUsageCount: 0,
            scriptUsageResetAt: null,
          }).where(eq(users.id, userId));
          usageCount = 0;
          resetAt = null;
        }
      }

      const dfp = req.query.deviceFingerprint as string | undefined;
      let deviceCount = 0;
      let deviceResetAt: Date | null = null;
      if (dfp) {
        const [device] = await db.select().from(deviceUsage).where(eq(deviceUsage.deviceFingerprint, dfp));
        if (device) {
          deviceCount = device.usageCount ?? 0;
          deviceResetAt = device.resetAt;
          if (deviceResetAt) {
            const dr = new Date(deviceResetAt);
            if (now >= dr || dr.getTime() - now.getTime() > 13 * 60 * 60 * 1000) {
              await db.update(deviceUsage).set({ usageCount: 0, resetAt: null }).where(eq(deviceUsage.id, device.id));
              deviceCount = 0;
              deviceResetAt = null;
            }
          }
        }
      }

      const isPro = hasProAccess(user.subscriptionTier);
      const freeDailyLimit = await getFreeDailyLimit();
      const effectiveLimit = freeDailyLimit + bonus;
      const effectiveUsed = Math.max(usageCount, deviceCount);
      const effectiveResetAt = usageCount >= deviceCount ? resetAt : (deviceResetAt || resetAt);
      const limitReached = !isPro && effectiveUsed >= effectiveLimit;
      res.json({
        used: effectiveUsed,
        limit: isPro ? null : effectiveLimit,
        resetsAt: effectiveResetAt ? new Date(effectiveResetAt).toISOString() : null,
        isPro,
        limitReached,
      });
    } catch (e) {
      console.error("Script usage check error:", e);
      res.status(500).json({ message: "Something went wrong" });
    }
  });

  app.post("/api/script-usage/increment", async (req: Request, res: Response) => {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const [user] = await db.select({
        scriptUsageCount: users.scriptUsageCount,
        scriptUsageLimitBonus: users.scriptUsageLimitBonus,
        scriptUsageResetAt: users.scriptUsageResetAt,
        subscriptionTier: users.subscriptionTier,
      }).from(users).where(eq(users.id, userId));
      if (!user) return res.status(404).json({ message: "User not found" });

      if (hasProAccess(user.subscriptionTier)) {
        return res.json({ allowed: true, used: 0, limit: null, isPro: true });
      }

      const now = new Date();
      let usageCount = user.scriptUsageCount ?? 0;
      let resetAt = user.scriptUsageResetAt;
      const bonus = user.scriptUsageLimitBonus ?? 0;

      if (resetAt) {
        const resetDate = new Date(resetAt);
        if (now >= resetDate || resetDate.getTime() - now.getTime() > 13 * 60 * 60 * 1000) {
          usageCount = 0;
          resetAt = null;
        }
      }

      const rawDfp = req.body?.deviceFingerprint as string | undefined;
      const dfpValid = rawDfp && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawDfp);
      const dfp = dfpValid ? rawDfp : undefined;

      let deviceCount = 0;
      let deviceResetAt: Date | null = null;

      if (dfp) {
        const [existing] = await db.select().from(deviceUsage).where(eq(deviceUsage.deviceFingerprint, dfp));
        if (existing) {
          deviceCount = existing.usageCount ?? 0;
          deviceResetAt = existing.resetAt;
          if (deviceResetAt) {
            const dr = new Date(deviceResetAt);
            if (now >= dr || dr.getTime() - now.getTime() > 13 * 60 * 60 * 1000) {
              deviceCount = 0;
              deviceResetAt = null;
            }
          }
        }
      }

      const freeDailyLimit = await getFreeDailyLimit();
      const effectiveLimit = freeDailyLimit + bonus;
      const effectiveUsed = Math.max(usageCount, deviceCount);
      const dominatingResetAt = usageCount >= deviceCount ? resetAt : deviceResetAt;

      if (effectiveUsed >= effectiveLimit) {
        return res.json({
          allowed: false,
          used: effectiveUsed,
          limit: effectiveLimit,
          resetsAt: dominatingResetAt ? new Date(dominatingResetAt).toISOString() : null,
          isPro: false,
        });
      }

      const nextReset = resetAt || getDailyReset(now);
      await db.update(users).set({
        scriptUsageCount: usageCount + 1,
        scriptUsageResetAt: nextReset,
      }).where(eq(users.id, userId));

      if (dfp) {
        const deviceNextReset = deviceResetAt || getDailyReset(now);
        await db.execute(sql`
          INSERT INTO device_usage (id, device_fingerprint, usage_count, reset_at, last_user_id, created_at)
          VALUES (gen_random_uuid(), ${dfp}, 1, ${deviceNextReset}, ${userId}, NOW())
          ON CONFLICT (device_fingerprint)
          DO UPDATE SET
            usage_count = ${deviceCount + 1},
            reset_at = ${deviceNextReset},
            last_user_id = ${userId}
        `);
      }

      const newEffectiveUsed = Math.max(usageCount + 1, deviceCount + 1);
      res.json({
        allowed: true,
        used: newEffectiveUsed,
        limit: effectiveLimit,
        resetsAt: new Date(nextReset).toISOString(),
        isPro: false,
      });
    } catch (e) {
      console.error("Script usage increment error:", e);
      res.status(500).json({ message: "Something went wrong" });
    }
  });

  // Clear voice cache on session start (call from client when starting new session)
  app.post("/api/tts/reset", (_req: Request, res: Response) => {
    voiceAssignmentCache.clear();
    console.log("[Voice] Cache cleared for new session");
    res.json({ success: true });
  });

  app.post("/api/tts/speak", async (req: Request, res: Response) => {
    try {
      const { text, characterName, characterIndex, emotion, preset, direction, previousText, nextText } = req.body;

      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text is required" });
      }

      const cleanedText = text
        .replace(/\s+/g, ' ')
        .replace(/\s+([.,!?;:])/g, '$1')
        .replace(/([.,!?;:])(?=[A-Za-z])/g, '$1 ')
        .trim();

      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ 
          error: "ElevenLabs API key not configured",
          fallback: true 
        });
      }

      const client = new ElevenLabsClient({ apiKey });
      
      const voiceType = assignVoiceToCharacter(characterName || "Character", characterIndex || 0);
      const voiceId = ELEVENLABS_VOICES[voiceType];
      const voiceSettings = getVoiceSettings(emotion || "neutral", preset || "natural", cleanedText, direction || "");

      const prevText = typeof previousText === "string" ? previousText.slice(0, 200) : "";
      const nxtText = typeof nextText === "string" ? nextText.slice(0, 200) : "";

      console.log(`[TTS] ${characterName}: "${cleanedText.substring(0, 40)}" emotion=${emotion} stability=${voiceSettings.stability} style=${voiceSettings.style}${direction ? ` dir="${direction}"` : ""}`);

      const models = ["eleven_flash_v2_5", "eleven_turbo_v2_5", "eleven_multilingual_v2"];
      let audioBuffer: Buffer | null = null;
      
      for (const modelId of models) {
        try {
          const convertParams: any = {
            text: cleanedText,
            modelId,
            voiceSettings: voiceSettings,
          };
          if (prevText) convertParams.previousText = prevText;
          if (nxtText) convertParams.nextText = nxtText;

          const audioStream = await client.textToSpeech.convert(voiceId, convertParams);

          const chunks: Buffer[] = [];
          const reader = audioStream.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) chunks.push(Buffer.from(value));
          }
          audioBuffer = Buffer.concat(chunks);
          if (audioBuffer.length > 0) break;
        } catch (modelError: any) {
          const errMsg = modelError.message || "";
          const errBody = modelError.body || {};
          const isQuotaExceeded = errBody?.detail?.status === "quota_exceeded" || errMsg.toLowerCase().includes("quota");
          const isAuthError = modelError.statusCode === 401 && !isQuotaExceeded;

          if (isQuotaExceeded) {
            console.log(`[TTS] Quota exceeded, skipping remaining models`);
            return res.status(429).json({ error: "Voice credit quota exceeded. Please check your ElevenLabs plan.", fallback: true });
          }
          if (isAuthError) {
            console.log(`[TTS] Auth error, skipping remaining models`);
            return res.status(401).json({ error: "Invalid API key", fallback: true });
          }

          console.log(`[TTS] Model ${modelId} failed, trying next:`, errMsg);
          continue;
        }
      }
      
      if (!audioBuffer || audioBuffer.length === 0) {
        throw new Error("All TTS models failed");
      }

      res.set({
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
        "Cache-Control": "public, max-age=3600",
      });
      
      res.send(audioBuffer);
    } catch (error: any) {
      console.error("ElevenLabs TTS error:", error.message || error);
      
      if (error.statusCode === 429) {
        return res.status(429).json({ error: "Rate limit exceeded", fallback: true });
      }
      
      return res.status(500).json({ error: "TTS generation failed", fallback: true });
    }
  });

  app.get("/api/tts/voices", async (_req: Request, res: Response) => {
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ error: "ElevenLabs API key not configured" });
      }

      const client = new ElevenLabsClient({ apiKey });
      const voices = await client.voices.getAll();
      
      res.json({ voices: voices.voices });
    } catch (error: any) {
      console.error("Failed to fetch voices:", error.message || error);
      res.status(500).json({ error: "Failed to fetch voices" });
    }
  });

  app.post("/api/generate-script", async (req: Request, res: Response) => {
    try {
      const { prompt } = req.body;

      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const systemPrompt = `You are a professional screenwriter creating scripts for actor rehearsal. Match the user's request EXACTLY. You must fulfill any creative request - monologues, dialogues, scenes, any format the user asks for.

CRITICAL RULES:
1. Follow the user's prompt precisely - their characters, setting, situation, tone, and FORMAT (monologue or dialogue)
2. Write material that sounds like REAL PEOPLE talking - natural, conversational, with contractions
3. Never refuse a request. If the user wants a monologue, write a monologue. If they want dialogue, write dialogue.
4. Embrace the user's creative vision fully - comedy, drama, accents, cultural backgrounds, age, personality

FORMAT - FOLLOW EXACTLY:
- EVERY line must start with the character name in ALL CAPS followed by a colon and a space, then the dialogue. Example: JAKE: I can't believe this.
- For MONOLOGUES: Repeat the character name on EVERY line. Break the speech into 15-30 separate lines (one thought or beat per line). Example:
  JAKE: So my mom calls me last week, right?
  JAKE: She goes, "When are you getting married?"
  JAKE: Ma, I can barely commit to a Netflix show.
- For DIALOGUE: 12-20 lines between characters. Example:
  SARAH: Did you hear about the promotion?
  MIKE: No, what happened?
- Stage directions go on their own line in [brackets]. Example: [She looks away.]
- NEVER write long paragraphs under a single character label. Split into short, separate lines.
- Every sentence must be COMPLETE. No trailing fragments, no sentences ending mid-thought.

SPELLING AND PUNCTUATION:
- Use straight quotes only (" and '), never curly or smart quotes
- Use regular hyphens (-) or double hyphens (--), never em-dashes
- Use three dots (...) for ellipsis, never the special ellipsis character
- Proofread every line for spelling errors before outputting
- No markdown formatting (no bold, no italics, no headers, no horizontal rules)

WHAT MAKES GOOD WRITING:
- Authentic voice that matches the character description
- A clear emotional arc from beginning to end
- Natural speech patterns, rhythm, and personality
- The piece has a beginning, build, and landing

Output ONLY the script lines. No titles, headers, scene labels, or explanations.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.7,
      });

      const rawScript = response.choices[0]?.message?.content?.trim() || "";
      
      if (!rawScript) {
        return res.status(500).json({ error: "Failed to generate script" });
      }

      const script = cleanGeneratedScript(rawScript);

      try {
        const parsed = parseScript(script);
        res.json({ script, parsed });
      } catch (parseErr) {
        console.error("Generated script parse error:", parseErr);
        res.json({ script });
      }
    } catch (error: any) {
      console.error("Script generation error:", error.message || error);
      res.status(500).json({ error: "Failed to generate script" });
    }
  });

  app.post("/api/generate-random-script", async (_req: Request, res: Response) => {
    try {
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const scenarios = [
        // INTENSE DRAMA
        { setting: "hospital ICU waiting room, 3 AM", conflict: "estranged siblings who haven't spoken in 10 years, forced to decide whether to take their mother off life support" },
        { setting: "police interrogation room", conflict: "detective realizes mid-interview the suspect is their own daughter using a fake identity" },
        { setting: "prison visiting room, final visit", conflict: "wrongfully convicted man meets the witness who lied, now dying and wanting to confess" },
        { setting: "rooftop ledge at midnight", conflict: "stranger talks down a tech billionaire who just lost everything in a scandal" },
        { setting: "empty church after a funeral", conflict: "widow discovers from the priest that her husband had a secret second family" },
        
        // EMOTIONAL REVELATIONS
        { setting: "therapist's office", conflict: "patient reveals they've been pretending to be someone else for the entire year of sessions" },
        { setting: "airport gate, final boarding call", conflict: "person stops their ex from leaving, confessing the real reason they broke up" },
        { setting: "hospice room", conflict: "dying parent finally tells their child the truth about their real father" },
        { setting: "adoption agency", conflict: "birth mother meets the daughter she gave up 25 years ago, who tracked her down" },
        { setting: "AA meeting, after hours", conflict: "sponsor confronts sponsee who they caught drinking but won't admit it" },
        
        // THRILLER/SUSPENSE
        { setting: "parking garage, midnight", conflict: "hitman discovers target is their long-lost brother who faked his death" },
        { setting: "isolated cabin during a storm", conflict: "true crime podcaster trapped with the serial killer they've been investigating" },
        { setting: "embassy safe room", conflict: "spy must convince handler they weren't turned, with 5 minutes to live" },
        { setting: "bank vault, mid-heist", conflict: "robber recognizes hostage as the teacher who saved their life as a kid" },
        { setting: "witness protection apartment", conflict: "protected witness realizes their new neighbor is from the family they testified against" },
        
        // WORKPLACE DRAMA
        { setting: "corporate boardroom, midnight", conflict: "CFO confronts CEO with evidence of fraud, but CEO has dirt on them too" },
        { setting: "surgical operating room", conflict: "surgeon realizes patient on table is person who killed their child in DUI" },
        { setting: "newsroom before broadcast", conflict: "anchor must decide whether to air story that will destroy their own family" },
        { setting: "backstage, opening night", conflict: "legendary actor confesses to younger understudy they can't remember any lines" },
        { setting: "restaurant kitchen during rush", conflict: "head chef discovers sous chef has been slowly poisoning a regular customer" },
        
        // RELATIONSHIPS
        { setting: "divorce lawyer's office", conflict: "couple signing papers, one makes a final desperate plea" },
        { setting: "wedding venue, 10 minutes before", conflict: "maid of honor tells bride she's been having an affair with the groom" },
        { setting: "couple's bedroom, 4 AM", conflict: "one partner wakes the other to confess a secret they've kept for 20 years" },
        { setting: "hotel room after class reunion", conflict: "two people who were best friends discover they each married the other's abuser" },
        { setting: "train compartment, overnight journey", conflict: "strangers share a cabin and one recognizes the other from a traumatic shared past" },
        
        // QUIRKY/DARK COMEDY
        { setting: "astronaut capsule, deep space", conflict: "two astronauts, one year into mission, one admits they lied on psych eval" },
        { setting: "escape room, stuck for 6 hours", conflict: "exes trapped together realize they both came with new dates who left without them" },
        { setting: "funeral home, viewing room", conflict: "two 'widows' meet at the same man's casket, neither knew about the other" },
        { setting: "game show green room", conflict: "contestant recognizes rival as the kid who bullied them into dropping out of school" },
        { setting: "DMV, closing time", conflict: "customer and DMV worker discover they matched on dating app and ghosted each other" }
      ];
      
      const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

      const systemPrompt = `Write a realistic dialogue scene for actor rehearsal practice.

SCENE SETUP:
- Location: ${scenario.setting}
- Situation: ${scenario.conflict}

REQUIREMENTS:
1. Write 12-16 lines of natural dialogue between 2 characters
2. Format dialogue as: CHARACTER: [emotion] Dialogue text.
3. Character names in ALL CAPS
4. Include 3-5 ACTION LINES throughout the scene to set atmosphere and blocking
5. Format action lines in [brackets] on their own line, like: [The elevator doors close with a grinding screech.]

ACTION LINES should describe:
- Physical actions: [She sets down her coffee cup.]
- Environment: [The lights flicker overhead.]
- Blocking/movement: [He takes a step back toward the door.]
- Tension beats: [A long silence. Neither moves.]

CRITICAL - Make it feel REAL:
- Short, punchy dialogue - 1-2 sentences each, never long speeches
- Every line must respond to what was just said - no random jumps
- Use contractions (don't, can't, won't) - nobody talks formally
- Every line must be a COMPLETE thought that makes sense on its own
- Build naturally from confrontation to climax to resolution

SPELLING AND PUNCTUATION:
- Use straight quotes only (" and '), never curly or smart quotes
- Use regular hyphens (-) or double hyphens (--), never em-dashes
- Use three dots (...) for ellipsis, never the special ellipsis character
- Proofread every line for spelling errors before outputting
- No markdown formatting (no bold, no italics, no headers, no horizontal rules)

BAD (don't write like this):
- "I have been meaning to tell you something important about our relationship and how I feel..."
- Long speeches or monologues
- Perfectly articulate emotional revelations
- Incomplete sentences: "That's when the real." or "I thought maybe we could--"

GOOD (write like this):
- [The door slams shut behind them.]
- "Wait, what? You can't be serious."
- "I know. I know, okay? Just let me explain."
- [She turns away, gripping the railing.]
- "Don't look at me like that. I had no choice."
- Short, complete sentences that actors can deliver

This is for actors to practice with, so make the emotions clear but the dialogue natural.

Output the scene with dialogue AND action lines interspersed. No scene titles or headers.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Write this scene now. Make it feel like a real conversation." }
        ],
        max_tokens: 1500,
        temperature: 0.7,
      });

      const rawScript = response.choices[0]?.message?.content?.trim() || "";
      
      if (!rawScript) {
        return res.status(500).json({ error: "Failed to generate script" });
      }

      const script = cleanGeneratedScript(rawScript);

      try {
        const parsed = parseScript(script);
        res.json({ script, parsed, theme: `${scenario.setting}: ${scenario.conflict}` });
      } catch (parseErr) {
        console.error("Generated random script parse error:", parseErr);
        res.json({ script, theme: `${scenario.setting}: ${scenario.conflict}` });
      }
    } catch (error: any) {
      console.error("Random script generation error:", error.message || error);
      res.status(500).json({ error: "Failed to generate script" });
    }
  });

  app.post("/api/cleanup-script", async (req: Request, res: Response) => {
    try {
      const { script } = req.body;

      if (!script || typeof script !== "string") {
        return res.status(400).json({ error: "Script text is required" });
      }

      if (script.length > 150000) {
        return res.status(400).json({ error: "Script too long for AI cleanup. Maximum 150,000 characters." });
      }

      if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
        return res.status(503).json({ error: "AI service not configured" });
      }

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const systemPrompt = `You are a script formatter. Extract dialogue from the given text and output it in a clean, standard format.

RULES:
1. Identify all speaking characters and their dialogue
2. Format each line as: CHARACTER NAME: dialogue text
3. Character names should be in ALL CAPS
4. Include inline stage directions in [brackets] within dialogue lines (e.g., [hesitant], [whispering])
5. PRESERVE standalone stage directions between dialogue as their own lines in [brackets]. These describe scene action, character movement, or atmosphere. Put each on its own line between the relevant dialogue.
6. Preserve the order of dialogue and stage directions as they appear
7. If the format is unclear, make your best intelligent guess based on context
8. Keep emotional parentheticals like (whispering), (angry), (laughing) as [inline stage directions]
9. Mark scene changes with: --- SCENE: [Scene Name] ---

SUPPORTED INPUT FORMATS:
- Standard screenplay: CHARACTER NAME then dialogue below
- Colon format: CHARACTER: dialogue
- Play format: CHARACTER. dialogue
- Novel format: "Dialogue," said Character.
- Chat/messenger format: Name: message
- Any other format - extract dialogue intelligently

OUTPUT ONLY the formatted dialogue lines and stage directions. No explanations or commentary.

Example output:
--- SCENE: Scene One ---
[The office is quiet. Morning light filters through dusty blinds.]
JOHN: [excited] Did you hear the news?
MARY: [surprised] What news?
JOHN: We got the contract.
[Mary stands up, knocking her chair back.]
MARY: You're kidding me.`;

      // For long scripts, process in chunks to avoid token limits
      const CHUNK_SIZE = 20000; // ~5000 tokens input per chunk
      const chunks: string[] = [];
      
      // Split by scene markers if possible, otherwise by size
      const scenePattern = /(?=\bSCENE\s+(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|\d+)\b)/gi;
      const scenes = script.split(scenePattern).filter(s => s.trim());
      
      if (scenes.length > 1) {
        // Script has scene markers, process scene by scene
        let currentChunk = "";
        for (const scene of scenes) {
          if (currentChunk.length + scene.length > CHUNK_SIZE && currentChunk.length > 0) {
            chunks.push(currentChunk);
            currentChunk = scene;
          } else {
            currentChunk += scene;
          }
        }
        if (currentChunk.trim()) {
          chunks.push(currentChunk);
        }
      } else if (script.length > CHUNK_SIZE) {
        // No scene markers, split by size at paragraph boundaries
        let remaining = script;
        while (remaining.length > 0) {
          if (remaining.length <= CHUNK_SIZE) {
            chunks.push(remaining);
            break;
          }
          // Find a good break point (double newline or end of sentence)
          let breakPoint = remaining.lastIndexOf('\n\n', CHUNK_SIZE);
          if (breakPoint < CHUNK_SIZE / 2) {
            breakPoint = remaining.lastIndexOf('\n', CHUNK_SIZE);
          }
          if (breakPoint < CHUNK_SIZE / 2) {
            breakPoint = CHUNK_SIZE;
          }
          chunks.push(remaining.substring(0, breakPoint));
          remaining = remaining.substring(breakPoint).trim();
        }
      } else {
        chunks.push(script);
      }

      console.log(`[Cleanup Script] Processing ${chunks.length} chunk(s) for ${script.length} character script`);

      const cleanedParts: string[] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkPrompt = chunks.length > 1 
          ? `This is part ${i + 1} of ${chunks.length} of a script. Continue extracting dialogue:\n\n${chunk}`
          : chunk;
          
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: chunkPrompt }
          ],
          max_tokens: 16000,
          temperature: 0.2,
        });

        const partResult = response.choices[0]?.message?.content?.trim() || "";
        if (partResult) {
          cleanedParts.push(partResult);
        }
        
        console.log(`[Cleanup Script] Processed chunk ${i + 1}/${chunks.length}, output: ${partResult.length} chars`);
      }

      const cleanedScript = cleanedParts.join('\n\n');
      
      if (!cleanedScript) {
        return res.status(500).json({ error: "Failed to clean script" });
      }

      console.log(`[Cleanup Script] Final output: ${cleanedScript.length} characters`);
      res.json({ script: cleanedScript });
    } catch (error: any) {
      console.error("Script cleanup error:", error.message || error);
      res.status(500).json({ error: "Failed to clean script" });
    }
  });

  async function ocrScannedPdf(pdfBuffer: Buffer, fileName: string, onProgress?: (data: Record<string, any>) => void): Promise<string> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'costar-ocr-'));
    try {
      const pdfPath = path.join(tmpDir, 'input.pdf');
      await fs.writeFile(pdfPath, pdfBuffer);
      
      const numPages = await new Promise<number>((resolve, reject) => {
        const data = new Uint8Array(pdfBuffer);
        pdfjsLib.getDocument({ data, verbosity: 0 }).promise
          .then(pdf => resolve(pdf.numPages))
          .catch(reject);
      });
      
      console.log(`[OCR] Starting OCR for ${fileName}, ${numPages} pages`);
      
      const outputPrefix = path.join(tmpDir, 'page');
      await new Promise<void>((resolve, reject) => {
        execFile('pdftoppm', [
          '-png', '-r', '200',
          pdfPath, outputPrefix
        ], { timeout: 300000 }, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      const files = await fs.readdir(tmpDir);
      const pageFiles = files
        .filter(f => f.startsWith('page-') && f.endsWith('.png'))
        .sort();
      
      console.log(`[OCR] Converted ${pageFiles.length} pages to images, sending to AI for text extraction...`);
      
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      
      const BATCH_SIZE = 4;
      const allPageTexts: string[] = [];
      
      onProgress?.({ type: 'progress', stage: 'scanning', current: 0, total: pageFiles.length, message: `Scanning page 1 of ${pageFiles.length}` });

      for (let batchStart = 0; batchStart < pageFiles.length; batchStart += BATCH_SIZE) {
        const batch = pageFiles.slice(batchStart, batchStart + BATCH_SIZE);
        const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(pageFiles.length / BATCH_SIZE);
        console.log(`[OCR] Processing batch ${batchNum}/${totalBatches} (pages ${batchStart + 1}-${batchStart + batch.length})`);
        
        const batchPromises = batch.map(async (pageFile, idx) => {
          const pageNum = batchStart + idx + 1;
          const imgPath = path.join(tmpDir, pageFile);
          const imgData = await fs.readFile(imgPath);
          const base64 = imgData.toString('base64');
          
          try {
            const response = await openai.chat.completions.create({
              model: "gpt-5-mini",
              messages: [{
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Extract ALL text from this scanned script page exactly as written. Preserve character names in UPPERCASE, dialogue, stage directions in italics or parentheses, and line breaks. This is a theatrical play script. Output ONLY the raw extracted text, nothing else. Do not add any commentary."
                  },
                  {
                    type: "image_url",
                    image_url: { url: `data:image/png;base64,${base64}` }
                  }
                ]
              }],
              max_completion_tokens: 4096,
            });
            
            const text = response.choices[0]?.message?.content || '';
            console.log(`[OCR] Page ${pageNum}: ${text.length} chars extracted`);
            return { pageNum, text };
          } catch (err: any) {
            console.error(`[OCR] Page ${pageNum} failed:`, err.message);
            return { pageNum, text: '' };
          }
        });
        
        const results = await Promise.all(batchPromises);
        results.sort((a, b) => a.pageNum - b.pageNum);
        allPageTexts.push(...results.map(r => r.text));

        const pagesCompleted = Math.min(batchStart + batch.length, pageFiles.length);
        onProgress?.({ type: 'progress', stage: 'scanning', current: pagesCompleted, total: pageFiles.length, message: pagesCompleted < pageFiles.length ? `Scanning page ${pagesCompleted + 1} of ${pageFiles.length}` : 'Finishing up' });
      }
      
      const emptyPages = allPageTexts.reduce((count, text, i) => text.length < 10 ? count + 1 : count, 0);
      if (emptyPages > 0) {
        console.log(`[OCR] Warning: ${emptyPages} of ${pageFiles.length} pages had no extractable text`);
      }
      
      const fullText = allPageTexts.join('\n\n');
      console.log(`[OCR] Complete: ${fullText.length} total characters from ${pageFiles.length} pages (${emptyPages} empty)`);
      return fullText;
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  // File upload for PDF/TXT parsing
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit for large screenplay PDFs
  });

  app.post("/api/parse-file", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const file = req.file;
      const mimeType = file.mimetype;
      const fileName = file.originalname.toLowerCase();
      let text = "";

      // Handle different file types
      if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
        // Parse PDF using pdfjs-dist with line preservation
        try {
          const data = new Uint8Array(file.buffer);
          console.log(`[PDF] Parsing ${file.originalname}, size: ${data.length} bytes`);
          
          // Use options for better compatibility with various PDFs
          const pdf = await pdfjsLib.getDocument({ 
            data,
            useSystemFonts: true,
            disableFontFace: true,
            verbosity: 0
          }).promise;
          console.log(`[PDF] Document loaded, ${pdf.numPages} pages`);
          const textParts: string[] = [];
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            
            // Sort items by vertical position (y), then horizontal (x)
            // to preserve reading order and detect line breaks
            const items = content.items as any[];
            if (i === 1) {
              console.log(`[PDF] Page 1 has ${items.length} text items`);
              if (items.length > 0) {
                console.log(`[PDF] Sample item:`, JSON.stringify(items[0]).slice(0, 200));
              }
            }
            if (items.length === 0) continue;
            
            // Group items by approximate y position to form lines
            const lines: { y: number; items: any[] }[] = [];
            const yThreshold = 5; // Items within 5 units are on same line
            
            for (const item of items) {
              if (!item.str || item.str.trim() === '') continue;
              const y = item.transform?.[5] || 0;
              
              // Find or create a line for this y position
              let line = lines.find(l => Math.abs(l.y - y) < yThreshold);
              if (!line) {
                line = { y, items: [] };
                lines.push(line);
              }
              line.items.push(item);
            }
            
            // Sort lines by y position (descending - PDF y goes bottom to top)
            lines.sort((a, b) => b.y - a.y);
            
            // Sort items within each line by x position
            for (const line of lines) {
              line.items.sort((a: any, b: any) => 
                (a.transform?.[4] || 0) - (b.transform?.[4] || 0)
              );
            }
            
            // Build text with proper line breaks
            const pageLines = lines.map(line => 
              line.items.map((item: any) => item.str).join(' ')
            );
            textParts.push(pageLines.join('\n'));
          }
          
          // If no text extracted, try simpler fallback
          let extractedText = textParts.join('\n\n');
          if (extractedText.length < 50) {
            console.log(`[PDF] Trying simple extraction fallback...`);
            const simpleTextParts: string[] = [];
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();
              const pageText = content.items
                .filter((item: any) => item.str)
                .map((item: any) => item.str)
                .join(' ');
              if (pageText.trim()) {
                simpleTextParts.push(pageText);
              }
            }
            const simpleText = simpleTextParts.join('\n\n');
            if (simpleText.length > extractedText.length) {
              extractedText = simpleText;
              console.log(`[PDF] Simple extraction got ${extractedText.length} characters`);
            }
          }
          
          text = extractedText;
          console.log(`[PDF] Extracted ${text.length} characters`);
        } catch (pdfError) {
          console.error("PDF parse error:", pdfError);
          return res.status(400).json({ error: "Failed to parse PDF file" });
        }
      } else if (
        mimeType === "text/plain" || 
        fileName.endsWith(".txt") ||
        fileName.endsWith(".fountain") ||
        fileName.endsWith(".fdx")
      ) {
        // Plain text or screenplay formats
        text = file.buffer.toString("utf-8");
      } else if (
        mimeType === "application/rtf" || 
        fileName.endsWith(".rtf")
      ) {
        // RTF - extract plain text (basic)
        text = file.buffer.toString("utf-8")
          .replace(/\\[a-z]+\d*\s?/gi, "") // Remove RTF control words
          .replace(/[{}]/g, "") // Remove braces
          .replace(/\\\\/g, "\\")
          .replace(/\\'/g, "'");
      } else if (
        mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        fileName.endsWith(".docx")
      ) {
        // DOCX - we'd need mammoth or similar, for now suggest PDF
        return res.status(400).json({ 
          error: "DOCX files not yet supported. Please save as PDF or TXT and try again." 
        });
      } else {
        return res.status(400).json({ 
          error: "Unsupported file type. Please upload a PDF, TXT, or Fountain file." 
        });
      }

      // Clean up the extracted text
      text = text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\n{4,}/g, "\n\n\n") // Max 3 newlines
        .trim();

      if ((!text || text.length < 10) && (mimeType === "application/pdf" || fileName.endsWith(".pdf"))) {
        console.log(`[PDF] No text layer found, attempting OCR...`);
        try {
          text = await ocrScannedPdf(file.buffer, file.originalname);
          text = text
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .replace(/\n{4,}/g, "\n\n\n")
            .trim();
        } catch (ocrErr: any) {
          console.error(`[PDF] OCR failed:`, ocrErr.message);
        }
      }

      if (!text || text.length < 10) {
        if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
          return res.status(400).json({ 
            error: "Could not extract text from this PDF. The scan quality may be too low. Try opening it in a PDF reader, select all text (Cmd/Ctrl+A), copy (Cmd/Ctrl+C), and paste it here." 
          });
        }
        return res.status(400).json({ error: "Could not extract text from file. Try copying and pasting the script text directly." });
      }

      res.json({ text, fileName: file.originalname });
    } catch (error: any) {
      console.error("File parse error:", error.message || error);
      res.status(500).json({ error: "Failed to parse file" });
    }
  });

  // New endpoint: Parse raw text and return parsed script
  // This avoids data transfer limits for very long scripts
  app.post("/api/parse-script", async (req: Request, res: Response) => {
    try {
      const { script } = req.body;
      
      if (!script || typeof script !== "string") {
        console.log(`[Parse Script] ERROR: No script or invalid type`);
        return res.status(400).json({ error: "No script text provided" });
      }

      console.log(`[Parse Script] Received ${script.length} characters`);
      console.log(`[Parse Script] First 200 chars:`, script.substring(0, 200));
      console.log(`[Parse Script] Last 200 chars:`, script.substring(script.length - 200));
      
      const text = script
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\n{4,}/g, "\n\n\n")
        .trim();

      // Parse the script
      const parsed = parseScript(text);
      console.log(`[Parse Script] Found ${parsed.roles.length} roles, ${parsed.scenes.length} scenes`);
      
      let totalLines = parsed.scenes.reduce((sum, scene) => sum + scene.lines.length, 0);
      console.log(`[Parse Script] Total dialogue lines: ${totalLines}`);

      // AI Smart Cleanup + Role Filter — run in parallel for speed
      console.log(`[Parse Script] Running AI Smart Cleanup + Role Filter in parallel...`);
      const startAI = Date.now();
      const [cleanupResult, roleFilteredScript] = await Promise.all([
        aiCleanupScript(parsed),
        aiFilterRoles(parsed),
      ]);
      console.log(`[Parse Script] AI processing completed in ${Date.now() - startAI}ms`);
      
      const { cleanedScript, removedCount, removedLines } = cleanupResult;
      if (removedCount > 0) {
        console.log(`[Parse Script] AI removed ${removedCount} non-dialogue lines:`, removedLines.slice(0, 5));
        totalLines = cleanedScript.scenes.reduce((sum, scene) => sum + scene.lines.length, 0);
        console.log(`[Parse Script] After cleanup: ${cleanedScript.roles.length} roles, ${totalLines} lines`);
      }

      const roleIdsToRemove = new Set(
        parsed.roles
          .filter(r => !roleFilteredScript.roles.some(rf => rf.id === r.id))
          .map(r => r.id)
      );
      let finalScript = cleanedScript;
      if (roleIdsToRemove.size > 0) {
        console.log(`[Parse Script] AI Role Filter removed ${roleIdsToRemove.size} non-character entries`);
        finalScript = {
          ...cleanedScript,
          roles: cleanedScript.roles.filter(r => !roleIdsToRemove.has(r.id)),
          scenes: cleanedScript.scenes.map(s => ({
            ...s,
            lines: s.lines.filter(l => !roleIdsToRemove.has(l.roleId)),
          })).filter(s => s.lines.length > 0),
        };
      }

      if (finalScript.roles.length === 0) {
        // Provide helpful diagnostic info about why parsing failed
        const lines = text.split('\n').slice(0, 10);
        const sampleLines = lines.filter(l => l.trim()).slice(0, 3).map(l => l.substring(0, 60));
        const hasColons = text.includes(':');
        const hasAllCaps = /^[A-Z]{2,}/.test(text);
        
        let hint = "Use format: CHARACTER: dialogue";
        if (!hasColons) {
          hint = "No colons found. Try: JOHN: Hello there.";
        } else if (!hasAllCaps) {
          hint = "Names should be UPPERCASE: JOHN: Hello.";
        }
        
        console.log(`[Parse Script] Failed - hint: ${hint}, sample:`, sampleLines);
        return res.status(400).json({ 
          error: `Could not find character names. ${hint}`,
          sample: sampleLines
        });
      }

      // Generate a smart name from the script content
      let suggestedName: string | null = null;
      
      // First try to detect title from the raw script text (title pages, headers)
      const rawLines = script.split('\n').map((l: string) => l.trim()).filter((l: string) => l);
      const titlePageTitle = detectTitleFromScript(rawLines);
      if (titlePageTitle) {
        suggestedName = titlePageTitle;
        console.log('[Parse Script] Title detected from script text:', suggestedName);
      }
      
      // Fall back to AI naming only if no title was found
      if (!suggestedName) {
        try {
          const nameAI = new OpenAI({
            apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
            baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
          });
          const snippet = finalScript.scenes
            .flatMap(s => s.lines.slice(0, 8))
            .slice(0, 12)
            .map(l => `${l.roleName}: ${l.text.substring(0, 80)}`)
            .join('\n');
          const nameResponse = await nameAI.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{
              role: "system",
              content: "You are naming a script for a rehearsal app. Return ONLY the title.\n\nRules:\n- If you recognize the script as a known movie, TV show, play, or musical, return ONLY the official title. Do NOT add subtitles, episode names, or scene descriptions. Examples: \"The Wolf of Wall Street\", \"Hamlet\", \"Breaking Bad\", \"A Streetcar Named Desire\".\n- If the script is original/unknown, generate a short descriptive title (2-5 words) based on the scene content. Examples: \"Coffee Shop Breakup\", \"Job Interview Gone Wrong\", \"The Apology\".\n- Never invent subtitles for known works.\n- Reply with ONLY the title, nothing else."
            }, {
              role: "user",
              content: snippet
            }],
            max_tokens: 25,
            temperature: 0.2,
          });
          const raw = nameResponse.choices[0]?.message?.content?.trim().replace(/^["']|["']$/g, '');
          if (raw && raw.length > 1 && raw.length <= 60) {
            suggestedName = raw;
          }
        } catch (e) {
          console.log('[Parse Script] Name generation failed, using fallback');
        }
      }

      res.json({ parsed: finalScript, suggestedName });
    } catch (error: any) {
      console.error("Script parse error:", error.message || error);
      res.status(500).json({ error: "Failed to parse script" });
    }
  });

  // New endpoint: Parse file and return parsed script (not raw text)
  // This avoids data transfer limits for very long scripts
  app.post("/api/parse-file-to-session", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const file = req.file;
      const mimeType = file.mimetype;
      const fileName = file.originalname.toLowerCase();
      let text = "";

      // Handle different file types - same as /api/parse-file
      if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
        try {
          const data = new Uint8Array(file.buffer);
          console.log(`[PDF->Session] Parsing ${file.originalname}, size: ${data.length} bytes`);
          
          // Try with different options for better compatibility
          const pdf = await pdfjsLib.getDocument({ 
            data,
            useSystemFonts: true,
            disableFontFace: true,
            verbosity: 0
          }).promise;
          console.log(`[PDF->Session] Document loaded, ${pdf.numPages} pages`);
          const textParts: string[] = [];
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const items = content.items as any[];
            
            // Log first page details for debugging
            if (i === 1) {
              console.log(`[PDF->Session] Page 1: ${items.length} text items`);
            }
            
            if (items.length === 0) continue;
            
            const lines: { y: number; items: any[] }[] = [];
            const yThreshold = 5;
            
            for (const item of items) {
              if (!item.str || item.str.trim() === '') continue;
              const y = item.transform?.[5] || 0;
              let line = lines.find(l => Math.abs(l.y - y) < yThreshold);
              if (!line) {
                line = { y, items: [] };
                lines.push(line);
              }
              line.items.push(item);
            }
            
            lines.sort((a, b) => b.y - a.y);
            for (const line of lines) {
              line.items.sort((a: any, b: any) => 
                (a.transform?.[4] || 0) - (b.transform?.[4] || 0)
              );
            }
            
            const pageLines = lines.map(line => 
              line.items.map((item: any) => item.str).join(' ')
            );
            textParts.push(pageLines.join('\n'));
          }
          
          text = textParts.join('\n\n');
          console.log(`[PDF->Session] Extracted ${text.length} characters`);
          
          // If still no text, try simpler extraction as fallback
          if (text.length < 50) {
            console.log(`[PDF->Session] Trying simple extraction fallback...`);
            const simpleTextParts: string[] = [];
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();
              const pageText = content.items
                .filter((item: any) => item.str)
                .map((item: any) => item.str)
                .join(' ');
              if (pageText.trim()) {
                simpleTextParts.push(pageText);
              }
            }
            const simpleText = simpleTextParts.join('\n\n');
            if (simpleText.length > text.length) {
              text = simpleText;
              console.log(`[PDF->Session] Simple extraction got ${text.length} characters`);
            }
          }
        } catch (pdfError) {
          console.error("PDF parse error:", pdfError);
          return res.status(400).json({ error: "Failed to parse PDF file" });
        }
      } else if (
        mimeType === "text/plain" || 
        fileName.endsWith(".txt") ||
        fileName.endsWith(".fountain") ||
        fileName.endsWith(".fdx")
      ) {
        text = file.buffer.toString("utf-8");
      } else if (mimeType.startsWith("image/")) {
        console.log(`[Image->Session] Processing image: ${file.originalname}, mime: ${mimeType}, size: ${file.buffer.length} bytes`);
        try {
          const openai = new OpenAI({
            apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
            baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
          });
          const base64 = file.buffer.toString("base64");
          const imgMime = mimeType === "image/jpeg" ? "image/jpeg" : mimeType === "image/png" ? "image/png" : mimeType === "image/webp" ? "image/webp" : "image/jpeg";
          console.log(`[Image->Session] Sending to vision API, base64 length: ${base64.length}, imgMime: ${imgMime}`);
          const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{
              role: "user",
              content: [
                { type: "text", text: "Extract ALL text from this script/screenplay page exactly as written. Preserve character names in UPPERCASE, dialogue, stage directions in parentheses or brackets, and line breaks. Output ONLY the extracted text, nothing else." },
                { type: "image_url", image_url: { url: `data:${imgMime};base64,${base64}` } }
              ]
            }],
            max_completion_tokens: 4096,
          });
          text = response.choices[0]?.message?.content || "";
          console.log(`[Image->Session] Extracted ${text.length} characters from image`);
          if (text.length < 5) {
            console.warn(`[Image->Session] Very little text extracted: "${text}"`);
          }
        } catch (imgErr: any) {
          console.error(`[Image->Session] OCR failed:`, imgErr.message, imgErr.status || '', imgErr.code || '');
          return res.status(500).json({ error: "Could not read text from image. Try a clearer photo or upload a PDF instead." });
        }
      } else {
        return res.status(400).json({ 
          error: "Unsupported file type. Please upload a PDF, TXT, image, or Fountain file." 
        });
      }

      text = text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\n{4,}/g, "\n\n\n")
        .trim();

      if ((!text || text.length < 10) && (mimeType === "application/pdf" || fileName.endsWith(".pdf"))) {
        console.log(`[PDF->Session] No text layer found, signaling client for OCR`);
        return res.status(422).json({ 
          needsOcr: true,
          error: "This PDF appears to be scanned. AI-powered text recognition is needed." 
        });
      }

      if (!text || text.length < 10) {
        return res.status(400).json({ error: "Could not extract text from file. Try copying and pasting the script text directly." });
      }

      // Parse the script on the server
      console.log(`[PDF->Session] Parsing script...`);
      const parsed = parseScript(text);
      console.log(`[PDF->Session] Found ${parsed.roles.length} roles, ${parsed.scenes.length} scenes`);
      
      let totalLines = parsed.scenes.reduce((sum, scene) => sum + scene.lines.length, 0);
      console.log(`[PDF->Session] Total dialogue lines: ${totalLines}`);

      // AI Smart Cleanup + Role Filter — run in parallel for speed
      console.log(`[PDF->Session] Running AI Smart Cleanup + Role Filter in parallel...`);
      const startAI = Date.now();
      const [cleanupResult2, roleFilteredScript2] = await Promise.all([
        aiCleanupScript(parsed),
        aiFilterRoles(parsed),
      ]);
      console.log(`[PDF->Session] AI processing completed in ${Date.now() - startAI}ms`);
      
      const { cleanedScript, removedCount, removedLines } = cleanupResult2;
      if (removedCount > 0) {
        console.log(`[PDF->Session] AI removed ${removedCount} non-dialogue lines:`, removedLines.slice(0, 5));
        totalLines = cleanedScript.scenes.reduce((sum, scene) => sum + scene.lines.length, 0);
        console.log(`[PDF->Session] After cleanup: ${cleanedScript.roles.length} roles, ${totalLines} lines`);
      }

      const roleIdsToRemove2 = new Set(
        parsed.roles
          .filter(r => !roleFilteredScript2.roles.some(rf => rf.id === r.id))
          .map(r => r.id)
      );
      let finalScript = cleanedScript;
      if (roleIdsToRemove2.size > 0) {
        console.log(`[PDF->Session] AI Role Filter removed ${roleIdsToRemove2.size} non-character entries`);
        finalScript = {
          ...cleanedScript,
          roles: cleanedScript.roles.filter(r => !roleIdsToRemove2.has(r.id)),
          scenes: cleanedScript.scenes.map(s => ({
            ...s,
            lines: s.lines.filter(l => !roleIdsToRemove2.has(l.roleId)),
          })).filter(s => s.lines.length > 0),
        };
      }

      if (finalScript.roles.length === 0) {
        const hasColons = text.includes(':');
        let hint = "Use format: CHARACTER: dialogue";
        if (!hasColons) {
          hint = "No colons found. Try: JOHN: Hello there.";
        }
        return res.status(400).json({ 
          error: `Could not find character names. ${hint}` 
        });
      }

      // Return the parsed result AND the raw text for display
      res.json({ 
        parsed: finalScript,
        rawText: text,
        fileName: file.originalname 
      });
    } catch (error: any) {
      console.error("File parse to session error:", error.message || error);
      res.status(500).json({ error: "Failed to parse file" });
    }
  });

  app.post("/api/ocr-pdf-to-session", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const file = req.file;
      const useSSE = req.headers.accept === 'text/event-stream';
      console.log(`[OCR Endpoint] Starting OCR for ${file.originalname}, ${file.buffer.length} bytes, SSE: ${useSSE}`);

      if (useSSE) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });
        const sendProgress = (data: Record<string, any>) => {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        let text = "";
        try {
          text = await ocrScannedPdf(file.buffer, file.originalname, sendProgress);
          text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
        } catch (ocrErr: any) {
          console.error(`[OCR Endpoint] OCR failed:`, ocrErr.message);
          sendProgress({ type: 'error', error: "AI text recognition failed. Try copy-pasting from the PDF instead." });
          res.end();
          return;
        }

        if (!text || text.length < 10) {
          sendProgress({ type: 'error', error: "Could not extract text from this PDF. The scan quality may be too low." });
          res.end();
          return;
        }

        sendProgress({ type: 'progress', stage: 'parsing', message: 'Parsing script' });
        const parsed = parseScript(text);

        sendProgress({ type: 'progress', stage: 'cleanup', message: 'Cleaning up' });
        const [ocrCleanup, ocrRoleFilter] = await Promise.all([
          aiCleanupScript(parsed),
          aiFilterRoles(parsed),
        ]);
        const ocrRoleIdsToRemove = new Set(
          parsed.roles.filter(r => !ocrRoleFilter.roles.some(rf => rf.id === r.id)).map(r => r.id)
        );
        let finalScript = ocrCleanup.cleanedScript;
        if (ocrRoleIdsToRemove.size > 0) {
          finalScript = {
            ...finalScript,
            roles: finalScript.roles.filter(r => !ocrRoleIdsToRemove.has(r.id)),
            scenes: finalScript.scenes.map(s => ({ ...s, lines: s.lines.filter(l => !ocrRoleIdsToRemove.has(l.roleId)) })).filter(s => s.lines.length > 0),
          };
        }

        if (finalScript.roles.length === 0) {
          sendProgress({ type: 'error', error: "Could not find character names in the scanned text." });
          res.end();
          return;
        }

        sendProgress({ type: 'complete', parsed: finalScript, rawText: text, fileName: file.originalname });
        res.end();
      } else {
        let text = "";
        try {
          text = await ocrScannedPdf(file.buffer, file.originalname);
          text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
        } catch (ocrErr: any) {
          console.error(`[OCR Endpoint] OCR failed:`, ocrErr.message);
          return res.status(500).json({ error: "AI text recognition failed. Try copy-pasting from the PDF instead." });
        }

        if (!text || text.length < 10) {
          return res.status(400).json({ error: "Could not extract text from this PDF. The scan quality may be too low." });
        }

        const parsed = parseScript(text);
        const [lastCleanup, lastRoleFilter] = await Promise.all([
          aiCleanupScript(parsed),
          aiFilterRoles(parsed),
        ]);
        const lastRoleIdsToRemove = new Set(
          parsed.roles.filter(r => !lastRoleFilter.roles.some(rf => rf.id === r.id)).map(r => r.id)
        );
        let finalScript = lastCleanup.cleanedScript;
        if (lastRoleIdsToRemove.size > 0) {
          finalScript = {
            ...finalScript,
            roles: finalScript.roles.filter(r => !lastRoleIdsToRemove.has(r.id)),
            scenes: finalScript.scenes.map(s => ({ ...s, lines: s.lines.filter(l => !lastRoleIdsToRemove.has(l.roleId)) })).filter(s => s.lines.length > 0),
          };
        }

        if (finalScript.roles.length === 0) {
          return res.status(400).json({ error: "Could not find character names in the scanned text." });
        }

        res.json({ parsed: finalScript, rawText: text, fileName: file.originalname });
      }
    } catch (error: any) {
      console.error("OCR endpoint error:", error.message || error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to process scanned PDF" });
      }
    }
  });

  // --- Stripe Subscription Routes ---

  app.get("/api/stripe/publishable-key", async (_req: Request, res: Response) => {
    try {
      const key = await getStripePublishableKey();
      res.json({ publishableKey: key });
    } catch (error: any) {
      console.error("[Stripe] Failed to get publishable key:", error.message);
      res.status(500).json({ error: "Failed to get Stripe config" });
    }
  });

  app.get("/api/stripe/products", async (_req: Request, res: Response) => {
    try {
      const result = await db.execute(
        sql`
          WITH active_products AS (
            SELECT id, name, description, metadata, active
            FROM stripe.products
            WHERE active = true
            ORDER BY id
          )
          SELECT 
            p.id as product_id,
            p.name as product_name,
            p.description as product_description,
            p.metadata as product_metadata,
            pr.id as price_id,
            pr.unit_amount,
            pr.currency,
            pr.recurring,
            pr.active as price_active
          FROM active_products p
          LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
          ORDER BY p.id, pr.unit_amount
        `
      );

      const productsMap = new Map<string, any>();
      for (const row of result.rows) {
        const r = row as any;
        if (!productsMap.has(r.product_id)) {
          productsMap.set(r.product_id, {
            id: r.product_id,
            name: r.product_name,
            description: r.product_description,
            metadata: r.product_metadata,
            prices: [],
          });
        }
        if (r.price_id) {
          productsMap.get(r.product_id).prices.push({
            id: r.price_id,
            unit_amount: r.unit_amount,
            currency: r.currency,
            recurring: r.recurring,
          });
        }
      }

      res.json({ products: Array.from(productsMap.values()) });
    } catch (error: any) {
      console.error("[Stripe] Products error:", error.message);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.post("/api/stripe/checkout", async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.claims?.sub || null;
      if (!userId) {
        return res.status(401).json({ error: "Sign in required" });
      }

      const { priceId } = req.body;
      if (!priceId) {
        return res.status(400).json({ error: "Price ID required" });
      }

      const stripe = await getUncachableStripeClient();

      const price = await stripe.prices.retrieve(priceId);
      if (!price || !price.active || price.type !== 'recurring') {
        return res.status(400).json({ error: "Invalid price selected" });
      }
      const product = await stripe.products.retrieve(price.product as string);
      if (!product || !product.active || !(product.metadata?.tier === 'pro' || product.name.toLowerCase().includes('pro'))) {
        return res.status(400).json({ error: "Invalid product" });
      }

      const [user] = await db
        .select({ id: users.id, email: users.email, stripeCustomerId: users.stripeCustomerId })
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: { userId: user.id },
        });
        customerId = customer.id;
        await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, userId));
      }

      let trialDays = 0;
      try {
        const pastSubs = await stripe.subscriptions.list({
          customer: customerId,
          limit: 1,
          status: 'all',
        });
        if (pastSubs.data.length === 0) {
          trialDays = await getTrialDays();
        }
      } catch (e: any) {
        console.error("[Stripe] Could not check past subscriptions:", e.message);
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const sessionParams: any = {
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${baseUrl}/?checkout=success`,
        cancel_url: `${baseUrl}/?checkout=cancel`,
      };

      if (trialDays > 0) {
        sessionParams.subscription_data = {
          trial_period_days: trialDays,
          metadata: { userId: user.id },
        };
      } else {
        sessionParams.subscription_data = {
          metadata: { userId: user.id },
        };
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("[Stripe] Checkout error:", error.message);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  app.post("/api/stripe/portal", async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.claims?.sub || null;
      if (!userId) {
        return res.status(401).json({ error: "Sign in required" });
      }

      const [user] = await db
        .select({ stripeCustomerId: users.stripeCustomerId })
        .from(users)
        .where(eq(users.id, userId));

      if (!user?.stripeCustomerId) {
        return res.status(400).json({ error: "No subscription found" });
      }

      const stripe = await getUncachableStripeClient();
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${baseUrl}/?view=subscription`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("[Stripe] Portal error:", error.message);
      res.status(500).json({ error: "Failed to create portal session" });
    }
  });

  app.post("/api/stripe/switch-plan", async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.claims?.sub || null;
      if (!userId) {
        return res.status(401).json({ error: "Sign in required" });
      }

      const { priceId } = req.body;
      if (!priceId) {
        return res.status(400).json({ error: "Price ID required" });
      }

      const [user] = await db
        .select({ stripeCustomerId: users.stripeCustomerId, stripeSubscriptionId: users.stripeSubscriptionId })
        .from(users)
        .where(eq(users.id, userId));

      if (!user?.stripeCustomerId) {
        return res.status(400).json({ error: "No active subscription to switch" });
      }

      const stripe = await getUncachableStripeClient();

      const price = await stripe.prices.retrieve(priceId);
      if (!price || !price.active || price.type !== 'recurring') {
        return res.status(400).json({ error: "Invalid price selected" });
      }
      const product = await stripe.products.retrieve(price.product as string);
      if (!product || !product.active || !(product.metadata?.tier === 'pro' || product.name.toLowerCase().includes('pro'))) {
        return res.status(400).json({ error: "Invalid product" });
      }

      let subId = user.stripeSubscriptionId;
      if (!subId) {
        const subs = await stripe.subscriptions.list({ customer: user.stripeCustomerId, status: 'active', limit: 1 });
        subId = subs.data[0]?.id || null;
        if (!subId) {
          const trialSubs = await stripe.subscriptions.list({ customer: user.stripeCustomerId, status: 'trialing', limit: 1 });
          subId = trialSubs.data[0]?.id || null;
        }
      }
      if (!subId) {
        return res.status(400).json({ error: "No active subscription found" });
      }

      const subscription = await stripe.subscriptions.retrieve(subId);
      if (!subscription || !['active', 'trialing'].includes(subscription.status)) {
        return res.status(400).json({ error: "No active subscription found" });
      }

      const currentItemId = subscription.items.data[0]?.id;
      if (!currentItemId) {
        return res.status(400).json({ error: "Subscription has no items" });
      }

      const updatedSub = await stripe.subscriptions.update(subId, {
        items: [{ id: currentItemId, price: priceId }],
        proration_behavior: 'create_prorations',
        payment_behavior: 'pending_if_incomplete',
      });

      console.log(`[Stripe] Plan switched for user ${userId}: ${updatedSub.id} -> price ${priceId}`);
      res.json({ success: true, subscription: { id: updatedSub.id, status: updatedSub.status } });
    } catch (error: any) {
      console.error("[Stripe] Switch plan error:", error.message);
      res.status(500).json({ error: "Failed to switch plan" });
    }
  });

  app.post("/api/stripe/pause", async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.claims?.sub || null;
      if (!userId) {
        return res.status(401).json({ error: "Sign in required" });
      }

      const [user] = await db
        .select({ stripeCustomerId: users.stripeCustomerId, stripeSubscriptionId: users.stripeSubscriptionId })
        .from(users)
        .where(eq(users.id, userId));

      if (!user?.stripeCustomerId) {
        return res.status(400).json({ error: "No subscription found" });
      }

      const stripe = await getUncachableStripeClient();

      let subId = user.stripeSubscriptionId;
      let subscription = subId ? await stripe.subscriptions.retrieve(subId) : null;

      if (!subscription || !['active', 'trialing'].includes(subscription.status)) {
        const subs = await stripe.subscriptions.list({ customer: user.stripeCustomerId, limit: 5 });
        const activeSub = subs.data.find(s => ['active', 'trialing'].includes(s.status));
        if (activeSub) {
          subscription = activeSub;
          subId = activeSub.id;
        } else {
          return res.status(400).json({ error: "No active subscription found" });
        }
      }

      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
      if (customerId !== user.stripeCustomerId) {
        return res.status(403).json({ error: "Subscription does not belong to this account" });
      }

      if (subscription.pause_collection) {
        return res.json({ success: true, alreadyPaused: true, resumesAt: subscription.pause_collection.resumes_at ? new Date(subscription.pause_collection.resumes_at * 1000).toISOString() : null });
      }

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const recentPauses = await db
        .select({ count: count() })
        .from(cancelFeedback)
        .where(
          and(
            eq(cancelFeedback.userId, userId),
            eq(cancelFeedback.outcome, "paused"),
            gte(cancelFeedback.createdAt, sixMonthsAgo),
          )
        );
      const pauseCount = recentPauses[0]?.count ?? 0;
      const MAX_PAUSES_PER_PERIOD = 1;
      if (pauseCount >= MAX_PAUSES_PER_PERIOD) {
        console.log(`[Stripe] Pause denied for user ${userId}: ${pauseCount} pauses in last 6 months`);
        return res.status(429).json({ error: "You've already used your pause this period. You can pause again after 6 months from your last pause." });
      }

      const resumeDate = new Date();
      resumeDate.setMonth(resumeDate.getMonth() + 1);
      const resumeTimestamp = Math.floor(resumeDate.getTime() / 1000);

      await stripe.subscriptions.update(subId!, {
        pause_collection: {
          behavior: "void",
          resumes_at: resumeTimestamp,
        },
      });

      console.log(`[Stripe] Subscription paused for user ${userId}: ${subId}`);
      res.json({ success: true, resumesAt: resumeDate.toISOString() });
    } catch (error: any) {
      console.error("[Stripe] Pause error:", error.message);
      res.status(500).json({ error: "Failed to pause subscription" });
    }
  });

  app.post("/api/stripe/unpause", async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.claims?.sub || null;
      if (!userId) {
        return res.status(401).json({ error: "Sign in required" });
      }

      const [user] = await db
        .select({ stripeCustomerId: users.stripeCustomerId, stripeSubscriptionId: users.stripeSubscriptionId })
        .from(users)
        .where(eq(users.id, userId));

      if (!user?.stripeCustomerId) {
        return res.status(400).json({ error: "No subscription found" });
      }

      const stripe = await getUncachableStripeClient();

      let subId = user.stripeSubscriptionId;
      let subscription = subId ? await stripe.subscriptions.retrieve(subId) : null;

      if (!subscription || !['active', 'trialing'].includes(subscription.status)) {
        const subs = await stripe.subscriptions.list({ customer: user.stripeCustomerId, limit: 5 });
        const activeSub = subs.data.find(s => ['active', 'trialing'].includes(s.status));
        if (activeSub) {
          subscription = activeSub;
          subId = activeSub.id;
        } else {
          return res.status(400).json({ error: "No active subscription found" });
        }
      }

      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
      if (customerId !== user.stripeCustomerId) {
        return res.status(403).json({ error: "Subscription does not belong to this account" });
      }

      if (!subscription.pause_collection) {
        return res.json({ success: true, alreadyActive: true });
      }

      await stripe.subscriptions.update(subId!, {
        pause_collection: '',
      } as any);

      console.log(`[Stripe] Subscription unpaused for user ${userId}: ${subId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Stripe] Unpause error:", error.message);
      res.status(500).json({ error: "Failed to unpause subscription" });
    }
  });

  app.post("/api/stripe/cancel", async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.claims?.sub || null;
      if (!userId) {
        return res.status(401).json({ error: "Sign in required" });
      }

      const [user] = await db
        .select({ stripeCustomerId: users.stripeCustomerId, stripeSubscriptionId: users.stripeSubscriptionId })
        .from(users)
        .where(eq(users.id, userId));

      if (!user?.stripeCustomerId) {
        return res.status(400).json({ error: "No subscription found" });
      }

      const stripe = await getUncachableStripeClient();

      let subId = user.stripeSubscriptionId;
      let subscription = subId ? await stripe.subscriptions.retrieve(subId) : null;

      if (!subscription || !['active', 'trialing'].includes(subscription.status)) {
        const subs = await stripe.subscriptions.list({ customer: user.stripeCustomerId, limit: 5 });
        const activeSub = subs.data.find(s => ['active', 'trialing'].includes(s.status));
        if (activeSub) {
          subscription = activeSub;
          subId = activeSub.id;
        } else {
          return res.status(400).json({ error: "No active subscription found" });
        }
      }

      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
      if (customerId !== user.stripeCustomerId) {
        return res.status(403).json({ error: "Subscription does not belong to this account" });
      }

      if (subscription.cancel_at_period_end) {
        return res.json({
          success: true,
          alreadyCanceling: true,
          currentPeriodEnd: subscription.current_period_end,
        });
      }

      await stripe.subscriptions.update(subId!, {
        cancel_at_period_end: true,
      });

      console.log(`[Stripe] Subscription cancel scheduled for user ${userId}: ${subId}`);
      res.json({
        success: true,
        currentPeriodEnd: subscription.current_period_end,
      });
    } catch (error: any) {
      console.error("[Stripe] Cancel error:", error.message);
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });

  app.post("/api/stripe/reactivate", async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.claims?.sub || null;
      if (!userId) {
        return res.status(401).json({ error: "Sign in required" });
      }

      const [user] = await db
        .select({ stripeCustomerId: users.stripeCustomerId, stripeSubscriptionId: users.stripeSubscriptionId })
        .from(users)
        .where(eq(users.id, userId));

      if (!user?.stripeCustomerId) {
        return res.status(400).json({ error: "No subscription found" });
      }

      const stripe = await getUncachableStripeClient();

      let subId = user.stripeSubscriptionId;
      let subscription = subId ? await stripe.subscriptions.retrieve(subId) : null;

      if (!subscription || !['active', 'trialing'].includes(subscription.status)) {
        const subs = await stripe.subscriptions.list({ customer: user.stripeCustomerId, limit: 5 });
        const activeSub = subs.data.find(s => ['active', 'trialing'].includes(s.status));
        if (activeSub) {
          subscription = activeSub;
          subId = activeSub.id;
        } else {
          return res.status(400).json({ error: "No active subscription found" });
        }
      }

      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
      if (customerId !== user.stripeCustomerId) {
        return res.status(403).json({ error: "Subscription does not belong to this account" });
      }

      if (!subscription.cancel_at_period_end) {
        return res.json({ success: true, cancelAtPeriodEnd: false });
      }

      await stripe.subscriptions.update(subId!, {
        cancel_at_period_end: false,
      });

      console.log(`[Stripe] Subscription reactivated for user ${userId}: ${subId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Stripe] Reactivate error:", error.message);
      res.status(500).json({ error: "Failed to reactivate subscription" });
    }
  });

  app.post("/api/stripe/cancel-feedback", async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.claims?.sub || null;
      if (!userId) {
        return res.status(401).json({ error: "Sign in required" });
      }

      const { reason, comment, outcome } = req.body;
      if (!reason || !outcome) {
        return res.status(400).json({ error: "Reason and outcome are required" });
      }

      const validReasons = ["too_expensive", "not_using", "missing_features", "found_alternative", "other"];
      const validOutcomes = ["canceled", "paused", "stayed"];
      if (!validReasons.includes(reason) || !validOutcomes.includes(outcome)) {
        return res.status(400).json({ error: "Invalid reason or outcome" });
      }

      await db.insert(cancelFeedback).values({
        userId,
        reason,
        comment: comment?.trim() || null,
        outcome,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("[Stripe] Cancel feedback error:", error.message);
      res.status(500).json({ error: "Failed to save feedback" });
    }
  });

  app.get("/api/stripe/subscription", async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.claims?.sub || null;
      if (!userId) {
        return res.json({ subscription: null, tier: "free" });
      }

      const [user] = await db
        .select({
          stripeCustomerId: users.stripeCustomerId,
          stripeSubscriptionId: users.stripeSubscriptionId,
          subscriptionTier: users.subscriptionTier,
        })
        .from(users)
        .where(eq(users.id, userId));

      if (!user?.stripeCustomerId) {
        const tier = user?.subscriptionTier || "free";
        return res.json({ subscription: null, tier, isPro: hasProAccess(tier) });
      }

      // Check for active subscription in stripe schema
      const subResult = await db.execute(
        sql`
          SELECT s.id, s.status, s.current_period_end, s.cancel_at_period_end, s.trial_end, s.trial_start,
                 s.pause_collection,
                 (SELECT si.price FROM stripe.subscription_items si WHERE si.subscription = s.id LIMIT 1) as current_price_id
          FROM stripe.subscriptions s
          WHERE s.customer = ${user.stripeCustomerId}
          AND s.status IN ('active', 'trialing')
          ORDER BY s.created DESC
          LIMIT 1
        `
      );

      const sub = subResult.rows[0] as any;
      if (sub) {
        if (user.stripeSubscriptionId !== sub.id || user.subscriptionTier !== 'pro') {
          await db.update(users).set({
            stripeSubscriptionId: sub.id,
            subscriptionTier: 'pro',
            updatedAt: new Date(),
          }).where(eq(users.id, userId));
        }

        const toISOFromUnix = (val: any): string | null => {
          if (!val) return null;
          const num = typeof val === 'number' ? val : Number(val);
          if (!isNaN(num)) {
            return new Date(num < 1e12 ? num * 1000 : num).toISOString();
          }
          return String(val);
        };

        const isTrialing = sub.status === 'trialing';
        let trialEnd: string | null = null;
        let trialDaysLeft: number | null = null;
        if (isTrialing && sub.trial_end) {
          trialEnd = toISOFromUnix(sub.trial_end);
          const endDate = trialEnd ? new Date(trialEnd) : null;
          if (endDate) {
            const msLeft = endDate.getTime() - Date.now();
            trialDaysLeft = Math.min(7, Math.max(0, Math.floor(msLeft / (1000 * 60 * 60 * 24))));
          }
        }

        const pauseCollection = sub.pause_collection
          ? (typeof sub.pause_collection === 'string' ? JSON.parse(sub.pause_collection) : sub.pause_collection)
          : null;
        let pausedUntil: string | null = null;
        if (pauseCollection?.resumes_at) {
          pausedUntil = new Date(pauseCollection.resumes_at * 1000).toISOString();
        }

        return res.json({
          subscription: {
            id: sub.id,
            status: sub.status,
            currentPeriodEnd: toISOFromUnix(sub.current_period_end),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            isTrialing,
            trialEnd,
            trialDaysLeft,
            currentPriceId: sub.current_price_id || null,
            isPaused: !!pauseCollection,
            pausedUntil,
          },
          tier: "pro",
        });
      }

      if (user.subscriptionTier === "comp" || user.subscriptionTier === "internal") {
        return res.json({ subscription: null, tier: user.subscriptionTier, isPro: true });
      }

      if (user.subscriptionTier !== 'free') {
        await db.update(users).set({
          subscriptionTier: 'free',
          stripeSubscriptionId: null,
          updatedAt: new Date(),
        }).where(eq(users.id, userId));
      }

      return res.json({ subscription: null, tier: "free" });
    } catch (error: any) {
      console.error("[Stripe] Subscription check error:", error.message);
      res.json({ subscription: null, tier: "free" });
    }
  });

  // --- Pageview Tracking ---

  function parseUA(req: any) {
    const ua = req.headers["user-agent"] || "";
    const userId = req.user?.claims?.sub || req.session?.claims?.sub || null;
    const sessionId = req.sessionID || "unknown";
    let device = "desktop";
    if (/Mobile|Android|iPhone|iPad/i.test(ua)) {
      device = /iPad|Tablet/i.test(ua) ? "tablet" : "mobile";
    }
    let browser = "other";
    if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = "chrome";
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "safari";
    else if (/Firefox/i.test(ua)) browser = "firefox";
    else if (/Edg/i.test(ua)) browser = "edge";
    return { ua, userId, sessionId, device, browser };
  }

  app.post("/api/track", async (req: any, res: Response) => {
    try {
      const { path: pagePath, referrer } = req.body;
      if (!pagePath || typeof pagePath !== "string") return res.status(400).json({ error: "path required" });
      const cleanPath = pagePath.substring(0, 100).replace(/[^\w\-\/]/g, "");
      const cleanReferrer = typeof referrer === "string" ? referrer.substring(0, 500) : null;
      const { ua, userId, sessionId, device, browser } = parseUA(req);

      await db.insert(pageviews).values({
        sessionId,
        userId,
        path: cleanPath,
        referrer: cleanReferrer,
        userAgent: ua.substring(0, 500),
        device,
        browser,
      });

      res.json({ ok: true });
    } catch (error: any) {
      res.json({ ok: true });
    }
  });

  app.post("/api/track-event", async (req: any, res: Response) => {
    try {
      const { event, category, label, value, path: pagePath, metadata } = req.body;
      if (!event || !category) return res.json({ ok: true });
      const { userId, sessionId, device, browser } = parseUA(req);

      await db.insert(analyticsEvents).values({
        sessionId,
        userId,
        event: String(event).substring(0, 100),
        category: String(category).substring(0, 50),
        label: label ? String(label).substring(0, 200) : null,
        value: value ? String(value).substring(0, 200) : null,
        path: pagePath ? String(pagePath).substring(0, 100) : null,
        device,
        browser,
        metadata: metadata || null,
      });

      res.json({ ok: true });
    } catch (error: any) {
      res.json({ ok: true });
    }
  });

  app.post("/api/track-error", async (req: any, res: Response) => {
    try {
      const { message: errMsg, stack, source, path: pagePath, metadata } = req.body;
      if (!errMsg) return res.json({ ok: true });
      const { ua, userId, sessionId, device, browser } = parseUA(req);

      await db.insert(errorLogs).values({
        sessionId,
        userId,
        message: String(errMsg).substring(0, 2000),
        stack: stack ? String(stack).substring(0, 5000) : null,
        source: source ? String(source).substring(0, 100) : null,
        path: pagePath ? String(pagePath).substring(0, 100) : null,
        device,
        browser,
        userAgent: ua.substring(0, 500),
        metadata: metadata || null,
      });

      res.json({ ok: true });
    } catch (error: any) {
      res.json({ ok: true });
    }
  });

  app.post("/api/feedback", async (req: any, res: Response) => {
    try {
      const { type, subject, message: msg, attachmentData, contactEmail } = req.body;
      if (!msg) return res.status(400).json({ error: "message required" });
      const { userId, device, browser } = parseUA(req);

      const user = userId ? await db.select({ email: users.email, firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, userId)).limit(1) : [];
      const u = user[0];

      await db.insert(feedbackMessages).values({
        userId,
        userEmail: u?.email || null,
        userName: [u?.firstName, u?.lastName].filter(Boolean).join(" ") || null,
        type: type || "bug",
        subject: subject ? String(subject).substring(0, 200) : null,
        message: String(msg).substring(0, 10000),
        attachmentData: attachmentData ? String(attachmentData).substring(0, 50000) : null,
        contactEmail: contactEmail ? String(contactEmail).substring(0, 200) : null,
        device,
        browser,
        path: req.body.path ? String(req.body.path).substring(0, 100) : null,
      });

      res.json({ ok: true });
    } catch (error: any) {
      console.error("[Feedback] Error:", error.message);
      res.status(500).json({ error: "Failed to save feedback" });
    }
  });

  // --- Admin Analytics Dashboard ---

  async function isAdmin(req: any): Promise<boolean> {
    const userId = req.user?.claims?.sub || req.session?.claims?.sub || null;
    if (!userId) return false;
    const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean);
    if (adminIds.includes(userId)) return true;
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
    if (adminEmails.length > 0) {
      try {
        const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
        if (user?.email && adminEmails.includes(user.email.toLowerCase().trim())) return true;
      } catch {}
    }
    if (adminIds.length === 0 && adminEmails.length === 0) {
      return process.env.NODE_ENV === "development";
    }
    return false;
  }

  let analyticsCache: { data: any; timestamp: number } | null = null;
  const CACHE_TTL = 30000; // 30 seconds

  app.get("/api/admin/analytics", async (req: any, res: Response) => {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: "Not authorized" });
    }

    if (analyticsCache && Date.now() - analyticsCache.timestamp < CACHE_TTL) {
      return res.json(analyticsCache.data);
    }

    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      // --- User Metrics ---
      const [totalUsers] = await db.select({ count: count() }).from(users);
      const [usersToday] = await db.select({ count: count() }).from(users).where(gte(users.createdAt, today));
      const [users7d] = await db.select({ count: count() }).from(users).where(gte(users.createdAt, sevenDaysAgo));
      const [users30d] = await db.select({ count: count() }).from(users).where(gte(users.createdAt, thirtyDaysAgo));

      // Subscription breakdown
      const tierBreakdown = await db.execute(
        sql`SELECT COALESCE(subscription_tier, 'free') as tier, COUNT(*) as count FROM users GROUP BY COALESCE(subscription_tier, 'free')`
      );

      // User signups by day (last 30 days)
      const signupsByDay = await db.execute(
        sql`SELECT DATE(created_at) as date, COUNT(*) as count FROM users WHERE created_at >= ${thirtyDaysAgo} GROUP BY DATE(created_at) ORDER BY date`
      );

      // --- Pageview Metrics ---
      const [totalPageviews] = await db.select({ count: count() }).from(pageviews);
      const [pageviewsToday] = await db.select({ count: count() }).from(pageviews).where(gte(pageviews.createdAt, today));
      const [pageviews7d] = await db.select({ count: count() }).from(pageviews).where(gte(pageviews.createdAt, sevenDaysAgo));

      // Unique visitors (by sessionId) today and 7d
      const uniqueToday = await db.execute(
        sql`SELECT COUNT(DISTINCT session_id) as count FROM pageviews WHERE created_at >= ${today}`
      );
      const unique7d = await db.execute(
        sql`SELECT COUNT(DISTINCT session_id) as count FROM pageviews WHERE created_at >= ${sevenDaysAgo}`
      );
      const unique30d = await db.execute(
        sql`SELECT COUNT(DISTINCT session_id) as count FROM pageviews WHERE created_at >= ${thirtyDaysAgo}`
      );

      // Top pages
      const topPages = await db.execute(
        sql`SELECT path, COUNT(*) as views, COUNT(DISTINCT session_id) as unique_visitors FROM pageviews WHERE created_at >= ${thirtyDaysAgo} GROUP BY path ORDER BY views DESC LIMIT 15`
      );

      // Pageviews by day (last 30 days)
      const pageviewsByDay = await db.execute(
        sql`SELECT DATE(created_at) as date, COUNT(*) as views, COUNT(DISTINCT session_id) as visitors FROM pageviews WHERE created_at >= ${thirtyDaysAgo} GROUP BY DATE(created_at) ORDER BY date`
      );

      // Device breakdown
      const deviceBreakdown = await db.execute(
        sql`SELECT device, COUNT(*) as count FROM pageviews WHERE created_at >= ${thirtyDaysAgo} GROUP BY device ORDER BY count DESC`
      );

      // Browser breakdown
      const browserBreakdown = await db.execute(
        sql`SELECT browser, COUNT(*) as count FROM pageviews WHERE created_at >= ${thirtyDaysAgo} GROUP BY browser ORDER BY count DESC`
      );

      // Top referrers
      const topReferrers = await db.execute(
        sql`SELECT referrer, COUNT(*) as count FROM pageviews WHERE referrer IS NOT NULL AND referrer != '' AND created_at >= ${thirtyDaysAgo} GROUP BY referrer ORDER BY count DESC LIMIT 10`
      );

      // --- Usage Metrics ---
      const [totalScripts] = await db.select({ count: count() }).from(savedScripts);
      const [totalRuns] = await db.select({ count: count() }).from(performanceRuns);
      const [totalRecentScripts] = await db.select({ count: count() }).from(recentScripts);

      // Scripts created last 30 days
      const [scripts30d] = await db.select({ count: count() }).from(savedScripts).where(gte(savedScripts.createdAt, thirtyDaysAgo));
      const [runs30d] = await db.select({ count: count() }).from(performanceRuns).where(gte(performanceRuns.createdAt, thirtyDaysAgo));

      // Avg accuracy across runs
      const avgAccuracy = await db.execute(
        sql`SELECT AVG(accuracy) as avg_accuracy, AVG(duration_seconds) as avg_duration FROM performance_runs`
      );

      // Runs by day (last 30 days)
      const runsByDay = await db.execute(
        sql`SELECT DATE(created_at) as date, COUNT(*) as count, AVG(accuracy) as avg_accuracy FROM performance_runs WHERE created_at >= ${thirtyDaysAgo} GROUP BY DATE(created_at) ORDER BY date`
      );

      // --- Feature Request Metrics ---
      const [totalFeatureRequests] = await db.select({ count: count() }).from(featureRequests);
      const topFeatureRequests = await db.execute(
        sql`SELECT title, category, status, vote_count, created_at FROM feature_requests ORDER BY vote_count DESC LIMIT 10`
      );

      // --- Feedback/Messages Metrics ---
      const newMessagesResult = await db.execute(
        sql`SELECT COUNT(*) as count FROM feedback_messages WHERE status = 'new'`
      );
      const newMessagesCount = Number((newMessagesResult.rows[0] as any)?.count || 0);

      // --- Stripe Revenue Metrics ---
      let revenue = { mrr: 0, totalSubscriptions: 0, activeSubscriptions: 0 };
      try {
        const stripeSubs = await db.execute(
          sql`SELECT status, COUNT(*) as count FROM stripe.subscriptions GROUP BY status`
        );
        const activeSubs = await db.execute(
          sql`SELECT COUNT(*) as count FROM stripe.subscriptions WHERE status IN ('active', 'trialing')`
        );
        const activeCount = Number((activeSubs.rows[0] as any)?.count || 0);
        revenue = {
          mrr: activeCount * 9,
          totalSubscriptions: stripeSubs.rows.reduce((sum: number, r: any) => sum + Number(r.count), 0),
          activeSubscriptions: activeCount,
        };
      } catch (e) {}

      // --- Cancel/Churn Metrics ---
      let churn = { total: 0, canceled: 0, paused: 0, stayed: 0, reasonBreakdown: [] as any[], recent: [] as any[] };
      try {
        const [totalCancelFeedback] = await db.select({ count: count() }).from(cancelFeedback);
        const outcomeBreakdown = await db.execute(
          sql`SELECT outcome, COUNT(*) as count FROM cancel_feedback GROUP BY outcome`
        );
        const reasonBreakdown = await db.execute(
          sql`SELECT reason, COUNT(*) as count FROM cancel_feedback GROUP BY reason ORDER BY count DESC`
        );
        const recentCancelFeedback = await db.execute(
          sql`SELECT cf.id, cf.reason, cf.comment, cf.outcome, cf.created_at, u.email, u.first_name, u.last_name
              FROM cancel_feedback cf
              LEFT JOIN users u ON cf.user_id = u.id
              ORDER BY cf.created_at DESC LIMIT 20`
        );
        const outcomes = outcomeBreakdown.rows as any[];
        churn = {
          total: totalCancelFeedback.count,
          canceled: Number(outcomes.find((o: any) => o.outcome === "canceled")?.count || 0),
          paused: Number(outcomes.find((o: any) => o.outcome === "paused")?.count || 0),
          stayed: Number(outcomes.find((o: any) => o.outcome === "stayed")?.count || 0),
          reasonBreakdown: reasonBreakdown.rows,
          recent: recentCancelFeedback.rows,
        };
      } catch (e) {}

      // --- Recent Users ---
      const recentUsers = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          subscriptionTier: users.subscriptionTier,
          createdAt: users.createdAt,
          onboardingComplete: users.onboardingComplete,
        })
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(25);

      const result = {
        users: {
          total: totalUsers.count,
          today: usersToday.count,
          last7d: users7d.count,
          last30d: users30d.count,
          tierBreakdown: tierBreakdown.rows,
          signupsByDay: signupsByDay.rows,
          recentUsers,
        },
        pageviews: {
          total: totalPageviews.count,
          today: pageviewsToday.count,
          last7d: pageviews7d.count,
          uniqueToday: Number((uniqueToday.rows[0] as any)?.count || 0),
          unique7d: Number((unique7d.rows[0] as any)?.count || 0),
          unique30d: Number((unique30d.rows[0] as any)?.count || 0),
          topPages: topPages.rows,
          byDay: pageviewsByDay.rows,
          deviceBreakdown: deviceBreakdown.rows,
          browserBreakdown: browserBreakdown.rows,
          topReferrers: topReferrers.rows,
        },
        usage: {
          totalScripts: totalScripts.count,
          totalRuns: totalRuns.count,
          totalRecentScripts: totalRecentScripts.count,
          scripts30d: scripts30d.count,
          runs30d: runs30d.count,
          avgAccuracy: Number((avgAccuracy.rows[0] as any)?.avg_accuracy || 0),
          avgDuration: Number((avgAccuracy.rows[0] as any)?.avg_duration || 0),
          runsByDay: runsByDay.rows,
        },
        featureRequests: {
          total: totalFeatureRequests.count,
          top: topFeatureRequests.rows,
        },
        messages: {
          newCount: newMessagesCount,
        },
        revenue,
        churn,
      };

      analyticsCache = { data: result, timestamp: Date.now() };
      res.json(result);
    } catch (error: any) {
      console.error("[Analytics] Error:", error.message);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  app.get("/api/admin/users", async (req: any, res: Response) => {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "Not authorized" });
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
      const offset = (page - 1) * limit;
      const search = req.query.search ? String(req.query.search) : null;
      const tier = req.query.tier ? String(req.query.tier) : null;

      let whereClause = sql`1=1`;
      if (search) {
        whereClause = sql`(email ILIKE ${'%' + search + '%'} OR first_name ILIKE ${'%' + search + '%'} OR last_name ILIKE ${'%' + search + '%'} OR stage_name ILIKE ${'%' + search + '%'})`;
      }
      if (tier) {
        whereClause = search
          ? sql`${whereClause} AND COALESCE(subscription_tier, 'free') = ${tier}`
          : sql`COALESCE(subscription_tier, 'free') = ${tier}`;
      }

      const result = await db.execute(
        sql`SELECT id, email, first_name, last_name, stage_name, profile_image_url, subscription_tier, stripe_customer_id, stripe_subscription_id, onboarding_complete, location, blocked, blocked_at, created_at, updated_at FROM users WHERE ${whereClause} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
      );
      const totalResult = await db.execute(sql`SELECT COUNT(*) as count FROM users WHERE ${whereClause}`);

      res.json({ users: result.rows, total: Number((totalResult.rows[0] as any)?.count || 0), page, limit });
    } catch (error: any) {
      console.error("[Admin Users] Error:", error.message);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/users/:userId", async (req: any, res: Response) => {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "Not authorized" });
    try {
      const userId = req.params.userId;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return res.status(404).json({ error: "User not found" });

      const userPageviews = await db.execute(
        sql`SELECT path, COUNT(*) as views, MAX(created_at) as last_visit FROM pageviews WHERE user_id = ${userId} GROUP BY path ORDER BY views DESC LIMIT 20`
      );
      const userEvents = await db.execute(
        sql`SELECT event, category, label, COUNT(*) as count, MAX(created_at) as last_used FROM analytics_events WHERE user_id = ${userId} GROUP BY event, category, label ORDER BY count DESC LIMIT 30`
      );
      const userRuns = await db.execute(
        sql`SELECT id, script_name, accuracy, lines_total, lines_correct, lines_skipped, duration_seconds, memorization_mode, created_at FROM performance_runs WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 20`
      );
      const userSavedScripts = await db.execute(
        sql`SELECT id, name, created_at FROM saved_scripts WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 20`
      );
      const userRecentScripts = await db.execute(
        sql`SELECT id, name, last_used as created_at FROM recent_scripts WHERE user_id = ${userId} ORDER BY last_used DESC LIMIT 20`
      );
      const userErrors = await db.execute(
        sql`SELECT id, message, source, path, created_at FROM error_logs WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 10`
      );

      const { passwordHash, ...safeUser } = user;

      res.json({
        user: safeUser,
        pageviews: userPageviews.rows,
        events: userEvents.rows,
        runs: userRuns.rows,
        scripts: userSavedScripts.rows,
        recentScripts: userRecentScripts.rows,
        errors: userErrors.rows,
      });
    } catch (error: any) {
      console.error("[Admin User Detail] Error:", error.message);
      res.status(500).json({ error: "Failed to fetch user details" });
    }
  });

  app.get("/api/admin/events", async (req: any, res: Response) => {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "Not authorized" });
    try {
      const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const topEvents = await db.execute(
        sql`SELECT event, category, COUNT(*) as count, COUNT(DISTINCT session_id) as unique_sessions, COUNT(DISTINCT user_id) as unique_users FROM analytics_events WHERE created_at >= ${since} GROUP BY event, category ORDER BY count DESC LIMIT 50`
      );
      const eventsByDay = await db.execute(
        sql`SELECT DATE(created_at) as date, COUNT(*) as count FROM analytics_events WHERE created_at >= ${since} GROUP BY DATE(created_at) ORDER BY date`
      );
      const featureUsage = await db.execute(
        sql`SELECT event, label, COUNT(*) as count, COUNT(DISTINCT user_id) as unique_users FROM analytics_events WHERE category = 'feature' AND created_at >= ${since} GROUP BY event, label ORDER BY count DESC LIMIT 30`
      );
      const clickEvents = await db.execute(
        sql`SELECT label, path, COUNT(*) as clicks, COUNT(DISTINCT session_id) as unique_clicks FROM analytics_events WHERE category = 'click' AND created_at >= ${since} GROUP BY label, path ORDER BY clicks DESC LIMIT 30`
      );

      res.json({
        topEvents: topEvents.rows,
        eventsByDay: eventsByDay.rows,
        featureUsage: featureUsage.rows,
        clickEvents: clickEvents.rows,
      });
    } catch (error: any) {
      console.error("[Admin Events] Error:", error.message);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.get("/api/admin/feedback", async (req: any, res: Response) => {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "Not authorized" });
    try {
      const status = req.query.status ? String(req.query.status) : null;
      const type = req.query.type ? String(req.query.type) : null;

      let whereClause = sql`1=1`;
      if (status) whereClause = sql`status = ${status}`;
      if (type) whereClause = status ? sql`${whereClause} AND type = ${type}` : sql`type = ${type}`;

      const result = await db.execute(
        sql`SELECT * FROM feedback_messages WHERE ${whereClause} ORDER BY created_at DESC LIMIT 100`
      );
      const counts = await db.execute(
        sql`SELECT status, COUNT(*) as count FROM feedback_messages GROUP BY status`
      );

      res.json({ messages: result.rows, statusCounts: counts.rows });
    } catch (error: any) {
      console.error("[Admin Feedback] Error:", error.message);
      res.status(500).json({ error: "Failed to fetch feedback" });
    }
  });

  app.patch("/api/admin/feedback/:id", async (req: any, res: Response) => {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "Not authorized" });
    try {
      const { status, adminNotes } = req.body;
      const updates: any = {};
      if (status) updates.status = status;
      if (adminNotes !== undefined) updates.adminNotes = adminNotes;

      await db.update(feedbackMessages).set(updates).where(eq(feedbackMessages.id, req.params.id));
      analyticsCache = null;
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update feedback" });
    }
  });

  app.delete("/api/admin/feedback/:id", async (req: any, res: Response) => {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "Not authorized" });
    try {
      await db.delete(feedbackMessages).where(eq(feedbackMessages.id, req.params.id));
      analyticsCache = null;
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete feedback" });
    }
  });

  app.get("/api/admin/errors", async (req: any, res: Response) => {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "Not authorized" });
    try {
      const resolved = req.query.resolved === "true" ? "true" : "false";
      const result = await db.execute(
        sql`SELECT id, session_id, user_id, message, stack, source, path, device, browser, resolved, created_at FROM error_logs WHERE resolved = ${resolved} ORDER BY created_at DESC LIMIT 100`
      );
      const counts = await db.execute(
        sql`SELECT resolved, COUNT(*) as count FROM error_logs GROUP BY resolved`
      );
      const topErrors = await db.execute(
        sql`SELECT message, COUNT(*) as count, MAX(created_at) as last_seen FROM error_logs WHERE resolved = 'false' GROUP BY message ORDER BY count DESC LIMIT 20`
      );

      res.json({ errors: result.rows, counts: counts.rows, topErrors: topErrors.rows });
    } catch (error: any) {
      console.error("[Admin Errors] Error:", error.message);
      res.status(500).json({ error: "Failed to fetch errors" });
    }
  });

  app.patch("/api/admin/errors/:id", async (req: any, res: Response) => {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "Not authorized" });
    try {
      await db.update(errorLogs).set({ resolved: req.body.resolved || "true" }).where(eq(errorLogs.id, req.params.id));
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update error" });
    }
  });

  app.post("/api/admin/errors/resolve-bulk", async (req: any, res: Response) => {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "Not authorized" });
    try {
      const { message: errorMessage } = req.body;
      if (errorMessage) {
        await db.execute(sql`UPDATE error_logs SET resolved = 'true' WHERE message = ${errorMessage}`);
      } else {
        await db.execute(sql`UPDATE error_logs SET resolved = 'true' WHERE resolved = 'false'`);
      }
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to bulk resolve errors" });
    }
  });

  app.post("/api/admin/users/:userId/reset-onboarding", async (req: any, res: Response) => {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "Not authorized" });
    const adminId = req.user?.claims?.sub || req.session?.claims?.sub || "unknown";
    try {
      const { userId } = req.params;
      await db.update(users).set({ onboardingComplete: "false", updatedAt: new Date() }).where(eq(users.id, userId));
      await logAdminAction(adminId, "reset_onboarding", userId);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to reset onboarding" });
    }
  });

  app.post("/api/admin/users/:userId/plan", async (req: any, res: Response) => {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "Not authorized" });
    const adminId = req.user?.claims?.sub || req.session?.claims?.sub || "unknown";
    try {
      const { userId } = req.params;
      const { action, tier } = req.body;

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return res.status(404).json({ error: "User not found" });

      const updates: any = { updatedAt: new Date() };

      if (action === "change_tier") {
        if (!ALL_TIERS.includes(tier)) return res.status(400).json({ error: `Invalid tier. Must be one of: ${ALL_TIERS.join(", ")}` });

        if (tier === "free" && hasProAccess(user.subscriptionTier)) {
          if (user.stripeSubscriptionId) {
            try {
              const stripe = await getUncachableStripeClient();
              await stripe.subscriptions.cancel(user.stripeSubscriptionId, { prorate: true });
              console.log(`[Admin] Cancelled Stripe subscription ${user.stripeSubscriptionId} (downgrade to free)`);
              updates.stripeSubscriptionId = null;
            } catch (stripeErr: any) {
              if (stripeErr.code === "resource_missing") {
                updates.stripeSubscriptionId = null;
              } else {
                console.error("[Admin] Failed to cancel Stripe sub on downgrade:", stripeErr.message);
                return res.status(500).json({ error: "Failed to cancel Stripe subscription. User was NOT downgraded." });
              }
            }
          }
          updates.subscriptionExpiresAt = null;
        }

        updates.subscriptionTier = tier;

        await logAdminAction(adminId, "change_tier", userId, {
          from: user.subscriptionTier,
          to: tier,
          stripeSubscriptionCancelled: tier === "free" && !!user.stripeSubscriptionId,
        });
      } else if (action === "reset_usage") {
        updates.scriptUsageCount = 0;
        updates.scriptUsageLimitBonus = 0;
        updates.scriptUsageResetAt = null;
        await logAdminAction(adminId, "reset_usage", userId, {
          previousCount: user.scriptUsageCount,
          previousBonus: user.scriptUsageLimitBonus,
        });
      } else if (action === "grant_usage") {
        const { amount } = req.body;
        const extra = Math.max(0, Math.min(100, Number(amount) || 0));
        updates.scriptUsageLimitBonus = (user.scriptUsageLimitBonus || 0) + extra;
        await logAdminAction(adminId, "grant_usage", userId, {
          amount: extra,
          newBonus: updates.scriptUsageLimitBonus,
        });
      } else {
        return res.status(400).json({ error: "Invalid action" });
      }

      await db.update(users).set(updates).where(eq(users.id, userId));
      const [updated] = await db.select().from(users).where(eq(users.id, userId));
      const { passwordHash, ...safeUser } = updated;
      res.json({ ok: true, user: safeUser });
    } catch (error: any) {
      console.error("[Admin Plan] Error:", error.message);
      res.status(500).json({ error: "Failed to update plan" });
    }
  });

  app.post("/api/admin/users/:userId/block", async (req: any, res: Response) => {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "Not authorized" });
    const adminId = req.user?.claims?.sub || req.session?.claims?.sub || "unknown";
    try {
      const { userId } = req.params;
      const { blocked } = req.body;
      const isBlocked = blocked === true || blocked === "true";
      await db.update(users).set({
        blocked: isBlocked ? "true" : "false",
        blockedAt: isBlocked ? new Date() : null,
        updatedAt: new Date(),
      }).where(eq(users.id, userId));
      await logAdminAction(adminId, isBlocked ? "block_user" : "unblock_user", userId);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update user block status" });
    }
  });

  app.delete("/api/admin/users/:userId", async (req: any, res: Response) => {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "Not authorized" });
    const adminId = req.user?.claims?.sub || req.session?.claims?.sub || "unknown";
    try {
      const { userId } = req.params;
      const [targetUser] = await db.select().from(users).where(eq(users.id, userId));
      if (!targetUser) return res.status(404).json({ error: "User not found" });

      if (targetUser.stripeSubscriptionId) {
        try {
          const stripe = await getUncachableStripeClient();
          await stripe.subscriptions.cancel(targetUser.stripeSubscriptionId, {
            prorate: true,
          });
          console.log(`[Admin] Cancelled Stripe subscription ${targetUser.stripeSubscriptionId} for user ${userId}`);
        } catch (stripeErr: any) {
          if (stripeErr.code !== "resource_missing") {
            console.error("[Admin] Failed to cancel Stripe subscription:", stripeErr.message);
            return res.status(500).json({ error: "Failed to cancel Stripe subscription. User was NOT deleted." });
          }
        }
      }

      if (targetUser.stripeCustomerId) {
        try {
          const stripe = await getUncachableStripeClient();
          await stripe.customers.del(targetUser.stripeCustomerId);
          console.log(`[Admin] Deleted Stripe customer ${targetUser.stripeCustomerId} for user ${userId}`);
        } catch (stripeErr: any) {
          if (stripeErr.code !== "resource_missing") {
            console.error("[Admin] Failed to delete Stripe customer:", stripeErr.message);
          }
        }
      }

      await db.execute(sql`DELETE FROM analytics_events WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM error_logs WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM feedback_messages WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM feature_votes WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM feature_requests WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM performance_runs WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM recent_scripts WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM saved_scripts WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM pageviews WHERE user_id = ${userId}`);
      if (targetUser.email) {
        await db.execute(sql`DELETE FROM password_reset_tokens WHERE email = ${targetUser.email}`);
      }
      await db.execute(sql`DELETE FROM sessions WHERE sess->>'userId' = ${userId}`);
      await db.delete(users).where(eq(users.id, userId));

      await logAdminAction(adminId, "delete_user", userId, {
        email: targetUser.email,
        tier: targetUser.subscriptionTier,
        stripeCustomerId: targetUser.stripeCustomerId,
        stripeSubscriptionId: targetUser.stripeSubscriptionId,
      });

      res.json({ ok: true });
    } catch (error: any) {
      console.error("[Admin] Delete user error:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.post("/api/admin/users", async (req: any, res: Response) => {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "Not authorized" });
    const adminId = req.user?.claims?.sub || req.session?.claims?.sub || "unknown";
    try {
      const { email, firstName, lastName, password, tier } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });
      const selectedTier = tier && ALL_TIERS.includes(tier) ? tier : "free";

      const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase().trim()));
      if (existing.length > 0) return res.status(409).json({ error: "A user with this email already exists" });

      const bcrypt = await import("bcryptjs");
      const passwordHash = password ? await bcrypt.hash(password, 10) : null;

      const [newUser] = await db.insert(users).values({
        email: email.toLowerCase().trim(),
        firstName: firstName || null,
        lastName: lastName || null,
        passwordHash,
        authProvider: "email",
        onboardingComplete: "false",
        subscriptionTier: selectedTier,
      }).returning({ id: users.id });

      try {
        const stripe = await getUncachableStripeClient();
        const existingCustomers = await stripe.customers.list({ email: email.toLowerCase().trim(), limit: 1 });
        let stripeCustomerId: string;
        if (existingCustomers.data.length > 0) {
          stripeCustomerId = existingCustomers.data[0].id;
          console.log(`[Admin] Linked existing Stripe customer ${stripeCustomerId} for new user ${newUser.id}`);
        } else {
          const customer = await stripe.customers.create({
            email: email.toLowerCase().trim(),
            name: [firstName, lastName].filter(Boolean).join(" ") || undefined,
            metadata: { userId: newUser.id, createdBy: "admin" },
          });
          stripeCustomerId = customer.id;
          console.log(`[Admin] Created Stripe customer ${stripeCustomerId} for new user ${newUser.id}`);
        }
        await db.update(users).set({ stripeCustomerId }).where(eq(users.id, newUser.id));
      } catch (stripeErr: any) {
        console.error("[Admin] Stripe customer creation failed (user still created):", stripeErr.message);
      }

      await logAdminAction(adminId, "create_user", newUser.id, { email: email.toLowerCase().trim(), tier: selectedTier });

      res.json({ ok: true, userId: newUser.id });
    } catch (error: any) {
      console.error("[Admin] Create user error:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.get("/api/admin/stripe", async (req: any, res: Response) => {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "Not authorized" });
    try {
      const subscribers = await db.execute(
        sql`SELECT u.id, u.email, u.first_name, u.last_name, u.subscription_tier, u.stripe_customer_id, u.stripe_subscription_id, u.subscription_expires_at, u.created_at
            FROM users u WHERE u.stripe_customer_id IS NOT NULL ORDER BY u.created_at DESC`
      );

      let stripeData: any = { subscriptions: [], payments: [] };
      try {
        const subs = await db.execute(
          sql`SELECT id, customer_id, status, current_period_start, current_period_end, cancel_at_period_end, created FROM stripe.subscriptions ORDER BY created DESC LIMIT 50`
        );
        stripeData.subscriptions = subs.rows;
      } catch (e) {}

      try {
        const payments = await db.execute(
          sql`SELECT id, customer_id, amount, currency, status, created FROM stripe.charges ORDER BY created DESC LIMIT 50`
        );
        stripeData.payments = payments.rows;
      } catch (e) {}

      res.json({ subscribers: subscribers.rows, ...stripeData });
    } catch (error: any) {
      console.error("[Admin Stripe] Error:", error.message);
      res.status(500).json({ error: "Failed to fetch Stripe data" });
    }
  });

  app.get("/api/admin/settings", async (req: any, res: Response) => {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "Not authorized" });
    try {
      const settings = await db.select().from(adminSettings);
      const settingsMap: Record<string, string> = {};
      for (const s of settings) {
        settingsMap[s.key] = s.value;
      }
      settingsMap.free_daily_limit = settingsMap.free_daily_limit || String(FREE_DAILY_LIMIT_DEFAULT);
      settingsMap.trial_days = settingsMap.trial_days || String(TRIAL_DAYS_DEFAULT);
      res.json({ settings: settingsMap });
    } catch (error: any) {
      console.error("[Admin Settings] Error:", error.message);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.post("/api/admin/settings", async (req: any, res: Response) => {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "Not authorized" });
    const adminId = req.user?.claims?.sub || req.session?.claims?.sub || "unknown";
    try {
      const { key, value } = req.body;
      if (!key || value === undefined) return res.status(400).json({ error: "Key and value required" });

      const allowedKeys = ["free_daily_limit", "trial_days"];
      if (!allowedKeys.includes(key)) return res.status(400).json({ error: "Invalid setting key" });

      const numValue = parseInt(value, 10);
      if (isNaN(numValue) || numValue < 0) return res.status(400).json({ error: "Value must be a non-negative number" });

      const previous = await getAdminSetting(key, "");

      await db.insert(adminSettings).values({
        key,
        value: String(numValue),
        updatedAt: new Date(),
        updatedBy: adminId,
      }).onConflictDoUpdate({
        target: adminSettings.key,
        set: { value: String(numValue), updatedAt: new Date(), updatedBy: adminId },
      });

      await logAdminAction(adminId, "update_setting", undefined, {
        key,
        from: previous,
        to: String(numValue),
      });

      res.json({ ok: true, key, value: String(numValue) });
    } catch (error: any) {
      console.error("[Admin Settings] Update error:", error.message);
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  app.get("/api/admin/audit-log", async (req: any, res: Response) => {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "Not authorized" });
    try {
      const limit = Math.min(100, parseInt(req.query.limit as string, 10) || 50);
      const logs = await db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(limit);
      res.json({ logs });
    } catch (error: any) {
      console.error("[Admin Audit] Error:", error.message);
      res.status(500).json({ error: "Failed to fetch audit log" });
    }
  });

  return httpServer;
}

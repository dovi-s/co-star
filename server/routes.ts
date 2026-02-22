import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
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
  console.log(`[Voice] Assigned ${name} (index ${characterIndex}) -> ${voiceType} (${isFemale ? 'female' : 'male'})`);
  
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
  
  // Initialize WebSocket server for multiplayer
  setupMultiplayer(httpServer);
  
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "co-star" });
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
          console.log(`[TTS] Model ${modelId} failed, trying next:`, modelError.message);
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
      
      if (error.statusCode === 401) {
        return res.status(401).json({ error: "Invalid API key", fallback: true });
      }
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

      // AI Smart Cleanup - validate and filter parsed results
      console.log(`[Parse Script] Running AI Smart Cleanup...`);
      const { cleanedScript, removedCount, removedLines } = await aiCleanupScript(parsed);
      
      if (removedCount > 0) {
        console.log(`[Parse Script] AI removed ${removedCount} non-dialogue lines:`, removedLines.slice(0, 5));
        totalLines = cleanedScript.scenes.reduce((sum, scene) => sum + scene.lines.length, 0);
        console.log(`[Parse Script] After cleanup: ${cleanedScript.roles.length} roles, ${totalLines} lines`);
      }

      // AI Role Filter - remove non-character names like MOTORCYCLES, RIGHT HAND, etc.
      console.log(`[Parse Script] Running AI Role Filter...`);
      const finalScript = await aiFilterRoles(cleanedScript);
      if (finalScript.roles.length < cleanedScript.roles.length) {
        console.log(`[Parse Script] AI Role Filter removed ${cleanedScript.roles.length - finalScript.roles.length} non-character entries`);
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
            content: "Generate a short, descriptive title (2-5 words) for this script scene. If it's from a known show/movie/play, include the source name. Examples: \"Family Guy: TV Debate\", \"Hamlet: The Confrontation\", \"Coffee Shop Breakup\", \"Job Interview Gone Wrong\". Reply with ONLY the title, nothing else."
          }, {
            role: "user",
            content: snippet
          }],
          max_tokens: 20,
          temperature: 0.3,
        });
        const raw = nameResponse.choices[0]?.message?.content?.trim().replace(/^["']|["']$/g, '');
        if (raw && raw.length > 1 && raw.length <= 50) {
          suggestedName = raw;
        }
      } catch (e) {
        console.log('[Parse Script] Name generation failed, using fallback');
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
        console.log(`[Image->Session] Processing image: ${file.originalname}, ${file.buffer.length} bytes`);
        try {
          const openai = new OpenAI({
            apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
            baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
          });
          const base64 = file.buffer.toString("base64");
          const imgMime = mimeType === "image/jpeg" ? "image/jpeg" : mimeType === "image/png" ? "image/png" : "image/jpeg";
          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{
              role: "user",
              content: [
                { type: "text", text: "Extract all text from this script/screenplay page exactly as written. Preserve the original formatting including character names, dialogue, stage directions, and any other text. Output only the extracted text, nothing else." },
                { type: "image_url", image_url: { url: `data:${imgMime};base64,${base64}` } }
              ]
            }],
            max_tokens: 4096,
            temperature: 0.1,
          });
          text = response.choices[0]?.message?.content || "";
          console.log(`[Image->Session] Extracted ${text.length} characters from image`);
        } catch (imgErr: any) {
          console.error(`[Image->Session] OCR failed:`, imgErr.message);
          return res.status(500).json({ error: "Could not read text from image. Try a clearer photo." });
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

      // AI Smart Cleanup - validate and filter parsed results
      console.log(`[PDF->Session] Running AI Smart Cleanup...`);
      const { cleanedScript, removedCount, removedLines } = await aiCleanupScript(parsed);
      
      if (removedCount > 0) {
        console.log(`[PDF->Session] AI removed ${removedCount} non-dialogue lines:`, removedLines.slice(0, 5));
        totalLines = cleanedScript.scenes.reduce((sum, scene) => sum + scene.lines.length, 0);
        console.log(`[PDF->Session] After cleanup: ${cleanedScript.roles.length} roles, ${totalLines} lines`);
      }

      // AI Role Filter - remove non-character names like MOTORCYCLES, RIGHT HAND, etc.
      console.log(`[PDF->Session] Running AI Role Filter...`);
      const finalScript = await aiFilterRoles(cleanedScript);
      if (finalScript.roles.length < cleanedScript.roles.length) {
        console.log(`[PDF->Session] AI Role Filter removed ${cleanedScript.roles.length - finalScript.roles.length} non-character entries`);
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
        const { cleanedScript, removedCount } = await aiCleanupScript(parsed);
        const finalScript = await aiFilterRoles(cleanedScript);

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
        const { cleanedScript } = await aiCleanupScript(parsed);
        const finalScript = await aiFilterRoles(cleanedScript);

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

  return httpServer;
}

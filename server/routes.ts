import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const ELEVENLABS_VOICES = {
  male_deep: "pNInz6obpgDQGcFmaJgB",
  male_young: "TxGEqnHWrfWFTfGW9XjX", 
  male_mature: "VR6AewLTigWG4xSOukaG",
  female_warm: "EXAVITQu4vr4xnSDxMaL",
  female_young: "21m00Tcm4TlvDq8ikWAM",
  female_mature: "ThT5KcBeYPX3keUQqHPh",
  narrator: "pqHfZKP75CvOlQylNhV4",
  british_male: "N2lVS1w4EtoT3dr4eOWO",
  british_female: "jBpfuIE2acCO8z3wKNLl",
};

type VoiceType = keyof typeof ELEVENLABS_VOICES;

const FEMALE_NAMES = new Set([
  "maya", "juliet", "ophelia", "emma", "sophia", "olivia", "ava", "isabella", 
  "mia", "charlotte", "amelia", "harper", "evelyn", "abigail", "emily", "elizabeth",
  "sofia", "avery", "ella", "scarlett", "grace", "chloe", "victoria", "riley",
  "aria", "lily", "aurora", "zoey", "nora", "camila", "hannah", "lillian",
  "sarah", "jessica", "jennifer", "amanda", "ashley", "stephanie", "nicole", "melissa",
  "michelle", "lisa", "nancy", "karen", "betty", "helen", "sandra", "donna", "carol",
  "ruth", "sharon", "patricia", "catherine", "kate", "anna", "mary", "margaret",
  "kim", "catherine", "katherine", "kate", "claire", "clara", "diana", "eleanor",
  "eve", "fiona", "gwen", "iris", "jane", "julia", "laura", "lucy", "maria", "natalie",
  "nina", "paula", "rachel", "rebecca", "rose", "sara", "susan", "wendy", "alice"
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
  "marco", "derek", "zrix", "reyes", "patel"
]);

function assignVoiceToCharacter(characterName: string, index: number): VoiceType {
  const name = characterName.toLowerCase();
  const words = name.split(/[\s_-]+/);
  
  if (name.includes("narrator") || name.includes("stage") || name.includes("direction")) {
    return "narrator";
  }
  
  const titleIndicators = {
    female: ["lady", "queen", "mrs", "miss", "ms", "duchess", "countess", "princess", "dame", "madam", "madame"],
    male: ["lord", "king", "mr", "sir", "duke", "count", "prince", "baron", "captain", "commander", "chef", "dr", "doctor", "detective", "officer", "agent", "professor"],
    young: ["young", "boy", "girl", "child", "kid", "teen", "junior", "jr"],
    mature: ["old", "elder", "senior", "ancient", "grandfather", "grandmother", "grandpa", "grandma"],
    british: ["lord", "duke", "baron", "sir", "dame", "earl", "viscount", "marquess"]
  };
  
  let isFemale = false;
  let isMale = false;
  let isYoung = false;
  let isMature = false;
  let isBritish = false;
  
  for (const word of words) {
    if (FEMALE_NAMES.has(word)) isFemale = true;
    if (MALE_NAMES.has(word)) isMale = true;
    if (titleIndicators.female.some(t => word === t || word.startsWith(t))) isFemale = true;
    if (titleIndicators.male.some(t => word === t || word.startsWith(t))) isMale = true;
    if (titleIndicators.young.some(t => word === t)) isYoung = true;
    if (titleIndicators.mature.some(t => word === t)) isMature = true;
    if (titleIndicators.british.some(t => word === t)) isBritish = true;
  }
  
  const femaleKeywords = ["woman", "girl", "mother", "sister", "daughter", "nurse", "wife", "aunt", "niece", "waitress", "actress", "hostess"];
  const maleKeywords = ["man", "guy", "father", "brother", "son", "waiter", "actor", "host", "uncle", "nephew"];
  
  if (femaleKeywords.some(k => name.includes(k))) isFemale = true;
  if (maleKeywords.some(k => name.includes(k))) isMale = true;
  
  if (name.includes("sous chef")) isFemale = name.includes("kim") || name.includes("lisa") || name.includes("sarah");
  
  if (isBritish) {
    return isFemale ? "british_female" : "british_male";
  }
  
  if (isFemale && !isMale) {
    if (isMature) return "female_mature";
    if (isYoung) return "female_young";
    return "female_warm";
  }
  
  if (isMature) return "male_mature";
  if (isYoung) return "male_young";
  
  if (isMale || !isFemale) {
    const maleVoices: VoiceType[] = ["male_deep", "male_mature", "male_young"];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return maleVoices[hash % maleVoices.length];
  }
  
  return "male_deep";
}

function getVoiceSettings(emotion: string, preset: string) {
  let stability = 0.5;
  let similarityBoost = 0.75;
  let style = 0.4;
  let useSpeakerBoost = true;

  switch (emotion) {
    case "angry":
      stability = 0.3;
      style = 0.7;
      break;
    case "sad":
      stability = 0.7;
      style = 0.5;
      similarityBoost = 0.8;
      break;
    case "happy":
    case "excited":
      stability = 0.4;
      style = 0.6;
      break;
    case "whisper":
      stability = 0.8;
      style = 0.2;
      similarityBoost = 0.9;
      break;
    case "sarcastic":
      stability = 0.4;
      style = 0.6;
      break;
    case "fearful":
      stability = 0.3;
      style = 0.5;
      break;
    case "urgent":
      stability = 0.35;
      style = 0.55;
      break;
  }

  switch (preset) {
    case "theatrical":
      stability *= 0.8;
      style *= 1.3;
      break;
    case "deadpan":
      stability *= 1.4;
      style *= 0.5;
      break;
  }

  return {
    stability: Math.max(0, Math.min(1, stability)),
    similarity_boost: Math.max(0, Math.min(1, similarityBoost)),
    style: Math.max(0, Math.min(1, style)),
    use_speaker_boost: useSpeakerBoost,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "CastMate Studio" });
  });

  app.post("/api/tts/speak", async (req: Request, res: Response) => {
    try {
      const { text, characterName, characterIndex, emotion, preset } = req.body;

      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text is required" });
      }

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
      const voiceSettings = getVoiceSettings(emotion || "neutral", preset || "natural");

      const audioStream = await client.textToSpeech.convert(voiceId, {
        text,
        modelId: "eleven_turbo_v2_5",
        voiceSettings: voiceSettings,
      });

      const chunks: Buffer[] = [];
      const reader = audioStream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(Buffer.from(value));
      }
      const audioBuffer = Buffer.concat(chunks);

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

  return httpServer;
}

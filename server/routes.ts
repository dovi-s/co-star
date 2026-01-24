import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import OpenAI from "openai";

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
  "kim", "katherine", "claire", "clara", "diana", "eleanor",
  "eve", "fiona", "gwen", "iris", "jane", "julia", "laura", "lucy", "maria", "natalie",
  "nina", "paula", "rachel", "rebecca", "rose", "sara", "susan", "wendy", "alice",
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
  // Natural conversational defaults - higher stability = calmer, more consistent
  let stability = 0.7;
  let similarityBoost = 0.8;
  let style = 0.25;
  let useSpeakerBoost = true;

  // Moderate, natural-sounding variations for emotions
  switch (emotion) {
    case "neutral":
      stability = 0.75;
      style = 0.2;
      similarityBoost = 0.85;
      break;
    case "angry":
      stability = 0.55;  // More stable to prevent yelling
      style = 0.45;      // Moderate expression
      similarityBoost = 0.75;
      break;
    case "sad":
      stability = 0.8;
      style = 0.3;
      similarityBoost = 0.85;
      break;
    case "happy":
      stability = 0.65;
      style = 0.35;
      similarityBoost = 0.8;
      break;
    case "excited":
      stability = 0.6;
      style = 0.4;
      similarityBoost = 0.75;
      break;
    case "whisper":
      stability = 0.85;
      style = 0.1;
      similarityBoost = 0.9;
      break;
    case "sarcastic":
      stability = 0.65;
      style = 0.35;
      similarityBoost = 0.8;
      break;
    case "fearful":
      stability = 0.6;
      style = 0.35;
      similarityBoost = 0.75;
      break;
    case "urgent":
      stability = 0.55;
      style = 0.4;
      similarityBoost = 0.75;
      break;
  }

  switch (preset) {
    case "theatrical":
      stability *= 0.9;
      style *= 1.15;
      break;
    case "deadpan":
      stability *= 1.15;
      style *= 0.7;
      break;
  }

  // Clamp to safe ranges for natural speech
  return {
    stability: Math.max(0.5, Math.min(0.9, stability)),
    similarity_boost: Math.max(0.7, Math.min(0.95, similarityBoost)),
    style: Math.max(0.1, Math.min(0.5, style)),
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

      const systemPrompt = `You are an expert screenwriter creating dialogue scenes for actor rehearsal. Your PRIMARY goal is to match EXACTLY what the user describes.

CRITICAL: Follow the user's request precisely:
- If they mention specific characters, roles, or relationships - use those exact ones
- If they describe a setting or situation - set the scene there exactly
- If they want a specific genre or tone - deliver that exact tone
- If they mention a movie, play, or show style - match that style closely

Format Requirements:
- Write 10-18 lines of dialogue (enough for a good rehearsal)
- Use 2-4 characters with distinct voices
- Character names in ALL CAPS followed by colon
- Include emotional stage directions in [brackets] before dialogue
- Stage directions should indicate: emotion, action, tone (e.g., [furious, slamming the door], [whispering nervously], [with forced calm])

Quality Standards:
- Natural, speakable dialogue - how real people talk
- Clear dramatic arc with rising tension or emotional stakes
- Each character has a distinct voice and motivation
- Subtext - what's unsaid matters as much as what's said
- Strong emotional moments for the actor to play

Output ONLY the script lines. No titles, scene headings, or commentary.

Example format:
SARAH: [coldly] You're late. Again.
MARCUS: [defensive] Traffic was—
SARAH: [cutting him off] Don't. Just... don't.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.7,
      });

      const script = response.choices[0]?.message?.content?.trim() || "";
      
      if (!script) {
        return res.status(500).json({ error: "Failed to generate script" });
      }

      res.json({ script });
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
        { setting: "hospital waiting room", conflict: "two estranged family members forced to wait together for news about a loved one" },
        { setting: "police interrogation room", conflict: "detective questioning a suspect who may be innocent" },
        { setting: "therapist's office", conflict: "couple in marriage counseling revealing deep resentments" },
        { setting: "airport terminal", conflict: "ex-lovers unexpectedly meeting before one leaves the country forever" },
        { setting: "lawyer's office", conflict: "siblings fighting over their late parent's will" },
        { setting: "restaurant kitchen", conflict: "head chef confronting sous chef about sabotaging a dish" },
        { setting: "high school reunion", conflict: "former bully apologizing to their victim 20 years later" },
        { setting: "hospital room", conflict: "adult child confronting dying parent about childhood abandonment" },
        { setting: "taxi/rideshare", conflict: "driver and passenger discovering they share a painful connection" },
        { setting: "job interview", conflict: "candidate realizes interviewer is the person who fired them years ago" },
        { setting: "wedding venue", conflict: "best man revealing he's in love with the groom moments before ceremony" },
        { setting: "prison visiting room", conflict: "wrongfully convicted person meeting the witness who lied" },
        { setting: "therapist's office", conflict: "patient revealing they've been lying about everything for months" },
        { setting: "late night diner", conflict: "two strangers bonding over shared grief" },
        { setting: "backstage at a theater", conflict: "understudy confronting lead actor about their toxic behavior" },
        { setting: "corporate boardroom", conflict: "whistleblower facing the CEO they're about to expose" },
        { setting: "park bench", conflict: "birth parent meeting the child they gave up for adoption" },
        { setting: "empty bar at closing", conflict: "bartender talking down a regular from a terrible decision" },
        { setting: "courtroom hallway", conflict: "victim facing their attacker before the verdict" },
        { setting: "midnight rooftop", conflict: "two old friends, one trying to prevent the other from giving up" }
      ];
      
      const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

      const systemPrompt = `You are an expert screenwriter creating powerful dialogue scenes for actor rehearsal.

Create an emotionally intense scene with these parameters:
- Setting: ${scenario.setting}
- Central conflict: ${scenario.conflict}

Requirements:
- Write 12-18 lines of gripping dialogue
- 2-3 characters with distinct voices and clear motivations
- Character names in ALL CAPS followed by colon
- Rich emotional stage directions in [brackets] (e.g., [barely containing rage], [voice cracking], [forced smile])
- Build tension throughout - start tense, escalate to a breaking point
- Include a powerful emotional climax or revelation
- Natural, speakable dialogue with subtext
- Strong actable moments: pauses, interruptions, physical reactions

Output ONLY the dialogue. No scene headings, titles, or commentary.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Generate this scene now." }
        ],
        max_tokens: 1500,
        temperature: 0.85,
      });

      const script = response.choices[0]?.message?.content?.trim() || "";
      
      if (!script) {
        return res.status(500).json({ error: "Failed to generate script" });
      }

      res.json({ script, theme: `${scenario.setting}: ${scenario.conflict}` });
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

      if (script.length > 50000) {
        return res.status(400).json({ error: "Script too long. Maximum 50,000 characters." });
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
4. Include stage directions in [brackets] when they appear before or within dialogue
5. Remove scene headings, action descriptions, and non-dialogue text
6. Preserve the order of dialogue as it appears
7. If the format is unclear, make your best intelligent guess based on context
8. Keep emotional parentheticals like (whispering), (angry), (laughing) as [stage directions]

SUPPORTED INPUT FORMATS:
- Standard screenplay: CHARACTER NAME then dialogue below
- Colon format: CHARACTER: dialogue
- Play format: CHARACTER. dialogue
- Novel format: "Dialogue," said Character.
- Chat/messenger format: Name: message
- Any other format - extract dialogue intelligently

OUTPUT ONLY the formatted dialogue lines. No explanations or commentary.

Example output:
JOHN: [excited] Did you hear the news?
MARY: [surprised] What news?
JOHN: We got the contract.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: script }
        ],
        max_tokens: 4000,
        temperature: 0.3,
      });

      const cleanedScript = response.choices[0]?.message?.content?.trim() || "";
      
      if (!cleanedScript) {
        return res.status(500).json({ error: "Failed to clean script" });
      }

      res.json({ script: cleanedScript });
    } catch (error: any) {
      console.error("Script cleanup error:", error.message || error);
      res.status(500).json({ error: "Failed to clean script" });
    }
  });

  return httpServer;
}

import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import OpenAI from "openai";

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
  
  // Check against name lists
  for (const word of words) {
    if (FEMALE_NAMES.has(word)) isFemale = true;
    if (MALE_NAMES.has(word)) isFemale = false; // Male takes precedence if both
  }
  
  // Title/keyword checks
  const femaleIndicators = ["lady", "queen", "mrs", "miss", "ms", "duchess", "princess", "madam", "woman", "girl", "mother", "sister", "daughter", "wife", "aunt", "waitress", "actress"];
  const maleIndicators = ["lord", "king", "mr", "sir", "duke", "prince", "baron", "captain", "dr", "man", "guy", "father", "brother", "son", "waiter", "actor", "uncle"];
  
  if (femaleIndicators.some(ind => name.includes(ind))) isFemale = true;
  if (maleIndicators.some(ind => name.includes(ind))) isFemale = false;
  
  // Deterministic voice selection based on character index (ensures different characters get different voices)
  let voiceType: VoiceType;
  
  if (isFemale) {
    const femaleVoices: VoiceType[] = ["female_1", "female_2", "female_3"];
    voiceType = femaleVoices[characterIndex % femaleVoices.length];
  } else {
    const maleVoices: VoiceType[] = ["male_1", "male_2", "male_3"];
    voiceType = maleVoices[characterIndex % maleVoices.length];
  }
  
  voiceAssignmentCache.set(name, voiceType);
  console.log(`[Voice] Assigned ${name} (index ${characterIndex}) -> ${voiceType} (${isFemale ? 'female' : 'male'})`);
  
  return voiceType;
}

function getVoiceSettings(_emotion: string, _preset: string) {
  // Simple, natural audition-style reads - no theatrical performance
  // High stability = consistent, calm delivery like a table read
  // Low style = no dramatic expression, just reading the lines naturally
  return {
    stability: 0.85,        // Very stable, consistent delivery
    similarity_boost: 0.9,  // Stay close to natural voice
    style: 0.05,            // Minimal expression - just reading lines
    use_speaker_boost: true,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "CastMate Studio" });
  });

  // Clear voice cache on session start (call from client when starting new session)
  app.post("/api/tts/reset", (_req: Request, res: Response) => {
    voiceAssignmentCache.clear();
    console.log("[Voice] Cache cleared for new session");
    res.json({ success: true });
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

      const systemPrompt = `You are a professional screenwriter creating realistic dialogue for actor rehearsal. Match the user's request EXACTLY.

CRITICAL RULES:
1. Follow the user's prompt precisely - their characters, setting, situation, and tone
2. Write dialogue that sounds like REAL PEOPLE talking - natural, conversational, with contractions
3. Every line must logically follow from the previous line - no random topic jumps
4. Characters must react to what the other person just said

FORMAT:
- 12-20 lines of dialogue
- Any number of characters the user requests
- Format: CHARACTER: [emotion] Dialogue here.
- Character names in ALL CAPS
- Brief stage directions in [brackets] - just the emotion, keep it simple

WHAT MAKES GOOD DIALOGUE:
- Each character has a clear goal in the scene
- Conflict or tension drives the scene forward
- Lines are SHORT - people don't give speeches, they talk back and forth
- Interruptions, pauses, trailing off are natural
- The scene has a beginning, escalation, and resolution/cliffhanger

BAD dialogue examples (don't do this):
- Long monologues or exposition dumps
- Characters explaining things they both already know
- Random topic changes mid-conversation
- Overly dramatic or theatrical language

GOOD dialogue feels like eavesdropping on a real conversation.

Output ONLY the dialogue lines. No titles, headers, or explanations.`;

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

      const systemPrompt = `Write a realistic dialogue scene for actor rehearsal practice.

SCENE SETUP:
- Location: ${scenario.setting}
- Situation: ${scenario.conflict}

REQUIREMENTS:
1. Write 12-16 lines of natural dialogue between 2 characters
2. Format each line as: CHARACTER: [emotion] Dialogue text.
3. Character names in ALL CAPS
4. Keep stage directions brief - just the emotion in [brackets]

CRITICAL - Make it feel REAL:
- Short, punchy lines - people interrupt each other, trail off, react
- Every line must respond to what was just said - no random jumps
- Use contractions (don't, can't, won't) - nobody talks formally
- Include awkward pauses, half-sentences, people talking over each other
- Build naturally from hello/confrontation to climax to resolution

BAD (don't write like this):
- "I have been meaning to tell you something important about our relationship and how I feel..."
- Long speeches or monologues
- Perfectly articulate emotional revelations

GOOD (write like this):
- "Wait, what? No. No, you can't just—"
- "I know. I know, okay? But listen—"
- Messy, real, interrupted speech

This is for actors to practice with, so make the emotions clear but the dialogue natural.

Output ONLY the dialogue. No scene titles or descriptions.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Write this scene now. Make it feel like a real conversation." }
        ],
        max_tokens: 1500,
        temperature: 0.7,
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

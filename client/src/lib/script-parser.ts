import type { ParsedScript, Role, Scene, ScriptLine } from "@shared/schema";
import { detectEmotion } from "./tts-engine";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

const DIRECTION_REGEX = /\[([^\]]+)\]/g;
const PARENTHETICAL_REGEX = /\(([^)]+)\)/g;
const SCENE_HEADING_REGEX = /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.|SCENE\s*\d|ACT\s*[IVX\d]|FADE IN|FADE OUT|CUT TO|DISSOLVE TO|SMASH CUT|MATCH CUT|JUMP CUT)/i;

// Common screenplay transitions that should be ignored
const TRANSITION_REGEX = /^(FADE TO:|DISSOLVE TO:|CUT TO:|SMASH CUT TO:|MATCH CUT TO:|JUMP CUT TO:|FADE OUT\.|FADE IN\.|THE END|CONTINUED|MORE)$/i;

const CHARACTER_EXTENSIONS = [
  "V.O.", "VO", "V/O", "VOICE OVER", "VOICEOVER", "VOICE-OVER",
  "O.S.", "OS", "O/S", "OFF SCREEN", "OFFSCREEN", "OFF-SCREEN",
  "O.C.", "OC", "OFF CAMERA", "OFF-CAMERA",
  "CONT'D", "CONT", "CONTINUED", "CONTINUING",
  "PRE-LAP", "PRELAP", "PRE LAP",
  "FILTER", "ON PHONE", "ON TV", "ON RADIO", "OVER PHONE",
  "SUBTITLE", "SUBTITLED", "TRANSLATED",
  "INTO PHONE", "INTO RADIO", "INTO MIC"
];

const EXTENSION_PATTERN = new RegExp(
  `\\s*\\((?:${CHARACTER_EXTENSIONS.join("|")})\\)\\s*`,
  "gi"
);

// Reserved words that should NOT be character names
const RESERVED_WORDS = new Set([
  "INT", "EXT", "INTERIOR", "EXTERIOR", "DAY", "NIGHT", "DAWN", "DUSK",
  "CONTINUOUS", "LATER", "MOMENTS LATER", "SAME", "FLASHBACK",
  "FADE", "CUT", "DISSOLVE", "SMASH", "MATCH", "JUMP", "THE END",
  "CONTINUED", "MORE", "ANGLE ON", "CLOSE ON", "WIDE ON", "INSERT",
  "POV", "SUPER", "TITLE", "SUBTITLE", "CHYRON", "MONTAGE", "SERIES OF SHOTS",
  "BEGIN", "END", "BACK TO", "INTERCUT", "SPLIT SCREEN",
  // Common scene direction starters
  "CUT TO", "FADE TO", "SMASH CUT", "JUMP CUT", "MATCH CUT", "DISSOLVE TO",
  // Sound/music cues (NOT characters!)
  "MUSIC", "SOUND", "SFX", "SCORE", "SONG", "AUDIO",
  // Generic words that aren't names
  "THINGS", "STUFF", "SOMETHING", "NOTHING", "EVERYTHING", "ANYTHING",
  "PRIORITY", "IMPORTANT", "NOTE", "NOTES", "COMMENT", "COMMENTS",
  "SCENE", "SCENES", "ACT", "ACTS", "PART", "PARTS", "CHAPTER", "CHAPTERS",
  // Preposition phrases
  "IN THE", "ON THE", "AT THE", "TO THE", "FOR THE", "WITH THE",
  // Known false positives
  "PRIORITY IN THIS JOB", "WE SEE", "WE HEAR",
]);

// Pattern to detect sound/music cue lines (e.g., "MUSIC: Jazz tune plays")
const SOUND_CUE_REGEX = /^(MUSIC|SOUND|SFX|SCORE|SONG|AUDIO)\s*:/i;

// Detect action description lines (third-person narrative describing what happens)
// These are scene descriptions, not dialogue
function isActionDescriptionLine(line: string): boolean {
  const trimmed = line.trim();
  
  // Skip if it looks like dialogue (starts with common dialogue patterns)
  if (/^(I\s|I'm|I've|I'll|I'd|You\s|My\s|What|Why|How|When|Where|Who|No,|Yes,|Oh,|Well,|But\s|And\s|So\s|Just\s|Look,|Listen,|Hey|Wait|Please|Thank|Sorry|Okay|Ok,|Alright|Don't|Can't|Won't|Didn't|Isn't|Aren't|Let's|Let me)/i.test(trimmed)) {
    return false;
  }
  
  // Action lines typically start with third-person subjects + verbs
  // e.g., "Nancy and Robert are kissing", "They fall onto the bed", "He walks away"
  const actionPatterns = [
    // Third person pronouns + verb
    /^(He|She|They|It|We|Everyone|Everybody|Someone|Somebody|No one|Nobody)\s+(is|are|was|were|walks?|runs?|looks?|turns?|moves?|stands?|sits?|enters?|exits?|comes?|goes?|takes?|puts?|gets?|sees?|falls?|speaks?|kisses?|grabs?|picks?|drops?|holds?|starts?|stops?|opens?|closes?|continues?|begins?|appears?|disappears?)/i,
    // Proper name + "and" + name (e.g., "Nancy and Robert are")
    /^[A-Z][a-z]+\s+and\s+[A-Z][a-z]+\s+(is|are|was|were|walk|run|look|turn|move|stand|sit|enter|exit|come|go|take|put|get|see|fall|speak|kiss|grab|pick|drop|hold|start|stop|open|close|continue|begin|appear|disappear)/i,
    // Name + verb (e.g., "Nancy walks", "Robert turns")
    /^[A-Z][a-z]+\s+(is|are|was|were|walks?|runs?|looks?|turns?|moves?|stands?|sits?|enters?|exits?|comes?|goes?|takes?|puts?|gets?|sees?|falls?|speaks?|kisses?|grabs?|picks?|drops?|holds?|starts?|stops?|opens?|closes?|continues?|begins?|appears?|disappears?)/i,
    // "The" + noun + verb (e.g., "The door opens", "The band plays")
    /^The\s+\w+\s+(is|are|was|were|opens?|closes?|plays?|starts?|stops?|begins?|ends?|continues?)/i,
    // Present participle descriptions (e.g., "Looking at the door", "Walking away")
    /^(Looking|Walking|Running|Moving|Standing|Sitting|Entering|Exiting|Coming|Going|Taking|Getting|Seeing|Falling|Speaking|Kissing|Grabbing|Picking|Dropping|Holding|Starting|Stopping|Opening|Closing|Continuing|Beginning|Appearing|Disappearing)/i,
    // "We see/hear/push in" - narrative voice
    /^We\s+(see|hear|push|pull|pan|zoom|track|follow|cut)/i,
    // Page numbers at end
    /\d+\.?\s*$/,
  ];
  
  for (const pattern of actionPatterns) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  
  return false;
}

// Patterns that indicate action/direction lines, not character dialogue
const ACTION_PATTERNS = [
  // Character name + verb pattern (e.g., "JORDAN REALIZES", "SARAH WALKS")
  /^[A-Z]+\s+(REALIZES?|WALKS?|RUNS?|LOOKS?|TURNS?|MOVES?|STANDS?|SITS?|ENTERS?|EXITS?|LEAVES?|COMES?|GOES?|TAKES?|PUTS?|GETS?|SEES?|HEARS?|FEELS?|THINKS?|KNOWS?|WANTS?|TRIES?|STARTS?|STOPS?|OPENS?|CLOSES?|PICKS?|DROPS?|HOLDS?|GRABS?|REACHES?|POINTS?|NODS?|SHAKES?|SMILES?|LAUGHS?|CRIES?|SCREAMS?|YELLS?|WHISPERS?|SIGHS?|PAUSES?|HESITATES?|CONTINUES?|BEGINS?|ENDS?|APPEARS?|DISAPPEARS?)(\s|$)/i,
  // Phrase patterns that are clearly not character names
  /^(MEANWHILE|SUDDENLY|LATER|EARLIER|OUTSIDE|INSIDE|NEARBY|ABOVE|BELOW|BEHIND|BEFORE|AFTER)/i,
  // Preposition anywhere (e.g., "PRIORITY IN THIS JOB", "MAN WITH GUN")
  /\s(IN|ON|AT|TO|FOR|WITH|FROM|BY|OF|ABOUT|INTO|ONTO|OVER|UNDER|THROUGH|AND|OR)\s/i,
  // Common phrases that aren't names
  /^(THE|THIS|THAT|THESE|THOSE|A|AN)\s+/i,
  // 4+ words is likely a phrase (real names can be up to 3 words with title like "DR. ROBERT DOBACK")
  /^\S+\s+\S+\s+\S+\s+\S+/,
];

function normalizeCharacterName(name: string): string {
  let normalized = name.trim();
  
  // Remove character extensions like (V.O.), (CONT'D), etc.
  normalized = normalized.replace(EXTENSION_PATTERN, "");
  // Remove any remaining parenthetical at end
  normalized = normalized.replace(/\([^)]*\)\s*$/, "");
  // Remove leading numbers (e.g., "1. MARY")
  normalized = normalized.replace(/^\d+[\.\)\-\s]+/, "");
  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, " ");
  normalized = normalized.trim();
  
  return normalized.toUpperCase();
}

function isValidCharacterName(name: string): boolean {
  const normalized = normalizeCharacterName(name);
  
  // Must be reasonable length
  if (normalized.length < 2 || normalized.length > 35) return false;
  
  // Must start with a letter
  if (!/^[A-Z]/.test(normalized)) return false;
  
  // Must not be a reserved word
  if (RESERVED_WORDS.has(normalized)) return false;
  
  // Must not look like a scene heading
  if (SCENE_HEADING_REGEX.test(normalized)) return false;
  
  // Must not be a transition
  if (TRANSITION_REGEX.test(normalized)) return false;
  
  // Must not match action patterns (e.g., "JORDAN REALIZES")
  for (const pattern of ACTION_PATTERNS) {
    if (pattern.test(normalized)) return false;
  }
  
  // Should be mostly letters (allow spaces, hyphens, apostrophes, periods for titles)
  if (!/^[A-Z][A-Z0-9\s\-'\.#]+$/.test(normalized)) return false;
  
  // Character names typically are 1-2 words (maybe 3 with title like "DR. JOHN SMITH")
  const wordCount = normalized.split(/\s+/).length;
  if (wordCount > 3) return false;
  
  return true;
}

// Check if a line is JUST a character name (professional screenplay format)
function isStandaloneCharacterName(line: string): { isCharacter: boolean; name: string } {
  const trimmed = line.trim();
  
  // Must be ALL CAPS (or mostly caps)
  const capsRatio = (trimmed.match(/[A-Z]/g) || []).length / trimmed.replace(/\s/g, "").length;
  if (capsRatio < 0.7) return { isCharacter: false, name: "" };
  
  // Remove extensions to get core name
  let coreName = trimmed.replace(EXTENSION_PATTERN, "").trim();
  coreName = coreName.replace(/\([^)]*\)\s*$/, "").trim();
  
  // Should be short (character names are typically 1-2 words)
  const wordCount = coreName.split(/\s+/).length;
  if (wordCount > 3) return { isCharacter: false, name: "" };
  
  // Validate as character name
  if (!isValidCharacterName(coreName)) return { isCharacter: false, name: "" };
  
  return { isCharacter: true, name: normalizeCharacterName(trimmed) };
}

function isLikelyCharacterLine(line: string): { isCharacter: boolean; name: string; dialogue: string } {
  const trimmed = line.trim();
  
  if (!trimmed || trimmed.length < 2) {
    return { isCharacter: false, name: "", dialogue: "" };
  }
  
  // Skip scene headings
  if (SCENE_HEADING_REGEX.test(trimmed)) {
    return { isCharacter: false, name: "", dialogue: "" };
  }
  
  // Skip transitions
  if (TRANSITION_REGEX.test(trimmed)) {
    return { isCharacter: false, name: "", dialogue: "" };
  }
  
  // Skip pure stage directions
  if (/^\[.*\]$/.test(trimmed) || /^\(.*\)$/.test(trimmed)) {
    return { isCharacter: false, name: "", dialogue: "" };
  }
  
  // Pattern 1: CHARACTER: dialogue (most common for pasted scripts)
  const colonPatterns = [
    // Basic: NAME: dialogue
    /^([A-Za-z][A-Za-z0-9\s\-'\.]+?)(?:\s*\([^)]*\))?\s*[:：]\s*(.+)$/,
    // ALL CAPS: NAME: dialogue  
    /^([A-Z][A-Z0-9\s\-'\.]+?)(?:\s*\([^)]*\))?\s*[:：]\s*(.+)$/,
    // With title: DR. SMITH: dialogue
    /^((?:DR|MR|MRS|MS|MISS|PROF|REV|SIR|LADY|LORD|CAPTAIN|COLONEL|GENERAL|SERGEANT|OFFICER|DETECTIVE|INSPECTOR|AGENT|NURSE|CHEF|WAITER|WAITRESS|FATHER|MOTHER|SISTER|BROTHER|UNCLE|AUNT|GRANDMA|GRANDPA)\.?\s+[A-Za-z][A-Za-z\-'\.]+)(?:\s*\([^)]*\))?\s*[:：]\s*(.+)$/i,
    // Numbered: 1. NAME: dialogue
    /^(\d+[\.\)]\s*[A-Za-z][A-Za-z0-9\s\-'\.]+?)(?:\s*\([^)]*\))?\s*[:：]\s*(.+)$/,
    // With extension: NAME (V.O.): dialogue
    /^([A-Z][A-Z0-9\s\-'\.]+\s*\([^)]+\))\s*[:：]\s*(.+)$/,
  ];
  
  for (const pattern of colonPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const potentialName = match[1].trim();
      const dialogue = match[2].trim();
      
      if (potentialName.length <= 40 && dialogue.length > 0) {
        const normalizedName = normalizeCharacterName(potentialName);
        if (isValidCharacterName(potentialName)) {
          return { isCharacter: true, name: normalizedName, dialogue };
        }
      }
    }
  }
  
  // Pattern 2: CHARACTER - dialogue (sometimes used)
  const dashPattern = /^([A-Z][A-Z\s\-'\.]+?)\s*[-–—]\s*(.+)$/;
  const dashMatch = trimmed.match(dashPattern);
  if (dashMatch) {
    const potentialName = dashMatch[1].trim();
    const dialogue = dashMatch[2].trim();
    
    if (potentialName.length <= 30 && dialogue.length > 0 && !dialogue.startsWith("-")) {
      if (isValidCharacterName(potentialName)) {
        return { isCharacter: true, name: normalizeCharacterName(potentialName), dialogue };
      }
    }
  }
  
  // Pattern 3: CHARACTER> dialogue (rare but happens)
  const arrowPattern = /^([A-Z][A-Z\s\-'\.]+?)\s*[>»]\s*(.+)$/;
  const arrowMatch = trimmed.match(arrowPattern);
  if (arrowMatch) {
    const potentialName = arrowMatch[1].trim();
    const dialogue = arrowMatch[2].trim();
    
    if (isValidCharacterName(potentialName)) {
      return { isCharacter: true, name: normalizeCharacterName(potentialName), dialogue };
    }
  }
  
  return { isCharacter: false, name: "", dialogue: "" };
}

function extractDirectionsFromDialogue(text: string): { cleanText: string; directions: string[] } {
  const directions: string[] = [];
  
  // Extract [bracketed directions]
  let cleanText = text.replace(DIRECTION_REGEX, (_, dir) => {
    directions.push(dir.trim());
    return "";
  });
  
  // Extract (parenthetical directions) that contain emotion/action keywords
  cleanText = cleanText.replace(PARENTHETICAL_REGEX, (match, content) => {
    const lower = content.toLowerCase().trim();
    
    // Common stage direction patterns (start with "to", action verb, or location)
    const directionPatterns = [
      /^to\s+(himself|herself|themselves|the|a|nancy|robert|dale|brennan)/i,
      /^(off|on)\s+(mic|camera|screen)/i,
      /^(looks?|looking)\s+(at|up|down|around|away)/i,
      /^(turns?|turning)\s+(to|around|away|back)/i,
      /^(slams?|slamming|grabs?|grabbing|picks?|picking|holds?|holding)/i,
      /^(singing|humming|whistling|dancing|clapping)/i,
      /^(then|and then)\s+/i,
    ];
    
    if (directionPatterns.some(pattern => pattern.test(lower))) {
      directions.push(content.trim());
      return "";
    }
    
    const emotionKeywords = [
      "angry", "angrily", "sad", "sadly", "happy", "happily", "excited", "excitedly",
      "nervous", "nervously", "scared", "whispering", "whispers", "whispered",
      "shouting", "shouts", "shouted", "yelling", "yells", "yelled",
      "crying", "cries", "cried", "sobbing", "sobs", "sobbed",
      "laughing", "laughs", "laughed", "chuckling", "chuckles",
      "sarcastic", "sarcastically", "ironic", "ironically",
      "quiet", "quietly", "loud", "loudly", "soft", "softly",
      "hesitant", "hesitantly", "confident", "confidently",
      "desperate", "desperately", "pleading", "pleads", "begging", "begs",
      "threatening", "threateningly", "menacing", "menacingly",
      "mocking", "mockingly", "tender", "tenderly", "cold", "coldly",
      "warm", "warmly", "bitter", "bitterly", "gentle", "gently",
      "harsh", "harshly", "firm", "firmly",
      "pause", "pauses", "pausing", "beat", "a beat",
      "sighing", "sighs", "sighed", "trembling", "trembles", "trembled",
      "to self", "to himself", "to herself", "aside", "under breath",
      "continuing", "continues", "interrupting", "interrupts", "overlapping", "cutting off",
      "reading", "quoting", "imitating", "mimicking",
      "re:", "regarding", "about", "pointing", "gesturing", "nodding",
      "shaking head", "looking", "turning", "moving", "walking",
      "sitting", "standing", "entering", "exiting", "crossing",
      "off camera", "off mic", "off screen", "o.c.", "v.o.",
      "smiling", "smiles", "grinning", "grins", "frowning", "frowns"
    ];
    
    if (emotionKeywords.some(kw => lower.includes(kw))) {
      directions.push(content.trim());
      return "";
    }
    
    // Keep other parentheticals (they might be part of the dialogue)
    return match;
  });
  
  // Clean up multiple spaces
  cleanText = cleanText.replace(/\s+/g, " ").trim();
  
  return { cleanText, directions };
}

// Patterns that indicate camera/action directions (not dialogue)
const CAMERA_ACTION_PATTERNS = [
  /^(WE SEE|WE HEAR|CUT TO|SMASH CUT|MATCH CUT|DISSOLVE TO|FADE|PAN|ZOOM|CLOSE ON|ANGLE ON|BACK TO|FLASH|INSERT|INTERCUT|MONTAGE|SUPER|TITLE|CREDITS)/i,
  /^(A |AN |THE |THEIR |HIS |HER |ITS )/i, // Action descriptions
  /^\d+[A-Z]?\s+(WE|INT|EXT|SCENE|CUT|FADE)/i, // Scene numbers with directions
  /^\d+[A-Z]?[\-\s]+\d+[A-Z]?\s/i, // Scene ranges like "215C-G"
  /^[A-Z]+\s+(walks|runs|enters|exits|stands|sits|looks|turns|moves|picks|puts|takes|grabs|holds)/i, // Action lines
];

// Check if line is a scene number (like "1A", "215C-G", etc.)
function isSceneNumber(line: string): boolean {
  const trimmed = line.trim();
  return /^\d+[A-Z]?[\s\-]*[A-Z]?\s*$/.test(trimmed) || /^\d+[A-Z]?\s*$/.test(trimmed);
}

// Check if a line is likely dialogue continuation
function isDialogueContinuation(line: string, originalLine: string): boolean {
  const trimmed = line.trim();
  
  if (!trimmed) return false;
  
  // === STOP PATTERNS: These definitely end dialogue ===
  
  // Scene headings
  if (SCENE_HEADING_REGEX.test(trimmed)) return false;
  
  // Transitions
  if (TRANSITION_REGEX.test(trimmed)) return false;
  
  // Scene numbers  
  if (isSceneNumber(trimmed)) return false;
  
  // Camera/action directions
  for (const pattern of CAMERA_ACTION_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }
  
  // Standalone character names (ALL CAPS, short, on own line)
  if (/^[A-Z][A-Z\s\-'\.]+$/.test(trimmed) && trimmed.length < 30) {
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount <= 3) return false;
  }
  
  // Third-person action descriptions (He walks, She looks, They fall)
  if (/^(He|She|They|It|We)\s+(is|are|was|were|meets?|looks?|walks?|runs?|turns?|falls?|speaks?|sees?|hears?|enters?|exits?|picks?|grabs?|holds?|takes?|gives?|opens?|closes?|stands?|sits?|moves?|comes?|goes?|gets?|puts?|starts?|stops?|begins?|ends?|pushes?|pulls?|kisses?|hugs?|ushers?)/i.test(trimmed)) {
    return false;
  }
  
  // "The [noun] [verb]" action descriptions
  if (/^The\s+\w+\s+(is|are|was|were|opens?|closes?|falls?|begins?|starts?)/i.test(trimmed)) {
    return false;
  }
  
  // Character introductions (NAME, age)
  if (/[A-Z]{2,}\s+[A-Z]+,\s*\d{1,2}/.test(trimmed)) {
    return false;
  }
  
  // Page numbers (just a number or "2." at start)
  if (/^\d+\.?\s*$/.test(trimmed)) return false;
  
  // MUSIC: cue lines
  if (/^MUSIC:/i.test(trimmed)) return false;
  
  // Action lines starting with proper name + verb
  if (/^[A-Z][a-z]+\s+(is|are|was|were|and\s+[A-Z][a-z]+\s+(is|are|was|were))/i.test(trimmed)) {
    return false;
  }
  
  // === IF NONE OF THE STOP PATTERNS MATCHED, IT'S LIKELY DIALOGUE ===
  // Dialogue can be anything that's not an action/heading/character name
  return true;
}

export function parseScript(rawText: string): ParsedScript {
  const lines = rawText.split(/\r?\n/);
  
  const roles: Map<string, Role> = new Map();
  const scenes: Scene[] = [];
  
  let currentSceneLines: ScriptLine[] = [];
  let currentSceneName = "Scene 1";
  let currentSceneDescription = "";
  let sceneCount = 1;
  let lineNumber = 0;
  
  let pendingCharacter: string | null = null;
  let pendingDialogue: string[] = [];
  let pendingContext: string[] = []; // Action lines before dialogue
  
  // Skip title page / front matter until first scene heading
  let foundFirstScene = false;
  let collectingSceneDescription = false;

  const flushPendingDialogue = () => {
    if (pendingCharacter && pendingDialogue.length > 0) {
      const fullDialogue = pendingDialogue.join(" ");
      const { cleanText, directions } = extractDirectionsFromDialogue(fullDialogue);
      
      if (cleanText) {
        if (!roles.has(pendingCharacter)) {
          roles.set(pendingCharacter, {
            id: generateId(),
            name: pendingCharacter,
            voicePreset: "natural",
            isUserRole: false,
            lineCount: 0,
          });
        }
        
        const role = roles.get(pendingCharacter)!;
        role.lineCount++;
        
        const direction = directions.join("; ");
        const contextText = pendingContext.join(" ").trim();
        const scriptLine: ScriptLine = {
          id: generateId(),
          lineNumber: lineNumber++,
          roleId: role.id,
          roleName: pendingCharacter,
          text: cleanText,
          direction: direction || undefined,
          context: contextText || undefined, // Include action context
          isBookmarked: false,
          emotionHint: detectEmotion(cleanText, direction),
        };
        
        currentSceneLines.push(scriptLine);
      }
    }
    pendingCharacter = null;
    pendingDialogue = [];
    pendingContext = []; // Clear context after attaching to dialogue
  };
  
  // Check if a line is action/description (not dialogue, not character, not heading)
  // BE CONSERVATIVE - it's better to keep dialogue than accidentally filter it out
  const isActionLine = (trimmed: string): boolean => {
    // Skip if it's a scene heading, transition, or character name
    if (SCENE_HEADING_REGEX.test(trimmed)) return false;
    if (TRANSITION_REGEX.test(trimmed)) return false;
    if (SOUND_CUE_REGEX.test(trimmed)) return false;
    
    // Only consider as action if we're NOT in the middle of collecting dialogue
    // This is handled by the caller - here we just detect obvious action patterns
    
    // Third person pronouns + action verb (very reliable indicator of action)
    if (/^(He|She|They|It)\s+(is|are|was|were|looks?|walks?|runs?|turns?|enters?|exits?|stands?|sits?|moves?|picks?|grabs?|holds?|opens?|closes?|falls?|kisses?|hugs?)\b/i.test(trimmed)) {
      return true;
    }
    
    // "There is/are..." scene descriptions (very reliable)
    if (/^There\s+(is|are|was|were)\s+/i.test(trimmed)) {
      return true;
    }
    
    // Camera directions (very reliable)
    if (/^(CUT TO|FADE TO|DISSOLVE TO|ANGLE ON|CLOSE ON|WIDE ON|PAN TO|ZOOM|BACK TO|INTERCUT)/i.test(trimmed)) {
      return true;
    }
    
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Empty line - flush current dialogue
    if (!trimmed) {
      flushPendingDialogue();
      continue;
    }
    
    // Scene heading - start new scene
    if (SCENE_HEADING_REGEX.test(trimmed)) {
      foundFirstScene = true;
      flushPendingDialogue();
      
      if (currentSceneLines.length > 0) {
        scenes.push({
          id: generateId(),
          name: currentSceneName,
          description: currentSceneDescription || undefined,
          lines: [...currentSceneLines],
        });
        currentSceneLines = [];
      }
      sceneCount++;
      currentSceneName = trimmed.length > 60 ? trimmed.substring(0, 60) + "..." : trimmed;
      currentSceneDescription = "";
      collectingSceneDescription = true; // Start collecting scene description
      pendingContext = []; // Reset context for new scene
      continue;
    }
    
    // Skip title page / front matter until first scene heading
    if (!foundFirstScene) {
      continue;
    }
    
    // Transition - skip
    if (TRANSITION_REGEX.test(trimmed)) {
      collectingSceneDescription = false;
      continue;
    }
    
    // Pure stage direction on its own line - add to context
    if (/^\[.*\]$/.test(trimmed) || /^\(.*\)$/.test(trimmed)) {
      const cleaned = trimmed.replace(/^\[|\]$|^\(|\)$/g, '').trim();
      if (cleaned) {
        pendingContext.push(cleaned);
      }
      continue;
    }
    
    // Skip sound/music cue lines (e.g., "MUSIC: Jazz tune plays")
    if (SOUND_CUE_REGEX.test(trimmed)) {
      continue;
    }
    
    // Check if this is an action/description line
    if (isActionLine(trimmed)) {
      if (collectingSceneDescription && !currentSceneDescription) {
        // First action after scene heading becomes scene description
        currentSceneDescription = trimmed;
      } else {
        // Otherwise add to pending context for next dialogue
        pendingContext.push(trimmed);
      }
      collectingSceneDescription = false;
      continue;
    }
    
    // Stop collecting scene description once we hit dialogue
    collectingSceneDescription = false;
    
    // Check for inline character: dialogue format
    const characterCheck = isLikelyCharacterLine(trimmed);
    
    if (characterCheck.isCharacter) {
      flushPendingDialogue();
      pendingCharacter = characterCheck.name;
      pendingDialogue = [characterCheck.dialogue];
    } 
    // Check for standalone character name (professional screenplay format)
    else if (!pendingCharacter) {
      const standaloneCheck = isStandaloneCharacterName(trimmed);
      if (standaloneCheck.isCharacter) {
        flushPendingDialogue();
        pendingCharacter = standaloneCheck.name;
        pendingDialogue = [];
      }
    }
    // Check if this is dialogue continuation
    else if (pendingCharacter) {
      if (isDialogueContinuation(trimmed, line)) {
        pendingDialogue.push(trimmed);
      } else {
        // Could be a new standalone character or action line
        const standaloneCheck = isStandaloneCharacterName(trimmed);
        if (standaloneCheck.isCharacter) {
          flushPendingDialogue();
          pendingCharacter = standaloneCheck.name;
          pendingDialogue = [];
        } else {
          // Might be dialogue if we have an empty pending dialogue (character on prev line)
          if (pendingDialogue.length === 0) {
            pendingDialogue.push(trimmed);
          } else {
            flushPendingDialogue();
          }
        }
      }
    }
  }
  
  flushPendingDialogue();
  
  // Add final scene
  if (currentSceneLines.length > 0) {
    scenes.push({
      id: generateId(),
      name: currentSceneName,
      description: currentSceneDescription || undefined,
      lines: currentSceneLines,
    });
  }
  
  // Ensure at least one scene exists
  if (scenes.length === 0) {
    scenes.push({
      id: generateId(),
      name: "Scene 1",
      lines: [],
    });
  }

  return {
    roles: Array.from(roles.values()),
    scenes,
  };
}

export function normalizeScript(rawText: string): string {
  const lines = rawText.split(/\r?\n/);
  const normalized: string[] = [];
  
  let currentRole = "";
  let currentDialogue: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentRole && currentDialogue.length > 0) {
        normalized.push(`${currentRole}: ${currentDialogue.join(" ")}`);
        currentRole = "";
        currentDialogue = [];
      }
      continue;
    }
    
    const characterCheck = isLikelyCharacterLine(trimmed);
    if (characterCheck.isCharacter) {
      if (currentRole && currentDialogue.length > 0) {
        normalized.push(`${currentRole}: ${currentDialogue.join(" ")}`);
      }
      currentRole = characterCheck.name;
      currentDialogue = [characterCheck.dialogue];
    } else if (currentRole) {
      currentDialogue.push(trimmed);
    } else {
      // Check for standalone character name
      const standaloneCheck = isStandaloneCharacterName(trimmed);
      if (standaloneCheck.isCharacter) {
        if (currentRole && currentDialogue.length > 0) {
          normalized.push(`${currentRole}: ${currentDialogue.join(" ")}`);
        }
        currentRole = standaloneCheck.name;
        currentDialogue = [];
      } else {
        normalized.push(trimmed);
      }
    }
  }
  
  if (currentRole && currentDialogue.length > 0) {
    normalized.push(`${currentRole}: ${currentDialogue.join(" ")}`);
  }
  
  return normalized.join("\n");
}

export function extractDirections(text: string): { cleanText: string; directions: string[] } {
  return extractDirectionsFromDialogue(text);
}

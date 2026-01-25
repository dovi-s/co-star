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
  // Generic words that aren't names
  "THINGS", "STUFF", "SOMETHING", "NOTHING", "EVERYTHING", "ANYTHING",
  "PRIORITY", "IMPORTANT", "NOTE", "NOTES", "COMMENT", "COMMENTS",
  "SCENE", "SCENES", "ACT", "ACTS", "PART", "PARTS", "CHAPTER", "CHAPTERS",
  // Preposition phrases
  "IN THE", "ON THE", "AT THE", "TO THE", "FOR THE", "WITH THE",
]);

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
  // 3+ words is likely a phrase (real names are 1-2 words max, maybe 3 with title)
  /^\S+\s+\S+\s+\S+/,
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
    const lower = content.toLowerCase();
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
      "continuing", "interrupting", "overlapping", "cutting off",
      "reading", "quoting", "imitating", "mimicking",
      "re:", "regarding", "about", "pointing", "gesturing", "nodding",
      "shaking head", "looking", "turning", "moving", "walking",
      "sitting", "standing", "entering", "exiting", "crossing"
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

// Check if a line is likely dialogue continuation
function isDialogueContinuation(line: string, originalLine: string): boolean {
  const trimmed = line.trim();
  
  if (!trimmed) return false;
  
  // Parenthetical or bracketed direction
  if (trimmed.startsWith("(") || trimmed.startsWith("[")) return true;
  
  // Starts with lowercase (likely continuation)
  if (/^[a-z]/.test(trimmed)) return true;
  
  // Original line was indented (tabs or multiple spaces)
  if (/^[\t]|^[ ]{2,}/.test(originalLine)) return true;
  
  // Starts with ellipsis or dash (continuation)
  if (/^[…—–\-]/.test(trimmed)) return true;
  
  // Starts with quotation continuation
  if (/^['""']/.test(trimmed) && !/[:：]/.test(trimmed)) return true;
  
  // If line doesn't look like a new character name or scene heading, treat as continuation
  // This is more permissive for professional screenplay PDFs where indentation is lost
  if (!SCENE_HEADING_REGEX.test(trimmed) && 
      !TRANSITION_REGEX.test(trimmed) &&
      !/^[A-Z][A-Z\s\-'\.]+(?:\s*\([^)]*\))?\s*$/.test(trimmed) && // Not a standalone character name
      !trimmed.includes(":") && // No colon (not NAME: dialogue format)
      trimmed.length < 200) { // Reasonable line length
    return true;
  }
  
  return false;
}

export function parseScript(rawText: string): ParsedScript {
  const lines = rawText.split(/\r?\n/);
  
  const roles: Map<string, Role> = new Map();
  const scenes: Scene[] = [];
  
  let currentSceneLines: ScriptLine[] = [];
  let currentSceneName = "Scene 1";
  let sceneCount = 1;
  let lineNumber = 0;
  
  let pendingCharacter: string | null = null;
  let pendingDialogue: string[] = [];

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
        const scriptLine: ScriptLine = {
          id: generateId(),
          lineNumber: lineNumber++,
          roleId: role.id,
          roleName: pendingCharacter,
          text: cleanText,
          direction: direction || undefined,
          isBookmarked: false,
          emotionHint: detectEmotion(cleanText, direction),
        };
        
        currentSceneLines.push(scriptLine);
      }
    }
    pendingCharacter = null;
    pendingDialogue = [];
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
      flushPendingDialogue();
      
      if (currentSceneLines.length > 0) {
        scenes.push({
          id: generateId(),
          name: currentSceneName,
          lines: [...currentSceneLines],
        });
        currentSceneLines = [];
      }
      sceneCount++;
      currentSceneName = trimmed.length > 60 ? trimmed.substring(0, 60) + "..." : trimmed;
      continue;
    }
    
    // Transition - skip
    if (TRANSITION_REGEX.test(trimmed)) {
      continue;
    }
    
    // Pure stage direction on its own line - skip
    if (/^\[.*\]$/.test(trimmed) || /^\(.*\)$/.test(trimmed)) {
      continue;
    }
    
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

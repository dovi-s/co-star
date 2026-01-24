import type { ParsedScript, Role, Scene, ScriptLine } from "@shared/schema";
import { detectEmotion } from "./tts-engine";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

const DIRECTION_REGEX = /\[([^\]]+)\]/g;
const PARENTHETICAL_REGEX = /\(([^)]+)\)/g;
const SCENE_HEADING_REGEX = /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.|SCENE|ACT|FADE IN|FADE OUT|CUT TO|DISSOLVE TO)/i;

const CHARACTER_EXTENSIONS = [
  "V.O.", "VO", "V/O", "VOICE OVER", "VOICEOVER",
  "O.S.", "OS", "O/S", "OFF SCREEN", "OFFSCREEN", "OFF-SCREEN",
  "O.C.", "OC", "OFF CAMERA", "OFF-CAMERA",
  "CONT'D", "CONT", "CONTINUED", "CONTINUING",
  "PRE-LAP", "PRELAP",
  "FILTER", "ON PHONE", "ON TV", "ON RADIO",
  "SUBTITLE", "SUBTITLED", "TRANSLATED"
];

const EXTENSION_PATTERN = new RegExp(
  `\\s*\\((?:${CHARACTER_EXTENSIONS.join("|")})\\)\\s*`,
  "gi"
);

function normalizeCharacterName(name: string): string {
  let normalized = name.trim();
  
  normalized = normalized.replace(EXTENSION_PATTERN, "");
  normalized = normalized.replace(/\([^)]*\)\s*$/, "");
  normalized = normalized.replace(/^\d+[\.\)\-\s]+/, "");
  normalized = normalized.replace(/\s+/g, " ");
  normalized = normalized.trim();
  
  return normalized.toUpperCase();
}

function isLikelyCharacterLine(line: string): { isCharacter: boolean; name: string; dialogue: string } {
  const trimmed = line.trim();
  
  if (!trimmed || trimmed.length < 2) {
    return { isCharacter: false, name: "", dialogue: "" };
  }
  
  if (SCENE_HEADING_REGEX.test(trimmed)) {
    return { isCharacter: false, name: "", dialogue: "" };
  }
  
  if (/^\[.*\]$/.test(trimmed) || /^\(.*\)$/.test(trimmed)) {
    return { isCharacter: false, name: "", dialogue: "" };
  }
  
  const colonPatterns = [
    /^([A-Za-z][A-Za-z0-9\s\-'\.]+?)(?:\s*\([^)]*\))?\s*[:：]\s*(.+)$/,
    /^([A-Z][A-Z0-9\s\-'\.]+?)(?:\s*\([^)]*\))?\s*[:：]\s*(.+)$/,
    /^((?:DR|MR|MRS|MS|MISS|PROF|REV|SIR|LADY|LORD|CAPTAIN|COLONEL|GENERAL|SERGEANT|OFFICER|DETECTIVE|INSPECTOR|AGENT|NURSE|CHEF|WAITER|WAITRESS)\.?\s+[A-Za-z][A-Za-z\-'\.]+)(?:\s*\([^)]*\))?\s*[:：]\s*(.+)$/i,
    /^(\d+[\.\)]\s*[A-Za-z][A-Za-z0-9\s\-'\.]+?)(?:\s*\([^)]*\))?\s*[:：]\s*(.+)$/,
  ];
  
  for (const pattern of colonPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const potentialName = match[1].trim();
      const dialogue = match[2].trim();
      
      if (potentialName.length <= 40 && dialogue.length > 0) {
        const normalizedName = normalizeCharacterName(potentialName);
        if (normalizedName.length >= 1 && normalizedName.length <= 35) {
          return { isCharacter: true, name: normalizedName, dialogue };
        }
      }
    }
  }
  
  const dashPattern = /^([A-Z][A-Z\s\-'\.]+?)\s*[-–—]\s*(.+)$/;
  const dashMatch = trimmed.match(dashPattern);
  if (dashMatch) {
    const potentialName = dashMatch[1].trim();
    const dialogue = dashMatch[2].trim();
    
    if (potentialName.length <= 30 && dialogue.length > 0 && !dialogue.startsWith("-")) {
      const normalizedName = normalizeCharacterName(potentialName);
      if (normalizedName.length >= 2 && normalizedName.length <= 25) {
        return { isCharacter: true, name: normalizedName, dialogue };
      }
    }
  }
  
  return { isCharacter: false, name: "", dialogue: "" };
}

function extractDirectionsFromDialogue(text: string): { cleanText: string; directions: string[] } {
  const directions: string[] = [];
  
  let cleanText = text.replace(DIRECTION_REGEX, (_, dir) => {
    directions.push(dir.trim());
    return "";
  });
  
  cleanText = cleanText.replace(PARENTHETICAL_REGEX, (match, content) => {
    const lower = content.toLowerCase();
    const emotionKeywords = [
      "angry", "sad", "happy", "excited", "nervous", "scared", "whispering",
      "shouting", "crying", "laughing", "sarcastic", "quietly", "loudly",
      "hesitant", "confident", "desperate", "pleading", "threatening",
      "mockingly", "tenderly", "coldly", "warmly", "bitterly", "softly",
      "firmly", "gently", "harshly", "pause", "beat", "sighing", "trembling"
    ];
    
    if (emotionKeywords.some(kw => lower.includes(kw))) {
      directions.push(content.trim());
      return "";
    }
    
    return match;
  });
  
  cleanText = cleanText.replace(/\s+/g, " ").trim();
  
  return { cleanText, directions };
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
    
    if (!trimmed) {
      flushPendingDialogue();
      continue;
    }
    
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
    
    if (/^\[.*\]$/.test(trimmed) || /^\(.*\)$/.test(trimmed)) {
      continue;
    }
    
    const characterCheck = isLikelyCharacterLine(trimmed);
    
    if (characterCheck.isCharacter) {
      flushPendingDialogue();
      pendingCharacter = characterCheck.name;
      pendingDialogue = [characterCheck.dialogue];
    } else if (pendingCharacter) {
      if (trimmed.startsWith("(") || trimmed.startsWith("[")) {
        pendingDialogue.push(trimmed);
      } else if (/^[a-z]/.test(trimmed) || line.startsWith("  ") || line.startsWith("\t")) {
        pendingDialogue.push(trimmed);
      } else {
        flushPendingDialogue();
      }
    }
  }
  
  flushPendingDialogue();
  
  if (currentSceneLines.length > 0) {
    scenes.push({
      id: generateId(),
      name: currentSceneName,
      lines: currentSceneLines,
    });
  }
  
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
      normalized.push(trimmed);
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

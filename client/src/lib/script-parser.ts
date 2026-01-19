import type { ParsedScript, Role, Scene, ScriptLine } from "@shared/schema";
import { detectEmotion } from "./tts-engine";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

const ROLE_LINE_REGEX = /^([A-Z][A-Z0-9\s\-'\.]{0,30})\s*[:：]\s*(.+)$/;
const DIRECTION_REGEX = /\[([^\]]+)\]/g;
const SCENE_HEADING_REGEX = /^(INT\.|EXT\.|SCENE|ACT)\s+/i;

export function parseScript(rawText: string): ParsedScript {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  
  const roles: Map<string, Role> = new Map();
  const scriptLines: ScriptLine[] = [];
  const scenes: Scene[] = [];
  
  let currentSceneLines: ScriptLine[] = [];
  let currentSceneName = "Scene 1";
  let sceneCount = 1;
  let lineNumber = 0;

  for (const line of lines) {
    if (SCENE_HEADING_REGEX.test(line)) {
      if (currentSceneLines.length > 0) {
        scenes.push({
          id: generateId(),
          name: currentSceneName,
          lines: [...currentSceneLines],
        });
        currentSceneLines = [];
      }
      sceneCount++;
      currentSceneName = line.length > 50 ? line.substring(0, 50) + "..." : line;
      continue;
    }

    const match = line.match(ROLE_LINE_REGEX);
    if (match) {
      const roleName = match[1].trim();
      let dialogueText = match[2].trim();
      
      const directions: string[] = [];
      dialogueText = dialogueText.replace(DIRECTION_REGEX, (_, dir) => {
        directions.push(dir);
        return "";
      }).trim();
      
      if (!dialogueText) continue;

      if (!roles.has(roleName)) {
        roles.set(roleName, {
          id: generateId(),
          name: roleName,
          voicePreset: "natural",
          isUserRole: false,
          lineCount: 0,
        });
      }
      
      const role = roles.get(roleName)!;
      role.lineCount++;

      const direction = directions.join("; ");
      const scriptLine: ScriptLine = {
        id: generateId(),
        lineNumber: lineNumber++,
        roleId: role.id,
        roleName: roleName,
        text: dialogueText,
        direction: direction || undefined,
        isBookmarked: false,
        emotionHint: detectEmotion(dialogueText, direction),
      };
      
      currentSceneLines.push(scriptLine);
    } else if (line.startsWith("[") && line.endsWith("]")) {
      continue;
    } else if (line.length > 5 && currentSceneLines.length === 0 && lines.indexOf(line) < 5) {
      currentSceneName = line.length > 50 ? line.substring(0, 50) + "..." : line;
    }
  }

  if (currentSceneLines.length > 0) {
    scenes.push({
      id: generateId(),
      name: currentSceneName || `Scene ${sceneCount}`,
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
    
    const match = trimmed.match(ROLE_LINE_REGEX);
    if (match) {
      if (currentRole && currentDialogue.length > 0) {
        normalized.push(`${currentRole}: ${currentDialogue.join(" ")}`);
      }
      currentRole = match[1].trim();
      currentDialogue = [match[2].trim()];
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
  const directions: string[] = [];
  const cleanText = text.replace(DIRECTION_REGEX, (_, dir) => {
    directions.push(dir);
    return "";
  }).trim();
  
  return { cleanText, directions };
}

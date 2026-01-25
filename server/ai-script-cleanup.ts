import OpenAI from "openai";
import type { ParsedScript, ScriptLine } from "@shared/schema";

interface CleanupResult {
  cleanedScript: ParsedScript;
  removedCount: number;
  removedLines: string[];
}

function isAIConfigured(): boolean {
  return !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL);
}

export async function aiCleanupScript(script: ParsedScript): Promise<CleanupResult> {
  const noOpResult = { cleanedScript: script, removedCount: 0, removedLines: [] };
  
  if (!isAIConfigured()) {
    console.log("[AI Cleanup] AI not configured, skipping cleanup");
    return noOpResult;
  }

  if (script.scenes.length === 0) {
    return noOpResult;
  }

  const allLines: { sceneIndex: number; lineIndex: number; line: ScriptLine }[] = [];
  
  for (let sceneIndex = 0; sceneIndex < script.scenes.length; sceneIndex++) {
    const scene = script.scenes[sceneIndex];
    for (let lineIndex = 0; lineIndex < scene.lines.length; lineIndex++) {
      allLines.push({ sceneIndex, lineIndex, line: scene.lines[lineIndex] });
    }
  }

  if (allLines.length === 0) {
    return noOpResult;
  }

  const samplesToCheck = allLines.slice(0, 80);
  
  const linesForAI = samplesToCheck.map((item, idx) => ({
    index: idx,
    character: item.line.roleName,
    dialogue: item.line.text.substring(0, 200),
  }));

  const prompt = `You are a script parsing validator. Analyze these parsed "dialogue" lines from a script and identify which ones are NOT actual spoken dialogue.

REMOVE these types of content (they are NOT dialogue):
- Title page content (movie/play titles, "by [author name]", dates, draft info)
- Writer/author credits ("by Will Ferrell", "Written by John Smith")
- Cast lists or actor names ("Will Ferrell John C Reilly", "Starring...")
- Production notes, copyright notices, revision markers
- Stage directions or action descriptions written as prose
- Scene headings or location descriptions
- Crew credits, production company names
- ANY text that a character would not actually SPEAK aloud in the scene

KEEP these (they ARE dialogue):
- Actual spoken lines characters say to each other
- Questions, statements, exclamations characters speak
- Monologues or soliloquies
- Song lyrics if sung by a character
- Phone conversations

Here are the lines to analyze:
${JSON.stringify(linesForAI, null, 2)}

Return a JSON object with this exact structure:
{
  "removeIndices": [array of index numbers to remove],
  "reasoning": "brief explanation of what was found and removed"
}

Only include indices of lines that are clearly NOT spoken dialogue. When in doubt, keep the line.`;

  try {
    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a precise script analysis tool. Return only valid JSON, no markdown."
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1000,
    }, { signal: controller.signal });

    clearTimeout(timeoutId);

    const content = response.choices[0]?.message?.content || "{}";
    let result: { removeIndices?: number[]; reasoning?: string };
    
    try {
      result = JSON.parse(content);
    } catch {
      console.log("AI cleanup: Failed to parse response, keeping all lines");
      return { cleanedScript: script, removedCount: 0, removedLines: [] };
    }

    const rawIndices = result.removeIndices || [];
    const validIndices = rawIndices.filter(idx => 
      typeof idx === 'number' && idx >= 0 && idx < samplesToCheck.length
    );
    const indicesToRemove = new Set(validIndices);
    const removedLines: string[] = [];

    if (indicesToRemove.size === 0) {
      return noOpResult;
    }

    const linesToRemove = new Set<string>();
    
    for (let idx = 0; idx < samplesToCheck.length; idx++) {
      if (indicesToRemove.has(idx)) {
        const item = samplesToCheck[idx];
        linesToRemove.add(item.line.id);
        removedLines.push(`${item.line.roleName}: ${item.line.text.substring(0, 50)}...`);
      }
    }

    const cleanedScenes = script.scenes.map(scene => ({
      ...scene,
      lines: scene.lines.filter(line => !linesToRemove.has(line.id))
    })).filter(scene => scene.lines.length > 0);

    const remainingRoleIds = new Set<string>();
    for (const scene of cleanedScenes) {
      for (const line of scene.lines) {
        remainingRoleIds.add(line.roleId);
      }
    }

    const cleanedRoles = script.roles
      .filter(role => remainingRoleIds.has(role.id))
      .map(role => {
        let count = 0;
        for (const scene of cleanedScenes) {
          for (const line of scene.lines) {
            if (line.roleId === role.id) count++;
          }
        }
        return { ...role, lineCount: count };
      });

    const cleanedScript: ParsedScript = {
      ...script,
      scenes: cleanedScenes,
      roles: cleanedRoles,
    };

    console.log(`AI cleanup: Removed ${linesToRemove.size} lines. ${result.reasoning || ""}`);

    return {
      cleanedScript,
      removedCount: linesToRemove.size,
      removedLines,
    };

  } catch (error) {
    console.error("AI cleanup failed, returning original script:", error);
    return { cleanedScript: script, removedCount: 0, removedLines: [] };
  }
}

export async function smartParseAndClean(rawText: string, parseScript: (text: string) => ParsedScript): Promise<ParsedScript> {
  const parsed = parseScript(rawText);
  
  if (parsed.scenes.length === 0) {
    return parsed;
  }

  const { cleanedScript } = await aiCleanupScript(parsed);
  return cleanedScript;
}

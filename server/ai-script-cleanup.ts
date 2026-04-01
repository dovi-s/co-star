import type { ParsedScript, ScriptLine } from "@shared/schema";
import { createOpenAIClient, isOpenAIConfigured } from "./openaiClient";

interface CleanupResult {
  cleanedScript: ParsedScript;
  removedCount: number;
  removedLines: string[];
}

export async function aiCleanupScript(script: ParsedScript): Promise<CleanupResult> {
  const noOpResult = { cleanedScript: script, removedCount: 0, removedLines: [] };
  
  if (!isOpenAIConfigured()) {
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

  const prompt = `You are a script parsing validator. Analyze these parsed "dialogue" lines from a script and identify which ones are CLEARLY NOT actual spoken dialogue.

BE VERY CONSERVATIVE - ONLY REMOVE lines that are CLEARLY NOT dialogue:
- Title page content ONLY (literal titles like "STOP KISS" or "A Play by...")
- Writer credits ONLY if they say "by [author name]" or "Written by"
- Copyright notices, draft info, revision dates

DO NOT REMOVE (these ARE valid dialogue or should be kept):
- ANY line where a character is speaking, even if fragmented or unclear
- Phone conversations ("Hi George...", "Yeah I know...")
- Lines that START with dialogue even if they have stage directions mixed in
- Casual speech, questions, exclamations, interjections
- Lines with character names like CALLIE, SARA, GEORGE, etc.
- Stage play format lines (CHARACTER. dialogue) - these are valid
- ANY line that could reasonably be spoken by a character

IMPORTANT: Be extremely conservative. When in doubt, KEEP the line. 
It is MUCH better to keep a non-dialogue line than to remove actual dialogue.
Only remove lines you are 100% certain are title page content or credits.

IMPORTANT: These are VALID character names based on occupations/roles - do NOT remove their lines:
SPY, HANDLER, AGENT, OPERATIVE, ASSASSIN, DETECTIVE, SUSPECT, OFFICER, CAPTAIN, SERGEANT, LIEUTENANT, COMMANDER, GENERAL, SOLDIER, GUARD, NURSE, DOCTOR, PROFESSOR, TEACHER, STUDENT, WAITER, WAITRESS, BARTENDER, DRIVER, PILOT, JUDGE, LAWYER, WITNESS, CLERK, MAYOR, SENATOR, PRESIDENT, KING, QUEEN, PRINCE, PRINCESS, DUKE, LORD, LADY, BUTLER, MAID, CHEF, PORTER, JANITOR, REPORTER, ANCHOR, HOST, GUEST, CALLER, VICTIM, THIEF, BURGLAR, KILLER, STRANGER, VISITOR, TRAVELER, MESSENGER, NARRATOR, VOICE

Here are the lines to analyze:
${JSON.stringify(linesForAI, null, 2)}

Return a JSON object with this exact structure:
{
  "removeIndices": [array of index numbers to remove],
  "reasoning": "brief explanation of what was found and removed"
}

Only include indices of lines that are clearly NOT spoken dialogue. When in doubt, keep the line.`;

  try {
    const openai = createOpenAIClient();

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

// AI-powered role filtering - identifies non-character names in the roles list
export async function aiFilterRoles(script: ParsedScript): Promise<ParsedScript> {
  if (!isOpenAIConfigured()) {
    console.log("[AI Role Filter] AI not configured, skipping");
    return script;
  }

  if (script.roles.length === 0) {
    return script;
  }

  // Create a list of role names for AI to review
  const rolesForAI = script.roles.map((role, idx) => ({
    index: idx,
    name: role.name,
    lineCount: role.lineCount,
  }));

  const prompt = `You are a screenplay expert. Review this list of detected "character names" from a script parser. Identify which ones are NOT actual character names.

REMOVE these (NOT real characters):
- Camera/editing directions: CLOSEUP, POV, INSERT, INTERCUT, ANGLE ON, FADE, etc.
- Time markers: LATER, MOMENTS LATER, FIVE MINUTES LATER, etc.
- Scene descriptions: THEIR HOUSE, THE BEDROOM, OUTSIDE, etc.
- Props/objects: MOTORCYCLES, PHONE, DOOR, CAR, TV, etc.
- Body parts: RIGHT HAND, LEFT ARM, etc.
- Sound/music cues: MUSIC CUE, SOUND, SILENCE, etc.
- Production terms: END INTERCUT, CONTINUED, FLASHBACK, MONTAGE, etc.
- Any word/phrase that is clearly NOT a person who speaks dialogue

KEEP these (real characters - DO NOT REMOVE):
- Actual character names: JOHN, MARY, DETECTIVE SMITH, MOM, DAD, etc.
- Role descriptions (KEEP THESE): DETECTIVE, SUSPECT, OFFICER, DOCTOR, BARTENDER, WAITER, STRANGER, WITNESS, VICTIM, KILLER, THIEF, LAWYER, JUDGE, GUARD, NURSE, DRIVER, PILOT, etc.
- Generic role labels: MAN, WOMAN, BOY, GIRL, MAN #1, WOMAN #2, etc.
- Named characters with titles: DR. JONES, CAPTAIN MILLER, OFFICER CHEN, etc.
- Occupation-based names: These are ALWAYS real speaking roles, even without a proper name
- VOICEOVER and VOICE characters: [NAME]'S VOICE, VOICE ON PHONE, VOICE ON MACHINE, VOICE OVER, V.O., O.S., etc. - these ARE speaking characters
- Offscreen/answering machine voices: GEORGE'S VOICE ON MACHINE, MOM'S VOICE, OPERATOR'S VOICE, etc. - these ARE characters with dialogue

Here are the detected "characters" to review:
${JSON.stringify(rolesForAI, null, 2)}

Return a JSON object:
{
  "removeIndices": [array of index numbers to remove - these are NOT characters],
  "reasoning": "brief explanation"
}

Remove only clear non-characters (camera directions, locations, objects, time markers). When in doubt, KEEP the role - occupation words like DETECTIVE, SUSPECT, OFFICER, NURSE, DOCTOR are almost always real speaking characters.`;

  try {
    const openai = createOpenAIClient();

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    let result: { removeIndices?: number[]; reasoning?: string };
    
    try {
      result = JSON.parse(content);
    } catch {
      console.log("[AI Role Filter] Failed to parse response, keeping all roles");
      return script;
    }

    const rawIndices = result.removeIndices || [];
    const validIndices = rawIndices.filter(idx => 
      typeof idx === 'number' && idx >= 0 && idx < script.roles.length
    );
    
    if (validIndices.length === 0) {
      return script;
    }

    const indicesToRemove = new Set(validIndices);
    const roleIdsToRemove = new Set<string>();
    const removedNames: string[] = [];
    
    for (let idx = 0; idx < script.roles.length; idx++) {
      if (indicesToRemove.has(idx)) {
        roleIdsToRemove.add(script.roles[idx].id);
        removedNames.push(script.roles[idx].name);
      }
    }

    // Filter roles
    const cleanedRoles = script.roles.filter(role => !roleIdsToRemove.has(role.id));
    
    // Filter lines that belong to removed roles
    const cleanedScenes = script.scenes.map(scene => ({
      ...scene,
      lines: scene.lines.filter(line => !roleIdsToRemove.has(line.roleId))
    })).filter(scene => scene.lines.length > 0);

    console.log(`[AI Role Filter] Removed ${removedNames.length} non-character entries: ${removedNames.join(', ')}. ${result.reasoning || ""}`);

    return {
      ...script,
      scenes: cleanedScenes,
      roles: cleanedRoles,
    };

  } catch (error) {
    console.error("[AI Role Filter] Failed, returning original script:", error);
    return script;
  }
}

interface VerificationFix {
  type: 'remove_line' | 'fix_attribution' | 'fix_text' | 'add_missing';
  lineId?: string;
  sceneIndex?: number;
  lineIndex?: number;
  correctRole?: string;
  correctText?: string;
  newLine?: { roleName: string; text: string; insertAfterLineId?: string };
  reason: string;
}

interface VerificationResult {
  script: ParsedScript;
  fixCount: number;
  fixes: string[];
}

export async function aiVerifyParsedScript(
  originalText: string,
  script: ParsedScript
): Promise<VerificationResult> {
  const noOpResult = { script, fixCount: 0, fixes: [] };

  if (!isOpenAIConfigured()) {
    return noOpResult;
  }

  const allLines: { sceneIndex: number; lineIndex: number; line: ScriptLine }[] = [];
  for (let si = 0; si < script.scenes.length; si++) {
    for (let li = 0; li < script.scenes[si].lines.length; li++) {
      allLines.push({ sceneIndex: si, lineIndex: li, line: script.scenes[si].lines[li] });
    }
  }

  if (allLines.length === 0) return noOpResult;

  const CHUNK_SIZE = 120;
  const chunks: typeof allLines[] = [];
  for (let i = 0; i < allLines.length; i += CHUNK_SIZE) {
    chunks.push(allLines.slice(i, i + CHUNK_SIZE));
  }

  const openai = createOpenAIClient();

  const allFixes: VerificationFix[] = [];
  const fixDescriptions: string[] = [];

  const processChunk = async (chunk: typeof allLines, chunkIdx: number): Promise<VerificationFix[]> => {
    const linesForReview = chunk.map((item, idx) => ({
      idx,
      id: item.line.id,
      character: item.line.roleName,
      text: item.line.text.substring(0, 300),
      sceneIndex: item.sceneIndex,
      lineIndex: item.lineIndex,
    }));

    const chunkStart = chunkIdx * CHUNK_SIZE;
    const relevantOrigStart = Math.max(0, Math.floor((chunkStart / allLines.length) * originalText.length) - 500);
    const relevantOrigEnd = Math.min(originalText.length, Math.ceil(((chunkStart + chunk.length) / allLines.length) * originalText.length) + 500);
    const relevantOriginal = originalText.substring(relevantOrigStart, Math.min(relevantOrigEnd, relevantOrigStart + 6000));

    const prompt = `You are a professional script editor verifying parsed screenplay dialogue. Compare the parsed lines against the original screenplay text and find errors.

ORIGINAL SCREENPLAY TEXT (relevant section):
---
${relevantOriginal}
---

PARSED DIALOGUE LINES TO VERIFY:
${JSON.stringify(linesForReview, null, 2)}

Find and report these specific errors:

1. STAGE DIRECTIONS AS DIALOGUE: Lines that are clearly stage directions, action descriptions, camera directions, or scene descriptions — NOT spoken words. Examples:
   - "dressed in underwear and hats" (action description)
   - "emerge carrying trays of champagne" (action description)  
   - "Script provided for educational purposes" (copyright notice)
   - Sound/music cues that aren't dialogue

2. WRONG CHARACTER ATTRIBUTION: Dialogue assigned to the wrong character. Cross-reference with the original text to verify who actually speaks each line.

3. MERGED/GARBLED TEXT: Lines where two separate pieces got incorrectly merged, or text is garbled/corrupted.

BE CONSERVATIVE:
- Only flag lines you are CERTAIN are wrong based on the original text
- If you can't verify from the provided original text section, do NOT flag it
- Fragmented dialogue is normal in scripts (line breaks mid-sentence) — don't flag these
- Voiceover (V.O.) and offscreen (O.S.) lines ARE valid dialogue

Return a JSON object:
{
  "fixes": [
    {
      "type": "remove_line",
      "idx": <number from the parsed lines>,
      "reason": "brief explanation"
    },
    {
      "type": "fix_attribution",
      "idx": <number>,
      "correctRole": "CORRECT CHARACTER NAME",
      "reason": "brief explanation"  
    },
    {
      "type": "fix_text",
      "idx": <number>,
      "correctText": "corrected dialogue text",
      "reason": "brief explanation"
    }
  ]
}

Return {"fixes": []} if all lines check out correctly. Only report issues you are CERTAIN about.`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a precise script verification tool. Return only valid JSON, no markdown." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_completion_tokens: 2000,
      }, { signal: controller.signal });

      clearTimeout(timeoutId);

      const content = response.choices[0]?.message?.content || "{}";
      let result: { fixes?: Array<{ type: string; idx: number; correctRole?: string; correctText?: string; reason: string }> };

      try {
        result = JSON.parse(content);
      } catch {
        return [];
      }

      if (!result.fixes || !Array.isArray(result.fixes)) return [];

      return result.fixes
        .filter(fix => typeof fix.idx === 'number' && fix.idx >= 0 && fix.idx < chunk.length)
        .map(fix => {
          const item = chunk[fix.idx];
          return {
            type: fix.type as VerificationFix['type'],
            lineId: item.line.id,
            sceneIndex: item.sceneIndex,
            lineIndex: item.lineIndex,
            correctRole: fix.correctRole,
            correctText: fix.correctText,
            reason: fix.reason,
          };
        });
    } catch (error) {
      return [];
    }
  };

  const MAX_PARALLEL = 3;
  for (let i = 0; i < chunks.length; i += MAX_PARALLEL) {
    const batch = chunks.slice(i, i + MAX_PARALLEL);
    const results = await Promise.all(batch.map((chunk, batchIdx) => processChunk(chunk, i + batchIdx)));
    for (const fixes of results) {
      allFixes.push(...fixes);
    }
  }

  if (allFixes.length === 0) return noOpResult;

  const lineIdsToRemove = new Set<string>();
  const attributionFixes = new Map<string, string>();
  const textFixes = new Map<string, string>();

  for (const fix of allFixes) {
    if (fix.type === 'remove_line' && fix.lineId) {
      lineIdsToRemove.add(fix.lineId);
      fixDescriptions.push(`Removed: "${fix.reason}"`);
    } else if (fix.type === 'fix_attribution' && fix.lineId && fix.correctRole) {
      attributionFixes.set(fix.lineId, fix.correctRole);
      fixDescriptions.push(`Re-attributed to ${fix.correctRole}: "${fix.reason}"`);
    } else if (fix.type === 'fix_text' && fix.lineId && fix.correctText) {
      textFixes.set(fix.lineId, fix.correctText);
      fixDescriptions.push(`Fixed text: "${fix.reason}"`);
    }
  }

  const existingRoleMap = new Map<string, { id: string; name: string }>();
  for (const role of script.roles) {
    existingRoleMap.set(role.name.toUpperCase(), { id: role.id, name: role.name });
  }

  const newRoles: Array<{ id: string; name: string }> = [];

  const verifiedScenes = script.scenes.map(scene => ({
    ...scene,
    lines: scene.lines
      .filter(line => !lineIdsToRemove.has(line.id))
      .map(line => {
        let updatedLine = { ...line };

        if (attributionFixes.has(line.id)) {
          const newRoleName = attributionFixes.get(line.id)!;
          const existingRole = existingRoleMap.get(newRoleName.toUpperCase());
          if (existingRole) {
            updatedLine = { ...updatedLine, roleName: existingRole.name, roleId: existingRole.id };
          } else {
            const newId = Math.random().toString(36).substring(2, 11);
            newRoles.push({ id: newId, name: newRoleName });
            existingRoleMap.set(newRoleName.toUpperCase(), { id: newId, name: newRoleName });
            updatedLine = { ...updatedLine, roleName: newRoleName, roleId: newId };
          }
        }

        if (textFixes.has(line.id)) {
          updatedLine = { ...updatedLine, text: textFixes.get(line.id)! };
        }

        return updatedLine;
      }),
  })).filter(scene => scene.lines.length > 0);

  const remainingRoleIds = new Set<string>();
  for (const scene of verifiedScenes) {
    for (const line of scene.lines) {
      remainingRoleIds.add(line.roleId);
    }
  }

  const verifiedRoles = [
    ...script.roles
      .filter(role => remainingRoleIds.has(role.id))
      .map(role => {
        let count = 0;
        for (const scene of verifiedScenes) {
          for (const line of scene.lines) {
            if (line.roleId === role.id) count++;
          }
        }
        return { ...role, lineCount: count };
      }),
    ...newRoles
      .filter(nr => remainingRoleIds.has(nr.id))
      .map(nr => {
        let count = 0;
        for (const scene of verifiedScenes) {
          for (const line of scene.lines) {
            if (line.roleId === nr.id) count++;
          }
        }
        return { id: nr.id, name: nr.name, voicePreset: 'natural' as const, isUserRole: false, lineCount: count };
      }),
  ];

  const verifiedScript: ParsedScript = {
    ...script,
    scenes: verifiedScenes,
    roles: verifiedRoles,
  };

  return {
    script: verifiedScript,
    fixCount: allFixes.length,
    fixes: fixDescriptions,
  };
}

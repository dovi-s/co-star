import { useState, useCallback, useEffect } from "react";
import type { Session, Role, Scene, ScriptLine, UpdateSession, BookmarkUpdate, RoleUpdate, MemorizationMode } from "@shared/schema";
import { parseScript } from "@/lib/script-parser";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

const STORAGE_KEY = "castmate-session";
const MAX_STORAGE_SIZE = 200000; // Keep under 225KB limit with safety margin

// Compress session for storage by removing empty/default values
function compressSessionForStorage(session: Session): any {
  return {
    ...session,
    scenes: session.scenes.map(scene => ({
      ...scene,
      lines: scene.lines.map(line => {
        // Only include non-empty optional fields
        const compressedLine: any = {
          id: line.id,
          ln: line.lineNumber,
          rId: line.roleId,
          rN: line.roleName,
          t: line.text,
        };
        if (line.isBookmarked) compressedLine.b = true;
        if (line.context) compressedLine.c = line.context;
        if (line.direction) compressedLine.d = line.direction;
        if (line.emotionHint && line.emotionHint !== "neutral") compressedLine.e = line.emotionHint;
        return compressedLine;
      })
    }))
  };
}

// Decompress session from storage by restoring default values
function decompressSessionFromStorage(stored: any): Session {
  return {
    ...stored,
    scenes: stored.scenes.map((scene: any) => ({
      ...scene,
      lines: scene.lines.map((line: any) => ({
        id: line.id,
        lineNumber: line.ln ?? line.lineNumber ?? 0,
        roleId: line.rId ?? line.roleId,
        roleName: line.rN ?? line.roleName,
        text: line.t ?? line.text,
        isBookmarked: line.b ?? line.isBookmarked ?? false,
        context: line.c ?? line.context ?? undefined,
        direction: line.d ?? line.direction ?? undefined,
        emotionHint: line.e ?? line.emotionHint ?? "neutral",
      }))
    }))
  };
}

export function useSession() {
  // Use sessionStorage so closing the app starts fresh, but refreshing keeps your place
  const [session, setSession] = useState<Session | null>(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          return decompressSessionFromStorage(JSON.parse(stored));
        } catch {
          return null;
        }
      }
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      try {
        const compressed = compressSessionForStorage(session);
        const jsonStr = JSON.stringify(compressed);
        
        if (jsonStr.length > MAX_STORAGE_SIZE) {
          console.warn(`[Storage] Session size ${jsonStr.length} exceeds limit. Keeping in memory only.`);
          // Session is too large - keep it in memory but don't persist
          // User will lose progress on refresh, but at least it works
        } else {
          sessionStorage.setItem(STORAGE_KEY, jsonStr);
        }
      } catch (e) {
        console.error('[Storage] Failed to save session:', e);
      }
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [session]);

  const createSession = useCallback((name: string, rawScript: string) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[Parser] Input length:', rawScript.length, 'chars');
      console.log('[Parser] First 500 chars:', rawScript.substring(0, 500));
      console.log('[Parser] Last 500 chars:', rawScript.substring(rawScript.length - 500));
      
      const parsed = parseScript(rawScript);
      
      console.log('[Parser] Result:', {
        roles: parsed.roles.map(r => `${r.name}(${r.lineCount})`),
        scenes: parsed.scenes.length,
        totalLines: parsed.scenes.reduce((s, sc) => s + sc.lines.length, 0)
      });
      
      if (parsed.roles.length === 0) {
        setError("No roles detected. Make sure your script uses 'CHARACTER: dialogue' format.");
        setIsLoading(false);
        return null;
      }

      const now = new Date().toISOString();
      const newSession: Session = {
        id: generateId(),
        name,
        roles: parsed.roles,
        scenes: parsed.scenes,
        userRoleId: null,
        currentLineIndex: 0,
        currentSceneIndex: 0,
        isPlaying: false,
        ambientEnabled: false,
        memorizationMode: "off",
        runsCompleted: 0,
        linesRehearsed: 0,
        createdAt: now,
        updatedAt: now,
      };

      setSession(newSession);
      setIsLoading(false);
      return newSession;
    } catch (e) {
      setError("Failed to parse script. Please check the format.");
      setIsLoading(false);
      return null;
    }
  }, []);

  // Create session from pre-parsed data (from server-side parsing)
  const createSessionFromParsed = useCallback((name: string, parsed: { roles: Role[], scenes: Scene[] }) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[Session] Creating from server-parsed data:', {
        roles: parsed.roles.map(r => `${r.name}(${r.lineCount})`),
        scenes: parsed.scenes.length,
        totalLines: parsed.scenes.reduce((s, sc) => s + sc.lines.length, 0)
      });
      
      if (parsed.roles.length === 0) {
        setError("No roles detected. Make sure your script uses 'CHARACTER: dialogue' format.");
        setIsLoading(false);
        return null;
      }

      const now = new Date().toISOString();
      const newSession: Session = {
        id: generateId(),
        name,
        roles: parsed.roles,
        scenes: parsed.scenes,
        userRoleId: null,
        currentLineIndex: 0,
        currentSceneIndex: 0,
        isPlaying: false,
        ambientEnabled: false,
        memorizationMode: "off",
        runsCompleted: 0,
        linesRehearsed: 0,
        createdAt: now,
        updatedAt: now,
      };

      setSession(newSession);
      setIsLoading(false);
      return newSession;
    } catch (e) {
      setError("Failed to create session from parsed data.");
      setIsLoading(false);
      return null;
    }
  }, []);

  const updateSession = useCallback((updates: UpdateSession) => {
    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const setUserRole = useCallback((roleId: string) => {
    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        roles: prev.roles.map(r => ({
          ...r,
          isUserRole: r.id === roleId,
        })),
        userRoleId: roleId,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const updateRolePreset = useCallback((update: RoleUpdate) => {
    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        roles: prev.roles.map(r =>
          r.id === update.roleId
            ? { ...r, voicePreset: update.voicePreset }
            : r
        ),
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const toggleBookmark = useCallback((lineId: string) => {
    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        scenes: prev.scenes.map(scene => ({
          ...scene,
          lines: scene.lines.map(line =>
            line.id === lineId
              ? { ...line, isBookmarked: !line.isBookmarked }
              : line
          ),
        })),
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const goToLine = useCallback((lineIndex: number) => {
    setSession(prev => {
      if (!prev) return null;
      const scene = prev.scenes[prev.currentSceneIndex];
      if (!scene) return prev;
      
      const clampedIndex = Math.max(0, Math.min(lineIndex, scene.lines.length - 1));
      return {
        ...prev,
        currentLineIndex: clampedIndex,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const goToScene = useCallback((sceneIndex: number) => {
    setSession(prev => {
      if (!prev) return null;
      const clampedIndex = Math.max(0, Math.min(sceneIndex, prev.scenes.length - 1));
      return {
        ...prev,
        currentSceneIndex: clampedIndex,
        currentLineIndex: 0,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const nextLine = useCallback(() => {
    setSession(prev => {
      if (!prev) return null;
      const scene = prev.scenes[prev.currentSceneIndex];
      if (!scene) return prev;
      
      if (prev.currentLineIndex < scene.lines.length - 1) {
        return {
          ...prev,
          currentLineIndex: prev.currentLineIndex + 1,
          updatedAt: new Date().toISOString(),
        };
      } else if (prev.currentSceneIndex < prev.scenes.length - 1) {
        return {
          ...prev,
          currentSceneIndex: prev.currentSceneIndex + 1,
          currentLineIndex: 0,
          updatedAt: new Date().toISOString(),
        };
      }
      return prev;
    });
  }, []);

  const prevLine = useCallback(() => {
    setSession(prev => {
      if (!prev) return null;
      
      if (prev.currentLineIndex > 0) {
        return {
          ...prev,
          currentLineIndex: prev.currentLineIndex - 1,
          updatedAt: new Date().toISOString(),
        };
      } else if (prev.currentSceneIndex > 0) {
        const prevScene = prev.scenes[prev.currentSceneIndex - 1];
        return {
          ...prev,
          currentSceneIndex: prev.currentSceneIndex - 1,
          currentLineIndex: prevScene.lines.length - 1,
          updatedAt: new Date().toISOString(),
        };
      }
      return prev;
    });
  }, []);

  const setPlaying = useCallback((isPlaying: boolean) => {
    updateSession({ isPlaying });
  }, [updateSession]);

  const setAmbient = useCallback((ambientEnabled: boolean) => {
    updateSession({ ambientEnabled });
  }, [updateSession]);

  const setMemorizationMode = useCallback((memorizationMode: MemorizationMode) => {
    updateSession({ memorizationMode });
  }, [updateSession]);

  const incrementLinesRehearsed = useCallback(() => {
    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        linesRehearsed: prev.linesRehearsed + 1,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const incrementRunsCompleted = useCallback(() => {
    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        runsCompleted: prev.runsCompleted + 1,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const clearSession = useCallback(() => {
    setSession(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const clearUserRole = useCallback(() => {
    setSession(prev => {
      if (!prev) return null;
      const updated = {
        ...prev,
        userRoleId: null,
        roles: prev.roles.map(r => ({ ...r, isUserRole: false })),
        updatedAt: new Date().toISOString(),
      };
      // Update sessionStorage synchronously to prevent race condition on navigation
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const getCurrentLine = useCallback((): ScriptLine | null => {
    if (!session) return null;
    const scene = session.scenes[session.currentSceneIndex];
    if (!scene) return null;
    return scene.lines[session.currentLineIndex] ?? null;
  }, [session]);

  const getPreviousLine = useCallback((): ScriptLine | null => {
    if (!session) return null;
    const scene = session.scenes[session.currentSceneIndex];
    if (!scene || session.currentLineIndex === 0) return null;
    return scene.lines[session.currentLineIndex - 1] ?? null;
  }, [session]);

  const getNextLine = useCallback((): ScriptLine | null => {
    if (!session) return null;
    const scene = session.scenes[session.currentSceneIndex];
    if (!scene) return null;
    return scene.lines[session.currentLineIndex + 1] ?? null;
  }, [session]);

  const getTotalLines = useCallback((): number => {
    if (!session) return 0;
    const scene = session.scenes[session.currentSceneIndex];
    return scene?.lines.length ?? 0;
  }, [session]);

  // Get total lines across ALL scenes
  const getTotalScriptLines = useCallback((): number => {
    if (!session) return 0;
    return session.scenes.reduce((sum, scene) => sum + scene.lines.length, 0);
  }, [session]);

  // Get the global line number (across all scenes)
  const getGlobalLineNumber = useCallback((): number => {
    if (!session) return 0;
    let globalIndex = 0;
    for (let i = 0; i < session.currentSceneIndex; i++) {
      globalIndex += session.scenes[i]?.lines.length ?? 0;
    }
    return globalIndex + session.currentLineIndex;
  }, [session]);

  const getRoleById = useCallback((roleId: string): Role | undefined => {
    return session?.roles.find(r => r.id === roleId);
  }, [session]);

  const isUserLine = useCallback((line: ScriptLine | null): boolean => {
    if (!line || !session?.userRoleId) return false;
    const userRole = session.roles.find(r => r.id === session.userRoleId);
    if (!userRole) return false;
    return line.roleName === userRole.name || line.roleId === session.userRoleId;
  }, [session]);

  return {
    session,
    isLoading,
    error,
    createSession,
    createSessionFromParsed,
    updateSession,
    setUserRole,
    clearUserRole,
    updateRolePreset,
    toggleBookmark,
    goToLine,
    goToScene,
    nextLine,
    prevLine,
    setPlaying,
    setAmbient,
    setMemorizationMode,
    incrementLinesRehearsed,
    incrementRunsCompleted,
    clearSession,
    getCurrentLine,
    getPreviousLine,
    getNextLine,
    getTotalLines,
    getTotalScriptLines,
    getGlobalLineNumber,
    getRoleById,
    isUserLine,
  };
}

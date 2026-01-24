import { useState, useCallback, useEffect } from "react";
import type { Session, Role, ScriptLine, UpdateSession, BookmarkUpdate, RoleUpdate, MemorizationMode } from "@shared/schema";
import { parseScript } from "@/lib/script-parser";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

const STORAGE_KEY = "castmate-session";

export function useSession() {
  const [session, setSession] = useState<Session | null>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }
  }, [session]);

  const createSession = useCallback((name: string, rawScript: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const parsed = parseScript(rawScript);
      
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
    localStorage.removeItem(STORAGE_KEY);
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
    updateSession,
    setUserRole,
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
    getRoleById,
    isUserLine,
  };
}

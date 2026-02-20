import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Session, Role, Scene, UpdateSession, MemorizationMode, ParsedScript } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

interface SessionContextType {
  session: Session | null;
  lastRawScript: string;
  isLoading: boolean;
  error: string | null;
  createSession: (name: string, rawScript: string) => Promise<Session | null>;
  createSessionFromParsed: (name: string, parsed: { roles: Role[], scenes: Scene[] }, rawScript?: string) => Session | null;
  setUserRole: (roleId: string) => void;
  clearUserRole: () => void;
  updateSession: (updates: UpdateSession) => void;
  clearSession: () => void;
  clearError: () => void;
  advanceLine: () => void;
  previousLine: () => void;
  jumpToScene: (sceneIndex: number) => void;
  jumpToLine: (sceneIndex: number, lineIndex: number) => void;
  toggleBookmark: (lineId: string) => void;
  setMemorizationMode: (mode: MemorizationMode) => void;
  completeRun: () => void;
  incrementLinesRehearsed: () => void;
}

const SessionContext = createContext<SessionContextType | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [lastRawScript, setLastRawScript] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = useCallback(async (name: string, rawScript: string): Promise<Session | null> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[Session] Sending script to server for parsing:', rawScript.length, 'chars');
      
      const response = await apiRequest("POST", "/api/parse-script", { script: rawScript });
      const data = await response.json() as { parsed: ParsedScript; suggestedName?: string; error?: string };
      
      if (data.error || !data.parsed) {
        setError(data.error || "Failed to parse script");
        setIsLoading(false);
        return null;
      }
      
      const parsed = data.parsed;
      
      console.log('[Session] Parsed result (with AI cleanup):', {
        roles: parsed.roles.map(r => `${r.name}(${r.lineCount})`),
        scenes: parsed.scenes.length,
        totalLines: parsed.scenes.reduce((s, sc) => s + sc.lines.length, 0),
        suggestedName: data.suggestedName,
      });
      
      if (parsed.roles.length === 0) {
        setError("No roles detected. Make sure your script uses 'CHARACTER: dialogue' format.");
        setIsLoading(false);
        return null;
      }

      const sessionName = data.suggestedName || name;
      const now = new Date().toISOString();
      const newSession: Session = {
        id: generateId(),
        name: sessionName,
        roles: parsed.roles,
        scenes: parsed.scenes,
        userRoleId: null,
        currentLineIndex: 0,
        currentSceneIndex: 0,
        isPlaying: false,
        ambientEnabled: false,
        memorizationMode: "off",
        playbackSpeed: 1.0,
        runsCompleted: 0,
        linesRehearsed: 0,
        createdAt: now,
        updatedAt: now,
      };

      setLastRawScript(rawScript);
      setSession(newSession);
      setIsLoading(false);
      return newSession;
    } catch (e: any) {
      console.error('[Session] Parse error:', e);
      // Try to get the actual error message from the response
      let errorMsg = "Failed to parse script. Please check the format.";
      if (e?.message) {
        errorMsg = e.message;
      }
      setError(errorMsg);
      setIsLoading(false);
      return null;
    }
  }, []);

  const createSessionFromParsed = useCallback((name: string, parsed: { roles: Role[], scenes: Scene[] }, rawScript?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const totalLines = parsed.scenes.reduce((s, sc) => s + sc.lines.length, 0);
      console.log('[Session] Creating from parsed data:', {
        roles: parsed.roles.length,
        scenes: parsed.scenes.length,
        totalLines
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
        playbackSpeed: 1.0,
        runsCompleted: 0,
        linesRehearsed: 0,
        createdAt: now,
        updatedAt: now,
      };

      console.log('[Session] Created session with', newSession.scenes.length, 'scenes');
      if (rawScript) setLastRawScript(rawScript);
      setSession(newSession);
      setIsLoading(false);
      return newSession;
    } catch (e) {
      setError("Failed to create session from parsed data.");
      setIsLoading(false);
      return null;
    }
  }, []);

  const setUserRole = useCallback((roleId: string) => {
    setSession(prev => {
      if (!prev) return null;
      console.log('[Session] Setting user role:', roleId);
      return { ...prev, userRoleId: roleId };
    });
  }, []);

  const updateSession = useCallback((updates: UpdateSession) => {
    setSession(prev => {
      if (!prev) return null;
      return { ...prev, ...updates, updatedAt: new Date().toISOString() };
    });
  }, []);

  const clearUserRole = useCallback(() => {
    setSession(prev => {
      if (!prev) return null;
      return { ...prev, userRoleId: null };
    });
  }, []);

  const clearSession = useCallback(() => {
    setSession(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const advanceLine = useCallback(() => {
    setSession(prev => {
      if (!prev) return null;
      const currentScene = prev.scenes[prev.currentSceneIndex];
      if (!currentScene) return prev;

      if (prev.currentLineIndex < currentScene.lines.length - 1) {
        return { ...prev, currentLineIndex: prev.currentLineIndex + 1 };
      } else if (prev.currentSceneIndex < prev.scenes.length - 1) {
        return { ...prev, currentSceneIndex: prev.currentSceneIndex + 1, currentLineIndex: 0 };
      }
      return prev;
    });
  }, []);

  const previousLine = useCallback(() => {
    setSession(prev => {
      if (!prev) return null;
      if (prev.currentLineIndex > 0) {
        return { ...prev, currentLineIndex: prev.currentLineIndex - 1 };
      } else if (prev.currentSceneIndex > 0) {
        const prevScene = prev.scenes[prev.currentSceneIndex - 1];
        return {
          ...prev,
          currentSceneIndex: prev.currentSceneIndex - 1,
          currentLineIndex: prevScene.lines.length - 1
        };
      }
      return prev;
    });
  }, []);

  const jumpToScene = useCallback((sceneIndex: number) => {
    setSession(prev => {
      if (!prev || sceneIndex < 0 || sceneIndex >= prev.scenes.length) return prev;
      return { ...prev, currentSceneIndex: sceneIndex, currentLineIndex: 0 };
    });
  }, []);

  const jumpToLine = useCallback((sceneIndex: number, lineIndex: number) => {
    setSession(prev => {
      if (!prev) return prev;
      if (sceneIndex < 0 || sceneIndex >= prev.scenes.length) return prev;
      const scene = prev.scenes[sceneIndex];
      if (lineIndex < 0 || lineIndex >= scene.lines.length) return prev;
      return { ...prev, currentSceneIndex: sceneIndex, currentLineIndex: lineIndex };
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
            line.id === lineId ? { ...line, isBookmarked: !line.isBookmarked } : line
          )
        }))
      };
    });
  }, []);

  const setMemorizationMode = useCallback((mode: MemorizationMode) => {
    setSession(prev => {
      if (!prev) return null;
      return { ...prev, memorizationMode: mode };
    });
  }, []);

  const completeRun = useCallback(() => {
    setSession(prev => {
      if (!prev) return null;
      return { ...prev, runsCompleted: prev.runsCompleted + 1 };
    });
  }, []);

  const incrementLinesRehearsed = useCallback(() => {
    setSession(prev => {
      if (!prev) return null;
      return { ...prev, linesRehearsed: prev.linesRehearsed + 1 };
    });
  }, []);

  return (
    <SessionContext.Provider value={{
      session,
      lastRawScript,
      isLoading,
      error,
      createSession,
      createSessionFromParsed,
      setUserRole,
      clearUserRole,
      updateSession,
      clearSession,
      clearError,
      advanceLine,
      previousLine,
      jumpToScene,
      jumpToLine,
      toggleBookmark,
      setMemorizationMode,
      completeRun,
      incrementLinesRehearsed,
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSessionContext must be used within a SessionProvider");
  }
  return context;
}

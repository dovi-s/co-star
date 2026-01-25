import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Session, Role, Scene, UpdateSession, MemorizationMode } from "@shared/schema";
import { parseScript } from "@/lib/script-parser";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

interface SessionContextType {
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  createSession: (name: string, rawScript: string) => Session | null;
  createSessionFromParsed: (name: string, parsed: { roles: Role[], scenes: Scene[] }) => Session | null;
  setUserRole: (roleId: string) => void;
  updateSession: (updates: UpdateSession) => void;
  clearSession: () => void;
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = useCallback((name: string, rawScript: string) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[Session] Parsing script:', rawScript.length, 'chars');
      const parsed = parseScript(rawScript);
      
      console.log('[Session] Parsed result:', {
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

  const createSessionFromParsed = useCallback((name: string, parsed: { roles: Role[], scenes: Scene[] }) => {
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
        runsCompleted: 0,
        linesRehearsed: 0,
        createdAt: now,
        updatedAt: now,
      };

      console.log('[Session] Created session with', newSession.scenes.length, 'scenes');
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

  const clearSession = useCallback(() => {
    setSession(null);
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
      isLoading,
      error,
      createSession,
      createSessionFromParsed,
      setUserRole,
      updateSession,
      clearSession,
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

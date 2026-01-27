import { useCallback } from "react";
import type { ScriptLine, VoicePreset, MemorizationMode } from "@shared/schema";
import { useSessionContext } from "@/context/session-context";

export function useSession() {
  const {
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
  } = useSessionContext();

  // Helper: Get current line
  const getCurrentLine = useCallback((): ScriptLine | null => {
    if (!session) return null;
    const scene = session.scenes[session.currentSceneIndex];
    if (!scene) return null;
    return scene.lines[session.currentLineIndex] || null;
  }, [session]);

  // Helper: Get previous line
  const getPreviousLine = useCallback((): ScriptLine | null => {
    if (!session) return null;
    const scene = session.scenes[session.currentSceneIndex];
    if (!scene) return null;
    
    if (session.currentLineIndex > 0) {
      return scene.lines[session.currentLineIndex - 1] || null;
    } else if (session.currentSceneIndex > 0) {
      const prevScene = session.scenes[session.currentSceneIndex - 1];
      return prevScene.lines[prevScene.lines.length - 1] || null;
    }
    return null;
  }, [session]);

  // Helper: Get next line
  const getNextLine = useCallback((): ScriptLine | null => {
    if (!session) return null;
    const scene = session.scenes[session.currentSceneIndex];
    if (!scene) return null;
    
    if (session.currentLineIndex < scene.lines.length - 1) {
      return scene.lines[session.currentLineIndex + 1] || null;
    } else if (session.currentSceneIndex < session.scenes.length - 1) {
      const nextScene = session.scenes[session.currentSceneIndex + 1];
      return nextScene.lines[0] || null;
    }
    return null;
  }, [session]);

  // Helper: Get total lines in current scene
  const getTotalLines = useCallback((): number => {
    if (!session) return 0;
    const scene = session.scenes[session.currentSceneIndex];
    return scene?.lines.length || 0;
  }, [session]);

  // Helper: Get total lines across all scenes
  const getTotalScriptLines = useCallback((): number => {
    if (!session) return 0;
    return session.scenes.reduce((sum, scene) => sum + scene.lines.length, 0);
  }, [session]);

  // Helper: Get global line number (across all scenes)
  const getGlobalLineNumber = useCallback((): number => {
    if (!session) return 0;
    let count = 0;
    for (let i = 0; i < session.currentSceneIndex; i++) {
      count += session.scenes[i].lines.length;
    }
    return count + session.currentLineIndex;
  }, [session]);

  // Helper: Get role by ID
  const getRoleById = useCallback((roleId: string) => {
    if (!session) return undefined;
    return session.roles.find(r => r.id === roleId);
  }, [session]);

  // Helper: Check if a line is user's line (or current line if no argument)
  const isUserLine = useCallback((line?: ScriptLine | null): boolean => {
    if (!session || !session.userRoleId) return false;
    const targetLine = line ?? getCurrentLine();
    return targetLine?.roleId === session.userRoleId;
  }, [session, getCurrentLine]);

  // Navigation: Next line
  const nextLine = useCallback(() => {
    advanceLine();
    incrementLinesRehearsed();
  }, [advanceLine, incrementLinesRehearsed]);

  // Navigation: Previous line
  const prevLine = useCallback(() => {
    previousLine();
  }, [previousLine]);

  // Navigation: Go to specific line (lineIndex only uses current scene, or both scene and line)
  const goToLine = useCallback((lineIndexOrSceneIndex: number, lineIndex?: number) => {
    if (lineIndex !== undefined) {
      // goToLine(sceneIndex, lineIndex)
      jumpToLine(lineIndexOrSceneIndex, lineIndex);
    } else if (session) {
      // goToLine(lineIndex) - use current scene
      jumpToLine(session.currentSceneIndex, lineIndexOrSceneIndex);
    }
  }, [jumpToLine, session]);

  // Navigation: Go to scene
  const goToScene = useCallback((sceneIndex: number) => {
    jumpToScene(sceneIndex);
  }, [jumpToScene]);

  // Playback: Set playing state
  const setPlaying = useCallback((isPlaying: boolean) => {
    updateSession({ isPlaying });
  }, [updateSession]);

  // Settings: Set ambient sound
  const setAmbient = useCallback((ambientEnabled: boolean) => {
    updateSession({ ambientEnabled });
  }, [updateSession]);

  // Stats: Increment runs completed
  const incrementRunsCompleted = useCallback(() => {
    completeRun();
  }, [completeRun]);

  // Role: Update role preset (accepts object or two args)
  const updateRolePreset = useCallback((roleIdOrUpdate: string | { roleId: string; voicePreset: VoicePreset }, preset?: VoicePreset) => {
    if (!session) return;
    let roleId: string;
    let voicePreset: VoicePreset;
    
    if (typeof roleIdOrUpdate === 'object') {
      roleId = roleIdOrUpdate.roleId;
      voicePreset = roleIdOrUpdate.voicePreset;
    } else {
      roleId = roleIdOrUpdate;
      voicePreset = preset!;
    }
    
    const updatedRoles = session.roles.map(role =>
      role.id === roleId ? { ...role, voicePreset } : role
    );
    updateSession({ roles: updatedRoles });
  }, [session, updateSession]);

  // Clear user role (go back to role selection)
  const clearUserRole = useCallback(() => {
    updateSession({ userRoleId: null });
  }, [updateSession]);

  return {
    session,
    isLoading,
    error,
    createSession,
    createSessionFromParsed,
    setUserRole,
    clearSession,
    clearUserRole,
    getCurrentLine,
    getPreviousLine,
    getNextLine,
    getTotalLines,
    getTotalScriptLines,
    getGlobalLineNumber,
    getRoleById,
    isUserLine,
    nextLine,
    prevLine,
    goToLine,
    goToScene,
    setPlaying,
    setAmbient,
    setMemorizationMode,
    incrementLinesRehearsed,
    incrementRunsCompleted,
    toggleBookmark,
    updateRolePreset,
    updateSession,
  };
}

import { useState, useEffect, useCallback, useRef } from "react";
import type { UserStats } from "@shared/schema";

const STATS_KEY_PREFIX = "costar-user-stats";
const RUN_HISTORY_KEY_PREFIX = "costar-run-history";
const LEGACY_STATS_KEY = "costar-user-stats";
const LEGACY_RUN_HISTORY_KEY = "costar-run-history";

function getStatsKey(userId?: string | number | null): string {
  return userId ? `${STATS_KEY_PREFIX}-${userId}` : LEGACY_STATS_KEY;
}

function getRunHistoryKey(userId?: string | number | null): string {
  return userId ? `${RUN_HISTORY_KEY_PREFIX}-${userId}` : LEGACY_RUN_HISTORY_KEY;
}

export interface RunHistoryEntry {
  scriptFingerprint: string;
  accuracy: number;
  linesSpoken: number;
  duration: number;
  timestamp: number;
}

const MAX_HISTORY_ENTRIES = 50;

function getRunHistory(key: string): RunHistoryEntry[] {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved) as RunHistoryEntry[];
  } catch {}
  return [];
}

function saveRunHistory(key: string, history: RunHistoryEntry[]) {
  try {
    localStorage.setItem(key, JSON.stringify(history.slice(-MAX_HISTORY_ENTRIES)));
  } catch {}
}

const defaultStats: UserStats = {
  currentStreak: 0,
  longestStreak: 0,
  totalSessions: 0,
  totalLinesRehearsed: 0,
  totalRunsCompleted: 0,
  lastRehearsalDate: null,
  dailyGoal: 50,
  todayLines: 0,
  achievements: [],
};

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function isYesterday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toISOString().split("T")[0] === yesterday.toISOString().split("T")[0];
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return dateStr === getToday();
}

export function useUserStats(userId?: string | number | null) {
  const statsKey = getStatsKey(userId);
  const runHistoryKey = getRunHistoryKey(userId);
  const hydratedKeyRef = useRef(statsKey);

  function loadStats(key: string, uid?: string | number | null): UserStats {
    try {
      let saved = localStorage.getItem(key);
      if (!saved && uid) {
        saved = localStorage.getItem(LEGACY_STATS_KEY);
      }
      if (saved) {
        const parsed = JSON.parse(saved) as UserStats;
        const wasToday = isToday(parsed.lastRehearsalDate);
        const wasYesterday = isYesterday(parsed.lastRehearsalDate);
        if (!wasToday && !wasYesterday) {
          return { ...parsed, currentStreak: 0, todayLines: 0 };
        }
        if (!wasToday) {
          return { ...parsed, todayLines: 0 };
        }
        return parsed;
      }
    } catch {}
    return defaultStats;
  }

  const [stats, setStats] = useState<UserStats>(() => loadStats(statsKey, userId));

  useEffect(() => {
    hydratedKeyRef.current = statsKey;
    setStats(loadStats(statsKey, userId));
  }, [statsKey, userId]);

  useEffect(() => {
    if (hydratedKeyRef.current === statsKey) {
      localStorage.setItem(statsKey, JSON.stringify(stats));
    }
  }, [stats, statsKey]);

  const recordRehearsal = useCallback((linesRehearsed: number, runsCompleted: number) => {
    setStats((prev) => {
      const today = getToday();
      const wasToday = isToday(prev.lastRehearsalDate);
      const wasYesterday = isYesterday(prev.lastRehearsalDate);
      
      let newStreak = prev.currentStreak;
      if (!wasToday) {
        if (wasYesterday) {
          newStreak = prev.currentStreak + 1;
        } else {
          newStreak = 1;
        }
      }
      
      const newLongest = Math.max(prev.longestStreak, newStreak);
      const newTodayLines = wasToday 
        ? prev.todayLines + linesRehearsed 
        : linesRehearsed;
      
      const newAchievements = [...prev.achievements];
      if (newStreak >= 3 && !newAchievements.includes("streak_3")) {
        newAchievements.push("streak_3");
      }
      if (newStreak >= 7 && !newAchievements.includes("streak_7")) {
        newAchievements.push("streak_7");
      }
      if (newStreak >= 30 && !newAchievements.includes("streak_30")) {
        newAchievements.push("streak_30");
      }
      if (prev.totalLinesRehearsed + linesRehearsed >= 100 && !newAchievements.includes("lines_100")) {
        newAchievements.push("lines_100");
      }
      if (prev.totalLinesRehearsed + linesRehearsed >= 1000 && !newAchievements.includes("lines_1000")) {
        newAchievements.push("lines_1000");
      }
      if (prev.totalRunsCompleted + runsCompleted >= 10 && !newAchievements.includes("runs_10")) {
        newAchievements.push("runs_10");
      }
      
      return {
        ...prev,
        currentStreak: newStreak,
        longestStreak: newLongest,
        totalSessions: prev.totalSessions + (wasToday ? 0 : 1),
        totalLinesRehearsed: prev.totalLinesRehearsed + linesRehearsed,
        totalRunsCompleted: prev.totalRunsCompleted + runsCompleted,
        lastRehearsalDate: today,
        todayLines: newTodayLines,
        achievements: newAchievements,
      };
    });
  }, []);

  const setDailyGoal = useCallback((goal: number) => {
    setStats((prev) => ({ ...prev, dailyGoal: goal }));
  }, []);

  const hasReachedGoal = stats.todayLines >= stats.dailyGoal;

  const resolveRunHistory = useCallback((): RunHistoryEntry[] => {
    let history = getRunHistory(runHistoryKey);
    if (history.length === 0 && userId) {
      const legacy = getRunHistory(LEGACY_RUN_HISTORY_KEY);
      if (legacy.length > 0) {
        saveRunHistory(runHistoryKey, legacy);
        return legacy;
      }
    }
    return history;
  }, [runHistoryKey, userId]);

  const recordRunHistory = useCallback((entry: Omit<RunHistoryEntry, "timestamp">) => {
    const history = resolveRunHistory();
    history.push({ ...entry, timestamp: Date.now() });
    saveRunHistory(runHistoryKey, history);
  }, [runHistoryKey, resolveRunHistory]);

  const getLastRunForScript = useCallback((scriptFingerprint: string): RunHistoryEntry | null => {
    const history = resolveRunHistory();
    const scriptRuns = history.filter(h => h.scriptFingerprint === scriptFingerprint);
    if (scriptRuns.length < 2) return null;
    return scriptRuns[scriptRuns.length - 2];
  }, [resolveRunHistory]);

  const didRehearsalToday = isToday(stats.lastRehearsalDate);

  return {
    stats,
    recordRehearsal,
    setDailyGoal,
    hasReachedGoal,
    recordRunHistory,
    getLastRunForScript,
    didRehearsalToday,
  };
}

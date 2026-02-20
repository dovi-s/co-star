import { useState, useEffect, useCallback } from "react";
import type { UserStats } from "@shared/schema";

const STATS_KEY = "costar-user-stats";

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

export function useUserStats() {
  const [stats, setStats] = useState<UserStats>(() => {
    try {
      const saved = localStorage.getItem(STATS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as UserStats;
        if (!isToday(parsed.lastRehearsalDate)) {
          return { ...parsed, todayLines: 0 };
        }
        return parsed;
      }
    } catch {}
    return defaultStats;
  });

  useEffect(() => {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }, [stats]);

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

  return {
    stats,
    recordRehearsal,
    setDailyGoal,
    hasReachedGoal,
  };
}

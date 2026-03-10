const STORAGE_KEY = "costar-recent-scripts";
const MAX_ENTRIES = 8;

export interface RecentScript {
  id: string;
  name: string;
  rawScript: string;
  roleCount: number;
  lineCount: number;
  lastRole?: string;
  lastUsed: string;
  lastPosition?: number;
  lastScene?: number;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function getRecentScripts(): RecentScript[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveRecentScript(entry: Omit<RecentScript, "id" | "lastUsed">): void {
  try {
    const scripts = getRecentScripts();
    const existingIndex = scripts.findIndex(
      (s) => s.rawScript === entry.rawScript
    );

    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      scripts[existingIndex] = {
        ...scripts[existingIndex],
        name: entry.name,
        roleCount: entry.roleCount,
        lineCount: entry.lineCount,
        lastRole: entry.lastRole || scripts[existingIndex].lastRole,
        lastUsed: now,
      };
      const updated = scripts.splice(existingIndex, 1)[0];
      scripts.unshift(updated);
    } else {
      scripts.unshift({
        ...entry,
        id: generateId(),
        lastUsed: now,
      });
    }

    const trimmed = scripts.slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {}
}

export function updateRecentScript(id: string, updates: Partial<Pick<RecentScript, "name" | "lastRole" | "lastPosition" | "lastScene">>): void {
  try {
    const scripts = getRecentScripts();
    const index = scripts.findIndex((s) => s.id === id);
    if (index >= 0) {
      scripts[index] = { ...scripts[index], ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
    }
  } catch {}
}

export function deleteRecentScript(id: string): void {
  try {
    const scripts = getRecentScripts().filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
  } catch {}
}

export function clearRecentScripts(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

const RESUME_KEY = "costar-resume-positions";

interface ResumeState {
  lineIndex: number;
  sceneIndex: number;
  roleId?: string;
  timestamp: number;
}

export function saveResumePosition(scriptFingerprint: string, state: ResumeState): void {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    const data: Record<string, ResumeState> = raw ? JSON.parse(raw) : {};
    data[scriptFingerprint] = state;
    const keys = Object.keys(data);
    if (keys.length > 20) {
      const sorted = keys.sort((a, b) => (data[a].timestamp ?? 0) - (data[b].timestamp ?? 0));
      sorted.slice(0, keys.length - 20).forEach(k => delete data[k]);
    }
    localStorage.setItem(RESUME_KEY, JSON.stringify(data));
  } catch {}
}

export function getResumePosition(scriptFingerprint: string): ResumeState | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data[scriptFingerprint] ?? null;
  } catch {
    return null;
  }
}

export function clearResumePosition(scriptFingerprint: string): void {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    delete data[scriptFingerprint];
    localStorage.setItem(RESUME_KEY, JSON.stringify(data));
  } catch {}
}

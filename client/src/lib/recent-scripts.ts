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
      (s) => s.rawScript.substring(0, 200) === entry.rawScript.substring(0, 200)
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

export function updateRecentScript(id: string, updates: Partial<Pick<RecentScript, "name" | "lastRole">>): void {
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

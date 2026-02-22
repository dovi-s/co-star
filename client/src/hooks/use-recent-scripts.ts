import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  getRecentScripts as getLocalRecent,
  saveRecentScript as saveLocalRecent,
  updateRecentScript as updateLocalRecent,
  deleteRecentScript as deleteLocalRecent,
  type RecentScript,
} from "@/lib/recent-scripts";

export type { RecentScript } from "@/lib/recent-scripts";

function toRecentScript(row: any): RecentScript {
  return {
    id: row.id,
    name: row.name,
    rawScript: row.rawScript || row.raw_script || "",
    roleCount: row.roleCount ?? row.role_count ?? 0,
    lineCount: row.lineCount ?? row.line_count ?? 0,
    lastRole: row.lastRole ?? row.last_role ?? undefined,
    lastUsed: row.lastUsed ?? row.last_used ?? new Date().toISOString(),
  };
}

export function useRecentScripts() {
  const { isAuthenticated } = useAuth();
  const [scripts, setScripts] = useState<RecentScript[]>([]);
  const [loading, setLoading] = useState(false);
  const isAuthRef = useRef(isAuthenticated);
  isAuthRef.current = isAuthenticated;

  const fetchRemote = useCallback(async () => {
    try {
      const res = await fetch("/api/recent-scripts", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setScripts(data.map(toRecentScript));
      } else {
        console.warn("[RecentScripts] Failed to fetch:", res.status);
      }
    } catch (err) {
      console.warn("[RecentScripts] Fetch error:", err);
    }
  }, []);

  const refresh = useCallback(() => {
    if (isAuthRef.current) {
      fetchRemote();
    } else {
      setScripts(getLocalRecent());
    }
  }, [fetchRemote]);

  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true);
      fetchRemote().finally(() => setLoading(false));
    } else {
      setScripts(getLocalRecent());
    }
  }, [isAuthenticated, fetchRemote]);

  const save = useCallback(async (entry: Omit<RecentScript, "id" | "lastUsed">) => {
    if (isAuthRef.current) {
      try {
        const res = await fetch("/api/recent-scripts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: entry.name,
            rawScript: entry.rawScript,
            roleCount: entry.roleCount,
            lineCount: entry.lineCount,
            lastRole: entry.lastRole || null,
          }),
        });
        if (!res.ok) console.warn("[RecentScripts] Save failed:", res.status);
        await fetchRemote();
      } catch (err) {
        console.warn("[RecentScripts] Save error:", err);
      }
    } else {
      saveLocalRecent(entry);
      setScripts(getLocalRecent());
    }
  }, [fetchRemote]);

  const update = useCallback(async (id: string, updates: Partial<Pick<RecentScript, "name" | "lastRole">>) => {
    if (isAuthRef.current) {
      try {
        const res = await fetch(`/api/recent-scripts/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(updates),
        });
        if (!res.ok) console.warn("[RecentScripts] Update failed:", res.status);
        await fetchRemote();
      } catch (err) {
        console.warn("[RecentScripts] Update error:", err);
      }
    } else {
      updateLocalRecent(id, updates);
      setScripts(getLocalRecent());
    }
  }, [fetchRemote]);

  const remove = useCallback(async (id: string) => {
    if (isAuthRef.current) {
      try {
        const res = await fetch(`/api/recent-scripts/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) console.warn("[RecentScripts] Delete failed:", res.status);
        await fetchRemote();
      } catch (err) {
        console.warn("[RecentScripts] Delete error:", err);
      }
    } else {
      deleteLocalRecent(id);
      setScripts(getLocalRecent());
    }
  }, [fetchRemote]);

  return { scripts, loading, refresh, save, update, remove };
}

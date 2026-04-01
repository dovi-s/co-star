import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

export function useFeatureFlags() {
  const { data: flags = {} } = useQuery<Record<string, any>>({
    queryKey: ["/api/feature-flags"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  return flags;
}

function stableHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

export function useFeatureFlag(key: string, defaultValue: boolean = false): boolean {
  const flags = useFeatureFlags();
  const { user } = useAuth();
  const val = flags[key];
  if (val === undefined || val === null) return defaultValue;
  if (val === true || val === "true") return true;
  if (val === false || val === "false") return false;
  const pct = typeof val === "number" ? val : parseFloat(val);
  if (!isNaN(pct) && pct >= 0 && pct <= 100) {
    const userId = user?.id || "anonymous";
    const bucket = stableHash(`${key}:${userId}`) % 100;
    return bucket < pct;
  }
  return defaultValue;
}

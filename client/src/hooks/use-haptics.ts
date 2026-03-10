import { useCallback, useState } from "react";

const HAPTIC_KEY = "costar-haptics-enabled";

const isSupported = () =>
  typeof navigator !== "undefined" && "vibrate" in navigator;

const getStoredPref = (): boolean => {
  try {
    const val = localStorage.getItem(HAPTIC_KEY);
    return val === null ? true : val === "true";
  } catch {
    return true;
  }
};

export type HapticPattern = "tap" | "success" | "achievement" | "error" | "select";

const patterns: Record<HapticPattern, number | number[]> = {
  tap: 8,
  select: 12,
  success: [15, 60, 15],
  achievement: [20, 40, 20, 40, 30],
  error: [30, 80, 30],
};

export function useHaptics() {
  const [enabled, setEnabled] = useState(getStoredPref);

  const setHapticsEnabled = useCallback((val: boolean) => {
    setEnabled(val);
    try {
      localStorage.setItem(HAPTIC_KEY, String(val));
    } catch {}
  }, []);

  const trigger = useCallback(
    (pattern: HapticPattern) => {
      if (!enabled || !isSupported()) return;
      try {
        navigator.vibrate(patterns[pattern]);
      } catch {}
    },
    [enabled],
  );

  return { enabled, setHapticsEnabled, trigger, isSupported: isSupported() };
}

export function triggerHaptic(pattern: HapticPattern) {
  if (!isSupported()) return;
  try {
    const pref = getStoredPref();
    if (pref) navigator.vibrate(patterns[pattern]);
  } catch {}
}

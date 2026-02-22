import { useCallback, useEffect, useRef } from "react";

const BATCH_INTERVAL = 5000;
const MAX_BATCH_SIZE = 20;

interface TrackEvent {
  event: string;
  category: string;
  label?: string;
  value?: string;
  path?: string;
  metadata?: Record<string, any>;
}

let eventQueue: TrackEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flushEvents() {
  if (eventQueue.length === 0) return;
  const batch = eventQueue.splice(0, MAX_BATCH_SIZE);
  batch.forEach((evt) => {
    fetch("/api/track-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(evt),
      credentials: "include",
    }).catch(() => {});
  });
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushEvents();
  }, BATCH_INTERVAL);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushEvents);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushEvents();
  });
}

export function trackEvent(
  event: string,
  category: string,
  label?: string,
  value?: string,
  metadata?: Record<string, any>
) {
  eventQueue.push({
    event,
    category,
    label,
    value,
    path: window.location.pathname,
    metadata,
  });
  if (eventQueue.length >= MAX_BATCH_SIZE) {
    flushEvents();
  } else {
    scheduleFlush();
  }
}

export function trackClick(label: string, metadata?: Record<string, any>) {
  trackEvent("click", "click", label, undefined, metadata);
}

export function trackFeature(feature: string, action?: string, metadata?: Record<string, any>) {
  trackEvent(feature, "feature", action, undefined, metadata);
}

export function trackNavigation(from: string, to: string) {
  trackEvent("navigate", "navigation", to, from);
}

export function useTrackPageView(path: string) {
  const tracked = useRef<string>("");
  useEffect(() => {
    if (tracked.current === path) return;
    tracked.current = path;
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, referrer: document.referrer }),
      credentials: "include",
    }).catch(() => {});
  }, [path]);
}

export function useTrackClick() {
  return useCallback((label: string, metadata?: Record<string, any>) => {
    trackClick(label, metadata);
  }, []);
}

export function reportError(
  message: string,
  stack?: string,
  source?: string,
  metadata?: Record<string, any>
) {
  fetch("/api/track-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      stack,
      source,
      path: window.location.pathname,
      metadata,
    }),
    credentials: "include",
  }).catch(() => {});
}

if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => {
    reportError(
      e.message || "Unknown error",
      e.error?.stack,
      "window.onerror",
      { filename: e.filename, lineno: e.lineno, colno: e.colno }
    );
  });

  window.addEventListener("unhandledrejection", (e) => {
    const msg = e.reason?.message || String(e.reason) || "Unhandled promise rejection";
    reportError(msg, e.reason?.stack, "unhandledrejection");
  });
}

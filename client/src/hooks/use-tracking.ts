import { useEffect, useRef } from "react";

export function usePageTracking(view: string) {
  const lastTracked = useRef<string>("");

  useEffect(() => {
    if (view === lastTracked.current) return;
    lastTracked.current = view;

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        path: `/${view === "home" ? "" : view}`,
        referrer: document.referrer || null,
      }),
    }).catch(() => {});
  }, [view]);
}

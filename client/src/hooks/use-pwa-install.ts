import { useState, useEffect, useCallback, useRef } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const INSTALL_PROMPTED_KEY = "costar-install-prompted";

function isStandalone(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if ((navigator as any).standalone === true) return true;
  if (document.referrer.includes("android-app://")) return true;
  return false;
}

function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

export function usePwaInstall() {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);
  const [showInstallCard, setShowInstallCard] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    setIsIOS(isIOSSafari());

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setCanPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const triggerInstallPrompt = useCallback(() => {
    if (isStandalone()) return;

    try {
      if (localStorage.getItem(INSTALL_PROMPTED_KEY) === "true") return;
    } catch {}

    if (deferredPromptRef.current || isIOSSafari()) {
      setShowInstallCard(true);
    }
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPromptRef.current) {
      try {
        await deferredPromptRef.current.prompt();
        const choice = await deferredPromptRef.current.userChoice;
        if (choice.outcome === "accepted") {
          setCanPrompt(false);
        }
      } catch {}
      deferredPromptRef.current = null;
    }
    dismissInstallCard();
  }, []);

  const dismissInstallCard = useCallback(() => {
    setShowInstallCard(false);
    try {
      localStorage.setItem(INSTALL_PROMPTED_KEY, "true");
    } catch {}
  }, []);

  return {
    canPrompt,
    isIOS,
    showInstallCard,
    triggerInstallPrompt,
    handleInstall,
    dismissInstallCard,
  };
}

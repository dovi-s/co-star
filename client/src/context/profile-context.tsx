import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface ProfileData {
  name: string;
  photoUrl: string | null;
}

interface ProfileContextValue {
  profile: ProfileData;
  setName: (name: string) => void;
  setPhoto: (dataUrl: string | null) => void;
  syncFromServer: (photoUrl: string | null, name?: string) => void;
}

const STORAGE_KEY = "co-star-profile";
const MAX_PHOTO_DIMENSION = 256;
const JPEG_QUALITY = 0.7;

function loadProfile(): ProfileData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { name: parsed.name || "", photoUrl: parsed.photoUrl || null };
    }
  } catch {}
  return { name: "", photoUrl: null };
}

function saveProfile(data: ProfileData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("[Profile] localStorage save failed, photo may be too large:", e);
  }
}

export function compressPhoto(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width;
      let h = img.height;
      if (w > MAX_PHOTO_DIMENSION || h > MAX_PHOTO_DIMENSION) {
        if (w > h) {
          h = Math.round(h * (MAX_PHOTO_DIMENSION / w));
          w = MAX_PHOTO_DIMENSION;
        } else {
          w = Math.round(w * (MAX_PHOTO_DIMENSION / h));
          h = MAX_PHOTO_DIMENSION;
        }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<ProfileData>(loadProfile);

  const setName = useCallback((name: string) => {
    setProfile(prev => {
      const next = { ...prev, name };
      saveProfile(next);
      return next;
    });
  }, []);

  const setPhoto = useCallback((dataUrl: string | null) => {
    if (dataUrl) {
      compressPhoto(dataUrl).then(compressed => {
        setProfile(prev => {
          const next = { ...prev, photoUrl: compressed };
          saveProfile(next);
          return next;
        });
      });
    } else {
      setProfile(prev => {
        const next = { ...prev, photoUrl: null };
        saveProfile(next);
        return next;
      });
    }
  }, []);

  const syncFromServer = useCallback((photoUrl: string | null, name?: string) => {
    setProfile(prev => {
      const hasLocalPhoto = !!prev.photoUrl;
      const hasServerPhoto = !!photoUrl;
      if (!hasLocalPhoto && hasServerPhoto) {
        const next = { ...prev, photoUrl, ...(name ? { name } : {}) };
        saveProfile(next);
        return next;
      }
      if (name && !prev.name) {
        const next = { ...prev, name };
        saveProfile(next);
        return next;
      }
      return prev;
    });
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, setName, setPhoto, syncFromServer }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}

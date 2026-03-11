import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { queryClient } from "@/lib/queryClient";

interface ProfileData {
  name: string;
  photoUrl: string | null;
}

interface ProfileContextValue {
  profile: ProfileData;
  setName: (name: string) => void;
  setPhoto: (dataUrl: string | null) => void;
  syncFromServer: (photoUrl: string | null, name?: string) => void;
  clearProfile: () => void;
}

const STORAGE_KEY = "co-star-profile";
const MAX_PHOTO_DIMENSION = 256;
const JPEG_QUALITY = 0.7;
const MAX_PHOTO_BYTES = 100_000;

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
    const toSave = { ...data };
    if (toSave.photoUrl && toSave.photoUrl.length > MAX_PHOTO_BYTES) {
      toSave.photoUrl = null;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.warn("[Profile] localStorage save failed:", e);
  }
}

async function persistPhotoToServer(photoUrl: string | null): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileImageUrl: photoUrl }),
      credentials: "include",
    });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      return true;
    }
    console.warn("[Profile] Server save failed:", res.status);
    return false;
  } catch (err) {
    console.warn("[Profile] Server save error:", err);
    return false;
  }
}

export function compressPhoto(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
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
          const compressed = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
          if (compressed.length < dataUrl.length) {
            resolve(compressed);
          } else {
            resolve(canvas.toDataURL("image/jpeg", 0.5));
          }
        } else {
          resolve(dataUrl);
        }
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => {
      console.warn("[Profile] Image load failed during compression, using original");
      resolve(dataUrl);
    };
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
        persistPhotoToServer(compressed).then(ok => {
          if (!ok) {
            setTimeout(() => persistPhotoToServer(compressed), 3000);
          }
        });
      });
    } else {
      setProfile(prev => {
        const next = { ...prev, photoUrl: null };
        saveProfile(next);
        return next;
      });
      persistPhotoToServer(null);
    }
  }, []);

  const syncFromServer = useCallback((photoUrl: string | null, name?: string) => {
    setProfile(prev => {
      const hasServerPhoto = !!photoUrl;
      if (hasServerPhoto) {
        const next = { ...prev, photoUrl, ...(name ? { name } : {}) };
        saveProfile(next);
        return next;
      }
      if (prev.photoUrl && !hasServerPhoto) {
        persistPhotoToServer(prev.photoUrl);
      }
      if (name && !prev.name) {
        const next = { ...prev, name };
        saveProfile(next);
        return next;
      }
      return prev;
    });
  }, []);

  const clearProfile = useCallback(() => {
    const empty = { name: "", photoUrl: null };
    setProfile(empty);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, setName, setPhoto, syncFromServer, clearProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}

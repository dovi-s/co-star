import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface ProfileData {
  name: string;
  photoUrl: string | null;
}

interface ProfileContextValue {
  profile: ProfileData;
  setName: (name: string) => void;
  setPhoto: (dataUrl: string | null) => void;
}

const STORAGE_KEY = "co-star-profile";

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
  } catch {}
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
    setProfile(prev => {
      const next = { ...prev, photoUrl: dataUrl };
      saveProfile(next);
      return next;
    });
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, setName, setPhoto }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}

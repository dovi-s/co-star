import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { ProfileAvatar } from "@/components/profile-avatar";
import { useProfile, compressPhoto } from "@/context/profile-context";
import {
  ChevronLeft,
  Camera,
  Save,
  Loader2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

const eyeColorOptions = ["Brown", "Blue", "Green", "Hazel", "Gray", "Amber"];
const hairColorOptions = ["Black", "Brown", "Blonde", "Red", "Auburn", "Gray", "White", "Other"];
const ageRangeOptions = ["18-25", "26-35", "36-45", "46-55", "56-65", "65+"];
const pronounOptions = ["He/Him", "She/Her", "They/Them", "He/They", "She/They", "Other"];
const unionOptions = ["SAG-AFTRA", "AEA", "Both", "Non-Union", "Prefer not to say"];
const heightFeetOptions = ["4", "5", "6", "7"];
const heightInchOptions = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];

function ChipSelect({
  options,
  value,
  onChange,
  testIdPrefix,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  testIdPrefix: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(value === opt ? "" : opt)}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-colors border",
            value === opt
              ? "bg-primary/10 border-primary/30 text-primary"
              : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
          )}
          data-testid={`${testIdPrefix}-${opt.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function parseHeight(h: string | null | undefined): { feet: string; inches: string } {
  if (!h) return { feet: "", inches: "" };
  const match = h.match(/(\d+)'(\d+)"/);
  if (match) return { feet: match[1], inches: match[2] };
  return { feet: "", inches: "" };
}

interface ActorProfilePageProps {
  onBack: () => void;
}

export function ActorProfilePage({ onBack }: ActorProfilePageProps) {
  const { user } = useAuth();
  const { setPhoto } = useProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [stageName, setStageName] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [eyeColor, setEyeColor] = useState("");
  const [hairColor, setHairColor] = useState("");
  const [location, setLocation] = useState("");
  const [unionStatus, setUnionStatus] = useState("");
  const [specialSkills, setSpecialSkills] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setStageName((user as any).stageName || "");
      setPronouns((user as any).pronouns || "");
      setAgeRange((user as any).ageRange || "");
      setEyeColor((user as any).eyeColor || "");
      setHairColor((user as any).hairColor || "");
      setLocation((user as any).location || "");
      setUnionStatus((user as any).unionStatus || "");
      setSpecialSkills((user as any).specialSkills || "");
      setPhotoPreview(user.profileImageUrl || null);
      const parsed = parseHeight((user as any).height);
      setHeightFeet(parsed.feet);
      setHeightInches(parsed.inches);
    }
  }, [user]);

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await apiRequest("PATCH", "/api/auth/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      const compressed = await compressPhoto(dataUrl);
      setPhotoPreview(compressed);
      setPhoto(compressed);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const height = heightFeet && heightInches !== "" ? `${heightFeet}'${heightInches}"` : "";
    saveMutation.mutate({
      firstName,
      lastName,
      stageName,
      pronouns,
      ageRange,
      height,
      eyeColor,
      hairColor,
      location,
      unionStatus,
      specialSkills,
      ...(photoPreview ? { profileImageUrl: photoPreview } : {}),
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 sticky top-0 z-50 glass-surface safe-top rounded-none">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          data-testid="button-back"
          className="shrink-0 -ml-1"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-sm text-foreground">Actor Profile</h1>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saveMutation.isPending}
          data-testid="button-save-profile"
          className="shrink-0"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saved ? (
            <>
              <Check className="h-3.5 w-3.5 mr-1" />
              Saved
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5 mr-1" />
              Save
            </>
          )}
        </Button>
      </header>

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoSelect}
          data-testid="input-profile-photo-upload"
        />

        <div className="flex flex-col items-center mb-8">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="relative group"
            data-testid="button-change-headshot"
          >
            <div className="w-24 h-24 rounded-full overflow-hidden bg-muted/50 border-2 border-border flex items-center justify-center transition-colors group-hover:border-primary/50">
              {photoPreview ? (
                <img src={photoPreview} alt="Headshot" className="w-full h-full object-cover" />
              ) : (
                <ProfileAvatar size="lg" className="text-primary w-full h-full" />
              )}
            </div>
            <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-lg">
              <Camera className="h-3 w-3 text-primary-foreground" />
            </div>
          </button>
          <p className="text-[11px] text-muted-foreground mt-2">{user?.email}</p>
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">Personal</h2>
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">First name</label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} data-testid="input-profile-first-name" className="h-10" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Last name</label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} data-testid="input-profile-last-name" className="h-10" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Stage name</label>
                <Input
                  placeholder="If different from your legal name"
                  value={stageName}
                  onChange={(e) => setStageName(e.target.value)}
                  data-testid="input-profile-stage-name"
                  className="h-10"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Pronouns</label>
                <ChipSelect options={pronounOptions} value={pronouns} onChange={setPronouns} testIdPrefix="profile-pronouns" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Age range</label>
                <ChipSelect options={ageRangeOptions} value={ageRange} onChange={setAgeRange} testIdPrefix="profile-age" />
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">Appearance</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Height</label>
                <div className="flex gap-2">
                  <select
                    value={heightFeet}
                    onChange={(e) => setHeightFeet(e.target.value)}
                    className="h-10 px-3 rounded-md border border-border bg-background text-sm text-foreground flex-1"
                    data-testid="profile-select-height-feet"
                  >
                    <option value="">ft</option>
                    {heightFeetOptions.map((f) => (
                      <option key={f} value={f}>{f}'</option>
                    ))}
                  </select>
                  <select
                    value={heightInches}
                    onChange={(e) => setHeightInches(e.target.value)}
                    className="h-10 px-3 rounded-md border border-border bg-background text-sm text-foreground flex-1"
                    data-testid="profile-select-height-inches"
                  >
                    <option value="">in</option>
                    {heightInchOptions.map((i) => (
                      <option key={i} value={i}>{i}"</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Eye color</label>
                <ChipSelect options={eyeColorOptions} value={eyeColor} onChange={setEyeColor} testIdPrefix="profile-eye" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Hair color</label>
                <ChipSelect options={hairColorOptions} value={hairColor} onChange={setHairColor} testIdPrefix="profile-hair" />
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">Industry</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Location</label>
                <Input
                  placeholder="e.g. Los Angeles, CA"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  data-testid="input-profile-location"
                  className="h-10"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Union status</label>
                <ChipSelect options={unionOptions} value={unionStatus} onChange={setUnionStatus} testIdPrefix="profile-union" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Special skills</label>
                <Textarea
                  placeholder="Accents, languages, instruments, martial arts, etc."
                  value={specialSkills}
                  onChange={(e) => setSpecialSkills(e.target.value)}
                  data-testid="input-profile-skills"
                  className="min-h-[80px] resize-none text-sm"
                />
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

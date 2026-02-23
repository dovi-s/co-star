import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/logo";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { ProfileAvatar } from "@/components/profile-avatar";
import { useProfile, compressPhoto } from "@/context/profile-context";
import {
  ChevronRight,
  ChevronLeft,
  Camera,
  Check,
  Crown,
  Loader2,
  Sparkles,
  Library,
  Video,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const eyeColorOptions = ["Brown", "Blue", "Green", "Hazel", "Gray", "Amber"];
const hairColorOptions = ["Black", "Brown", "Blonde", "Red", "Auburn", "Gray", "White", "Other"];
const ageRangeOptions = ["18-25", "26-35", "36-45", "46-55", "56-65", "65+"];
const pronounOptions = ["He/Him", "She/Her", "They/Them", "He/They", "She/They", "Other"];
const unionOptions = ["SAG-AFTRA", "AEA", "Both", "Non-Union", "Prefer not to say"];

const heightFeetOptions = ["4", "5", "6", "7"];
const heightInchOptions = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];

interface OnboardingPageProps {
  onComplete: () => void;
}

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

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const { user } = useAuth();
  const { setPhoto } = useProfile();
  const [step, setStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stageName, setStageName] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [eyeColor, setEyeColor] = useState("");
  const [hairColor, setHairColor] = useState("");
  const [location, setLocation] = useState("");
  const [unionStatus, setUnionStatus] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await apiRequest("PATCH", "/api/auth/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
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

  const saveStep1 = () => {
    const data: Record<string, string> = {};
    if (stageName.trim()) data.stageName = stageName.trim();
    if (pronouns) data.pronouns = pronouns;
    if (ageRange) data.ageRange = ageRange;
    if (Object.keys(data).length > 0) saveMutation.mutate(data);
    setStep(1);
  };

  const saveStep2 = () => {
    const data: Record<string, string> = {};
    const h = heightFeet && heightInches !== "" ? `${heightFeet}'${heightInches}"` : "";
    if (h) data.height = h;
    if (eyeColor) data.eyeColor = eyeColor;
    if (hairColor) data.hairColor = hairColor;
    if (location.trim()) data.location = location.trim();
    if (unionStatus) data.unionStatus = unionStatus;
    if (Object.keys(data).length > 0) saveMutation.mutate(data);
    setStep(2);
  };

  const saveStep3 = () => {
    const data: Record<string, string> = {};
    if (photoPreview) data.profileImageUrl = photoPreview;
    if (Object.keys(data).length > 0) saveMutation.mutate(data);
    setStep(3);
  };

  const finishOnboarding = () => {
    saveMutation.mutate({ onboardingComplete: "true" });
    onComplete();
  };

  const skipAll = () => {
    saveMutation.mutate({ onboardingComplete: "true" });
    onComplete();
  };

  const totalSteps = 4;
  const firstName = user?.firstName || "there";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-50 glass-surface safe-top rounded-none">
        <div className="flex items-center gap-2">
          {step > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setStep(step - 1)}
              data-testid="button-onboarding-back"
              className="-ml-1"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <Logo size="sm" />
        </div>
        <button
          onClick={skipAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-skip-onboarding"
        >
          Skip for now
        </button>
      </header>

      <div className="px-4 pt-2">
        <div className="flex gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      <main className="flex-1 flex flex-col px-5 py-8">
        {step === 0 && (
          <div className="flex-1 flex flex-col animate-fade-in-up">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              Welcome, {firstName}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 mb-8">
              Tell us a bit about yourself. Everything here is optional.
            </p>

            <div className="space-y-5 flex-1">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Stage name</label>
                <Input
                  placeholder={user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "Your stage name"}
                  value={stageName}
                  onChange={(e) => setStageName(e.target.value)}
                  data-testid="input-stage-name"
                  className="h-11"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Pronouns</label>
                <ChipSelect options={pronounOptions} value={pronouns} onChange={setPronouns} testIdPrefix="chip-pronouns" />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Age range</label>
                <ChipSelect options={ageRangeOptions} value={ageRange} onChange={setAgeRange} testIdPrefix="chip-age" />
              </div>
            </div>

            <Button onClick={saveStep1} className="w-full h-11 mt-6" data-testid="button-onboarding-next-0">
              Continue
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="flex-1 flex flex-col animate-fade-in-up">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              Your look
            </h1>
            <p className="text-sm text-muted-foreground mt-1 mb-8">
              Casting details for your profile. All optional.
            </p>

            <div className="space-y-5 flex-1">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Height</label>
                <div className="flex gap-2 items-center">
                  <select
                    value={heightFeet}
                    onChange={(e) => setHeightFeet(e.target.value)}
                    className="h-11 px-3 rounded-md border border-border bg-background text-sm text-foreground flex-1"
                    data-testid="select-height-feet"
                  >
                    <option value="">ft</option>
                    {heightFeetOptions.map((f) => (
                      <option key={f} value={f}>{f}'</option>
                    ))}
                  </select>
                  <select
                    value={heightInches}
                    onChange={(e) => setHeightInches(e.target.value)}
                    className="h-11 px-3 rounded-md border border-border bg-background text-sm text-foreground flex-1"
                    data-testid="select-height-inches"
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
                <ChipSelect options={eyeColorOptions} value={eyeColor} onChange={setEyeColor} testIdPrefix="chip-eye" />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Hair color</label>
                <ChipSelect options={hairColorOptions} value={hairColor} onChange={setHairColor} testIdPrefix="chip-hair" />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Location</label>
                <Input
                  placeholder="e.g. Los Angeles, CA"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  data-testid="input-location"
                  className="h-11"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Union status</label>
                <ChipSelect options={unionOptions} value={unionStatus} onChange={setUnionStatus} testIdPrefix="chip-union" />
              </div>
            </div>

            <Button onClick={saveStep2} className="w-full h-11 mt-6" data-testid="button-onboarding-next-1">
              Continue
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="flex-1 flex flex-col animate-fade-in-up">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              Add a headshot
            </h1>
            <p className="text-sm text-muted-foreground mt-1 mb-8">
              A photo for your profile. You can always change it later.
            </p>

            <div className="flex-1 flex flex-col items-center justify-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelect}
                data-testid="input-headshot"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="relative group"
                data-testid="button-upload-headshot"
              >
                <div className="w-32 h-32 rounded-full overflow-hidden bg-muted/50 border-2 border-dashed border-border flex items-center justify-center transition-colors group-hover:border-primary/50">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Headshot" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Camera className="h-8 w-8" />
                      <span className="text-[11px]">Upload photo</span>
                    </div>
                  )}
                </div>
                {photoPreview && (
                  <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg">
                    <Camera className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                )}
              </button>

              <p className="text-[11px] text-muted-foreground/60 mt-4">
                JPG, PNG, or HEIC
              </p>
            </div>

            <Button onClick={saveStep3} className="w-full h-11 mt-6" data-testid="button-onboarding-next-2">
              {photoPreview ? "Continue" : "Skip for now"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="flex-1 flex flex-col animate-fade-in-up">
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <Crown className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                Upgrade to Pro
              </h1>
              <p className="text-sm text-muted-foreground mt-2 max-w-[280px]">
                Get more out of every rehearsal.
              </p>

              <div className="w-full mt-8 space-y-3 text-left max-w-sm">
                {[
                  { icon: Library, text: "Save scripts to your library" },
                  { icon: Video, text: "Record without watermark" },
                  { icon: BarChart3, text: "Track your accuracy over time" },
                  { icon: Sparkles, text: "Priority access to new features" },
                ].map((b) => (
                  <div key={b.text} className="flex items-center gap-3 px-4 py-3 rounded-md glass-surface">
                    <b.icon className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm text-foreground">{b.text}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 w-full max-w-sm mt-8">
                <button
                  className="flex-1 rounded-md border border-primary/30 bg-primary/5 p-4 text-center transition-colors hover:bg-primary/10"
                  data-testid="button-plan-monthly"
                  onClick={() => {}}
                >
                  <p className="text-lg font-semibold text-foreground">$9</p>
                  <p className="text-[11px] text-muted-foreground">per month</p>
                </button>
                <button
                  className="flex-1 rounded-md border-2 border-primary bg-primary/10 p-4 text-center relative transition-colors hover:bg-primary/15"
                  data-testid="button-plan-yearly"
                  onClick={() => {}}
                >
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                    Save 27%
                  </span>
                  <p className="text-lg font-semibold text-foreground">$79</p>
                  <p className="text-[11px] text-muted-foreground">per year</p>
                </button>
              </div>

              <p className="text-[10px] text-muted-foreground/50 mt-3">
                Payment coming soon. You will not be charged.
              </p>
            </div>

            <div className="space-y-2 mt-6">
              <Button
                className="w-full h-11"
                disabled
                data-testid="button-subscribe"
              >
                <Loader2 className="h-4 w-4 mr-2 animate-spin hidden" />
                <Crown className="h-4 w-4 mr-2" />
                Coming soon
              </Button>
              <button
                onClick={finishOnboarding}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
                data-testid="button-maybe-later"
              >
                Maybe later
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

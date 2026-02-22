import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/logo";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  LogIn,
  UserPlus,
  Mic,
  Users,
  Video,
  BarChart3,
  Shield,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";

const benefits = [
  { icon: Mic, text: "Scene partners that read with real emotion" },
  { icon: Users, text: "Run table reads with friends, remotely" },
  { icon: Video, text: "Record self-tapes while you rehearse" },
  { icon: BarChart3, text: "See how your accuracy improves over time" },
  { icon: Shield, text: "Your scripts stay on your device" },
];

export function AuthPage({ onBack }: { onBack: () => void }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const endpoint = mode === "signup" ? "/api/register" : "/api/login";
      const body: Record<string, string> = { email, password };
      if (mode === "signup") {
        body.firstName = firstName;
        body.lastName = lastName;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Something went wrong");
        setIsLoading(false);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      onBack();
    } catch {
      setError("Unable to connect. Please try again.");
      setIsLoading(false);
    }
  };

  const canSubmit = email.trim() && password.trim() && (mode === "signin" || firstName.trim());

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
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm flex flex-col items-center">
          <div className="mb-8 flex flex-col items-center animate-fade-in-up">
            <Logo size="lg" />
            <h1 className="text-2xl font-semibold text-foreground mt-4" data-testid="text-auth-title">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              {mode === "signin" ? "Sign in to your account" : "Get started with co-star"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-3 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
            <div className="w-full glass-surface rounded-md p-6" data-testid="card-auth">
              {mode === "signup" && (
                <div className="flex gap-2 mb-3">
                  <Input
                    type="text"
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    data-testid="input-first-name"
                    autoComplete="given-name"
                    className="h-11"
                  />
                  <Input
                    type="text"
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    data-testid="input-last-name"
                    autoComplete="family-name"
                    className="h-11"
                  />
                </div>
              )}

              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="input-email"
                autoComplete="email"
                className="h-11 mb-3"
              />

              <div className="relative mb-3">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="input-password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground"
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {error && (
                <p className="text-xs text-destructive mb-3" data-testid="text-auth-error">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full h-11"
                size="lg"
                disabled={!canSubmit || isLoading}
                data-testid="button-submit"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === "signin" ? (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign in
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create account
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center pt-1">
              {mode === "signin" ? (
                <>
                  No account?{" "}
                  <button
                    type="button"
                    onClick={() => { setMode("signup"); setError(null); }}
                    className="text-primary hover:underline font-medium"
                    data-testid="button-switch-signup"
                  >
                    Create one
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => { setMode("signin"); setError(null); }}
                    className="text-primary hover:underline font-medium"
                    data-testid="button-switch-signin"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </form>

          <div className="w-full mt-8 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 px-1 mb-3">
              What you get
            </p>
            <div className="space-y-2.5">
              {benefits.map((b, i) => (
                <div key={b.text} className="flex items-center gap-3" data-testid={`text-benefit-${i}`}>
                  <b.icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-xs text-muted-foreground">{b.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 animate-fade-in-up" style={{ animationDelay: "300ms" }}>
            <p className="text-[11px] text-muted-foreground/50 text-center leading-relaxed">
              Save your scripts, keep your history, record without watermarks.
              <br />
              $9/mo or $69/yr.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

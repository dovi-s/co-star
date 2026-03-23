import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo, CoStarSplashAnimation } from "@/components/logo";
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
  Mail,
  ArrowLeft,
  Check,
} from "lucide-react";

const benefits = [
  { icon: Mic, text: "Scene partners that read with real emotion" },
  { icon: Users, text: "Run table reads with friends, remotely" },
  { icon: Video, text: "Record self-tapes while you rehearse" },
  { icon: BarChart3, text: "See how your accuracy improves over time" },
  { icon: Shield, text: "Your scripts stay on your device" },
];

type AuthMode = "signin" | "signup" | "forgot" | "reset";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export function AuthPage({ onBack, onSignUp, initialMode }: { onBack: () => void; onSignUp?: () => void; initialMode?: AuthMode }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<AuthMode>(initialMode || "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("reset-token");
    if (token) {
      setResetToken(token);
      setMode("reset");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/google/client-id")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.clientId) setGoogleClientId(data.clientId); })
      .catch(() => {});
  }, []);

  const handleGoogleCallback = useCallback(async (response: any) => {
    setGoogleLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Google sign-in failed");
        setGoogleLoading(false);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      onBack();
    } catch {
      setError("Google sign-in failed. Please try again.");
      setGoogleLoading(false);
    }
  }, [queryClient, onBack]);

  useEffect(() => {
    if (!googleClientId) return;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      (window as any).google?.accounts?.id?.initialize({
        client_id: googleClientId,
        callback: handleGoogleCallback,
      });
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [googleClientId, handleGoogleCallback]);

  const handleGoogleClick = () => {
    if (!(window as any).google?.accounts?.id) return;
    (window as any).google.accounts.id.prompt();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (mode === "forgot") {
      try {
        await fetch("/api/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        setForgotSent(true);
      } catch {
        setError("Unable to connect. Please try again.");
      }
      setIsLoading(false);
      return;
    }

    if (mode === "reset") {
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        setIsLoading(false);
        return;
      }
      try {
        const res = await fetch("/api/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: resetToken, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || "Something went wrong");
          setIsLoading(false);
          return;
        }
        setResetSuccess(true);
      } catch {
        setError("Unable to connect. Please try again.");
      }
      setIsLoading(false);
      return;
    }

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
      if (mode === "signup" && onSignUp) {
        onSignUp();
      } else {
        onBack();
      }
    } catch {
      setError("Unable to connect. Please try again.");
      setIsLoading(false);
    }
  };

  const canSubmit = (() => {
    if (mode === "forgot") return email.trim().length > 0;
    if (mode === "reset") return password.trim().length >= 6 && confirmPassword.trim().length > 0;
    return email.trim() && password.trim() && (mode === "signin" || firstName.trim());
  })();

  const title = (() => {
    if (mode === "forgot") return forgotSent ? "Check your email" : "Forgot password";
    if (mode === "reset") return resetSuccess ? "Password reset" : "Set new password";
    if (mode === "signup") return "Create your account";
    return "Welcome back";
  })();

  const subtitle = (() => {
    if (mode === "forgot") return forgotSent ? `We sent a reset link to ${email}` : "Enter your email and we will send you a reset link";
    if (mode === "reset") return resetSuccess ? "Your password has been updated" : "Choose a new password for your account";
    if (mode === "signup") return "Get started with Co-star Studio";
    return "Sign in to your account";
  })();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 sticky top-0 z-50 glass-surface safe-top rounded-none">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Go back"
          onClick={mode === "forgot" || mode === "reset" ? () => { setMode("signin"); setError(null); setForgotSent(false); setResetSuccess(false); } : onBack}
          data-testid="button-back"
          className="shrink-0 -ml-1"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm flex flex-col items-center">
          <div className="mb-8 flex flex-col items-center">
            <div className="animate-scale-in">
              <CoStarSplashAnimation iconSize={72} showReplay={false} />
            </div>
            <h1 className="text-2xl font-semibold text-foreground mt-4 animate-fade-in-up" style={{ animationDelay: "100ms" }} data-testid="text-auth-title">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 text-center animate-fade-in-up" style={{ animationDelay: "200ms" }}>
              {subtitle}
            </p>
          </div>

          {mode === "forgot" && forgotSent ? (
            <div className="w-full space-y-4 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
              <div className="w-full glass-surface rounded-lg p-6 flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  If an account exists with that email, you will receive a link to reset your password. Check your spam folder if you do not see it.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full h-11"
                onClick={() => { setMode("signin"); setError(null); setForgotSent(false); }}
                data-testid="button-back-to-signin"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to sign in
              </Button>
            </div>
          ) : mode === "reset" && resetSuccess ? (
            <div className="w-full space-y-4 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
              <div className="w-full glass-surface rounded-lg p-6 flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  You can now sign in with your new password.
                </p>
              </div>
              <Button
                className="w-full h-11"
                onClick={() => { setMode("signin"); setError(null); setResetSuccess(false); setPassword(""); setConfirmPassword(""); }}
                data-testid="button-goto-signin"
              >
                <LogIn className="h-4 w-4 mr-2" />
                Sign in
              </Button>
            </div>
          ) : (
            <>
              {(mode === "signin" || mode === "signup") && googleClientId && (
                <div className="w-full mb-4 animate-fade-in-up" style={{ animationDelay: "250ms" }}>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 gap-3 font-medium"
                    onClick={handleGoogleClick}
                    disabled={googleLoading}
                    data-testid="button-google-signin"
                  >
                    {googleLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <GoogleIcon className="h-4 w-4" />
                        Continue with Google
                      </>
                    )}
                  </Button>

                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">or</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="w-full space-y-3 animate-fade-in-up" style={{ animationDelay: "300ms" }}>
                <div className="w-full glass-surface rounded-lg p-6" data-testid="card-auth">
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

                  {mode !== "reset" && (
                    <Input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="input-email"
                      autoComplete="email"
                      className="h-11 mb-3"
                    />
                  )}

                  {(mode === "signin" || mode === "signup") && (
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
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                        data-testid="button-toggle-password"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  )}

                  {mode === "reset" && (
                    <>
                      <div className="relative mb-3">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="New password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          data-testid="input-new-password"
                          autoComplete="new-password"
                          className="h-11 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        data-testid="input-confirm-password"
                        autoComplete="new-password"
                        className="h-11 mb-3"
                      />
                    </>
                  )}

                  {mode === "signin" && (
                    <div className="flex justify-end mb-3">
                      <button
                        type="button"
                        onClick={() => { setMode("forgot"); setError(null); }}
                        className="text-xs text-primary hover:underline"
                        data-testid="button-forgot-password"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}

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
                    ) : mode === "signup" ? (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Create account
                      </>
                    ) : mode === "forgot" ? (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                        Send reset link
                      </>
                    ) : (
                      "Reset password"
                    )}
                  </Button>
                </div>

                {(mode === "signin" || mode === "signup") && (
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
                )}

                {mode === "forgot" && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    <button
                      type="button"
                      onClick={() => { setMode("signin"); setError(null); }}
                      className="text-primary hover:underline font-medium"
                      data-testid="button-back-to-signin"
                    >
                      Back to sign in
                    </button>
                  </p>
                )}
              </form>
            </>
          )}

          {(mode === "signin" || mode === "signup") && (
            <>
              <div className="w-full mt-8 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-1 mb-3">
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
                <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                  Save your scripts, keep your history, record without watermarks.
                  <br />
                  $9/mo or $79/yr.
                </p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

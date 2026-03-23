import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Logo } from "@/components/logo";
import { useQueryClient } from "@tanstack/react-query";
import {
  LogIn,
  UserPlus,
  Loader2,
  Eye,
  EyeOff,
  Mail,
  ArrowLeft,
  Check,
  X,
} from "lucide-react";

type AuthMode = "signin" | "signup" | "forgot";

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

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AuthModal({ open, onOpenChange, onSuccess }: AuthModalProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setError(null);
      setIsLoading(false);
      setGoogleLoading(false);
      setForgotSent(false);
    } else {
      setMode("signup");
      setEmail("");
      setPassword("");
      setFirstName("");
      setLastName("");
      setShowPassword(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/auth/google/client-id")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.clientId) setGoogleClientId(data.clientId); })
      .catch(() => {});
  }, [open]);

  const handleAuthSuccess = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    onOpenChange(false);
    onSuccess();
  }, [queryClient, onOpenChange, onSuccess]);

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
      await handleAuthSuccess();
    } catch {
      setError("Google sign-in failed. Please try again.");
      setGoogleLoading(false);
    }
  }, [handleAuthSuccess]);

  useEffect(() => {
    if (!googleClientId || !open) return;

    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    
    const initGoogle = () => {
      (window as any).google?.accounts?.id?.initialize({
        client_id: googleClientId,
        callback: handleGoogleCallback,
      });
    };

    if (existingScript && (window as any).google?.accounts?.id) {
      initGoogle();
      return;
    }

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      document.head.appendChild(script);
    }
  }, [googleClientId, handleGoogleCallback, open]);

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

      await handleAuthSuccess();
    } catch {
      setError("Unable to connect. Please try again.");
      setIsLoading(false);
    }
  };

  const canSubmit = (() => {
    if (mode === "forgot") return email.trim().length > 0;
    return email.trim() && password.trim() && (mode === "signin" || firstName.trim());
  })();

  const title = (() => {
    if (mode === "forgot") return forgotSent ? "Check your email" : "Forgot password";
    if (mode === "signup") return "Create your account";
    return "Welcome back";
  })();

  const subtitle = (() => {
    if (mode === "forgot") return forgotSent ? `We sent a reset link to ${email}` : "Enter your email and we will send you a reset link";
    if (mode === "signup") return "Sign up to continue rehearsing";
    return "Sign in to continue rehearsing";
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-surface-heavy rounded-xl max-w-[380px] p-0 gap-0 border-border/50 [&>button]:hidden" data-testid="dialog-auth-modal">
        <div className="flex items-center justify-between px-5 pt-5">
          {mode === "forgot" ? (
            <button
              type="button"
              onClick={() => { setMode("signin"); setError(null); setForgotSent(false); }}
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-modal-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-modal-close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 pb-6 pt-2">
          <div className="flex flex-col items-center mb-5">
            <Logo size="sm" animated={false} />
            <h2 className="text-lg font-semibold text-foreground mt-3" data-testid="text-modal-title">
              {title}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 text-center">
              {subtitle}
            </p>
          </div>

          {mode === "forgot" && forgotSent ? (
            <div className="space-y-4">
              <div className="glass-surface rounded-lg p-5 flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  If an account exists with that email, you will receive a link to reset your password.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full h-10 text-sm"
                onClick={() => { setMode("signin"); setError(null); setForgotSent(false); }}
                data-testid="button-modal-back-signin"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-2" />
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              {(mode === "signin" || mode === "signup") && googleClientId && (
                <div className="mb-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-10 gap-2.5 text-sm font-medium"
                    onClick={handleGoogleClick}
                    disabled={googleLoading}
                    data-testid="button-modal-google"
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

                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-border/60" />
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider">or</span>
                    <div className="flex-1 h-px bg-border/60" />
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                {mode === "signup" && (
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="First name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      data-testid="input-modal-first-name"
                      autoComplete="given-name"
                      className="h-10 text-sm"
                    />
                    <Input
                      type="text"
                      placeholder="Last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      data-testid="input-modal-last-name"
                      autoComplete="family-name"
                      className="h-10 text-sm"
                    />
                  </div>
                )}

                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="input-modal-email"
                  autoComplete="email"
                  className="h-10 text-sm"
                />

                {(mode === "signin" || mode === "signup") && (
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      data-testid="input-modal-password"
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      className="h-10 text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                      data-testid="button-modal-toggle-password"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                )}

                {mode === "signin" && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => { setMode("forgot"); setError(null); }}
                      className="text-[11px] text-primary hover:underline"
                      data-testid="button-modal-forgot"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {error && (
                  <p className="text-xs text-destructive" data-testid="text-modal-error">{error}</p>
                )}

                <Button
                  type="submit"
                  className="w-full h-10 text-sm"
                  disabled={!canSubmit || isLoading}
                  data-testid="button-modal-submit"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : mode === "signin" ? (
                    <>
                      <LogIn className="h-3.5 w-3.5 mr-2" />
                      Sign in
                    </>
                  ) : mode === "signup" ? (
                    <>
                      <UserPlus className="h-3.5 w-3.5 mr-2" />
                      Create account
                    </>
                  ) : (
                    <>
                      <Mail className="h-3.5 w-3.5 mr-2" />
                      Send reset link
                    </>
                  )}
                </Button>

                {(mode === "signin" || mode === "signup") && (
                  <p className="text-[11px] text-muted-foreground text-center pt-0.5">
                    {mode === "signin" ? (
                      <>
                        No account?{" "}
                        <button
                          type="button"
                          onClick={() => { setMode("signup"); setError(null); }}
                          className="text-primary hover:underline font-medium"
                          data-testid="button-modal-switch-signup"
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
                          data-testid="button-modal-switch-signin"
                        >
                          Sign in
                        </button>
                      </>
                    )}
                  </p>
                )}

                {mode === "forgot" && !forgotSent && (
                  <p className="text-[11px] text-muted-foreground text-center pt-0.5">
                    <button
                      type="button"
                      onClick={() => { setMode("signin"); setError(null); }}
                      className="text-primary hover:underline font-medium"
                      data-testid="button-modal-back-signin"
                    >
                      Back to sign in
                    </button>
                  </p>
                )}
              </form>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

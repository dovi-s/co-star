import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import {
  ChevronLeft,
  LogIn,
  Mic,
  Users,
  Video,
  BarChart3,
  Shield,
} from "lucide-react";

const benefits = [
  { icon: Mic, text: "AI voices that read with emotion" },
  { icon: Users, text: "Multiplayer table reads" },
  { icon: Video, text: "Self-tape recording" },
  { icon: BarChart3, text: "Performance tracking" },
  { icon: Shield, text: "Scripts stay on your device" },
];

export function AuthPage({ onBack }: { onBack: () => void }) {
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
              Welcome to co-star
            </h1>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              Your AI rehearsal partner
            </p>
          </div>

          <div className="w-full glass-surface rounded-md p-6 mb-6 animate-fade-in-up" style={{ animationDelay: "100ms" }} data-testid="card-auth">
            <a href="/api/login" className="block w-full">
              <Button
                className="w-full h-11"
                size="lg"
                data-testid="button-sign-in"
              >
                <LogIn className="h-4 w-4 mr-2" />
                Sign in
              </Button>
            </a>
            <p className="text-[11px] text-muted-foreground text-center mt-3 leading-relaxed">
              Sign in with Google, GitHub, Apple, or email.
              <br />
              No separate signup needed.
            </p>
          </div>

          <div className="w-full animate-fade-in-up" style={{ animationDelay: "200ms" }}>
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
              Free to use. No credit card required.
              <br />
              Upgrade to Pro anytime for $9/mo.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

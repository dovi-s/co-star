import { Button } from "@/components/ui/button";
import { ChevronLeft, FileText, Users, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  {
    number: 1,
    title: "Paste your script",
    description: "Paste or upload your script in any format — plain text, PDF, or even a photo. We'll parse it automatically.",
    icon: FileText,
  },
  {
    number: 2,
    title: "Pick your role",
    description: "Select your character from the cast list. The AI reads every other part so you can focus on yours.",
    icon: Users,
  },
  {
    number: 3,
    title: "Start rehearsing",
    description: "Run your scene with intelligent AI scene partners that respond with realistic timing and emotion.",
    icon: Play,
  },
];

export function HowItWorksPage({ onBack }: { onBack: () => void }) {
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
        <h1 className="font-semibold text-sm text-foreground">How It Works</h1>
      </header>

      <main className="flex-1 px-5 py-8">
        <div className="max-w-lg mx-auto space-y-6">
          {steps.map((step, i) => (
            <div
              key={step.number}
              className={cn(
                "glass-surface rounded-md p-5 animate-fade-in-up",
              )}
              style={{ animationDelay: `${i * 150}ms` }}
              data-testid={`card-step-${step.number}`}
            >
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                    {step.number}
                  </span>
                  <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10 text-primary">
                    <step.icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="min-w-0 pt-0.5">
                  <h2 className="text-lg font-medium text-foreground">{step.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{step.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="px-5 py-8 text-center safe-bottom">
        <p className="text-lg font-medium text-foreground mb-3">Ready to start?</p>
        <Button
          onClick={onBack}
          data-testid="button-get-started"
        >
          Get Started
        </Button>
      </footer>
    </div>
  );
}

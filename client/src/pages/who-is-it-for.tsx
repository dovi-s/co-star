import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  Drama,
  GraduationCap,
  Mic2,
  Video,
  Globe,
  Presentation,
  BookOpen,
  TrendingUp,
  Stethoscope,
  Scale,
  HeartHandshake,
  Headset,
  Church,
} from "lucide-react";

interface Persona {
  title: string;
  description: string;
  points: string[];
  icon: typeof Drama;
}

const primaryPersonas: Persona[] = [
  {
    title: "Professional actors",
    description: "Run lines on your own schedule with a scene partner that never cancels. Prepare for auditions, callbacks, and rehearsals.",
    points: [
      "Practice cold reads and memorization",
      "Record self-tapes with audition mode",
      "Track accuracy across multiple runs",
    ],
    icon: Drama,
  },
  {
    title: "Acting students",
    description: "Rehearse assigned scenes outside class without needing to coordinate with classmates. Build confidence before workshop day.",
    points: [
      "Work through monologues and duologues",
      "Prepare for scene study and showcases",
      "Four memorization levels from full script to memory",
    ],
    icon: GraduationCap,
  },
  {
    title: "Voice actors and narrators",
    description: "Practice timing, delivery, and character switches with scripts in any format. Fine-tune your reads before the session.",
    points: [
      "Work with dialogue-heavy scripts",
      "Adjust pacing with voice presets",
      "Audio-only recording for practice takes",
    ],
    icon: Mic2,
  },
  {
    title: "Audition preppers",
    description: "Rehearse sides quickly and record polished self-tapes. Camera mode captures clean video while you read from the script.",
    points: [
      "Import sides from PDF or photo",
      "Front camera with clean recording frame",
      "Multiple takes with performance feedback",
    ],
    icon: Video,
  },
];

const expandingPersonas: Persona[] = [
  {
    title: "Language learners",
    description: "Practice real conversations in your target language. Structured dialogue gives you natural patterns and pacing to work with.",
    points: [
      "Rehearse scripted dialogues aloud",
      "Speech recognition checks your delivery",
      "Repeat lines until they feel natural",
    ],
    icon: Globe,
  },
  {
    title: "Public speakers",
    description: "Rehearse presentations, pitches, and keynotes with pacing feedback. Practice until your delivery is second nature.",
    points: [
      "Import your talk as a script",
      "Track timing and word accuracy",
      "Hands-free mode for standing practice",
    ],
    icon: Presentation,
  },
  {
    title: "Teachers and trainers",
    description: "Prepare for difficult conversations, classroom simulations, and role-play exercises. Practice your delivery before the real thing.",
    points: [
      "Simulate parent-teacher conferences",
      "Run classroom management scenarios",
      "Practice delivering sensitive topics",
    ],
    icon: BookOpen,
  },
  {
    title: "Sales teams",
    description: "Role-play sales calls, objection handling, and product demos. Build muscle memory for high-pressure conversations.",
    points: [
      "Practice cold calls and discovery meetings",
      "Run through objection-handling scripts",
      "Team table reads for group training",
    ],
    icon: TrendingUp,
  },
];

const emergingPersonas: Persona[] = [
  {
    title: "Medical students",
    description: "Rehearse standardized patient encounters and clinical interviews before your OSCE or practical exam.",
    points: [
      "Practice patient history-taking scripts",
      "Build confidence with difficult diagnoses",
    ],
    icon: Stethoscope,
  },
  {
    title: "Law students",
    description: "Prepare for moot court, witness examinations, and oral arguments. Practice your delivery until it is sharp.",
    points: [
      "Rehearse opening and closing statements",
      "Run through cross-examination scripts",
    ],
    icon: Scale,
  },
  {
    title: "Therapists in training",
    description: "Practice motivational interviewing, active listening prompts, and handling difficult client scenarios.",
    points: [
      "Role-play intake sessions",
      "Build comfort with therapeutic scripts",
    ],
    icon: HeartHandshake,
  },
  {
    title: "Customer service teams",
    description: "Train de-escalation techniques and complaint handling with scripted scenarios your team can practice anytime.",
    points: [
      "Practice difficult customer interactions",
      "Standardize responses across the team",
    ],
    icon: Headset,
  },
  {
    title: "Clergy and speakers",
    description: "Rehearse sermons, liturgical readings, and ceremonial scripts. Practice projection and pacing on your own time.",
    points: [
      "Run through readings and homilies",
      "Hands-free mode for pulpit practice",
    ],
    icon: Church,
  },
];

function PersonaCard({ persona, index }: { persona: Persona; index: number }) {
  const Icon = persona.icon;
  return (
    <div
      className="glass-surface rounded-md p-4 animate-fade-in-up"
      style={{ animationDelay: `${(index + 1) * 80}ms` }}
      data-testid={`card-persona-${persona.title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground mb-0.5" data-testid={`text-persona-title-${index}`}>
            {persona.title}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-2.5" data-testid={`text-persona-desc-${index}`}>
            {persona.description}
          </p>
          <div className="space-y-1.5">
            {persona.points.map((point) => (
              <div key={point} className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                <span className="text-[11px] text-muted-foreground leading-relaxed">{point}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonaSection({ title, subtitle, personas, startIndex }: { title: string; subtitle: string; personas: Persona[]; startIndex: number }) {
  const sectionId = title.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-3" data-testid={`section-${sectionId}`}>
      <div>
        <h2 className="text-base font-semibold text-foreground" data-testid={`text-section-title-${sectionId}`}>{title}</h2>
        <p className="text-xs text-muted-foreground" data-testid={`text-section-subtitle-${sectionId}`}>{subtitle}</p>
      </div>
      <div className="space-y-3">
        {personas.map((persona, i) => (
          <PersonaCard key={persona.title} persona={persona} index={startIndex + i} />
        ))}
      </div>
    </div>
  );
}

export function WhoIsItForPage({ onBack }: { onBack: () => void }) {
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
        <h1 className="font-semibold text-sm text-foreground">Who Is It For</h1>
      </header>

      <main className="flex-1 px-4 py-8">
        <div className="max-w-lg mx-auto">
          <div className="mb-8 animate-fade-in-up">
            <h2 className="text-xl font-semibold text-foreground mb-1">Built for anyone who rehearses</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Actors use it to run lines. But any profession that relies on scripted dialogue, role-play, or verbal preparation can benefit from a scene partner on demand.
            </p>
          </div>

          <div className="space-y-10">
            <PersonaSection
              title="Performers"
              subtitle="The core audience"
              personas={primaryPersonas}
              startIndex={0}
            />

            <PersonaSection
              title="Professionals"
              subtitle="Expanding use cases"
              personas={expandingPersonas}
              startIndex={primaryPersonas.length}
            />

            <PersonaSection
              title="Specialized training"
              subtitle="Emerging applications"
              personas={emergingPersonas}
              startIndex={primaryPersonas.length + expandingPersonas.length}
            />
          </div>
        </div>
      </main>

      <footer className="px-5 py-8 text-center safe-bottom">
        <p className="text-lg font-medium text-foreground mb-1">See how it works</p>
        <p className="text-xs text-muted-foreground mb-4">From script to stage-ready in six steps.</p>
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

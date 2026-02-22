import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  FileText,
  Users,
  Play,
  Video,
  BarChart3,
  Wifi,
} from "lucide-react";
import featureImport from "@/assets/images/feature-import.png";
import featureRoles from "@/assets/images/feature-roles.png";
import featureRehearse from "@/assets/images/feature-rehearse.png";
import featureTableread from "@/assets/images/feature-tableread.png";
import featureRecording from "@/assets/images/feature-recording.png";
import featureFeedback from "@/assets/images/feature-feedback.png";

interface FeatureSection {
  number: number;
  title: string;
  subtitle: string;
  description: string;
  details: string[];
  icon: typeof FileText;
  image: string;
}

const sections: FeatureSection[] = [
  {
    number: 1,
    title: "Import your script",
    subtitle: "Any format, any source",
    description: "Paste text, upload a PDF or TXT file, or snap a photo of a printed page. The parser handles it all.",
    details: [
      "Automatic character and scene detection",
      "Stage directions and action lines preserved",
      "OCR for scanned and image-based PDFs",
      "Camera scanner for physical scripts",
    ],
    icon: FileText,
    image: featureImport,
  },
  {
    number: 2,
    title: "Pick your role",
    subtitle: "Smart casting for the rest",
    description: "Select which character you want to play. co-star automatically assigns distinct voices to every other part.",
    details: [
      "Line counts shown per character",
      "Six ElevenLabs voices with emotion detection",
      "SSML prosody for natural pacing and tone",
      "Voice presets: Natural, Deadpan, Theatrical",
    ],
    icon: Users,
    image: featureRoles,
  },
  {
    number: 3,
    title: "Rehearse your scene",
    subtitle: "The three-line reader",
    description: "See previous, current, and next lines at a glance. Your turn is highlighted. co-star listens and responds with realistic timing.",
    details: [
      "Speech recognition waits for your lines",
      "Natural pauses adapt to scene tension",
      "Context peek for stage directions",
      "Scene transition cards between acts",
    ],
    icon: Play,
    image: featureRehearse,
  },
  {
    number: 4,
    title: "Read with others",
    subtitle: "Multiplayer table reads",
    description: "Create a room, share a code, and rehearse together in real time. Peer-to-peer video calls keep everyone connected.",
    details: [
      "WebRTC video and audio calls",
      "Host controls for start, pause, navigation",
      "Each actor picks their own role",
      "Current speaker highlighting",
    ],
    icon: Wifi,
    image: featureTableread,
  },
  {
    number: 5,
    title: "Record your performance",
    subtitle: "Self-tape and audition mode",
    description: "Record with your front camera for self-tapes, or go audio-only for practice runs. Audition mode dims the UI so the camera captures a clean frame.",
    details: [
      "Picture-in-picture camera overlay",
      "Audio-only mode when camera is off",
      "Audition mode with dark translucent UI",
      "Watermark-free recordings with Pro",
    ],
    icon: Video,
    image: featureRecording,
  },
  {
    number: 6,
    title: "Track your progress",
    subtitle: "Feedback and memorization",
    description: "After each run, see your word accuracy, skipped lines, and an overall score. Use memorization modes to gradually wean off the script.",
    details: [
      "Accuracy percentage with color-coded results",
      "Four levels: Full, Partial, Cue, Memory",
      "Bookmarks to return to tricky lines",
      "Run history and streak tracking",
    ],
    icon: BarChart3,
    image: featureFeedback,
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

      <main className="flex-1 px-4 py-8">
        <div className="max-w-lg mx-auto">
          <div className="mb-8 animate-fade-in-up">
            <h2 className="text-xl font-semibold text-foreground mb-1">Your scene partner, on demand</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              From script to stage-ready in six steps. No signup required.
            </p>
          </div>

          <div className="space-y-6">
            {sections.map((section, i) => (
              <div
                key={section.number}
                className="glass-surface rounded-md overflow-hidden animate-fade-in-up"
                style={{ animationDelay: `${(i + 1) * 100}ms` }}
                data-testid={`card-step-${section.number}`}
              >
                <div className="relative w-full aspect-[16/9] overflow-hidden bg-muted/30">
                  <img
                    src={section.image}
                    alt={section.title}
                    className="w-full h-full object-cover"
                    loading={i < 2 ? "eager" : "lazy"}
                    data-testid={`img-step-${section.number}`}
                  />
                  <div className="absolute top-3 left-3">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-md">
                      {section.number}
                    </span>
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <section.icon className="h-4 w-4 text-primary shrink-0" />
                    <h3 className="text-sm font-semibold text-foreground" data-testid={`text-step-title-${section.number}`}>{section.title}</h3>
                  </div>
                  <p className="text-[11px] text-primary/70 font-medium mb-2" data-testid={`text-step-subtitle-${section.number}`}>{section.subtitle}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3" data-testid={`text-step-desc-${section.number}`}>{section.description}</p>

                  <div className="space-y-1.5">
                    {section.details.map((detail) => (
                      <div key={detail} className="flex items-start gap-2">
                        <span className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                        <span className="text-[11px] text-muted-foreground leading-relaxed">{detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="px-5 py-8 text-center safe-bottom">
        <p className="text-lg font-medium text-foreground mb-1">Ready to start?</p>
        <p className="text-xs text-muted-foreground mb-4">No account required. Jump right in.</p>
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

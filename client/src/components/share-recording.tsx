import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Copy, Check, Download, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { trackFeature } from "@/hooks/use-analytics";

interface ShareRecordingProps {
  scriptName: string;
  accuracy?: string;
  linesRehearsed?: number;
  recordingUrl?: string;
  className?: string;
}

export function ShareRecordingCard({ scriptName, accuracy, linesRehearsed, recordingUrl, className }: ShareRecordingProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const shareText = [
    `Just rehearsed "${scriptName}" on Co-star Studio`,
    accuracy ? `Accuracy: ${accuracy}%` : null,
    linesRehearsed ? `${linesRehearsed} lines rehearsed` : null,
    "",
    "Rehearsed with Co-star Studio — the scene partner that never flakes.",
    window.location.origin,
  ].filter(Boolean).join("\n");

  const handleShare = async () => {
    trackFeature("share_recording", "shared", { scriptName, accuracy });
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${scriptName} — Rehearsal Session`,
          text: shareText,
          url: window.location.origin,
        });
        return;
      } catch {}
    }
    handleCopy();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      trackFeature("share_recording", "copied");
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied to clipboard!" });
    } catch {
      toast({ title: "Couldn't copy", variant: "destructive" });
    }
  };

  return (
    <div className={cn("rounded-lg border border-border/50 bg-card overflow-hidden", className)} data-testid="share-recording-card">
      <div className="p-3 bg-gradient-to-r from-primary/5 to-primary/10">
        <p className="text-xs text-muted-foreground mb-0.5">Share your rehearsal</p>
        <p className="text-sm font-semibold text-foreground">{scriptName}</p>
        <div className="flex gap-3 mt-1.5">
          {accuracy && <span className="text-xs text-primary font-medium">{accuracy}% accuracy</span>}
          {linesRehearsed && <span className="text-xs text-muted-foreground">{linesRehearsed} lines</span>}
        </div>
      </div>

      <div className="p-2 flex gap-1.5">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={handleShare} data-testid="share-recording-share">
          <Share2 className="w-3 h-3 mr-1" />
          Share
        </Button>
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={handleCopy} data-testid="share-recording-copy">
          {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>

      <div className="px-3 pb-2">
        <p className="text-[9px] text-muted-foreground/50 text-center">Rehearsed with Co-star Studio</p>
      </div>
    </div>
  );
}

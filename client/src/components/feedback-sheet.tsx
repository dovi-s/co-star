import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSessionContext } from "@/context/session-context";
import { useAuth } from "@/hooks/use-auth";
import { Send, Paperclip, X, Check, ChevronDown, ChevronUp, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedbackSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackSheet({ open, onOpenChange }: FeedbackSheetProps) {
  const { session, lastRawScript } = useSessionContext();
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [whereItHappened, setWhereItHappened] = useState("");
  const [includeScript, setIncludeScript] = useState(false);
  const [sent, setSent] = useState(false);

  const currentLine = session
    ? session.scenes[session.currentSceneIndex]?.lines[session.currentLineIndex]
    : null;

  const hasScript = Boolean(lastRawScript || (session && session.scenes.length > 0));

  const getScriptSummary = (): string => {
    if (!lastRawScript && (!session || session.scenes.length === 0)) return "";
    if (lastRawScript) {
      const lines = lastRawScript.split("\n");
      if (lines.length > 10) {
        return lines.slice(0, 10).join("\n") + `\n... (${lines.length} lines total)`;
      }
      return lastRawScript;
    }
    const sceneName = session?.scenes[session!.currentSceneIndex]?.name || "";
    const role = currentLine ? session?.roles.find(r => r.id === currentLine.roleId) : null;
    return [
      session?.name ? `Script: ${session.name}` : "",
      sceneName ? `Scene: ${sceneName}` : "",
      currentLine ? `Current line ${session!.currentLineIndex + 1}: ${role?.name || "Unknown"}: ${currentLine.text}` : "",
      currentLine?.context ? `Context: ${currentLine.context}` : "",
    ].filter(Boolean).join("\n");
  };

  const handleSend = () => {
    const parts = [message];
    if (whereItHappened.trim()) {
      parts.push(`\n--- Where it happened ---\n${whereItHappened}`);
    }
    if (includeScript && hasScript) {
      const scriptData = lastRawScript || getScriptSummary();
      parts.push(`\n--- Script data ---\n${scriptData}`);
    }
    const fullMessage = parts.join("\n");

    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "bug",
        subject: "Bug report",
        message: fullMessage,
        attachmentData: includeScript ? (lastRawScript || getScriptSummary()) : null,
        contactEmail: email.trim() || null,
        path: window.location.pathname,
      }),
      credentials: "include",
    }).catch(() => {});

    const subject = encodeURIComponent("Co-star Studio bug report");
    const body = encodeURIComponent(fullMessage);
    window.open(`mailto:support@co-star.app?subject=${subject}&body=${body}`, "_blank");

    setSent(true);
    setTimeout(() => {
      setSent(false);
      setMessage("");
      setEmail("");
      setWhereItHappened("");
      setIncludeScript(false);
      setShowDetails(false);
      onOpenChange(false);
    }, 1500);
  };

  const handleClose = () => {
    setMessage("");
    setEmail("");
    setWhereItHappened("");
    setIncludeScript(false);
    setShowDetails(false);
    setSent(false);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-xl max-h-[85vh] flex flex-col">
        <SheetHeader className="text-left pb-2">
          <SheetTitle className="text-base font-semibold">Report an Issue</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Something not working right? Tell us what happened.
          </SheetDescription>
        </SheetHeader>

        {sent ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm text-foreground font-medium">Report sent</p>
            <p className="text-xs text-muted-foreground">Your email app should open shortly.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
            <Textarea
              placeholder="What happened?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[100px] resize-none text-sm"
              data-testid="input-feedback-message"
            />

            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium w-fit"
              data-testid="button-toggle-details"
            >
              {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Add details (optional)
            </button>

            {showDetails && (
              <div className="space-y-3 pl-0.5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Where did it happen?
                  </label>
                  <Input
                    placeholder='e.g. "During playback", "Importing a script"'
                    value={whereItHappened}
                    onChange={(e) => setWhereItHappened(e.target.value)}
                    className="text-sm h-9"
                    data-testid="input-where-happened"
                  />
                </div>

                {hasScript && (
                  <button
                    type="button"
                    onClick={() => setIncludeScript(!includeScript)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border w-fit",
                      includeScript
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "border-border text-muted-foreground"
                    )}
                    data-testid="button-attach-script"
                  >
                    <Paperclip className="h-3 w-3" />
                    Include my script
                    {includeScript && <X className="h-3 w-3 ml-1" />}
                  </button>
                )}

                {includeScript && hasScript && (
                  <div className="p-3 rounded-md bg-muted/50 border border-border/50">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                      Preview
                    </p>
                    <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap break-words font-mono max-h-[80px] overflow-y-auto leading-relaxed">
                      {getScriptSummary()}
                    </pre>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    Email (if you want us to follow up)
                  </label>
                  <Input
                    type="email"
                    placeholder={user?.email || "your@email.com"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="text-sm h-9"
                    data-testid="input-contact-email"
                  />
                </div>
              </div>
            )}

            <Button
              onClick={handleSend}
              disabled={!message.trim()}
              className="w-full"
              data-testid="button-send-feedback"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Send report
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

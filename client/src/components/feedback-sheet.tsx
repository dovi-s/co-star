import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSessionContext } from "@/context/session-context";
import { Send, Paperclip, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedbackSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AttachmentType = "none" | "full-script" | "current-line";

export function FeedbackSheet({ open, onOpenChange }: FeedbackSheetProps) {
  const { session, lastRawScript } = useSessionContext();
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<AttachmentType>("none");
  const [sent, setSent] = useState(false);

  const currentLine = session
    ? session.scenes[session.currentSceneIndex]?.lines[session.currentLineIndex]
    : null;

  const hasScript = Boolean(lastRawScript || (session && session.scenes.length > 0));
  const hasCurrentLine = Boolean(currentLine);

  const getAttachmentPreview = (): string => {
    if (attachment === "full-script" && lastRawScript) {
      const lines = lastRawScript.split("\n");
      if (lines.length > 10) {
        return lines.slice(0, 10).join("\n") + `\n... (${lines.length} lines total)`;
      }
      return lastRawScript;
    }
    if (attachment === "current-line" && currentLine) {
      const role = session?.roles.find(r => r.id === currentLine.roleId);
      const sceneName = session?.scenes[session.currentSceneIndex]?.name || "";
      return [
        sceneName ? `Scene: ${sceneName}` : "",
        `Line ${session!.currentLineIndex + 1}: ${role?.name || "Unknown"}: ${currentLine.text}`,
        currentLine.context ? `Context: ${currentLine.context}` : "",
      ].filter(Boolean).join("\n");
    }
    return "";
  };

  const handleSend = () => {
    const attachmentText = getAttachmentPreview();
    const fullMessage = attachmentText
      ? `${message}\n\n--- Attached script data ---\n${attachment === "full-script" ? lastRawScript : attachmentText}`
      : message;

    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "bug",
        subject: "Bug report",
        message: fullMessage,
        attachmentData: attachmentText || null,
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
      setAttachment("none");
      onOpenChange(false);
    }, 1500);
  };

  const handleClose = () => {
    setMessage("");
    setAttachment("none");
    setSent(false);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-xl max-h-[85vh] flex flex-col">
        <SheetHeader className="text-left pb-2">
          <SheetTitle className="text-base font-semibold">Report an Issue</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Something not working right? Describe what happened and we will look into it. You can optionally include your script for context.
          </SheetDescription>
        </SheetHeader>

        {sent ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm text-foreground font-medium">Message ready</p>
            <p className="text-xs text-muted-foreground">Your email app should open shortly.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
            <Textarea
              placeholder="What happened? The more detail, the better we can help."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px] resize-none text-sm"
              data-testid="input-feedback-message"
            />

            {hasScript && (
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Include for context (optional)
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setAttachment(attachment === "full-script" ? "none" : "full-script")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border",
                      attachment === "full-script"
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "border-border text-muted-foreground"
                    )}
                    data-testid="button-attach-script"
                  >
                    <Paperclip className="h-3 w-3" />
                    Full script
                    {attachment === "full-script" && <X className="h-3 w-3 ml-1" />}
                  </button>
                  {hasCurrentLine && (
                    <button
                      onClick={() => setAttachment(attachment === "current-line" ? "none" : "current-line")}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border",
                        attachment === "current-line"
                          ? "bg-primary/10 border-primary/30 text-primary"
                          : "border-border text-muted-foreground"
                      )}
                      data-testid="button-attach-line"
                    >
                      <Paperclip className="h-3 w-3" />
                      Current line
                      {attachment === "current-line" && <X className="h-3 w-3 ml-1" />}
                    </button>
                  )}
                </div>

                {attachment !== "none" && (
                  <div className="p-3 rounded-md bg-muted/50 border border-border/50">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                      Preview
                    </p>
                    <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap break-words font-mono max-h-[120px] overflow-y-auto leading-relaxed">
                      {getAttachmentPreview()}
                    </pre>
                  </div>
                )}
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

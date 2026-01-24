import { useState, useRef } from "react";
import { Upload, FileText, Clipboard, X, Loader2, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ScriptImportProps {
  onImport: (name: string, rawScript: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function ScriptImport({ onImport, isLoading, error }: ScriptImportProps) {
  const [name, setName] = useState("");
  const [script, setScript] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pasteSuccess, setPasteSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePaste = async () => {
    setPasteError(null);
    setPasteSuccess(false);
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setScript(text);
        setPasteSuccess(true);
        setTimeout(() => setPasteSuccess(false), 2000);
      } else {
        setPasteError("Clipboard is empty");
      }
    } catch (e) {
      setPasteError("Tap in the text area and use Ctrl+V or Cmd+V to paste");
    }
  };

  const handleFileSelect = async (file: File) => {
    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      const text = await file.text();
      setScript(text);
      if (!name) {
        setName(file.name.replace(/\.[^.]+$/, ""));
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleSubmit = () => {
    if (!script.trim()) return;
    const sessionName = name.trim() || `Session ${new Date().toLocaleDateString()}`;
    onImport(sessionName, script);
  };

  const canSubmit = script.trim().length > 0 && !isLoading;
  const lineCount = script.trim().split("\n").filter(l => l.trim()).length;

  return (
    <div className="flex flex-col gap-5 max-w-lg mx-auto w-full" data-testid="script-import">
      <div className="space-y-2">
        <Label htmlFor="session-name" className="text-sm font-medium flex items-center gap-2">
          Session Name
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="session-name"
          placeholder="My Audition Scene"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-12 rounded-xl text-base"
          data-testid="input-session-name"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="script-text" className="text-sm font-medium">
            Your Script
          </Label>
          <Button
            variant={pasteSuccess ? "default" : "outline"}
            size="sm"
            onClick={handlePaste}
            className={cn(
              "gap-1.5 h-8 rounded-lg transition-all duration-200",
              pasteSuccess && "bg-green-600 hover:bg-green-600"
            )}
            data-testid="button-paste"
          >
            {pasteSuccess ? (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Pasted!
              </>
            ) : (
              <>
                <Clipboard className="h-3.5 w-3.5" />
                Paste from clipboard
              </>
            )}
          </Button>
        </div>

        <div
          className={cn(
            "relative rounded-xl border-2 border-dashed transition-all duration-200",
            isDragging 
              ? "border-primary bg-primary/5 scale-[1.01]" 
              : script 
                ? "border-primary/30 bg-card" 
                : "border-border",
            "focus-within:border-primary focus-within:shadow-sm"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Textarea
            id="script-text"
            placeholder={`Paste or type your script here...

Format like this:
SARAH: I can't believe you're leaving.
MARK: [sadly] I don't have a choice.
SARAH: There's always a choice!

Stage directions go in [brackets]`}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            className="min-h-[220px] border-0 resize-none focus-visible:ring-0 text-base rounded-xl bg-transparent"
            data-testid="textarea-script"
          />

          {!script && (
            <div 
              className={cn(
                "absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-3 rounded-xl transition-opacity duration-200",
                isDragging ? "opacity-100 bg-primary/5" : "opacity-0"
              )}
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center animate-soft-bounce">
                <Upload className="h-7 w-7 text-primary" />
              </div>
              <span className="text-sm font-medium text-primary">
                Drop your .txt file here
              </span>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
          }}
        />

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5 h-9 rounded-lg"
              data-testid="button-upload-file"
            >
              <FileText className="h-4 w-4" />
              Upload .txt
            </Button>
            {script && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setScript("")}
                className="text-muted-foreground h-9 rounded-lg"
                data-testid="button-clear-script"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {script && (
            <span className="text-xs text-muted-foreground animate-fade-in">
              {lineCount} line{lineCount !== 1 ? "s" : ""} detected
            </span>
          )}
        </div>
      </div>

      {(error || pasteError) && (
        <div 
          className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-scale-in" 
          data-testid="text-error"
        >
          {error || pasteError}
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!canSubmit}
        size="lg"
        className={cn(
          "w-full h-14 text-base font-semibold rounded-xl gap-2 transition-all duration-200",
          canSubmit && "animate-glow-pulse"
        )}
        data-testid="button-import-script"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Parsing Script...
          </>
        ) : (
          <>
            Continue
            <ArrowRight className="h-5 w-5" />
          </>
        )}
      </Button>
      
      {!script && (
        <div className="text-center animate-fade-in stagger-4">
          <p className="text-xs text-muted-foreground">
            Need a sample? Try: <button 
              onClick={() => setScript(SAMPLE_SCRIPT)}
              className="text-primary hover:underline font-medium"
              data-testid="button-load-sample"
            >
              Load demo script
            </button>
          </p>
        </div>
      )}
    </div>
  );
}

const SAMPLE_SCRIPT = `EMMA: [excited] Did you hear the news?
JACK: What news? I've been stuck in meetings all day.
EMMA: We got the contract! The big one we've been working on for months!
JACK: [shocked] Wait, seriously? The Morrison deal?
EMMA: Yes! Sarah just called from the boardroom. They signed everything!
JACK: [laughing] I can't believe it. After all those late nights...
EMMA: I know. [tearfully] I honestly thought we were going to lose it.
JACK: We need to celebrate. Dinner tonight?
EMMA: [hesitant] I... I actually have plans.
JACK: Oh. With someone I know?
EMMA: [quietly] It's complicated, Jack.
JACK: [concerned] Emma, what's going on?
EMMA: I've been meaning to tell you. I got offered a position in London.
JACK: [stunned] London? As in... England?
EMMA: [sadly] They want me to run the new European office.
JACK: But what about... us? What about this team?
EMMA: [whisper] That's what's so complicated.`;

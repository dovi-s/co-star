import { useState, useRef, useEffect } from "react";
import { Upload, FileText, Clipboard, X, Loader2, ArrowRight, Sparkles, BookOpen, ChevronRight, Check, Wand2 } from "lucide-react";
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

const ENCOURAGING_MESSAGES = [
  "Break a leg!",
  "The stage is yours",
  "Time to shine",
  "Let's bring this to life",
  "Ready when you are",
];

export function ScriptImport({ onImport, isLoading, error }: ScriptImportProps) {
  const [name, setName] = useState("");
  const [script, setScript] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [pasteSuccess, setPasteSuccess] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [encouragement] = useState(() => 
    ENCOURAGING_MESSAGES[Math.floor(Math.random() * ENCOURAGING_MESSAGES.length)]
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowTip(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setScript(text);
        setPasteSuccess(true);
        setTimeout(() => setPasteSuccess(false), 2000);
      }
    } catch (e) {
      textareaRef.current?.focus();
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

  const handleSubmit = () => {
    if (!script.trim()) return;
    const sessionName = name.trim() || `Scene ${new Date().toLocaleDateString()}`;
    onImport(sessionName, script);
  };

  const canSubmit = script.trim().length > 0 && !isLoading;
  
  const detectCharacters = (text: string): string[] => {
    const lines = text.split('\n');
    const characters = new Set<string>();
    lines.forEach(line => {
      const match = line.match(/^([A-Z][A-Z\s]+?):/);
      if (match) {
        characters.add(match[1].trim());
      }
    });
    return Array.from(characters);
  };
  
  const characters = script ? detectCharacters(script) : [];
  const lineCount = script.trim().split("\n").filter(l => l.trim()).length;

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto w-full" data-testid="script-import">
      <div className="space-y-2">
        <Label htmlFor="session-name" className="text-sm font-medium flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
          Name this rehearsal
          <span className="text-muted-foreground font-normal text-xs">(optional)</span>
        </Label>
        <Input
          id="session-name"
          placeholder="e.g., Romeo & Juliet - Balcony Scene"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-12 rounded-xl text-base transition-all duration-200 focus:shadow-md"
          data-testid="input-session-name"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="script-text" className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            Drop in your script
          </Label>
          <Button
            variant={pasteSuccess ? "default" : "outline"}
            size="sm"
            onClick={handlePaste}
            className={cn(
              "gap-1.5 rounded-lg transition-all duration-300",
              pasteSuccess && "bg-green-600"
            )}
            data-testid="button-paste"
          >
            {pasteSuccess ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Got it!
              </>
            ) : (
              <>
                <Clipboard className="h-3.5 w-3.5" />
                Paste
              </>
            )}
          </Button>
        </div>

        <div
          className={cn(
            "relative rounded-2xl border-2 border-dashed transition-all duration-300",
            isDragging 
              ? "border-primary bg-primary/5 scale-[1.02] shadow-lg" 
              : script 
                ? "border-primary/40 bg-card shadow-sm" 
                : "border-border hover:border-muted-foreground/30",
            "focus-within:border-primary focus-within:shadow-md"
          )}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
        >
          <Textarea
            ref={textareaRef}
            id="script-text"
            placeholder={`Paste your script here...

We'll auto-detect your characters!

FORMAT EXAMPLE:
JULIET: Romeo, Romeo, wherefore art thou Romeo?
ROMEO: [calling up] I take thee at thy word!
JULIET: [surprised] What man art thou?

Stage directions go in [brackets]`}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            className="min-h-[240px] border-0 resize-none focus-visible:ring-0 text-base rounded-2xl bg-transparent leading-relaxed"
            data-testid="textarea-script"
          />

          {isDragging && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-primary/10 backdrop-blur-sm">
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center animate-bounce">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <span className="text-sm font-semibold text-primary">
                Drop your script here
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

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5 rounded-lg"
              data-testid="button-upload-file"
            >
              <FileText className="h-4 w-4" />
              Upload .txt
            </Button>
            {script && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setScript("")}
                className="text-muted-foreground rounded-lg"
                data-testid="button-clear-script"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {script && characters.length > 0 && (
            <div className="flex items-center gap-2 animate-fade-in" data-testid="text-character-count">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">
                Found <span className="font-semibold text-foreground">{characters.length}</span> character{characters.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
        
        {script && characters.length > 0 && (
          <div className="flex flex-wrap gap-1.5 animate-fade-in">
            {characters.slice(0, 5).map((char, i) => (
              <span 
                key={char}
                className="px-2.5 py-1 text-xs font-medium rounded-full bg-muted border"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {char}
              </span>
            ))}
            {characters.length > 5 && (
              <span className="px-2.5 py-1 text-xs text-muted-foreground">
                +{characters.length - 5} more
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div 
          className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-scale-in" 
          data-testid="text-error"
        >
          {error}
        </div>
      )}

      <div className="space-y-3">
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          size="lg"
          className={cn(
            "w-full h-14 text-base font-semibold rounded-xl gap-2.5 transition-all duration-300",
            canSubmit && "shadow-lg shadow-primary/20"
          )}
          data-testid="button-choose-role"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Reading your script...
            </>
          ) : canSubmit ? (
            <>
              <Wand2 className="h-5 w-5" />
              Choose Your Role
              <ChevronRight className="h-5 w-5" />
            </>
          ) : (
            <>
              Paste a script to begin
            </>
          )}
        </Button>
        
        {canSubmit && (
          <p className="text-center text-xs text-muted-foreground animate-fade-in">
            {encouragement}
          </p>
        )}
      </div>
      
      {!script && showTip && (
        <div className="text-center space-y-2 animate-fade-in">
          <p className="text-xs text-muted-foreground">
            Just want to try it out?
          </p>
          <button 
            onClick={() => setScript(SAMPLE_SCRIPT)}
            className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline underline-offset-4 transition-all"
            data-testid="button-load-sample"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Load a sample scene
          </button>
        </div>
      )}
    </div>
  );
}

const SAMPLE_SCRIPT = `SARAH: [entering, excited] Alex! You're not going to believe this.
ALEX: What? What happened?
SARAH: I got the part. The lead! In the new Broadway production!
ALEX: [shocked] Wait... THE production? The one you've been dreaming about?
SARAH: [laughing, crying] Yes! They called twenty minutes ago. I've been running here since.
ALEX: [hugging her] I knew it. I knew you'd get it. You've worked so hard for this.
SARAH: [pulling back] But there's something else...
ALEX: What do you mean?
SARAH: [hesitant] It starts rehearsals next month. In London.
ALEX: [pause] London. As in... across the ocean London.
SARAH: [quietly] For eight months.
ALEX: [struggling] That's... that's a long time.
SARAH: I know. And I don't know what to do. This is my dream, but...
ALEX: [firmly] But nothing. You're going.
SARAH: [surprised] Just like that?
ALEX: [taking her hands] Sarah, I've watched you work toward this moment for years. Every rejection, every callback, every 4 AM rehearsal. You earned this.
SARAH: [tearfully] But what about us?
ALEX: [smiling sadly] We'll figure it out. We always do.
SARAH: [whisper] I love you.
ALEX: [softly] I love you too. Now go. Go change the world.`;

import { useState, useRef, useEffect } from "react";
import { Upload, FileText, Clipboard, X, Loader2, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  const [pasteSuccess, setPasteSuccess] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowTip(true), 2500);
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

  return (
    <div className="flex flex-col gap-5 max-w-lg mx-auto w-full" data-testid="script-import">
      {/* Session name - optional */}
      <div className="space-y-1.5">
        <label htmlFor="session-name" className="text-xs font-medium text-muted-foreground">
          Session name <span className="text-muted-foreground/50">(optional)</span>
        </label>
        <Input
          id="session-name"
          placeholder="e.g., Romeo & Juliet Act 2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-11 rounded-lg text-sm border-border/60 focus:border-foreground/30 transition-colors"
          data-testid="input-session-name"
        />
      </div>

      {/* Script input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="script-text" className="text-xs font-medium text-muted-foreground">
            Script
          </label>
          <button
            onClick={handlePaste}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
              pasteSuccess 
                ? "bg-green-500/10 text-green-600 dark:text-green-400" 
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
            data-testid="button-paste"
          >
            {pasteSuccess ? (
              <>
                <Check className="h-3 w-3" />
                Pasted
              </>
            ) : (
              <>
                <Clipboard className="h-3 w-3" />
                Paste
              </>
            )}
          </button>
        </div>

        <div
          className={cn(
            "relative rounded-lg transition-all duration-200",
            isDragging 
              ? "ring-2 ring-foreground/20 bg-muted/30" 
              : script 
                ? "border border-border/60" 
                : "border border-border/40 hover:border-border/60"
          )}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
        >
          <Textarea
            ref={textareaRef}
            id="script-text"
            placeholder={`Paste your script here

Example format:
CHARACTER: Dialogue goes here.
OTHER CHARACTER: [stage direction] More dialogue.

Put stage directions in brackets.`}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            className="min-h-[180px] border-0 resize-none focus-visible:ring-0 text-sm rounded-lg bg-transparent leading-relaxed placeholder:text-muted-foreground/40"
            data-testid="textarea-script"
          />

          {isDragging && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-muted/50 backdrop-blur-sm">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                Drop file
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

        {/* File actions and character count */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
              data-testid="button-upload-file"
            >
              <FileText className="h-3 w-3" />
              Upload .txt
            </button>
            {script && (
              <button
                onClick={() => setScript("")}
                className="inline-flex items-center justify-center w-6 h-6 text-muted-foreground/60 hover:text-foreground rounded-md transition-colors"
                data-testid="button-clear-script"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          
          {script && characters.length > 0 && (
            <span className="text-[11px] text-muted-foreground" data-testid="text-character-count">
              {characters.length} character{characters.length !== 1 ? 's' : ''} detected
            </span>
          )}
        </div>
        
        {/* Character badges with animation */}
        {script && characters.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {characters.slice(0, 5).map((char, index) => (
              <Badge 
                key={char}
                variant="secondary"
                className="text-[10px] animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {char}
              </Badge>
            ))}
            {characters.length > 5 && (
              <span className="px-2 py-0.5 text-[10px] text-muted-foreground/60 animate-fade-in" style={{ animationDelay: "250ms" }}>
                +{characters.length - 5}
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div 
          className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm" 
          data-testid="text-error"
        >
          {error}
        </div>
      )}

      {/* Submit button */}
      <Button
        onClick={handleSubmit}
        disabled={!canSubmit}
        size="lg"
        className={cn(
          "w-full gap-2 transition-all duration-200",
          canSubmit && "shadow-sm"
        )}
        data-testid="button-choose-role"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : canSubmit ? (
          <>
            Continue
            <ArrowRight className="h-4 w-4" />
          </>
        ) : (
          "Paste a script to begin"
        )}
      </Button>
      
      {/* Try sample link - subtle */}
      {!script && showTip && (
        <button 
          onClick={() => setScript(getRandomSampleScript())}
          className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          data-testid="button-load-sample"
        >
          Try a sample script
        </button>
      )}
    </div>
  );
}

const SAMPLE_SCRIPTS = [
  `MAYA: [stopping dead] Jordan? Is that really you?
JORDAN: [turning slowly] Ten years. You look... different.
MAYA: [bitter laugh] Prison will do that to a person.
JORDAN: I wrote you. Every month for the first three years.
MAYA: [quietly] I know. I burned every letter.
JORDAN: [hurt] Why?
MAYA: Because reading them meant hoping. And hope was the cruelest thing in that place.
JORDAN: [stepping closer] I never stopped believing you were innocent.
MAYA: [hollow laugh] That makes one of us.
JORDAN: [firmly] The real killer confessed last month. It's over, Maya. You're free.
MAYA: [voice breaking] Free? I lost everything. My career. My marriage. A decade of my life.
JORDAN: [taking her hands] You didn't lose me. You never lost me.
MAYA: [crying] I don't know who I am anymore.
JORDAN: [gently] Then we'll figure it out together. That's what family does.
MAYA: [whisper] I missed you so much.
JORDAN: [hugging her tight] Welcome home, sis. Welcome home.`,

  `CHEF MARCO: [frantically stirring] The food critic arrives in ten minutes and we have NO LOBSTER!
SOUS CHEF KIM: [panicking] I thought you ordered the lobster!
CHEF MARCO: I thought YOU ordered the lobster!
WAITER DEREK: [bursting in] Table seven just asked if we have lobster. They seem... important.
CHEF MARCO: [whispering intensely] Tell them the lobster is... on a spiritual journey.
WAITER DEREK: [confused] A what now?
SOUS CHEF KIM: [grabbing his arm] Tell them it's a deconstructed lobster experience. Very avant-garde.
CHEF MARCO: [inspired] Yes! Invisible lobster! The essence of lobster without the physical form!
WAITER DEREK: [deadpan] You want me to serve invisible lobster to the most famous food critic in the city.
CHEF MARCO: [grandly] Art, Derek. We're serving ART.`,

  `COMMANDER REYES: [stunned] It's... waving at us.
SCIENTIST DR PATEL: [scribbling notes] Bipedal, approximately three meters tall, bioluminescent skin patterns.
ALIEN ZRIX: [in broken English] We... come in... peace. Also, your TV signals are HILARIOUS.
COMMANDER REYES: [confused] I'm sorry, what?
ZRIX: [excitedly] The show with the yellow family! We have watched all thirty seasons!
DR PATEL: [whispering] They've been monitoring our broadcasts.
ZRIX: [mimicking] "Eat my shorts!" Yes? Ha ha!
COMMANDER REYES: [trying to stay professional] On behalf of Earth, we welcome you.
ZRIX: [producing a gift] We bring offering! Season thirty-one of yellow family show, not yet aired on your planet.
DR PATEL: [grabbing it] GIVE ME THAT.
COMMANDER REYES: [to Patel] Doctor, please. Dignity.`,

  `QUEEN ELEANOR: [coldly] You dare enter my chambers unannounced?
LADY CATHERINE: [trembling] Your Majesty, I bring urgent news from the northern provinces.
QUEEN ELEANOR: [raising an eyebrow] Speak.
LADY CATHERINE: [hesitant] It concerns... the King's hunting expedition.
QUEEN ELEANOR: [dismissive] My husband's pursuits bore me. Get to the point.
LADY CATHERINE: [blurting] He's not hunting deer, Your Majesty. He's meeting with Lord Ashworth. In secret.
QUEEN ELEANOR: [dangerously quiet] Ashworth. The man who tried to usurp my throne.
LADY CATHERINE: [nodding] They were seen exchanging documents.
QUEEN ELEANOR: [standing] How long have you known this?
LADY CATHERINE: [falling to knees] Three days. I was afraid to speak.
QUEEN ELEANOR: [cutting her off] Afraid? Loyalty knows no fear, Catherine.`
];

function getRandomSampleScript(): string {
  return SAMPLE_SCRIPTS[Math.floor(Math.random() * SAMPLE_SCRIPTS.length)];
}

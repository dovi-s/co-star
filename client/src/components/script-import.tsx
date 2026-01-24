import { useState, useRef, useEffect } from "react";
import { Upload, Clipboard, X, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ScriptImportProps {
  onImport: (name: string, rawScript: string) => void;
  isLoading?: boolean;
  error?: string | null;
  initialScript?: string;
}

export function ScriptImport({ onImport, isLoading, error, initialScript = "" }: ScriptImportProps) {
  const [script, setScript] = useState(initialScript);
  const [isDragging, setIsDragging] = useState(false);
  const [pasteSuccess, setPasteSuccess] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isCleaning, setIsCleaning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const promptInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowTip(true), 800);
    return () => clearTimeout(timer);
  }, []);

  const generateRandomScript = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate-random-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) throw new Error("Generation failed");
      
      const data = await response.json();
      setScript(data.script);
    } catch (e) {
      console.error("Failed to generate script:", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateFromPrompt = async () => {
    if (!customPrompt.trim()) return;
    
    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: customPrompt }),
      });
      
      if (!response.ok) throw new Error("Generation failed");
      
      const data = await response.json();
      setScript(data.script);
      setShowPromptInput(false);
      setCustomPrompt("");
    } catch (e) {
      console.error("Failed to generate script:", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const [cleanupError, setCleanupError] = useState(false);
  
  const cleanupScript = async () => {
    if (!script.trim()) return;
    
    setIsCleaning(true);
    setCleanupError(false);
    try {
      const response = await fetch("/api/cleanup-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script }),
      });
      
      if (!response.ok) throw new Error("Cleanup failed");
      
      const data = await response.json();
      setScript(data.script);
    } catch (e) {
      console.error("Failed to clean up script:", e);
      setCleanupError(true);
    } finally {
      setIsCleaning(false);
    }
  };

  useEffect(() => {
    if (showPromptInput && promptInputRef.current) {
      promptInputRef.current.focus();
    }
  }, [showPromptInput]);

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

  const detectSceneName = (text: string, detectedChars: string[]): string => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    
    const sceneHeading = lines.find(line => 
      /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s+/i.test(line)
    );
    if (sceneHeading) {
      let name = sceneHeading
        .replace(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s+/i, '')
        .replace(/\s*[-–—]\s*(DAY|NIGHT|MORNING|EVENING|LATER|CONTINUOUS|SAME).*$/i, '')
        .trim();
      if (name.length > 3 && name.length <= 40) {
        return name.split(' ').map(w => 
          w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        ).join(' ');
      }
    }
    
    if (detectedChars.length >= 2) {
      const top2 = detectedChars.slice(0, 2).map(c => 
        c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()
      );
      return `${top2[0]} & ${top2[1]}`;
    }
    
    if (detectedChars.length === 1) {
      const name = detectedChars[0];
      return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase() + "'s Scene";
    }
    
    return "Untitled Scene";
  };
  
  const handleSubmit = () => {
    if (!script.trim()) return;
    const sessionName = detectSceneName(script, characters);
    onImport(sessionName, script);
  };

  const canSubmit = script.trim().length > 0 && !isLoading && !isGenerating && !isCleaning;
  
  const detectCharacters = (text: string): string[] => {
    const lines = text.split('\n');
    const characters = new Set<string>();
    
    const patterns = [
      /^([A-Za-z][A-Za-z0-9\s\-'\.]+?)(?:\s*\([^)]*\))?\s*[:：]\s*.+$/,
      /^((?:DR|MR|MRS|MS|MISS|PROF|CAPTAIN|DETECTIVE|OFFICER|AGENT|CHEF|WAITER)\.?\s+[A-Za-z][A-Za-z\-'\.]+)(?:\s*\([^)]*\))?\s*[:：]/i,
    ];
    
    lines.forEach(line => {
      const trimmed = line.trim();
      for (const pattern of patterns) {
        const match = trimmed.match(pattern);
        if (match && match[1]) {
          let name = match[1].trim()
            .replace(/\s*\([^)]*\)\s*$/, "")
            .replace(/^\d+[\.\)\-\s]+/, "")
            .toUpperCase();
          if (name.length >= 1 && name.length <= 35) {
            characters.add(name);
            break;
          }
        }
      }
    });
    return Array.from(characters);
  };
  
  const characters = script ? detectCharacters(script) : [];
  
  const estimateSceneTime = (text: string): string | null => {
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (words < 20) return null;
    const minutes = Math.ceil(words / 130);
    if (minutes < 1) return null;
    return `${minutes} min`;
  };
  
  const sceneTime = script ? estimateSceneTime(script) : null;

  return (
    <div className="flex flex-col gap-4 max-w-lg mx-auto w-full" data-testid="script-import">
      <div
        className={cn(
          "relative rounded-xl transition-all duration-200 bg-muted/30 textarea-glow",
          isDragging && "ring-2 ring-foreground/20",
          script && "bg-muted/20"
        )}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
      >
        <Textarea
          ref={textareaRef}
          id="script-text"
          placeholder="Paste your script here..."
          value={script}
          onChange={(e) => setScript(e.target.value)}
          className="min-h-[280px] border-0 resize-none focus-visible:ring-0 text-[13px] rounded-xl bg-transparent leading-relaxed px-4 py-4 placeholder:text-muted-foreground/50 font-mono"
          data-testid="textarea-script"
        />

        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-sm">
            <span className="text-sm text-muted-foreground">Drop file here</span>
          </div>
        )}

        {/* Floating actions - only show when empty */}
        {!script && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1">
            <button
              onClick={handlePaste}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                pasteSuccess 
                  ? "bg-green-500/15 text-green-600 dark:text-green-400" 
                  : "bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-background"
              )}
              data-testid="button-paste"
            >
              {pasteSuccess ? <Check className="h-3 w-3" /> : <Clipboard className="h-3 w-3" />}
              {pasteSuccess ? "Done" : "Paste"}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-background transition-all"
              data-testid="button-upload-file"
            >
              <Upload className="h-3 w-3" />
              Upload
            </button>
          </div>
        )}
        
        {/* Clear button - only show when has content */}
        {script && (
          <button
            type="button"
            onClick={() => setScript("")}
            className="absolute top-2 right-2 p-2 rounded-md bg-background/80 backdrop-blur-sm border border-border/50 text-muted-foreground hover:text-foreground hover:bg-background hover:border-border active:scale-95 transition-all z-10 touch-manipulation"
            style={{ minWidth: 36, minHeight: 36 }}
            data-testid="button-clear-script"
          >
            <X className="h-4 w-4" />
          </button>
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

      {/* Character preview or cleanup hint */}
      {script && characters.length > 0 && (
        <div className="flex items-center justify-between gap-2 px-1 mt-1 mb-2 animate-fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-muted-foreground shrink-0">{characters.length} roles:</span>
            <div className="flex flex-wrap gap-1 min-w-0">
              {characters.slice(0, 4).map((char) => (
                <span key={char} className="text-xs text-foreground/80">{char}</span>
              ))}
              {characters.length > 4 && (
                <span className="text-xs text-muted-foreground">+{characters.length - 4}</span>
              )}
            </div>
          </div>
          {sceneTime && (
            <span className="text-xs text-muted-foreground shrink-0" data-testid="text-scene-time">
              {sceneTime} scene
            </span>
          )}
        </div>
      )}
      
      {script && characters.length === 0 && script.trim().length > 50 && (
        <p className="text-center text-sm text-muted-foreground/70 animate-fade-in" data-testid="text-cleanup-hint">
          {isCleaning ? (
            <span className="inline-flex items-center gap-1.5" data-testid="text-cleanup-loading">
              <Loader2 className="h-3 w-3 animate-spin" />
              Formatting...
            </span>
          ) : cleanupError ? (
            <span data-testid="text-cleanup-error">
              Formatting failed.{" "}
              <button
                onClick={cleanupScript}
                className="underline underline-offset-2 hover:text-foreground transition-colors"
                data-testid="button-retry-cleanup"
              >
                Try again
              </button>
            </span>
          ) : (
            <>
              Can't find dialogue.{" "}
              <button
                onClick={cleanupScript}
                className="underline underline-offset-2 hover:text-foreground transition-colors"
                data-testid="button-cleanup-script"
              >
                Auto-format
              </button>
            </>
          )}
        </p>
      )}

      {error && (
        <div className="px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm" data-testid="text-error">
          {error}
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!canSubmit}
        size="lg"
        className="w-full"
        data-testid="button-choose-role"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Processing
          </>
        ) : canSubmit ? (
          "Continue"
        ) : (
          "Paste a script"
        )}
      </Button>
      
      {/* Sample script option */}
      {!script && showTip && (
        <div className="animate-fade-in">
          {showPromptInput ? (
            <div className="flex items-center gap-2">
              <Input
                ref={promptInputRef}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="two friends reuniting after 10 years..."
                className="text-sm h-9 flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customPrompt.trim()) {
                    generateFromPrompt();
                  } else if (e.key === "Escape") {
                    setShowPromptInput(false);
                    setCustomPrompt("");
                  }
                }}
                disabled={isGenerating}
                data-testid="input-custom-prompt"
              />
              <Button
                size="sm"
                onClick={generateFromPrompt}
                disabled={!customPrompt.trim() || isGenerating}
                data-testid="button-generate-from-prompt"
              >
                {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Go"}
              </Button>
              <button
                onClick={() => {
                  setShowPromptInput(false);
                  setCustomPrompt("");
                }}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-cancel-prompt"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground/70">
              No script?{" "}
              <button
                onClick={generateRandomScript}
                disabled={isGenerating}
                className="underline underline-offset-2 hover:text-foreground transition-colors disabled:opacity-50"
                data-testid="button-generate-random"
              >
                {isGenerating ? "Generating..." : "Try a sample"}
              </button>
              {" "}or{" "}
              <button
                onClick={() => setShowPromptInput(true)}
                disabled={isGenerating}
                className="underline underline-offset-2 hover:text-foreground transition-colors disabled:opacity-50"
                data-testid="button-show-prompt"
              >
                create one
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}


import { useState, useRef, useEffect } from "react";
import { Upload, FileText, Clipboard, X, Loader2, ArrowRight, Check, Sparkles, Shuffle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ScriptImportProps {
  onImport: (name: string, rawScript: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function ScriptImport({ onImport, isLoading, error }: ScriptImportProps) {
  const [script, setScript] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [pasteSuccess, setPasteSuccess] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const promptInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowTip(true), 2500);
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

  const handleSubmit = () => {
    if (!script.trim()) return;
    const sessionName = `Scene ${new Date().toLocaleDateString()}`;
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
            className="min-h-[300px] border-0 resize-none focus-visible:ring-0 text-[15px] rounded-lg bg-transparent leading-[2.6] px-6 py-5 placeholder:text-muted-foreground/40 font-normal"
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
      
      {/* AI Script Generation */}
      {!script && showTip && (
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          {showPromptInput ? (
            <div className="flex items-center gap-2 w-full max-w-sm">
              <Input
                ref={promptInputRef}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. two siblings arguing about inheritance"
                className="text-sm"
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
                size="icon"
                variant="ghost"
                onClick={generateFromPrompt}
                disabled={!customPrompt.trim() || isGenerating}
                data-testid="button-generate-from-prompt"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setShowPromptInput(false);
                  setCustomPrompt("");
                }}
                className="text-muted-foreground"
                data-testid="button-cancel-prompt"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={generateRandomScript}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:text-foreground transition-colors disabled:opacity-50"
                data-testid="button-generate-random"
              >
                {isGenerating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Shuffle className="h-3 w-3" />
                )}
                Random scene
              </button>
              <span className="text-muted-foreground/30">or</span>
              <button
                onClick={() => setShowPromptInput(true)}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:text-foreground transition-colors disabled:opacity-50"
                data-testid="button-show-prompt"
              >
                <Sparkles className="h-3 w-3" />
                Write a prompt
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


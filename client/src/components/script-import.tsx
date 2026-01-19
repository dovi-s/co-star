import { useState, useRef } from "react";
import { Upload, FileText, Clipboard, X, Loader2 } from "lucide-react";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pasteError, setPasteError] = useState<string | null>(null);

  const handlePaste = async () => {
    setPasteError(null);
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setScript(text);
      } else {
        setPasteError("Clipboard is empty");
      }
    } catch (e) {
      setPasteError("Could not access clipboard. Try pasting manually (Ctrl+V or Cmd+V).");
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

  return (
    <div className="flex flex-col gap-6" data-testid="script-import">
      <div className="space-y-2">
        <Label htmlFor="session-name" className="text-sm font-medium">
          Session Name
        </Label>
        <Input
          id="session-name"
          placeholder="My Audition Scene"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-11"
          data-testid="input-session-name"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="script-text" className="text-sm font-medium">
            Script
          </Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePaste}
            className="text-xs gap-1.5 h-8"
            data-testid="button-paste"
          >
            <Clipboard className="h-3.5 w-3.5" />
            Paste
          </Button>
        </div>

        <div
          className={cn(
            "relative rounded-lg border-2 border-dashed transition-colors",
            isDragging ? "border-primary bg-primary/5" : "border-border",
            "focus-within:border-primary"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Textarea
            id="script-text"
            placeholder={`Paste or type your script here...

Example format:
SARAH: I can't believe you're leaving.
MARK: [sadly] I don't have a choice.
SARAH: There's always a choice!`}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            className="min-h-[200px] border-0 resize-none focus-visible:ring-0"
            data-testid="textarea-script"
          />

          {!script && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-3 opacity-0 hover:opacity-100 transition-opacity bg-background/80 rounded-lg">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Drop a .txt file here
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

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5"
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
              className="text-muted-foreground"
              data-testid="button-clear-script"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {(error || pasteError) && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm" data-testid="text-error">
          {error || pasteError}
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full h-12 text-base font-semibold"
        data-testid="button-import-script"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Parsing Script...
          </>
        ) : (
          "Import Script"
        )}
      </Button>
    </div>
  );
}

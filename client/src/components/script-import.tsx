import { useState, useRef, useEffect, useMemo } from "react";
import { Upload, Clipboard, X, Loader2, Check, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { parseScript } from "@/lib/script-parser";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ParsedScript {
  roles: any[];
  scenes: any[];
}

interface ScriptImportProps {
  onImport: (name: string, rawScript: string) => void;
  onImportParsed?: (name: string, parsed: ParsedScript) => void;
  isLoading?: boolean;
  error?: string | null;
  onClearError?: () => void;
  initialScript?: string;
}

export function ScriptImport({ onImport, onImportParsed, isLoading, error, onClearError, initialScript = "" }: ScriptImportProps) {
  const [script, setScript] = useState(initialScript);
  const [isDragging, setIsDragging] = useState(false);
  const [pasteSuccess, setPasteSuccess] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isCleaning, setIsCleaning] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [serverParsedData, setServerParsedData] = useState<ParsedScript | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const promptInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowTip(true), 800);
    return () => clearTimeout(timer);
  }, []);

  // Clear errors when script changes (user is editing)
  useEffect(() => {
    if (script && error && onClearError) {
      onClearError();
    }
    // Also clear local file errors
    if (script && fileError) {
      setFileError(null);
    }
  }, [script]);

  const cleanupAndParse = async (scriptText: string): Promise<{ parsed?: any; script?: string } | null> => {
    try {
      const cleanupResp = await fetch("/api/cleanup-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: scriptText }),
      });
      if (!cleanupResp.ok) return null;
      const cleanupData = await cleanupResp.json();
      const cleaned = cleanupData.script || scriptText;
      
      const parseResp = await fetch("/api/parse-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: cleaned }),
      });
      if (parseResp.ok) {
        const d = await parseResp.json();
        if (d.parsed && d.parsed.roles?.length > 0) return { parsed: d.parsed, script: cleaned };
      }
    } catch {}
    return null;
  };

  const generateRandomScript = async () => {
    setIsGenerating(true);
    setServerParsedData(null);
    setUploadedFileName(null);
    try {
      const response = await fetch("/api/generate-random-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) throw new Error("Generation failed");
      
      const data = await response.json();
      setScript(data.script);
      
      if (data.parsed && onImportParsed) {
        const sessionName = data.theme?.split(":")[0]?.trim() || "Generated Scene";
        onImportParsed(sessionName, data.parsed);
        return;
      }
      
      if (data.script && onImportParsed) {
        const retried = await cleanupAndParse(data.script);
        if (retried?.parsed) {
          if (retried.script) setScript(retried.script);
          const sessionName = data.theme?.split(":")[0]?.trim() || "Generated Scene";
          onImportParsed(sessionName, retried.parsed);
          return;
        }
      }
    } catch (e) {
      console.error("Failed to generate script:", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateFromPrompt = async () => {
    if (!customPrompt.trim()) return;
    
    setIsGenerating(true);
    setServerParsedData(null);
    setUploadedFileName(null);
    try {
      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: customPrompt }),
      });
      
      if (!response.ok) throw new Error("Generation failed");
      
      const data = await response.json();
      setScript(data.script);
      
      if (data.parsed && onImportParsed) {
        const sessionName = customPrompt.slice(0, 30).trim() || "Generated Scene";
        setShowPromptInput(false);
        setCustomPrompt("");
        onImportParsed(sessionName, data.parsed);
        return;
      }
      
      if (data.script && onImportParsed) {
        const retried = await cleanupAndParse(data.script);
        if (retried?.parsed) {
          if (retried.script) setScript(retried.script);
          const sessionName = customPrompt.slice(0, 30).trim() || "Generated Scene";
          setShowPromptInput(false);
          setCustomPrompt("");
          onImportParsed(sessionName, retried.parsed);
          return;
        }
      }
      
      setShowPromptInput(false);
      setCustomPrompt("");
    } catch (e) {
      console.error("Failed to generate script:", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const [cleanupError, setCleanupError] = useState<string | boolean>(false);
  
  const cleanupScript = async () => {
    if (!script.trim()) return;
    
    setIsCleaning(true);
    setCleanupError(false);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);
      
      const response = await fetch("/api/cleanup-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Cleanup failed");
      }
      
      const data = await response.json();
      if (!data.script) throw new Error("No result returned");
      setScript(data.script);
    } catch (e: any) {
      console.error("Failed to clean up script:", e);
      if (e.name === "AbortError") {
        setCleanupError("This script is too large for AI formatting. Try uploading the PDF directly instead.");
      } else {
        setCleanupError(e.message || true);
      }
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

  const [isParsingFile, setIsParsingFile] = useState(false);
  const [parseProgress, setParseProgress] = useState<string>("");
  const [fileError, setFileError] = useState<string | null>(null);

  // Extract a clean title from filename
  const extractTitleFromFilename = (filename: string): string => {
    // Remove extension
    let title = filename.replace(/\.(pdf|txt|fountain|rtf|fdx)$/i, '');
    // Replace common separators with spaces
    title = title.replace(/[-_\.]/g, ' ');
    // Clean up multiple spaces
    title = title.replace(/\s+/g, ' ').trim();
    // Title case
    title = title.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
    return title;
  };

  const handleFileSelect = async (file: File) => {
    const fileName = file.name.toLowerCase();
    setFileError(null);
    setServerParsedData(null);
    
    // Store the filename for use as script title
    const extractedTitle = extractTitleFromFilename(file.name);
    setUploadedFileName(extractedTitle);
    
    // Handle plain text files directly
    if (file.type === "text/plain" || fileName.endsWith(".txt") || fileName.endsWith(".fountain")) {
      const text = await file.text();
      setScript(text);
      return;
    }
    
    if (fileName.endsWith(".pdf")) {
      setIsParsingFile(true);
      setParseProgress("Reading PDF...");
      let progressTimer: ReturnType<typeof setInterval> | null = null;
      try {
        const formData = new FormData();
        formData.append("file", file);
        
        progressTimer = setInterval(() => {
          setParseProgress(prev => {
            if (prev.includes("Scanning")) return prev;
            if (prev.includes("Reading")) return "Analyzing pages...";
            return prev;
          });
        }, 5000);

        const response = await fetch("/api/parse-file-to-session", {
          method: "POST",
          body: formData,
        });
        
        if (!response.ok) {
          const data = await response.json();
          if (data.needsOcr) {
            setParseProgress("Scanning pages with AI (this may take a few minutes)...");
            const ocrResponse = await fetch("/api/ocr-pdf-to-session", {
              method: "POST",
              body: formData,
            });
            if (!ocrResponse.ok) {
              const ocrData = await ocrResponse.json();
              throw new Error(ocrData.error || "Failed to scan PDF");
            }
            const ocrData = await ocrResponse.json();
            console.log('[PDF Import] OCR parsed:', {
              roles: ocrData.parsed.roles.length,
              scenes: ocrData.parsed.scenes.length,
              totalLines: ocrData.parsed.scenes.reduce((s: number, sc: any) => s + sc.lines.length, 0)
            });
            setServerParsedData(ocrData.parsed);
            setScript(ocrData.rawText || "");
            return;
          }
          throw new Error(data.error || "Failed to parse file");
        }
        
        const data = await response.json();
        console.log('[PDF Import] Server parsed:', {
          roles: data.parsed.roles.length,
          scenes: data.parsed.scenes.length,
          totalLines: data.parsed.scenes.reduce((s: number, sc: any) => s + sc.lines.length, 0)
        });
        
        setServerParsedData(data.parsed);
        setScript(data.rawText || "");
      } catch (e: any) {
        console.error("File parse error:", e);
        setFileError(e.message || "Failed to parse file");
      } finally {
        if (progressTimer) clearInterval(progressTimer);
        setIsParsingFile(false);
        setParseProgress("");
      }
      return;
    }
    
    // For other files (RTF, FDX), use original endpoint
    if (fileName.endsWith(".rtf") || fileName.endsWith(".fdx")) {
      setIsParsingFile(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        
        const response = await fetch("/api/parse-file", {
          method: "POST",
          body: formData,
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to parse file");
        }
        
        const data = await response.json();
        setScript(data.text);
      } catch (e: any) {
        console.error("File parse error:", e);
        setFileError(e.message || "Failed to parse file");
      } finally {
        setIsParsingFile(false);
      }
      return;
    }
    
    // Unsupported file type
    setFileError("Please upload a PDF, TXT, or Fountain file");
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
        return name.split(' ').filter(w => w && w.length > 0).map(w => 
          w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        ).join(' ');
      }
    }
    
    // Filter out null/undefined values from character array
    const validChars = detectedChars.filter(c => c && typeof c === 'string' && c.length > 0);
    
    if (validChars.length >= 2) {
      const top2 = validChars.slice(0, 2).map(c => 
        c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()
      );
      return `${top2[0]} & ${top2[1]}`;
    }
    
    if (validChars.length === 1) {
      const name = validChars[0];
      return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase() + "'s Scene";
    }
    
    return "Untitled Scene";
  };
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!script.trim()) return;
    // Use uploaded filename if available, otherwise detect from content
    const sessionName = uploadedFileName || detectSceneName(script, characters);
    
    console.log('[Submit] Script length:', script.length, 'chars');
    console.log('[Submit] Has serverParsedData:', !!serverParsedData);
    
    // If we have server-parsed data (from PDF), use it directly
    if (serverParsedData && onImportParsed) {
      console.log('[Submit] Using server-parsed data with', serverParsedData.scenes.length, 'scenes');
      const totalLines = serverParsedData.scenes.reduce((sum: number, s: any) => sum + s.lines.length, 0);
      console.log('[Submit] Total lines in parsed data:', totalLines);
      onImportParsed(sessionName, serverParsedData);
      return;
    }
    
    // ALWAYS parse scripts over 10KB on the server to avoid any truncation
    if (onImportParsed && script.length > 10000) {
      console.log('[Submit] Parsing on server - script length:', script.length);
      setIsSubmitting(true);
      try {
        const response = await fetch("/api/parse-script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script }),
        });
        
        console.log('[Submit] Server response status:', response.status);
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to parse script");
        }
        
        const data = await response.json();
        const totalLines = data.parsed.scenes.reduce((sum: number, s: any) => sum + s.lines.length, 0);
        console.log('[Submit] Server parsed:', {
          roles: data.parsed.roles.length,
          scenes: data.parsed.scenes.length,
          totalLines: totalLines,
        });
        onImportParsed(sessionName, data.parsed);
      } catch (e: any) {
        console.error("[Submit] Server parse error:", e);
        // Fall back to client-side parsing
        console.log('[Submit] Falling back to client-side parsing');
        onImport(sessionName, script);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    
    // Small scripts can be parsed on client
    console.log('[Submit] Client-side parsing for small script');
    onImport(sessionName, script);
  };

  const canSubmit = script.trim().length > 0 && !isLoading && !isGenerating && !isCleaning && !isSubmitting;
  
  // Detect if text looks badly formatted (common with PDF copy-paste)
  const looksLikeBadPdfCopy = useMemo(() => {
    if (!script || script.length < 200) return false;
    
    const lines = script.split('\n');
    // Check for very long lines (common when line breaks are lost)
    const veryLongLines = lines.filter(l => l.length > 200).length;
    const avgLineLength = script.length / Math.max(lines.length, 1);
    
    // Check for merged character names (e.g., "straightWINSLEY." or "atCallie checks")
    const hasMergedNames = /[a-z][A-Z]{3,}\.\s+[A-Z]/.test(script) || 
                           /[a-z][A-Z][a-z]+\s+(?:checks|looks|turns|walks|sits|stands)/.test(script);
    
    // Check for multiple character lines merged on same line
    const hasMergedDialogue = /[A-Z]{3,}\.\s+[A-Za-z].*[A-Z]{3,}\.\s+[A-Z]/.test(script);
    
    return (veryLongLines > 3 || avgLineLength > 150 || hasMergedNames || hasMergedDialogue);
  }, [script]);

  // Use the full parser for accurate preview (with OCR correction and CAST detection)
  const previewData = useMemo(() => {
    if (!script || script.trim().length < 50) {
      return { roles: 0, scenes: 0, time: null };
    }
    
    try {
      const parsed = parseScript(script);
      const roleCount = parsed.roles.length;
      const sceneCount = parsed.scenes.length;
      
      // Estimate reading time
      const words = script.trim().split(/\s+/).filter(w => w.length > 0).length;
      const minutes = Math.ceil(words / 130);
      const time = minutes >= 1 ? `${minutes} min` : null;
      
      return { roles: roleCount, scenes: sceneCount, time };
    } catch {
      return { roles: 0, scenes: 0, time: null };
    }
  }, [script]);
  
  const characters = previewData.roles > 0 ? Array(previewData.roles).fill(null) : [];

  return (
    <div className="flex flex-col gap-4 max-w-lg mx-auto w-full" data-testid="script-import">
      {/* Format tips link */}
      <div className="flex items-center justify-end px-1">
        <Dialog>
          <DialogTrigger asChild>
            <button
              className="inline-flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              data-testid="button-format-help"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Format tips</span>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-medium">Script Formatting</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                We accept most standard script formats. Here are the main ones:
              </p>
              
              {/* Screenplay format */}
              <div className="space-y-1.5">
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Screenplay Format</p>
                <div className="bg-muted/40 rounded-lg p-3 font-mono text-xs leading-relaxed">
                  <div className="text-center mb-1">SARAH</div>
                  <div className="text-muted-foreground mb-2">I can't believe you're leaving.</div>
                  <div className="text-center mb-1">MICHAEL</div>
                  <div className="text-muted-foreground">(softly)</div>
                  <div className="text-muted-foreground">Neither can I.</div>
                </div>
              </div>
              
              {/* Stage play format */}
              <div className="space-y-1.5">
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Stage Play Format</p>
                <div className="bg-muted/40 rounded-lg p-3 font-mono text-xs leading-relaxed">
                  <div className="text-muted-foreground">SARAH: I can't believe you're leaving.</div>
                  <div className="text-muted-foreground">MICHAEL: [softly] Neither can I.</div>
                </div>
              </div>
              
              {/* Tips */}
              <div className="space-y-2 pt-1">
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Tips</p>
                <ul className="space-y-1.5 text-muted-foreground text-xs">
                  <li className="flex gap-2">
                    <span className="text-foreground font-medium">PDF</span>
                    <span>Use the Upload button for best results</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-foreground">Names</span>
                    <span>ALL CAPS or followed by colon</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-foreground">Directions</span>
                    <span>Use [brackets] or (parentheses)</span>
                  </li>
                </ul>
                <p className="text-[10px] text-muted-foreground/60 mt-2">
                  Copy-paste from PDFs often loses formatting. Upload the file directly for better accuracy.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      <div
        className={cn(
          "relative rounded-xl transition-all duration-200 glass-surface-clear textarea-glow",
          isDragging && "ring-2 ring-foreground/20"
        )}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
      >
        <Textarea
          ref={textareaRef}
          id="script-text"
          placeholder="SARAH: I can't believe you're leaving..."
          value={script}
          onChange={(e) => { setScript(e.target.value); setUploadedFileName(null); }}
          className="min-h-[280px] border-0 resize-none focus-visible:ring-0 text-[13px] rounded-xl bg-transparent leading-relaxed px-4 py-4 placeholder:text-muted-foreground/50 font-mono"
          data-testid="textarea-script"
        />

        {isParsingFile && parseProgress && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-background/90 backdrop-blur-sm z-10" data-testid="overlay-parse-progress">
            <div className="w-8 h-8 rounded-full border-3 border-primary/20 border-t-primary animate-spin mb-3" />
            <p className="text-sm font-medium text-foreground">{parseProgress}</p>
            {parseProgress.includes("Scanning") && (
              <p className="text-xs text-muted-foreground mt-1">Scanned PDF detected. Reading each page with AI.</p>
            )}
          </div>
        )}

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
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg press-effect",
                pasteSuccess 
                  ? "bg-success/15 text-success" 
                  : "bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-background"
              )}
              data-testid="button-paste"
            >
              {pasteSuccess ? <Check className="h-3 w-3" /> : <Clipboard className="h-3 w-3" />}
              {pasteSuccess ? "Done" : "Paste"}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsingFile}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg press-effect",
                isParsingFile
                  ? "bg-primary/10 text-primary"
                  : "bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-background"
              )}
              data-testid="button-upload-file"
            >
              {isParsingFile ? (
                <>
                  <div className="w-3 h-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                  {parseProgress.includes("Scanning") ? "Scanning" : "Parsing"}
                </>
              ) : (
                <>
                  <Upload className="h-3 w-3" />
                  Upload
                </>
              )}
            </button>
          </div>
        )}
        
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.pdf,.fountain,.fdx,.rtf,text/plain,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
          e.target.value = ""; // Reset so same file can be selected again
        }}
      />

      {/* Warning for badly formatted text */}
      {script && looksLikeBadPdfCopy && previewData.roles > 0 && !isCleaning && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 text-center animate-fade-in" data-testid="warning-bad-format">
          <p className="text-sm text-amber-700 dark:text-amber-400 mb-2">
            This text may have formatting issues from PDF copy-paste. Some lines could be misattributed.
          </p>
          <p className="text-xs text-amber-600/80 dark:text-amber-400/70 mb-2">
            We found {previewData.roles} roles and can still parse this. You can continue, or try these options for better accuracy:
          </p>
          {script.length <= 30000 && (
            <>
              <button
                onClick={cleanupScript}
                className="text-sm font-medium text-amber-700 dark:text-amber-400 underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-300 transition-colors"
                data-testid="button-fix-formatting"
              >
                Fix with AI
              </button>
              <span className="text-amber-600/60 dark:text-amber-400/60 mx-2">or</span>
            </>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-sm font-medium text-amber-700 dark:text-amber-400 underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-300 transition-colors"
            data-testid="button-upload-instead"
          >
            Upload the PDF file directly
          </button>
          {script.length > 30000 && (
            <p className="text-[10px] text-amber-600/50 dark:text-amber-400/40 mt-2">
              AI formatting is not available for very long scripts. Upload the original file for best results.
            </p>
          )}
        </div>
      )}

      {/* Character preview with clear option */}
      {script && previewData.roles > 0 && !looksLikeBadPdfCopy && (
        <p className="text-xs text-muted-foreground text-center mt-2 mb-4">
          {previewData.roles} roles
          {previewData.scenes > 0 && <span> · {previewData.scenes} scenes</span>}
          {previewData.time && <span> · {previewData.time}</span>}
          {" · "}
          <button
            type="button"
            onClick={() => setScript("")}
            className="underline underline-offset-2 hover:text-foreground transition-colors"
            data-testid="button-clear-script"
          >
            Clear
          </button>
        </p>
      )}
      
      {/* Cleaning in progress indicator */}
      {isCleaning && (
        <div className="flex flex-col items-center gap-2 py-3 text-muted-foreground animate-fade-in" role="status" aria-label="Fixing formatting with AI">
          <div className="flex items-center gap-3">
            <div className="circle-badge w-6 h-6 energy-ring thinking" aria-hidden="true">
              <div className="w-3 h-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            </div>
            <span className="text-sm">Fixing formatting with AI</span>
          </div>
          {script.length > 10000 && (
            <span className="text-xs text-muted-foreground/60">Large script, this may take up to a minute</span>
          )}
        </div>
      )}
      
      {script && previewData.roles === 0 && script.trim().length > 50 && (
        <p className="text-center text-sm text-muted-foreground/70 animate-fade-in" data-testid="text-cleanup-hint">
          {isCleaning ? (
            <span className="inline-flex items-center gap-1.5" data-testid="text-cleanup-loading">
              <div className="w-3 h-3 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
              Formatting
            </span>
          ) : cleanupError ? (
            <span data-testid="text-cleanup-error">
              {typeof cleanupError === "string" ? cleanupError : "Formatting failed."}{" "}
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
              {" · "}
              <button
                onClick={() => setScript("")}
                className="underline underline-offset-2 hover:text-foreground transition-colors"
                data-testid="button-clear-script-alt"
              >
                Clear
              </button>
            </>
          )}
        </p>
      )}

      {(error || fileError) && (
        <div className="px-4 py-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm space-y-3" data-testid="text-error">
          <p className="text-destructive font-medium leading-relaxed">
            {(() => {
              const errText = error || fileError || "";
              // Parse JSON error if present
              const jsonMatch = errText.match(/\{.*"error"\s*:\s*"([^"]+)".*\}/);
              if (jsonMatch) {
                return jsonMatch[1];
              }
              // Remove status code prefix like "400: "
              const cleaned = errText.replace(/^\d+:\s*/, "");
              // If it's still JSON, try to parse it
              try {
                const parsed = JSON.parse(cleaned);
                return parsed.error || cleaned;
              } catch {
                return cleaned;
              }
            })()}
          </p>
          <div className="border-t border-destructive/10 pt-3">
            <p className="text-xs text-muted-foreground mb-2">Expected format:</p>
            <div className="bg-muted/50 rounded px-3 py-2 font-mono text-xs text-foreground/80 space-y-0.5">
              <p>JOHN: Hello, how are you?</p>
              <p>MARY: I'm doing well, thanks.</p>
            </div>
          </div>
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
            <div className="w-4 h-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin mr-2" />
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
                {isGenerating ? <div className="w-3.5 h-3.5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" /> : "Go"}
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
                {isGenerating ? "Generating..." : "Generate a scene"}
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


import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  Copy,
  Check,
  Download,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LOGO_SVG = `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M21 7 Q25 17 35 21 Q25 25 21 35 Q17 25 7 21 Q17 17 21 7 Z" fill="#1A73E8"/>
  <path d="M35 29.5 Q36.5 33.5 40.5 35 Q36.5 36.5 35 40.5 Q33.5 36.5 29.5 35 Q33.5 33.5 35 29.5 Z" fill="#B08763" opacity="0.9"/>
</svg>`;

const LOGO_SVG_DARK = `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M21 7 Q25 17 35 21 Q25 25 21 35 Q17 25 7 21 Q17 17 21 7 Z" fill="#5BA3FF"/>
  <path d="M35 29.5 Q36.5 33.5 40.5 35 Q36.5 36.5 35 40.5 Q33.5 36.5 29.5 35 Q33.5 33.5 35 29.5 Z" fill="#C4956D" opacity="0.9"/>
</svg>`;

const LOGO_SVG_WHITE = `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M21 7 Q25 17 35 21 Q25 25 21 35 Q17 25 7 21 Q17 17 21 7 Z" fill="#FFFFFF"/>
  <path d="M35 29.5 Q36.5 33.5 40.5 35 Q36.5 36.5 35 40.5 Q33.5 36.5 29.5 35 Q33.5 33.5 35 29.5 Z" fill="#FFFFFF" opacity="0.6"/>
</svg>`;

const brandColors = [
  { name: "Primary Blue", light: "#1A73E8", dark: "#5BA3FF", cssVar: "--primary", usage: "Buttons, links, accents" },
  { name: "Bronze Accent", light: "#B08763", dark: "#C4956D", cssVar: "--accent", usage: "Highlights, secondary accents" },
  { name: "Background", light: "#F7F4EE", dark: "#0A0D12", cssVar: "--background", usage: "Page background" },
  { name: "Foreground", light: "#0F172A", dark: "#F0F6FC", cssVar: "--foreground", usage: "Primary text" },
  { name: "Card", light: "#FFFFFF", dark: "#12171F", cssVar: "--card", usage: "Cards, panels" },
  { name: "Border", light: "#E9E2D5", dark: "#2D3748", cssVar: "--border", usage: "Dividers, borders" },
  { name: "Muted", light: "#6B7A8D", dark: "#6B7A8D", cssVar: "--muted-foreground", usage: "Secondary text" },
  { name: "Destructive", light: "#DC2626", dark: "#EF4444", cssVar: "--destructive", usage: "Errors, warnings" },
  { name: "Success", light: "#16A34A", dark: "#22C55E", cssVar: "--success", usage: "Success states" },
];

const typographySamples = [
  { name: "Heading XL", className: "text-3xl font-semibold", sample: "Co-star Studio" },
  { name: "Heading LG", className: "text-2xl font-semibold", sample: "Professional rehearsals" },
  { name: "Heading MD", className: "text-xl font-semibold", sample: "Run lines with your scene partner" },
  { name: "Body", className: "text-base font-normal", sample: "Paste your script, pick your role, and start rehearsing with intelligent scene partners." },
  { name: "Body Small", className: "text-sm font-normal", sample: "Smart voice assignment and natural timing that adapts to scene tension." },
  { name: "Caption", className: "text-xs font-medium text-muted-foreground", sample: "v1.0 · Co-star Studio" },
  { name: "Mono", className: "text-sm font-mono", sample: "JULIET: O Romeo, Romeo, wherefore art thou Romeo?" },
];

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast({ title: "Copied", description: label || "Copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text, label, toast]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={handleCopy}
      data-testid={`copy-${label?.toLowerCase().replace(/\s+/g, "-") || "btn"}`}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
      )}
    </Button>
  );
}

function downloadSvg(svgContent: string, filename: string) {
  const blob = new Blob([svgContent], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadPng(svgContent: string, filename: string, size: number) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const img = new Image();
  const blob = new Blob([svgContent], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  img.onload = () => {
    ctx.drawImage(img, 0, 0, size, size);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const pngUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(pngUrl);
    }, "image/png");
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

function LogoPreview({ svg, bg, label }: { svg: string; bg: string; label: string }) {
  return (
    <div className="space-y-3">
      <div
        className={cn("w-full aspect-square rounded-xl flex items-center justify-center border border-border/40", bg)}
      >
        <div className="w-1/2 h-1/2" dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
      <p className="text-xs text-muted-foreground text-center">{label}</p>
      <div className="flex gap-1 justify-center">
        <Button variant="outline" size="sm" onClick={() => downloadSvg(svg, `co-star-icon-${label.toLowerCase().replace(/\s+/g, "-")}.svg`)} data-testid={`download-icon-svg-${label.toLowerCase()}`}>
          <Download className="w-3 h-3 mr-1" />
          SVG
        </Button>
        <Button variant="outline" size="sm" onClick={() => downloadPng(svg, `co-star-icon-${label.toLowerCase().replace(/\s+/g, "-")}.png`, 512)} data-testid={`download-icon-png-${label.toLowerCase()}`}>
          <Download className="w-3 h-3 mr-1" />
          PNG
        </Button>
      </div>
    </div>
  );
}

function WordmarkPreview({ svg, textColor, bg, label }: { svg: string; textColor: string; bg: string; label: string }) {
  const wordmarkSvg = `<svg viewBox="0 0 280 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${svg.replace(/<\/?svg[^>]*>/g, "")}
  <text x="56" y="32" font-family="Inter, system-ui, sans-serif" font-size="18" letter-spacing="1.5" fill="${textColor}"><tspan font-weight="400">Co-star</tspan> <tspan font-weight="600">Studio</tspan></text>
</svg>`;

  return (
    <div className="space-y-3">
      <div
        className={cn("w-full aspect-[3/1] rounded-xl flex items-center justify-center border border-border/40 px-6", bg)}
      >
        <div className="w-full max-w-[280px]" dangerouslySetInnerHTML={{ __html: wordmarkSvg }} />
      </div>
      <p className="text-xs text-muted-foreground text-center">{label}</p>
      <div className="flex gap-1 justify-center">
        <Button variant="outline" size="sm" onClick={() => downloadSvg(wordmarkSvg, `co-star-wordmark-${label.toLowerCase().replace(/\s+/g, "-")}.svg`)} data-testid={`download-wordmark-svg-${label.toLowerCase()}`}>
          <Download className="w-3 h-3 mr-1" />
          SVG
        </Button>
        <Button variant="outline" size="sm" onClick={() => downloadPng(wordmarkSvg, `co-star-wordmark-${label.toLowerCase().replace(/\s+/g, "-")}.png`, 1120)} data-testid={`download-wordmark-png-${label.toLowerCase()}`}>
          <Download className="w-3 h-3 mr-1" />
          PNG
        </Button>
      </div>
    </div>
  );
}

function downloadWordmarkPng(svg: string, textColor: string, filename: string) {
  const wordmarkSvg = `<svg viewBox="0 0 280 48" xmlns="http://www.w3.org/2000/svg">
  ${svg.replace(/<\/?svg[^>]*>/g, "")}
  <text x="56" y="32" font-family="Inter, system-ui, sans-serif" font-size="18" letter-spacing="1.5" fill="${textColor}"><tspan font-weight="400">Co-star</tspan> <tspan font-weight="600">Studio</tspan></text>
</svg>`;
  downloadPng(wordmarkSvg, filename, 1120);
}

export function BrandPage({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<string>("logos");

  const sections = [
    { id: "logos", label: "Logos" },
    { id: "colors", label: "Colors" },
    { id: "typography", label: "Type" },
    { id: "usage", label: "Usage" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="glass-surface sticky top-0 z-40 border-b border-border/40 safe-top">
        <div className="flex items-center justify-between px-4 h-14 max-w-2xl mx-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-back"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-sm font-semibold">Brand</h1>
          <div className="w-12" />
        </div>
      </header>

      <nav aria-label="Brand sections" className="sticky top-14 z-30 glass-surface border-b border-border/40">
        <div className="flex gap-1 px-4 max-w-2xl mx-auto overflow-x-auto">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                "px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors",
                activeSection === s.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
              data-testid={`tab-${s.id}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {activeSection === "logos" && <LogosSection />}
        {activeSection === "colors" && <ColorsSection />}
        {activeSection === "typography" && <TypographySection />}
        {activeSection === "usage" && <UsageSection />}
      </main>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold mb-1">{children}</h2>;
}

function SectionDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground mb-5">{children}</p>;
}

function LogosSection() {
  return (
    <div className="space-y-8">
      <div>
        <SectionTitle>Icon mark</SectionTitle>
        <SectionDescription>The star mark works as an app icon and favicon. Download in SVG for print or PNG for digital.</SectionDescription>
        <div className="grid grid-cols-3 gap-4">
          <LogoPreview svg={LOGO_SVG} bg="bg-white" label="Light" />
          <LogoPreview svg={LOGO_SVG_DARK} bg="bg-[#0A0D12]" label="Dark" />
          <LogoPreview svg={LOGO_SVG_WHITE} bg="bg-gradient-to-br from-primary to-primary/80" label="White" />
        </div>
      </div>

      <div>
        <SectionTitle>Wordmark</SectionTitle>
        <SectionDescription>The full logo with "Co-star Studio" text. Use this where space allows.</SectionDescription>
        <div className="grid grid-cols-1 gap-4">
          <WordmarkPreview svg={LOGO_SVG} textColor="#0F172A" bg="bg-white" label="Light" />
          <WordmarkPreview svg={LOGO_SVG_DARK} textColor="#F0F6FC" bg="bg-[#0A0D12]" label="Dark" />
          <WordmarkPreview svg={LOGO_SVG_WHITE} textColor="#FFFFFF" bg="bg-gradient-to-br from-primary to-primary/80" label="White on color" />
        </div>
      </div>

      <div>
        <SectionTitle>SVG code</SectionTitle>
        <SectionDescription>Copy the raw SVG markup for use in code.</SectionDescription>
        <div className="space-y-3">
          <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium">Icon (light)</span>
              <CopyButton text={LOGO_SVG} label="SVG light" />
            </div>
            <pre className="text-xs text-muted-foreground overflow-x-auto font-mono leading-relaxed">{LOGO_SVG.trim()}</pre>
          </div>
          <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium">Icon (dark)</span>
              <CopyButton text={LOGO_SVG_DARK} label="SVG dark" />
            </div>
            <pre className="text-xs text-muted-foreground overflow-x-auto font-mono leading-relaxed">{LOGO_SVG_DARK.trim()}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorsSection() {
  return (
    <div className="space-y-8">
      <div>
        <SectionTitle>Color palette</SectionTitle>
        <SectionDescription>Core brand colors with light and dark mode values. Click to copy hex codes.</SectionDescription>
        <div className="space-y-2">
          {brandColors.map((color) => (
            <div key={color.name} className="rounded-lg border border-border/40 p-3">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5 flex-shrink-0">
                  <div
                    className="w-10 h-10 rounded-lg border border-border/40 flex items-center justify-center relative group cursor-pointer"
                    style={{ backgroundColor: color.light }}
                    onClick={() => {
                      navigator.clipboard.writeText(color.light);
                    }}
                    title={`Light: ${color.light}`}
                  >
                    <Sun className="w-3 h-3 text-white mix-blend-difference opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div
                    className="w-10 h-10 rounded-lg border border-border/40 flex items-center justify-center relative group cursor-pointer"
                    style={{ backgroundColor: color.dark }}
                    onClick={() => {
                      navigator.clipboard.writeText(color.dark);
                    }}
                    title={`Dark: ${color.dark}`}
                  >
                    <Moon className="w-3 h-3 text-white mix-blend-difference opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{color.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <code className="text-xs text-muted-foreground font-mono">{color.light}</code>
                    <span className="text-xs text-muted-foreground/60">/</span>
                    <code className="text-xs text-muted-foreground font-mono">{color.dark}</code>
                    <CopyButton text={`${color.light} / ${color.dark}`} label={color.name} />
                  </div>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">{color.usage}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>CSS variables</SectionTitle>
        <SectionDescription>Copy the CSS custom properties for your stylesheets.</SectionDescription>
        <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">Root variables</span>
            <CopyButton
              text={brandColors.map((c) => `${c.cssVar}: ${c.light};`).join("\n")}
              label="CSS variables"
            />
          </div>
          <pre className="text-xs text-muted-foreground overflow-x-auto font-mono leading-relaxed">
            {brandColors.map((c) => `${c.cssVar}: ${c.light};`).join("\n")}
          </pre>
        </div>
      </div>
    </div>
  );
}

function TypographySection() {
  return (
    <div className="space-y-8">
      <div>
        <SectionTitle>Typography</SectionTitle>
        <SectionDescription>Inter is the primary typeface. JetBrains Mono for script content and code.</SectionDescription>

        <div className="space-y-1">
          {typographySamples.map((t) => (
            <div key={t.name} className="rounded-lg border border-border/40 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">{t.name}</span>
                <code className="text-[10px] text-muted-foreground/60 font-mono">{t.className}</code>
              </div>
              <p className={t.className}>{t.sample}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>Font stack</SectionTitle>
        <SectionDescription>Copy the font-family declarations.</SectionDescription>
        <div className="space-y-2">
          <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">Sans (primary)</span>
              <CopyButton text="'Inter', system-ui, sans-serif" label="Sans font stack" />
            </div>
            <code className="text-xs text-muted-foreground font-mono">'Inter', system-ui, sans-serif</code>
          </div>
          <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">Mono (scripts)</span>
              <CopyButton text="'JetBrains Mono', monospace" label="Mono font stack" />
            </div>
            <code className="text-xs text-muted-foreground font-mono">'JetBrains Mono', monospace</code>
          </div>
        </div>
      </div>
    </div>
  );
}

function UsageSection() {
  return (
    <div className="space-y-8">
      <div>
        <SectionTitle>Brand name</SectionTitle>
        <SectionDescription>How to write the name in different contexts.</SectionDescription>
        <div className="space-y-2">
          {[
            { context: "Product name", value: "Co-star Studio" },
            { context: "Full lockup", value: "Always use the full name \"Co-star Studio\" in UI, listings, press, and ads." },
            { context: "Visual hierarchy", value: "Co-star (lighter weight) + Studio (heavier weight). Never just \"Co-star\" alone." },
            { context: "Spoken form", value: "Always say \"Co-star Studio\" (never just \"Co-star\")." },
            { context: "In-app copy", value: "Refer to the product as \"your scene partner\" in descriptive text. Never use \"AI\" in user-facing copy." },
            { context: "URL / domain", value: "co-star.app" },
          ].map((item) => (
            <div key={item.context} className="rounded-lg border border-border/40 p-3 flex items-start gap-3">
              <span className="text-xs font-medium text-muted-foreground w-28 flex-shrink-0 pt-0.5">{item.context}</span>
              <span className="text-sm flex-1">{item.value}</span>
              <CopyButton text={item.value} label={item.context} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>Clear space</SectionTitle>
        <SectionDescription>Maintain at least 1x the icon height as padding around the logo on all sides.</SectionDescription>
        <div className="rounded-xl border border-dashed border-border/60 p-8 flex items-center justify-center">
          <div className="border border-dashed border-primary/30 p-6 rounded-lg">
            <div className="w-12 h-12" dangerouslySetInnerHTML={{ __html: LOGO_SVG }} />
          </div>
        </div>
      </div>

      <div>
        <SectionTitle>Do and don't</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {[
            { do: true, text: "Always write \"Co-star Studio\" in full" },
            { do: true, text: "Use the icon mark at 24px or larger" },
            { do: true, text: "Maintain aspect ratio when scaling" },
            { do: true, text: "Use approved color variants only" },
            { do: true, text: "Say \"your scene partner\" in descriptive copy" },
            { do: false, text: "Write just \"Co-star\" without \"Studio\"" },
            { do: false, text: "Use the word \"AI\" in user-facing text" },
            { do: false, text: "Rotate or skew the logo" },
            { do: false, text: "Add effects like shadows or glows" },
            { do: false, text: "Place on busy backgrounds without contrast" },
          ].map((item, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg border p-3 text-xs",
                item.do
                  ? "border-green-500/20 bg-green-500/5 text-green-700 dark:text-green-400"
                  : "border-red-500/20 bg-red-500/5 text-red-700 dark:text-red-400"
              )}
            >
              <span className="font-semibold">{item.do ? "Do" : "Don't"}:</span> {item.text}
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>Border radius</SectionTitle>
        <SectionDescription>Concentric system for consistent rounding.</SectionDescription>
        <div className="space-y-2">
          {[
            { name: "XL (panels)", value: "16px", className: "rounded-[16px]" },
            { name: "LG (cards, overlays)", value: "12px", className: "rounded-[12px]" },
            { name: "MD (buttons)", value: "8px", className: "rounded-[8px]" },
            { name: "SM (badges)", value: "4px", className: "rounded-[4px]" },
          ].map((r) => (
            <div key={r.name} className="flex items-center gap-3 rounded-lg border border-border/40 p-3">
              <div className={cn("w-10 h-10 bg-primary/15 border border-primary/30 flex-shrink-0", r.className)} />
              <div className="flex-1">
                <span className="text-sm font-medium">{r.name}</span>
                <code className="text-xs text-muted-foreground font-mono ml-2">{r.value}</code>
              </div>
              <CopyButton text={r.value} label={r.name} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>Motion</SectionTitle>
        <SectionDescription>Animation guidelines for consistent interaction feel.</SectionDescription>
        <div className="space-y-2">
          {[
            { name: "Duration", value: "200ms" },
            { name: "Easing", value: "ease-out" },
            { name: "Press scale", value: "0.98" },
            { name: "Hover lift", value: "translateY(-1px)" },
          ].map((m) => (
            <div key={m.name} className="flex items-center justify-between rounded-lg border border-border/40 p-3">
              <span className="text-sm font-medium">{m.name}</span>
              <div className="flex items-center gap-1">
                <code className="text-xs text-muted-foreground font-mono">{m.value}</code>
                <CopyButton text={m.value} label={m.name} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

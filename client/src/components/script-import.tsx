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
            "relative rounded-2xl transition-all duration-300",
            isDragging 
              ? "border-2 border-amber-500 bg-amber-500/5 scale-[1.01] shadow-lg shadow-amber-500/10" 
              : script 
                ? "border border-amber-500/30 bg-card/80 shadow-sm" 
                : "border border-border/60 hover:border-amber-500/30 bg-card/50",
            "focus-within:border-amber-500/50 focus-within:shadow-md focus-within:shadow-amber-500/5"
          )}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
        >
          <Textarea
            ref={textareaRef}
            id="script-text"
            placeholder={`Paste your script here...

Spot will auto-detect your characters!

FORMAT EXAMPLE:
JULIET: Romeo, Romeo, wherefore art thou Romeo?
ROMEO: [calling up] I take thee at thy word!
JULIET: [surprised] What man art thou?

Stage directions go in [brackets]`}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            className="min-h-[220px] border-0 resize-none focus-visible:ring-0 text-base rounded-2xl bg-transparent leading-relaxed placeholder:text-muted-foreground/50"
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
            <div className="flex items-center gap-1.5 animate-fade-in" data-testid="text-character-count">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span className="text-[11px] text-muted-foreground">
                Found <span className="font-semibold text-amber-600 dark:text-amber-400">{characters.length}</span> character{characters.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
        
        {script && characters.length > 0 && (
          <div className="flex flex-wrap gap-1.5 animate-fade-in">
            {characters.slice(0, 5).map((char, i) => (
              <span 
                key={char}
                className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {char}
              </span>
            ))}
            {characters.length > 5 && (
              <span className="px-2.5 py-1 text-[11px] text-muted-foreground/70">
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
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={cn(
            "w-full h-14 text-base font-semibold rounded-2xl flex items-center justify-center gap-2.5 transition-all duration-300",
            canSubmit 
              ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30 active:scale-[0.98]"
              : "bg-muted/50 text-muted-foreground cursor-not-allowed"
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
        </button>
        
        {canSubmit && (
          <p className="text-center text-xs text-muted-foreground/70 animate-fade-in">
            {encouragement}
          </p>
        )}
      </div>
      
      {!script && showTip && (
        <div className="text-center space-y-2 animate-fade-in">
          <p className="text-[11px] text-muted-foreground/70">
            Just want to try it out?
          </p>
          <button 
            onClick={() => setScript(getRandomSampleScript())}
            className="inline-flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400 font-medium hover:underline underline-offset-4 transition-all"
            data-testid="button-load-sample"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Surprise me with a scene
          </button>
        </div>
      )}
    </div>
  );
}

const SAMPLE_SCRIPTS = [
  // Comedy: Restaurant chaos
  `CHEF MARCO: [frantically stirring] The food critic arrives in ten minutes and we have NO LOBSTER!
SOUS CHEF KIM: [panicking] I thought you ordered the lobster!
CHEF MARCO: I thought YOU ordered the lobster!
WAITER DEREK: [bursting in] Table seven just asked if we have lobster. They seem... important.
CHEF MARCO: [whispering intensely] Tell them the lobster is... on a spiritual journey.
WAITER DEREK: [confused] A what now?
SOUS CHEF KIM: [grabbing his arm] Tell them it's a deconstructed lobster experience. Very avant-garde.
CHEF MARCO: [inspired] Yes! Invisible lobster! The essence of lobster without the physical form!
WAITER DEREK: [deadpan] You want me to serve invisible lobster to the most famous food critic in the city.
CHEF MARCO: [grandly] Art, Derek. We're serving ART.
SOUS CHEF KIM: [finding something] Wait! I found frozen fish sticks in the back!
CHEF MARCO: [dramatically] Tonight... fish sticks become LEGEND.
WAITER DEREK: [exiting, muttering] I should have stayed in law school.`,

  // Drama: Siblings reunite
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

  // Comedy: Awkward first date
  `TAYLOR: [nervously] So... you're really into taxidermy?
MORGAN: [enthusiastically] Oh absolutely! Want to see photos of my collection?
TAYLOR: [forcing smile] Maybe after appetizers?
MORGAN: [pulling out phone anyway] This is Mr. Whiskers. He was my childhood cat.
TAYLOR: [choking on water] You... stuffed your childhood cat?
MORGAN: [beaming] He watches over my bed! Very comforting.
TAYLOR: [looking for exits] That's... one word for it.
MORGAN: [oblivious] My therapist says it's a healthy coping mechanism.
TAYLOR: [muttering] Your therapist needs a therapist.
MORGAN: What was that?
TAYLOR: [loudly] I said the WEATHER is impressive!
MORGAN: [excited] Speaking of weather, I also collect vintage weather vanes! Shaped like roosters mostly.
TAYLOR: [defeated] Of course you do.
MORGAN: [leaning in] I feel like we really have a connection. Same time next week?
TAYLOR: [standing abruptly] I just remembered I'm moving to Antarctica. Tonight.`,

  // Thriller: The heist
  `RAVEN: [whispering] Thirty seconds until the guards rotate. Everyone ready?
GHOST: [adjusting earpiece] Vault sensors are offline. You're clear.
PHOENIX: [cracking knuckles] I've been dreaming about this safe for six months.
RAVEN: [checking watch] Remember, we're not here for the diamonds.
PHOENIX: [confused] We're not?
GHOST: [tense] The flash drive in safety deposit box 1247. That's the target.
PHOENIX: [disappointed] So no diamonds at all?
RAVEN: [firm] Focus. This drive contains evidence that could bring down Senator Vance.
GHOST: [warning] Motion sensor at your two o'clock. Freeze.
RAVEN: [frozen] How long?
GHOST: [counting] Three... two... one. Clear.
PHOENIX: [reaching the vault] I'm in. Box 1247... got it.
RAVEN: [urgent] Time to go. Security shift in ninety seconds.
GHOST: [panicked] Wait. I'm seeing additional heat signatures. You have company.
PHOENIX: [whispered] How many?
GHOST: [grim] Enough to make this very interesting.
RAVEN: [determined] Then we improvise. We always do.`,

  // Romantic comedy: Wrong wedding
  `JAMIE: [bursting in] I object! Don't marry him!
PRIEST: [startled] We're at the reception. They're already married.
JAMIE: [deflating] Oh. Well. This is awkward.
BRIDE ALEX: [shocked] Jamie?! What are you doing here?
JAMIE: [confused] Stopping you from making the biggest mistake of your life?
GROOM CHRIS: [annoyed] The ceremony was two hours ago. You're objecting to the cake cutting.
JAMIE: [looking around] This isn't St. Michael's Church?
ALEX: [exasperated] This is the Riverside Banquet Hall!
JAMIE: [horrified realization] Oh no. I'm at the wrong wedding.
CHRIS: [arms crossed] Clearly.
JAMIE: [backing away] I should... probably go stop the actual wedding I meant to crash.
ALEX: [curious despite herself] Wait, whose wedding ARE you crashing?
JAMIE: [sheepish] My ex. Who may have been cheating on me. With a llama farmer.
CHRIS: [intrigued] A llama farmer?
JAMIE: [sighing] It's a long story involving a county fair.
ALEX: [to Chris] Honey, I think we should invite them to stay. This sounds better than our DJ.`,

  // Sci-fi: First contact
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
COMMANDER REYES: [to Patel] Doctor, please. Dignity.
ZRIX: [curious] Why do your people not have three eyes? Very inefficient.
COMMANDER REYES: [tired] It's been a long evolutionary road.
ZRIX: [sympathetically] We can share our DNA technology. But first... more TV recommendations?`,

  // Period drama: Royal scandal
  `QUEEN ELEANOR: [coldly] You dare enter my chambers unannounced?
LADY CATHERINE: [trembling] Your Majesty, I bring urgent news from the northern provinces.
QUEEN ELEANOR: [raising an eyebrow] Speak.
LADY CATHERINE: [hesitant] It concerns... the King's hunting expedition.
QUEEN ELEANOR: [dismissive] My husband's pursuits bore me. Get to the point.
LADY CATHERINE: [blurting] He's not hunting deer, Your Majesty. He's meeting with Lord Ashworth. In secret.
QUEEN ELEANOR: [dangerously quiet] Ashworth. The man who tried to usurp my throne.
LADY CATHERINE: [nodding] They were seen exchanging documents.
QUEEN ELEANOR: [standing] How long have you known this?
LADY CATHERINE: [falling to knees] Three days. I was afraid to—
QUEEN ELEANOR: [cutting her off] Afraid? Loyalty knows no fear, Catherine.
LADY CATHERINE: [desperately] I swear my allegiance to you, Majesty. Only you.
QUEEN ELEANOR: [walking to window] Summon Sir Thomas. Quietly.
LADY CATHERINE: [confused] The spymaster?
QUEEN ELEANOR: [smiling coldly] If my husband wishes to play politics... I shall remind him who taught him the game.`,

  // Comedy: Superhero support group
  `BLAZE: [sighing] I accidentally set my apartment on fire again. Third time this month.
INVISIBLE IVY: [sympathetic] At least people can see the damage. Nobody notices when I bump into them.
CAPTAIN STATIC: [hair standing up] Has anyone tried rubber-soled shoes? I keep shocking my cats.
BLAZE: You have cats? With your power?
CAPTAIN STATIC: [sadly] Had cats. They live with my ex now. Very singed.
MINDREADER MIKE: [covering ears] Can everyone please think QUIETER? I'm getting a migraine.
INVISIBLE IVY: [frustrated] Oh, I'm so sorry my inner monologue about my failing marriage is bothering you!
BLAZE: [to group leader] Is this helping? Be honest.
GROUP LEADER: [cheerfully] Progress is progress! Now, who wants to share a positive experience?
CAPTAIN STATIC: [brightening] I charged my neighbor's Tesla!
INVISIBLE IVY: [muttering] Show-off.
MINDREADER MIKE: [pointing at Ivy] I heard that.
INVISIBLE IVY: THE POINT IS THAT YOU SHOULDN'T.
BLAZE: [flames appearing] Everyone calm down before I ruin another building.
GROUP LEADER: [backing away] Deep breaths! Remember what we practiced! Fire extinguisher is by the door!`
];

function getRandomSampleScript(): string {
  return SAMPLE_SCRIPTS[Math.floor(Math.random() * SAMPLE_SCRIPTS.length)];
}

import type { ParsedScript, Role, Scene, ScriptLine } from "@shared/schema";
import { detectEmotion } from "./tts-engine";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

const DIRECTION_REGEX = /\[([^\]]+)\]/g;
const PARENTHETICAL_REGEX = /\(([^)]+)\)/g;

// Scene headings - now includes INSERT shots
const SCENE_HEADING_REGEX = /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.|INSERT\s*[-–—]|SCENE\s*\d|ACT\s*[IVX\d]|FADE IN:|FADE OUT:|THE SCREEN)/i;

// Common screenplay transitions that should be ignored
const TRANSITION_REGEX = /^(FADE TO:|DISSOLVE TO:|CUT TO:|SMASH CUT TO:|MATCH CUT TO:|JUMP CUT TO:|FADE OUT\.|FADE IN\.|THE END|CONTINUED|MORE|\d+\.?\s*$)$/i;

// Scene numbers in professional screenplays (e.g., "1", "1A", "13B", "215C-G")
const SCENE_NUMBER_REGEX = /^\d+[A-Z]?(?:[\s\-–—]+\d*[A-Z]?)?\s*$/;

// Lines to skip entirely
const SKIP_LINE_PATTERNS = [
  /^OMITTED\s*$/i,
  /^\d+[A-Z]?\s+OMITTED\s+\d+[A-Z]?\s*$/i, // "10 OMITTED 10"
  /^thru$/i,
  /^THRO:$/i,
  /^FOR EDUCATIONAL PURPOSES/i,
  /^Script provided for educational/i,
  /^http/i,
  /^\*+\s*$/,  // Just asterisks
  /^=+\s*$/,  // Just equals signs
  /^-+\s*$/,  // Just dashes
  /^\\+\s*$/,  // Just backslashes (OCR artifact)
  /^[^\w\s]+$/,  // Lines with only punctuation/symbols
  /^===\s*\[PAGE\s+\d+\]\s*===$/i, // Page markers like "=== [PAGE 1] ==="
  /^Page\s+\d+/i,
  /^\s*\d+\.\s*$/, // Just page numbers like "2."
  /^\d+\s*$/,  // Just numbers
  // Publisher/legal content
  /^DRAMATISTS\s+PLAY\s+SERVICE/i,
  /^PLAY\s+SE/i,  // OCR partial of "PLAY SERVICE"
  /^INC\.?\s*$/i,
  /^www\./i,
  /^CAUTION:/i,
  /^Professionals and amateurs/i,
  /^All rights/i,
  /^No person, firm/i,
  /^Inquiries concerning/i,
  /^SPECIAL NOTE/i,
  /^Anyone receiving permission/i,
  /^The billing must appear/i,
  /^The following acknowledgment/i,
  // Title page content
  /^BY\s+[A-Z]/i, // "BY MO GAFFNEY" etc.
  /^Written by\b/i,
  /^Revisions? by\b/i,
  /^Screenplay by\b/i,
  /^Story by\b/i,
  /^Based on\b/i,
  /^Original screenplay/i,
  /^Teleplay by\b/i,
  /^Created by\b/i,
  /^Conceived by\b/i,
  /^Directed by\b/i,
  /^Produced by\b/i,
  /^\d{1,2}(st|nd|rd|th)?\s+(Draft|Revision)/i, // "1st Draft", "2nd Revision"
  /^(First|Second|Third|Final)\s+(Draft|Revision)/i,
  /^(White|Blue|Pink|Yellow|Green|Goldenrod|Buff|Salmon|Cherry)\s+(Revised?|Draft|Pages?)/i, // Production draft colors
  /^D\.A\.\s/i, // "D.A. First Draft", "D.A. Blue", etc.
  /^(January|February|March|April|May|June|July|August|September|October|November|December)\s*\d{0,2}/i, // Date patterns - "May", "April 20"
  /^\d{1,2}\/\d{1,2}\/\d{2,4}/i, // Date patterns like 04/20/2000
  /^-\s*(January|February|March|April|May|June|July|August|September|October|November|December)/i, // "- May", "- April"
  /^Copyright\s*[©@]?/i,
  /^All rights reserved/i,
  /^Registered\s+WGA/i,
  /^Contact:/i,
  /^Property of\b/i,
  /^CONFIDENTIAL/i,
  /^SHOOTING SCRIPT/i,
  /^PRODUCTION DRAFT/i,
  /^WORKING TITLE/i,
  /^AKA\s/i, // "AKA RACER X" - alternate title
  /^A\.?K\.?A\.?\s/i,
  /^-\s*\d{4}\s*$/i, // "- 2000" year alone
  /^-\s*\w+\s*$/i, // "- May" fragment alone
  /^\d{4}\s*$/i, // Just a year "2000"
  // Stage play specific
  /^CONTENTS\s*$/i,
  /^End of Play\s*$/i,
  /^CHARACTERS?\s*$/i,
  /^SETTING\s*$/i,
  /^TIME\s*$/i,
  /^PLACE\s*$/i,
  /^CAST\s*(OF CHARACTERS)?\s*$/i,
];

// Patterns that indicate a line is definitely NOT a character name
const NOT_CHARACTER_PATTERNS = [
  /^D\.A\.$/i, // Writer initials
  /^AKA$/i,
  /^-$/,
  /^\d+$/,
  /^(January|February|March|April|May|June|July|August|September|October|November|December)$/i,
  /^(First|Second|Third|Final)$/i,
  /^(Draft|Revision|Revised)$/i,
  /^(Blue|Pink|White|Yellow|Green)$/i,
  // "I [VERB]" patterns - dialogue fragments, not names
  /^I\s+(THOUGHT|THINK|KNOW|KNEW|WANT|WANTED|NEED|NEEDED|SAID|SAY|SEE|SAW|FEEL|FELT|HEARD|HEAR|WISH|HOPE|BELIEVE|BELIEVED|WONDER|WONDERED|GUESS|GUESSED|MEAN|MEANT|REMEMBER|FORGOT|UNDERSTAND|UNDERSTOOD|LOVE|LOVED|HATE|HATED|LIKE|LIKED|AM|WAS|WILL|WOULD|CAN|COULD|SHOULD|MUST|HAVE|HAD|DO|DID|DONT|DIDNT|CANT|COULDNT|WONT|WOULDNT)$/i,
  // Common dialogue starters that aren't names
  /^(WHAT|WHY|HOW|WHEN|WHERE|WHO|WHICH|WHOSE)$/i,
  /^(YES|NO|YEAH|NAH|OKAY|OK|SURE|FINE|WELL|RIGHT|LOOK|LISTEN|HEY|HI|HELLO|BYE|GOODBYE)$/i,
  // Sound effects / onomatopoeia that are NOT character names
  /^(SCREAMS?|YELLS?|SHOUTS?|CRIES|WHISPERS?|SIGHS?|GASPS?|LAUGHS?|GROANS?|MOANS?|HOWLS?|VROOM|CRASH|BANG|BOOM|SLAM|CLICK|BEEP|RING|BUZZ|HONK|THUD|SPLAT|WHOOSH|SCREECH|ROAR|GROWL|SNORE|COUGH|SNEEZE|CLAP|STOMP|THUMP|KNOCK|DING|CHIME|SWISH|SWOOSH|CRACK|SNAP|POP|CRUNCH|SPLASH|SIZZLE|RUMBLE|THUNDER|LIGHTNING|EXPLOSION|GUNSHOT|GUNFIRE|ENGINE|TIRES|BRAKES)$/i,
  // Camera/editing terms that look like character names but aren't
  /^(ANGLE|SHOT|CLOSE|CLOSEUP|WIDE|MEDIUM|INSERT|FLASHBACK|MONTAGE|INTERCUT|CONTINUOUS|LATER|MEANWHILE|SUDDENLY|SILENCE|PAUSE|BEAT|GEARS|TURBINE)$/i,
  // Time transitions - NOT character names
  /^(MINUTES?|HOURS?|DAYS?|WEEKS?|MONTHS?|YEARS?|SECONDS?|MOMENTS?)\s+(LATER|EARLIER|AGO|BEFORE|AFTER)$/i,
  /^(LATER|EARLIER|NEXT|PREVIOUS|SAME)\s+(DAY|NIGHT|MORNING|EVENING|AFTERNOON|TIME)$/i,
  /^(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)\s+(MINUTES?|HOURS?|DAYS?|WEEKS?|MONTHS?|YEARS?)(\s+LATER)?$/i,
  // Common location words that appear as standalone lines in PDFs
  /^(BACKYARD|FRONTYARD|DRIVEWAY|GARAGE|BASEMENT|ATTIC|HALLWAY|STAIRWAY|STAIRCASE|ROOFTOP|BALCONY|PATIO|PORCH|DECK|GARDEN|KITCHEN|BEDROOM|BATHROOM|LIVING\s*ROOM|DINING\s*ROOM|OFFICE|LOBBY|ELEVATOR|CORRIDOR|ALLEY|SIDEWALK|STREET|ROAD|HIGHWAY|PARKING\s*LOT|WAREHOUSE|FACTORY|BUILDING|APARTMENT|HOUSE|MANSION|CABIN|HOTEL|MOTEL|HOSPITAL|SCHOOL|CHURCH|STORE|SHOP|RESTAURANT|BAR|CLUB|STADIUM|ARENA|BEACH|FOREST|WOODS|MOUNTAIN|DESERT|OCEAN|LAKE|RIVER|BRIDGE|TUNNEL|SUBWAY|AIRPORT|STATION|PRISON|JAIL|COURT|COURTROOM|CEMETERY|MORGUE)$/i,
];

// Valid single-letter dialogue (exclamations, sounds)
const VALID_SHORT_DIALOGUE = new Set([
  'a', 'i', 'o', // Actual letters that can be dialogue
  '...', '?', '!', // Punctuation-only
]);

// Check if dialogue is valid (not OCR garbage or action prose)
function isValidDialogue(text: string): boolean {
  if (!text) return false;
  
  const trimmed = text.trim();
  
  // Reject empty
  if (!trimmed) return false;
  
  // For very short text (1-3 chars), be strict
  if (trimmed.length <= 3) {
    const lower = trimmed.toLowerCase();
    // Allow valid short dialogue like "I", "A", "OK", "?", "!"
    if (VALID_SHORT_DIALOGUE.has(lower)) return true;
    if (/^(ok|no|hi|go|oh|ah|ow|um|uh|hm|eh|so|up|in|on|do|it|is|am|be|we|us|me|my|an|or|as|at|by|to|if)$/i.test(trimmed)) return true;
    if (/^[.!?]+$/.test(trimmed)) return true; // Punctuation only
    
    // Single letters that aren't meaningful words are garbage
    if (/^[a-z]$/i.test(trimmed)) {
      // Only "I", "A", and "O" are valid single-letter words
      if (!/^[aioAIO]$/.test(trimmed)) {
        return false;
      }
    }
    
    // 2-3 random letters are likely OCR garbage
    if (/^[a-z]{2,3}$/i.test(trimmed) && !/^(ok|no|hi|go|oh|ah|ow|um|uh|hm|eh|so|up|in|on|do|it|is|am|be|we|us|me|my|an|or|as|at|by|to|if|yes|yep|nah|hey|bye|why|who|how|now|out|off|run|see|get|got|let|put|say|try|too|all|but|can|did|has|had|not|its|own|per|and|the|was|are|you|for|any|one|two|via)$/i.test(trimmed)) {
      return false;
    }
  }
  
  // Check if mostly non-alphabetic (OCR garbage like "~.;,.-")
  const letters = (trimmed.match(/[a-zA-Z]/g) || []).length;
  const total = trimmed.replace(/\s/g, '').length;
  if (total > 3 && letters / total < 0.3) {
    return false; // Less than 30% letters = likely garbage
  }
  
  // === GENERAL PROSE/ACTION DETECTION ===
  // These patterns indicate narrative description, not spoken dialogue
  
  // "The [word]" at start is almost always action/prose, not dialogue
  // Real dialogue rarely starts with "The" + noun phrase
  if (/^The\s+[a-z]+\s+(is|are|was|were|has|have|had|does|do|did|can|could|will|would|shall|should|may|might|must|spins?|rolls?|moves?|goes?|comes?|falls?|rises?|opens?|closes?|turns?|shifts?|sits?|stands?|lies?|lands?|hits?|runs?|walks?|drives?|flies?|floats?|shakes?|rattles?|rumbles?|glows?|flashes?|flickers?|burns?|explodes?|crashes?|slams?|bangs?|cracks?|snaps?|pops?|clicks?|beeps?|rings?|buzzes?|honks?|roars?|screams?|howls?|whistles?|hisses?|sizzles?)\b/i.test(trimmed)) {
    return false;
  }
  
  // Third-person pronouns + verbs = action description
  if (/^(He|She|They|It|His|Her|Their|Its)\s+[a-z]/i.test(trimmed)) {
    // More general: if it starts with he/she/they/it + any word, it's likely prose
    // Real dialogue uses "I", "You", "We" as subjects
    if (/^(He|She|They|It)\s+(is|are|was|were|has|had|does|did|will|would|can|could|shall|should|may|might|must)\b/i.test(trimmed)) {
      return false;
    }
    // He/She + verb patterns
    if (/^(He|She|They|It)\s+[a-z]+s\b/i.test(trimmed)) {
      return false; // "He walks", "She runs", etc.
    }
  }
  
  // Possessive pronouns starting prose: "His eyes narrow", "Her hand trembles"
  if (/^(His|Her|Their|Its)\s+[a-z]+\s+(is|are|was|were|narrow|widen|flash|gleam|dart|focus|soften|harden|shake|tremble|grip|release|move|open|close|rise|fall|drop|lift|reach|grab|pull|push|turn|twist|clench|relax)\b/i.test(trimmed)) {
    return false;
  }
  
  // Stage direction markers that indicate action, not dialogue
  // Bullets, dashes, asterisks at start or mixed in
  if (/^[•\-\*–—]\s+[A-Z]/i.test(trimmed)) {
    return false; // "• VROOM! The car..." 
  }
  
  // Multiple ALL-CAPS words mixed with prose = likely action description with sound effects
  // e.g., "The turbine HOWLS. 1st gear, clutch up."
  const capsWords = (trimmed.match(/\b[A-Z]{2,}\b/g) || []).length;
  const totalWords = (trimmed.match(/\b\w+\b/g) || []).length;
  if (totalWords > 5 && capsWords >= 2 && capsWords / totalWords > 0.2) {
    // High ratio of ALL-CAPS words mixed with normal text = action prose with sound effects
    return false;
  }
  
  // Camera/technical directions embedded in text
  if (/\b(CUT TO|FADE|DISSOLVE|ANGLE ON|CLOSE ON|POV|SLOW MOTION|FREEZE FRAME)\b/i.test(trimmed)) {
    return false;
  }
  
  // Very long "dialogue" with multiple sentences describing action
  // Real dialogue can be long, but action prose has specific patterns
  if (trimmed.length > 100) {
    // Contains third-person references to characters by action (not in quotes)
    if (/\b(he|she|they|it)\s+(shifts?|struggles?|fishtails?|rockets?|spins?|shimmies?|floats?|misfits?)\b/i.test(trimmed)) {
      return false;
    }
  }
  
  return true;
}

// Validate that context is actually stage direction/action, not dialogue fragments
function isValidContext(text: string): boolean {
  if (!text) return false;
  
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.length < 5) return false; // Too short to be meaningful context
  
  // Context should NOT look like dialogue fragments
  // Dialogue fragments typically have:
  // - Personal pronouns in conversational patterns ("and he was", "but she said")
  // - Run-on patterns with "and" that continue thoughts
  // - Incomplete sentences that trail off
  
  // Fragment patterns that indicate broken dialogue, not action
  if (/^(and|but|or|so|then|because|that|which|who|when|where|if|though|although)\s+/i.test(trimmed)) {
    return false; // Starts with conjunction = probably fragment
  }
  
  // "[Name] and he/she..." patterns = dialogue fragment
  if (/^[A-Z][a-z]+\s+and\s+(he|she|they|I|we)\s+/i.test(trimmed)) {
    return false; // "Ben and he had..." is dialogue
  }
  
  // "and he/she [verb]" patterns mid-sentence
  if (/\band\s+(he|she|I|we)\s+(had|was|were|is|are|would|could|should|will|did)\b/i.test(trimmed)) {
    return false; // Conversational fragment
  }
  
  // Valid context should have action-like patterns:
  // - Stage directions in brackets: [he stands]
  // - Third-person action: "He walks to the door"
  // - Scene description: "The room is dark"
  // - Camera directions: "ANGLE ON", "CLOSE UP"
  
  // Accept bracketed directions
  if (/^\[.*\]$/.test(trimmed)) return true;
  if (/^\(.*\)$/.test(trimmed)) return true;
  
  // Accept clear action patterns
  if (/^(He|She|They|It)\s+(is|are|was|were|walks?|runs?|looks?|turns?|enters?|exits?|stands?|sits?|moves?|picks?|grabs?|holds?|opens?|closes?)/i.test(trimmed)) {
    return true;
  }
  
  // Accept scene descriptions
  if (/^(The|A|An)\s+[a-z]+\s+(is|are|was|were|opens?|closes?|sits?|stands?|lies?)/i.test(trimmed)) {
    return true;
  }
  
  // Accept camera/transition directions
  if (/^(CUT|FADE|DISSOLVE|ANGLE|CLOSE|WIDE|PAN|ZOOM|INTERCUT|LATER|MEANWHILE|CONTINUOUS)/i.test(trimmed)) {
    return true;
  }
  
  // Accept "beat", "pause", "silence" type directions
  if (/^(beat|pause|silence|a\s+moment|a\s+beat)/i.test(trimmed)) {
    return true;
  }
  
  // If none of the above, be conservative and reject
  // It's better to skip dubious context than show dialogue fragments
  // Only accept if it has clear action verbs with third-person subjects
  const hasThirdPersonAction = /\b(he|she|they|it)\s+[a-z]+s\b/i.test(trimmed) && 
    !/\b(and|but|or)\s+(he|she|they|I|we)\b/i.test(trimmed);
  
  return hasThirdPersonAction;
}

// Clean a line by removing scene numbers from margins and revision marks
function cleanScriptLine(line: string): string {
  let cleaned = line;
  
  // Remove revision asterisks at end (can be multiple)
  cleaned = cleaned.replace(/\s*\*+\s*$/, '');
  
  // Remove scene numbers from START of line (e.g., "1   EXT." -> "EXT.")
  // Match: digits + optional letter + whitespace at start
  cleaned = cleaned.replace(/^\d+[A-Z]?\s+/, '');
  
  // Remove scene numbers from END of line (e.g., "EXT. HOUSE - DAY   1" -> "EXT. HOUSE - DAY")
  // Match: whitespace + digits + optional letter at end
  cleaned = cleaned.replace(/\s+\d+[A-Z]?\s*$/, '');
  
  // Handle dual scene numbers like "1A  EXT. HOUSE - DAY  1A"
  // After removing start, we might still have end number
  cleaned = cleaned.replace(/\s+\d+[A-Z]?\s*$/, '');
  
  return cleaned.trim();
}

// Clean dialogue text to remove OCR artifacts and production notes
function cleanDialogueText(text: string): string {
  let cleaned = text;
  
  // Remove production notes like "4 OMITTED", "SCENES 5-7 OMITTED", "12A OMITTED"
  cleaned = cleaned.replace(/\s*\d+[A-Z]?\s*OMITTED\s*/gi, ' ');
  cleaned = cleaned.replace(/\s*SCENES?\s+\d+(-\d+)?[A-Z]?\s*OMITTED\s*/gi, ' ');
  cleaned = cleaned.replace(/\s*OMITTED\s*/gi, ' ');
  
  // Remove embedded character names with extensions mid-text
  // e.g., "...please? JOHN passes his" or "OFFICER HUDSON (CONT'D) Have you"
  // These are other character lines that got merged in
  cleaned = cleaned.replace(/\s+[A-Z]{2,}(?:\s+[A-Z]{2,})?\s*\([^)]*\)\s+[A-Z][a-z]/g, ' ');
  
  // Remove "NAME action verb phrase" patterns (action lines mixed in)
  // e.g., "JOHN passes his documents out to the Officer."
  cleaned = cleaned.replace(/\s+[A-Z]{2,}\s+(passes|walks|looks|turns|enters|exits|stands|sits|moves|picks|grabs|holds|opens|closes|falls|runs|comes|goes|takes|puts|gets|sees|hears|watches|crosses|leaves|hands|reaches|pulls|pushes|throws|catches|nods|shakes|smiles|laughs|points)[^.!?]*[.!?]/gi, '. ');
  
  // Replace bullet characters with proper ellipsis
  cleaned = cleaned.replace(/•{2,}/g, '...'); // Multiple bullets -> ellipsis
  cleaned = cleaned.replace(/•/g, '.'); // Single bullet -> period
  
  // Fix OCR tilde artifacts (I~ -> I, word~ -> word)
  cleaned = cleaned.replace(/~+/g, '');
  
  // Fix common OCR artifacts
  cleaned = cleaned.replace(/\|/g, 'I'); // Pipe often OCR'd instead of I
  cleaned = cleaned.replace(/\s+\|\s+/g, ' '); // Stray pipes
  cleaned = cleaned.replace(/`/g, "'"); // Backtick to apostrophe
  
  // Clean up excessive punctuation
  cleaned = cleaned.replace(/\.{4,}/g, '...'); // Too many dots
  cleaned = cleaned.replace(/\s*\.\s*\.\s*\.\s*/g, '... '); // Spaced dots
  
  // Fix spacing issues
  cleaned = cleaned.replace(/\s{2,}/g, ' '); // Multiple spaces
  
  // Fix merged character names at start: "HUDSONGood evening" -> "Good evening"
  // This removes the accidentally merged character name from dialogue
  cleaned = cleaned.replace(/^[A-Z]{2,}(?:\s+[A-Z]{2,})?(?:\s*\([^)]*\))?\s*/, '');
  
  // Also clean trailing character name patterns
  // e.g., "...please? OFFICER HUDSON" at end
  cleaned = cleaned.replace(/[.!?]\s*[A-Z]{2,}(?:\s+[A-Z]{2,})?(?:\s*\([^)]*\))?\s*$/g, '. ');
  
  return cleaned.trim();
}

// Check if a line should be skipped entirely
function shouldSkipLine(line: string): boolean {
  const trimmed = line.trim();
  
  // Check against skip patterns
  for (const pattern of SKIP_LINE_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  
  // Scene numbers only (like "1", "1A", "13B")
  if (SCENE_NUMBER_REGEX.test(trimmed)) return true;
  
  // Very short lines that are just punctuation or numbers
  if (/^[\d\.\*\-–—\s]+$/.test(trimmed)) return true;
  
  return false;
}

const CHARACTER_EXTENSIONS = [
  "V.O.", "VO", "V/O", "VOICE OVER", "VOICEOVER", "VOICE-OVER",
  "O.S.", "OS", "O/S", "OFF SCREEN", "OFFSCREEN", "OFF-SCREEN",
  "O.C.", "OC", "OFF CAMERA", "OFF-CAMERA",
  "CONT'D", "CONT", "CONTINUED", "CONTINUING",
  "PRE-LAP", "PRELAP", "PRE LAP",
  "FILTER", "ON PHONE", "ON TV", "ON RADIO", "OVER PHONE",
  "SUBTITLE", "SUBTITLED", "TRANSLATED",
  "INTO PHONE", "INTO RADIO", "INTO MIC"
];

const EXTENSION_PATTERN = new RegExp(
  `\\s*\\((?:${CHARACTER_EXTENSIONS.join("|")})\\)\\s*`,
  "gi"
);

// Reserved words that should NOT be character names
const RESERVED_WORDS = new Set([
  "INT", "EXT", "INTERIOR", "EXTERIOR", "DAY", "NIGHT", "DAWN", "DUSK",
  "CONTINUOUS", "LATER", "MOMENTS LATER", "SAME", "FLASHBACK",
  "FADE", "CUT", "DISSOLVE", "SMASH", "MATCH", "JUMP", "THE END",
  "CONTINUED", "MORE", "ANGLE ON", "CLOSE ON", "WIDE ON", "INSERT",
  "POV", "SUPER", "TITLE", "SUBTITLE", "CHYRON", "MONTAGE", "SERIES OF SHOTS",
  "BEGIN", "END", "BACK TO", "INTERCUT", "SPLIT SCREEN",
  // Common scene direction starters
  "CUT TO", "FADE TO", "SMASH CUT", "JUMP CUT", "MATCH CUT", "DISSOLVE TO",
  // Two-word technical/cinematic phrases
  "SPEED TRAP", "TIME LAPSE", "SLOW MOTION", "FAST FORWARD", "FLASH BACK",
  "FADE IN", "FADE OUT", "BLACK OUT", "WHITE OUT",
  // Sound/music cues (NOT characters!)
  "MUSIC", "SOUND", "SFX", "SCORE", "SONG", "AUDIO",
  // Generic words that aren't names
  "THINGS", "STUFF", "SOMETHING", "NOTHING", "EVERYTHING", "ANYTHING",
  "PRIORITY", "IMPORTANT", "NOTE", "NOTES", "COMMENT", "COMMENTS",
  "SCENE", "SCENES", "ACT", "ACTS", "PART", "PARTS", "CHAPTER", "CHAPTERS",
  // Preposition phrases
  "IN THE", "ON THE", "AT THE", "TO THE", "FOR THE", "WITH THE",
  // Known false positives
  "PRIORITY IN THIS JOB", "WE SEE", "WE HEAR",
  // Common English words that are NOT character names (articles, conjunctions, etc.)
  "THE", "A", "AN", "AND", "OR", "BUT", "FOR", "NOR", "SO", "YET",
  "THIS", "THAT", "THESE", "THOSE", "THERE", "HERE", "WHERE", "WHEN",
  "ALL", "SOME", "MANY", "FEW", "MOST", "ANY", "EACH", "EVERY", "OTHER",
  "NEW", "OLD", "BIG", "SMALL", "FIRST", "LAST", "NEXT", "SAME", "ONLY",
  "THEN", "NOW", "JUST", "ALSO", "VERY", "STILL", "ALREADY", "ALMOST",
  "BACK", "DOWN", "OFF", "OUT", "OVER", "UNDER", "UP", "AWAY", "AROUND",
  "ABOUT", "AFTER", "BEFORE", "BETWEEN", "DURING", "FROM", "INTO", "ONTO",
  "THROUGH", "UNTIL", "WITHIN", "WITHOUT", "ALONG", "ACROSS", "BEHIND",
  // Production/script terms
  "OMITTED", "REVISED", "DRAFT", "FINAL", "REVISION",
  "PAGE", "PAGES", "SCRIPT", "SCREENPLAY", "TELEPLAY",
]);

// Pattern to detect sound/music cue lines (e.g., "MUSIC: Jazz tune plays")
const SOUND_CUE_REGEX = /^(MUSIC|SOUND|SFX|SCORE|SONG|AUDIO)\s*:/i;

// Detect action description lines (third-person narrative describing what happens)
// BE CONSERVATIVE - only detect very obvious action lines to avoid filtering dialogue
function isActionDescriptionLine(line: string): boolean {
  const trimmed = line.trim();
  
  // Skip if it looks like dialogue (starts with common dialogue patterns)
  if (/^(I\s|I'm|I've|I'll|I'd|You\s|You're|My\s|What|Why|How|When|Where|Who|No,|Yes,|Oh,|Well,|But\s|And\s|So\s|Just\s|Look,|Listen,|Hey|Hi|Wait|Please|Thank|Sorry|Okay|Ok,|Alright|Don't|Can't|Won't|Didn't|Isn't|Aren't|Let's|Let me|That's|There's|It's|We're|They're)/i.test(trimmed)) {
    return false;
  }
  
  // Only detect very obvious third-person action descriptions
  // e.g., "He walks away", "She looks at him", "They exit"
  const actionPatterns = [
    // Third person pronouns + verb (very reliable)
    /^(He|She|They|It)\s+(is|are|was|were|walks?|runs?|looks?|turns?|moves?|stands?|sits?|enters?|exits?|comes?|goes?|falls?|kisses?|grabs?|holds?|opens?|closes?)/i,
    // "We see/hear" - narrative voice (very reliable)
    /^We\s+(see|hear|push|pull|pan|zoom|track|follow)/i,
    // Music/sound cues: "CLASSICAL MUSIC kicks in", "The SCORE swells"
    /\b(MUSIC|SCORE|SOUNDTRACK|SONG|AUDIO|SFX)\s+(kicks?\s+in|fades?\s+(in|out)|plays?|starts?|begins?|ends?|swells?|builds?)/i,
    // "Pretentious CLASSICAL MUSIC kicks in"
    /^(Pretentious|Dramatic|Soft|Loud|Orchestral|Classical)\s+(MUSIC|SCORE|SOUNDTRACK)/i,
    // Camera directions: "VARIOUS SHOTS", "QUICK CUTS"
    /^(VARIOUS|QUICK|RAPID|SLOW|FAST)\s+(SHOTS?|CUTS?|ANGLES?|IMAGES?|FLASHES?)/i,
    // "-- a MAN does something" style description
    /^--\s+[a-z]/i,
  ];
  
  for (const pattern of actionPatterns) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  
  return false;
}

// Patterns that indicate action/direction lines, not character dialogue
const ACTION_PATTERNS = [
  // Character name + verb pattern (e.g., "JORDAN REALIZES", "SARAH WALKS", "JOHN DRIVES")
  /^[A-Z]+\s+(REALIZES?|WALKS?|RUNS?|LOOKS?|TURNS?|MOVES?|STANDS?|SITS?|ENTERS?|EXITS?|LEAVES?|COMES?|GOES?|TAKES?|PUTS?|GETS?|SEES?|HEARS?|FEELS?|THINKS?|KNOWS?|WANTS?|TRIES?|STARTS?|STOPS?|OPENS?|CLOSES?|PICKS?|DROPS?|HOLDS?|GRABS?|REACHES?|POINTS?|NODS?|SHAKES?|SMILES?|LAUGHS?|CRIES?|SCREAMS?|YELLS?|WHISPERS?|SIGHS?|PAUSES?|HESITATES?|CONTINUES?|BEGINS?|ENDS?|APPEARS?|DISAPPEARS?|DRIVES?|WATCHES?|PULLS?|PUSHES?|FALLS?|JUMPS?|CLIMBS?|READS?|WRITES?|SPEAKS?|TALKS?|LISTENS?|WAITS?|STEPS?|STARES?|GLANCES?|GLARES?|NOTICES?|IGNORES?|CROSSES?|FOLLOWS?|LEADS?|CARRIES?|THROWS?|CATCHES?|PLACES?|SETS?|LAYS?|RISES?|LIFTS?|LOWERS?|ANSWERS?|CALLS?|DIALS?|HANGS?|CHECKS?|SWEARS?|CURSES?|MUTTERS?|MUMBLES?|GROANS?|MOANS?)(\s|$)/i,
  // Phrase patterns that are clearly not character names
  /^(MEANWHILE|SUDDENLY|LATER|EARLIER|OUTSIDE|INSIDE|NEARBY|ABOVE|BELOW|BEHIND|BEFORE|AFTER|SPEED|SLOW|QUICK|FAST)/i,
  // Preposition anywhere (e.g., "PRIORITY IN THIS JOB", "MAN WITH GUN", "SPEED TRAP")
  /\s(IN|ON|AT|TO|FOR|WITH|FROM|BY|OF|ABOUT|INTO|ONTO|OVER|UNDER|THROUGH|AND|OR|TRAP)\s/i,
  // Common phrases that aren't names
  /^(THE|THIS|THAT|THESE|THOSE|A|AN)\s+/i,
  // Two-word phrases that are definitely not character names
  /^(SPEED TRAP|TIME LAPSE|SLOW MOTION|FAST FORWARD|FLASH BACK|CUT TO|FADE IN|FADE OUT|DISSOLVE TO|SMASH CUT|JUMP CUT|MATCH CUT)$/i,
  // 4+ words is likely a phrase (real names can be up to 3 words with title like "DR. ROBERT DOBACK")
  /^\S+\s+\S+\s+\S+\s+\S+/,
];

function normalizeCharacterName(name: string): string {
  let normalized = name.trim();
  
  // Remove character extensions like (V.O.), (CONT'D), etc.
  normalized = normalized.replace(EXTENSION_PATTERN, "");
  // Remove any remaining parenthetical at end
  normalized = normalized.replace(/\([^)]*\)\s*$/, "");
  // Remove leading numbers (e.g., "1. MARY")
  normalized = normalized.replace(/^\d+[\.\)\-\s]+/, "");
  // Remove trailing periods, commas, colons, semicolons (OCR/PDF artifacts)
  normalized = normalized.replace(/[.,;:!?\-]+$/, "");
  // Remove leading punctuation
  normalized = normalized.replace(/^[.,;:!?\-\s]+/, "");
  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, " ");
  normalized = normalized.trim();
  
  return normalized.toUpperCase();
}

function isValidCharacterName(name: string): boolean {
  const normalized = normalizeCharacterName(name);
  
  // Must be reasonable length
  if (normalized.length < 2 || normalized.length > 35) return false;
  
  // Must start with a letter
  if (!/^[A-Z]/.test(normalized)) return false;
  
  // Must not match NOT_CHARACTER_PATTERNS (title page fragments, dates, etc.)
  for (const pattern of NOT_CHARACTER_PATTERNS) {
    if (pattern.test(normalized)) return false;
  }
  
  // Must not be a reserved word
  if (RESERVED_WORDS.has(normalized)) return false;
  
  // Must not look like a scene heading
  if (SCENE_HEADING_REGEX.test(normalized)) return false;
  
  // Must not be a transition
  if (TRANSITION_REGEX.test(normalized)) return false;
  
  // Must not match action patterns (e.g., "JORDAN REALIZES")
  for (const pattern of ACTION_PATTERNS) {
    if (pattern.test(normalized)) return false;
  }
  
  // Should be mostly letters (allow spaces, hyphens, apostrophes, periods for titles)
  if (!/^[A-Z][A-Z0-9\s\-'\.#]+$/.test(normalized)) return false;
  
  // Character names typically are 1-2 words (maybe 3 with title like "DR. JOHN SMITH")
  const wordCount = normalized.split(/\s+/).length;
  if (wordCount > 3) return false;
  
  return true;
}

// Check if a line is JUST a character name (professional screenplay format)
function isStandaloneCharacterName(line: string): { isCharacter: boolean; name: string } {
  const trimmed = line.trim();
  
  // Remove extensions first to get core name
  let coreName = trimmed.replace(EXTENSION_PATTERN, "").trim();
  coreName = coreName.replace(/\([^)]*\)\s*$/, "").trim();
  
  // If no core name left, not a character
  if (!coreName || coreName.length < 2) return { isCharacter: false, name: "" };
  
  // Check caps ratio on core name only (ignore extensions and punctuation)
  const letters = coreName.match(/[A-Za-z]/g) || [];
  const upperLetters = coreName.match(/[A-Z]/g) || [];
  if (letters.length === 0) return { isCharacter: false, name: "" };
  const capsRatio = upperLetters.length / letters.length;
  if (capsRatio < 0.7) return { isCharacter: false, name: "" };
  
  // Should be short (character names are typically 1-3 words)
  const wordCount = coreName.split(/\s+/).length;
  if (wordCount > 3) return { isCharacter: false, name: "" };
  
  // Validate as character name
  if (!isValidCharacterName(coreName)) return { isCharacter: false, name: "" };
  
  return { isCharacter: true, name: normalizeCharacterName(trimmed) };
}

function isLikelyCharacterLine(line: string): { isCharacter: boolean; name: string; dialogue: string } {
  const trimmed = line.trim();
  
  if (!trimmed || trimmed.length < 2) {
    return { isCharacter: false, name: "", dialogue: "" };
  }
  
  // Skip scene headings
  if (SCENE_HEADING_REGEX.test(trimmed)) {
    return { isCharacter: false, name: "", dialogue: "" };
  }
  
  // Skip transitions
  if (TRANSITION_REGEX.test(trimmed)) {
    return { isCharacter: false, name: "", dialogue: "" };
  }
  
  // Skip pure stage directions
  if (/^\[.*\]$/.test(trimmed) || /^\(.*\)$/.test(trimmed)) {
    return { isCharacter: false, name: "", dialogue: "" };
  }
  
  // Pattern 1: CHARACTER: dialogue (most common for pasted scripts)
  const colonPatterns = [
    // Basic: NAME: dialogue
    /^([A-Za-z][A-Za-z0-9\s\-'\.]+?)(?:\s*\([^)]*\))?\s*[:：]\s*(.+)$/,
    // ALL CAPS: NAME: dialogue  
    /^([A-Z][A-Z0-9\s\-'\.]+?)(?:\s*\([^)]*\))?\s*[:：]\s*(.+)$/,
    // With title: DR. SMITH: dialogue
    /^((?:DR|MR|MRS|MS|MISS|PROF|REV|SIR|LADY|LORD|CAPTAIN|COLONEL|GENERAL|SERGEANT|OFFICER|DETECTIVE|INSPECTOR|AGENT|NURSE|CHEF|WAITER|WAITRESS|FATHER|MOTHER|SISTER|BROTHER|UNCLE|AUNT|GRANDMA|GRANDPA)\.?\s+[A-Za-z][A-Za-z\-'\.]+)(?:\s*\([^)]*\))?\s*[:：]\s*(.+)$/i,
    // Numbered: 1. NAME: dialogue
    /^(\d+[\.\)]\s*[A-Za-z][A-Za-z0-9\s\-'\.]+?)(?:\s*\([^)]*\))?\s*[:：]\s*(.+)$/,
    // With extension: NAME (V.O.): dialogue
    /^([A-Z][A-Z0-9\s\-'\.]+\s*\([^)]+\))\s*[:：]\s*(.+)$/,
  ];
  
  for (const pattern of colonPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const potentialName = match[1].trim();
      const dialogue = match[2].trim();
      
      if (potentialName.length <= 40 && dialogue.length > 0) {
        const normalizedName = normalizeCharacterName(potentialName);
        if (isValidCharacterName(potentialName)) {
          return { isCharacter: true, name: normalizedName, dialogue };
        }
      }
    }
  }
  
  // Pattern 2: CHARACTER - dialogue (sometimes used)
  const dashPattern = /^([A-Z][A-Z\s\-'\.]+?)\s*[-–—]\s*(.+)$/;
  const dashMatch = trimmed.match(dashPattern);
  if (dashMatch) {
    const potentialName = dashMatch[1].trim();
    const dialogue = dashMatch[2].trim();
    
    if (potentialName.length <= 30 && dialogue.length > 0 && !dialogue.startsWith("-")) {
      if (isValidCharacterName(potentialName)) {
        return { isCharacter: true, name: normalizeCharacterName(potentialName), dialogue };
      }
    }
  }
  
  // Pattern 3: CHARACTER> dialogue (rare but happens)
  const arrowPattern = /^([A-Z][A-Z\s\-'\.]+?)\s*[>»]\s*(.+)$/;
  const arrowMatch = trimmed.match(arrowPattern);
  if (arrowMatch) {
    const potentialName = arrowMatch[1].trim();
    const dialogue = arrowMatch[2].trim();
    
    if (isValidCharacterName(potentialName)) {
      return { isCharacter: true, name: normalizeCharacterName(potentialName), dialogue };
    }
  }
  
  return { isCharacter: false, name: "", dialogue: "" };
}

// Detect where action/description begins within dialogue text and truncate
// This handles cases where PDF extraction merged dialogue with following action
function truncateAtActionStart(text: string): { dialogue: string; action: string } {
  // Patterns that indicate transition from dialogue to action/description
  // These patterns look for where narrative action begins mid-text
  // BE VERY CONSERVATIVE - only truncate when absolutely certain it's action
  const actionStartPatterns = [
    // "the [object] [verbs]" - narrative description of SPECIFIC objects with action verbs
    /\.\s+(the\s+(?:stick|helicopter|car|door|phone|camera|screen|lights?|plane|boat|room)\s+(?:descends?|rises?|moves?|opens?|closes?|falls?|crashes?|lands?|hovers?|flies?|spins?|turns?|shakes?))/i,
    // ALL CAPS action words mid-sentence (sound effects, actions)
    /\s+(then\s+)?([A-Z]{4,}S?\s+(and\s+)?[A-Z]{4,}S?\s+to\s+the)/i,
    // "then LURCHES", "then SLAMS" patterns  
    /\.\.\.\s*then\s+[A-Z]{4,}/i,
    // Character name's body part doing something (mid-text)
    /\.\s+([A-Z][a-z]+'s\s+(?:head|eyes|face|hand|hands|body|voice)\s+(?:bobs?|turns?|moves?|drops?|rises?))/i,
    // ALL CAPS CHARACTER NAME + enters/exits/walks etc. (e.g., "KEVIN McCALLISTER enters")
    /\.\s+([A-Z][A-Z\s]+(?:[A-Z][a-z]+)?\s+(?:enters?|exits?|walks?|runs?|appears?|leaves?|crosses?|stands?|sits?|looks?|turns?|moves?|comes?|goes?))/,
  ];
  
  let earliestMatch = text.length;
  let actionPart = "";
  
  for (const pattern of actionStartPatterns) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      // Find where the action actually starts (after the period/ellipsis)
      const capturedGroup = match[1] || match[0];
      const actionStart = match.index + match[0].indexOf(capturedGroup);
      if (actionStart < earliestMatch && actionStart > 10) { // Ensure we keep at least some dialogue
        earliestMatch = actionStart;
        actionPart = text.substring(actionStart).trim();
      }
    }
  }
  
  if (earliestMatch < text.length) {
    return {
      dialogue: text.substring(0, earliestMatch).trim(),
      action: actionPart
    };
  }
  
  return { dialogue: text, action: "" };
}

function extractDirectionsFromDialogue(text: string): { cleanText: string; directions: string[] } {
  const directions: string[] = [];
  
  // First, try to truncate at action start (PDF merge issue)
  const { dialogue, action } = truncateAtActionStart(text);
  let cleanText = dialogue;
  if (action) {
    directions.push(action);
  }
  
  // Extract [bracketed directions]
  cleanText = cleanText.replace(DIRECTION_REGEX, (_, dir) => {
    directions.push(dir.trim());
    return "";
  });
  
  // Extract (parenthetical directions) that contain emotion/action keywords
  cleanText = cleanText.replace(PARENTHETICAL_REGEX, (match, content) => {
    const lower = content.toLowerCase().trim();
    
    // Common stage direction patterns (start with "to", action verb, or location)
    const directionPatterns = [
      /^to\s+(himself|herself|themselves|the|a|nancy|robert|dale|brennan)/i,
      /^(off|on)\s+(mic|camera|screen)/i,
      /^(looks?|looking)\s+(at|up|down|around|away)/i,
      /^(turns?|turning)\s+(to|around|away|back)/i,
      /^(slams?|slamming|grabs?|grabbing|picks?|picking|holds?|holding)/i,
      /^(singing|humming|whistling|dancing|clapping)/i,
      /^(then|and then)\s+/i,
    ];
    
    if (directionPatterns.some(pattern => pattern.test(lower))) {
      directions.push(content.trim());
      return "";
    }
    
    const emotionKeywords = [
      "angry", "angrily", "sad", "sadly", "happy", "happily", "excited", "excitedly",
      "nervous", "nervously", "scared", "whispering", "whispers", "whispered",
      "shouting", "shouts", "shouted", "yelling", "yells", "yelled",
      "crying", "cries", "cried", "sobbing", "sobs", "sobbed",
      "laughing", "laughs", "laughed", "chuckling", "chuckles",
      "sarcastic", "sarcastically", "ironic", "ironically",
      "quiet", "quietly", "loud", "loudly", "soft", "softly",
      "hesitant", "hesitantly", "confident", "confidently",
      "desperate", "desperately", "pleading", "pleads", "begging", "begs",
      "threatening", "threateningly", "menacing", "menacingly",
      "mocking", "mockingly", "tender", "tenderly", "cold", "coldly",
      "warm", "warmly", "bitter", "bitterly", "gentle", "gently",
      "harsh", "harshly", "firm", "firmly",
      "pause", "pauses", "pausing", "beat", "a beat",
      "sighing", "sighs", "sighed", "trembling", "trembles", "trembled",
      "to self", "to himself", "to herself", "aside", "under breath",
      "continuing", "continues", "interrupting", "interrupts", "overlapping", "cutting off",
      "reading", "quoting", "imitating", "mimicking",
      "re:", "regarding", "about", "pointing", "gesturing", "nodding",
      "shaking head", "looking", "turning", "moving", "walking",
      "sitting", "standing", "entering", "exiting", "crossing",
      "off camera", "off mic", "off screen", "o.c.", "v.o.",
      "smiling", "smiles", "grinning", "grins", "frowning", "frowns"
    ];
    
    if (emotionKeywords.some(kw => lower.includes(kw))) {
      directions.push(content.trim());
      return "";
    }
    
    // Keep other parentheticals (they might be part of the dialogue)
    return match;
  });
  
  // Clean up multiple spaces
  cleanText = cleanText.replace(/\s+/g, " ").trim();
  
  return { cleanText, directions };
}

// Patterns that indicate camera/action directions (not dialogue)
// BE CONSERVATIVE - only catch obvious camera/technical directions
const CAMERA_ACTION_PATTERNS = [
  /^(WE SEE|WE HEAR|SMASH CUT|MATCH CUT|DISSOLVE TO|ANGLE ON|CLOSE ON|BACK TO|FLASH TO|INTERCUT|MONTAGE|SERIES OF SHOTS|SUPER:|TITLE:|CREDITS)/i,
  /^\d+[A-Z]?\s+(WE|INT|EXT|SCENE|CUT|FADE)/i, // Scene numbers with directions
  /^(VARIOUS|QUICK|RAPID|SLOW|FAST)\s+(SHOTS?|CUTS?|ANGLES?|IMAGES?|FLASHES?)/i, // VARIOUS SHOTS, QUICK CUTS, etc.
  /\b(MUSIC|SCORE|SOUNDTRACK|SONG|AUDIO|SFX)\s+(kicks?\s+in|fades?\s+(in|out)|plays?|starts?|begins?|ends?|swells?|builds?)/i, // "MUSIC kicks in", "SCORE fades in"
  /^(Pretentious|Dramatic|Soft|Loud|Orchestral|Classical)\s+(MUSIC|SCORE|SOUNDTRACK)/i, // "Pretentious CLASSICAL MUSIC"
];

// Check if line is a scene number (like "1A", "215C-G", etc.)
function isSceneNumber(line: string): boolean {
  const trimmed = line.trim();
  return /^\d+[A-Z]?[\s\-]*[A-Z]?\s*$/.test(trimmed) || /^\d+[A-Z]?\s*$/.test(trimmed);
}

// Check if a line is likely dialogue continuation
// BE CONSERVATIVE - assume text is dialogue unless it's obviously not
function isDialogueContinuation(line: string, originalLine: string): boolean {
  const trimmed = line.trim();
  
  if (!trimmed) return false;
  
  // === STOP PATTERNS: These definitely end dialogue ===
  
  // Scene headings (INT./EXT.)
  if (SCENE_HEADING_REGEX.test(trimmed)) return false;
  
  // Transitions like "CUT TO:", "FADE TO:"
  if (TRANSITION_REGEX.test(trimmed)) return false;
  
  // Scene numbers only (like "1", "1A")
  if (isSceneNumber(trimmed)) return false;
  
  // Lines starting with scene numbers followed by text (e.g., "1C-1D VARIOUS SHOTS")
  if (/^\d+[A-Z]?[\-\s]+\d*[A-Z]?\s+[A-Z]/i.test(trimmed)) return false;
  
  // Action description with dashes (e.g., "VARIOUS SHOTS -- a conservative young MAN")
  if (/\s--\s+[a-z]/i.test(trimmed)) return false;
  
  // Camera/action directions (WE SEE, ANGLE ON, etc.)
  for (const pattern of CAMERA_ACTION_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }
  
  // Standalone character names (ALL CAPS, short, on own line - not dialogue)
  // But only if it looks like a proper character name format
  if (/^[A-Z][A-Z\s\-'\.]+$/.test(trimmed) && trimmed.length < 30) {
    const wordCount = trimmed.split(/\s+/).length;
    // Check if it could be a character name (1-3 words, all caps)
    if (wordCount <= 3 && isValidCharacterName(trimmed)) {
      return false;
    }
  }
  
  // Third-person action descriptions (He walks, She looks) - very reliable
  if (/^(He|She|They|It)\s+(is|are|was|were|walks?|runs?|looks?|turns?|enters?|exits?|stands?|sits?|moves?|opens?|closes?|falls?|kisses?)\b/i.test(trimmed)) {
    return false;
  }
  
  // Character name's possession + body part/action (e.g., "Jordan's head bobs", "Naomi's eyes narrow")
  if (/^[A-Z][a-z]+'s\s+(head|eyes|face|hand|hands|arm|arms|body|voice|mouth|jaw|fist|foot|feet)\b/i.test(trimmed)) {
    return false;
  }
  
  // "The [something]" - descriptive action lines
  if (/^The\s+(camera|helicopter|car|boat|plane|screen|door|phone|lights?|sound|music)\b/i.test(trimmed)) {
    return false;
  }
  
  // "Down below", "Up above", "Nearby", "Behind them" - scene description
  if (/^(Down below|Up above|Nearby|Behind|In front|Across|Through|Inside|Outside|Overhead|Below)/i.test(trimmed)) {
    return false;
  }
  
  // Camera/POV directions
  if (/\b(POV|VISIONED|DOUBLE VISION|BLURRED|HAZY)\b/.test(trimmed)) {
    return false;
  }
  
  // "We see" patterns
  if (/\bwe\s+see\b/i.test(trimmed)) {
    return false;
  }
  
  // Lines that are entirely about describing what we see (common in screenplays)
  if (/^(A|An|The)\s+.*(sits?|stands?|walks?|runs?|looks?|enters?|exits?|appears?|rises?|falls?|moves?|opens?|closes?|lands?|hovers?|flies?|crashes?)\b/i.test(trimmed)) {
    return false;
  }
  
  // Page numbers (just a number)
  if (/^\d+\.?\s*$/.test(trimmed)) return false;
  
  // MUSIC: cue lines
  if (/^MUSIC:/i.test(trimmed)) return false;
  
  // === IF NONE OF THE STOP PATTERNS MATCHED, IT'S LIKELY DIALOGUE ===
  return true;
}

// Preprocess script text to handle PDF copy-paste issues
function preprocessScript(rawText: string): string {
  let text = rawText;
  
  // Split title page content that got merged into single lines
  // e.g., "TITLE Written by Author Revisions by..." -> separate lines
  text = text.replace(/\s+(Written by|Screenplay by|Story by|Teleplay by|Created by|Based on|Revisions? by)\s+/gi, '\n$1 ');
  
  // Split on draft/revision markers mid-line
  text = text.replace(/\s+(First Draft|Second Draft|Final Draft|Blue Revised?|Pink Revised?|D\.A\.\s+\w+\s+Draft)\s*/gi, '\n$1\n');
  
  // Fix common PDF copy-paste issues where character names run into dialogue
  // e.g., "GENE HACKMAN(V.O.)That's why" -> "GENE HACKMAN (V.O.)\nThat's why"
  text = text.replace(/([A-Z]{2,}(?:\s+[A-Z]{2,})?)\s*\(([A-Z.\s]+)\)([A-Za-z])/g, '$1 ($2)\n$3');
  
  // Fix character name running directly into dialogue without space
  // e.g., "JORDANWhat do you mean" -> "JORDAN\nWhat do you mean"
  // Also handles names like "McCALLISTER" with mixed case
  text = text.replace(/([A-Z]{2,}(?:\s+(?:[A-Z]{2,}|Mc[A-Z][a-z]+))?)([A-Z][a-z])/g, '$1\n$2');
  
  // Fix ALL-CAPS name directly followed by lowercase dialogue (no space)
  // e.g., "OLIVERwill be happier" -> "OLIVER\nwill be happier"
  text = text.replace(/\b([A-Z]{2,})([a-z]{2,})/g, (match, name, rest) => {
    // Only split if name looks like a character name (2-15 chars)
    if (name.length >= 2 && name.length <= 15) {
      return `${name}\n${rest}`;
    }
    return match;
  });
  
  // Fix character name appearing after a dash mid-line
  // e.g., "too - BEVERLY. This is" -> "too -\nBEVERLY\nThis is"
  text = text.replace(/\s+-\s+([A-Z]{2,}(?:\s+[A-Z]{2,})?)[.\s]+([A-Z][a-z])/g, ' -\n$1\n$2');
  
  // Fix character name appearing after punctuation and space, followed by period then dialogue
  // e.g., "you will be, too - BEVERLY. This" -> split properly
  text = text.replace(/([,;:!?])\s*-?\s*([A-Z]{2,}(?:\s+[A-Z]{2,})?)\.\s+([A-Z])/g, '$1\n$2\n$3');
  
  // Split on character names that appear mid-line (common in PDF extraction)
  // e.g., "...the best. GENE HACKMAN Trained professionals" -> "...the best.\nGENE HACKMAN\nTrained professionals"
  // Handle names with optional extensions (V.O., CONT'D, etc.)
  text = text.replace(/([.!?])\s+([A-Z]{2,}(?:\s+(?:[A-Z]{2,}|Mc[A-Z][a-z]+))?(?:\s*\([A-Z.\s']+\))?)\s+([A-Z][a-z])/g, '$1\n$2\n$3');
  
  // Split when lowercase dialogue ends and all-caps name starts directly
  // e.g., "...phone. KEVIN McCALLISTER enters." -> "...phone.\nKEVIN McCALLISTER enters."
  text = text.replace(/([a-z][.!?])\s*([A-Z]{2,}(?:\s+(?:[A-Z]{2,}|Mc[A-Z][a-z]+))+)\s+(enters|exits|walks|runs|looks|turns|appears|leaves|crosses|stands|sits|moves|comes|goes)/gi, 
    '$1\n$2 $3');
  
  // Split when we see "He's/She's" after a sentence (indicates action line)
  // e.g., "...on the phone. He's seven." -> "...on the phone.\nHe's seven."
  text = text.replace(/([.!?])\s+(He's|She's|It's|They're)\s+/gi, '$1\n$2 ');
  
  // Split consecutive character names (e.g., "CLAUDETTEHave...COUNSELORCLAUDETTE")
  // Look for ALLCAPS name followed by another ALLCAPS name
  text = text.replace(/([A-Z]{2,}(?:\s+[A-Z]{2,})?)\s+([A-Z]{2,}(?:\s+[A-Z]{2,})?)\s+([a-z])/g, 
    (match, name1, name2, startLower) => {
      // name2 might be action like "leaves" or another character
      if (/^(enters|exits|walks|runs|looks|turns|appears|leaves|crosses|stands|sits|moves|comes|goes)$/i.test(name2)) {
        return match; // Keep as is - it's action
      }
      return `${name1}\n${name2}\n${startLower}`;
    });
  
  // Split on stage directions in parentheses that appear mid-dialogue followed by character name
  // e.g., "...empatheric. (Beuerly starts to lose her composure.) BEVERLY. Itt what" 
  // -> "...empatheric.\n(Beuerly starts to lose her composure.)\nBEVERLY\nItt what"
  text = text.replace(/(\([^)]+\))\s*([A-Z]{2,}(?:\s+[A-Z]{2,})?)[.\s]+([A-Z][a-z])/g, '$1\n$2\n$3');
  
  // Split when character name with period appears after closing paren or lowercase text
  // e.g., "...composure.) BEVERLY. Itt" -> "...composure.)\nBEVERLY\nItt"
  text = text.replace(/([)a-z])\s+([A-Z]{2,}(?:\s+[A-Z]{2,})?)\.\s+([A-Z][a-z])/g, '$1\n$2\n$3');
  
  // Split on parenthetical stage direction appearing mid-line (not at start)
  // e.g., "...to you. (Beverly cries.) She..." -> "...to you.\n(Beverly cries.)\nShe..."
  text = text.replace(/([.!?])\s*(\([^)]+\))\s*([A-Z])/g, '$1\n$2\n$3');
  
  return text;
}

export function parseScript(rawText: string): ParsedScript {
  // Preprocess to fix PDF copy-paste issues
  const preprocessed = preprocessScript(rawText);
  const lines = preprocessed.split(/\r?\n/);
  
  const roles: Map<string, Role> = new Map();
  const scenes: Scene[] = [];
  
  let currentSceneLines: ScriptLine[] = [];
  let currentSceneName = "Scene 1";
  let currentSceneDescription = "";
  let sceneCount = 1;
  let lineNumber = 0;
  
  let pendingCharacter: string | null = null;
  let pendingDialogue: string[] = [];
  let pendingContext: string[] = []; // Action lines before dialogue
  
  // Skip title page / front matter until first scene heading
  let foundFirstScene = false;
  let collectingSceneDescription = false;

  const flushPendingDialogue = () => {
    if (pendingCharacter && pendingDialogue.length > 0) {
      const fullDialogue = pendingDialogue.join(" ");
      // Clean OCR artifacts and production notes from dialogue
      const cleanedDialogue = cleanDialogueText(fullDialogue);
      const { cleanText, directions } = extractDirectionsFromDialogue(cleanedDialogue);
      
      // Validate dialogue - reject garbage like single letters "r", OCR artifacts
      if (cleanText && isValidDialogue(cleanText)) {
        if (!roles.has(pendingCharacter)) {
          roles.set(pendingCharacter, {
            id: generateId(),
            name: pendingCharacter,
            voicePreset: "natural",
            isUserRole: false,
            lineCount: 0,
          });
        }
        
        const role = roles.get(pendingCharacter)!;
        role.lineCount++;
        
        const direction = directions.join("; ");
        const contextText = pendingContext.join(" ").trim();
        const scriptLine: ScriptLine = {
          id: generateId(),
          lineNumber: lineNumber++,
          roleId: role.id,
          roleName: pendingCharacter,
          text: cleanText,
          direction: direction || undefined,
          context: isValidContext(contextText) ? contextText : undefined, // Only include valid action context
          isBookmarked: false,
          emotionHint: detectEmotion(cleanText, direction),
        };
        
        currentSceneLines.push(scriptLine);
      }
    }
    pendingCharacter = null;
    pendingDialogue = [];
    pendingContext = []; // Clear context after attaching to dialogue
  };
  
  // Check if a line is action/description (not dialogue, not character, not heading)
  // BE CONSERVATIVE - it's better to keep dialogue than accidentally filter it out
  const isActionLine = (trimmed: string): boolean => {
    // Skip if it's a scene heading, transition, or character name
    if (SCENE_HEADING_REGEX.test(trimmed)) return false;
    if (TRANSITION_REGEX.test(trimmed)) return false;
    if (SOUND_CUE_REGEX.test(trimmed)) return false;
    
    // Only consider as action if we're NOT in the middle of collecting dialogue
    // This is handled by the caller - here we just detect obvious action patterns
    
    // Third person pronouns + action verb (very reliable indicator of action)
    if (/^(He|She|They|It)\s+(is|are|was|were|looks?|walks?|runs?|turns?|enters?|exits?|stands?|sits?|moves?|picks?|grabs?|holds?|opens?|closes?|falls?|kisses?|hugs?)\b/i.test(trimmed)) {
      return true;
    }
    
    // "There is/are..." scene descriptions (very reliable)
    if (/^There\s+(is|are|was|were)\s+/i.test(trimmed)) {
      return true;
    }
    
    // Camera directions (very reliable)
    if (/^(CUT TO|FADE TO|DISSOLVE TO|ANGLE ON|CLOSE ON|WIDE ON|PAN TO|ZOOM|BACK TO|INTERCUT)/i.test(trimmed)) {
      return true;
    }
    
    // Lines starting with lowercase action verbs are clearly action/description, not dialogue
    // e.g., "drives, perhaps a little over the speed limit" (after "JOHNdrives" was split)
    if (/^(drives?|walks?|runs?|looks?|turns?|moves?|stands?|sits?|enters?|exits?|leaves?|comes?|goes?|takes?|puts?|gets?|sees?|hears?|watches?|pulls?|pushes?|falls?|jumps?|climbs?|reads?|writes?|speaks?|talks?|listens?|waits?|steps?|stares?|glances?|notices?|crosses?|follows?|carries?|throws?|catches?|places?|answers?|calls?|swears?|mutters?|perhaps|meanwhile|suddenly)[,\s]/i.test(trimmed)) {
      return true;
    }
    
    // Lines containing third-person pronouns referring to a character are action, not dialogue
    // e.g., "He glances down, swerves slightly", "his phone buzzes", "she walks away"
    // Real dialogue wouldn't use "he/she/his/her" to refer to the speaker
    if (/\b(he|she|his|her|him)\s+(is|was|looks?|walks?|runs?|turns?|moves?|stands?|sits?|glances?|watches?|pulls?|swears?|mutters?|drives?|stares?|notices?|opens?|closes?|grabs?|reaches?|picks?|puts?|gets?|sees?|hears?)\b/i.test(trimmed)) {
      return true;
    }
    
    // Lines containing "his/her [noun]" pattern are usually action descriptions
    // e.g., "his phone buzzes", "her eyes widen"
    if (/\b(his|her)\s+(phone|eyes?|hands?|face|head|voice|back|body|arms?|legs?|feet|car|seat|breath)\b/i.test(trimmed)) {
      return true;
    }
    
    // Lines mentioning character name in ALL CAPS + action verb mid-line are action
    // e.g., "JOHN swears under his breath and pulls over"
    if (/[A-Z]{2,}\s+(swears?|mutters?|sighs?|groans?|nods?|shakes?|walks?|runs?|drives?|pulls?|looks?|turns?|enters?|exits?|stands?|sits?)\b/i.test(trimmed)) {
      return true;
    }
    
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const rawTrimmed = rawLine.trim();
    
    // Empty line - flush current dialogue
    if (!rawTrimmed) {
      flushPendingDialogue();
      continue;
    }
    
    // Check if line should be skipped entirely (OMITTED, scene numbers only, etc.)
    if (shouldSkipLine(rawTrimmed)) {
      continue;
    }
    
    // Clean the line (remove scene numbers from margins, revision asterisks)
    const trimmed = cleanScriptLine(rawTrimmed);
    
    // Skip if cleaning left us with nothing
    if (!trimmed) {
      continue;
    }
    
    // Scene heading - start new scene
    if (SCENE_HEADING_REGEX.test(trimmed)) {
      foundFirstScene = true;
      flushPendingDialogue();
      
      if (currentSceneLines.length > 0) {
        scenes.push({
          id: generateId(),
          name: currentSceneName,
          description: currentSceneDescription || undefined,
          lines: [...currentSceneLines],
        });
        currentSceneLines = [];
      }
      sceneCount++;
      currentSceneName = trimmed.length > 60 ? trimmed.substring(0, 60) + "..." : trimmed;
      currentSceneDescription = "";
      collectingSceneDescription = true; // Start collecting scene description
      pendingContext = []; // Reset context for new scene
      continue;
    }
    
    // Skip title page / front matter until first scene heading OR first dialogue
    if (!foundFirstScene) {
      // Check if this line is dialogue (inline format) or standalone character name
      const earlyCheck = isLikelyCharacterLine(trimmed);
      const standaloneCheck = isStandaloneCharacterName(trimmed);
      if (earlyCheck.isCharacter || standaloneCheck.isCharacter) {
        foundFirstScene = true;
        currentSceneName = "Scene 1";
        // Fall through to process this line as dialogue/character
      } else {
        continue;
      }
    }
    
    // Transition - skip
    if (TRANSITION_REGEX.test(trimmed)) {
      collectingSceneDescription = false;
      continue;
    }
    
    // Pure stage direction on its own line - add to context
    if (/^\[.*\]$/.test(trimmed) || /^\(.*\)$/.test(trimmed)) {
      const cleaned = trimmed.replace(/^\[|\]$|^\(|\)$/g, '').trim();
      if (cleaned) {
        pendingContext.push(cleaned);
      }
      continue;
    }
    
    // Skip sound/music cue lines (e.g., "MUSIC: Jazz tune plays")
    if (SOUND_CUE_REGEX.test(trimmed)) {
      continue;
    }
    
    // Check if this is an action/description line
    if (isActionLine(trimmed)) {
      if (collectingSceneDescription && !currentSceneDescription) {
        // First action after scene heading becomes scene description
        currentSceneDescription = trimmed;
      } else {
        // Otherwise add to pending context for next dialogue
        pendingContext.push(trimmed);
      }
      collectingSceneDescription = false;
      continue;
    }
    
    // Stop collecting scene description once we hit dialogue
    collectingSceneDescription = false;
    
    // Check for inline character: dialogue format
    const characterCheck = isLikelyCharacterLine(trimmed);
    
    if (characterCheck.isCharacter) {
      flushPendingDialogue();
      pendingCharacter = characterCheck.name;
      pendingDialogue = [characterCheck.dialogue];
    } 
    // Check for standalone character name (professional screenplay format)
    else if (!pendingCharacter) {
      const standaloneCheck = isStandaloneCharacterName(trimmed);
      if (standaloneCheck.isCharacter) {
        flushPendingDialogue();
        pendingCharacter = standaloneCheck.name;
        pendingDialogue = [];
      }
    }
    // Check if this is dialogue continuation
    else if (pendingCharacter) {
      if (isDialogueContinuation(trimmed, rawLine)) {
        pendingDialogue.push(trimmed);
      } else {
        // Could be a new standalone character or action line
        const standaloneCheck = isStandaloneCharacterName(trimmed);
        if (standaloneCheck.isCharacter) {
          flushPendingDialogue();
          pendingCharacter = standaloneCheck.name;
          pendingDialogue = [];
        } else {
          // Might be dialogue if we have an empty pending dialogue (character on prev line)
          if (pendingDialogue.length === 0) {
            pendingDialogue.push(trimmed);
          } else {
            flushPendingDialogue();
          }
        }
      }
    }
  }
  
  flushPendingDialogue();
  
  // Add final scene
  if (currentSceneLines.length > 0) {
    scenes.push({
      id: generateId(),
      name: currentSceneName,
      description: currentSceneDescription || undefined,
      lines: currentSceneLines,
    });
  }
  
  // Ensure at least one scene exists
  if (scenes.length === 0) {
    scenes.push({
      id: generateId(),
      name: "Scene 1",
      lines: [],
    });
  }

  return {
    roles: Array.from(roles.values()),
    scenes,
  };
}

export function normalizeScript(rawText: string): string {
  const lines = rawText.split(/\r?\n/);
  const normalized: string[] = [];
  
  let currentRole = "";
  let currentDialogue: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentRole && currentDialogue.length > 0) {
        normalized.push(`${currentRole}: ${currentDialogue.join(" ")}`);
        currentRole = "";
        currentDialogue = [];
      }
      continue;
    }
    
    const characterCheck = isLikelyCharacterLine(trimmed);
    if (characterCheck.isCharacter) {
      if (currentRole && currentDialogue.length > 0) {
        normalized.push(`${currentRole}: ${currentDialogue.join(" ")}`);
      }
      currentRole = characterCheck.name;
      currentDialogue = [characterCheck.dialogue];
    } else if (currentRole) {
      currentDialogue.push(trimmed);
    } else {
      // Check for standalone character name
      const standaloneCheck = isStandaloneCharacterName(trimmed);
      if (standaloneCheck.isCharacter) {
        if (currentRole && currentDialogue.length > 0) {
          normalized.push(`${currentRole}: ${currentDialogue.join(" ")}`);
        }
        currentRole = standaloneCheck.name;
        currentDialogue = [];
      } else {
        normalized.push(trimmed);
      }
    }
  }
  
  if (currentRole && currentDialogue.length > 0) {
    normalized.push(`${currentRole}: ${currentDialogue.join(" ")}`);
  }
  
  return normalized.join("\n");
}

export function extractDirections(text: string): { cleanText: string; directions: string[] } {
  return extractDirectionsFromDialogue(text);
}

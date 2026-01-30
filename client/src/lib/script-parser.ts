import type { ParsedScript, Role, Scene, ScriptLine } from "@shared/schema";
import { detectEmotion } from "./tts-engine";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// Levenshtein distance for OCR error detection
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Check if two names are likely OCR variants of each other
function areOCRVariants(name1: string, name2: string): boolean {
  const upper1 = name1.toUpperCase();
  const upper2 = name2.toUpperCase();
  
  // Very short names need exact match
  if (name1.length <= 2 || name2.length <= 2) return false;
  
  // Method 1: Edit distance (for similar-length names)
  const distance = levenshteinDistance(upper1, upper2);
  const minLen = Math.min(name1.length, name2.length);
  
  // For similar-length names, use edit distance
  if (Math.abs(name1.length - name2.length) <= 2) {
    const maxDistance = minLen <= 4 ? 1 : minLen <= 7 ? 2 : 3;
    if (distance > 0 && distance <= maxDistance) {
      return true;
    }
  }
  
  // Method 2: Letter overlap (for badly mangled OCR like GROR/GEORGE)
  // Check if shorter name's letters are mostly contained in longer name
  const shorter = upper1.length <= upper2.length ? upper1 : upper2;
  const longer = upper1.length > upper2.length ? upper1 : upper2;
  
  // Count how many letters from shorter are in longer
  const longerLetters = longer.split('');
  let matches = 0;
  for (const char of shorter) {
    const idx = longerLetters.indexOf(char);
    if (idx !== -1) {
      matches++;
      longerLetters.splice(idx, 1); // Remove matched letter
    }
  }
  
  // Calculate match ratio and check first letter
  const matchRatio = matches / shorter.length;
  const firstLetterMatches = upper1[0] === upper2[0];
  
  // If 75%+ of shorter name's letters match, and first letter matches, likely OCR variant
  if (matchRatio >= 0.75 && firstLetterMatches && shorter.length >= 3) {
    return true;
  }
  
  // For very high overlap (90%+), allow even if first letter doesn't match
  if (matchRatio >= 0.9 && shorter.length >= 3) {
    return true;
  }
  
  // Check if name could be a misread version (common OCR confusions)
  const ocrConfusions: Record<string, string[]> = {
    'G': ['C', 'O', 'Q', '6', '9'],
    'C': ['G', 'O', '(', '<'],
    'S': ['5', '$', '8'],
    'O': ['0', 'Q', 'D', 'C'],
    'I': ['1', 'L', '!', '|'],
    'B': ['8', '3', 'R'],
    'E': ['F', '3', 'R'],  // E can look like R
    'H': ['N', 'M'],
    'R': ['K', 'P', 'E'],  // R can look like E
  };
  
  const char1 = upper1[0];
  const char2 = upper2[0];
  const firstLetterConfused = 
    ocrConfusions[char1]?.includes(char2) || 
    ocrConfusions[char2]?.includes(char1) ||
    char1 === char2;
  
  if (matchRatio >= 0.75 && firstLetterConfused && shorter.length >= 3) {
    return true;
  }
  
  return false;
}

// Check if a short name could be a badly garbled version of a longer canonical name
function isGarbledVersion(garbled: string, canonical: string): boolean {
  const g = garbled.toUpperCase();
  const c = canonical.toUpperCase();
  
  if (g.length > c.length + 1) return false;
  
  if (g.length <= 4 && c.length >= 5) {
    const ocrConfusions: Record<string, string[]> = {
      'G': ['C', 'O', 'Q', '6', '9'],
      'C': ['G', 'O', '(', '<'],
      'S': ['5', '$', '8'],
      'O': ['0', 'Q', 'D', 'C'],
      'I': ['1', 'L', '!', '|'],
      'B': ['8', '3', 'R'],
      'E': ['F', '3', 'R'],
      'H': ['N', 'M'],
      'R': ['K', 'P', 'E'],
    };
    
    const firstMatch = g[0] === c[0] || 
      ocrConfusions[g[0]]?.includes(c[0]) || 
      ocrConfusions[c[0]]?.includes(g[0]);
    
    if (!firstMatch) return false;
    
    const cLetters = c.split('');
    let matches = 0;
    for (const char of g) {
      const idx = cLetters.indexOf(char);
      if (idx !== -1) {
        matches++;
        cLetters.splice(idx, 1);
      } else {
        for (const [original, confused] of Object.entries(ocrConfusions)) {
          if (confused.includes(char)) {
            const origIdx = cLetters.indexOf(original);
            if (origIdx !== -1) {
              matches++;
              cLetters.splice(origIdx, 1);
              break;
            }
          }
        }
      }
    }
    
    if (matches >= g.length * 0.5) {
      return true;
    }
  }
  
  return false;
}

const DIRECTION_REGEX = /\[([^\]]+)\]/g;
const PARENTHETICAL_REGEX = /\(([^)]+)\)/g;

// Written-out numbers for scene headings (up to 99)
const WRITTEN_NUMBERS = 'ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY|FIFTY|SIXTY|SEVENTY|EIGHTY|NINETY';
const WRITTEN_COMPOUND = `(${WRITTEN_NUMBERS})([-\\s]?(${WRITTEN_NUMBERS}))?`;

// Scene headings - now includes INSERT shots and written-out scene numbers (up to NINETY-NINE)
const SCENE_HEADING_REGEX = new RegExp(`^(INT\\.|EXT\\.|INT\\/EXT\\.|I\\/E\\.|INSERT\\s*[-–—]|SCENE\\s*(\\d+|${WRITTEN_COMPOUND})|ACT\\s*[IVX\\d]|FADE IN:|FADE OUT:|THE SCREEN)`, 'i');

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
  // Cast list patterns (actor name after character)
  /^[A-Z][A-Z\s\.]+\.{3,}\s*[A-Z]/i, // "SARA....... Actor Name"
  /^\.\s*[A-Z]/i, // ". Sandra Oh" (OCR fragment)
  /^[A-Z]+\.{3,}\s*$/i, // "SARA..." alone
  // Photo/design credits
  /^Set design by\b/i,
  /^Photo by\b/i,
  /^Lighting design/i,
  /^Sound design/i,
  /^Costume design/i,
  /^Production\s+(dramaturg|stage\s+manager)/i,
  /^The cast was as follows/i,
  // Play service/publisher
  /^DRAMATISTS\s*$/i,
  /^SERVICE\s*$/i,
  /^PLAY\s*$/i,
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
  // Sound effects / onomatopoeia that are NOT character names (include -ing forms)
  /^(SCREAM(S|ING)?|YELL(S|ING)?|SHOUT(S|ING)?|CRY(ING)?|CRIES|WHISPER(S|ING)?|SIGH(S|ING)?|GASP(S|ING)?|LAUGH(S|ING)?|GROAN(S|ING)?|MOAN(S|ING)?|HOWL(S|ING)?|VROOM|CRASH(ES|ING)?|BANG(S|ING)?|BOOM(S|ING)?|SLAM(S|MING)?|CLICK(S|ING)?|BEEP(S|ING)?|RING(S|ING)?|BUZZ(ES|ING)?|HONK(S|ING)?|THUD(S)?|SPLAT(S)?|WHOOSH(ES|ING)?|SCREECH(ES|ING)?|ROAR(S|ING)?|GROWL(S|ING)?|SNOR(E|ES|ING)|COUGH(S|ING)?|SNEEZ(E|ES|ING)|CLAP(S|PING)?|STOMP(S|ING)?|THUMP(S|ING)?|KNOCK(S|ING)?|DING(S|ING)?|CHIME(S)?|SWISH(ES|ING)?|SWOOSH(ES|ING)?|CRACK(S|ING)?|SNAP(S|PING)?|POP(S|PING)?|CRUNCH(ES|ING)?|SPLASH(ES|ING)?|SIZZL(E|ES|ING)|RUMBL(E|ES|ING)|THUNDER(S|ING)?|LIGHTNING|EXPLOSION(S)?|GUNSHOT(S)?|GUNFIRE|ENGINE(S)?|TIRES|BRAKES|BREATHING|PANTING|SOBBING|WEEPING|WAILING|WHIMPERING|STAMMERING|STUTTERING|MUTTERING|MUMBLING|GROWLING|SNARLING|HISSING|REVVING|SCREECHING|SQUEALING|SQUEAKING|RATTLING|CLANKING|CLATTERING|THUMPING|POUNDING|DRUMMING|TAPPING|RAPPING|SCRATCHING|SCRAPING)$/i,
  // Camera/editing terms that look like character names but aren't
  /^(ANGLE|SHOT|CLOSE|CLOSEUP|CLOSE[\s\-]?UP|WIDE|MEDIUM|INSERT|FLASHBACK|MONTAGE|INTERCUT|CONTINUOUS|LATER|MEANWHILE|SUDDENLY|SILENCE|PAUSE|BEAT|GEARS|TURBINE|POV|ECU|CU|MCU|MS|LS|WS|EWS|OS|OTS|TWO[\s\-]?SHOT|THREE[\s\-]?SHOT|TRACKING|DOLLY|PAN|TILT|ZOOM|CRANE|STEADICAM|HANDHELD|AERIAL|UNDERWATER|SLOW[\s\-]?MOTION|FREEZE[\s\-]?FRAME|SPLIT[\s\-]?SCREEN|STOCK|FOOTAGE|TITLE|TITLES|CREDIT|CREDITS|SUPER|SUPERIMPOSE|CHYRON|LOWER[\s\-]?THIRD|V\.?O\.?|O\.?S\.?|O\.?C\.?)$/i,
  // INSERT + any object (INSERT PHOTO, INSERT POLAROID, INSERT ID PHOTO, etc.)
  /^INSERT\s+[\w\s]+$/i,
  // POV and camera direction patterns with pronouns/descriptions
  /^(HIS|HER|THEIR|ITS|OUR|YOUR)\s+POV$/i,
  /^(INTO|OUT\s+OF|BACK\s+TO|RETURN\s+TO|CUT\s+TO|FADE\s+TO|DISSOLVE\s+TO)\s+(FRAME|SCENE|SHOT)$/i,
  /^BACK\s+TO\s+SCENE$/i,
  /^(ANGLE\s+ON|CLOSE\s+ON|PUSH\s+IN|PULL\s+BACK|MOVE\s+TO|PAN\s+TO|TILT\s+TO|RACK\s+FOCUS|FOCUS\s+ON)(\s+\w+)?$/i,
  /^(REVERSE|MATCHING|ESTABLISHING|MASTER|COVERAGE|REACTION|OVER[\s\-]?THE[\s\-]?SHOULDER|POINT[\s\-]?OF[\s\-]?VIEW)(\s+SHOT)?$/i,
  /^(SAME|NEW|DIFFERENT|ANOTHER|VARIOUS|MULTIPLE)\s+(ANGLE|SHOT|POV)$/i,
  /^(SERIES\s+OF\s+SHOTS?|QUICK\s+CUTS?|JUMP\s+CUT|MATCH\s+CUT|SMASH\s+CUT|HARD\s+CUT|SOFT\s+CUT)$/i,
  /^(BACK|FRONT|SIDE|TOP|BOTTOM|HIGH|LOW|EYE[\s\-]?LEVEL|BIRDS?[\s\-]?EYE|WORMS?[\s\-]?EYE)\s+(ANGLE|VIEW|SHOT)$/i,
  // More camera movements and directions
  /^(CAMERA|WE|VIEWER)\s+(MOVES?|FOLLOWS?|TRACKS?|PULLS?|PUSHES?|ZOOMS?|PANS?|TILTS?|HOLDS?|FINDS?|REVEALS?|DISCOVERS?)(\s+\w+)*$/i,
  /^(FAVORING|FEATURING|FOLLOWING|MOVING\s+WITH|STAYING\s+ON|HOLDING\s+ON)(\s+\w+)*$/i,
  // Adjective/descriptor phrases that are NOT character names
  /^(MOST|MORE|LESS|VERY|QUITE|RATHER|FAIRLY|SOMEWHAT|EXTREMELY|INCREDIBLY|ABSOLUTELY)\s+\w+$/i,
  /^(THE|A|AN)\s+(MOST|MORE|LESS)\s+\w+$/i,
  // Time transitions - NOT character names
  /^(MINUTES?|HOURS?|DAYS?|WEEKS?|MONTHS?|YEARS?|SECONDS?|MOMENTS?)\s+(LATER|EARLIER|AGO|BEFORE|AFTER)$/i,
  /^(LATER|EARLIER|NEXT|PREVIOUS|SAME)\s+(DAY|NIGHT|MORNING|EVENING|AFTERNOON|TIME)$/i,
  /^(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)\s+(MINUTES?|HOURS?|DAYS?|WEEKS?|MONTHS?|YEARS?)(\s+LATER)?$/i,
  // Scene markers - NOT character names
  /^SCENE\s+(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|\d+)$/i,
  /^SCENE\s+[A-Z]+$/i,
  /^ACT\s+(ONE|TWO|THREE|FOUR|FIVE|I|II|III|IV|V|\d+)$/i,
  /^(PROLOGUE|EPILOGUE|INTERMISSION|BLACKOUT|CURTAIN|END\s+OF\s+ACT)$/i,
  // "ALMOST X" patterns (not names)
  /^ALMOST\s+\d+$/i,
  /^ALMOST\s+(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)$/i,
  // Phrase patterns that get parsed as names
  /^LET\s+ME(\s+\w+)?$/i,
  /^GUESS\s+WHAT$/i,
  /^IS\s+(WHILE|WHEN|WHERE|WHAT|WHY|HOW|THIS|THAT|IT|HE|SHE|THEY|WHO)$/i,
  /^(IT|THIS|THAT|THERE|HERE|NOW|THEN)\s+IS$/i,
  /^(IT|THIS|THAT)\s+(IS|WAS|WILL|WOULD|COULD|SHOULD|MIGHT|MUST)$/i,
  // Common two-word non-name patterns
  /^(SO|BUT|AND|OR|IF|AS|TO|IN|ON|AT|BY|FOR|OF|UP|OUT|OFF|OVER|UNDER)\s+\w+$/i,
  /^\w+\s+(SO|BUT|AND|OR|IF|AS|IS|TO|IN|ON|AT|BY|FOR|OF)$/i,
  // Common location words that appear as standalone lines in PDFs
  /^(BACKYARD|FRONTYARD|DRIVEWAY|GARAGE|BASEMENT|ATTIC|HALLWAY|STAIRWAY|STAIRCASE|ROOFTOP|BALCONY|PATIO|PORCH|DECK|GARDEN|KITCHEN|BEDROOM|BATHROOM|LIVING\s*ROOM|DINING\s*ROOM|OFFICE|LOBBY|ELEVATOR|CORRIDOR|ALLEY|SIDEWALK|STREET|ROAD|HIGHWAY|PARKING\s*LOT|WAREHOUSE|FACTORY|BUILDING|APARTMENT|HOUSE|MANSION|CABIN|HOTEL|MOTEL|HOSPITAL|SCHOOL|CHURCH|STORE|SHOP|RESTAURANT|BAR|CLUB|STADIUM|ARENA|BEACH|FOREST|WOODS|MOUNTAIN|DESERT|OCEAN|LAKE|RIVER|BRIDGE|TUNNEL|SUBWAY|AIRPORT|STATION|PRISON|JAIL|COURT|COURTROOM|CEMETERY|MORGUE)$/i,
  
  // ============ BROAD SMART FILTERS ============
  // Time patterns with or without spaces (catches OCR artifacts like "TWENTYMINUTES")
  /\w*(MINUTE|HOUR|SECOND|DAY|WEEK|MONTH|YEAR|MOMENT)S?\s*(LATER|EARLIER|AGO|BEFORE|AFTER|PASS|PASSES|PASSED)$/i,
  // Possessive pronouns followed by anything (THEIR HOUSE, HIS CAR, HER ROOM, etc.)
  /^(THEIR|HIS|HER|ITS|OUR|YOUR|MY)\s+\w+/i,
  // Technical/production cues (MUSIC CUE, SOUND CUE, LIGHT CUE, etc.)
  /\b(CUE|CUES|SLATE|SLATES|TAKE|TAKES|ROLL|ROLLING|ACTION|CUT|WRAP|MARKER|MARK|SETUP|BLOCKING|COVERAGE|PICKUP|RE-?TAKE)\b/i,
  // Location descriptions (X AND Y patterns for rooms/places)
  /\b(BEDROOM|BATHROOM|KITCHEN|LIVING\s*ROOM|DINING\s*ROOM|HALLWAY|GARAGE|BASEMENT|ATTIC|OFFICE|LOBBY|FRONT\s*DOOR|BACK\s*DOOR|SIDE\s*DOOR|WINDOW|STAIRS|STAIRCASE|BALCONY|PATIO|PORCH|YARD|GARDEN|DRIVEWAY|STREET|ROAD|ALLEY|PARKING)\b.*\b(AND|OR)\b/i,
  // Phrases containing verbs (character names don't have verbs)
  /\b(IS|ARE|WAS|WERE|BE|BEEN|BEING|HAS|HAVE|HAD|DO|DOES|DID|WILL|WOULD|COULD|SHOULD|CAN|MAY|MIGHT|MUST|SHALL)\b/i,
  // Phrases with prepositions in the middle (X of Y, X to Y, etc.) - except valid character patterns
  /^\w+\s+(OF|TO|FROM|INTO|ONTO|WITH|WITHOUT|THROUGH|ACROSS|BEHIND|BENEATH|BESIDE|BETWEEN|BEYOND|INSIDE|OUTSIDE|TOWARD|TOWARDS|UPON|WITHIN|ALONG|AMONG|AROUND|AGAINST|ABOUT|ABOVE|BELOW|UNDER|OVER)\s+/i,
  // Phrases starting with articles followed by adjectives/nouns (THE SOMETHING, A WHATEVER) - not roles
  /^(THE|A|AN)\s+(?!DOCTOR|NURSE|DETECTIVE|OFFICER|CAPTAIN|SERGEANT|LIEUTENANT|GENERAL|COLONEL|MAJOR|PROFESSOR|JUDGE|MAYOR|PRESIDENT|KING|QUEEN|PRINCE|PRINCESS|LORD|LADY|SIR|MADAM|FATHER|MOTHER|SISTER|BROTHER|STRANGER|MAN|WOMAN|BOY|GIRL|KID|CHILD|BARTENDER|WAITER|WAITRESS|DRIVER|GUARD|PILOT|HOST|HOSTESS|CLERK|MANAGER|BOSS|ASSISTANT|SECRETARY|LAWYER|AGENT|REPORTER|ANCHOR|NARRATOR)\b/i,
  // Phrases ending with -ING, -ED, -LY, -TION, -MENT (action/description words, not names)
  /\w+(ING|TION|MENT|NESS|ABLE|IBLE|IOUS|EOUS|ICAL|ALLY)$/i,
  // Any word ending in -ED that's more than 4 chars (past tense verbs/adjectives, not names)
  /\w{3,}ED$/i,
  // Phrases with 4+ words (character names are typically 1-3 words max)
  /^\w+\s+\w+\s+\w+\s+\w+/i,
  // Numeric patterns mixed with text
  /\d+\s*[-:x]\s*\d+/i,
  /^\d+[A-Z]/i,
  /[A-Z]\d+$/i,
  // All caps phrases that look like directions/descriptions (contain common action words)
  /\b(BEGINS?|ENDS?|STARTS?|STOPS?|OPENS?|CLOSES?|ENTERS?|EXITS?|MOVES?|TURNS?|LOOKS?|SEES?|HEARS?|TAKES?|GIVES?|GETS?|PUTS?|SETS?|RUNS?|WALKS?|STANDS?|SITS?|FALLS?|RISES?|COMES?|GOES?|LEAVES?|ARRIVES?|RETURNS?|CONTINUES?|APPEARS?|DISAPPEARS?|REVEALS?|SHOWS?|PLAYS?|READS?|WRITES?|SPEAKS?|SAYS?|TELLS?|ASKS?|ANSWERS?|CALLS?|RINGS?|KNOCKS?|POINTS?|REACHES?|HOLDS?|DROPS?|PICKS?|PULLS?|PUSHES?|THROWS?|CATCHES?|GRABS?|TOUCHES?|FEELS?|THINKS?|KNOWS?|BELIEVES?|WANTS?|NEEDS?|TRIES?|FINDS?|LOSES?|WINS?|KILLS?|DIES?|LIVES?|LOVES?|HATES?|LIKES?|HELPS?|HURTS?|HITS?|BEATS?|BREAKS?|FIXES?|MAKES?|BUILDS?|CREATES?|DESTROYS?|CHANGES?|BECOMES?)\b/i,
  // Words/phrases that describe things rather than name people
  /^(SAME|DIFFERENT|SIMILAR|NEW|OLD|YOUNG|BIG|SMALL|LARGE|TINY|HUGE|LONG|SHORT|TALL|WIDE|NARROW|THICK|THIN|HEAVY|LIGHT|FAST|SLOW|QUICK|EARLY|LATE|FIRST|LAST|NEXT|PREVIOUS|FINAL|INITIAL|MAIN|PRIMARY|SECONDARY|MAJOR|MINOR|GOOD|BAD|BEST|WORST|BETTER|WORSE|RIGHT|WRONG|TRUE|FALSE|REAL|FAKE|FULL|EMPTY|OPEN|CLOSED|HOT|COLD|WARM|COOL|DARK|BRIGHT|LOUD|QUIET|SOFT|HARD|EASY|DIFFICULT|SIMPLE|COMPLEX|CLEAR|UNCLEAR|VISIBLE|HIDDEN|OBVIOUS|SUBTLE|IMPORTANT|APPROPRIATE|SUITABLE|RELEVANT|SPECIFIC|GENERAL|ENTIRE|COMPLETE|PARTIAL|TOTAL|WHOLE|HALF|DOUBLE|SINGLE|MULTIPLE|VARIOUS|SEVERAL|MANY|FEW|SOME|ALL|NONE|OTHER|ANOTHER|CERTAIN|POSSIBLE|LIKELY|UNLIKELY|NORMAL|STRANGE|WEIRD|ODD|USUAL|UNUSUAL|COMMON|RARE|TYPICAL|AVERAGE|SPECIAL|UNIQUE|PERFECT|EXACT|CORRECT|ACCURATE|PROPER|EXTREME)\s+\w+$/i,
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
  
  // CRITICAL: Reject context containing embedded character dialogue
  // Pattern: "CHARACTER. dialogue" or "CHARACTER: dialogue" indicates merged text
  // e.g., "CALLIE. 2:30." or "GEORGE. Kindergarten?"
  if (/\b[A-Z]{2,}(?:\s+[A-Z]{2,})?\.\s+[A-Z]?[a-z]/i.test(trimmed)) {
    return false; // Contains "NAME. word" pattern = embedded dialogue
  }
  if (/\b[A-Z]{2,}(?:\s+[A-Z]{2,})?:\s+/i.test(trimmed)) {
    return false; // Contains "NAME: " pattern = embedded dialogue
  }
  
  // Reject if contains multiple all-caps words that look like character names
  const capsWords = trimmed.match(/\b[A-Z]{3,}\b/g) || [];
  if (capsWords.length >= 2) {
    // Multiple all-caps words might be character names from merged lines
    return false;
  }
  
  // Reject if too long - but allow up to 500 for detailed scene descriptions
  if (trimmed.length > 500) {
    return false;
  }
  
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
// Detect merged lines from PDF extraction and split them
// e.g., "OFFICER HUDSONGood evening" -> ["OFFICER HUDSON", "Good evening"]
function splitMergedLines(text: string): string[] {
  // Pattern: ALL CAPS word immediately followed by mixed/lowercase word
  // This indicates a line break was lost: "HUDSONGood" should be "HUDSON" + newline + "Good"
  
  // First, add space where uppercase character name runs into lowercase dialogue
  // Match: 2+ uppercase letters followed immediately by uppercase+lowercase (start of word)
  let fixed = text.replace(/([A-Z]{2,})([A-Z][a-z])/g, '$1 $2');
  
  // Handle merged dialogue: "sitSARA." -> split before the character name
  // Pattern: lowercase followed immediately by ALLCAPS NAME with period/colon
  fixed = fixed.replace(/([a-z])([A-Z]{2,}(?:\s+[A-Z]{2,})?)[.:](\s|$)/g, '$1\n$2:$3');
  
  // Handle "word! NAME." patterns: "Coffee! SARA." -> split before NAME
  fixed = fixed.replace(/([.!?])\s*([A-Z]{3,}(?:\s+[A-Z]{2,})?)[.:]\s*/g, '$1\n$2: ');
  
  // Split on character names with extensions that appear mid-text
  // Pattern: [ALLCAPS NAME] or [NAME (CONT'D)] appearing after punctuation or lowercase
  const charNameMidText = /([.!?]\s*)([A-Z][A-Z\s]+(?:\s*\([^)]+\))?)\s+([A-Z][a-z])/g;
  fixed = fixed.replace(charNameMidText, '$1\n$2\n$3');
  
  // Split on "NAME." or "NAME:" patterns mid-text (merged PDF lines)
  // e.g., "...sarcastic sometimes. OLIVER. Unbelievable. SHANE. What?" 
  // Should split into separate character lines
  // Pattern: punctuation + space + ALLCAPS + period/colon
  fixed = fixed.replace(/([.!?])\s+([A-Z]{2,}(?:\s+[A-Z]{2,})?)[.:]\s*/g, '$1\n$2: ');
  
  // Also handle "NAME:" appearing mid-text without preceding punctuation
  // e.g., "blah blah OLIVER: Something"
  fixed = fixed.replace(/\s+([A-Z]{2,}(?:\s+[A-Z]{2,})?):\s+/g, '\n$1: ');
  
  // Also handle action lines embedded in dialogue
  // Pattern: after punctuation, NAME + action verb (passes, walks, looks, etc.)
  const actionMidText = /([.!?]\s*)([A-Z][A-Z]+)\s+(passes|walks|looks|turns|enters|exits|stands|sits|moves|picks|grabs|holds|opens|closes|falls|runs|comes|goes|takes|puts|gets|sees|hears|watches|crosses|leaves)/gi;
  fixed = fixed.replace(actionMidText, '$1\n[$2 $3');
  
  // Return as array of lines
  return fixed.split('\n').map(l => l.trim()).filter(l => l.length > 0);
}

function cleanDialogueText(text: string): string {
  let cleaned = text;
  
  // Remove production notes like "4 OMITTED", "SCENES 5-7 OMITTED", "12A OMITTED"
  cleaned = cleaned.replace(/\s*\d+[A-Z]?\s*OMITTED\s*/gi, ' ');
  cleaned = cleaned.replace(/\s*SCENES?\s+\d+(-\d+)?[A-Z]?\s*OMITTED\s*/gi, ' ');
  cleaned = cleaned.replace(/\s*OMITTED\s*/gi, ' ');
  
  // Remove copyright notices and special notes embedded in text
  // Pattern handles various spacings: "*See", "* See", etc.
  cleaned = cleaned.replace(/\*\s*See\s+Special\s+Note[^.]*\./gi, '');
  cleaned = cleaned.replace(/\*\s*See\s+Note[^.]*\./gi, '');
  cleaned = cleaned.replace(/\*[^*]*copyright[^*]*\./gi, '');
  cleaned = cleaned.replace(/\*[^*]*page\s*\d*\./gi, '');
  
  // Remove third-person narrative action descriptions that got merged into dialogue
  // "The doorbell rings." "Callie hides." "George enters." etc.
  cleaned = cleaned.replace(/\.\s+The\s+(?:doorbell|phone|buzzer|alarm|bell|door)\s+(?:rings?|buzzes?|sounds?|opens?|closes?)[^.]*\./gi, '.');
  cleaned = cleaned.replace(/\.\s+[A-Z][a-z]+\s+(?:hides?|appears?|enters?|exits?|leaves?|walks?|runs?|sits?|stands?|looks?|turns?|moves?|crosses?|nods?|shakes?|smiles?|laughs?|sighs?|gasps?|pauses?|hesitates?|waits?)[^.]*\./gi, '.');
  
  // Remove embedded character names with periods mid-dialogue: "SARA. You're Callie. CALLIE. Yes."
  // Pattern: NAME. (where NAME is 2+ caps followed by period and space)
  cleaned = cleaned.replace(/\s+[A-Z]{2,}(?:\s+[A-Z]{2,})?\.\s+/g, ' ');
  
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
  cleaned = cleaned.replace(/\\([A-Za-z])/g, '$1'); // Backslash before letters: \What -> What
  cleaned = cleaned.replace(/\\/g, ''); // Remove stray backslashes
  
  // Fix hyphenated line breaks from PDF extraction: "sar- castic" -> "sarcastic"
  cleaned = cleaned.replace(/(\w+)-\s+(\w+)/g, '$1$2');
  
  // Fix common OCR word merge issues where spaces were lost
  // "Iyou" -> "I you", "myfriend" -> "my friend", etc.
  cleaned = cleaned.replace(/\bIyou\b/g, 'I you');
  cleaned = cleaned.replace(/\bIfI\b/g, 'If I');
  cleaned = cleaned.replace(/\bIf I\b/g, 'If I');
  cleaned = cleaned.replace(/\bmyfriend\b/gi, 'my friend');
  cleaned = cleaned.replace(/\byoure\b/gi, "you're");
  cleaned = cleaned.replace(/\bwhatre\b/gi, "what're");
  cleaned = cleaned.replace(/\btheyre\b/gi, "they're");
  cleaned = cleaned.replace(/\bdidnt\b/gi, "didn't");
  cleaned = cleaned.replace(/\bwouldnt\b/gi, "wouldn't");
  cleaned = cleaned.replace(/\bcouldnt\b/gi, "couldn't");
  cleaned = cleaned.replace(/\bshouldnt\b/gi, "shouldn't");
  cleaned = cleaned.replace(/\bwasnt\b/gi, "wasn't");
  cleaned = cleaned.replace(/\bisnt\b/gi, "isn't");
  cleaned = cleaned.replace(/\barent\b/gi, "aren't");
  cleaned = cleaned.replace(/\bwont\b/gi, "won't");
  cleaned = cleaned.replace(/\bdont\b/gi, "don't");
  cleaned = cleaned.replace(/\bcant\b/gi, "can't");
  cleaned = cleaned.replace(/\bhavent\b/gi, "haven't");
  cleaned = cleaned.replace(/\bhasnt\b/gi, "hasn't");
  cleaned = cleaned.replace(/\bweve\b/gi, "we've");
  cleaned = cleaned.replace(/\bIve\b/g, "I've"); // Case-sensitive - only "Ive" not "ive"
  cleaned = cleaned.replace(/\byouve\b/gi, "you've");
  cleaned = cleaned.replace(/\btheyve\b/gi, "they've");
  cleaned = cleaned.replace(/\bIll\b/g, "I'll"); // Case-sensitive - only "Ill" at start of sentence
  cleaned = cleaned.replace(/\byoull\b/gi, "you'll");
  // Skip "well" -> "we'll" - too many false positives with the word "well"
  cleaned = cleaned.replace(/\btheyll\b/gi, "they'll");
  // Skip "whats", "thats", "hes", "shes", "its", "lets" - too many false positives
  // (what's vs whats, that's vs thats, he's vs hes, it's vs its possessive)
  cleaned = cleaned.replace(/\bwheres\b/gi, "where's");
  cleaned = cleaned.replace(/\bheres\b/gi, "here's");
  cleaned = cleaned.replace(/\btheres\b/gi, "there's");
  
  // Fix common OCR letter substitutions (conservative - avoid false positives)
  // Note: Many OCR errors like "rosses" for "crosses" require spell-checking which we avoid
  // to prevent introducing new errors. Users should use cleaner source PDFs when possible.
  
  // Clean up excessive punctuation
  cleaned = cleaned.replace(/\.{4,}/g, '...'); // Too many dots
  cleaned = cleaned.replace(/\s*\.\s*\.\s*\.\s*/g, '... '); // Spaced dots
  
  // Fix spacing issues
  cleaned = cleaned.replace(/\s{2,}/g, ' '); // Multiple spaces
  
  // Fix merged character names at start: "HUDSONGood evening" -> "Good evening"
  // Also handles "OLIVERYou refused" -> "You refused" (no space between name and dialogue)
  // The pattern matches: ALL_CAPS_NAME possibly followed by extension, then optionally transition to Title case
  cleaned = cleaned.replace(/^[A-Z]{2,}(?:\s+[A-Z]{2,})?(?:\s*\([^)]*\))?(?=[A-Z][a-z])/, '');
  cleaned = cleaned.replace(/^[A-Z]{2,}(?:\s+[A-Z]{2,})?(?:\s*\([^)]*\))?\s+/, '');
  
  // Extract embedded stage directions mid-dialogue: "(Beverly starts to cry.)" 
  // These are descriptive and should be removed from spoken dialogue
  // Match parentheticals that contain "he/she/they + verb" or character names + verbs
  cleaned = cleaned.replace(/\s*\([^)]*(?:starts?|begins?|stops?|pauses?|looks?|turns?|walks?|moves?|exits?|enters?|stands?|sits?|rises?|falls?|cries?|laughs?|sighs?|nods?|shakes?)[^)]*\)\s*/gi, ' ');
  
  // Also clean trailing character name patterns
  // e.g., "...please? OFFICER HUDSON" at end
  cleaned = cleaned.replace(/[.!?]\s*[A-Z]{2,}(?:\s+[A-Z]{2,})?(?:\s*\([^)]*\))?\s*$/g, '. ');
  
  // Clean up any resulting double spaces
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  
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
  // Scene/Act numbers as words (stage plays)
  "SCENE ONE", "SCENE TWO", "SCENE THREE", "SCENE FOUR", "SCENE FIVE",
  "SCENE SIX", "SCENE SEVEN", "SCENE EIGHT", "SCENE NINE", "SCENE TEN",
  "SCENE ELEVEN", "SCENE TWELVE", "SCENE THIRTEEN", "SCENE FOURTEEN", "SCENE FIFTEEN",
  "SCENE SIXTEEN", "SCENE SEVENTEEN", "SCENE EIGHTEEN", "SCENE NINETEEN", "SCENE TWENTY",
  "ACT ONE", "ACT TWO", "ACT THREE", "ACT FOUR", "ACT FIVE",
  "ACT I", "ACT II", "ACT III", "ACT IV", "ACT V",
  // Number words (often part of scene markers)
  "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN",
  "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN",
  "EIGHTEEN", "NINETEEN", "TWENTY", "TWENTY-ONE", "TWENTY-TWO", "THIRTY", "FORTY", "FIFTY",
  // Common play/movie titles that appear in scripts
  "STOP KISS", "STOPKISS", "KINN", "THE END", "BLACKOUT", "LIGHTS UP", "CURTAIN", "INTERMISSION",
  // Title page content and OCR artifacts
  "PLAYS", "SPRCIAL NOTI", "SPRCIAL", "NOTI", "DRAMATISTS", "DRAMATIST",
  // Common verbs/actions that aren't names
  "STOP", "KISS", "RUN", "WALK", "TALK", "LOOK", "SEE", "HEAR", "WAIT", "HELP",
  "COME", "GO", "STAY", "LEAVE", "TAKE", "GIVE", "GET", "MAKE", "FIND", "TELL",
  "LET", "GUESS", "ALMOST", "WHILE", "WHEN", "WHERE", "WHAT", "WHICH", "WHO",
  "BEFORE", "AFTER", "DURING", "UNTIL", "SINCE", "BECAUSE", "ALTHOUGH", "THOUGH",
  "HOWEVER", "THEREFORE", "MEANWHILE", "OTHERWISE", "INSTEAD", "BESIDES",
  "MAYBE", "PERHAPS", "PROBABLY", "CERTAINLY", "DEFINITELY", "OBVIOUSLY",
  "ACTUALLY", "REALLY", "TRULY", "SIMPLY", "JUST", "ONLY", "EVEN", "STILL",
  // Common phrases that get parsed as names
  "LET ME", "LET ME GUESS", "ALMOST", "GUESS WHAT",
  // Stage direction words
  "WINSLEY", "COLE", // Partial names that should be caught by full name matching
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
  
  // Fix OCR spacing artifacts in character names (e.g., "SIM BA" -> "SIMBA", "SCA R" -> "SCAR")
  // If we have exactly 2 short "words" (2-4 chars each) that together form a short name, combine them
  const words = normalized.split(/\s+/);
  if (words.length === 2) {
    const [w1, w2] = words;
    // Both words are short (likely a split name)
    if (w1.length >= 2 && w1.length <= 4 && w2.length >= 1 && w2.length <= 4) {
      const combined = w1 + w2;
      // If combined is a reasonable name length (4-8 chars), use it
      if (combined.length >= 4 && combined.length <= 8) {
        normalized = combined;
      }
    }
  }
  // Also fix single-letter fragments: "A LAN" -> "ALAN", "E LLA" -> "ELLA"  
  normalized = normalized.replace(/^([A-Z])\s+([A-Z]{2,5})$/i, '$1$2');
  // And trailing single letters: "SIMB A" -> "SIMBA"
  normalized = normalized.replace(/^([A-Z]{2,5})\s+([A-Z])$/i, '$1$2');
  
  return normalized.toUpperCase();
}

// Valid short names (2-3 chars) - real names only
const VALID_SHORT_NAMES = new Set([
  // 2-letter names (very conservative - only unambiguous names)
  "AL", "BO", "ED", "JO", "LU", "VI",
  // 3-letter names (common)
  "ABI", "ACE", "ADA", "AMY", "ANA", "ANN", "ASH", "AVA", "BEA", "BEN", "BOB", "CAL", "CAM", "DAN", 
  "DEE", "DOC", "DOM", "DON", "DOT", "DRU", "ELI", "EVA", "EVE", "FLO", "GAB", "GUS", "GUY", "HAL", 
  "HAN", "IAN", "IDA", "IKE", "INA", "IRA", "IVY", "JAX", "JAY", "JEB", "JED", "JEN", "JIM", "JOE", 
  "JON", "JOY", "KAI", "KAT", "KAY", "KEN", "KIM", "KIP", "KIT", "LEA", "LEE", "LEN", "LEO", "LES", 
  "LEX", "LIZ", "LOU", "LUC", "LYN", "MAC", "MAE", "MAX", "MAY", "MEG", "MEL", "MIA", "NAT", "NED", 
  "NIK", "ORA", "PAM", "PAT", "PEG", "RAE", "RAY", "REX", "ROB", "ROD", "RON", "ROY", "RUE", "SAL", 
  "SAM", "SID", "SIS", "SKY", "SLY", "STU", "SUE", "TAD", "TED", "TIM", "TOM", "VIC", "ZAC", "ZAK", "ZOE",
  // Common role descriptors that are valid
  "MOM", "DAD", "SIS", "BRO", "DOC", "COP", "REF", "KID", "SON", "BOY", "MAN", "GUY", "GOD", "NUN",
]);

function isValidCharacterName(name: string): boolean {
  const normalized = normalizeCharacterName(name);
  
  // Must be reasonable length
  if (normalized.length < 2 || normalized.length > 35) return false;
  
  // Very short names (2-3 chars) must be in the valid short names list
  if (normalized.length <= 3) {
    if (!VALID_SHORT_NAMES.has(normalized)) return false;
  }
  
  // Must start with a letter
  if (!/^[A-Z]/.test(normalized)) return false;
  
  // Reject names starting with "I" followed by a name (OCR merge: "ICALLIE")
  if (/^I[A-Z]{3,}$/.test(normalized)) return false;
  
  // Reject "NAME. WORD" patterns (merged dialogue)
  if (/^[A-Z]+\.\s*[A-Z]+$/i.test(normalized)) return false;
  
  // Reject if contains lowercase words (indicates merged dialogue like "SARA. It's...almost 6")
  // A valid character name should not have lowercase words after the first
  if (/[A-Z]+\.\s+[A-Za-z].*[a-z]/.test(name) && /\s/.test(name)) {
    // Has period followed by space and then mixed case - this is dialogue
    return false;
  }
  
  // Reject if name contains obviously lowercase dialogue words
  if (/\b(it's|i'm|i'll|you're|we're|they're|don't|can't|won't|isn't|aren't|wasn't|weren't|didn't|hasn't|haven't|couldn't|wouldn't|shouldn't|almost|about|around|until)\b/i.test(name)) {
    return false;
  }
  
  // Reject if name ends with a number (looks like time reference e.g., "UNTIL 8")
  if (/\b(UNTIL|AROUND|ABOUT|BEFORE|AFTER|BY|AT)\s+\d+$/i.test(name)) {
    return false;
  }
  
  // Reject if contains apostrophe in weird places (OCR artifact: "T'WENTY")
  if (/[A-Z]'[A-Z]{2,}/i.test(normalized)) return false;
  
  // Reject "SCENE" anything
  if (/^SCENE\b/i.test(normalized)) return false;
  
  // Reject "SOUND" anything
  if (/^SOUND\b/i.test(normalized)) return false;
  
  // Reject names with bare numbers at end that look like page numbers (e.g., "DET. COLE. 4")
  // But ALLOW character designations like "ACTOR 1", "COP 2", "WOMAN #3"
  if (/\.\s*\d+$/.test(normalized)) return false; // "NAME. 4" = page number
  if (/^\d+$/.test(normalized.split(/\s+/).pop() || "")) {
    // Name ends with a number - only allow if preceded by a word (ACTOR 1, COP 2)
    const parts = normalized.split(/\s+/);
    if (parts.length < 2) return false; // Just "1" is not valid
    // Allow patterns like "ACTOR 1", "COP 2", "MAN #1"
  }
  
  // Reject names with duplicate words (e.g., "CALLIE CALLIE" or "CALLIE. CALLIE")
  const words = normalized.replace(/\./g, '').split(/\s+/).filter(w => w.length > 0);
  const uniqueWords = new Set(words);
  if (words.length >= 2 && uniqueWords.size < words.length) {
    // Allow some legitimate duplicates like "MAMA" but not "CALLIE CALLIE"
    const firstWord = words[0];
    if (words.every(w => w === firstWord) && words.length > 1) return false;
  }
  
  // Reject if it looks like dialogue got merged: "NAME WORD WORD WORD"
  // where WORD is a common English word
  const commonWords = new Set(['THE', 'A', 'AN', 'IS', 'ARE', 'WAS', 'WERE', 'HAVE', 'HAS', 'HAD', 
    'DO', 'DOES', 'DID', 'WILL', 'WOULD', 'COULD', 'SHOULD', 'MAY', 'MIGHT', 'MUST',
    'CAN', 'BE', 'BEEN', 'BEING', 'NOT', 'NO', 'YES', 'SO', 'BUT', 'AND', 'OR', 'OK', 'OKAY']);
  if (words.length >= 2 && commonWords.has(words[words.length - 1])) return false;
  
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

// Check if a line LOOKS like a character name (all caps, short) even if invalid
// Used to detect when we should flush pending dialogue
function looksLikeCharacterName(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 2 || trimmed.length > 40) return false;
  
  // Remove extensions
  let coreName = trimmed.replace(EXTENSION_PATTERN, "").trim();
  coreName = coreName.replace(/\([^)]*\)\s*$/, "").trim();
  
  if (!coreName || coreName.length < 2) return false;
  
  // Check caps ratio
  const letters = coreName.match(/[A-Za-z]/g) || [];
  const upperLetters = coreName.match(/[A-Z]/g) || [];
  if (letters.length === 0) return false;
  const capsRatio = upperLetters.length / letters.length;
  if (capsRatio < 0.7) return false;
  
  // Should be short
  const wordCount = coreName.split(/\s+/).length;
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
  let trimmed = line.trim();
  
  if (!trimmed || trimmed.length < 2) {
    return { isCharacter: false, name: "", dialogue: "" };
  }
  
  // Strip leading dashes/bullets (common in generated or formatted scripts)
  // e.g., "- JOHN: Hello" -> "JOHN: Hello"
  trimmed = trimmed.replace(/^[-–—•]\s*/, '');
  
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
  
  // Pattern 1: CHARACTER: dialogue or CHARACTER. dialogue (most common for pasted scripts)
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
    // STAGE PLAY FORMAT: NAME. dialogue (character name ends with period)
    // Match: GEORGE. Hey Cal... or CALLIE. Yes!
    /^([A-Z][A-Z]+)\.\s+([A-Z][a-z].+)$/,
    // STAGE PLAY with title: MRS. WINSLEY. dialogue
    /^((?:DR|MR|MRS|MS|DET|SGT|LT|CAPT)\.?\s+[A-Z][A-Z]+)\.\s+(.+)$/,
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
    // Character name (proper noun) + "is/was/are/were" + emotional/action state (very common stage direction)
    // e.g., "Callie is stunned to see George", "Sara is confused", "George was surprised"
    /[!?.]\s+([A-Z][a-z]+\s+(?:is|was|are|were)\s+(?:stunned|shocked|surprised|confused|amused|delighted|horrified|embarrassed|annoyed|frustrated|worried|scared|nervous|excited|relieved|hurt|angry|happy|sad|moved|touched|silent|quiet|still|frozen|struck|taken aback|caught off guard|lost for words|speechless|at a loss))/i,
    // Character name + third person action verbs (stage direction narrative)
    // e.g., "Callie plays it off", "George looks away", "Sara turns to leave"
    /[!?.]\s+([A-Z][a-z]+\s+(?:plays?|looks?|turns?|walks?|runs?|stands?|sits?|moves?|crosses?|exits?|enters?|leaves?|appears?|goes?|comes?|starts?|stops?|tries?|begins?|continues?|pauses?|hesitates?|nods?|shakes?|smiles?|laughs?|cries?|sighs?|gasps?|shrugs?)\s+(?:it\s+off|away|around|back|to|at|up|down|over|off|in|out|for|the|his|her|their))/i,
    // Character name + "grabs/picks/takes" something (stage direction)
    // e.g., "Callie grabs newspapers", "George picks up the phone"
    /[!?.]\s+([A-Z][a-z]+\s+(?:grabs?|picks?|takes?|puts?|throws?|catches?|opens?|closes?|pulls?|pushes?|hands?|passes?|reaches?|lifts?|drops?|sets?|places?)\s+(?:up\s+)?(?:a|an|the|some|her|his|their|it|them|newspapers?|phone|door|book|bag|coat|hat|keys?|papers?))/i,
    // Sentence starting with plural noun + comma (object list in stage direction)
    // e.g., "newspapers, several pairs of dirty socks..."
    /[!?.]\s+((?:newspapers?|magazines?|books?|boxes?|papers?|clothes?|socks?|shoes?|bags?|bottles?|cups?|plates?|keys?|coins?|letters?|envelopes?|photos?|pictures?|documents?),\s*(?:several|a\s+few|some|many|various|a\s+couple|a\s+bunch|a\s+pile|a\s+stack|a\s+box|and))/i,
    // Lowercase word starting after punctuation indicates narrative/action (not dialogue)
    // e.g., "Come on up! newspapers, several..." - lowercase after ! is unlikely in dialogue
    // Note: Also matches when there's NO space after punctuation (PDF merge issue)
    /[!?.]\s*([a-z]{4,}[,\s])/,
    // Character name repeating + action verb (stage direction after dialogue)
    // e.g., "Come on up! Callie buzzes her in" - Callie is speaking, then "Callie buzzes" is action
    // Note: Also matches when there's NO space after punctuation (PDF merge issue)
    /[!?.]\s*([A-Z][a-z]+\s+(?:buzzes?|picks?\s+up|puts?\s+down|sets?\s+down|grabs?|takes?|hands?|reaches?|pulls?|pushes?|opens?|closes?|turns?|walks?|runs?|sits?|stands?|looks?\s+at|checks?|dials?|hangs?\s+up|answers?|reads?|writes?|types?|clicks?|taps?|presses?|holds?|drops?|throws?|catches?|lifts?|lowers?|moves?|crosses?|enters?|exits?|leaves?|goes?|comes?|starts?|stops?|begins?|continues?|finishes?|ends?))/i,
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
  // -> "...empatheric.\n(Beuerly starts to lose her composure.)\nBEVERLY. Itt what"
  // IMPORTANT: Keep the period and dialogue together with the character name
  text = text.replace(/(\([^)]+\))\s*([A-Z]{2,}(?:\s+[A-Z]{2,})?)\.\s+([A-Z][a-z])/g, '$1\n$2. $3');
  
  // Split when stage play character name appears after closing paren or lowercase text
  // e.g., "...composure.) BEVERLY. It's what" -> "...composure.)\nBEVERLY. It's what"
  // IMPORTANT: Keep the period and dialogue together with the character name
  text = text.replace(/([)a-z])\s+([A-Z]{2,}(?:\s+[A-Z]{2,})?)\.\s+([A-Z][a-z])/g, '$1\n$2. $3');
  
  // Split when stage play character name appears after sentence-ending punctuation
  // e.g., "...great. WINSLEY. How are you" -> "...great.\nWINSLEY. How are you"
  // e.g., "...8:00. MRS. WINSLEY. Should we..." -> "...8:00.\nMRS. WINSLEY. Should we..."
  text = text.replace(/([.!?])\s+([A-Z]{2,})\.\s+([A-Z][a-z])/g, '$1\n$2. $3');
  text = text.replace(/([.!?])\s+((?:MR|MRS|MS|DR|DET|SGT|LT|CAPT)\.?\s+[A-Z]{2,})\.\s+([A-Z][a-z])/g, '$1\n$2. $3');
  
  // Split on parenthetical stage direction appearing mid-line (not at start)
  // e.g., "...to you. (Beverly cries.) She..." -> "...to you.\n(Beverly cries.)\nShe..."
  text = text.replace(/([.!?])\s*(\([^)]+\))\s*([A-Z])/g, '$1\n$2\n$3');
  
  // STAGE PLAY FORMAT: Split merged dialogue where character name runs directly after dialogue
  // e.g., "sitSARA." -> "sit\nSARA." or "youCALLIE." -> "you\nCALLIE."
  // Pattern: lowercase letters immediately followed by ALL CAPS name + period + space + dialogue
  text = text.replace(/([a-z])([A-Z]{2,})\.\s+/g, '$1\n$2. ');
  
  // Split when dialogue ends with punctuation and action begins with character name (no space)
  // e.g., "up!Callie buzzes her in" -> "up!\nCallie buzzes her in"
  // This handles PDF merge issues where spaces are lost between dialogue and stage direction
  text = text.replace(/([!?.])([A-Z][a-z]+\s+(?:buzzes?|picks?|takes?|opens?|closes?|turns?|walks?|runs?|sits?|stands?|looks?|moves?|checks?|grabs?|reaches?|holds?|enters?|exits?|leaves?|goes?|comes?|starts?|stops?|puts?|sets?|places?|answers?|reads?|writes?|dials?|hangs?))/g, '$1\n$2');
  
  // Split when lowercase word runs directly into capitalized character name + action verb (no space, no punctuation)
  // e.g., "house atCallie checks her watch" -> "house at\nCallie checks her watch"
  // This handles severe PDF merge issues where spaces AND punctuation are lost
  text = text.replace(/([a-z]{2,})([A-Z][a-z]+\s+(?:checks?|looks?|turns?|walks?|runs?|sits?|stands?|moves?|enters?|exits?|leaves?|goes?|comes?|starts?|stops?|puts?|sets?|places?|grabs?|reaches?|holds?|opens?|closes?|picks?|takes?|answers?|reads?|writes?|dials?|hangs?|buzzes?|hides?|appears?|crosses?|watches?|waits?|nods?|shakes?|smiles?|laughs?|sighs?|gasps?))/g, '$1\n$2');
  
  // Handle title-based stage play names merged with dialogue
  // e.g., "showsMRS. WINSLEY." -> "shows\nMRS. WINSLEY."
  text = text.replace(/([a-z])((?:MR|MRS|MS|DR|DET|SGT|LT|CAPT)\.?\s+[A-Z]{2,})\.\s+/g, '$1\n$2. ');
  
  // Split when character name with period appears directly after lowercase (no space)
  // e.g., "soCALLIE." -> "so\nCALLIE." 
  text = text.replace(/([a-z])([A-Z]{3,})\.\s*([A-Z])/g, '$1\n$2.\n$3');
  
  // Split SCENE headings that are merged at end of lines
  // e.g., "...she wakes upSCENE THREE" -> "...she wakes up\nSCENE THREE"
  text = text.replace(/([a-z])(SCENE\s+(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY(?:-\w+)?|\d+))/gi, '$1\n$2');
  
  // Split SCENE headings that appear after punctuation with space
  // e.g., "...she wakes up. SCENE THREE" -> "...she wakes up.\nSCENE THREE"
  text = text.replace(/([.!?])\s+(SCENE\s+(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY(?:-\w+)?|\d+))/gi, '$1\n$2');
  
  // Split SCENE headings that appear after any text (preceded by space)
  // e.g., "STOP KISS by Diana Son SCENE ONE" -> "...Son\nSCENE ONE"
  text = text.replace(/\s+(SCENE\s+(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY(?:-\w+)?|\d+))\b/gi, '\n$1');
  
  return text;
}

export function parseScript(rawText: string): ParsedScript {
  // Strip BOM (Byte Order Mark) if present
  let cleanedText = rawText.replace(/^\uFEFF/, '');
  
  // Normalize various dash types to standard hyphen
  cleanedText = cleanedText.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-');
  
  // Normalize various quote types
  cleanedText = cleanedText.replace(/[\u2018\u2019\u201B]/g, "'");
  cleanedText = cleanedText.replace(/[\u201C\u201D\u201F]/g, '"');
  
  // Normalize various periods/dots
  cleanedText = cleanedText.replace(/[\u2024\u2027\uFE52\uFF0E]/g, '.');
  
  // Preprocess to fix PDF copy-paste issues
  const preprocessed = preprocessScript(cleanedText);
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
        // Direction is already validated during extraction - just check it's not empty
        const validDirection = direction && direction.length > 0 ? direction : undefined;
        const scriptLine: ScriptLine = {
          id: generateId(),
          lineNumber: lineNumber++,
          roleId: role.id,
          roleName: pendingCharacter,
          text: cleanText,
          direction: validDirection,
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
    if (/[A-Z]{2,}\s+(swears?|mutters?|sighs?|groans?|nods?|shakes?|walks?|runs?|drives?|pulls?|looks?|looks?\s+at|turns?|enters?|exits?|stands?|sits?)\b/i.test(trimmed)) {
      return true;
    }
    
    // Lines starting with character name + possessive ('s) are scene description
    // e.g., "Callie's apartment.", "John's car pulls up."
    if (/^[A-Z][a-z]+('s|'s)\s+\w+/i.test(trimmed)) {
      return true;
    }
    
    // Lines starting with proper noun (capitalized word) + action verb are stage direction
    // e.g., "Callie puts on a CD.", "George enters the room."
    if (/^[A-Z][a-z]+\s+(puts?|picks?|takes?|opens?|closes?|enters?|exits?|walks?|runs?|sits?|stands?|looks?|turns?|moves?|crosses?|grabs?|reaches?|holds?|checks?|locks?|unlocks?|buzzes?|rings?|answers?|dials?|hangs?|sets?|places?|drops?|throws?|catches?|lifts?|lowers?|pours?|drinks?|eats?|reads?|writes?|types?|clicks?|taps?|presses?|pulls?|pushes?|lip-syncs?|ceremoniously|slowly|quickly|carefully|quietly|suddenly|nervously)\b/i.test(trimmed)) {
      return true;
    }
    
    // Lines starting with articles describing the scene
    // e.g., "The phone rings.", "A door slams."
    if (/^(The|A|An)\s+\w+\s+(rings?|slams?|opens?|closes?|buzzes?|beeps?|chimes?|falls?|breaks?|crashes?)\b/i.test(trimmed)) {
      return true;
    }
    
    // Lines that describe setting/location (common scene description patterns)
    // e.g., "Something '70s and great to dance to..."
    if (/^Something\s+/i.test(trimmed) || /^Somewhere\s+/i.test(trimmed)) {
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
        } else if (looksLikeCharacterName(trimmed)) {
          // Looks like character name but failed validation (e.g., "SCENE TWENTY")
          // Flush and clear pending - don't attribute next lines to previous character
          flushPendingDialogue();
          pendingCharacter = null;
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

  // Extract canonical names from CAST section if present
  const canonicalNames = extractCastNames(rawText);
  
  // Consolidate and deduplicate roles, using canonical names if available
  const consolidatedRoles = consolidateRoles(Array.from(roles.values()), scenes, canonicalNames);

  return {
    roles: consolidatedRoles,
    scenes,
  };
}

// Extract canonical character names from CAST section
function extractCastNames(rawText: string): string[] {
  const canonicalNames: string[] = [];
  
  // Look for CAST section - various formats, more flexible matching
  const castPatterns = [
    /(?:^|\n)\s*CAST\s*(?:OF\s+CHARACTERS)?\s*[\n:]/im,
    /(?:^|\n)\s*CAST\s*\n/im,
    /(?:^|\n)\s*CHARACTERS\s*[\n:]/im,
    /(?:^|\n)\s*DRAMATIS\s+PERSONAE\s*[\n:]/im,
    /\bCAST\b[^\n]*\n\s*[A-Z]/im,
  ];
  
  let castMatch: RegExpMatchArray | null = null;
  for (const pattern of castPatterns) {
    castMatch = rawText.match(pattern);
    if (castMatch) break;
  }
  
  if (!castMatch) {
    return canonicalNames;
  }
  
  const castStart = castMatch.index! + castMatch[0].length;
  const afterCast = rawText.substring(castStart);
  const endMatch = afterCast.match(/(?:^|\n)\s*(?:ACT\s+[IVX\d]|SCENE\s*\d|INT\.|EXT\.|[A-Z]{2,}:\s+[a-z])/im);
  
  const castEnd = endMatch ? castStart + endMatch.index! : castStart + 2000;
  const castSection = rawText.substring(castStart, Math.min(castEnd, castStart + 2000));
  
  // Parse cast section - handle merged entries on same line
  // OCR often loses line breaks: "CALLIE-late 20s.SARA-mid 20s." all on one line
  
  // First, split merged entries by looking for NAME-age patterns
  let normalizedCast = castSection;
  // Add newline before each character entry (NAME-age or NAME - age pattern)
  normalizedCast = normalizedCast.replace(/\.([A-Z][A-Z\s\.]+?)\s*[-–—]/g, '.\n$1-');
  
  const lines = normalizedCast.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    const nameMatch = trimmed.match(/^([A-Z][A-Z\s\.]+?)(?:\s*[-–—]\s*|\s*\(|\s+(?:late|mid|early|[0-9]))/i);
    
    if (nameMatch) {
      let name = nameMatch[1].trim();
      if (name.endsWith('.') && !name.match(/\b(?:MRS|MR|DR|MS|PROF|REV|DET|SGT|LT|CAPT|COL|MAJ|GEN|SEN|REP|GOV)\.$/i)) {
        name = name.slice(0, -1).trim();
      }
      if (name.length >= 2 && name.length <= 30) {
        canonicalNames.push(name.toUpperCase());
      }
    }
  }
  
  return canonicalNames;
}

// Consolidate roles that are variations of the same character
// e.g., "DET COLE", "DETECTIVE COLE", "COLE" -> "DETECTIVE COLE"
// Also fixes OCR errors: "HARA" -> "SARA", "GRORGE" -> "GEORGE"
function consolidateRoles(roles: Role[], scenes: Scene[], canonicalNames: string[] = []): Role[] {
  // Title abbreviation map
  const titleExpansions: Record<string, string> = {
    "DET": "DETECTIVE",
    "SGT": "SERGEANT", 
    "LT": "LIEUTENANT",
    "CAPT": "CAPTAIN",
    "DR": "DOCTOR",
    "MR": "MISTER",
    "MS": "MS",
    "PROF": "PROFESSOR",
    "REV": "REVEREND",
    "SEN": "SENATOR",
    "REP": "REPRESENTATIVE",
    "GOV": "GOVERNOR",
    "GEN": "GENERAL",
    "COL": "COLONEL",
    "MAJ": "MAJOR",
  };
  
  // Build a map of normalized names to canonical names
  const nameMap = new Map<string, string>(); // normalized -> canonical
  const rolesByCanonical = new Map<string, Role>(); // canonical -> merged role
  
  // Helper: find matching canonical name from CAST section
  function findCanonicalMatch(name: string): string | null {
    const upperName = name.toUpperCase();
    
    if (canonicalNames.includes(upperName)) {
      return upperName;
    }
    
    for (const canonical of canonicalNames) {
      const nameWords = upperName.split(/\s+/);
      const canonWords = canonical.split(/\s+/);
      const nameLast = nameWords[nameWords.length - 1];
      const canonLast = canonWords[canonWords.length - 1];
      
      if (nameWords.length > 1 && canonWords.length > 1 && nameLast === canonLast) {
        return canonical;
      }
      
      if (nameWords.length === 1 && canonWords.length === 1) {
        if (areOCRVariants(upperName, canonical)) {
          return canonical;
        }
      }
      
      if (nameWords.length === 1 && canonWords.length >= 1) {
        if (areOCRVariants(upperName, canonLast)) {
          return canonical;
        }
      }
      
      // Check for badly garbled short names (like CROR -> GEORGE)
      if (nameWords.length === 1 && canonWords.length === 1) {
        if (isGarbledVersion(upperName, canonical)) {
          return canonical;
        }
      }
    }
    
    return null;
  }
  
  // Sort roles by line count descending - names with more lines are more likely correct
  const sortedRoles = [...roles].sort((a, b) => b.lineCount - a.lineCount);
  
  // First pass: identify the longest/most complete version of each name
  for (const role of sortedRoles) {
    const name = role.name;
    const words = name.split(/\s+/);
    
    // Expand abbreviations for comparison
    const expandedWords = words.map(w => titleExpansions[w] || w);
    const expandedName = expandedWords.join(" ");
    
    // Get the last word (likely the surname)
    const lastName = words[words.length - 1];
    
    // First, check if this name matches a canonical name from CAST section
    const castCanonical = findCanonicalMatch(name);
    if (castCanonical && castCanonical !== name.toUpperCase()) {
      // Check if we already have this canonical role
      if (rolesByCanonical.has(castCanonical)) {
        const existingRole = rolesByCanonical.get(castCanonical)!;
        existingRole.lineCount += role.lineCount;
        nameMap.set(name, castCanonical);
      } else {
        // Create new role with canonical name
        const correctedRole = { ...role, name: castCanonical };
        rolesByCanonical.set(castCanonical, correctedRole);
        nameMap.set(name, castCanonical);
        nameMap.set(castCanonical, castCanonical);
      }
      continue;
    }
    
    // Check if this name is a substring of or contains another role
    let canonical = name;
    let foundMatch = false;
    
    for (const [existingNorm, existingCanon] of Array.from(nameMap.entries())) {
      const existingRole = rolesByCanonical.get(existingCanon);
      if (!existingRole) continue;
      
      const existingWords = existingCanon.split(/\s+/);
      const existingLastName = existingWords[existingWords.length - 1];
      
      // Check for OCR variants first (HARA/SARA, GRORGE/GEORGE, etc.)
      // For single-word names, compare directly
      if (words.length === 1 && existingWords.length === 1) {
        if (areOCRVariants(name, existingCanon)) {
          // Merge into the one with more lines (already sorted, so existingCanon has more)
          nameMap.set(name, existingCanon);
          existingRole.lineCount += role.lineCount;
          canonical = existingCanon;
          foundMatch = true;
          break;
        }
      }
      
      // Same last name? Likely the same character
      if (lastName === existingLastName && lastName.length >= 4) {
        // Use the longer name as canonical
        if (name.length > existingCanon.length) {
          // This name is longer, make it canonical
          nameMap.set(existingNorm, name);
          nameMap.set(name, name);
          const mergedRole = {
            ...role,
            lineCount: role.lineCount + existingRole.lineCount,
          };
          rolesByCanonical.delete(existingCanon);
          rolesByCanonical.set(name, mergedRole);
          canonical = name;
        } else {
          // Existing is longer, merge into it
          nameMap.set(name, existingCanon);
          existingRole.lineCount += role.lineCount;
          canonical = existingCanon;
        }
        foundMatch = true;
        break;
      }
      
      // Check for OCR variants in last names of multi-word names
      if (words.length > 1 && existingWords.length > 1) {
        if (areOCRVariants(lastName, existingLastName)) {
          // Merge into the one with more lines
          nameMap.set(name, existingCanon);
          existingRole.lineCount += role.lineCount;
          canonical = existingCanon;
          foundMatch = true;
          break;
        }
      }
    }
    
    if (!foundMatch) {
      nameMap.set(name, name);
      rolesByCanonical.set(name, { ...role });
    }
  }
  
  // Update scene lines to use canonical names
  for (const scene of scenes) {
    for (const line of scene.lines) {
      const canonical = nameMap.get(line.roleName);
      if (canonical && canonical !== line.roleName) {
        line.roleName = canonical;
        line.roleId = rolesByCanonical.get(canonical)?.id || line.roleId;
      }
    }
  }
  
  // Return deduplicated roles sorted by line count
  return Array.from(rolesByCanonical.values())
    .sort((a, b) => b.lineCount - a.lineCount);
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

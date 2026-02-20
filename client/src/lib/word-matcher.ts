export interface WordMatch {
  word: string;
  matched: boolean;
}

// Contraction mappings - both directions
const CONTRACTIONS: Record<string, string[]> = {
  // Negations
  "didn't": ["did", "not", "didnt"],
  "don't": ["do", "not", "dont"],
  "won't": ["will", "not", "wont"],
  "can't": ["cannot", "can", "not", "cant"],
  "couldn't": ["could", "not", "couldnt"],
  "wouldn't": ["would", "not", "wouldnt"],
  "shouldn't": ["should", "not", "shouldnt"],
  "isn't": ["is", "not", "isnt"],
  "aren't": ["are", "not", "arent"],
  "wasn't": ["was", "not", "wasnt"],
  "weren't": ["were", "not", "werent"],
  "hasn't": ["has", "not", "hasnt"],
  "haven't": ["have", "not", "havent"],
  "hadn't": ["had", "not", "hadnt"],
  "doesn't": ["does", "not", "doesnt"],
  // Pronouns + be
  "i'm": ["i", "am", "im"],
  "you're": ["you", "are", "youre"],
  "we're": ["we", "are", "were"],
  "they're": ["they", "are", "theyre"],
  "he's": ["he", "is", "hes"],
  "she's": ["she", "is", "shes"],
  "it's": ["it", "is", "its"],
  "that's": ["that", "is", "thats"],
  "what's": ["what", "is", "whats"],
  "there's": ["there", "is", "theres"],
  "here's": ["here", "is", "heres"],
  // Have
  "i've": ["i", "have", "ive"],
  "you've": ["you", "have", "youve"],
  "we've": ["we", "have", "weve"],
  "they've": ["they", "have", "theyve"],
  // Will
  "i'll": ["i", "will", "ill"],
  "you'll": ["you", "will", "youll"],
  "we'll": ["we", "will", "well"],
  "they'll": ["they", "will", "theyll"],
  "he'll": ["he", "will", "hell"],
  "she'll": ["she", "will", "shell"],
  "it'll": ["it", "will", "itll"],
  // Would
  "i'd": ["i", "would", "id"],
  "you'd": ["you", "would", "youd"],
  "we'd": ["we", "would", "wed"],
  "they'd": ["they", "would", "theyd"],
  "he'd": ["he", "would", "hed"],
  "she'd": ["she", "would", "shed"],
  "let's": ["let", "us", "lets"],
  // Informal speech patterns
  "gonna": ["going", "to", "gon", "na"],
  "wanna": ["want", "to", "wan", "na"],
  "gotta": ["got", "to", "have", "gota"],
  "kinda": ["kind", "of", "kindof"],
  "sorta": ["sort", "of", "sortof"],
  "outta": ["out", "of", "outof"],
  "could've": ["could", "have", "couldve", "coulda", "could've"],
  "would've": ["would", "have", "wouldve", "woulda", "would've"],
  "should've": ["should", "have", "shouldve", "shoulda", "should've"],
  "might've": ["might", "have", "mightve", "mighta", "might've"],
  "must've": ["must", "have", "mustve", "musta", "must've"],
  "coulda": ["could", "have", "couldve", "could've"],
  "woulda": ["would", "have", "wouldve", "would've"],
  "shoulda": ["should", "have", "shouldve", "should've"],
  "mighta": ["might", "have", "mightve", "might've"],
  "musta": ["must", "have", "mustve", "must've"],
  "oughta": ["ought", "to"],
  "hafta": ["have", "to"],
  "useta": ["used", "to"],
  "lemme": ["let", "me"],
  "gimme": ["give", "me"],
  "dunno": ["do", "not", "know", "dont"],
  "cause": ["because", "cuz", "coz"],
  "cuz": ["because", "cause", "coz"],
  "yeah": ["yes", "yea", "yep", "yup"],
  "yep": ["yes", "yeah", "yea", "yup"],
  "nope": ["no", "nah"],
  "nah": ["no", "nope"],
  "ok": ["okay", "okey"],
  "okay": ["ok", "okey"],
  "alright": ["all", "right", "aight"],
  "ain't": ["is", "not", "are", "am", "aint", "isnt", "arent"],
  "y'all": ["you", "all", "yall"],
  "c'mon": ["come", "on", "cmon"],
  "em": ["them"],
  "'em": ["them"],
  "ya": ["you", "your"],
  "bout": ["about"],
  "'bout": ["about"],
  // Filler words and hesitations - speech recognition often transcribes these differently
  "uh": ["um", "ah", "eh", "er", "hmm", "hm"],
  "um": ["uh", "ah", "eh", "er", "hmm", "hm"],
  "ah": ["uh", "um", "oh", "aah"],
  "oh": ["ah", "ooh", "oo"],
  "hmm": ["hm", "mm", "mhm", "uh", "um"],
  "huh": ["uh", "hm", "what"],
  "er": ["uh", "um", "ah"],
  "erm": ["um", "er", "uh"],
  "well": ["uh", "um", "so"],
};

const NUMBER_WORDS: Record<string, string[]> = {
  "0": ["zero", "oh", "o"],
  "1": ["one", "won"],
  "2": ["two", "to", "too"],
  "3": ["three"],
  "4": ["four", "for", "fore"],
  "5": ["five"],
  "6": ["six"],
  "7": ["seven"],
  "8": ["eight", "ate"],
  "9": ["nine"],
  "10": ["ten"],
  "11": ["eleven"],
  "12": ["twelve"],
  "13": ["thirteen"],
  "14": ["fourteen"],
  "15": ["fifteen"],
  "16": ["sixteen"],
  "17": ["seventeen"],
  "18": ["eighteen"],
  "19": ["nineteen"],
  "20": ["twenty"],
  "30": ["thirty"],
  "40": ["forty"],
  "50": ["fifty"],
  "60": ["sixty"],
  "70": ["seventy"],
  "80": ["eighty"],
  "90": ["ninety"],
  "100": ["hundred"],
  "1000": ["thousand"],
  "1000000": ["million"],
  "zero": ["0"],
  "one": ["1", "won"],
  "two": ["2", "to", "too"],
  "three": ["3"],
  "four": ["4", "for", "fore"],
  "five": ["5"],
  "six": ["6"],
  "seven": ["7"],
  "eight": ["8", "ate"],
  "nine": ["9"],
  "ten": ["10"],
  "eleven": ["11"],
  "twelve": ["12"],
  "thirteen": ["13"],
  "fourteen": ["14"],
  "fifteen": ["15"],
  "sixteen": ["16"],
  "seventeen": ["17"],
  "eighteen": ["18"],
  "nineteen": ["19"],
  "twenty": ["20"],
  "thirty": ["30"],
  "forty": ["40"],
  "fifty": ["50"],
  "sixty": ["60"],
  "seventy": ["70"],
  "eighty": ["80"],
  "ninety": ["90"],
  "hundred": ["100"],
  "thousand": ["1000"],
  "million": ["1000000"],
  "first": ["1st"],
  "second": ["2nd"],
  "third": ["3rd"],
  "1st": ["first"],
  "2nd": ["second"],
  "3rd": ["third"],
};

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^a-z0-9']/g, '')
    .trim();
}

// Get all possible forms of a word (including contraction expansions)
function getWordForms(word: string): string[] {
  const normalized = normalizeWord(word);
  const forms = [normalized, normalized.replace(/'/g, '')];
  
  if (CONTRACTIONS[normalized]) {
    forms.push(...CONTRACTIONS[normalized]);
  }
  
  for (const [contraction, expansions] of Object.entries(CONTRACTIONS)) {
    if (expansions.includes(normalized)) {
      forms.push(contraction, contraction.replace(/'/g, ''));
    }
  }
  
  if (NUMBER_WORDS[normalized]) {
    forms.push(...NUMBER_WORDS[normalized]);
  }
  
  return forms;
}

export function matchWords(expectedText: string, spokenText: string): {
  words: WordMatch[];
  matchedCount: number;
  totalWords: number;
  percentMatched: number;
  isComplete: boolean;
} {
  const expectedWords = expectedText.split(/\s+/).filter(w => w.length > 0);
  const spokenWords = spokenText.split(/\s+/).filter(w => w.length > 0);
  
  // Build a set of all spoken word forms (including contraction variants)
  const spokenForms = new Set<string>();
  for (const word of spokenWords) {
    for (const form of getWordForms(word)) {
      spokenForms.add(form);
    }
  }
  
  const words: WordMatch[] = expectedWords.map(word => {
    const forms = getWordForms(word);
    const matched = forms.some(form => spokenForms.has(form));
    return { word, matched };
  });
  
  const matchedCount = words.filter(w => w.matched).length;
  const totalWords = expectedWords.length;
  const percentMatched = totalWords > 0 ? (matchedCount / totalWords) * 100 : 0;
  
  // Require 80% match for auto-complete, or all words for short lines
  const isComplete = percentMatched >= 80 || (totalWords <= 3 && matchedCount >= totalWords);
  
  return {
    words,
    matchedCount,
    totalWords,
    percentMatched,
    isComplete,
  };
}

export function matchWordsSequential(expectedText: string, spokenText: string): {
  words: WordMatch[];
  matchedCount: number;
  totalWords: number;
  percentMatched: number;
  isComplete: boolean;
} {
  const expectedWords = expectedText.split(/\s+/).filter(w => w.length > 0);
  const spokenNormalized = spokenText.toLowerCase();
  
  let matchedUpTo = 0;
  
  for (let i = 0; i < expectedWords.length; i++) {
    const expectedNorm = normalizeWord(expectedWords[i]);
    if (expectedNorm.length === 0) {
      matchedUpTo = i + 1;
      continue;
    }
    
    if (spokenNormalized.includes(expectedNorm)) {
      matchedUpTo = i + 1;
    }
  }
  
  const words: WordMatch[] = expectedWords.map((word, i) => ({
    word,
    matched: i < matchedUpTo,
  }));
  
  const matchedCount = matchedUpTo;
  const totalWords = expectedWords.length;
  const percentMatched = totalWords > 0 ? (matchedCount / totalWords) * 100 : 0;
  
  // Require 80% match for auto-complete, or all words for short lines
  const isComplete = percentMatched >= 80 || (totalWords <= 3 && matchedCount >= totalWords);
  
  return {
    words,
    matchedCount,
    totalWords,
    percentMatched,
    isComplete,
  };
}

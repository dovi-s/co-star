export interface WordMatch {
  word: string;
  matched: boolean;
  status: 'matched' | 'skipped' | 'ahead';
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
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035\u0060]/g, "'")
    .replace(/[^a-z0-9']/g, '')
    .trim();
}

// Get all possible forms of a word (including contraction expansions)
function getWordForms(word: string): string[] {
  const normalized = normalizeWord(word);
  const withoutApostrophe = normalized.replace(/'/g, '');
  const forms = new Set([normalized, withoutApostrophe]);
  
  if (CONTRACTIONS[normalized]) {
    for (const f of CONTRACTIONS[normalized]) forms.add(f);
  }
  if (withoutApostrophe !== normalized && CONTRACTIONS[withoutApostrophe]) {
    for (const f of CONTRACTIONS[withoutApostrophe]) forms.add(f);
  }
  
  for (const [contraction, expansions] of Object.entries(CONTRACTIONS)) {
    if (expansions.includes(normalized) || expansions.includes(withoutApostrophe)) {
      forms.add(contraction);
      forms.add(contraction.replace(/'/g, ''));
    }
  }
  
  if (NUMBER_WORDS[normalized]) {
    for (const f of NUMBER_WORDS[normalized]) forms.add(f);
  }
  if (NUMBER_WORDS[withoutApostrophe]) {
    for (const f of NUMBER_WORDS[withoutApostrophe]) forms.add(f);
  }
  
  return Array.from(forms);
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
  
  const spokenForms = new Set<string>();
  const spokenNorms: string[] = [];
  for (const word of spokenWords) {
    const norm = normalizeWord(word);
    spokenNorms.push(norm);
    for (const form of getWordForms(word)) {
      spokenForms.add(form);
    }
  }

  for (let i = 0; i < spokenNorms.length - 1; i++) {
    spokenForms.add(spokenNorms[i] + spokenNorms[i + 1]);
  }

  const words: WordMatch[] = expectedWords.map((word, idx) => {
    const forms = getWordForms(word);
    let matched = forms.some(form => spokenForms.has(form));
    if (!matched && idx + 1 < expectedWords.length) {
      const combined = normalizeWord(word) + normalizeWord(expectedWords[idx + 1]);
      if (combined.length >= 3 && spokenForms.has(combined)) {
        matched = true;
      }
    }
    return { word, matched, status: matched ? 'matched' as const : 'ahead' as const };
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
  highWaterMark: number;
} {
  const expectedWords = expectedText.split(/\s+/).filter(w => w.length > 0);
  const spokenWords = spokenText.split(/\s+/).filter(w => w.length > 0);
  const totalWords = expectedWords.length;

  if (spokenWords.length === 0 || totalWords === 0) {
    return {
      words: expectedWords.map(word => ({ word, matched: false, status: 'ahead' as const })),
      matchedCount: 0,
      totalWords,
      percentMatched: 0,
      isComplete: false,
      highWaterMark: -1,
    };
  }

  const spokenForms: Set<string>[] = spokenWords.map(w => {
    const forms = getWordForms(w);
    return new Set(forms);
  });

  const spokenNorms = spokenWords.map(w => normalizeWord(w));

  const matched = new Array(totalWords).fill(false);
  let si = 0;
  let highWaterMark = -1;

  for (let ei = 0; ei < totalWords; ei++) {
    const expectedNorm = normalizeWord(expectedWords[ei]);
    if (expectedNorm.length === 0) {
      matched[ei] = true;
      highWaterMark = ei;
      continue;
    }

    const expectedForms = getWordForms(expectedWords[ei]);
    let found = false;

    const lookahead = Math.min(si + 4, spokenWords.length);
    for (let sj = si; sj < lookahead; sj++) {
      const isMatch = expectedForms.some(f => spokenForms[sj].has(f));
      if (isMatch) {
        matched[ei] = true;
        highWaterMark = ei;
        si = sj + 1;
        found = true;
        break;
      }
    }

    if (!found && si < spokenWords.length) {
      for (let sj = si; sj < spokenWords.length; sj++) {
        const isMatch = expectedForms.some(f => spokenForms[sj].has(f));
        if (isMatch) {
          matched[ei] = true;
          highWaterMark = ei;
          si = sj + 1;
          found = true;
          break;
        }
      }
    }

    if (!found && ei + 1 < totalWords) {
      const nextNorm = normalizeWord(expectedWords[ei + 1]);
      const combined = expectedNorm + nextNorm;
      if (combined.length >= 3) {
        for (let sj = si; sj < spokenWords.length; sj++) {
          if (spokenNorms[sj] === combined || spokenForms[sj].has(combined)) {
            matched[ei] = true;
            matched[ei + 1] = true;
            highWaterMark = ei + 1;
            si = sj + 1;
            found = true;
            break;
          }
        }
      }
    }

    if (!found) {
      for (let sj = si; sj < Math.min(si + 4, spokenWords.length - 1); sj++) {
        const spokenCombined = spokenNorms[sj] + spokenNorms[sj + 1];
        if (spokenCombined === expectedNorm || expectedForms.some(f => f === spokenCombined)) {
          matched[ei] = true;
          highWaterMark = ei;
          si = sj + 2;
          break;
        }
      }
    }
  }

  const words: WordMatch[] = expectedWords.map((word, i) => {
    if (matched[i]) {
      return { word, matched: true, status: 'matched' as const };
    }
    if (i <= highWaterMark) {
      return { word, matched: false, status: 'skipped' as const };
    }
    return { word, matched: false, status: 'ahead' as const };
  });

  const matchedCount = matched.filter(Boolean).length;
  const percentMatched = totalWords > 0 ? (matchedCount / totalWords) * 100 : 0;
  const isComplete = percentMatched >= 80 || (totalWords <= 3 && matchedCount >= totalWords);

  return {
    words,
    matchedCount,
    totalWords,
    percentMatched,
    isComplete,
    highWaterMark,
  };
}

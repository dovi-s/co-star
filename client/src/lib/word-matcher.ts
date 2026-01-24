export interface WordMatch {
  word: string;
  matched: boolean;
}

// Contraction mappings - both directions
const CONTRACTIONS: Record<string, string[]> = {
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
  "i've": ["i", "have", "ive"],
  "you've": ["you", "have", "youve"],
  "we've": ["we", "have", "weve"],
  "they've": ["they", "have", "theyve"],
  "i'll": ["i", "will", "ill"],
  "you'll": ["you", "will", "youll"],
  "we'll": ["we", "will", "well"],
  "they'll": ["they", "will", "theyll"],
  "he'll": ["he", "will", "hell"],
  "she'll": ["she", "will", "shell"],
  "it'll": ["it", "will", "itll"],
  "i'd": ["i", "would", "id"],
  "you'd": ["you", "would", "youd"],
  "we'd": ["we", "would", "wed"],
  "they'd": ["they", "would", "theyd"],
  "he'd": ["he", "would", "hed"],
  "she'd": ["she", "would", "shed"],
  "let's": ["let", "us", "lets"],
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
  
  // Check if this word is a contraction
  if (CONTRACTIONS[normalized]) {
    forms.push(...CONTRACTIONS[normalized]);
  }
  
  // Check if spoken words might be the expanded form of a contraction
  for (const [contraction, expansions] of Object.entries(CONTRACTIONS)) {
    if (expansions.includes(normalized)) {
      forms.push(contraction, contraction.replace(/'/g, ''));
    }
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
  
  // Require 70% match for auto-complete, or all words for short lines
  const isComplete = percentMatched >= 70 || (totalWords <= 3 && matchedCount >= totalWords);
  
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
  
  // Require 70% match for auto-complete, or all words for short lines
  const isComplete = percentMatched >= 70 || (totalWords <= 3 && matchedCount >= totalWords);
  
  return {
    words,
    matchedCount,
    totalWords,
    percentMatched,
    isComplete,
  };
}

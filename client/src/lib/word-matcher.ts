export interface WordMatch {
  word: string;
  matched: boolean;
}

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^a-z0-9']/g, '')
    .trim();
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
  
  const normalizedSpoken = new Set(spokenWords.map(normalizeWord));
  
  const words: WordMatch[] = expectedWords.map(word => ({
    word,
    matched: normalizedSpoken.has(normalizeWord(word)),
  }));
  
  const matchedCount = words.filter(w => w.matched).length;
  const totalWords = expectedWords.length;
  const percentMatched = totalWords > 0 ? (matchedCount / totalWords) * 100 : 0;
  
  const isComplete = percentMatched >= 60 || (totalWords <= 3 && matchedCount >= 1);
  
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
  
  const isComplete = percentMatched >= 60 || (totalWords <= 3 && matchedCount >= 1);
  
  return {
    words,
    matchedCount,
    totalWords,
    percentMatched,
    isComplete,
  };
}

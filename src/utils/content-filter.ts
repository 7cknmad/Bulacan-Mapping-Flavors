// Profanity filter using Leetspeak and common character substitutions
export const INAPPROPRIATE_WORDS = [
  // Add your list of inappropriate words here
  // This is just a placeholder - the actual list should be more comprehensive
  'badword',
  'inappropriate',
  'offensive'
];

// Leetspeak character mappings
const LEETSPEAK_CHARS: { [key: string]: string[] } = {
  'a': ['a', '@', '4', 'á', 'à', 'ä'],
  'e': ['e', '3', 'é', 'è', 'ë'],
  'i': ['i', '1', '!', 'í', 'ì', 'ï'],
  'o': ['o', '0', 'ó', 'ò', 'ö'],
  's': ['s', '$', '5'],
  't': ['t', '7'],
  'l': ['l', '1'],
  // Add more mappings as needed
};

// Create regex patterns for each word
const createWordPattern = (word: string): RegExp => {
  const pattern = word
    .split('')
    .map(char => {
      const chars = LEETSPEAK_CHARS[char.toLowerCase()] || [char];
      return `[${chars.join('')}]`;
    })
    .join('[\\s-]*'); // Allow spaces or hyphens between characters
  return new RegExp(pattern, 'gi');
};

// Generate regex patterns for all words
const INAPPROPRIATE_PATTERNS = INAPPROPRIATE_WORDS.map(createWordPattern);

export const containsProfanity = (text: string): boolean => {
  return INAPPROPRIATE_PATTERNS.some(pattern => pattern.test(text));
};

export const filterProfanity = (text: string): string => {
  let filtered = text;
  INAPPROPRIATE_PATTERNS.forEach((pattern, index) => {
    filtered = filtered.replace(pattern, '*'.repeat(INAPPROPRIATE_WORDS[index].length));
  });
  return filtered;
};

// Rate limiting configuration
export const RATE_LIMIT = {
  maxReviews: 5, // Maximum number of reviews per timeframe
  timeframe: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  minTimeBetweenReviews: 5 * 60 * 1000, // 5 minutes in milliseconds
};
/**
 * Text parsing utilities for RTM_V2.
 * Splits raw text into paragraphs and words with character offsets.
 */

export interface WordInfo {
  /** The word text */
  text: string;
  /** Start index within the paragraph */
  startOffset: number;
  /** End index (exclusive) within the paragraph */
  endOffset: number;
  /** Index of this word within its paragraph */
  index: number;
}

export interface ParagraphInfo {
  /** The full paragraph text */
  text: string;
  /** Start index within the overall text */
  startOffset: number;
  /** End index (exclusive) within the overall text */
  endOffset: number;
  /** Index of this paragraph */
  index: number;
  /** Words within this paragraph */
  words: WordInfo[];
}

/**
 * Parse raw text into paragraphs, each containing words with offsets.
 * Paragraphs are split on one or more blank lines.
 * Leading/trailing whitespace in paragraphs is preserved for offset accuracy.
 */
export function parseText(rawText: string): ParagraphInfo[] {
  if (!rawText.trim()) return [];

  const paragraphs: ParagraphInfo[] = [];
  // Split on double newlines (or more) to get paragraphs.
  // We use a regex that captures paragraphs separated by blank lines,
  // but also treat single newlines as paragraph breaks (like Natural Reader).
  const lines = rawText.split(/\n/);

  let currentParagraph = '';
  let currentStart = 0;
  let charIndex = 0;

  const flushParagraph = () => {
    const trimmed = currentParagraph.trim();
    if (trimmed.length > 0) {
      // Find the actual start (after leading whitespace)
      const leadingWhitespace = currentParagraph.length - currentParagraph.trimStart().length;
      const actualStart = currentStart + leadingWhitespace;
      const actualEnd = actualStart + trimmed.length;

      paragraphs.push({
        text: trimmed,
        startOffset: actualStart,
        endOffset: actualEnd,
        index: paragraphs.length,
        words: parseWords(trimmed),
      });
    }
    currentParagraph = '';
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (trimmedLine.length === 0) {
      // Empty line — flush current paragraph
      flushParagraph();
      charIndex += line.length + 1; // +1 for \n
      currentStart = charIndex;
    } else {
      if (currentParagraph.length === 0) {
        currentStart = charIndex;
        currentParagraph = line;
      } else {
        // Join multiple non-empty lines into one paragraph
        currentParagraph += ' ' + line;
      }
      charIndex += line.length + 1; // +1 for \n
    }
  }

  // Flush remaining
  flushParagraph();

  return paragraphs;
}

/**
 * Parse a paragraph string into words with their character offsets.
 */
function parseWords(paragraphText: string): WordInfo[] {
  const words: WordInfo[] = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(paragraphText)) !== null) {
    words.push({
      text: match[0],
      startOffset: match.index,
      endOffset: match.index + match[0].length,
      index: words.length,
    });
  }

  return words;
}

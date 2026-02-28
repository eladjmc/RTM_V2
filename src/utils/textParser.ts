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
 * 1. Split by blank lines / newlines into coarse blocks.
 * 2. Within each block, split on sentence boundaries for finer granularity.
 */
export function parseText(rawText: string): ParagraphInfo[] {
  if (!rawText.trim()) return [];

  // Step 1: get coarse blocks from line breaks
  const coarseBlocks = rawText.includes('\n')
    ? splitByLines(rawText)
    : [{ text: rawText.trim(), startOffset: rawText.length - rawText.trimStart().length }];

  // Step 2: within each block, split on sentence boundaries
  const paragraphs: ParagraphInfo[] = [];

  for (const block of coarseBlocks) {
    const sentences = splitBySentencesRaw(block.text);

    if (sentences.length <= 1) {
      // Single sentence or no splits — keep as-is
      paragraphs.push({
        text: block.text,
        startOffset: block.startOffset,
        endOffset: block.startOffset + block.text.length,
        index: paragraphs.length,
        words: parseWords(block.text),
      });
    } else {
      for (const s of sentences) {
        paragraphs.push({
          text: s.text,
          startOffset: block.startOffset + s.localOffset,
          endOffset: block.startOffset + s.localOffset + s.text.length,
          index: paragraphs.length,
          words: parseWords(s.text),
        });
      }
    }
  }

  return paragraphs;
}

/* ------------------------------------------------------------------ */
/*  Line-based splitting (text with newlines)                         */
/* ------------------------------------------------------------------ */

interface CoarseBlock {
  text: string;
  startOffset: number;
}

function splitByLines(rawText: string): CoarseBlock[] {
  const blocks: CoarseBlock[] = [];
  const lines = rawText.split(/\n/);

  let currentParagraph = '';
  let currentStart = 0;
  let charIndex = 0;

  const flushParagraph = () => {
    const trimmed = currentParagraph.trim();
    if (trimmed.length > 0) {
      const leadingWhitespace =
        currentParagraph.length - currentParagraph.trimStart().length;
      const actualStart = currentStart + leadingWhitespace;

      blocks.push({
        text: trimmed,
        startOffset: actualStart,
      });
    }
    currentParagraph = '';
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (trimmedLine.length === 0) {
      flushParagraph();
      charIndex += line.length + 1; // +1 for \n
      currentStart = charIndex;
    } else {
      if (currentParagraph.length === 0) {
        currentStart = charIndex;
        currentParagraph = line;
      } else {
        currentParagraph += ' ' + line;
      }
      charIndex += line.length + 1; // +1 for \n
    }
  }

  flushParagraph();
  return blocks;
}

/* ------------------------------------------------------------------ */
/*  Sentence-based splitting (returns local offsets within the chunk)  */
/* ------------------------------------------------------------------ */

interface SentenceChunk {
  text: string;
  /** Offset relative to the input string */
  localOffset: number;
}

function splitBySentencesRaw(input: string): SentenceChunk[] {
  const chunks: SentenceChunk[] = [];

  // Sentence boundary: one or more sentence-ending punctuation marks
  // optionally followed by closing brackets / quotes,
  // then whitespace, then the start of a new sentence
  // (capital letter, digit, opening bracket / quote).
  const boundaryRegex =
    /([.!?]+[\])"'»'"]*)\s+(?=[A-Z["'«('""\d])/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = boundaryRegex.exec(input)) !== null) {
    const sentenceEnd = match.index + match[1].length;
    const chunk = input.slice(lastIndex, sentenceEnd);
    const trimmed = chunk.trim();

    if (trimmed.length > 0) {
      const leadingSpaces = chunk.length - chunk.trimStart().length;
      chunks.push({
        text: trimmed,
        localOffset: lastIndex + leadingSpaces,
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last boundary
  const remaining = input.slice(lastIndex);
  const trimmedRemaining = remaining.trim();
  if (trimmedRemaining.length > 0) {
    const leadingSpaces = remaining.length - remaining.trimStart().length;
    chunks.push({
      text: trimmedRemaining,
      localOffset: lastIndex + leadingSpaces,
    });
  }

  return chunks;
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

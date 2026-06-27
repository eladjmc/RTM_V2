import type { ParagraphInfo } from './textParser';

/** Max chars per server-TTS synth request (under backend limit of 8000). */
export const TTS_PLAYBACK_CHUNK_MAX_CHARS = 2000;

export interface TtsPlaybackChunk {
  chunkIndex: number;
  startParagraphIndex: number;
  endParagraphIndex: number;
  text: string;
}

/**
 * Merge sentence-level paragraphs into fewer playback chunks to reduce
 * audio element src swaps (fixes clipped words on mobile Chrome).
 */
export function buildTtsPlaybackChunks(
  paragraphs: ParagraphInfo[],
  maxChars = TTS_PLAYBACK_CHUNK_MAX_CHARS,
): TtsPlaybackChunk[] {
  if (paragraphs.length === 0) return [];

  const chunks: TtsPlaybackChunk[] = [];
  let i = 0;

  while (i < paragraphs.length) {
    const parts: string[] = [];
    const start = i;
    let len = 0;

    while (i < paragraphs.length) {
      const text = paragraphs[i].text;
      const separator = parts.length > 0 ? 1 : 0;
      if (parts.length > 0 && len + separator + text.length > maxChars) {
        break;
      }
      parts.push(text);
      len += separator + text.length;
      i++;
    }

    chunks.push({
      chunkIndex: chunks.length,
      startParagraphIndex: start,
      endParagraphIndex: i - 1,
      text: parts.join(' '),
    });
  }

  return chunks;
}

export function findChunkIndexForParagraph(
  chunks: TtsPlaybackChunk[],
  paragraphIndex: number,
): number {
  const found = chunks.findIndex(
    (c) =>
      paragraphIndex >= c.startParagraphIndex &&
      paragraphIndex <= c.endParagraphIndex,
  );
  return found >= 0 ? found : 0;
}

export interface ChunkParagraphRange {
  paragraphIndex: number;
  charStart: number;
  charEnd: number;
}

/** Character spans of each sentence-paragraph inside a merged playback chunk. */
export function buildChunkParagraphCharRanges(
  chunk: TtsPlaybackChunk,
  paragraphs: ParagraphInfo[],
): ChunkParagraphRange[] {
  const ranges: ChunkParagraphRange[] = [];
  let pos = 0;

  for (let i = chunk.startParagraphIndex; i <= chunk.endParagraphIndex; i++) {
    if (i > chunk.startParagraphIndex) pos += 1;
    const start = pos;
    pos += paragraphs[i].text.length;
    ranges.push({
      paragraphIndex: i,
      charStart: start,
      charEnd: pos,
    });
  }

  return ranges;
}

/** Map normalized audio progress (0–1) to the paragraph index currently being spoken. */
export function paragraphIndexAtChunkProgress(
  ranges: ChunkParagraphRange[],
  progress: number,
): number {
  if (ranges.length === 0) return 0;

  const clamped = Math.max(0, Math.min(1, progress));
  const totalChars = ranges[ranges.length - 1].charEnd;
  if (totalChars <= 0) return ranges[0].paragraphIndex;

  const charPos = clamped * totalChars;
  for (const range of ranges) {
    if (charPos < range.charEnd) {
      return range.paragraphIndex;
    }
  }

  return ranges[ranges.length - 1].paragraphIndex;
}

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

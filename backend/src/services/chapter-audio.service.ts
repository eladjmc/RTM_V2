import * as chapterDal from '../dal/chapter.dal.js';
import * as ttsService from './tts.service.js';
import * as sapiTtsService from './sapi-tts.service.js';

export const CHAPTER_MAX_CHARS = 100_000;

export type ChapterAudioProvider = 'sapi' | 'edge';

export interface ChapterAudioConfig {
  provider: ChapterAudioProvider;
  voice: string;
  rate: number;
  volume?: number;
}

/**
 * Synthesise one chapter to an MP3 buffer.
 */
export async function synthesizeChapterToBuffer(
  bookId: string,
  chapterNumber: number,
  config: ChapterAudioConfig,
): Promise<{ buffer: Buffer; title: string }> {
  const chapters = await chapterDal.findChaptersByRange(bookId, chapterNumber, chapterNumber);
  if (chapters.length === 0) {
    throw new Error('Chapter not found');
  }

  const chapter = chapters[0];
  if (chapter.content.length > CHAPTER_MAX_CHARS) {
    const err = new Error('Chapter exceeds the maximum character limit for audio synthesis') as Error & {
      statusCode?: number;
      details?: unknown;
    };
    err.statusCode = 400;
    err.details = {
      maxCharacters: CHAPTER_MAX_CHARS,
      chapters: [{
        chapterNumber: chapter.chapterNumber,
        title: chapter.title || `Chapter ${chapter.chapterNumber}`,
        characters: chapter.content.length,
      }],
    };
    throw err;
  }

  const volume = config.volume ?? 100;
  let buffer: Buffer;

  if (config.provider === 'sapi') {
    buffer = await sapiTtsService.synthesiseToBuffer(chapter.content, {
      voice: config.voice || 'Microsoft Zira Desktop',
      rate: config.rate,
      volume,
    });
  } else {
    buffer = await ttsService.synthesiseToBuffer(chapter.content, {
      voice: config.voice || 'en-US-AriaNeural',
      rate: config.rate,
      volume,
    });
  }

  return {
    buffer,
    title: chapter.title || `Chapter ${chapter.chapterNumber}`,
  };
}

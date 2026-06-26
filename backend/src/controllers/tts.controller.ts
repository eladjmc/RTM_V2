import type { Request, Response } from 'express';
import * as chapterDal from '../dal/chapter.dal.js';
import * as bookDal from '../dal/book.dal.js';
import * as ttsService from '../services/tts.service.js';
import * as sapiTtsService from '../services/sapi-tts.service.js';

const CHUNK_MAX_CHARS = 8000;
const CHAPTER_MAX_CHARS = 100_000;

/**
 * POST /tts/synthesize-chunk
 * Body: { text, provider?, voice?, rate?, volume? }
 * Returns a single paragraph MP3 buffer.
 */
export const synthesizeChunk = async (req: Request, res: Response): Promise<void> => {
  const { text, provider = 'sapi', voice, rate = 1.0, volume = 100 } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'text is required' });
    return;
  }
  if (text.length > CHUNK_MAX_CHARS) {
    res.status(400).json({ error: `text exceeds maximum length of ${CHUNK_MAX_CHARS} characters` });
    return;
  }

  const rateNum = Number(rate);
  const volumeNum = Number(volume);
  if (!Number.isFinite(rateNum) || rateNum < 0.5 || rateNum > 4) {
    res.status(400).json({ error: 'rate must be between 0.5 and 4' });
    return;
  }
  if (!Number.isFinite(volumeNum) || volumeNum < 0 || volumeNum > 100) {
    res.status(400).json({ error: 'volume must be between 0 and 100' });
    return;
  }

  try {
    let buffer: Buffer;

    if (provider === 'sapi') {
      buffer = await sapiTtsService.synthesiseToBuffer(text, {
        voice: voice || 'Microsoft Zira Desktop',
        rate: rateNum,
        volume: volumeNum,
      });
    } else if (provider === 'edge') {
      buffer = await ttsService.synthesiseToBuffer(text, {
        voice: voice || 'en-US-AriaNeural',
        rate: rateNum,
        volume: volumeNum,
      });
    } else {
      res.status(400).json({ error: 'provider must be "sapi" or "edge"' });
      return;
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (err) {
    console.error('TTS chunk synthesis failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Audio synthesis failed' });
    }
  }
};

/**
 * POST /tts/books/:bookId/chapters/:chapterNumber/audio
 * Synthesise one full chapter and return MP3 bytes (for listen-while-download).
 */
export const synthesizeChapterAudio = async (req: Request, res: Response): Promise<void> => {
  const bookId = req.params.bookId as string;
  const chapterNumber = Number(req.params.chapterNumber);
  const { provider = 'sapi', voice, rate = 1.0, volume = 100 } = req.body;

  if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
    res.status(400).json({ error: 'Invalid chapter number' });
    return;
  }

  const rateNum = Number(rate);
  const volumeNum = Number(volume);
  if (!Number.isFinite(rateNum) || rateNum < 0.5 || rateNum > 4) {
    res.status(400).json({ error: 'rate must be between 0.5 and 4' });
    return;
  }
  if (!Number.isFinite(volumeNum) || volumeNum < 0 || volumeNum > 100) {
    res.status(400).json({ error: 'volume must be between 0 and 100' });
    return;
  }

  const chapters = await chapterDal.findChaptersByRange(bookId, chapterNumber, chapterNumber);
  if (chapters.length === 0) {
    res.status(404).json({ error: 'Chapter not found' });
    return;
  }

  const chapter = chapters[0];
  if (chapter.content.length > CHAPTER_MAX_CHARS) {
    res.status(400).json({
      error: 'Chapter exceeds the maximum character limit for audio synthesis',
      maxCharacters: CHAPTER_MAX_CHARS,
      chapters: [{
        chapterNumber: chapter.chapterNumber,
        title: chapter.title || `Chapter ${chapter.chapterNumber}`,
        characters: chapter.content.length,
      }],
    });
    return;
  }

  try {
    let buffer: Buffer;

    if (provider === 'sapi') {
      buffer = await sapiTtsService.synthesiseToBuffer(chapter.content, {
        voice: voice || 'Microsoft Zira Desktop',
        rate: rateNum,
        volume: volumeNum,
      });
    } else if (provider === 'edge') {
      buffer = await ttsService.synthesiseToBuffer(chapter.content, {
        voice: voice || 'en-US-AriaNeural',
        rate: rateNum,
        volume: volumeNum,
      });
    } else {
      res.status(400).json({ error: 'provider must be "sapi" or "edge"' });
      return;
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (err) {
    console.error('TTS chapter synthesis failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Audio synthesis failed' });
    }
  }
};

/**
 * GET /tts/voices — returns list of en-US voices
 */
export const getVoices = async (_req: Request, res: Response): Promise<void> => {
  const voices = await ttsService.getEnUsVoices();
  res.json(voices);
};

/**
 * POST /books/:bookId/tts-download
 * Body: { startChapterNumber, chapterCount, voice, rate?, pitch?, volume? }
 *
 * Synthesises each chapter in parallel (5 at a time), concatenates
 * the MP3 buffers, and sends the result as a download.
 */
export const downloadAudio = async (req: Request, res: Response): Promise<void> => {
  const bookId = req.params.bookId as string;
  const {
    startChapterNumber,
    chapterCount,
    voice,
    rate,
    pitch,
    volume,
    provider,       // 'edge' (default) | 'sapi'
  } = req.body;

  // ── Validation ──────────────────────────────────────────────
  if (!startChapterNumber || !chapterCount) {
    res.status(400).json({ error: 'startChapterNumber and chapterCount are required' });
    return;
  }

  const startNum = Number(startChapterNumber);
  const count = Number(chapterCount);

  if (!Number.isInteger(startNum) || startNum < 1) {
    res.status(400).json({ error: 'startChapterNumber must be a positive integer' });
    return;
  }
  if (!Number.isInteger(count) || count < 1) {
    res.status(400).json({ error: 'chapterCount must be a positive integer' });
    return;
  }

  const endNum = startNum + count - 1;

  // ── Fetch book (for filename) ──────────────────────────────
  const book = await bookDal.findBookById(bookId);
  if (!book) {
    res.status(404).json({ error: 'Book not found' });
    return;
  }

  // ── Fetch chapters in range ────────────────────────────────
  const chapters = await chapterDal.findChaptersByRange(bookId, startNum, endNum);

  if (chapters.length === 0) {
    res.status(404).json({ error: 'No chapters found in the specified range' });
    return;
  }

  // ── Check for chapters that are too long ───────────────────
  const MAX_CHARS = 100_000;
  const tooLong = chapters.filter((ch) => ch.content.length > MAX_CHARS);

  if (tooLong.length > 0) {
    const details = tooLong.map((ch) => ({
      chapterNumber: ch.chapterNumber,
      title: ch.title || `Chapter ${ch.chapterNumber}`,
      characters: ch.content.length,
    }));
    res.status(400).json({
      error: 'Some chapters exceed the maximum character limit for audio synthesis',
      maxCharacters: MAX_CHARS,
      chapters: details,
    });
    return;
  }

  // ── Build per-chapter text segments ────────────────────────
  const chapterTexts = chapters.map((ch) => ch.content);

  const useSapi = provider === 'sapi';

  try {
    let mp3Buffer: Buffer;

    if (useSapi) {
      const sapiConfig: sapiTtsService.SapiTtsConfig = {
        voice: voice || 'Microsoft Zira Desktop',
        rate: rate != null ? Number(rate) : undefined,
        volume: volume != null ? Number(volume) : undefined,
      };
      console.log(`TTS [SAPI]: Synthesising ${chapters.length} chapters for "${book.title}"…`);
      mp3Buffer = await sapiTtsService.synthesiseChapters(chapterTexts, sapiConfig);
    } else {
      const edgeConfig: ttsService.TtsConfig = {
        voice: voice || 'en-US-AriaNeural',
        rate: rate != null ? Number(rate) : undefined,
        pitch: pitch || undefined,
        volume: volume != null ? Number(volume) : undefined,
      };
      console.log(`TTS [Edge]: Synthesising ${chapters.length} chapters for "${book.title}"…`);
      mp3Buffer = await ttsService.synthesiseChaptersParallel(chapterTexts, edgeConfig, 5);
    }

    console.log(`TTS: Done — ${(mp3Buffer.length / 1024 / 1024).toFixed(1)} MB`);

    // ── Build download filename ─────────────────────────────
    const safeTitle = book.title.replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
    const rangeLabel =
      startNum === endNum
        ? `Ch${startNum}`
        : `Ch${startNum}-${startNum + chapters.length - 1}`;
    const downloadName = `${safeTitle}_${rangeLabel}.mp3`;

    // ── Send buffer as download ──────────────────────────────
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    res.setHeader('Content-Length', mp3Buffer.length);
    res.end(mp3Buffer);
  } catch (err) {
    console.error('TTS synthesis failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Audio synthesis failed' });
    }
  }
};

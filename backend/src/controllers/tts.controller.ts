import type { Request, Response } from 'express';
import * as chapterDal from '../dal/chapter.dal.js';
import * as bookDal from '../dal/book.dal.js';
import * as ttsService from '../services/tts.service.js';
import * as sapiTtsService from '../services/sapi-tts.service.js';
import { fixMp3Duration } from '../utils/mp3-fix.js';

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
      mp3Buffer = await sapiTtsService.synthesiseChaptersSequential(chapterTexts, sapiConfig);
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

    // ── Fix MP3 duration metadata ─────────────────────────────
    mp3Buffer = fixMp3Duration(mp3Buffer);

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

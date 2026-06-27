import { Router } from 'express';
import * as ttsController from '../controllers/tts.controller.js';
import * as listenJobController from '../controllers/listen-job.controller.js';
import auth from '../middleware/auth.js';

const router = Router();

// All TTS routes require auth
router.use(auth);

/**
 * @swagger
 * /tts/voices:
 *   get:
 *     tags: [TTS]
 *     summary: List available en-US TTS voices
 *     responses:
 *       200:
 *         description: Array of voice objects
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   Name:
 *                     type: string
 *                   ShortName:
 *                     type: string
 *                   Gender:
 *                     type: string
 *                   Locale:
 *                     type: string
 *                   FriendlyName:
 *                     type: string
 */
router.get('/voices', ttsController.getVoices);

/**
 * @swagger
 * /tts/synthesize-chunk:
 *   post:
 *     tags: [TTS]
 *     summary: Synthesise a single text chunk for server playback
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *               provider:
 *                 type: string
 *                 enum: [sapi, edge]
 *               voice:
 *                 type: string
 *               rate:
 *                 type: number
 *               volume:
 *                 type: number
 *     responses:
 *       200:
 *         description: MP3 audio chunk
 *         content:
 *           audio/mpeg:
 *             schema:
 *               type: string
 *               format: binary
 */
router.post('/synthesize-chunk', ttsController.synthesizeChunk);

router.post(
  '/books/:bookId/chapters/:chapterNumber/audio',
  ttsController.synthesizeChapterAudio,
);

/**
 * @swagger
 * /tts/books/{bookId}/download:
 *   post:
 *     tags: [TTS]
 *     summary: Generate and download MP3 audio for a chapter range
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [startChapterNumber, chapterCount]
 *             properties:
 *               startChapterNumber:
 *                 type: integer
 *                 description: The chapter number to start from (inclusive)
 *               chapterCount:
 *                 type: integer
 *                 description: How many chapters to include
 *               voice:
 *                 type: string
 *                 description: "Voice ShortName (default: en-US-AriaNeural)"
 *               rate:
 *                 type: number
 *                 description: "Speech rate (default: 1.0)"
 *               pitch:
 *                 type: string
 *                 description: "Pitch adjustment (default: +0Hz)"
 *               volume:
 *                 type: number
 *                 description: "Volume 0-100 (default: 100)"
 *     responses:
 *       200:
 *         description: MP3 audio file
 *         content:
 *           audio/mpeg:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Validation error
 *       404:
 *         description: Book or chapters not found
 *       500:
 *         description: Synthesis failed
 */
router.post('/books/:bookId/download', ttsController.downloadAudio);

router.post('/listen-jobs', listenJobController.startListenJob);
router.get('/listen-jobs', listenJobController.listListenJobsHandler);
router.delete('/listen-jobs/cache', listenJobController.clearListenJobCacheHandler);
router.get('/listen-jobs/:jobId', listenJobController.getListenJob);
router.get('/listen-jobs/:jobId/chapters/:chapterNumber', listenJobController.streamListenJobChapter);
router.get('/listen-jobs/:jobId/download', listenJobController.downloadListenJobCombined);
router.get('/listen-jobs/:jobId/playlist.m3u8', listenJobController.getListenJobPlaylist);
router.delete('/listen-jobs/:jobId', listenJobController.removeListenJob);

export default router;

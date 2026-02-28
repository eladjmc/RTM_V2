import { Router } from 'express';
import * as ttsController from '../controllers/tts.controller.js';
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

export default router;

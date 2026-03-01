import { Router } from 'express';
import * as chapterController from '../controllers/chapter.controller.js';
import auth from '../middleware/auth.js';

const router = Router();

// All chapter routes require auth
router.use(auth);

/**
 * @swagger
 * /books/{bookId}/chapters:
 *   get:
 *     tags: [Chapters]
 *     summary: List chapters for a book (no content)
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Array of chapter summaries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ChapterSummary'
 */
router.get('/books/:bookId/chapters', chapterController.getChaptersByBook);

/**
 * @swagger
 * /books/{bookId}/chapters/next-number:
 *   get:
 *     tags: [Chapters]
 *     summary: Get the next auto-assigned chapter number for a book
 */
router.get('/books/:bookId/chapters/next-number', chapterController.getNextChapterNumber);

/**
 * @swagger
 * /books/{bookId}/chapters:
 *   post:
 *     tags: [Chapters]
 *     summary: Add a chapter to a book
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
 *             required: [content]
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Created chapter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Chapter'
 *       400:
 *         description: Content is required
 */
router.post('/books/:bookId/chapters', chapterController.createChapter);

/**
 * @swagger
 * /chapters/{id}:
 *   get:
 *     tags: [Chapters]
 *     summary: Get a chapter with full content
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chapter with content
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Chapter'
 *       404:
 *         description: Chapter not found
 */
router.get('/chapters/:id', chapterController.getChapterById);

/**
 * @swagger
 * /chapters/{id}:
 *   put:
 *     tags: [Chapters]
 *     summary: Update a chapter
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated chapter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Chapter'
 *       404:
 *         description: Chapter not found
 */
router.put('/chapters/:id', chapterController.updateChapter);

/**
 * @swagger
 * /chapters/{id}:
 *   delete:
 *     tags: [Chapters]
 *     summary: Delete a chapter and renumber remaining
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deletion confirmation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Chapter not found
 */
router.delete('/chapters/:id', chapterController.deleteChapter);

export default router;

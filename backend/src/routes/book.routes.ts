import { Router } from 'express';
import * as bookController from '../controllers/book.controller.js';
import auth from '../middleware/auth.js';

const router = Router();

// All book routes require auth
router.use(auth);

/**
 * @swagger
 * /books:
 *   get:
 *     tags: [Books]
 *     summary: List all books
 *     responses:
 *       200:
 *         description: Array of books
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Book'
 */
router.get('/', bookController.getAllBooks);

/**
 * @swagger
 * /books/{id}:
 *   get:
 *     tags: [Books]
 *     summary: Get book detail with last-read chapter content
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Book with last chapter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookDetail'
 *       404:
 *         description: Book not found
 */
router.get('/:id', bookController.getBookById);

/**
 * @swagger
 * /books:
 *   post:
 *     tags: [Books]
 *     summary: Create a new book
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *               author:
 *                 type: string
 *               cover:
 *                 type: string
 *     responses:
 *       201:
 *         description: Created book
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Book'
 *       400:
 *         description: Title is required
 */
router.post('/', bookController.createBook);

/**
 * @swagger
 * /books/{id}:
 *   put:
 *     tags: [Books]
 *     summary: Update a book
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
 *               author:
 *                 type: string
 *               cover:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated book
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Book'
 *       404:
 *         description: Book not found
 */
router.put('/:id', bookController.updateBook);

/**
 * @swagger
 * /books/{id}:
 *   delete:
 *     tags: [Books]
 *     summary: Delete a book and all its chapters
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
 *         description: Book not found
 */
router.delete('/:id', bookController.deleteBook);

/**
 * @swagger
 * /books/{id}/progress:
 *   put:
 *     tags: [Books]
 *     summary: Save reading progress for a book
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [chapterId, paragraphIndex]
 *             properties:
 *               chapterId:
 *                 type: string
 *               paragraphIndex:
 *                 type: number
 *               wordIndex:
 *                 type: number
 *     responses:
 *       200:
 *         description: Updated book with progress
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Book'
 *       400:
 *         description: Missing required fields
 *       404:
 *         description: Book not found
 */
router.put('/:id/progress', bookController.saveProgress);

export default router;

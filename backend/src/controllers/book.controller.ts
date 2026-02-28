import type { Request, Response } from 'express';
import * as bookService from '../services/book.service.js';

export const getAllBooks = async (_req: Request, res: Response): Promise<void> => {
  const books = await bookService.getAllBooks();
  res.json(books);
};

export const getBookById = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const result = await bookService.getBookById(id);

  if (!result) {
    res.status(404).json({ error: 'Book not found' });
    return;
  }

  res.json(result);
};

export const createBook = async (req: Request, res: Response): Promise<void> => {
  const { title, author, cover } = req.body;

  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  const book = await bookService.createBook({ title, author, cover });
  res.status(201).json(book);
};

export const updateBook = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { title, author, cover } = req.body;
  const book = await bookService.updateBook(id, {
    title,
    author,
    cover,
  });

  if (!book) {
    res.status(404).json({ error: 'Book not found' });
    return;
  }

  res.json(book);
};

export const deleteBook = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const book = await bookService.deleteBook(id);

  if (!book) {
    res.status(404).json({ error: 'Book not found' });
    return;
  }

  res.json({ message: 'Book and its chapters deleted' });
};

export const saveProgress = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { chapterId, chapterNumber, paragraphIndex, wordIndex } = req.body;

  if (!chapterId || paragraphIndex === undefined) {
    res.status(400).json({ error: 'chapterId and paragraphIndex are required' });
    return;
  }

  const book = await bookService.saveReadingProgress(id, {
    chapterId,
    chapterNumber: chapterNumber ?? 0,
    paragraphIndex,
    wordIndex: wordIndex ?? 0,
  });

  if (!book) {
    res.status(404).json({ error: 'Book not found' });
    return;
  }

  res.json(book);
};

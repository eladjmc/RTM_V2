import type { Request, Response } from 'express';
import * as chapterService from '../services/chapter.service.js';

export const getChaptersByBook = async (req: Request, res: Response): Promise<void> => {
  const bookId = req.params.bookId as string;
  const chapters = await chapterService.getChaptersByBook(bookId);
  res.json(chapters);
};

export const getNextChapterNumber = async (req: Request, res: Response): Promise<void> => {
  const bookId = req.params.bookId as string;
  const nextNumber = await chapterService.getNextChapterNumber(bookId);
  res.json({ nextChapterNumber: nextNumber });
};

export const getChapterById = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const chapter = await chapterService.getChapterById(id);

  if (!chapter) {
    res.status(404).json({ error: 'Chapter not found' });
    return;
  }

  res.json(chapter);
};

export const createChapter = async (req: Request, res: Response): Promise<void> => {
  const bookId = req.params.bookId as string;
  const { content, title, chapterNumber } = req.body;

  if (!content) {
    res.status(400).json({ error: 'Content is required' });
    return;
  }

  const chapter = await chapterService.createChapter(bookId, {
    title,
    content,
    chapterNumber: chapterNumber != null ? Number(chapterNumber) : undefined,
  });

  res.status(201).json(chapter);
};

export const updateChapter = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { title, content } = req.body;
  const chapter = await chapterService.updateChapter(id, {
    title,
    content,
  });

  if (!chapter) {
    res.status(404).json({ error: 'Chapter not found' });
    return;
  }

  res.json(chapter);
};

export const deleteChapter = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const chapter = await chapterService.deleteChapter(id);

  if (!chapter) {
    res.status(404).json({ error: 'Chapter not found' });
    return;
  }

  res.json({ message: 'Chapter deleted' });
};

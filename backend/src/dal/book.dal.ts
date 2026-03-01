import Book, { type IBook } from '../models/book.model.js';
import type { Types } from 'mongoose';

export const findAllBooks = (): Promise<IBook[]> => {
  return Book.find()
    .select('title author cover chapterCount lastReadChapter lastReadChapterNumber lastReadAt lastReadPosition updatedAt')
    .sort({ updatedAt: -1 })
    .exec();
};

export const findBookById = (id: string): Promise<IBook | null> => {
  return Book.findById(id).exec();
};

export const createBook = (data: {
  title: string;
  author?: string;
  cover?: string;
  startingChapterNumber?: number;
}): Promise<IBook> => {
  return Book.create(data);
};

export const updateBook = (
  id: string,
  data: Partial<Pick<IBook, 'title' | 'author' | 'cover'>>,
): Promise<IBook | null> => {
  return Book.findByIdAndUpdate(id, data, { new: true }).exec();
};

export const deleteBook = (id: string): Promise<IBook | null> => {
  return Book.findByIdAndDelete(id).exec();
};

export const updateReadingProgress = (
  id: string,
  data: {
    lastReadChapter: Types.ObjectId | string;
    lastReadChapterNumber: number;
    lastReadAt: Date;
    lastReadPosition: { paragraphIndex: number; wordIndex: number };
  },
): Promise<IBook | null> => {
  return Book.findByIdAndUpdate(id, data, { new: true }).exec();
};

export const incrementChapterCount = (
  bookId: string,
  amount: number,
): Promise<IBook | null> => {
  return Book.findByIdAndUpdate(
    bookId,
    { $inc: { chapterCount: amount } },
    { new: true },
  ).exec();
};

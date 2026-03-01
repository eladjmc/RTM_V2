import * as bookDal from '../dal/book.dal.js';
import * as chapterDal from '../dal/chapter.dal.js';
import type { IBook } from '../models/book.model.js';

export const getAllBooks = () => {
  return bookDal.findAllBooks();
};

export const getBookById = async (id: string) => {
  const book = await bookDal.findBookById(id);
  if (!book) return null;

  // If there's a last-read chapter, load its content
  let lastChapter = null;
  if (book.lastReadChapter) {
    lastChapter = await chapterDal.findChapterById(
      book.lastReadChapter.toString(),
    );
  }

  // If no last-read chapter, load the first chapter
  if (!lastChapter) {
    const chapters = await chapterDal.findChaptersByBook(book._id.toString());
    if (chapters.length > 0) {
      lastChapter = await chapterDal.findChapterById(
        chapters[0]._id.toString(),
      );
    }
  }

  return { book, lastChapter };
};

export const createBook = (data: {
  title: string;
  author?: string;
  cover?: string;
  startingChapterNumber?: number;
}) => {
  return bookDal.createBook(data);
};

export const updateBook = (
  id: string,
  data: Partial<Pick<IBook, 'title' | 'author' | 'cover'>>,
) => {
  return bookDal.updateBook(id, data);
};

export const deleteBook = async (id: string) => {
  // Delete all chapters first
  await chapterDal.deleteChaptersByBook(id);
  return bookDal.deleteBook(id);
};

export const saveReadingProgress = (
  bookId: string,
  data: {
    chapterId: string;
    chapterNumber: number;
    paragraphIndex: number;
    wordIndex: number;
  },
) => {
  return bookDal.updateReadingProgress(bookId, {
    lastReadChapter: data.chapterId,
    lastReadChapterNumber: data.chapterNumber,
    lastReadAt: new Date(),
    lastReadPosition: {
      paragraphIndex: data.paragraphIndex,
      wordIndex: data.wordIndex,
    },
  });
};

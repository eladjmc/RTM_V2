import * as chapterDal from '../dal/chapter.dal.js';
import * as bookDal from '../dal/book.dal.js';

export const getChaptersByBook = (bookId: string) => {
  return chapterDal.findChaptersByBook(bookId);
};

export const getChapterById = (id: string) => {
  return chapterDal.findChapterById(id);
};

export const createChapter = async (
  bookId: string,
  data: { title?: string; content: string },
) => {
  const lastNumber = await chapterDal.findLastChapterNumber(bookId);
  const chapterNumber = lastNumber + 1;

  const chapter = await chapterDal.createChapter({
    book: bookId,
    chapterNumber,
    title: data.title || `Chapter ${chapterNumber}`,
    content: data.content,
  });

  // Update book's chapter count
  await bookDal.incrementChapterCount(bookId, 1);

  return chapter;
};

export const updateChapter = (
  id: string,
  data: Partial<{ title: string; content: string }>,
) => {
  return chapterDal.updateChapter(id, data);
};

export const deleteChapter = async (id: string) => {
  const chapter = await chapterDal.findChapterById(id);
  if (!chapter) return null;

  const bookId = chapter.book.toString();
  const deletedNumber = chapter.chapterNumber;

  await chapterDal.deleteChapter(id);

  // Re-number remaining chapters
  await chapterDal.renumberChaptersAfter(bookId, deletedNumber);

  // Decrement book's chapter count
  await bookDal.incrementChapterCount(bookId, -1);

  return chapter;
};

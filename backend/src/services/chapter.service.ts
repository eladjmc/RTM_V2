import * as chapterDal from '../dal/chapter.dal.js';
import * as bookDal from '../dal/book.dal.js';

export const getChaptersByBook = (bookId: string) => {
  return chapterDal.findChaptersByBook(bookId);
};

export const getChapterById = (id: string) => {
  return chapterDal.findChapterById(id);
};

export const getNextChapterNumber = async (bookId: string): Promise<number> => {
  const lastNumber = await chapterDal.findLastChapterNumber(bookId);
  if (lastNumber === 0) {
    const book = await bookDal.findBookById(bookId);
    return book?.startingChapterNumber ?? 1;
  }
  return lastNumber + 1;
};

export const createChapter = async (
  bookId: string,
  data: { title?: string; content: string; chapterNumber?: number },
) => {
  let chapterNumber: number;

  if (data.chapterNumber != null) {
    // User-specified chapter number
    chapterNumber = data.chapterNumber;
  } else {
    // Auto-assign: last chapter number + 1, or book's startingChapterNumber if no chapters yet
    const lastNumber = await chapterDal.findLastChapterNumber(bookId);
    if (lastNumber === 0) {
      // No chapters yet — use the book's starting chapter number
      const book = await bookDal.findBookById(bookId);
      chapterNumber = book?.startingChapterNumber ?? 1;
    } else {
      chapterNumber = lastNumber + 1;
    }
  }

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

  await chapterDal.deleteChapter(id);

  // Decrement book's chapter count
  await bookDal.incrementChapterCount(bookId, -1);

  return chapter;
};

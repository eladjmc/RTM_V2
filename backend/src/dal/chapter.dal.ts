import Chapter, { type IChapter } from '../models/chapter.model.js';

export const findChaptersByBook = (bookId: string): Promise<IChapter[]> => {
  return Chapter.find({ book: bookId })
    .select('chapterNumber title createdAt')
    .sort({ chapterNumber: 1 })
    .exec();
};

export const findChapterById = (id: string): Promise<IChapter | null> => {
  return Chapter.findById(id).exec();
};

export const findLastChapterNumber = async (bookId: string): Promise<number> => {
  const last = await Chapter.findOne({ book: bookId })
    .sort({ chapterNumber: -1 })
    .select('chapterNumber')
    .exec();
  return last ? last.chapterNumber : 0;
};

export const createChapter = (data: {
  book: string;
  chapterNumber: number;
  title?: string;
  content: string;
}): Promise<IChapter> => {
  return Chapter.create(data);
};

export const updateChapter = (
  id: string,
  data: Partial<Pick<IChapter, 'title' | 'content'>>,
): Promise<IChapter | null> => {
  return Chapter.findByIdAndUpdate(id, data, { new: true }).exec();
};

export const deleteChapter = (id: string): Promise<IChapter | null> => {
  return Chapter.findByIdAndDelete(id).exec();
};

export const renumberChaptersAfter = async (
  bookId: string,
  afterNumber: number,
): Promise<void> => {
  await Chapter.updateMany(
    { book: bookId, chapterNumber: { $gt: afterNumber } },
    { $inc: { chapterNumber: -1 } },
  ).exec();
};

export const deleteChaptersByBook = async (bookId: string): Promise<number> => {
  const result = await Chapter.deleteMany({ book: bookId }).exec();
  return result.deletedCount;
};

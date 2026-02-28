export interface Book {
  _id: string;
  title: string;
  author: string;
  cover: string;
  lastReadChapter: string | null;
  lastReadChapterNumber: number;
  lastReadAt: string | null;
  lastReadPosition: {
    paragraphIndex: number;
    wordIndex: number;
  };
  chapterCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookDetail {
  book: Book;
  lastChapter: Chapter | null;
}

export interface Chapter {
  _id: string;
  book: string;
  chapterNumber: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterSummary {
  _id: string;
  chapterNumber: number;
  title: string;
  createdAt: string;
}

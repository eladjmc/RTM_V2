import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { chapterService } from '../services/chapterService';
import type { Book, ChapterSummary } from '../types/models';

/** Persisted reading context so the reader knows what's mounted */
export interface ReadingContext {
  bookId: string;
  bookTitle: string;
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  /** Sorted list of all chapter summaries for prev/next navigation */
  chapters: ChapterSummary[];
}

const CONTEXT_KEY = 'rtm-reading-context';

export function getReadingContext(): ReadingContext | null {
  try {
    const raw = localStorage.getItem(CONTEXT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearReadingContext() {
  localStorage.removeItem(CONTEXT_KEY);
}

/**
 * Returns helpers to load a chapter's content into the reader.
 *
 * Writes the chapter text into localStorage (where useReaderSettings picks it up),
 * stores reading context for prev/next navigation, and navigates to the reader page.
 */
export function useChapterLoader() {
  const navigate = useNavigate();

  /** Write text + set position + save context, then navigate to reader */
  const mountAndNavigate = useCallback(
    (content: string, ctx: ReadingContext, paragraphIndex = 0) => {
      const textVal = JSON.stringify(content);
      const paraVal = JSON.stringify(paragraphIndex);
      const ctxVal = JSON.stringify(ctx);

      localStorage.setItem('rtm-text', textVal);
      localStorage.setItem('rtm-paragraph-index', paraVal);
      localStorage.setItem('rtm-reading-context', ctxVal);

      const dispatch = (key: string, value: string) =>
        window.dispatchEvent(
          new CustomEvent('local-storage-sync', { detail: { key, value } }),
        );
      dispatch('rtm-text', textVal);
      dispatch('rtm-paragraph-index', paraVal);
      dispatch('rtm-reading-context', ctxVal);

      navigate('/');
    },
    [navigate],
  );

  /** Load a specific chapter by ID, given existing context info */
  const loadChapterWithContext = useCallback(
    async (
      bookId: string,
      bookTitle: string,
      chapterId: string,
      chapters: ChapterSummary[],
      paragraphIndex = 0,
    ) => {
      const chapter = await chapterService.getById(chapterId);
      const sorted = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber);
      const summary = sorted.find((c) => c._id === chapterId);
      mountAndNavigate(
        chapter.content,
        {
          bookId,
          bookTitle,
          chapterId,
          chapterNumber: summary?.chapterNumber ?? 1,
          chapterTitle: summary?.title || chapter.title || `Chapter ${summary?.chapterNumber ?? 1}`,
          chapters: sorted,
        },
        paragraphIndex,
      );
    },
    [mountAndNavigate],
  );

  /** Load a specific chapter (fetches chapter list automatically) */
  const loadChapter = useCallback(
    async (bookId: string, bookTitle: string, chapterId: string) => {
      const chapters = await chapterService.getByBook(bookId);
      await loadChapterWithContext(bookId, bookTitle, chapterId, chapters);
    },
    [loadChapterWithContext],
  );

  /**
   * Load the book's last-read chapter, or the first chapter if none.
   * Restores the saved paragraph position for the last-read chapter.
   * Does nothing if the book has no chapters.
   */
  const loadBook = useCallback(
    async (book: Book) => {
      if (book.chapterCount === 0) return;

      const chapters = await chapterService.getByBook(book._id);
      const sorted = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber);

      if (book.lastReadChapter) {
        const paraIdx = book.lastReadPosition?.paragraphIndex ?? 0;
        await loadChapterWithContext(book._id, book.title, book.lastReadChapter, sorted, paraIdx);
      } else if (sorted.length > 0) {
        await loadChapterWithContext(book._id, book.title, sorted[0]._id, sorted);
      }
    },
    [loadChapterWithContext],
  );

  return { loadBook, loadChapter };
}

import { useEffect, useRef } from 'react';
import { bookService } from '../services/bookService';
import { chapterService } from '../services/chapterService';
import { getReadingContext } from './useChapterLoader';
import type { ReadingContext } from './useChapterLoader';

/**
 * On app load, if no chapter is mounted yet, finds the most recently read
 * book and silently mounts its last-read chapter + position into localStorage.
 *
 * Only runs once. Does NOT navigate — just populates the reader state so it's
 * ready when the user visits the reader page.
 */
export function useAutoMount() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    // If there's already a reading context, don't override it
    if (getReadingContext()) return;

    (async () => {
      try {
        const books = await bookService.getAll();
        // Find the most recently read book
        const recentBook = books
          .filter((b) => b.lastReadChapter && b.lastReadAt)
          .sort(
            (a, b) =>
              new Date(b.lastReadAt!).getTime() - new Date(a.lastReadAt!).getTime(),
          )[0];

        if (!recentBook) return;

        const chapters = await chapterService.getByBook(recentBook._id);
        if (chapters.length === 0) return;

        const sorted = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber);
        const targetId = recentBook.lastReadChapter!;
        const summary = sorted.find((c) => c._id === targetId);
        if (!summary) return;

        const chapter = await chapterService.getById(targetId);
        const paraIdx = recentBook.lastReadPosition?.paragraphIndex ?? 0;

        const ctx: ReadingContext = {
          bookId: recentBook._id,
          bookTitle: recentBook.title,
          chapterId: targetId,
          chapterNumber: summary.chapterNumber,
          chapterTitle: summary.title || chapter.title || `Chapter ${summary.chapterNumber}`,
          chapters: sorted,
        };

        const textVal = JSON.stringify(chapter.content);
        const paraVal = JSON.stringify(paraIdx);
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
      } catch (err) {
        console.error('Auto-mount failed:', err);
      }
    })();
  }, []);
}

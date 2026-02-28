import { useCallback, useRef, useEffect } from 'react';
import { bookService } from '../services/bookService';
import { getReadingContext } from './useChapterLoader';
import type { PlaybackStatus } from './useTTS';

/**
 * Saves reading progress to the backend.
 *
 * - On pause / stop: saves current paragraph & word index
 * - Exposes `saveNow()` for imperative saves (e.g. before chapter change)
 */
export function useProgressSaver(
  status: PlaybackStatus,
  currentParagraphIndex: number,
  currentWordIndex: number,
) {
  const prevStatus = useRef(status);

  /** Save current progress to backend (fire-and-forget) */
  const saveNow = useCallback(() => {
    const ctx = getReadingContext();
    if (!ctx) return;

    bookService
      .saveProgress(ctx.bookId, {
        chapterId: ctx.chapterId,
        chapterNumber: ctx.chapterNumber,
        paragraphIndex: currentParagraphIndex,
        wordIndex: currentWordIndex,
      })
      .catch(console.error);
  }, [currentParagraphIndex, currentWordIndex]);

  // Auto-save when transitioning from playing → paused or playing → idle (stop)
  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = status;

    if (prev === 'playing' && (status === 'paused' || status === 'idle')) {
      saveNow();
    }
  }, [status, saveNow]);

  return { saveNow };
}

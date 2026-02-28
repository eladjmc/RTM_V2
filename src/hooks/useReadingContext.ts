import { useState, useEffect, useCallback, useMemo } from 'react';
import { chapterService } from '../services/chapterService';
import {
  getReadingContext,
  type ReadingContext,
} from './useChapterLoader';

/**
 * Provides the current reading context (book + chapter info) to the reader,
 * plus prev/next chapter navigation.
 *
 * @param saveBeforeNav — optional callback to persist progress before switching chapters
 */
export function useReadingContext(saveBeforeNav?: () => void) {
  const [ctx, setCtx] = useState<ReadingContext | null>(getReadingContext);

  // Re-read context when the reading-context key changes
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string }>).detail;
      if (detail?.key === 'rtm-reading-context') {
        setCtx(getReadingContext());
      }
    };
    window.addEventListener('local-storage-sync', handler);
    return () => window.removeEventListener('local-storage-sync', handler);
  }, []);

  const currentIndex = useMemo(() => {
    if (!ctx) return -1;
    return ctx.chapters.findIndex((c) => c._id === ctx.chapterId);
  }, [ctx]);

  const hasPrev = currentIndex > 0;
  const hasNext = ctx !== null && currentIndex < ctx.chapters.length - 1;

  const navigateChapter = useCallback(
    async (chapterId: string) => {
      if (!ctx) return;
      // Save progress for current chapter before switching
      saveBeforeNav?.();

      const chapter = await chapterService.getById(chapterId);
      const summary = ctx.chapters.find((c) => c._id === chapterId);

      const newCtx: ReadingContext = {
        ...ctx,
        chapterId,
        chapterNumber: summary?.chapterNumber ?? 1,
        chapterTitle: summary?.title || chapter.title || `Chapter ${summary?.chapterNumber ?? 1}`,
      };

      const textVal = JSON.stringify(chapter.content);
      const paraVal = JSON.stringify(0);
      const ctxVal = JSON.stringify(newCtx);

      localStorage.setItem('rtm-text', textVal);
      localStorage.setItem('rtm-paragraph-index', paraVal);
      localStorage.setItem('rtm-reading-context', ctxVal);

      // Dispatch properly-keyed sync events so useLocalStorage hooks pick up the changes
      const dispatch = (key: string, value: string) =>
        window.dispatchEvent(
          new CustomEvent('local-storage-sync', { detail: { key, value } }),
        );
      dispatch('rtm-text', textVal);
      dispatch('rtm-paragraph-index', paraVal);
      dispatch('rtm-reading-context', ctxVal);
    },
    [ctx, saveBeforeNav],
  );

  const goPrev = useCallback(async () => {
    if (!ctx || !hasPrev) return;
    await navigateChapter(ctx.chapters[currentIndex - 1]._id);
  }, [ctx, hasPrev, currentIndex, navigateChapter]);

  const goNext = useCallback(async () => {
    if (!ctx || !hasNext) return;
    await navigateChapter(ctx.chapters[currentIndex + 1]._id);
  }, [ctx, hasNext, currentIndex, navigateChapter]);

  const goToChapter = useCallback(
    async (chapterId: string) => {
      if (!ctx) return;
      await navigateChapter(chapterId);
    },
    [ctx, navigateChapter],
  );

  return {
    context: ctx,
    hasPrev,
    hasNext,
    goPrev,
    goNext,
    goToChapter,
  };
}

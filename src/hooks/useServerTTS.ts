import { useCallback, useRef, useState, useEffect } from 'react';
import type { ParagraphInfo } from '../utils/textParser';
import {
  ttsService,
  buildTtsChunkCacheKey,
  type TtsChunkProvider,
} from '../services/ttsService';
import { ttsChunkCache } from '../services/ttsChunkCache';
import { playAudioWhenReady, prepareAudioElement } from '../utils/audioPlayback';
import type { TTSState, TTSControls, PlaybackStatus } from './useTTS';

export type { PlaybackStatus };

interface CacheContext {
  bookId: string;
  chapterId: string;
}

/** Prefetch first paragraph of the next chapter while still on current chapter */
export interface NextChapterPrefetch {
  chapterId: string;
  paragraphText: string;
}

interface UseServerTTSOptions {
  enabled: boolean;
  paragraphs: ParagraphInfo[];
  provider: TtsChunkProvider;
  voice: string;
  rate: number;
  volume: number;
  cacheContext: CacheContext;
  nextChapterPrefetch?: NextChapterPrefetch | null;
  onEnd?: () => void;
}

const PREFETCH_AHEAD = 2;

export function useServerTTS({
  enabled,
  paragraphs,
  provider,
  voice,
  rate,
  volume,
  cacheContext,
  nextChapterPrefetch,
  onEnd,
}: UseServerTTSOptions): [TTSState, TTSControls] {
  const [state, setState] = useState<TTSState>({
    status: 'idle',
    currentParagraphIndex: 0,
    currentWordIndex: -1,
    currentCharIndex: 0,
  });

  const stateRef = useRef(state);
  const paragraphsRef = useRef(paragraphs);
  const providerRef = useRef(provider);
  const voiceRef = useRef(voice);
  const rateRef = useRef(rate);
  const volumeRef = useRef(volume);
  const cacheContextRef = useRef(cacheContext);
  const nextChapterPrefetchRef = useRef(nextChapterPrefetch);
  const onEndRef = useRef(onEnd);
  const sessionRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inflightRef = useRef(new Map<string, Promise<Blob>>());
  const pausedAtRef = useRef<number | null>(null);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { paragraphsRef.current = paragraphs; }, [paragraphs]);
  useEffect(() => { providerRef.current = provider; }, [provider]);
  useEffect(() => { voiceRef.current = voice; }, [voice]);
  useEffect(() => { rateRef.current = rate; }, [rate]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { cacheContextRef.current = cacheContext; }, [cacheContext]);
  useEffect(() => { nextChapterPrefetchRef.current = nextChapterPrefetch; }, [nextChapterPrefetch]);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
  }, []);

  const buildKey = useCallback(
    (paragraphIndex: number, chapterId?: string) =>
      buildTtsChunkCacheKey({
        bookId: cacheContextRef.current.bookId,
        chapterId: chapterId ?? cacheContextRef.current.chapterId,
        paragraphIndex,
        provider: providerRef.current,
        voice: voiceRef.current,
        rate: rateRef.current,
      }),
    [],
  );

  const resolveParagraphText = useCallback(
    (paragraphIndex: number, chapterId?: string, overrideText?: string): string | null => {
      if (overrideText) return overrideText;
      const prefetch = nextChapterPrefetchRef.current;
      if (
        chapterId &&
        prefetch &&
        chapterId === prefetch.chapterId &&
        paragraphIndex === 0
      ) {
        return prefetch.paragraphText;
      }
      const paras = paragraphsRef.current;
      if (paragraphIndex < 0 || paragraphIndex >= paras.length) return null;
      return paras[paragraphIndex].text;
    },
    [],
  );

  const fetchChunk = useCallback(
    async (
      paragraphIndex: number,
      chapterId?: string,
      overrideText?: string,
    ): Promise<Blob> => {
      const text = resolveParagraphText(paragraphIndex, chapterId, overrideText);
      if (!text) throw new Error('No text for chunk');

      const key = buildKey(paragraphIndex, chapterId);
      const existing = inflightRef.current.get(key);
      if (existing) return existing;

      const promise = (async () => {
        const cached = await ttsChunkCache.get(key);
        if (cached) return cached;

        const blob = await ttsService.synthesizeChunk({
          text,
          provider: providerRef.current,
          voice: voiceRef.current,
          rate: rateRef.current,
          volume: Math.round(volumeRef.current * 100),
        });

        await ttsChunkCache.put(key, blob, text.length);
        return blob;
      })();

      inflightRef.current.set(key, promise);
      try {
        return await promise;
      } finally {
        inflightRef.current.delete(key);
      }
    },
    [buildKey, resolveParagraphText],
  );

  const prefetchChunk = useCallback(
    (paragraphIndex: number, chapterId?: string, overrideText?: string) => {
      if (!enabled) return;
      fetchChunk(paragraphIndex, chapterId, overrideText).catch(() => {});
    },
    [enabled, fetchChunk],
  );

  const playBlob = useCallback(
    (blob: Blob, session: number): Promise<'ended' | 'interrupted'> =>
      new Promise((resolve) => {
        if (session !== sessionRef.current) {
          resolve('interrupted');
          return;
        }

        const url = URL.createObjectURL(blob);
        const audio = audioRef.current ?? new Audio();
        prepareAudioElement(audio);
        audioRef.current = audio;
        audio.volume = volumeRef.current;
        audio.src = url;

        const cleanup = () => {
          URL.revokeObjectURL(url);
          audio.onended = null;
          audio.onerror = null;
        };

        audio.onended = () => {
          cleanup();
          resolve('ended');
        };
        audio.onerror = () => {
          cleanup();
          resolve('ended');
        };

        playAudioWhenReady(audio, 0)
          .then(() => {
            if (session !== sessionRef.current) {
              audio.pause();
              cleanup();
              resolve('interrupted');
            }
          })
          .catch(() => {
            cleanup();
            resolve('interrupted');
          });
      }),
    [],
  );

  const speakFrom = useCallback(
    async (startIndex: number, session: number) => {
      const paras = paragraphsRef.current;

      for (let i = startIndex; i < paras.length; i++) {
        if (session !== sessionRef.current) return;

        const status = stateRef.current.status;
        if (status !== 'playing' && status !== 'buffering') return;

        setState((prev) => ({
          ...prev,
          status: 'buffering',
          currentParagraphIndex: i,
          currentWordIndex: -1,
          currentCharIndex: 0,
        }));

        for (let ahead = 1; ahead <= PREFETCH_AHEAD; ahead++) {
          const prefetchIdx = i + ahead;
          if (prefetchIdx < paras.length) {
            prefetchChunk(prefetchIdx);
          }
        }

        const prefetch = nextChapterPrefetchRef.current;
        if (prefetch && i === paras.length - 1) {
          prefetchChunk(0, prefetch.chapterId, prefetch.paragraphText);
        }

        let blob: Blob;
        try {
          blob = await fetchChunk(i);
        } catch {
          if (session !== sessionRef.current) return;
          setState((prev) => ({ ...prev, status: 'paused' }));
          return;
        }

        if (session !== sessionRef.current) return;

        if (stateRef.current.status === 'paused') {
          pausedAtRef.current = i;
          return;
        }

        setState((prev) => ({
          ...prev,
          status: 'playing',
          currentParagraphIndex: i,
          currentWordIndex: -1,
        }));

        const result = await playBlob(blob, session);
        if (result === 'interrupted' || session !== sessionRef.current) return;
      }

      if (session !== sessionRef.current) return;

      setState({
        status: 'idle',
        currentParagraphIndex: 0,
        currentWordIndex: -1,
        currentCharIndex: 0,
      });
      onEndRef.current?.();
    },
    [fetchChunk, playBlob, prefetchChunk],
  );

  const play = useCallback(
    (fromIndex?: number) => {
      if (!enabled || paragraphsRef.current.length === 0) return;

      stopAudio();
      sessionRef.current += 1;
      const session = sessionRef.current;
      pausedAtRef.current = null;

      const startIdx = fromIndex ?? stateRef.current.currentParagraphIndex;

      setState((prev) => ({
        ...prev,
        status: 'playing',
        currentParagraphIndex: startIdx,
        currentWordIndex: -1,
      }));

      setTimeout(() => speakFrom(startIdx, session), 50);
    },
    [enabled, speakFrom, stopAudio],
  );

  const pause = useCallback(() => {
    stopAudio();
    sessionRef.current += 1;
    pausedAtRef.current = stateRef.current.currentParagraphIndex;
    setState((prev) => ({ ...prev, status: 'paused' }));
  }, [stopAudio]);

  const resume = useCallback(() => {
    if (!enabled) return;

    const resumeIdx =
      pausedAtRef.current ?? stateRef.current.currentParagraphIndex;

    stopAudio();
    sessionRef.current += 1;
    const session = sessionRef.current;
    pausedAtRef.current = null;

    setState((prev) => ({
      ...prev,
      status: 'playing',
      currentParagraphIndex: resumeIdx,
      currentWordIndex: -1,
    }));

    setTimeout(() => speakFrom(resumeIdx, session), 50);
  }, [enabled, speakFrom, stopAudio]);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    stopAudio();
    pausedAtRef.current = null;
    setState((prev) => ({
      ...prev,
      status: 'idle',
      currentWordIndex: -1,
      currentCharIndex: 0,
    }));
  }, [stopAudio]);

  const reset = useCallback(() => {
    sessionRef.current += 1;
    stopAudio();
    pausedAtRef.current = null;
    setState({
      status: 'idle',
      currentParagraphIndex: 0,
      currentWordIndex: -1,
      currentCharIndex: 0,
    });
  }, [stopAudio]);

  const skipForward = useCallback(() => {
    const nextIndex = stateRef.current.currentParagraphIndex + 1;
    if (nextIndex >= paragraphsRef.current.length) return;

    const wasActive =
      stateRef.current.status === 'playing' ||
      stateRef.current.status === 'buffering';

    sessionRef.current += 1;
    stopAudio();

    if (wasActive) {
      play(nextIndex);
    } else {
      setState((prev) => ({
        ...prev,
        currentParagraphIndex: nextIndex,
        currentWordIndex: -1,
        currentCharIndex: 0,
      }));
    }
  }, [play, stopAudio]);

  const skipBackward = useCallback(() => {
    const prevIndex = Math.max(0, stateRef.current.currentParagraphIndex - 1);
    const wasActive =
      stateRef.current.status === 'playing' ||
      stateRef.current.status === 'buffering';

    sessionRef.current += 1;
    stopAudio();

    if (wasActive) {
      play(prevIndex);
    } else {
      setState((prev) => ({
        ...prev,
        currentParagraphIndex: prevIndex,
        currentWordIndex: -1,
        currentCharIndex: 0,
      }));
    }
  }, [play, stopAudio]);

  const jumpToParagraph = useCallback(
    (index: number) => {
      if (index < 0 || index >= paragraphsRef.current.length) return;

      const wasActive =
        stateRef.current.status === 'playing' ||
        stateRef.current.status === 'buffering';

      sessionRef.current += 1;
      stopAudio();

      if (wasActive) {
        play(index);
      } else {
        setState((prev) => ({
          ...prev,
          status: 'paused',
          currentParagraphIndex: index,
          currentWordIndex: -1,
          currentCharIndex: 0,
        }));
        pausedAtRef.current = index;
      }
    },
    [play, stopAudio],
  );

  useEffect(() => {
    if (!enabled) {
      sessionRef.current += 1;
      stopAudio();
    }
  }, [enabled, stopAudio]);

  useEffect(() => () => {
    sessionRef.current += 1;
    stopAudio();
  }, [stopAudio]);

  return [
    state,
    { play, pause, resume, stop, reset, skipForward, skipBackward, jumpToParagraph },
  ];
}

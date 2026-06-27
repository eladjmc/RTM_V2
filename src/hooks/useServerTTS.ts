import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import type { ParagraphInfo } from '../utils/textParser';
import {
  ttsService,
  buildTtsChunkCacheKey,
  type TtsChunkProvider,
} from '../services/ttsService';
import { ttsChunkCache } from '../services/ttsChunkCache';
import {
  buildTtsPlaybackChunks,
  buildChunkParagraphCharRanges,
  findChunkIndexForParagraph,
  paragraphIndexAtChunkProgress,
  type TtsPlaybackChunk,
} from '../utils/ttsPlaybackChunks';
import {
  playAudioWhenReady,
  prepareAudioElement,
  resetAudioElement,
  audioChunkGap,
} from '../utils/audioPlayback';
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
  const playbackChunks = useMemo(
    () => buildTtsPlaybackChunks(paragraphs),
    [paragraphs],
  );

  const [state, setState] = useState<TTSState>({
    status: 'idle',
    currentParagraphIndex: 0,
    currentWordIndex: -1,
    currentCharIndex: 0,
  });

  const stateRef = useRef(state);
  const paragraphsRef = useRef(paragraphs);
  const playbackChunksRef = useRef(playbackChunks);
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
  useEffect(() => { playbackChunksRef.current = playbackChunks; }, [playbackChunks]);
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
    (chunkIndex: number, chapterId?: string) =>
      buildTtsChunkCacheKey({
        bookId: cacheContextRef.current.bookId,
        chapterId: chapterId ?? cacheContextRef.current.chapterId,
        chunkIndex,
        provider: providerRef.current,
        voice: voiceRef.current,
        rate: rateRef.current,
      }),
    [],
  );

  const resolveChunk = useCallback(
    (
      chunkIndex: number,
      chapterId?: string,
      overrideText?: string,
    ): TtsPlaybackChunk | { text: string; chunkIndex: number } | null => {
      if (overrideText && chapterId) {
        return { text: overrideText, chunkIndex: 0 };
      }

      const chunks = playbackChunksRef.current;
      if (chunkIndex < 0 || chunkIndex >= chunks.length) return null;
      return chunks[chunkIndex];
    },
    [],
  );

  const fetchChunk = useCallback(
    async (
      chunkIndex: number,
      chapterId?: string,
      overrideText?: string,
    ): Promise<Blob> => {
      const chunk = resolveChunk(chunkIndex, chapterId, overrideText);
      if (!chunk) throw new Error('No text for chunk');

      const text = chunk.text;
      const resolvedChunkIndex = chunk.chunkIndex;
      const key = buildKey(resolvedChunkIndex, chapterId);
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
    [buildKey, resolveChunk],
  );

  const prefetchChunk = useCallback(
    (chunkIndex: number, chapterId?: string, overrideText?: string) => {
      if (!enabled) return;
      fetchChunk(chunkIndex, chapterId, overrideText).catch(() => {});
    },
    [enabled, fetchChunk],
  );

  const playBlob = useCallback(
    (
      blob: Blob,
      session: number,
      chunk: TtsPlaybackChunk,
    ): Promise<'ended' | 'interrupted'> =>
      new Promise((resolve) => {
        if (session !== sessionRef.current) {
          resolve('interrupted');
          return;
        }

        const run = async () => {
          const audio = audioRef.current ?? new Audio();
          prepareAudioElement(audio);
          audioRef.current = audio;

          await resetAudioElement(audio);

          if (session !== sessionRef.current) {
            resolve('interrupted');
            return;
          }

          const url = URL.createObjectURL(blob);
          let revoked = false;
          const revoke = () => {
            if (!revoked) {
              URL.revokeObjectURL(url);
              revoked = true;
            }
          };

          const paragraphRanges = buildChunkParagraphCharRanges(
            chunk,
            paragraphsRef.current,
          );

          const syncParagraphHighlight = () => {
            if (session !== sessionRef.current) return;
            const { duration, currentTime } = audio;
            if (!duration || !Number.isFinite(duration)) return;

            const paragraphIndex = paragraphIndexAtChunkProgress(
              paragraphRanges,
              currentTime / duration,
            );

            setState((prev) => {
              if (prev.currentParagraphIndex === paragraphIndex) return prev;
              return { ...prev, currentParagraphIndex: paragraphIndex };
            });
          };

          audio.volume = volumeRef.current;
          audio.src = url;

          const cleanup = () => {
            audio.onended = null;
            audio.onerror = null;
            audio.removeEventListener('timeupdate', syncParagraphHighlight);
            revoke();
          };

          audio.onended = () => {
            cleanup();
            resolve('ended');
          };
          audio.onerror = () => {
            cleanup();
            resolve('ended');
          };

          audio.addEventListener('timeupdate', syncParagraphHighlight);

          try {
            await playAudioWhenReady(audio, 0);
            if (session !== sessionRef.current) {
              audio.pause();
              cleanup();
              resolve('interrupted');
              return;
            }

            syncParagraphHighlight();
          } catch {
            cleanup();
            resolve('interrupted');
          }
        };

        run();
      }),
    [],
  );

  const speakFromChunk = useCallback(
    async (startChunkIndex: number, session: number) => {
      const chunks = playbackChunksRef.current;

      for (let ci = startChunkIndex; ci < chunks.length; ci++) {
        if (session !== sessionRef.current) return;

        const status = stateRef.current.status;
        if (status !== 'playing' && status !== 'buffering') return;

        const chunk = chunks[ci];

        setState((prev) => ({
          ...prev,
          status: 'buffering',
          currentParagraphIndex: chunk.startParagraphIndex,
          currentWordIndex: -1,
          currentCharIndex: 0,
        }));

        for (let ahead = 1; ahead <= PREFETCH_AHEAD; ahead++) {
          const prefetchIdx = ci + ahead;
          if (prefetchIdx < chunks.length) {
            prefetchChunk(prefetchIdx);
          }
        }

        const prefetch = nextChapterPrefetchRef.current;
        if (prefetch && ci === chunks.length - 1) {
          prefetchChunk(0, prefetch.chapterId, prefetch.paragraphText);
        }

        let blob: Blob;
        try {
          blob = await fetchChunk(ci);
        } catch {
          if (session !== sessionRef.current) return;
          setState((prev) => ({ ...prev, status: 'paused' }));
          return;
        }

        if (session !== sessionRef.current) return;

        if (stateRef.current.status === 'paused') {
          pausedAtRef.current = chunk.startParagraphIndex;
          return;
        }

        setState((prev) => ({
          ...prev,
          status: 'playing',
          currentParagraphIndex: chunk.startParagraphIndex,
          currentWordIndex: -1,
        }));

        const result = await playBlob(blob, session, chunk);
        if (result === 'interrupted' || session !== sessionRef.current) return;

        setState((prev) => ({
          ...prev,
          currentParagraphIndex: chunk.endParagraphIndex,
        }));

        if (ci + 1 < chunks.length) {
          await audioChunkGap(40);
        }
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

  const speakFromParagraph = useCallback(
    (startParagraphIndex: number, session: number) => {
      const chunkIndex = findChunkIndexForParagraph(
        playbackChunksRef.current,
        startParagraphIndex,
      );
      return speakFromChunk(chunkIndex, session);
    },
    [speakFromChunk],
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

      setTimeout(() => speakFromParagraph(startIdx, session), 50);
    },
    [enabled, speakFromParagraph, stopAudio],
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

    setTimeout(() => speakFromParagraph(resumeIdx, session), 50);
  }, [enabled, speakFromParagraph, stopAudio]);

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
    const chunks = playbackChunksRef.current;
    const chunkIdx = findChunkIndexForParagraph(
      chunks,
      stateRef.current.currentParagraphIndex,
    );
    if (chunkIdx + 1 >= chunks.length) return;

    const nextIndex = chunks[chunkIdx + 1].startParagraphIndex;

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
    const chunks = playbackChunksRef.current;
    const chunkIdx = findChunkIndexForParagraph(
      chunks,
      stateRef.current.currentParagraphIndex,
    );
    if (chunkIdx <= 0) return;

    const prevIndex = chunks[chunkIdx - 1].startParagraphIndex;

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

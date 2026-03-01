import { useCallback, useRef, useState, useEffect } from 'react';
import type { ParagraphInfo } from '../utils/textParser';

export type PlaybackStatus = 'idle' | 'playing' | 'paused';

export interface TTSState {
  status: PlaybackStatus;
  currentParagraphIndex: number;
  currentWordIndex: number;
  /** Character index within the current paragraph utterance */
  currentCharIndex: number;
}

export interface TTSControls {
  play: (fromIndex?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
  skipForward: () => void;
  skipBackward: () => void;
  jumpToParagraph: (index: number) => void;
}

interface UseTTSOptions {
  paragraphs: ParagraphInfo[];
  voice: SpeechSynthesisVoice | null;
  rate: number;
  volume: number;
  onEnd?: () => void;
}

/**
 * Core TTS hook — event-driven paragraph sequencing.
 *
 * Instead of an async for-loop (which races on mobile when cancel() fires
 * onend instead of onerror), each paragraph's onend callback schedules the
 * next paragraph.  A synchronous `activeRef` boolean (set BEFORE cancel())
 * prevents phantom callbacks from cascading.
 */
export function useTTS({
  paragraphs,
  voice,
  rate,
  volume,
  onEnd,
}: UseTTSOptions): [TTSState, TTSControls] {
  const [state, setState] = useState<TTSState>({
    status: 'idle',
    currentParagraphIndex: 0,
    currentWordIndex: -1,
    currentCharIndex: 0,
  });

  /* ── Refs (synchronous, no React-effect delay) ── */
  const paragraphsRef = useRef(paragraphs);
  const voiceRef = useRef(voice);
  const rateRef = useRef(rate);
  const volumeRef = useRef(volume);
  const onEndRef = useRef(onEnd);
  const currentIdxRef = useRef(0);

  useEffect(() => { paragraphsRef.current = paragraphs; }, [paragraphs]);
  useEffect(() => { voiceRef.current = voice; }, [voice]);
  useEffect(() => { rateRef.current = rate; }, [rate]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);

  /**
   * activeRef is the single source of truth for "should the chain continue?".
   * It is updated SYNCHRONOUSLY (before cancel()) so that any phantom onend
   * fired by cancel() will see `false` and bail out.
   */
  const activeRef = useRef(false);

  /* ── Speak one paragraph, advance on completion ── */

  const speakIndexRef = useRef<(index: number) => void>(() => {});

  const speakIndex = useCallback((index: number) => {
    const paras = paragraphsRef.current;

    // Chain finished — all paragraphs read
    if (index >= paras.length) {
      activeRef.current = false;
      currentIdxRef.current = 0;
      setState({ status: 'idle', currentParagraphIndex: 0, currentWordIndex: -1, currentCharIndex: 0 });
      onEndRef.current?.();
      return;
    }

    const paragraph = paras[index];
    const utterance = new SpeechSynthesisUtterance(paragraph.text);

    if (voiceRef.current) {
      utterance.voice = voiceRef.current;
      utterance.lang = voiceRef.current.lang;
    }
    utterance.rate = rateRef.current;
    utterance.volume = volumeRef.current;

    /* Word-boundary highlighting */
    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      if (event.name === 'word') {
        const charIndex = event.charIndex;
        const wordIdx = paragraph.words.findIndex(
          (w) => charIndex >= w.startOffset && charIndex < w.endOffset
        );
        setState((prev) => ({
          ...prev,
          currentWordIndex: wordIdx >= 0 ? wordIdx : prev.currentWordIndex,
          currentCharIndex: charIndex,
        }));
      }
    };

    /* On completion → advance to next paragraph */
    utterance.onend = () => {
      if (!activeRef.current) return;          // chain was cancelled
      const next = currentIdxRef.current + 1;
      currentIdxRef.current = next;
      speakIndexRef.current(next);
    };

    utterance.onerror = () => {
      // cancel / interrupted — just stop; activeRef is already false
      // unknown errors — also stop to avoid infinite retries
    };

    currentIdxRef.current = index;
    setState((prev) => ({
      ...prev,
      currentParagraphIndex: index,
      currentWordIndex: -1,
      currentCharIndex: 0,
    }));

    try {
      speechSynthesis.speak(utterance);
    } catch {
      activeRef.current = false;
    }
  }, []);

  useEffect(() => { speakIndexRef.current = speakIndex; }, [speakIndex]);

  /* ── Controls ── */

  const play = useCallback(
    (fromIndex?: number) => {
      if (paragraphsRef.current.length === 0) return;

      // 1. Kill any existing chain SYNCHRONOUSLY
      activeRef.current = false;
      speechSynthesis.cancel();

      const startIdx = fromIndex ?? currentIdxRef.current;

      // 2. Start new chain after a tick (lets cancel's phantom onend drain)
      setState({
        status: 'playing',
        currentParagraphIndex: startIdx,
        currentWordIndex: -1,
        currentCharIndex: 0,
      });

      setTimeout(() => {
        activeRef.current = true;
        speakIndex(startIdx);
      }, 100);
    },
    [speakIndex]
  );

  const pause = useCallback(() => {
    speechSynthesis.pause();
    setState((prev) => ({ ...prev, status: 'paused' }));
  }, []);

  const resume = useCallback(() => {
    if (!speechSynthesis.speaking && !speechSynthesis.pending) {
      play();
      return;
    }
    speechSynthesis.resume();
    setState((prev) => ({ ...prev, status: 'playing' }));
  }, [play]);

  const stop = useCallback(() => {
    activeRef.current = false;
    speechSynthesis.cancel();
    currentIdxRef.current = 0;
    setState({ status: 'idle', currentParagraphIndex: 0, currentWordIndex: -1, currentCharIndex: 0 });
  }, []);

  const reset = useCallback(() => {
    activeRef.current = false;
    speechSynthesis.cancel();
    currentIdxRef.current = 0;
    setState({ status: 'idle', currentParagraphIndex: 0, currentWordIndex: -1, currentCharIndex: 0 });
  }, []);

  const skipForward = useCallback(() => {
    const nextIndex = currentIdxRef.current + 1;
    if (nextIndex >= paragraphsRef.current.length) return;

    const wasPlaying = activeRef.current;
    activeRef.current = false;
    speechSynthesis.cancel();

    currentIdxRef.current = nextIndex;
    setState((prev) => ({
      ...prev,
      status: wasPlaying ? 'playing' : prev.status,
      currentParagraphIndex: nextIndex,
      currentWordIndex: -1,
      currentCharIndex: 0,
    }));

    if (wasPlaying) {
      setTimeout(() => {
        activeRef.current = true;
        speakIndex(nextIndex);
      }, 100);
    }
  }, [speakIndex]);

  const skipBackward = useCallback(() => {
    const prevIndex = Math.max(0, currentIdxRef.current - 1);

    const wasPlaying = activeRef.current;
    activeRef.current = false;
    speechSynthesis.cancel();

    currentIdxRef.current = prevIndex;
    setState((prev) => ({
      ...prev,
      status: wasPlaying ? 'playing' : prev.status,
      currentParagraphIndex: prevIndex,
      currentWordIndex: -1,
      currentCharIndex: 0,
    }));

    if (wasPlaying) {
      setTimeout(() => {
        activeRef.current = true;
        speakIndex(prevIndex);
      }, 100);
    }
  }, [speakIndex]);

  const jumpToParagraph = useCallback(
    (index: number) => {
      if (index < 0 || index >= paragraphsRef.current.length) return;

      const wasPlaying = activeRef.current;
      activeRef.current = false;
      speechSynthesis.cancel();

      currentIdxRef.current = index;
      setState((prev) => ({
        ...prev,
        status: wasPlaying ? 'playing' : 'paused',
        currentParagraphIndex: index,
        currentWordIndex: -1,
        currentCharIndex: 0,
      }));

      if (wasPlaying) {
        setTimeout(() => {
          activeRef.current = true;
          speakIndex(index);
        }, 100);
      }
    },
    [speakIndex]
  );

  return [
    state,
    { play, pause, resume, stop, reset, skipForward, skipBackward, jumpToParagraph },
  ];
}

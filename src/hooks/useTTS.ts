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
 * Core TTS hook — manages SpeechSynthesis playback, paragraph sequencing,
 * and word boundary tracking for highlighting.
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

  const stateRef = useRef(state);
  const paragraphsRef = useRef(paragraphs);
  const voiceRef = useRef(voice);
  const rateRef = useRef(rate);
  const volumeRef = useRef(volume);
  const onEndRef = useRef(onEnd);

  // Sync refs in an effect to comply with React 19 strict mode
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    paragraphsRef.current = paragraphs;
  }, [paragraphs]);
  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);
  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  // Generation counter — incremented on every play/skip/jump.
  // If speakFrom detects the generation changed, it exits silently
  // instead of firing onEnd (prevents phantom-event cascades on mobile).
  const generationRef = useRef(0);

  /**
   * Speak a single paragraph. Returns a promise that resolves when done.
   * 'phantom' means mobile fired onend immediately without actually speaking,
   * or the utterance silently stalled and the watchdog kicked in.
   */
  const speakParagraph = useCallback(
    (paragraphIndex: number, gen: number): Promise<'ended' | 'interrupted' | 'phantom'> => {
      return new Promise((resolve) => {
        // If generation already changed, bail immediately
        if (gen !== generationRef.current) {
          resolve('interrupted');
          return;
        }

        const paras = paragraphsRef.current;
        if (paragraphIndex < 0 || paragraphIndex >= paras.length) {
          resolve('ended');
          return;
        }

        const paragraph = paras[paragraphIndex];
        const utterance = new SpeechSynthesisUtterance(paragraph.text);

        if (voiceRef.current) {
          utterance.voice = voiceRef.current;
          utterance.lang = voiceRef.current.lang;
        }
        utterance.rate = rateRef.current;
        utterance.volume = volumeRef.current;

        // ── Guard against double-resolve ──
        let settled = false;
        const finish = (result: 'ended' | 'interrupted' | 'phantom') => {
          if (settled) return;
          settled = true;
          clearTimeout(watchdog);
          resolve(result);
        };

        // Phantom detection: track whether speech actually produced output
        let hadBoundary = false;
        const speakTime = Date.now();

        utterance.onboundary = (event: SpeechSynthesisEvent) => {
          if (event.name === 'word') {
            hadBoundary = true;
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

        utterance.onend = () => {
          if (gen !== generationRef.current) {
            finish('interrupted');
            return;
          }
          // Mobile phantom: onend fires quickly with no boundary events.
          // Use 500ms threshold to account for slow mobile devices.
          if (!hadBoundary && Date.now() - speakTime < 500) {
            finish('phantom');
            return;
          }
          finish('ended');
        };

        utterance.onerror = (event) => {
          if (event.error === 'interrupted' || event.error === 'canceled') {
            finish('interrupted');
          } else {
            finish(gen === generationRef.current ? 'ended' : 'interrupted');
          }
        };

        // ── Watchdog: if speech produces nothing in 5 seconds, force-fail ──
        const watchdog = setTimeout(() => {
          if (!hadBoundary && gen === generationRef.current) {
            try { speechSynthesis.cancel(); } catch { /* ignore */ }
            // Small delay for the cancel onend/onerror to settle, then force
            setTimeout(() => finish('phantom'), 100);
          }
        }, 5000);

        setState((prev) => ({
          ...prev,
          currentParagraphIndex: paragraphIndex,
          currentWordIndex: -1,
          currentCharIndex: 0,
        }));

        speechSynthesis.speak(utterance);
      });
    },
    []
  );

  /**
   * Sequentially speak paragraphs starting from the given index.
   */
  const speakFrom = useCallback(
    async (startIndex: number, gen: number) => {
      const paras = paragraphsRef.current;

      for (let i = startIndex; i < paras.length; i++) {
        // Stale generation or stopped — exit silently
        if (gen !== generationRef.current || stateRef.current.status !== 'playing') {
          return;
        }

        let result = await speakParagraph(i, gen);

        // Mobile phantom: retry up to 3 times with increasing delay
        let retries = 0;
        while (result === 'phantom' && retries < 3) {
          retries++;
          // Wait 500ms, 1000ms, 1500ms between retries
          await new Promise((r) => setTimeout(r, 500 * retries));
          if (gen !== generationRef.current) return;
          result = await speakParagraph(i, gen);
        }

        // If still phantom after retries, give up gracefully (don't fire onEnd)
        if (result === 'phantom') {
          setState((prev) => ({
            ...prev,
            status: 'idle',
            currentWordIndex: -1,
            currentCharIndex: 0,
          }));
          return;
        }

        if (result === 'interrupted') {
          return;
        }
      }

      // Only fire onEnd if this generation is still current
      if (gen !== generationRef.current) return;

      setState((prev) => ({
        ...prev,
        status: 'idle',
        currentWordIndex: -1,
        currentCharIndex: 0,
      }));
      onEndRef.current?.();
    },
    [speakParagraph]
  );

  const play = useCallback(
    (fromIndex?: number) => {
      if (paragraphsRef.current.length === 0) return;

      const gen = ++generationRef.current;

      // Only cancel if something is actually in the pipeline —
      // avoids putting the mobile speech engine in a bad state.
      const needsCancel = speechSynthesis.speaking || speechSynthesis.pending;
      if (needsCancel) {
        speechSynthesis.cancel();
      }

      const startIdx = fromIndex ?? stateRef.current.currentParagraphIndex;

      setState({
        status: 'playing',
        currentParagraphIndex: startIdx,
        currentWordIndex: -1,
        currentCharIndex: 0,
      });

      // Longer delay after cancel for mobile; shorter when no cancel needed
      const delay = needsCancel ? 300 : 50;
      setTimeout(() => {
        // Guard against stale generation (user may have pressed stop during delay)
        if (gen !== generationRef.current) return;
        speakFrom(startIdx, gen);
      }, delay);
    },
    [speakFrom]
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
    ++generationRef.current;
    speechSynthesis.cancel();
    setState((prev) => ({
      ...prev,
      status: 'paused',
      currentWordIndex: -1,
      currentCharIndex: 0,
    }));
  }, []);

  const reset = useCallback(() => {
    ++generationRef.current;
    speechSynthesis.cancel();
    setState({
      status: 'idle',
      currentParagraphIndex: 0,
      currentWordIndex: -1,
      currentCharIndex: 0,
    });
  }, []);

  const skipForward = useCallback(() => {
    const nextIndex = stateRef.current.currentParagraphIndex + 1;
    if (nextIndex >= paragraphsRef.current.length) return;

    const wasPlaying = stateRef.current.status === 'playing';
    const gen = ++generationRef.current;
    speechSynthesis.cancel();

    setState((prev) => ({
      ...prev,
      status: wasPlaying ? 'playing' : prev.status,
      currentParagraphIndex: nextIndex,
      currentWordIndex: -1,
      currentCharIndex: 0,
    }));

    if (wasPlaying) {
      setTimeout(() => {
        if (gen !== generationRef.current) return;
        speakFrom(nextIndex, gen);
      }, 300);
    }
  }, [speakFrom]);

  const skipBackward = useCallback(() => {
    const prevIndex = Math.max(0, stateRef.current.currentParagraphIndex - 1);

    const wasPlaying = stateRef.current.status === 'playing';
    const gen = ++generationRef.current;
    speechSynthesis.cancel();

    setState((prev) => ({
      ...prev,
      status: wasPlaying ? 'playing' : prev.status,
      currentParagraphIndex: prevIndex,
      currentWordIndex: -1,
      currentCharIndex: 0,
    }));

    if (wasPlaying) {
      setTimeout(() => {
        if (gen !== generationRef.current) return;
        speakFrom(prevIndex, gen);
      }, 300);
    }
  }, [speakFrom]);

  const jumpToParagraph = useCallback(
    (index: number) => {
      if (index < 0 || index >= paragraphsRef.current.length) return;

      const wasPlaying = stateRef.current.status === 'playing';
      const gen = ++generationRef.current;
      speechSynthesis.cancel();

      setState((prev) => ({
        ...prev,
        status: wasPlaying ? 'playing' : 'paused',
        currentParagraphIndex: index,
        currentWordIndex: -1,
        currentCharIndex: 0,
      }));

      if (wasPlaying) {
        setTimeout(() => {
          if (gen !== generationRef.current) return;
          speakFrom(index, gen);
        }, 300);
      }
    },
    [speakFrom]
  );

  return [
    state,
    { play, pause, resume, stop, reset, skipForward, skipBackward, jumpToParagraph },
  ];
}

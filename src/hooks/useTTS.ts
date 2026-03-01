import { useCallback, useRef, useState, useEffect } from 'react';
import type { ParagraphInfo } from '../utils/textParser';
import { debugLog } from '../utils/debugLog';

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

  /**
   * Speak a single paragraph. Returns a promise that resolves when done.
   * Includes a watchdog — if no event fires within 3s, retries once.
   */
  const speakParagraph = useCallback(
    (paragraphIndex: number): Promise<'ended' | 'interrupted'> => {
      return new Promise((resolve) => {
        const paras = paragraphsRef.current;
        if (paragraphIndex < 0 || paragraphIndex >= paras.length) {
          debugLog(`speakPara(${paragraphIndex}): out of range (${paras.length})`);
          resolve('ended');
          return;
        }

        const paragraph = paras[paragraphIndex];
        const textPreview = paragraph.text.slice(0, 40);
        debugLog(`speakPara(${paragraphIndex}): "${textPreview}…"`);

        let settled = false;
        let retried = false;
        let watchdog: ReturnType<typeof setTimeout> | null = null;

        const finish = (result: 'ended' | 'interrupted', source: string) => {
          if (settled) return;
          settled = true;
          if (watchdog) clearTimeout(watchdog);
          debugLog(`  → ${result} (${source})`);
          resolve(result);
        };

        const createUtterance = () => {
          const utt = new SpeechSynthesisUtterance(paragraph.text);
          if (voiceRef.current) {
            utt.voice = voiceRef.current;
            utt.lang = voiceRef.current.lang;
          }
          utt.rate = rateRef.current;
          utt.volume = volumeRef.current;

          utt.onstart = () => {
            debugLog(`  onstart fired`);
            // Speech is actually playing — reset watchdog to a long timeout
            if (watchdog) clearTimeout(watchdog);
            watchdog = null;
          };

          utt.onboundary = (event: SpeechSynthesisEvent) => {
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

          utt.onend = () => finish('ended', 'onend');

          utt.onerror = (event) => {
            debugLog(`  onerror: ${event.error}`);
            finish('interrupted', `onerror:${event.error}`);
          };

          return utt;
        };

        setState((prev) => ({
          ...prev,
          currentParagraphIndex: paragraphIndex,
          currentWordIndex: -1,
          currentCharIndex: 0,
        }));

        const utt = createUtterance();
        speechSynthesis.speak(utt);

        const s = speechSynthesis;
        debugLog(`  after speak(): speaking=${s.speaking} pending=${s.pending}`);

        // Watchdog: if nothing happens in 3s, the speak() was swallowed.
        watchdog = setTimeout(() => {
          if (settled) return;
          const ss = speechSynthesis;
          debugLog(`  WATCHDOG: speaking=${ss.speaking} pending=${ss.pending} retried=${retried}`);

          if (!retried) {
            retried = true;
            // Cancel everything and try once more with a delay
            speechSynthesis.cancel();
            const utt2 = createUtterance();
            setTimeout(() => {
              if (settled) return;
              debugLog(`  RETRY speak()`);
              speechSynthesis.speak(utt2);
              // Second watchdog — if this also fails, give up
              watchdog = setTimeout(() => {
                if (!settled) {
                  debugLog(`  RETRY also failed — giving up`);
                  finish('interrupted', 'watchdog-timeout');
                }
              }, 4000);
            }, 200);
          } else {
            finish('interrupted', 'watchdog-timeout');
          }
        }, 3000);
      });
    },
    []
  );

  /**
   * Sequentially speak paragraphs starting from the given index.
   */
  const speakFrom = useCallback(
    async (startIndex: number) => {
      const paras = paragraphsRef.current;
      debugLog(`speakFrom(${startIndex}) — ${paras.length} paragraphs`);

      for (let i = startIndex; i < paras.length; i++) {
        // Check if we were stopped
        if (stateRef.current.status !== 'playing') {
          debugLog(`speakFrom: status=${stateRef.current.status}, stopping loop`);
          return;
        }

        const result = await speakParagraph(i);

        if (result === 'interrupted') {
          debugLog(`speakFrom: interrupted at paragraph ${i}`);
          return;
        }
      }

      debugLog('speakFrom: all paragraphs done');
      setState({
        status: 'idle',
        currentParagraphIndex: 0,
        currentWordIndex: -1,
        currentCharIndex: 0,
      });
      onEndRef.current?.();
    },
    [speakParagraph]
  );

  const play = useCallback(
    (fromIndex?: number) => {
      if (paragraphsRef.current.length === 0) return;

      const startIdx = fromIndex ?? stateRef.current.currentParagraphIndex;
      const s = speechSynthesis;
      debugLog(`play(${fromIndex ?? 'cur'}) → idx=${startIdx} speaking=${s.speaking} pending=${s.pending} voice=${voiceRef.current?.name ?? 'NULL'}`);

      // Always cancel to reset engine state — needed on some mobile browsers
      speechSynthesis.cancel();

      // Sync the ref immediately so speakFrom's status check passes
      stateRef.current = {
        ...stateRef.current,
        status: 'playing',
        currentParagraphIndex: startIdx,
        currentWordIndex: -1,
      };
      setState(stateRef.current);

      // Small delay after cancel — mobile engines need time to reset.
      // User gesture audio unlock persists across setTimeout on modern browsers.
      setTimeout(() => speakFrom(startIdx), 100);
    },
    [speakFrom]
  );

  const pause = useCallback(() => {
    speechSynthesis.pause();
    setState((prev) => ({ ...prev, status: 'paused' }));
  }, []);

  const resume = useCallback(() => {
    // If speech was cancelled (e.g. after jumpToParagraph), start fresh
    if (!speechSynthesis.speaking && !speechSynthesis.pending) {
      play();
      return;
    }
    speechSynthesis.resume();
    setState((prev) => ({ ...prev, status: 'playing' }));
  }, [play]);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    setState({
      status: 'idle',
      currentParagraphIndex: 0,
      currentWordIndex: -1,
      currentCharIndex: 0,
    });
  }, []);

  const reset = useCallback(() => {
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
    speechSynthesis.cancel();

    stateRef.current = {
      ...stateRef.current,
      status: wasPlaying ? 'playing' : stateRef.current.status,
      currentParagraphIndex: nextIndex,
      currentWordIndex: -1,
      currentCharIndex: 0,
    };
    setState(stateRef.current);

    if (wasPlaying) {
      // Delay after cancel so mobile engine is ready
      setTimeout(() => speakFrom(nextIndex), 150);
    }
  }, [speakFrom]);

  const skipBackward = useCallback(() => {
    const prevIndex = Math.max(0, stateRef.current.currentParagraphIndex - 1);

    const wasPlaying = stateRef.current.status === 'playing';
    speechSynthesis.cancel();

    stateRef.current = {
      ...stateRef.current,
      status: wasPlaying ? 'playing' : stateRef.current.status,
      currentParagraphIndex: prevIndex,
      currentWordIndex: -1,
      currentCharIndex: 0,
    };
    setState(stateRef.current);

    if (wasPlaying) {
      setTimeout(() => speakFrom(prevIndex), 150);
    }
  }, [speakFrom]);

  const jumpToParagraph = useCallback(
    (index: number) => {
      if (index < 0 || index >= paragraphsRef.current.length) return;

      const wasPlaying = stateRef.current.status === 'playing';
      speechSynthesis.cancel();

      stateRef.current = {
        ...stateRef.current,
        status: wasPlaying ? 'playing' : 'paused',
        currentParagraphIndex: index,
        currentWordIndex: -1,
        currentCharIndex: 0,
      };
      setState(stateRef.current);

      if (wasPlaying) {
        setTimeout(() => speakFrom(index), 150);
      }
    },
    [speakFrom]
  );

  return [
    state,
    { play, pause, resume, stop, reset, skipForward, skipBackward, jumpToParagraph },
  ];
}

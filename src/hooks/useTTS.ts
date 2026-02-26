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
  play: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
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
   */
  const speakParagraph = useCallback(
    (paragraphIndex: number): Promise<'ended' | 'interrupted'> => {
      return new Promise((resolve) => {
        const paras = paragraphsRef.current;
        if (paragraphIndex < 0 || paragraphIndex >= paras.length) {
          resolve('ended');
          return;
        }

        const paragraph = paras[paragraphIndex];
        const utterance = new SpeechSynthesisUtterance(paragraph.text);

        if (voiceRef.current) {
          utterance.voice = voiceRef.current;
        }
        utterance.rate = rateRef.current;
        utterance.volume = volumeRef.current;

        utterance.onboundary = (event: SpeechSynthesisEvent) => {
          if (event.name === 'word') {
            const charIndex = event.charIndex;
            // Find which word this charIndex corresponds to
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
          resolve('ended');
        };

        utterance.onerror = (event) => {
          if (event.error === 'interrupted' || event.error === 'canceled') {
            resolve('interrupted');
          } else {
            resolve('ended');
          }
        };

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
    async (startIndex: number) => {
      const paras = paragraphsRef.current;

      for (let i = startIndex; i < paras.length; i++) {
        // Check if we were stopped
        if (stateRef.current.status !== 'playing') {
          return;
        }

        const result = await speakParagraph(i);

        if (result === 'interrupted') {
          return; // We were paused or stopped
        }
      }

      // All paragraphs done
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

  const play = useCallback(() => {
    if (paragraphsRef.current.length === 0) return;

    speechSynthesis.cancel();

    setState((prev) => ({
      ...prev,
      status: 'playing',
      currentWordIndex: -1,
    }));

    // Use setTimeout to ensure state is updated before starting speech
    setTimeout(() => {
      speakFrom(stateRef.current.currentParagraphIndex);
    }, 50);
  }, [speakFrom]);

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

  const skipForward = useCallback(() => {
    const nextIndex = stateRef.current.currentParagraphIndex + 1;
    if (nextIndex >= paragraphsRef.current.length) return;

    const wasPlaying = stateRef.current.status === 'playing';
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
        speakFrom(nextIndex);
      }, 50);
    }
  }, [speakFrom]);

  const skipBackward = useCallback(() => {
    const prevIndex = Math.max(0, stateRef.current.currentParagraphIndex - 1);

    const wasPlaying = stateRef.current.status === 'playing';
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
        speakFrom(prevIndex);
      }, 50);
    }
  }, [speakFrom]);

  const jumpToParagraph = useCallback(
    (index: number) => {
      if (index < 0 || index >= paragraphsRef.current.length) return;

      const wasPlaying = stateRef.current.status === 'playing';
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
          speakFrom(index);
        }, 50);
      }
    },
    [speakFrom]
  );

  return [
    state,
    { play, pause, resume, stop, skipForward, skipBackward, jumpToParagraph },
  ];
}

import { useLocalStorage } from './useLocalStorage';
import type { TtsChunkProvider } from '../services/ttsService';

export type PlaybackEngine = 'browser' | 'server';

export interface ReaderSettings {
  text: string;
  setText: (text: string) => void;
  speed: number;
  setSpeed: (speed: number) => void;
  volume: number;
  setVolume: (volume: number) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean | ((prev: boolean) => boolean)) => void;
  savedVoiceName: string;
  setSavedVoiceName: (name: string) => void;
  themeMode: 'light' | 'dark';
  setThemeMode: (mode: 'light' | 'dark' | ((prev: 'light' | 'dark') => 'light' | 'dark')) => void;
  savedParagraphIndex: number;
  setSavedParagraphIndex: (index: number) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  playbackEngine: PlaybackEngine;
  setPlaybackEngine: (engine: PlaybackEngine) => void;
  serverProvider: TtsChunkProvider;
  setServerProvider: (provider: TtsChunkProvider) => void;
  serverVoice: string;
  setServerVoice: (voice: string) => void;
}

/**
 * Groups all persisted reader settings into one hook.
 */
export function useReaderSettings(): ReaderSettings {
  const [text, setText] = useLocalStorage<string>('rtm-text', '');
  const [speed, setSpeed] = useLocalStorage<number>('rtm-speed', 1);
  const [volume, setVolume] = useLocalStorage<number>('rtm-volume', 1);
  const [isMuted, setIsMuted] = useLocalStorage<boolean>('rtm-muted', false);
  const [savedVoiceName, setSavedVoiceName] = useLocalStorage<string>(
    'rtm-voice',
    ''
  );
  const [themeMode, setThemeMode] = useLocalStorage<'light' | 'dark'>(
    'rtm-theme',
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );
  const [savedParagraphIndex, setSavedParagraphIndex] = useLocalStorage<number>(
    'rtm-paragraph-index',
    0
  );
  const [fontSize, setFontSize] = useLocalStorage<number>('rtm-font-size', 18);
  const [playbackEngine, setPlaybackEngine] = useLocalStorage<PlaybackEngine>(
    'rtm-playback-engine',
    'browser',
  );
  const [serverProvider, setServerProvider] = useLocalStorage<TtsChunkProvider>(
    'rtm-server-provider',
    'sapi',
  );
  const [serverVoice, setServerVoice] = useLocalStorage<string>(
    'rtm-server-voice',
    'Microsoft Zira Desktop',
  );

  return {
    text,
    setText,
    speed,
    setSpeed,
    volume,
    setVolume,
    isMuted,
    setIsMuted,
    savedVoiceName,
    setSavedVoiceName,
    themeMode,
    setThemeMode,
    savedParagraphIndex,
    setSavedParagraphIndex,
    fontSize,
    setFontSize,
    playbackEngine,
    setPlaybackEngine,
    serverProvider,
    setServerProvider,
    serverVoice,
    setServerVoice,
  };
}

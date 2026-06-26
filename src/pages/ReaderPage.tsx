import { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { Box, Alert } from '@mui/material';

import { useReaderSettings } from '../hooks/useReaderSettings';
import { useVoices } from '../hooks/useVoices';
import { useTTS } from '../hooks/useTTS';
import { useServerTTS } from '../hooks/useServerTTS';
import { useMediaSession } from '../hooks/useMediaSession';
import { useWakeLock } from '../hooks/useWakeLock';
import { parseText } from '../utils/textParser';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { chapterService } from '../services/chapterService';

import SideTab from '../components/layout/SideTab';
import PlaybackControls from '../components/playback/PlaybackControls';
import ReadingPane from '../components/reader/ReadingPane';
import ReaderBottomBar from '../components/reader/ReaderBottomBar';
import DownloadAudioModal from '../components/reader/DownloadAudioModal';
import ListenOfflinePlayer from '../components/reader/ListenOfflinePlayer';
import SettingsDrawer from '../components/settings/SettingsDrawer';
import { useReadingContext } from '../hooks/useReadingContext';
import { useProgressSaver } from '../hooks/useProgressSaver';
import type { NextChapterPrefetch } from '../hooks/useServerTTS';
import type { ListenOfflineJobConfig } from '../hooks/useListenOfflineJob';

const ReaderPage: React.FC = () => {
  const settings = useReaderSettings();
  const {
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
    savedParagraphIndex,
    setSavedParagraphIndex,
    fontSize,
    setFontSize,
    playbackEngine,
    setPlaybackEngine,
    serverProvider,
    setServerProvider,
  } = settings;

  const isServerMode = playbackEngine === 'server';
  const serverVoice =
    serverProvider === 'sapi' ? 'Microsoft Zira Desktop' : 'en-US-AriaNeural';

  // Stable ref for save callback — avoids circular hook dependency
  const saveRef = useRef<() => void>(() => {});
  const stableSave = useCallback(() => saveRef.current(), []);

  // — Auto-next-chapter toggle (shared with AppHeader / NavDrawer) —
  const [autoNextChapter] = useLocalStorage('rtm-auto-next-chapter', true);
  const autoNextRef = useRef(autoNextChapter);
  useEffect(() => { autoNextRef.current = autoNextChapter; }, [autoNextChapter]);

  // Flag: after auto-navigating, start playback once new paragraphs load
  const autoPlayPending = useRef(false);

  // — Reading context (book/chapter nav) —
  const { context: readingCtx, hasPrev, hasNext, goPrev, goNext, goToChapter } = useReadingContext(stableSave);
  const hasNextRef = useRef(hasNext);
  useEffect(() => { hasNextRef.current = hasNext; }, [hasNext]);
  const goNextRef = useRef(goNext);
  useEffect(() => { goNextRef.current = goNext; }, [goNext]);

  // — Drawer —
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [listenConfig, setListenConfig] = useState<ListenOfflineJobConfig | null>(null);
  const [listenPlayerOpen, setListenPlayerOpen] = useState(false);

  // — Derived —
  const paragraphs = useMemo(() => parseText(text), [text]);
  const hasText = paragraphs.length > 0;

  const cacheContext = useMemo(
    () => ({
      bookId: readingCtx?.bookId ?? 'manual',
      chapterId: readingCtx?.chapterId ?? `manual-${text.length}`,
    }),
    [readingCtx?.bookId, readingCtx?.chapterId, text.length],
  );

  // — Next chapter text prefetch (server mode) —
  const [nextChapterPrefetch, setNextChapterPrefetch] = useState<NextChapterPrefetch | null>(null);

  useEffect(() => {
    if (!isServerMode || !readingCtx || !hasNext) {
      setNextChapterPrefetch(null);
      return;
    }

    const nextChapter = readingCtx.chapters[readingCtx.chapters.findIndex((c) => c._id === readingCtx.chapterId) + 1];
    if (!nextChapter) {
      setNextChapterPrefetch(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const chapter = await chapterService.getById(nextChapter._id);
        if (cancelled) return;
        const nextParagraphs = parseText(chapter.content);
        if (nextParagraphs.length === 0) {
          setNextChapterPrefetch(null);
          return;
        }
        setNextChapterPrefetch({
          chapterId: nextChapter._id,
          paragraphText: nextParagraphs[0].text,
        });
      } catch {
        if (!cancelled) setNextChapterPrefetch(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isServerMode, readingCtx, hasNext]);

  // — Voices —
  const { voices, selectedVoice, selectVoice, isSupported } =
    useVoices(savedVoiceName);

  // — TTS (both hooks always called; active one selected by playbackEngine) —
  const playStartTime = useRef(0);
  const handleTTSEnd = useCallback(() => {
    if (Date.now() - playStartTime.current < 2000) return;
    if (autoNextRef.current && hasNextRef.current) {
      autoPlayPending.current = true;
      goNextRef.current();
    }
  }, []);

  const [browserState, browserControls] = useTTS({
    paragraphs,
    voice: selectedVoice,
    rate: speed,
    volume: isMuted ? 0 : volume,
    onEnd: handleTTSEnd,
  });

  const [serverState, serverControls] = useServerTTS({
    enabled: isServerMode,
    paragraphs,
    provider: serverProvider,
    voice: serverVoice,
    rate: speed,
    volume: isMuted ? 0 : volume,
    cacheContext,
    nextChapterPrefetch,
    onEnd: handleTTSEnd,
  });

  const ttsState = isServerMode ? serverState : browserState;
  const ttsControls = isServerMode ? serverControls : browserControls;
  const { status, currentParagraphIndex, currentWordIndex } = ttsState;

  const mediaSessionControls = useMemo(
    () => ({
      play: () => {
        if (status === 'paused') ttsControls.resume();
        else ttsControls.play();
      },
      pause: () => ttsControls.pause(),
      skipForward: () => ttsControls.skipForward(),
      skipBackward: () => ttsControls.skipBackward(),
    }),
    [ttsControls, status],
  );

  useMediaSession(
    isServerMode,
    {
      title: readingCtx?.chapterTitle ?? 'Reading',
      artist: readingCtx?.bookTitle ?? 'RTM Reader',
      album: readingCtx?.bookTitle,
    },
    mediaSessionControls,
    status === 'playing' || status === 'buffering',
  );

  // Track when playback actually starts (for auto-advance cooldown)
  useEffect(() => {
    if (status === 'playing' || status === 'buffering') {
      playStartTime.current = Date.now();
    }
  }, [status]);

  // — Save progress to backend on pause/stop —
  const { saveNow } = useProgressSaver(status, currentParagraphIndex, currentWordIndex);

  // Keep saveRef pointing at the latest saveNow
  useEffect(() => {
    saveRef.current = saveNow;
  }, [saveNow]);

  // — Wake lock —
  useWakeLock(status === 'playing' || status === 'buffering');

  // — Auto-play after chapter navigation —
  const prevChapterId = useRef(readingCtx?.chapterId);
  const ttsControlsRef = useRef(ttsControls);
  useEffect(() => { ttsControlsRef.current = ttsControls; }, [ttsControls]);

  useEffect(() => {
    const chId = readingCtx?.chapterId;
    if (chId && chId !== prevChapterId.current) {
      prevChapterId.current = chId;
      if (autoPlayPending.current && paragraphs.length > 0) {
        autoPlayPending.current = false;
        ttsControlsRef.current.play(0);
      }
    }
  }, [readingCtx?.chapterId, paragraphs]);

  // — Restore saved position on mount —
  useEffect(() => {
    if (status === 'idle' && savedParagraphIndex > 0 && paragraphs.length > 0) {
      ttsControls.jumpToParagraph(
        Math.min(savedParagraphIndex, paragraphs.length - 1)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // — Persist paragraph index —
  useEffect(() => {
    if (status !== 'idle') {
      setSavedParagraphIndex(currentParagraphIndex);
    }
  }, [currentParagraphIndex, status, setSavedParagraphIndex]);

  // — Auto-close drawer on play —
  useEffect(() => {
    if (status === 'playing' || status === 'buffering') setDrawerOpen(false);
  }, [status]);

  // — Handlers —
  const handleVoiceChange = useCallback(
    (voiceName: string) => {
      selectVoice(voiceName);
      setSavedVoiceName(voiceName);
    },
    [selectVoice, setSavedVoiceName]
  );

  const handleTextChange = useCallback(
    (newText: string) => {
      setText(newText);
      if (status !== 'idle') ttsControls.stop();
    },
    [setText, status, ttsControls]
  );

  const handleClear = useCallback(() => {
    setText('');
    ttsControls.stop();
    setSavedParagraphIndex(0);
  }, [setText, ttsControls, setSavedParagraphIndex]);

  const handleMuteToggle = useCallback(
    () => setIsMuted((prev) => !prev),
    [setIsMuted]
  );

  const handleParagraphClick = useCallback(
    (index: number) => {
      if (status !== 'playing' && status !== 'buffering') ttsControls.jumpToParagraph(index);
    },
    [status, ttsControls]
  );

  const handleListenOffline = useCallback((config: ListenOfflineJobConfig) => {
    setListenConfig(config);
    setListenPlayerOpen(true);
  }, []);

  const handleCloseListenPlayer = useCallback(() => {
    setListenPlayerOpen(false);
    setListenConfig(null);
  }, []);

  const statusHint =
    isServerMode && status === 'buffering' ? 'Buffering…' : undefined;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {!isServerMode && !isSupported && (
        <Alert severity="error" sx={{ mx: 2, mt: 2 }}>
          Your browser does not support the Web Speech API. Please use Chrome or
          Edge for the best experience, or switch to Server (Zira) playback in Settings.
        </Alert>
      )}

      <PlaybackControls
        status={status}
        hasText={hasText}
        onPlay={ttsControls.play}
        onPause={ttsControls.pause}
        onResume={ttsControls.resume}
        onStop={ttsControls.stop}
        onReset={ttsControls.reset}
        onSkipForward={ttsControls.skipForward}
        onSkipBackward={ttsControls.skipBackward}
        voices={voices}
        selectedVoiceName={selectedVoice?.name ?? ''}
        onVoiceChange={handleVoiceChange}
        speed={speed}
        onSpeedChange={setSpeed}
        volume={volume}
        onVolumeChange={setVolume}
        isMuted={isMuted}
        onMuteToggle={handleMuteToggle}
        showVoicePicker={!isServerMode}
        statusHint={statusHint}
      />

      <Box sx={{ flexGrow: 1, overflow: 'auto', position: 'relative', minHeight: 0 }}>
        <SideTab
          visible={!drawerOpen}
          onClick={() => setDrawerOpen(true)}
          side="left"
        />

        <ReadingPane
          paragraphs={paragraphs}
          currentParagraphIndex={currentParagraphIndex}
          currentWordIndex={isServerMode ? -1 : currentWordIndex}
          status={status}
          onParagraphClick={handleParagraphClick}
          fontSize={fontSize}
        />
      </Box>

      <SettingsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        text={text}
        onTextChange={handleTextChange}
        onClear={handleClear}
        textDisabled={status === 'playing' || status === 'buffering'}
        status={status}
        onPlay={ttsControls.play}
        onStop={ttsControls.stop}
        hasText={hasText}
        voices={voices}
        selectedVoiceName={selectedVoice?.name ?? ''}
        onVoiceChange={handleVoiceChange}
        speed={speed}
        onSpeedChange={setSpeed}
        volume={volume}
        onVolumeChange={setVolume}
        isMuted={isMuted}
        onMuteToggle={handleMuteToggle}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        playbackEngine={playbackEngine}
        onPlaybackEngineChange={setPlaybackEngine}
        serverProvider={serverProvider}
        onServerProviderChange={setServerProvider}
      />

      <ReaderBottomBar
        chapters={readingCtx?.chapters ?? []}
        currentChapterId={readingCtx?.chapterId ?? null}
        hasPrev={hasPrev}
        hasNext={hasNext}
        isPlaying={status === 'playing' || status === 'buffering'}
        onPrev={goPrev}
        onNext={goNext}
        onChapterSelect={goToChapter}
        onDownloadAudio={() => setDownloadModalOpen(true)}
      />

      {readingCtx && (
        <DownloadAudioModal
          open={downloadModalOpen}
          onClose={() => setDownloadModalOpen(false)}
          bookId={readingCtx.bookId}
          bookTitle={readingCtx.bookTitle}
          chapters={readingCtx.chapters}
          currentChapterNumber={readingCtx.chapterNumber}
          onListenOffline={handleListenOffline}
        />
      )}

      <ListenOfflinePlayer
        open={listenPlayerOpen}
        config={listenConfig}
        onClose={handleCloseListenPlayer}
      />
    </Box>
  );
};

export default ReaderPage;

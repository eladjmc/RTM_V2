import { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { Box, Alert } from '@mui/material';

import { useReaderSettings } from '../hooks/useReaderSettings';
import { useVoices } from '../hooks/useVoices';
import { useTTS } from '../hooks/useTTS';
import { useWakeLock } from '../hooks/useWakeLock';
import { parseText } from '../utils/textParser';
import { useLocalStorage } from '../hooks/useLocalStorage';

import SideTab from '../components/layout/SideTab';
import PlaybackControls from '../components/playback/PlaybackControls';
import ReadingPane from '../components/reader/ReadingPane';
import ReaderBottomBar from '../components/reader/ReaderBottomBar';
import DownloadAudioModal from '../components/reader/DownloadAudioModal';
import SettingsDrawer from '../components/settings/SettingsDrawer';
import { useReadingContext } from '../hooks/useReadingContext';
import { useProgressSaver } from '../hooks/useProgressSaver';

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
  } = settings;

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

  // — Derived —
  const paragraphs = useMemo(() => parseText(text), [text]);
  const hasText = paragraphs.length > 0;

  // — Voices —
  const { voices, selectedVoice, selectVoice, isSupported } =
    useVoices(savedVoiceName);

  // — TTS —
  const handleTTSEnd = useCallback(() => {
    if (autoNextRef.current && hasNextRef.current) {
      autoPlayPending.current = true;
      goNextRef.current();
    }
  }, []);

  const [ttsState, ttsControls] = useTTS({
    paragraphs,
    voice: selectedVoice,
    rate: speed,
    volume: isMuted ? 0 : volume,
    onEnd: handleTTSEnd,
  });

  const { status, currentParagraphIndex, currentWordIndex } = ttsState;

  // — Save progress to backend on pause/stop —
  const { saveNow } = useProgressSaver(status, currentParagraphIndex, currentWordIndex);

  // Keep saveRef pointing at the latest saveNow
  useEffect(() => {
    saveRef.current = saveNow;
  }, [saveNow]);

  // — Wake lock —
  useWakeLock(status === 'playing');

  // — Auto-play after chapter navigation —
  const prevChapterId = useRef(readingCtx?.chapterId);
  useEffect(() => {
    const chId = readingCtx?.chapterId;
    if (chId && chId !== prevChapterId.current) {
      prevChapterId.current = chId;
      if (autoPlayPending.current && paragraphs.length > 0) {
        autoPlayPending.current = false;
        // Reset to paragraph 0 then play — prevents speakFrom using stale index
        ttsControls.jumpToParagraph(0);
        setTimeout(() => ttsControls.play(), 100);
      }
    }
  }, [readingCtx?.chapterId, paragraphs, ttsControls]);

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
    if (status === 'playing') setDrawerOpen(false);
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
      if (status !== 'playing') ttsControls.jumpToParagraph(index);
    },
    [status, ttsControls]
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {!isSupported && (
        <Alert severity="error" sx={{ mx: 2, mt: 2 }}>
          Your browser does not support the Web Speech API. Please use Chrome or
          Edge for the best experience.
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
          currentWordIndex={currentWordIndex}
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
        textDisabled={status === 'playing'}
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
      />

      <ReaderBottomBar
        chapters={readingCtx?.chapters ?? []}
        currentChapterId={readingCtx?.chapterId ?? null}
        hasPrev={hasPrev}
        hasNext={hasNext}
        isPlaying={status === 'playing'}
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
        />
      )}
    </Box>
  );
};

export default ReaderPage;

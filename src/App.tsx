import { useMemo, useCallback, useEffect, useState } from 'react';
import {
  ThemeProvider,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  DarkMode,
  LightMode,
  ChevronRight,
} from '@mui/icons-material';

import { lightTheme, darkTheme } from './theme';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useVoices } from './hooks/useVoices';
import { useTTS } from './hooks/useTTS';
import { parseText } from './utils/textParser';

import PlaybackControls from './components/PlaybackControls';
import ReadingPane from './components/ReadingPane';
import SettingsDrawer from './components/SettingsDrawer';

function App() {
  // — Persisted settings —
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
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  );
  const [savedParagraphIndex, setSavedParagraphIndex] = useLocalStorage<number>(
    'rtm-paragraph-index',
    0
  );
  const [fontSize, setFontSize] = useLocalStorage<number>('rtm-font-size', 18);

  // — Drawer state —
  const [drawerOpen, setDrawerOpen] = useState(false);

  // — Derived state —
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const paragraphs = useMemo(() => parseText(text), [text]);
  const hasText = paragraphs.length > 0;

  // — Voices —
  const {
    voices,
    selectedVoice,
    selectVoice,
    isSupported,
  } = useVoices(savedVoiceName);

  // — TTS —
  const [ttsState, ttsControls] = useTTS({
    paragraphs,
    voice: selectedVoice,
    rate: speed,
    volume: isMuted ? 0 : volume,
  });

  const { status, currentParagraphIndex, currentWordIndex } = ttsState;

  // Restore saved paragraph index when paragraphs change
  useEffect(() => {
    if (status === 'idle' && savedParagraphIndex > 0 && paragraphs.length > 0) {
      ttsControls.jumpToParagraph(
        Math.min(savedParagraphIndex, paragraphs.length - 1)
      );
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist paragraph index
  useEffect(() => {
    if (status !== 'idle') {
      setSavedParagraphIndex(currentParagraphIndex);
    }
  }, [currentParagraphIndex, status, setSavedParagraphIndex]);

  // Auto-close drawer when playing
  useEffect(() => {
    if (status === 'playing') {
      setDrawerOpen(false);
    }
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
      if (status !== 'idle') {
        ttsControls.stop();
      }
    },
    [setText, status, ttsControls]
  );

  const handleClear = useCallback(() => {
    setText('');
    ttsControls.stop();
    setSavedParagraphIndex(0);
  }, [setText, ttsControls, setSavedParagraphIndex]);

  const handleMuteToggle = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, [setIsMuted]);

  const handleThemeToggle = useCallback(() => {
    setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, [setThemeMode]);

  const handleParagraphClick = useCallback(
    (index: number) => {
      if (status !== 'playing') {
        ttsControls.jumpToParagraph(index);
      }
    },
    [status, ttsControls]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        {/* App Bar */}
        <AppBar position="sticky" color="default" elevation={1}>
          <Toolbar variant="dense" sx={{ justifyContent: 'space-between' }}>
            <Typography
              variant="h6"
              component="h1"
              sx={{ fontWeight: 700, letterSpacing: '-0.5px' }}
            >
              RTM — Read To Me
            </Typography>

            <Tooltip title={themeMode === 'light' ? 'Dark mode' : 'Light mode'}>
              <IconButton onClick={handleThemeToggle} aria-label="Toggle theme">
                {themeMode === 'light' ? <DarkMode /> : <LightMode />}
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        {/* Browser support warning */}
        {!isSupported && (
          <Alert severity="error" sx={{ mx: 2, mt: 2 }}>
            Your browser does not support the Web Speech API. Please use Chrome
            or Edge for the best experience.
          </Alert>
        )}

        {/* Playback Controls */}
        <PlaybackControls
          status={status}
          onPlay={ttsControls.play}
          onPause={ttsControls.pause}
          onResume={ttsControls.resume}
          onStop={ttsControls.stop}
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
          hasText={hasText}
        />

        {/* Reading Pane */}
        <Box sx={{ flexGrow: 1, overflow: 'auto', position: 'relative' }}>
          {/* Drawer side tab */}
          <Box
            onClick={() => setDrawerOpen(true)}
            sx={{
              position: 'fixed',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: (t) => t.zIndex.drawer - 1,
              display: drawerOpen ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 64,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              borderRadius: '0 8px 8px 0',
              cursor: 'pointer',
              opacity: 0.7,
              transition: 'opacity 0.2s, width 0.2s',
              '&:hover': {
                opacity: 1,
                width: 30,
              },
            }}
            aria-label="Open panel"
          >
            <ChevronRight fontSize="small" />
          </Box>

          <ReadingPane
            paragraphs={paragraphs}
            currentParagraphIndex={currentParagraphIndex}
            currentWordIndex={currentWordIndex}
            status={status}
            onParagraphClick={handleParagraphClick}
            fontSize={fontSize}
          />
        </Box>

        {/* Settings Drawer */}
        <SettingsDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          text={text}
          onTextChange={handleTextChange}
          onClear={handleClear}
          textDisabled={status !== 'idle'}
          onPlay={ttsControls.play}
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
      </Box>
    </ThemeProvider>
  );
}

export default App;

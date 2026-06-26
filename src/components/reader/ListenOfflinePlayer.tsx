import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  LinearProgress,
  Stack,
  Alert,
  Button,
  Slider,
  Snackbar,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Close,
  Pause,
  PlayArrow,
  SkipNext,
  SkipPrevious,
  Replay,
  Forward10,
  Bookmark,
  Download,
} from '@mui/icons-material';
import {
  useListenOfflineJob,
  type ListenOfflineJobConfig,
} from '../../hooks/useListenOfflineJob';
import { useMediaSession } from '../../hooks/useMediaSession';
import { bookService } from '../../services/bookService';
import {
  getListenPosition,
  saveListenPosition,
} from '../../services/listenPlaybackPosition';
import { listenJobService } from '../../services/listenJobService';

const SEEK_STEP_SEC = 20;
const POSITION_SAVE_INTERVAL_MS = 5000;

interface ListenOfflinePlayerProps {
  open: boolean;
  config: ListenOfflineJobConfig | null;
  onClose: () => void;
}

export default function ListenOfflinePlayer({
  open,
  config,
  onClose,
}: ListenOfflinePlayerProps) {
  const { state, fetchChapterAudio } = useListenOfflineJob(open ? config : null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const playSessionRef = useRef(0);
  const pendingSeekRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const resumeAppliedRef = useRef(false);
  const lastPlayedIndexRef = useRef<number | null>(null);
  const lastPositionSaveRef = useRef(0);
  const isScrubbingRef = useRef(false);

  const [playingIndex, setPlayingIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [scrubValue, setScrubValue] = useState(0);
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });
  const [downloadingCombined, setDownloadingCombined] = useState(false);

  const currentChapter = state.chapters[playingIndex] ?? null;

  const progressPct =
    state.totalCount > 0 ? (state.readyCount / state.totalCount) * 100 : 0;

  const showToast = useCallback((message: string, severity: 'success' | 'error') => {
    setToast({ open: true, message, severity });
  }, []);

  const releaseObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const persistListenPosition = useCallback(() => {
    if (!config || !currentChapter) return;
    const audio = audioRef.current;
    const time = audio?.currentTime ?? currentTime;
    saveListenPosition({
      bookId: config.bookId,
      chapterNumber: currentChapter.chapterNumber,
      currentTime: time,
      provider: config.provider,
      voice: config.voice,
      rate: config.rate,
    });
  }, [config, currentChapter, currentTime]);

  const saveBookProgress = useCallback(async (): Promise<boolean> => {
    if (!config || !currentChapter) return false;
    const chapterId = config.chapterIds.get(currentChapter.chapterNumber);
    if (!chapterId) return false;

    try {
      await bookService.saveProgress(config.bookId, {
        chapterId,
        chapterNumber: currentChapter.chapterNumber,
        paragraphIndex: 0,
        wordIndex: -1,
      });
      return true;
    } catch {
      return false;
    }
  }, [config, currentChapter]);

  const saveProgressWithToast = useCallback(async () => {
    const ok = await saveBookProgress();
    if (ok && currentChapter) {
      showToast(`Saved at chapter ${currentChapter.chapterNumber}`, 'success');
    } else {
      showToast("Couldn't save progress — check connection", 'error');
    }
  }, [saveBookProgress, currentChapter, showToast]);

  const stopAudio = useCallback(() => {
    playSessionRef.current += 1;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.onended = null;
      audio.onerror = null;
      audio.ontimeupdate = null;
      audio.onloadedmetadata = null;
      audio.removeAttribute('src');
      audio.load();
    }
    releaseObjectUrl();
    setIsPlaying(false);
    setCurrentTime(0);
    setScrubValue(0);
    setDuration(0);
  }, [releaseObjectUrl]);

  const applyPendingSeek = useCallback((audio: HTMLAudioElement, session: number) => {
    const seekTo = pendingSeekRef.current;
    if (seekTo != null && seekTo > 0) {
      const max = audio.duration || seekTo;
      audio.currentTime = Math.min(seekTo, max);
      pendingSeekRef.current = null;
    }
    if (session === playSessionRef.current) {
      setDuration(audio.duration || 0);
      setCurrentTime(audio.currentTime);
      setScrubValue(audio.currentTime);
    }
  }, []);

  const playChapterAtIndex = useCallback(
    async (index: number) => {
      const chapter = state.chapters[index];
      if (!chapter) return;

      if (chapter.status !== 'ready') {
        setIsWaiting(true);
        return;
      }

      let blob: Blob;
      try {
        blob = await fetchChapterAudio(chapter.chapterNumber);
      } catch {
        setIsWaiting(true);
        return;
      }

      playSessionRef.current += 1;
      const session = playSessionRef.current;

      stopAudio();
      playSessionRef.current = session;

      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = url;
      audio.volume = 1;

      audio.onloadedmetadata = () => {
        applyPendingSeek(audio, session);
      };
      audio.ontimeupdate = () => {
        if (session !== playSessionRef.current || isScrubbingRef.current) return;
        setCurrentTime(audio.currentTime);
        setScrubValue(audio.currentTime);

        const now = Date.now();
        if (now - lastPositionSaveRef.current >= POSITION_SAVE_INTERVAL_MS) {
          lastPositionSaveRef.current = now;
          if (config && chapter) {
            saveListenPosition({
              bookId: config.bookId,
              chapterNumber: chapter.chapterNumber,
              currentTime: audio.currentTime,
              provider: config.provider,
              voice: config.voice,
              rate: config.rate,
            });
          }
        }
      };
      audio.onended = () => {
        if (session !== playSessionRef.current) return;
        setIsPlaying(false);
        setCurrentTime(0);
        setScrubValue(0);
        if (config) {
          saveListenPosition({
            bookId: config.bookId,
            chapterNumber: chapter.chapterNumber,
            currentTime: 0,
            provider: config.provider,
            voice: config.voice,
            rate: config.rate,
          });
        }
        if (index + 1 < state.chapters.length) {
          pendingSeekRef.current = null;
          lastPlayedIndexRef.current = null;
          setPlayingIndex(index + 1);
        }
      };
      audio.onerror = () => {
        if (session !== playSessionRef.current) return;
        setIsPlaying(false);
        setIsWaiting(false);
      };

      setIsWaiting(false);
      try {
        await audio.play();
        if (session === playSessionRef.current) {
          setIsPlaying(true);
          lastPositionSaveRef.current = Date.now();
        }
      } catch {
        if (session === playSessionRef.current) {
          setIsPlaying(false);
        }
      }
    },
    [applyPendingSeek, config, fetchChapterAudio, state.chapters, stopAudio],
  );

  // Resume saved position or start at first chapter
  useEffect(() => {
    if (!open || startedRef.current || state.chapters.length === 0) return;

    if (!resumeAppliedRef.current && config) {
      resumeAppliedRef.current = true;
      const saved = getListenPosition(
        config.bookId,
        config.provider,
        config.voice,
        config.rate,
      );
      if (
        saved &&
        saved.chapterNumber >= config.startChapter &&
        saved.chapterNumber <= config.endChapter &&
        saved.currentTime > 0
      ) {
        const idx = state.chapters.findIndex(
          (ch) => ch.chapterNumber === saved.chapterNumber,
        );
        if (idx >= 0) {
          pendingSeekRef.current = saved.currentTime;
          setPlayingIndex(idx);
          return;
        }
      }
    }

    const chapter = state.chapters[playingIndex];
    if (chapter?.status === 'ready') {
      startedRef.current = true;
      lastPlayedIndexRef.current = playingIndex;
      playChapterAtIndex(playingIndex);
    }
  }, [open, config, state.chapters, playingIndex, playChapterAtIndex]);

  useEffect(() => {
    if (!open || !startedRef.current) return;
    if (lastPlayedIndexRef.current === playingIndex) return;
    lastPlayedIndexRef.current = playingIndex;
    playChapterAtIndex(playingIndex);
  }, [open, playingIndex, playChapterAtIndex]);

  useEffect(() => {
    if (!open || !isWaiting || !currentChapter) return;
    if (currentChapter.status === 'ready') {
      playChapterAtIndex(playingIndex);
    }
  }, [open, isWaiting, currentChapter, playingIndex, playChapterAtIndex]);

  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      resumeAppliedRef.current = false;
      lastPlayedIndexRef.current = null;
      pendingSeekRef.current = null;
      setPlayingIndex(0);
      setIsWaiting(false);
      stopAudio();
    }
  }, [open, stopAudio]);

  const seekRelative = useCallback(
    (delta: number) => {
      const audio = audioRef.current;
      if (!audio?.src) return;
      const max = audio.duration || duration;
      const next = Math.max(0, Math.min(max, audio.currentTime + delta));
      audio.currentTime = next;
      setCurrentTime(next);
      setScrubValue(next);
      persistListenPosition();
    },
    [duration, persistListenPosition],
  );

  const handleScrubChange = useCallback((_: unknown, value: number | number[]) => {
    isScrubbingRef.current = true;
    const v = value as number;
    setScrubValue(v);
    setCurrentTime(v);
  }, []);

  const handleScrubCommit = useCallback(
    (_: unknown, value: number | number[]) => {
      isScrubbingRef.current = false;
      const v = value as number;
      const audio = audioRef.current;
      if (audio?.src) {
        audio.currentTime = v;
      }
      setCurrentTime(v);
      setScrubValue(v);
      persistListenPosition();
    },
    [persistListenPosition],
  );

  const handleClose = useCallback(() => {
    persistListenPosition();
    saveBookProgress().then((ok) => {
      if (!ok) {
        showToast("Couldn't save progress — check connection", 'error');
      }
    });
    stopAudio();
    onClose();
  }, [
    onClose,
    persistListenPosition,
    saveBookProgress,
    showToast,
    stopAudio,
  ]);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentChapter) return;

    if (isPlaying && !audio.paused) {
      audio.pause();
      setIsPlaying(false);
      persistListenPosition();
      saveBookProgress().then((ok) => {
        if (ok) {
          showToast(`Saved at chapter ${currentChapter.chapterNumber}`, 'success');
        } else {
          showToast("Couldn't save progress — check connection", 'error');
        }
      });
      return;
    }

    if (currentChapter.status !== 'ready') {
      setIsWaiting(true);
      startedRef.current = true;
      return;
    }

    if (!audio.src) {
      startedRef.current = true;
      playChapterAtIndex(playingIndex);
      return;
    }

    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }, [
    currentChapter,
    isPlaying,
    persistListenPosition,
    playChapterAtIndex,
    playingIndex,
    saveBookProgress,
    showToast,
  ]);

  const skipNext = useCallback(() => {
    if (playingIndex + 1 >= state.chapters.length) return;
    persistListenPosition();
    startedRef.current = true;
    stopAudio();
    pendingSeekRef.current = null;
    lastPlayedIndexRef.current = null;
    setPlayingIndex((i) => i + 1);
  }, [persistListenPosition, playingIndex, state.chapters.length, stopAudio]);

  const skipPrev = useCallback(() => {
    if (playingIndex <= 0) return;
    persistListenPosition();
    startedRef.current = true;
    stopAudio();
    pendingSeekRef.current = null;
    lastPlayedIndexRef.current = null;
    setPlayingIndex((i) => i - 1);
  }, [persistListenPosition, playingIndex, stopAudio]);

  const seekBack20 = useCallback(() => seekRelative(-SEEK_STEP_SEC), [seekRelative]);
  const seekForward20 = useCallback(() => seekRelative(SEEK_STEP_SEC), [seekRelative]);

  const handleDownloadCombined = useCallback(async () => {
    if (!config || !state.combinedReady) return;
    setDownloadingCombined(true);
    try {
      await listenJobService.downloadCombined(config.jobId);
      showToast('Download started', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to download combined audio';
      showToast(msg, 'error');
    } finally {
      setDownloadingCombined(false);
    }
  }, [config, showToast, state.combinedReady]);

  const mediaControls = useMemo(
    () => ({
      play: togglePlayPause,
      pause: togglePlayPause,
      skipForward: skipNext,
      skipBackward: skipPrev,
      seekBack: seekBack20,
      seekForward: seekForward20,
    }),
    [togglePlayPause, skipNext, skipPrev, seekBack20, seekForward20],
  );

  useMediaSession(
    open,
    {
      title: currentChapter
        ? `Ch ${currentChapter.chapterNumber}: ${currentChapter.title}`
        : config?.bookTitle,
      artist: config?.bookTitle ?? 'RTM Reader',
      album: config?.bookTitle,
    },
    mediaControls,
    isPlaying,
  );

  const formatTime = (sec: number) => {
    if (!Number.isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const scrubMax = duration > 0 ? duration : Math.max(scrubValue, 1);

  return (
    <>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', pr: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" noWrap>
              Listen offline
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {config?.bookTitle}
            </Typography>
          </Box>
          <IconButton onClick={handleClose} aria-label="Close">
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2.5}>
            {currentChapter && (
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  Chapter {currentChapter.chapterNumber}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {currentChapter.title}
                </Typography>
              </Box>
            )}

            <Box>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  Ready {state.readyCount} / {state.totalCount} chapters
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {state.complete
                    ? 'All chapters ready'
                    : state.loadingChapter
                      ? `Loading ch ${state.loadingChapter}…`
                      : 'Preparing…'}
                </Typography>
              </Stack>
              <LinearProgress variant="determinate" value={progressPct} sx={{ mb: 1 }} />
              {isWaiting && (
                <Typography variant="caption" color="text.secondary">
                  Waiting for next chapter audio…
                </Typography>
              )}
            </Box>

            <Box>
              <Slider
                size="small"
                value={Math.min(scrubValue, scrubMax)}
                min={0}
                max={scrubMax}
                step={0.1}
                onChange={handleScrubChange}
                onChangeCommitted={handleScrubCommit}
                disabled={!duration && !currentTime}
                aria-label="Chapter progress"
              />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption">{formatTime(currentTime)}</Typography>
                <Typography variant="caption">{formatTime(duration)}</Typography>
              </Stack>
            </Box>

            <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
              <Tooltip title="Back 20 seconds">
                <IconButton onClick={seekBack20} size="small">
                  <Replay sx={{ transform: 'scaleX(-1)' }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Previous chapter">
                <span>
                  <IconButton onClick={skipPrev} disabled={playingIndex <= 0} size="small">
                    <SkipPrevious />
                  </IconButton>
                </span>
              </Tooltip>
              <IconButton
                onClick={togglePlayPause}
                color="primary"
                sx={{
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': { bgcolor: 'primary.dark' },
                  width: 56,
                  height: 56,
                  mx: 0.5,
                }}
              >
                {isPlaying ? <Pause /> : <PlayArrow />}
              </IconButton>
              <Tooltip title="Next chapter">
                <span>
                  <IconButton
                    onClick={skipNext}
                    disabled={playingIndex + 1 >= state.chapters.length}
                    size="small"
                  >
                    <SkipNext />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Forward 20 seconds">
                <IconButton onClick={seekForward20} size="small">
                  <Forward10 />
                </IconButton>
              </Tooltip>
            </Stack>

            <Button
              variant="outlined"
              startIcon={<Bookmark />}
              onClick={saveProgressWithToast}
              disabled={!currentChapter}
              fullWidth
            >
              Save progress in book
            </Button>

            {state.error && <Alert severity="error">{state.error}</Alert>}

            {state.complete && (
              <Alert severity="success">
                All chapters ready. You can keep listening or download one combined file.
              </Alert>
            )}

            {(state.complete || state.readyCount > 0) && (
              <Button
                variant="contained"
                startIcon={
                  downloadingCombined ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <Download />
                  )
                }
                onClick={handleDownloadCombined}
                disabled={!state.combinedReady || downloadingCombined}
                fullWidth
              >
                {state.combinedReady
                  ? downloadingCombined
                    ? 'Downloading…'
                    : 'Download combined MP3'
                  : 'Preparing combined download…'}
              </Button>
            )}

            <Button variant="text" onClick={handleClose} fullWidth>
              Close player
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </>
  );
}

import { useEffect, useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Slider,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Stack,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import { Close, Download, Headphones } from '@mui/icons-material';
import type { ChapterSummary } from '../../types/models';
import {
  ttsService,
  type TtsVoice,
  type TtsErrorResponse,
} from '../../services/ttsService';
import { listenJobService } from '../../services/listenJobService';
import type { ListenOfflineJobConfig } from '../../hooks/useListenOfflineJob';

interface DownloadAudioModalProps {
  open: boolean;
  onClose: () => void;
  bookId: string;
  bookTitle: string;
  chapters: ChapterSummary[];
  currentChapterNumber: number;
  onListenOffline: (config: ListenOfflineJobConfig) => void;
}

export default function DownloadAudioModal({
  open,
  onClose,
  bookId,
  bookTitle,
  chapters,
  currentChapterNumber,
  onListenOffline,
}: DownloadAudioModalProps) {
  const [provider, setProvider] = useState<'edge' | 'sapi'>('sapi');
  const [startChapter, setStartChapter] = useState(currentChapterNumber);
  const [endChapter, setEndChapter] = useState(currentChapterNumber);
  const [voice, setVoice] = useState('en-US-AriaNeural');
  const [rate, setRate] = useState(1.25);
  const [voices, setVoices] = useState<TtsVoice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);

  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<'download' | 'listen' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chapterErrors, setChapterErrors] = useState<TtsErrorResponse['chapters']>(undefined);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setStartChapter(currentChapterNumber);
      setEndChapter(currentChapterNumber);
      setProvider('sapi');
      setRate(1.25);
      setError(null);
      setChapterErrors(undefined);
      setSuccess(false);
      setBusy(false);
      setBusyAction(null);
    }
  }, [open, currentChapterNumber]);

  useEffect(() => {
    if (!open || voices.length > 0) return;
    setLoadingVoices(true);
    ttsService
      .getVoices()
      .then(setVoices)
      .catch(() => {})
      .finally(() => setLoadingVoices(false));
  }, [open, voices.length]);

  const sorted = useMemo(
    () => [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber),
    [chapters],
  );

  const endOptions = useMemo(
    () => sorted.filter((ch) => ch.chapterNumber >= startChapter),
    [sorted, startChapter],
  );

  useEffect(() => {
    if (endChapter < startChapter) {
      setEndChapter(startChapter);
    }
  }, [startChapter, endChapter]);

  const chapterCount = endChapter - startChapter + 1;
  const resolvedVoice = provider === 'sapi' ? 'Microsoft Zira Desktop' : voice;

  const buildChapterTitles = () => {
    const map = new Map<number, string>();
    for (const ch of sorted) {
      if (ch.chapterNumber >= startChapter && ch.chapterNumber <= endChapter) {
        map.set(ch.chapterNumber, ch.title);
      }
    }
    return map;
  };

  const buildChapterIds = () => {
    const map = new Map<number, string>();
    for (const ch of sorted) {
      if (ch.chapterNumber >= startChapter && ch.chapterNumber <= endChapter) {
        map.set(ch.chapterNumber, ch._id);
      }
    }
    return map;
  };

  const handleDownload = async () => {
    setError(null);
    setChapterErrors(undefined);
    setSuccess(false);
    setBusy(true);
    setBusyAction('download');

    try {
      await ttsService.downloadAudio(bookId, {
        startChapterNumber: startChapter,
        chapterCount,
        voice: resolvedVoice,
        rate,
        provider,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const e = err as Error & { data?: TtsErrorResponse };
      setError(e.message || 'Download failed');
      if (e.data?.chapters) {
        setChapterErrors(e.data.chapters);
      }
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  };

  const handleListenOffline = async () => {
    setError(null);
    setChapterErrors(undefined);
    setSuccess(false);
    setBusy(true);
    setBusyAction('listen');

    try {
      const job = await listenJobService.createJob({
        bookId,
        startChapterNumber: startChapter,
        chapterCount,
        voice: resolvedVoice,
        rate,
        provider,
      });

      onListenOffline({
        jobId: job.jobId,
        bookId,
        bookTitle,
        startChapter,
        endChapter,
        chapterTitles: buildChapterTitles(),
        chapterIds: buildChapterIds(),
        provider,
        voice: resolvedVoice,
        rate,
      });
      onClose();
    } catch (err: unknown) {
      const e = err as Error & { data?: TtsErrorResponse };
      setError(e.message || 'Failed to start listen job');
      if (e.data?.chapters) {
        setChapterErrors(e.data.chapters);
      }
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Audio
        <IconButton edge="end" onClick={onClose} disabled={busy} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Book: <strong>{bookTitle}</strong>
          </Typography>

          <Stack direction="row" spacing={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>From chapter</InputLabel>
              <Select
                label="From chapter"
                value={startChapter}
                onChange={(e) => setStartChapter(Number(e.target.value))}
                disabled={busy}
                MenuProps={{ PaperProps: { sx: { maxHeight: 250 } } }}
              >
                {sorted.map((ch) => (
                  <MenuItem key={ch._id} value={ch.chapterNumber}>
                    {ch.chapterNumber}. {ch.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
              <InputLabel>To chapter</InputLabel>
              <Select
                label="To chapter"
                value={endChapter}
                onChange={(e) => setEndChapter(Number(e.target.value))}
                disabled={busy}
                MenuProps={{ PaperProps: { sx: { maxHeight: 250 } } }}
              >
                {endOptions.map((ch) => (
                  <MenuItem key={ch._id} value={ch.chapterNumber}>
                    {ch.chapterNumber}. {ch.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {chapterCount} chapter{chapterCount !== 1 ? 's' : ''} selected
          </Typography>

          <Box>
            <Typography variant="body2" gutterBottom>
              Voice Engine
            </Typography>
            <ToggleButtonGroup
              value={provider}
              exclusive
              onChange={(_, val) => { if (val) setProvider(val); }}
              size="small"
              fullWidth
              disabled={busy}
            >
              <ToggleButton value="sapi">Zira (SAPI)</ToggleButton>
              <ToggleButton value="edge">Edge (Neural)</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {provider === 'edge' && (
            <FormControl size="small" fullWidth>
              <InputLabel>Voice</InputLabel>
              <Select
                label="Voice"
                value={voices.length > 0 ? voice : ''}
                onChange={(e) => setVoice(e.target.value)}
                disabled={busy || loadingVoices}
                MenuProps={{ PaperProps: { sx: { maxHeight: 250 } } }}
              >
                {voices.map((v) => (
                  <MenuItem key={v.ShortName} value={v.ShortName}>
                    {v.FriendlyName.replace('Microsoft ', '').replace(' Online (Natural) - English (United States)', '')} ({v.Gender})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {provider === 'sapi' && (
            <Alert severity="info" sx={{ py: 0.5 }}>
              Uses Microsoft Zira — a classic, clear desktop voice via Windows SAPI.
            </Alert>
          )}

          <Box>
            <Typography variant="body2" gutterBottom>
              Speed: {rate.toFixed(2)}x
            </Typography>
            <Slider
              value={rate}
              onChange={(_, v) => setRate(v as number)}
              min={0.5}
              max={2.0}
              step={0.05}
              disabled={busy}
              marks={[
                { value: 0.5, label: '0.5x' },
                { value: 1.0, label: '1x' },
                { value: 1.5, label: '1.5x' },
                { value: 2.0, label: '2x' },
              ]}
              size="small"
            />
          </Box>

          <Alert severity="info" sx={{ py: 0.5 }}>
            <strong>Listen offline</strong> synthesizes on the server and starts playback as chapters finish.
            <strong> Download MP3</strong> waits for the full range, then saves one file.
          </Alert>

          {error && (
            <Alert severity="error" sx={{ whiteSpace: 'pre-line' }}>
              {error}
              {chapterErrors && chapterErrors.length > 0 && (
                <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
                  {chapterErrors.map((ch) => (
                    <li key={ch.chapterNumber}>
                      Chapter {ch.chapterNumber} ({ch.title}) — {ch.characters.toLocaleString()} characters
                    </li>
                  ))}
                </Box>
              )}
            </Alert>
          )}

          {success && (
            <Alert severity="success">
              Audio generated successfully! Your download should start automatically.
            </Alert>
          )}

          {busy && busyAction === 'download' && (
            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center">
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Generating audio for {chapterCount} chapter{chapterCount !== 1 ? 's' : ''}…
              </Typography>
            </Stack>
          )}

          {busy && busyAction === 'listen' && (
            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center">
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Starting listen job…
              </Typography>
            </Stack>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 2, py: 1.5 }}>
        <Button onClick={onClose} disabled={busy}>
          Close
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="outlined"
          startIcon={
            busy && busyAction === 'listen' ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <Headphones />
            )
          }
          onClick={handleListenOffline}
          disabled={busy || chapters.length === 0}
        >
          {busy && busyAction === 'listen' ? 'Starting…' : 'Listen offline'}
        </Button>
        <Button
          variant="contained"
          startIcon={
            busy && busyAction === 'download' ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <Download />
            )
          }
          onClick={handleDownload}
          disabled={busy || chapters.length === 0}
        >
          {busy && busyAction === 'download' ? 'Generating…' : 'Download MP3'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

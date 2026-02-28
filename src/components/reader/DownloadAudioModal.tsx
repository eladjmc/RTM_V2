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
} from '@mui/material';
import { Close, Download } from '@mui/icons-material';
import type { ChapterSummary } from '../../types/models';
import {
  ttsService,
  type TtsVoice,
  type TtsErrorResponse,
} from '../../services/ttsService';

interface DownloadAudioModalProps {
  open: boolean;
  onClose: () => void;
  bookId: string;
  bookTitle: string;
  chapters: ChapterSummary[];
  currentChapterNumber: number;
}

export default function DownloadAudioModal({
  open,
  onClose,
  bookId,
  bookTitle,
  chapters,
  currentChapterNumber,
}: DownloadAudioModalProps) {
  // ── State ────────────────────────────────────────────────────
  const [startChapter, setStartChapter] = useState(currentChapterNumber);
  const [endChapter, setEndChapter] = useState(currentChapterNumber);
  const [voice, setVoice] = useState('en-US-AriaNeural');
  const [rate, setRate] = useState(1.0);
  const [voices, setVoices] = useState<TtsVoice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);

  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chapterErrors, setChapterErrors] = useState<TtsErrorResponse['chapters']>(undefined);
  const [success, setSuccess] = useState(false);

  // ── Reset state when modal opens ─────────────────────────────
  useEffect(() => {
    if (open) {
      setStartChapter(currentChapterNumber);
      setEndChapter(currentChapterNumber);
      setRate(1.0);
      setError(null);
      setChapterErrors(undefined);
      setSuccess(false);
      setDownloading(false);
    }
  }, [open, currentChapterNumber]);

  // ── Fetch voices once ────────────────────────────────────────
  useEffect(() => {
    if (!open || voices.length > 0) return;
    setLoadingVoices(true);
    ttsService
      .getVoices()
      .then(setVoices)
      .catch(() => {})
      .finally(() => setLoadingVoices(false));
  }, [open, voices.length]);

  // ── Sorted chapters for dropdowns ────────────────────────────
  const sorted = useMemo(
    () => [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber),
    [chapters],
  );

  // Valid end chapters (>= startChapter)
  const endOptions = useMemo(
    () => sorted.filter((ch) => ch.chapterNumber >= startChapter),
    [sorted, startChapter],
  );

  // Fix endChapter if startChapter moves past it
  useEffect(() => {
    if (endChapter < startChapter) {
      setEndChapter(startChapter);
    }
  }, [startChapter, endChapter]);

  const chapterCount = endChapter - startChapter + 1;

  // ── Download handler ─────────────────────────────────────────
  const handleDownload = async () => {
    setError(null);
    setChapterErrors(undefined);
    setSuccess(false);
    setDownloading(true);

    try {
      await ttsService.downloadAudio(bookId, {
        startChapterNumber: startChapter,
        chapterCount,
        voice,
        rate,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const e = err as Error & { data?: TtsErrorResponse };
      setError(e.message || 'Download failed');
      if (e.data?.chapters) {
        setChapterErrors(e.data.chapters);
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onClose={downloading ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Download Audio
        <IconButton edge="end" onClick={onClose} disabled={downloading} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          {/* Book name */}
          <Typography variant="subtitle2" color="text.secondary">
            Book: <strong>{bookTitle}</strong>
          </Typography>

          {/* Chapter range */}
          <Stack direction="row" spacing={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>From chapter</InputLabel>
              <Select
                label="From chapter"
                value={startChapter}
                onChange={(e) => setStartChapter(Number(e.target.value))}
                disabled={downloading}
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
                disabled={downloading}
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

          {/* Voice picker */}
          <FormControl size="small" fullWidth>
            <InputLabel>Voice</InputLabel>
            <Select
              label="Voice"
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              disabled={downloading || loadingVoices}
              MenuProps={{ PaperProps: { sx: { maxHeight: 250 } } }}
            >
              {voices.map((v) => (
                <MenuItem key={v.ShortName} value={v.ShortName}>
                  {v.FriendlyName.replace('Microsoft ', '').replace(' Online (Natural) - English (United States)', '')} ({v.Gender})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Speed slider */}
          <Box>
            <Typography variant="body2" gutterBottom>
              Speed: {rate.toFixed(1)}x
            </Typography>
            <Slider
              value={rate}
              onChange={(_, v) => setRate(v as number)}
              min={0.5}
              max={2.0}
              step={0.1}
              disabled={downloading}
              marks={[
                { value: 0.5, label: '0.5x' },
                { value: 1.0, label: '1x' },
                { value: 1.5, label: '1.5x' },
                { value: 2.0, label: '2x' },
              ]}
              size="small"
            />
          </Box>

          {/* Error display */}
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

          {/* Success display */}
          {success && (
            <Alert severity="success">
              Audio generated successfully! Your download should start automatically.
            </Alert>
          )}

          {/* Loading indicator */}
          {downloading && (
            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center">
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Generating audio for {chapterCount} chapter{chapterCount !== 1 ? 's' : ''}… This may take a few minutes.
              </Typography>
            </Stack>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={downloading}>
          Close
        </Button>
        <Button
          variant="contained"
          startIcon={downloading ? <CircularProgress size={16} color="inherit" /> : <Download />}
          onClick={handleDownload}
          disabled={downloading || chapters.length === 0}
        >
          {downloading ? 'Generating…' : 'Download'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

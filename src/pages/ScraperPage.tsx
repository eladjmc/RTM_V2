import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Divider,
  Alert,
  Fade,
  Paper,
} from '@mui/material';
import {
  Add,
  Cancel,
  CheckCircle,
  Error as ErrorIcon,
  AutoStories,
  Refresh,
  CloudDownload,
} from '@mui/icons-material';
import {
  scraperService,
  type ScrapeJob,
  type ScrapeRequest,
} from '../services/scraperService';

/* ── Status chip helpers ───────────────────────────────────────────── */

const STATUS_CONFIG: Record<
  ScrapeJob['status'],
  { color: 'info' | 'success' | 'error' | 'warning'; icon: React.ReactElement; label: string }
> = {
  running: { color: 'info', icon: <CloudDownload fontSize="small" />, label: 'Running' },
  completed: { color: 'success', icon: <CheckCircle fontSize="small" />, label: 'Completed' },
  failed: { color: 'error', icon: <ErrorIcon fontSize="small" />, label: 'Failed' },
  cancelled: { color: 'warning', icon: <Cancel fontSize="small" />, label: 'Cancelled' },
};

function StatusChip({ status }: { status: ScrapeJob['status'] }) {
  const cfg = STATUS_CONFIG[status];
  return <Chip size="small" icon={cfg.icon} label={cfg.label} color={cfg.color} variant="outlined" />;
}

/* ── Active job card ───────────────────────────────────────────────── */

function ActiveJobCard({
  job,
  onCancel,
}: {
  job: ScrapeJob;
  onCancel: (id: string) => void;
}) {
  const progress =
    job.total_expected && job.total_expected > 0
      ? Math.min(100, Math.round((job.chapters_scraped / job.total_expected) * 100))
      : null;

  return (
    <Card
      elevation={3}
      sx={{
        border: 2,
        borderColor: 'primary.main',
        borderRadius: 3,
        overflow: 'visible',
        position: 'relative',
      }}
    >
      <CardContent sx={{ pb: '16px !important' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <AutoStories color="primary" />
            <Typography variant="h6" fontWeight={700} noWrap sx={{ maxWidth: 300 }}>
              {job.book_title || 'Scraping…'}
            </Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            <StatusChip status={job.status} />
            {job.status === 'running' && (
              <Tooltip title="Cancel scrape">
                <IconButton color="error" size="small" onClick={() => onCancel(job.job_id)}>
                  <Cancel />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Stack>

        {/* Progress bar */}
        <Box sx={{ mb: 1 }}>
          {progress !== null ? (
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ height: 8, borderRadius: 4 }}
            />
          ) : (
            <LinearProgress
              variant="indeterminate"
              sx={{ height: 8, borderRadius: 4 }}
            />
          )}
        </Box>

        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" color="text.secondary">
            {job.message}
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {job.chapters_scraped}
            {job.total_expected ? ` / ${job.total_expected}` : ''} chapters
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

/* ── Job history row ───────────────────────────────────────────────── */

function JobRow({ job }: { job: ScrapeJob }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{ py: 1.5, px: 2 }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
        <StatusChip status={job.status} />
        <Typography variant="body2" fontWeight={600} noWrap>
          {job.book_title || job.job_id}
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, ml: 2 }}>
        {job.chapters_scraped} chapters · {job.message}
      </Typography>
    </Stack>
  );
}

/* ── New scrape modal ──────────────────────────────────────────────── */

function NewScrapeDialog({
  open,
  onClose,
  onStart,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onStart: (data: ScrapeRequest) => Promise<void>;
  loading: boolean;
}) {
  const [url, setUrl] = useState('');
  const [bookUrl, setBookUrl] = useState('');
  const [maxChapters, setMaxChapters] = useState('');
  const [startingChapter, setStartingChapter] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    await onStart({
      url: url.trim(),
      book_url: bookUrl.trim() || undefined,
      max_chapters: maxChapters ? parseInt(maxChapters, 10) : null,
      starting_chapter: startingChapter ? parseInt(startingChapter, 10) : null,
    });
    setUrl('');
    setBookUrl('');
    setMaxChapters('');
    setStartingChapter('');
  };

  const handleClose = () => {
    if (loading) return;
    setUrl('');
    setBookUrl('');
    setMaxChapters('');
    setStartingChapter('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ fontWeight: 700 }}>Scrape New Book</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="First Chapter URL"
              placeholder="https://novelbin.com/b/book-name/chapter-1"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              autoFocus
              size="small"
              helperText="The URL of the first chapter to start scraping from."
            />
            <TextField
              label="Book Page URL (optional)"
              placeholder="https://novelbin.com/b/book-name"
              value={bookUrl}
              onChange={(e) => setBookUrl(e.target.value)}
              size="small"
              helperText="Fetches the cover image and author. Recommended."
            />
            <TextField
              label="Max Chapters (optional)"
              type="number"
              placeholder="Leave empty for all chapters"
              value={maxChapters}
              onChange={(e) => setMaxChapters(e.target.value)}
              size="small"
              slotProps={{ htmlInput: { min: 1 } }}
              helperText="Limit how many chapters to scrape. Empty = all."
            />
            <TextField
              label="Starting Chapter Number (optional)"
              type="number"
              placeholder="Defaults to 1"
              value={startingChapter}
              onChange={(e) => setStartingChapter(e.target.value)}
              size="small"
              slotProps={{ htmlInput: { min: 1 } }}
              helperText="If starting from chapter 840, enter 840 so numbering is correct."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !url.trim()}
            startIcon={<CloudDownload />}
          >
            {loading ? 'Starting…' : 'Start Scrape'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/* ── Main page ─────────────────────────────────────────────────────── */

const POLL_INTERVAL = 2000;

export default function ScraperPage() {
  const [jobs, setJobs] = useState<ScrapeJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasRunning = jobs.some((j) => j.status === 'running');
  const activeJob = jobs.find((j) => j.status === 'running');
  const historyJobs = jobs.filter((j) => j.status !== 'running');

  /* ── Fetching ──────────────────────────────────────────────────── */

  const fetchJobs = useCallback(async () => {
    try {
      const data = await scraperService.listJobs();
      setJobs(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach scraper service');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + polling when a job is running
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (hasRunning) {
      pollRef.current = setInterval(fetchJobs, POLL_INTERVAL);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [hasRunning, fetchJobs]);

  /* ── Actions ───────────────────────────────────────────────────── */

  const handleStart = async (data: ScrapeRequest) => {
    setStartLoading(true);
    try {
      await scraperService.start(data);
      setDialogOpen(false);
      await fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scrape');
    } finally {
      setStartLoading(false);
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      await scraperService.cancel(jobId);
      await fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel job');
    }
  };

  /* ── Render ────────────────────────────────────────────────────── */

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 900, mx: 'auto', width: '100%', flex: 1 }}>
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <Typography variant="h5" fontWeight={700}>
          Book Scraper
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchJobs} size="small">
              <Refresh />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setDialogOpen(true)}
            disabled={hasRunning}
            disableElevation
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Add New Book
          </Button>
        </Stack>
      </Stack>

      {/* Error banner */}
      {error && (
        <Fade in>
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        </Fade>
      )}

      {/* Disabled hint */}
      {hasRunning && (
        <Alert severity="info" sx={{ mb: 2 }}>
          A scrape is currently in progress. Wait for it to finish or cancel it before starting a new one.
        </Alert>
      )}

      {/* Loading */}
      {loading && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <LinearProgress />
        </Box>
      )}

      {/* Active job */}
      {activeJob && (
        <Fade in>
          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
              Active Scrape
            </Typography>
            <ActiveJobCard job={activeJob} onCancel={handleCancel} />
          </Box>
        </Fade>
      )}

      {/* Empty state */}
      {!loading && jobs.length === 0 && !error && (
        <Paper
          variant="outlined"
          sx={{
            textAlign: 'center',
            py: 10,
            px: 4,
            borderRadius: 3,
            borderStyle: 'dashed',
          }}
        >
          <AutoStories sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No scrape jobs yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Click "Add New Book" to scrape your first book from novelbin.
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setDialogOpen(true)}
            sx={{ textTransform: 'none' }}
          >
            Add New Book
          </Button>
        </Paper>
      )}

      {/* Job history */}
      {historyJobs.length > 0 && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
            History
          </Typography>
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            {historyJobs.map((job, i) => (
              <Box key={job.job_id}>
                {i > 0 && <Divider />}
                <JobRow job={job} />
              </Box>
            ))}
          </Paper>
        </Box>
      )}

      {/* New scrape dialog */}
      <NewScrapeDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onStart={handleStart}
        loading={startLoading}
      />
    </Box>
  );
}

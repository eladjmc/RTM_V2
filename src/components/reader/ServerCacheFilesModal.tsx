import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Chip,
} from '@mui/material';
import { Close, Download, Headphones, Refresh } from '@mui/icons-material';
import {
  listenJobService,
  type ListenJobSummary,
} from '../../services/listenJobService';

interface ServerCacheFilesModalProps {
  open: boolean;
  onClose: () => void;
  currentBookId: string;
  onResumeJob: (job: ListenJobSummary) => void;
  clearedMessage: string | null;
  onClearMessageConsumed: () => void;
}

function formatRange(job: ListenJobSummary): string {
  return job.startChapter === job.endChapter
    ? `Ch ${job.startChapter}`
    : `Ch ${job.startChapter}–${job.endChapter}`;
}

function formatCreatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function statusChip(job: ListenJobSummary) {
  if (job.status === 'failed') {
    return <Chip label="Failed" color="error" size="small" />;
  }
  if (job.combinedReady) {
    return <Chip label="Ready to download" color="success" size="small" />;
  }
  if (job.status === 'complete') {
    return <Chip label="Merging…" color="warning" size="small" />;
  }
  return (
    <Chip
      label={`${job.readyCount}/${job.totalCount} chapters`}
      color="info"
      size="small"
    />
  );
}

export default function ServerCacheFilesModal({
  open,
  onClose,
  currentBookId,
  onResumeJob,
  clearedMessage,
  onClearMessageConsumed,
}: ServerCacheFilesModalProps) {
  const [jobs, setJobs] = useState<ListenJobSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [localCleared, setLocalCleared] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listenJobService.listJobs();
      setJobs(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load server files');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    loadJobs();
    const interval = setInterval(loadJobs, 4000);
    return () => clearInterval(interval);
  }, [open, loadJobs]);

  useEffect(() => {
    if (open && clearedMessage) {
      setLocalCleared(clearedMessage);
      onClearMessageConsumed();
    }
  }, [open, clearedMessage, onClearMessageConsumed]);

  useEffect(() => {
    if (!open) {
      setLocalCleared(null);
    }
  }, [open]);

  const handleDownload = async (job: ListenJobSummary) => {
    if (!job.combinedReady) return;
    setDownloadingId(job.jobId);
    setError(null);
    try {
      await listenJobService.downloadCombined(job.jobId);
      await loadJobs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleResume = (job: ListenJobSummary) => {
    if (job.bookId !== currentBookId) {
      setError(`Open "${job.bookTitle}" in the reader to resume this job.`);
      return;
    }
    onResumeJob(job);
    onClose();
  };

  const showEmpty = jobs.length === 0 && !loading;
  const emptyText = showEmpty ? 'No files on the server — cache is empty.' : null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', pr: 1 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          Server audio files
        </Typography>
        <IconButton onClick={loadJobs} disabled={loading} aria-label="Refresh" size="small">
          <Refresh fontSize="small" />
        </IconButton>
        <IconButton onClick={onClose} aria-label="Close" size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Listen jobs on the server. Download when ready, or reopen the player for this book.
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}

          {localCleared && (
            <Alert severity="success">{localCleared}</Alert>
          )}

          {loading && jobs.length === 0 && !localCleared && (
            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" py={2}>
              <CircularProgress size={22} />
              <Typography variant="body2" color="text.secondary">
                Loading…
              </Typography>
            </Stack>
          )}

          {emptyText && !localCleared && showEmpty && (
            <Alert severity="info">{emptyText}</Alert>
          )}

          {jobs.length > 0 && (
            <List disablePadding dense>
              {jobs.map((job) => (
                <ListItem
                  key={job.jobId}
                  divider
                  sx={{ flexDirection: 'column', alignItems: 'stretch', py: 1.5, px: 0 }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                    <ListItemText
                      primary={job.bookTitle}
                      secondary={
                        <>
                          {formatRange(job)} · {formatCreatedAt(job.createdAt)}
                          {job.bookId !== currentBookId && ' · different book'}
                        </>
                      }
                      primaryTypographyProps={{ fontWeight: 600 }}
                    />
                    {statusChip(job)}
                  </Stack>

                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={
                        downloadingId === job.jobId ? (
                          <CircularProgress size={14} color="inherit" />
                        ) : (
                          <Download />
                        )
                      }
                      disabled={!job.combinedReady || downloadingId !== null}
                      onClick={() => handleDownload(job)}
                    >
                      Download
                    </Button>
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<Headphones />}
                      disabled={job.status === 'failed'}
                      onClick={() => handleResume(job)}
                    >
                      Open player
                    </Button>
                  </Stack>

                  {job.error && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                      {job.error}
                    </Typography>
                  )}
                </ListItem>
              ))}
            </List>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  TextField,
  Tooltip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Typography,
  Box,
  CircularProgress,
  Stack,
} from '@mui/material';
import { Edit, Delete, Add, Close, PlayArrow } from '@mui/icons-material';
import type { Book, ChapterSummary } from '../../types/models';
import { chapterService } from '../../services/chapterService';

interface ChaptersModalProps {
  book: Book | null;
  onClose: () => void;
  onChapterDeleted: () => void;
  onPlayChapter: (bookId: string, chapterId: string) => void;
}

export default function ChaptersModal({
  book,
  onClose,
  onChapterDeleted,
  onPlayChapter,
}: ChaptersModalProps) {
  const navigate = useNavigate();
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const lastReadRef = useCallback((node: HTMLTableRowElement | null) => {
    if (node) {
      // Delay slightly so the table is fully rendered
      setTimeout(() => node.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
    }
  }, []);

  useEffect(() => {
    if (!book) return;
    setLoading(true);
    setFilter('');
    chapterService
      .getByBook(book._id)
      .then(setChapters)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [book]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return chapters;
    const lower = filter.toLowerCase();
    return chapters.filter(
      (c) =>
        c.title.toLowerCase().includes(lower) ||
        String(c.chapterNumber).includes(lower),
    );
  }, [chapters, filter]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this chapter? Remaining chapters will be renumbered.')) return;
    setDeleting(id);
    try {
      await chapterService.delete(id);
      setChapters((prev) => prev.filter((c) => c._id !== id));
      onChapterDeleted();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(null);
    }
  };

  const handleEdit = (chapterId: string) => {
    if (!book) return;
    onClose();
    navigate(`/library/books/${book._id}/chapters/${chapterId}/edit`);
  };

  const handleAdd = () => {
    if (!book) return;
    onClose();
    navigate(`/library/books/${book._id}/chapters/new`);
  };

  return (
    <Dialog open={!!book} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" component="span">
            {book?.title} — Chapters
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <Close fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <TextField
          placeholder="Filter by title or number…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          size="small"
          fullWidth
          sx={{ mb: 2 }}
        />

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : filtered.length === 0 ? (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            {chapters.length === 0 ? 'No chapters yet.' : 'No chapters match your filter.'}
          </Typography>
        ) : (
          <TableContainer sx={{ maxHeight: 400 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell width={60}>#</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell width={140} align="right" sx={{ whiteSpace: 'nowrap' }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((ch) => {
                  const isLastRead = book?.lastReadChapter === ch._id;
                  return (
                  <TableRow
                    key={ch._id}
                    hover
                    selected={isLastRead}
                    ref={isLastRead ? lastReadRef : undefined}
                    sx={isLastRead ? { bgcolor: 'action.selected' } : undefined}
                  >
                    <TableCell>{ch.chapterNumber}</TableCell>
                    <TableCell>
                      {ch.title || `Chapter ${ch.chapterNumber}`}
                      {isLastRead && (
                        <Typography
                          component="span"
                          variant="caption"
                          color="primary"
                          sx={{ ml: 1, fontWeight: 600 }}
                        >
                          (last read)
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Read">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => { if (book) onPlayChapter(book._id, ch._id); }}
                        >
                          <PlayArrow fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => handleEdit(ch._id)}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          disabled={deleting === ch._id}
                          onClick={() => handleDelete(ch._id)}
                        >
                          {deleting === ch._id ? (
                            <CircularProgress size={18} />
                          ) : (
                            <Delete fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>

      <DialogActions>
        <Button variant="contained" startIcon={<Add />} onClick={handleAdd}>
          Add Chapter
        </Button>
      </DialogActions>
    </Dialog>
  );
}

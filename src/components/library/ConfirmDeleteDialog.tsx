import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@mui/material';
import { Warning } from '@mui/icons-material';
import type { Book } from '../../types/models';

interface ConfirmDeleteDialogProps {
  book: Book | null;
  onClose: () => void;
  onConfirm: (book: Book) => void;
  loading?: boolean;
}

export default function ConfirmDeleteDialog({
  book,
  onClose,
  onConfirm,
  loading,
}: ConfirmDeleteDialogProps) {
  if (!book) return null;

  const chapters = book.chapterCount;

  return (
    <Dialog open={!!book} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Warning color="error" />
        Delete Book
      </DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to delete <strong>"{book.title}"</strong>?
        </Typography>
        {chapters > 0 && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            This will permanently delete {chapters} chapter
            {chapters !== 1 ? 's' : ''} associated with this book.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => onConfirm(book)}
          disabled={loading}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}

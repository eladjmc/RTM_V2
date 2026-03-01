import { useState, useRef, useEffect, type FormEvent } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  Box,
  Typography,
  IconButton,
} from '@mui/material';
import { AddPhotoAlternate, Close } from '@mui/icons-material';

interface AddBookDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { title: string; author?: string; cover?: string; startingChapterNumber?: number }) => Promise<void>;
  /** When provided, dialog opens in edit mode pre-filled with this book's data */
  initialData?: { title: string; author?: string; cover?: string; startingChapterNumber?: number };
}

/** Max output dimensions for cover thumbnails (matches card 1:1 ratio) */
const MAX_WIDTH = 400;
const MAX_HEIGHT = 400;
/** JPEG quality (0–1) */
const QUALITY = 0.8;

/**
 * Resize & compress an image file to a base64 JPEG string.
 * Keeps aspect ratio within MAX_WIDTH × MAX_HEIGHT.
 */
function compressCover(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Scale down keeping aspect ratio
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
      URL.revokeObjectURL(img.src);
      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
}

export default function AddBookDialog({ open, onClose, onSave, initialData }: AddBookDialogProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [startingChapter, setStartingChapter] = useState(1);
  const [cover, setCover] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isEdit = !!initialData;

  // Pre-fill when opening in edit mode
  useEffect(() => {
    if (open && initialData) {
      setTitle(initialData.title);
      setAuthor(initialData.author ?? '');
      setCover(initialData.cover);
      setStartingChapter(initialData.startingChapterNumber ?? 1);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressCover(file);
      setCover(compressed);
    } catch {
      alert('Could not process the image. Try a different file.');
    }
    // Reset so the same file can be re-selected
    e.target.value = '';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      await onSave({
        title: title.trim(),
        author: author.trim() || undefined,
        cover: cover || undefined,
        startingChapterNumber: startingChapter !== 1 ? startingChapter : undefined,
      });
      setTitle('');
      setAuthor('');
      setStartingChapter(1);
      setCover(undefined);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setTitle('');
    setAuthor('');
    setStartingChapter(1);
    setCover(undefined);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{isEdit ? 'Edit Book' : 'New Book'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
              size="small"
            />
            <TextField
              label="Author (optional)"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              size="small"
            />

            {/* Starting chapter — only show when creating a new book */}
            {!isEdit && (
              <TextField
                label="Starting chapter number"
                type="number"
                value={startingChapter}
                onChange={(e) => setStartingChapter(Math.max(1, Number(e.target.value) || 1))}
                size="small"
                slotProps={{ htmlInput: { min: 1 } }}
              />
            )}

            {/* Cover image upload */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleFileChange}
            />
            {cover ? (
              <Box sx={{ position: 'relative', textAlign: 'center' }}>
                <Box
                  component="img"
                  src={cover}
                  alt="Cover preview"
                  sx={{
                    maxHeight: 160,
                    maxWidth: '100%',
                    borderRadius: 1,
                    objectFit: 'contain',
                  }}
                />
                <IconButton
                  size="small"
                  onClick={() => setCover(undefined)}
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    bgcolor: 'background.paper',
                    boxShadow: 1,
                    '&:hover': { bgcolor: 'error.light', color: 'white' },
                  }}
                >
                  <Close fontSize="small" />
                </IconButton>
              </Box>
            ) : (
              <Button
                variant="outlined"
                startIcon={<AddPhotoAlternate />}
                onClick={() => fileRef.current?.click()}
                sx={{ textTransform: 'none' }}
              >
                Add Cover Image
              </Button>
            )}
            <Typography variant="caption" color="text.secondary">
              Auto-resized & JPEG compressed
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading || !title.trim()}>
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

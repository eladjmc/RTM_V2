import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Stack,
  CircularProgress,
  Alert,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { Save, NavigateNext, ArrowBack, Close } from '@mui/icons-material';
import { chapterService } from '../services/chapterService';
import { bookService } from '../services/bookService';

export default function ChapterEditorPage() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
  const navigate = useNavigate();
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const isEdit = !!chapterId && chapterId !== 'new';

  const [bookTitle, setBookTitle] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [chapterNumber, setChapterNumber] = useState<number | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [fastCopy, setFastCopy] = useState(true);

  // Load book title
  useEffect(() => {
    if (!bookId) return;
    bookService.getById(bookId).then((d: { book: { title: string } }) => setBookTitle(d.book.title)).catch(() => {});
  }, [bookId]);

  // Load existing chapter for edit mode
  useEffect(() => {
    if (!isEdit || !chapterId) return;
    setLoading(true);
    chapterService
      .getById(chapterId)
      .then((ch: { title: string; content: string; chapterNumber: number }) => {
        setTitle(ch.title);
        setContent(ch.content);
        setChapterNumber(ch.chapterNumber);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isEdit, chapterId]);

  // Auto-focus content textarea
  useEffect(() => {
    if (!loading) {
      // Small delay so the DOM is ready
      const t = setTimeout(() => contentRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [loading, savedCount]);

  const handleSave = async (andNext: boolean) => {
    if (!bookId || !content.trim()) return;
    setSaving(true);
    setError('');

    try {
      if (isEdit && chapterId) {
        await chapterService.update(chapterId, {
          title: title.trim() || undefined,
          content: content.trim(),
        });
        navigate(`/library`);
      } else {
        await chapterService.create(bookId, {
          title: title.trim() || undefined,
          content: content.trim(),
        });

        if (andNext) {
          // Clear form for next chapter
          setTitle('');
          setContent('');
          setSavedCount((c) => c + 1);
        } else {
          navigate('/library');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Keyboard shortcut: Right arrow → Save & Next
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  const contentValRef = useRef(content);
  contentValRef.current = content;
  const fastCopyRef = useRef(fastCopy);
  fastCopyRef.current = fastCopy;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowRight' || isEdit) return;
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      // When focused in a field, only intercept if Fast Copy is on
      if (inField && !fastCopyRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      // If content is empty, nothing to save — just stay ready for next paste
      if (!contentValRef.current.trim()) return;
      handleSaveRef.current(true);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isEdit]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: 2, width: '100%' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/library')}
          size="small"
        >
          Library
        </Button>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {bookTitle} — {isEdit ? `Edit Chapter ${chapterNumber ?? ''}` : 'Add Chapter'}
        </Typography>
        {savedCount > 0 && !isEdit && (
          <Typography variant="body2" color="success.main" fontWeight={600}>
            {savedCount} chapter{savedCount !== 1 ? 's' : ''} saved
          </Typography>
        )}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2 }}>
        <Stack spacing={2}>
          <TextField
            label="Chapter title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            size="small"
            fullWidth
          />

          <TextField
            label="Content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            inputRef={contentRef}
            multiline
            minRows={14}
            maxRows={30}
            fullWidth
            placeholder="Paste chapter content here…"
            slotProps={{
              htmlInput: { style: { fontFamily: 'monospace', fontSize: 14 } },
            }}
          />

          <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
            {!isEdit && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={fastCopy}
                    onChange={(e) => setFastCopy(e.target.checked)}
                    size="small"
                  />
                }
                label="Fast copy"
                sx={{ mr: 'auto' }}
              />
            )}
            {isEdit ? (
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={18} /> : <Save />}
                disabled={saving || !content.trim()}
                onClick={() => handleSave(false)}
              >
                Save
              </Button>
            ) : (
              <>
                {!content.trim() ? (
                  <Button
                    variant="outlined"
                    startIcon={<Close />}
                    onClick={() => navigate('/library')}
                  >
                    Close
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    startIcon={saving ? <CircularProgress size={18} /> : <Save />}
                    disabled={saving}
                    onClick={() => handleSave(false)}
                  >
                    Save & Close
                  </Button>
                )}
                <Button
                  variant="contained"
                  endIcon={saving ? <CircularProgress size={18} /> : <NavigateNext />}
                  disabled={saving || !content.trim()}
                  onClick={() => handleSave(true)}
                >
                  Save & Next
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}

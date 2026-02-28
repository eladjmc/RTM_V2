import { Card, CardActionArea, Typography, Box, IconButton, Stack, Tooltip } from '@mui/material';
import { AutoStories, Edit, Delete, PlayArrow } from '@mui/icons-material';
import type { Book } from '../../types/models';

interface BookCardProps {
  book: Book;
  onClick: (book: Book) => void;
  onEdit: (book: Book) => void;
  onDelete: (book: Book) => void;
  onPlay: (book: Book) => void;
}

/** Pastel palette for placeholder covers (deterministic by title) */
const PALETTE = [
  '#5c6bc0', '#42a5f5', '#26a69a', '#66bb6a',
  '#ffa726', '#ef5350', '#ab47bc', '#78909c',
];

function pickColor(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export default function BookCard({ book, onClick, onEdit, onDelete, onPlay }: BookCardProps) {
  const hasCover = !!book.cover;
  const bg = pickColor(book.title);

  return (
    <Card
      sx={{
        width: { xs: 160, sm: 150 },
        transition: 'transform 0.15s, box-shadow 0.15s',
        '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
        overflow: 'visible',
      }}
    >
      <CardActionArea onClick={() => onClick(book)} sx={{ p: 0 }}>
        {/* Book cover */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            aspectRatio: '3 / 3',
            borderRadius: '4px 8px 8px 4px',
            overflow: 'hidden',
            // Spine shadow
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: 6,
              background: 'linear-gradient(to right, rgba(0,0,0,0.25), transparent)',
              zIndex: 1,
            },
          }}
        >
          {hasCover ? (
            <Box
              component="img"
              src={book.cover}
              alt={book.title}
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            /* Placeholder cover */
            <Box
              sx={{
                width: '100%',
                height: '100%',
                bgcolor: bg,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                px: 1.5,
              }}
            >
              <AutoStories sx={{ fontSize: 36, color: 'rgba(255,255,255,0.7)' }} />
              <Typography
                variant="caption"
                sx={{
                  color: 'white',
                  fontWeight: 600,
                  textAlign: 'center',
                  lineHeight: 1.2,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {book.title}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Info below the cover */}
        <Box sx={{ px: 1, py: 1, textAlign: 'center' }}>
          <Typography
            variant="subtitle2"
            fontWeight={600}
            noWrap
            title={book.title}
            sx={{ lineHeight: 1.3 }}
          >
            {book.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            {book.chapterCount} chapter{book.chapterCount !== 1 ? 's' : ''}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Current Ch: {book.lastReadChapterNumber ? book.lastReadChapterNumber : '—'}
          </Typography>
        </Box>
      </CardActionArea>

      {/* Action buttons */}
      <Stack
        direction="row"
        justifyContent="center"
        spacing={0.5}
        sx={{ pb: 0.5 }}
      >
        <Tooltip title={book.chapterCount === 0 ? 'No chapters' : 'Continue reading'}>
          <span>
            <IconButton
              size="small"
              disabled={book.chapterCount === 0}
              onClick={(e) => { e.stopPropagation(); onPlay(book); }}
              sx={{ color: 'primary.main' }}
            >
              <PlayArrow fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Edit">
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onEdit(book); }}
            sx={{ color: 'text.secondary' }}
          >
            <Edit fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onDelete(book); }}
            sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
          >
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Card>
  );
}

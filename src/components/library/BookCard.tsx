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
        width: { xs: '100%', sm: 280, md: 340 },
        transition: 'transform 0.15s, box-shadow 0.15s',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: 6 },
        overflow: 'hidden',
        borderRadius: 2,
      }}
    >
      <CardActionArea onClick={() => onClick(book)} sx={{ p: 0 }}>
        {/* Top row: cover | details */}
        <Stack direction="row" sx={{ height: { xs: 140, md: 155 } }}>
          {/* Cover */}
          <Box
            sx={{
              width: { xs: 100, md: 115 },
              minWidth: { xs: 100, md: 115 },
              height: '100%',
              position: 'relative',
              overflow: 'hidden',
              // Spine shadow
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                width: 4,
                background: 'linear-gradient(to left, rgba(0,0,0,0.15), transparent)',
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
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  bgcolor: bg,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                  px: 1,
                }}
              >
                <AutoStories sx={{ fontSize: 28, color: 'rgba(255,255,255,0.7)' }} />
                <Typography
                  variant="caption"
                  sx={{
                    color: 'white',
                    fontWeight: 600,
                    textAlign: 'center',
                    lineHeight: 1.2,
                    fontSize: '0.65rem',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {book.title}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Details */}
          <Box sx={{ flex: 1, py: 1.5, px: 1.5, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minWidth: 0, textAlign: 'center' }}>
            <Typography
              variant="subtitle2"
              fontWeight={700}
              title={book.title}
              sx={{
                lineHeight: 1.3,
                mb: 0.5,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {book.title}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.4 }}>
              {book.chapterCount} chapter{book.chapterCount !== 1 ? 's' : ''}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
              Current Ch: {book.lastReadChapterNumber ?? '—'}
            </Typography>
          </Box>
        </Stack>
      </CardActionArea>

      {/* Action buttons at the bottom */}
      <Stack
        direction="row"
        justifyContent="center"
        spacing={0}
        sx={{
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Tooltip title={book.chapterCount === 0 ? 'No chapters' : 'Continue reading'}>
          <span>
            <IconButton
              size="medium"
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
            size="medium"
            onClick={(e) => { e.stopPropagation(); onEdit(book); }}
            sx={{ color: 'text.secondary' }}
          >
            <Edit fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton
            size="medium"
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

import { Box, IconButton, MenuItem, Select, Tooltip } from '@mui/material';
import { SkipPrevious, SkipNext, FileDownload } from '@mui/icons-material';
import type { ChapterSummary } from '../../types/models';

interface ReaderBottomBarProps {
  chapters: ChapterSummary[];
  currentChapterId: string | null;
  hasPrev: boolean;
  hasNext: boolean;
  isPlaying: boolean;
  onPrev: () => void;
  onNext: () => void;
  onChapterSelect: (chapterId: string) => void;
  onDownloadAudio: () => void;
}

export default function ReaderBottomBar({
  chapters,
  currentChapterId,
  hasPrev,
  hasNext,
  isPlaying,
  onPrev,
  onNext,
  onChapterSelect,
  onDownloadAudio,
}: ReaderBottomBarProps) {
  const mounted = currentChapterId !== null && chapters.length > 0;
  const disabled = !mounted || isPlaying;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        px: 1.5,
        py: 0.5,
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        minHeight: 44,
        flexShrink: 0,
      }}
    >
      <Tooltip title="Previous chapter">
        <span>
          <IconButton
            size="small"
            disabled={disabled || !hasPrev}
            onClick={onPrev}
          >
            <SkipPrevious />
          </IconButton>
        </span>
      </Tooltip>

      <Select
        size="small"
        value={mounted ? currentChapterId : ''}
        disabled={disabled}
        displayEmpty
        onChange={(e) => onChapterSelect(e.target.value as string)}
        sx={{ minWidth: { xs: 120, sm: 200 }, maxWidth: { xs: 180, sm: 320 }, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
        MenuProps={{ PaperProps: { sx: { maxHeight: 250 } } }}
      >
        {!mounted && (
          <MenuItem value="" disabled>
            No chapter mounted
          </MenuItem>
        )}
        {chapters.map((ch) => (
          <MenuItem key={ch._id} value={ch._id}>
            {ch.chapterNumber}. {ch.title}
          </MenuItem>
        ))}
      </Select>

      <Tooltip title="Next chapter">
        <span>
          <IconButton
            size="small"
            disabled={disabled || !hasNext}
            onClick={onNext}
          >
            <SkipNext />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Download audio">
        <span>
          <IconButton
            size="small"
            disabled={!mounted}
            onClick={onDownloadAudio}
          >
            <FileDownload />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}

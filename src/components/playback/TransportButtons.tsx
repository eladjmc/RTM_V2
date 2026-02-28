import React from 'react';
import { IconButton, Tooltip, Stack } from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  SkipNext,
  SkipPrevious,
  Replay,
} from '@mui/icons-material';
import type { PlaybackStatus } from '../../hooks/useTTS';

interface TransportButtonsProps {
  status: PlaybackStatus;
  hasText: boolean;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onReset: () => void;
  onSkipForward: () => void;
  onSkipBackward: () => void;
}

const TransportButtons: React.FC<TransportButtonsProps> = ({
  status,
  hasText,
  onPlay,
  onPause,
  onResume,
  onStop,
  onReset,
  onSkipForward,
  onSkipBackward,
}) => {
  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const isIdle = status === 'idle';

  const handlePlayPause = () => {
    if (isPlaying) onPause();
    else if (isPaused) onResume();
    else onPlay();
  };

  return (
    <Stack direction="row" alignItems="center" spacing={0}>
      <Tooltip title="Previous paragraph">
        <span>
          <IconButton
            onClick={onSkipBackward}
            disabled={isIdle}
            size="small"
            aria-label="Previous paragraph"
          >
            <SkipPrevious />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title={isPlaying ? 'Pause' : isPaused ? 'Resume' : 'Play'}>
        <span>
          <IconButton
            onClick={handlePlayPause}
            disabled={!hasText}
            color="primary"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            sx={{
              mx: 0.25,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': { bgcolor: 'primary.dark' },
              '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
              width: { xs: 36, sm: 40 },
              height: { xs: 36, sm: 40 },
            }}
          >
            {isPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Stop">
        <span>
          <IconButton
            onClick={onStop}
            disabled={isIdle}
            size="small"
            aria-label="Stop"
          >
            <Stop />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Next paragraph">
        <span>
          <IconButton
            onClick={onSkipForward}
            disabled={isIdle}
            size="small"
            aria-label="Next paragraph"
          >
            <SkipNext />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Reset to start">
        <span>
          <IconButton
            onClick={onReset}
            disabled={isPlaying || isIdle}
            size="small"
            aria-label="Reset to start"
          >
            <Replay />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
};

export default TransportButtons;

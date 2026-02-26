import React, { useState, useRef } from 'react';
import {
  Box,
  IconButton,
  Slider,
  Select,
  MenuItem,
  Tooltip,
  Stack,
  FormControl,
  Chip,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  SkipNext,
  SkipPrevious,
  VolumeUp,
  VolumeOff,
  VolumeDown,
  Add,
  Remove,
} from '@mui/icons-material';
import type { PlaybackStatus } from '../hooks/useTTS';
import type { VoiceInfo } from '../hooks/useVoices';

interface PlaybackControlsProps {
  status: PlaybackStatus;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSkipForward: () => void;
  onSkipBackward: () => void;
  // Voice
  voices: VoiceInfo[];
  selectedVoiceName: string;
  onVoiceChange: (voiceName: string) => void;
  // Speed
  speed: number;
  onSpeedChange: (speed: number) => void;
  // Volume
  volume: number;
  onVolumeChange: (volume: number) => void;
  isMuted: boolean;
  onMuteToggle: () => void;
  // State
  hasText: boolean;
}

const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  status,
  onPlay,
  onPause,
  onResume,
  onStop,
  onSkipForward,
  onSkipBackward,
  voices,
  selectedVoiceName,
  onVoiceChange,
  speed,
  onSpeedChange,
  volume,
  onVolumeChange,
  isMuted,
  onMuteToggle,
  hasText,
}) => {
  const [editingSpeed, setEditingSpeed] = useState(false);
  const [speedInput, setSpeedInput] = useState('');
  const speedInputRef = useRef<HTMLInputElement>(null);

  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const isIdle = status === 'idle';

  const handlePlayPause = () => {
    if (isPlaying) {
      onPause();
    } else if (isPaused) {
      onResume();
    } else {
      onPlay();
    }
  };

  const handleVoiceChange = (event: SelectChangeEvent<string>) => {
    onVoiceChange(event.target.value);
  };

  const handleVolumeChange = (_: Event, value: number | number[]) => {
    onVolumeChange(value as number);
  };

  const decreaseSpeed = () => {
    onSpeedChange(Math.max(0.5, +(speed - 0.05).toFixed(2)));
  };

  const increaseSpeed = () => {
    onSpeedChange(Math.min(4, +(speed + 0.05).toFixed(2)));
  };

  const handleSpeedClick = () => {
    setSpeedInput(String(speed));
    setEditingSpeed(true);
    setTimeout(() => speedInputRef.current?.select(), 0);
  };

  const commitSpeed = () => {
    const val = parseFloat(speedInput);
    if (!isNaN(val) && val >= 0.5 && val <= 4) {
      onSpeedChange(+val.toFixed(2));
    }
    setEditingSpeed(false);
  };

  const handleSpeedKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitSpeed();
    if (e.key === 'Escape') setEditingSpeed(false);
  };

  const VolumeIcon = isMuted || volume === 0
    ? VolumeOff
    : volume < 0.5
      ? VolumeDown
      : VolumeUp;

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 48,
        zIndex: (t) => t.zIndex.appBar,
        px: { xs: 0.5, sm: 2 },
        py: { xs: 0.5, sm: 1 },
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="center"
        flexWrap="wrap"
        sx={{ gap: { xs: 0.25, sm: 1 } }}
      >
        {/* === Playback Transport === */}
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
                {isPlaying ? (
                  <Pause />
                ) : (
                  <PlayArrow />
                )}
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
        </Stack>

        {/* === Divider (desktop only) === */}
        <Box sx={{ width: '1px', height: 28, bgcolor: 'divider', mx: 0.5, display: { xs: 'none', sm: 'block' } }} />

        {/* === Voice Selector (desktop only) === */}
        <FormControl size="small" sx={{ minWidth: 140, maxWidth: 220, display: { xs: 'none', sm: 'inline-flex' } }}>
          <Select
            value={selectedVoiceName}
            onChange={handleVoiceChange}
            displayEmpty
            sx={{ fontSize: '0.8rem', height: 32 }}
            aria-label="Select voice"
          >
            {voices.length === 0 && (
              <MenuItem value="" disabled>
                No voices available
              </MenuItem>
            )}
            {voices.map((v) => (
              <MenuItem key={v.voice.name} value={v.voice.name} sx={{ fontSize: '0.85rem' }}>
                {v.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* === Divider === */}
        <Box sx={{ width: '1px', height: 28, bgcolor: 'divider', mx: 0.5, display: { xs: 'none', sm: 'block' } }} />

        {/* === Speed Stepper === */}
        <Stack direction="row" alignItems="center" spacing={0}>
          <Tooltip title="Decrease speed">
            <span>
              <IconButton
                onClick={decreaseSpeed}
                disabled={speed <= 0.5}
                size="small"
                aria-label="Decrease speed"
              >
                <Remove fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          {editingSpeed ? (
            <Box
              component="input"
              ref={speedInputRef}
              value={speedInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSpeedInput(e.target.value)}
              onBlur={commitSpeed}
              onKeyDown={handleSpeedKeyDown}
              sx={{
                width: 48,
                height: 24,
                border: '1px solid',
                borderColor: 'primary.main',
                borderRadius: '12px',
                textAlign: 'center',
                fontSize: '0.8rem',
                fontWeight: 600,
                outline: 'none',
                bgcolor: 'background.paper',
                color: 'text.primary',
                px: 0.5,
              }}
            />
          ) : (
            <Tooltip title="Click to type speed">
              <Chip
                label={`${speed}x`}
                size="small"
                variant="outlined"
                onClick={handleSpeedClick}
                sx={{
                  minWidth: 48,
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              />
            </Tooltip>
          )}

          <Tooltip title="Increase speed">
            <span>
              <IconButton
                onClick={increaseSpeed}
                disabled={speed >= 4}
                size="small"
                aria-label="Increase speed"
              >
                <Add fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        {/* === Divider === */}
        <Box sx={{ width: '1px', height: 28, bgcolor: 'divider', mx: 0.5 }} />

        {/* === Volume === */}
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: { xs: 80, sm: 120 } }}>
          <Tooltip title={isMuted ? 'Unmute' : 'Mute'}>
            <IconButton onClick={onMuteToggle} size="small" aria-label="Toggle mute">
              <VolumeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Slider
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            min={0}
            max={1}
            step={0.05}
            size="small"
            aria-label="Volume"
            sx={{ width: { xs: 50, sm: 80 } }}
          />
        </Stack>
      </Stack>
    </Box>
  );
};

export default PlaybackControls;

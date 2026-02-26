import React, { useState, useRef } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  Select,
  MenuItem,
  Slider,
  Stack,
  FormControl,
  Chip,
  Tooltip,
  Button,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import {
  Close,
  Add,
  Remove,
  VolumeUp,
  VolumeOff,
  VolumeDown,
  Clear,
  PlayArrow,
} from '@mui/icons-material';
import type { VoiceInfo } from '../hooks/useVoices';

const DRAWER_WIDTH = 380;

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  // Text
  text: string;
  onTextChange: (text: string) => void;
  onClear: () => void;
  textDisabled: boolean;
  // Playback
  onPlay: () => void;
  hasText: boolean;
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
  // Font size
  fontSize: number;
  onFontSizeChange: (size: number) => void;
}

const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  open,
  onClose,
  text,
  onTextChange,
  onClear,
  textDisabled,
  onPlay,
  hasText,
  voices,
  selectedVoiceName,
  onVoiceChange,
  speed,
  onSpeedChange,
  volume,
  onVolumeChange,
  isMuted,
  onMuteToggle,
  fontSize,
  onFontSizeChange,
}) => {
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

  const [editingSpeed, setEditingSpeed] = useState(false);
  const [speedInput, setSpeedInput] = useState('');
  const speedInputRef = useRef<HTMLInputElement>(null);

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

  const decreaseFontSize = () => {
    onFontSizeChange(Math.max(12, fontSize - 2));
  };

  const increaseFontSize = () => {
    onFontSizeChange(Math.min(32, fontSize + 2));
  };

  const VolumeIcon =
    isMuted || volume === 0
      ? VolumeOff
      : volume < 0.5
        ? VolumeDown
        : VolumeUp;

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: DRAWER_WIDTH },
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Settings & Text
        </Typography>
        <IconButton onClick={onClose} aria-label="Close drawer">
          <Close />
        </IconButton>
      </Box>

      <Divider />

      {/* Text Input Section */}
      <Box sx={{ px: 2, py: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Text
        </Typography>
        <Box
          component="textarea"
          value={text}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            onTextChange(e.target.value)
          }
          disabled={textDisabled}
          placeholder="Paste or type your text here..."
          sx={{
            width: '100%',
            minHeight: 200,
            maxHeight: 400,
            p: 1.5,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.default',
            color: 'text.primary',
            fontFamily: 'inherit',
            fontSize: '0.95rem',
            lineHeight: 1.6,
            resize: 'vertical',
            outline: 'none',
            '&:focus': {
              borderColor: 'primary.main',
            },
            '&:disabled': {
              opacity: 0.6,
              cursor: 'not-allowed',
            },
          }}
        />
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Clear />}
            onClick={onClear}
            disabled={textDisabled || !text}
          >
            Clear
          </Button>
        </Stack>
      </Box>

      <Divider />

      {/* Voice Selection */}
      <Box sx={{ px: 2, py: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Voice
        </Typography>
        <FormControl fullWidth size="small">
          <Select
            value={selectedVoiceName}
            onChange={handleVoiceChange}
            displayEmpty
            sx={{ fontSize: '0.85rem' }}
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
      </Box>

      <Divider />

      {/* Speed */}
      <Box sx={{ px: 2, py: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Speed
        </Typography>
        <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
          <IconButton
            onClick={decreaseSpeed}
            disabled={speed <= 0.5}
            size="small"
          >
            <Remove />
          </IconButton>

          {editingSpeed ? (
            <Box
              component="input"
              ref={speedInputRef}
              value={speedInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSpeedInput(e.target.value)}
              onBlur={commitSpeed}
              onKeyDown={handleSpeedKeyDown}
              sx={{
                width: 56,
                height: 32,
                border: '1px solid',
                borderColor: 'primary.main',
                borderRadius: '16px',
                textAlign: 'center',
                fontSize: '0.95rem',
                fontWeight: 700,
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
                variant="outlined"
                onClick={handleSpeedClick}
                sx={{ minWidth: 56, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
              />
            </Tooltip>
          )}

          <IconButton
            onClick={increaseSpeed}
            disabled={speed >= 4}
            size="small"
          >
            <Add />
          </IconButton>
        </Stack>
      </Box>

      <Divider />

      {/* Volume */}
      <Box sx={{ px: 2, py: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Volume
        </Typography>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Tooltip title={isMuted ? 'Unmute' : 'Mute'}>
            <IconButton onClick={onMuteToggle} size="small">
              <VolumeIcon />
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
          />
          <Typography variant="body2" sx={{ minWidth: 32, textAlign: 'right' }}>
            {Math.round((isMuted ? 0 : volume) * 100)}%
          </Typography>
        </Stack>
      </Box>

      <Divider />

      {/* Play Button */}
      <Box sx={{ px: 2, py: 2, display: 'flex', justifyContent: 'center' }}>
        <IconButton
          onClick={onPlay}
          disabled={!hasText}
          color="primary"
          size="large"
          sx={{
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            width: 56,
            height: 56,
            '&:hover': {
              bgcolor: 'primary.dark',
            },
            '&.Mui-disabled': {
              bgcolor: 'action.disabledBackground',
              color: 'action.disabled',
            },
          }}
          aria-label="Play"
        >
          <PlayArrow sx={{ fontSize: 32 }} />
        </IconButton>
      </Box>

      <Divider />

      {/* Font Size */}
      <Box sx={{ px: 2, py: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Font Size
        </Typography>
        <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
          <IconButton
            onClick={decreaseFontSize}
            disabled={fontSize <= 12}
            size="small"
          >
            <Remove />
          </IconButton>

          <Chip
            label={`${fontSize}px`}
            variant="outlined"
            sx={{ minWidth: 56, fontWeight: 700, fontSize: '0.95rem' }}
          />

          <IconButton
            onClick={increaseFontSize}
            disabled={fontSize >= 32}
            size="small"
          >
            <Add />
          </IconButton>
        </Stack>
      </Box>
    </Drawer>
  );
};

export default SettingsDrawer;

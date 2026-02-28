import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
} from '@mui/material';
import { Close, PlayArrow, Stop } from '@mui/icons-material';
import type { PlaybackStatus } from '../../hooks/useTTS';
import type { VoiceInfo } from '../../hooks/useVoices';
import TextInputSection from './TextInputSection';
import VoiceSelector from '../common/VoiceSelector';
import StepperControl from '../common/StepperControl';
import VolumeControl from '../common/VolumeControl';

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
  status: PlaybackStatus;
  onPlay: () => void;
  onStop: () => void;
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

/** Labeled section wrapper */
const Section: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <Box sx={{ px: 2, py: 2 }}>
    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
      {label}
    </Typography>
    {children}
  </Box>
);

const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  open,
  onClose,
  text,
  onTextChange,
  onClear,
  textDisabled,
  status,
  onPlay,
  onStop,
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
}) => (
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

    {/* Text */}
    <TextInputSection
      text={text}
      onTextChange={onTextChange}
      onClear={onClear}
      disabled={textDisabled}
    />

    <Divider />

    {/* Voice */}
    <Section label="Voice">
      <VoiceSelector
        voices={voices}
        selectedVoiceName={selectedVoiceName}
        onVoiceChange={onVoiceChange}
      />
    </Section>

    <Divider />

    {/* Speed */}
    <Section label="Speed">
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <StepperControl
          value={speed}
          min={0.5}
          max={4}
          step={0.05}
          label="speed"
          formatLabel={(v) => `${v}x`}
          onChange={onSpeedChange}
          editable
        />
      </Box>
    </Section>

    <Divider />

    {/* Volume */}
    <Section label="Volume">
      <VolumeControl
        volume={volume}
        isMuted={isMuted}
        onVolumeChange={onVolumeChange}
        onMuteToggle={onMuteToggle}
      />
    </Section>

    <Divider />

    {/* Play / Stop toggle button */}
    <Box sx={{ px: 2, py: 2, display: 'flex', justifyContent: 'center' }}>
      <IconButton
        onClick={status === 'playing' ? onStop : onPlay}
        disabled={!hasText}
        color="primary"
        size="large"
        sx={{
          bgcolor: status === 'playing' ? 'error.main' : 'primary.main',
          color: status === 'playing' ? 'error.contrastText' : 'primary.contrastText',
          width: 56,
          height: 56,
          '&:hover': { bgcolor: status === 'playing' ? 'error.dark' : 'primary.dark' },
          '&.Mui-disabled': {
            bgcolor: 'action.disabledBackground',
            color: 'action.disabled',
          },
        }}
        aria-label={status === 'playing' ? 'Stop' : 'Play'}
      >
        {status === 'playing' ? (
          <Stop sx={{ fontSize: 32 }} />
        ) : (
          <PlayArrow sx={{ fontSize: 32 }} />
        )}
      </IconButton>
    </Box>

    <Divider />

    {/* Font Size */}
    <Section label="Font Size">
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <StepperControl
          value={fontSize}
          min={12}
          max={32}
          step={2}
          label="font size"
          formatLabel={(v) => `${v}px`}
          onChange={onFontSizeChange}
        />
      </Box>
    </Section>
  </Drawer>
);

export default SettingsDrawer;

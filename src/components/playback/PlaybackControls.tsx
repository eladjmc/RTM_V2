import React from 'react';
import { Box, Stack, Typography, Chip } from '@mui/material';
import type { PlaybackStatus } from '../../hooks/useTTS';
import type { VoiceInfo } from '../../hooks/useVoices';
import TransportButtons from './TransportButtons';
import VoiceSelector from '../common/VoiceSelector';
import StepperControl from '../common/StepperControl';
import VolumeControl from '../common/VolumeControl';

interface PlaybackControlsProps {
  status: PlaybackStatus;
  hasText: boolean;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onReset: () => void;
  onSkipForward: () => void;
  onSkipBackward: () => void;
  voices: VoiceInfo[];
  selectedVoiceName: string;
  onVoiceChange: (voiceName: string) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  isMuted: boolean;
  onMuteToggle: () => void;
  showVoicePicker?: boolean;
  statusHint?: string;
}

/** Vertical divider — hidden on mobile */
const Divider = () => (
  <Box
    sx={{
      width: '1px',
      height: 28,
      bgcolor: 'divider',
      mx: 0.5,
      display: { xs: 'none', sm: 'block' },
    }}
  />
);

const PlaybackControls: React.FC<PlaybackControlsProps> = (props) => (
  <Box
    sx={{
      flexShrink: 0,
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
      flexWrap="wrap"
      alignItems="center"
      justifyContent="center"
      sx={{ gap: { xs: 0.5, sm: 1 } }}
    >
      {/* Full-width on phone so transport wraps to its own row */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="center"
        sx={{
          width: { xs: '100%', sm: 'auto' },
          gap: { xs: 0.25, sm: 1 },
        }}
      >
        <TransportButtons
          status={props.status}
          hasText={props.hasText}
          onPlay={props.onPlay}
          onPause={props.onPause}
          onResume={props.onResume}
          onStop={props.onStop}
          onReset={props.onReset}
          onSkipForward={props.onSkipForward}
          onSkipBackward={props.onSkipBackward}
        />
      </Stack>

      <Divider />

      {props.showVoicePicker !== false ? (
        <>
          <VoiceSelector
            voices={props.voices}
            selectedVoiceName={props.selectedVoiceName}
            onVoiceChange={props.onVoiceChange}
            compact
          />
          <Divider />
        </>
      ) : (
        <>
          <Chip
            label="Server Zira"
            size="small"
            variant="outlined"
            sx={{ mx: 0.5, display: { xs: 'none', sm: 'flex' } }}
          />
          <Divider />
        </>
      )}

      {props.statusHint && (
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, display: { xs: 'none', md: 'block' } }}>
          {props.statusHint}
        </Typography>
      )}

      <StepperControl
        value={props.speed}
        min={0.5}
        max={4}
        step={0.05}
        label="speed"
        formatLabel={(v) => `${v}x`}
        onChange={props.onSpeedChange}
        editable
        size="small"
        hideButtons
      />

      <Box sx={{ width: '1px', height: 28, bgcolor: 'divider', mx: 0.5 }} />

      <VolumeControl
        volume={props.volume}
        isMuted={props.isMuted}
        onVolumeChange={props.onVolumeChange}
        onMuteToggle={props.onMuteToggle}
        compact
      />
    </Stack>
  </Box>
);

export default PlaybackControls;

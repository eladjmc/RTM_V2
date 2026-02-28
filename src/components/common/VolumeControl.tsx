import React from 'react';
import { Stack, IconButton, Slider, Tooltip, Typography } from '@mui/material';
import { VolumeUp, VolumeOff, VolumeDown } from '@mui/icons-material';

interface VolumeControlProps {
  volume: number;
  isMuted: boolean;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  /** Compact mode for toolbar */
  compact?: boolean;
}

const VolumeControl: React.FC<VolumeControlProps> = ({
  volume,
  isMuted,
  onVolumeChange,
  onMuteToggle,
  compact = false,
}) => {
  const displayVolume = isMuted ? 0 : volume;

  const handleSliderChange = (_: Event, value: number | number[]) => {
    onVolumeChange(value as number);
  };

  const iconSize = compact ? 'small' : ('medium' as const);
  const icon =
    isMuted || volume === 0 ? (
      <VolumeOff fontSize={iconSize} />
    ) : volume < 0.5 ? (
      <VolumeDown fontSize={iconSize} />
    ) : (
      <VolumeUp fontSize={iconSize} />
    );

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={compact ? 0.5 : 1.5}
      sx={compact ? { minWidth: { xs: 80, sm: 120 } } : undefined}
    >
      <Tooltip title={isMuted ? 'Unmute' : 'Mute'}>
        <IconButton onClick={onMuteToggle} size="small" aria-label="Toggle mute">
          {icon}
        </IconButton>
      </Tooltip>

      <Slider
        value={displayVolume}
        onChange={handleSliderChange}
        min={0}
        max={1}
        step={0.05}
        size="small"
        aria-label="Volume"
        sx={compact ? { width: { xs: 50, sm: 80 } } : undefined}
      />

      {!compact && (
        <Typography variant="body2" sx={{ minWidth: 32, textAlign: 'right' }}>
          {Math.round(displayVolume * 100)}%
        </Typography>
      )}
    </Stack>
  );
};

export default VolumeControl;

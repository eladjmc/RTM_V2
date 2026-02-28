import React from 'react';
import { Select, MenuItem, FormControl } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import type { VoiceInfo } from '../../hooks/useVoices';

interface VoiceSelectorProps {
  voices: VoiceInfo[];
  selectedVoiceName: string;
  onVoiceChange: (voiceName: string) => void;
  /** Compact mode for toolbar */
  compact?: boolean;
}

const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  voices,
  selectedVoiceName,
  onVoiceChange,
  compact = false,
}) => {
  const handleChange = (event: SelectChangeEvent<string>) => {
    onVoiceChange(event.target.value);
  };

  return (
    <FormControl
      size="small"
      fullWidth={!compact}
      sx={
        compact
          ? { minWidth: 140, maxWidth: 220, display: { xs: 'none', sm: 'inline-flex' } }
          : undefined
      }
    >
      <Select
        value={selectedVoiceName}
        onChange={handleChange}
        displayEmpty
        sx={{ fontSize: compact ? '0.8rem' : '0.85rem', height: compact ? 32 : undefined }}
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
  );
};

export default VoiceSelector;

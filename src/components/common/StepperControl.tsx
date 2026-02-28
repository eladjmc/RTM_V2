import React, { useState, useRef } from 'react';
import { IconButton, Chip, Tooltip, Stack, Box } from '@mui/material';
import { Add, Remove } from '@mui/icons-material';

interface StepperControlProps {
  value: number;
  min: number;
  max: number;
  step: number;
  label: string;
  formatLabel?: (value: number) => string;
  onChange: (value: number) => void;
  /** Allow click-to-edit on the chip */
  editable?: boolean;
  size?: 'small' | 'medium';
}

/**
 * Generic +/chip/- stepper control.
 * Used for speed, font size, and any future numeric steppers.
 */
const StepperControl: React.FC<StepperControlProps> = ({
  value,
  min,
  max,
  step,
  label,
  formatLabel = (v) => String(v),
  onChange,
  editable = false,
  size = 'medium',
}) => {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const decrease = () => onChange(Math.max(min, +(value - step).toFixed(2)));
  const increase = () => onChange(Math.min(max, +(value + step).toFixed(2)));

  const startEditing = () => {
    if (!editable) return;
    setInputValue(String(value));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = () => {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed) && parsed >= min && parsed <= max) {
      onChange(+parsed.toFixed(2));
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') setEditing(false);
  };

  const isSmall = size === 'small';

  return (
    <Stack direction="row" alignItems="center" spacing={isSmall ? 0 : 1}>
      <Tooltip title={`Decrease ${label}`}>
        <span>
          <IconButton
            onClick={decrease}
            disabled={value <= min}
            size="small"
            aria-label={`Decrease ${label}`}
          >
            <Remove fontSize={isSmall ? 'small' : 'medium'} />
          </IconButton>
        </span>
      </Tooltip>

      {editing ? (
        <Box
          component="input"
          ref={inputRef}
          value={inputValue}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setInputValue(e.target.value)
          }
          onBlur={commit}
          onKeyDown={handleKeyDown}
          sx={{
            width: isSmall ? 48 : 56,
            height: isSmall ? 24 : 32,
            border: '1px solid',
            borderColor: 'primary.main',
            borderRadius: isSmall ? '12px' : '16px',
            textAlign: 'center',
            fontSize: isSmall ? '0.8rem' : '0.95rem',
            fontWeight: 700,
            outline: 'none',
            bgcolor: 'background.paper',
            color: 'text.primary',
            px: 0.5,
          }}
        />
      ) : (
        <Tooltip title={editable ? `Click to type ${label}` : ''}>
          <Chip
            label={formatLabel(value)}
            size={isSmall ? 'small' : 'medium'}
            variant="outlined"
            onClick={editable ? startEditing : undefined}
            sx={{
              minWidth: isSmall ? 48 : 56,
              fontWeight: isSmall ? 600 : 700,
              fontSize: isSmall ? '0.8rem' : '0.95rem',
              cursor: editable ? 'pointer' : 'default',
            }}
          />
        </Tooltip>
      )}

      <Tooltip title={`Increase ${label}`}>
        <span>
          <IconButton
            onClick={increase}
            disabled={value >= max}
            size="small"
            aria-label={`Increase ${label}`}
          >
            <Add fontSize={isSmall ? 'small' : 'medium'} />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
};

export default StepperControl;

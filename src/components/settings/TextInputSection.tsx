import React from 'react';
import { Box, Typography, Stack, Button } from '@mui/material';
import { Clear } from '@mui/icons-material';

interface TextInputSectionProps {
  text: string;
  onTextChange: (text: string) => void;
  onClear: () => void;
  disabled: boolean;
}

const TextInputSection: React.FC<TextInputSectionProps> = ({
  text,
  onTextChange,
  onClear,
  disabled,
}) => (
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
      disabled={disabled}
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
        '&:focus': { borderColor: 'primary.main' },
        '&:disabled': { opacity: 0.6, cursor: 'not-allowed' },
      }}
    />
    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
      <Button
        variant="outlined"
        size="small"
        startIcon={<Clear />}
        onClick={onClear}
        disabled={disabled || !text}
      >
        Clear
      </Button>
    </Stack>
  </Box>
);

export default TextInputSection;

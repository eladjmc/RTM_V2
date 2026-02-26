import React from 'react';
import { Box, TextField, Button, Stack } from '@mui/material';
import { Clear, MenuBook } from '@mui/icons-material';

interface TextInputProps {
  text: string;
  onTextChange: (text: string) => void;
  onClear: () => void;
  disabled: boolean;
}

const SAMPLE_TEXT = `Soon, the immersive simulation ended, and Su Xing returned to reality, but the excitement on his face was hard to hide.

"Luo Binger... even at the Earth Immortal Realm, the legacy treasures she carried were already so many!"

"Then if it's Ghost Grandma's Dao companion, that True Immortal Realm cultivator... how many legacies would he be carrying!?"

Su Xing took a deep breath.

According to his thoughts, the Luo Tian Sect must surely know the principle of not putting all eggs in one basket.

That stronger Li Yun True Immortal, was clearly the bigger basket, able to hold more eggs!
If Su Xing could reach the Green Wood Realm... perhaps he could obtain an even greater legacy?

"However... it's not certain, maybe Li Yun True Immortal has already rebuilt the Luo Tian Sect, just hiding in the shadows?"

Su Xing murmured.

But in any case, the Green Wood Realm, he had to visit in the future!

"But right now, the Spirit Race's legacy... must also be obtained as soon as possible!"`;

const TextInput: React.FC<TextInputProps> = ({
  text,
  onTextChange,
  onClear,
  disabled,
}) => {
  return (
    <Box sx={{ px: { xs: 1, sm: 3 }, py: 2, maxWidth: '720px', mx: 'auto' }}>
      <TextField
        multiline
        fullWidth
        minRows={6}
        maxRows={20}
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Paste or type your text here..."
        disabled={disabled}
        variant="outlined"
        sx={{
          '& .MuiOutlinedInput-root': {
            fontSize: '1.05rem',
            lineHeight: 1.7,
          },
        }}
        aria-label="Text input"
      />
      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Clear />}
          onClick={onClear}
          disabled={disabled || !text}
        >
          Clear
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<MenuBook />}
          onClick={() => onTextChange(SAMPLE_TEXT)}
          disabled={disabled || !!text}
        >
          Load Sample Text
        </Button>
      </Stack>
    </Box>
  );
};

export default TextInput;

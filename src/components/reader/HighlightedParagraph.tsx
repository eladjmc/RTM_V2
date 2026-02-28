import React from 'react';
import { Box } from '@mui/material';
import type { ParagraphInfo } from '../../utils/textParser';

interface HighlightedParagraphProps {
  paragraph: ParagraphInfo;
  currentWordIndex: number;
}

/**
 * Renders a paragraph with the current word highlighted.
 */
const HighlightedParagraph: React.FC<HighlightedParagraphProps> = ({
  paragraph,
  currentWordIndex,
}) => {
  if (currentWordIndex < 0 || paragraph.words.length === 0) {
    return <>{paragraph.text}</>;
  }

  const nodes: React.ReactNode[] = [];
  let lastEnd = 0;

  paragraph.words.forEach((word, wIndex) => {
    if (word.startOffset > lastEnd) {
      nodes.push(paragraph.text.slice(lastEnd, word.startOffset));
    }

    const isActive = wIndex === currentWordIndex;

    nodes.push(
      <Box
        component="span"
        key={wIndex}
        sx={{
          backgroundColor: isActive ? 'primary.main' : 'transparent',
          color: isActive ? 'primary.contrastText' : 'inherit',
          borderRadius: '3px',
          px: '2px',
          mx: '-2px',
          transition: 'background-color 0.1s ease, color 0.1s ease',
        }}
      >
        {word.text}
      </Box>
    );

    lastEnd = word.endOffset;
  });

  if (lastEnd < paragraph.text.length) {
    nodes.push(paragraph.text.slice(lastEnd));
  }

  return <>{nodes}</>;
};

export default HighlightedParagraph;

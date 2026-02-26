import React, { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import type { ParagraphInfo } from '../utils/textParser';
import type { PlaybackStatus } from '../hooks/useTTS';

interface ReadingPaneProps {
  paragraphs: ParagraphInfo[];
  currentParagraphIndex: number;
  currentWordIndex: number;
  status: PlaybackStatus;
  onParagraphClick: (index: number) => void;
  fontSize?: number;
}

const ReadingPane: React.FC<ReadingPaneProps> = ({
  paragraphs,
  currentParagraphIndex,
  currentWordIndex,
  status,
  onParagraphClick,
  fontSize = 18,
}) => {
  const activeParagraphRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to the active paragraph
  useEffect(() => {
    if (status !== 'idle' && activeParagraphRef.current) {
      activeParagraphRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentParagraphIndex, status]);

  if (paragraphs.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '300px',
          color: 'text.secondary',
        }}
      >
        <Typography variant="h6" color="text.secondary">
          Enter some text above to get started
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        maxWidth: '960px',
        mx: 'auto',
        py: 2,
        px: { xs: 1, sm: 3 },
        userSelect: status !== 'idle' ? 'none' : 'text',
        overflowWrap: 'break-word',
        wordBreak: 'break-word',
      }}
    >
      {paragraphs.map((paragraph, pIndex) => {
        const isActiveParagraph =
          status !== 'idle' && pIndex === currentParagraphIndex;

        return (
          <Box
            key={pIndex}
            ref={isActiveParagraph ? activeParagraphRef : undefined}
            onClick={() => onParagraphClick(pIndex)}
            sx={{
              py: 1.5,
              px: { xs: 1, sm: 2 },
              my: 0.5,
              borderRadius: 1,
              cursor: 'pointer',
              transition: 'background-color 0.2s ease',
              backgroundColor: isActiveParagraph
                ? 'action.selected'
                : 'transparent',
              '&:hover': {
                backgroundColor: isActiveParagraph
                  ? 'action.selected'
                  : 'action.hover',
              },
            }}
          >
            <Typography
              component="div"
              variant="body1"
              sx={{
                lineHeight: 1.8,
                fontSize: `${fontSize}px`,
                whiteSpace: 'pre-wrap',
              }}
            >
              {isActiveParagraph
                ? renderHighlightedParagraph(paragraph, currentWordIndex)
                : paragraph.text}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

/**
 * Renders a paragraph with the current word highlighted.
 */
function renderHighlightedParagraph(
  paragraph: ParagraphInfo,
  currentWordIndex: number
): React.ReactNode {
  if (currentWordIndex < 0 || paragraph.words.length === 0) {
    return paragraph.text;
  }

  const nodes: React.ReactNode[] = [];
  let lastEnd = 0;

  paragraph.words.forEach((word, wIndex) => {
    // Add text between words (spaces, punctuation gaps)
    if (word.startOffset > lastEnd) {
      nodes.push(paragraph.text.slice(lastEnd, word.startOffset));
    }

    const isActiveWord = wIndex === currentWordIndex;

    nodes.push(
      <Box
        component="span"
        key={wIndex}
        sx={{
          backgroundColor: isActiveWord ? 'primary.main' : 'transparent',
          color: isActiveWord ? 'primary.contrastText' : 'inherit',
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

  // Add any remaining text after the last word
  if (lastEnd < paragraph.text.length) {
    nodes.push(paragraph.text.slice(lastEnd));
  }

  return nodes;
}

export default ReadingPane;

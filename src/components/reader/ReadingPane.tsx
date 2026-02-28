import React, { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import type { ParagraphInfo } from '../../utils/textParser';
import type { PlaybackStatus } from '../../hooks/useTTS';
import HighlightedParagraph from './HighlightedParagraph';
import EmptyState from './EmptyState';

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

  useEffect(() => {
    if (status !== 'idle' && activeParagraphRef.current) {
      activeParagraphRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentParagraphIndex, status]);

  if (paragraphs.length === 0) return <EmptyState />;

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
        const isActive = status !== 'idle' && pIndex === currentParagraphIndex;

        return (
          <Box
            key={pIndex}
            ref={isActive ? activeParagraphRef : undefined}
            onClick={() => onParagraphClick(pIndex)}
            sx={{
              py: 1.5,
              px: { xs: 1, sm: 2 },
              my: 0.5,
              borderRadius: 1,
              cursor: 'pointer',
              transition: 'background-color 0.2s ease',
              backgroundColor: isActive ? 'action.selected' : 'transparent',
              '&:hover': {
                backgroundColor: isActive ? 'action.selected' : 'action.hover',
              },
            }}
          >
            <Typography
              component="div"
              variant="body1"
              sx={{ lineHeight: 1.8, fontSize: `${fontSize}px`, whiteSpace: 'pre-wrap' }}
            >
              {isActive ? (
                <HighlightedParagraph
                  paragraph={paragraph}
                  currentWordIndex={currentWordIndex}
                />
              ) : (
                paragraph.text
              )}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

export default ReadingPane;

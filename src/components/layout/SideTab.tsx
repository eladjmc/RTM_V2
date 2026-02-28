import React from 'react';
import { Box } from '@mui/material';
import { ChevronRight } from '@mui/icons-material';

interface SideTabProps {
  visible: boolean;
  onClick: () => void;
  /** Which edge: left or right */
  side?: 'left' | 'right';
}

const SideTab: React.FC<SideTabProps> = ({ visible, onClick, side = 'left' }) => {
  if (!visible) return null;

  const isLeft = side === 'left';

  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'fixed',
        [side]: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: (t) => t.zIndex.drawer - 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 64,
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        borderRadius: isLeft ? '0 8px 8px 0' : '8px 0 0 8px',
        cursor: 'pointer',
        opacity: 0.7,
        transition: 'opacity 0.2s, width 0.2s',
        '&:hover': { opacity: 1, width: 30 },
      }}
      aria-label={`Open ${side} panel`}
    >
      <ChevronRight
        fontSize="small"
        sx={isLeft ? undefined : { transform: 'rotate(180deg)' }}
      />
    </Box>
  );
};

export default SideTab;

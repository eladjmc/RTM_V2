import React from 'react';
import { Box, Typography } from '@mui/material';

const EmptyState: React.FC = () => (
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
      Enter some text to get started
    </Typography>
  </Box>
);

export default EmptyState;

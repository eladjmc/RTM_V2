import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';
import CloseIcon from '@mui/icons-material/Close';
import { _lines, _listeners } from '../utils/debugLog';

/**
 * Floating debug overlay — toggled by a small bug icon in the bottom-right.
 * Only renders in non-production or when explicitly enabled.
 */
export default function DebugOverlay() {
  const [open, setOpen] = useState(false);
  const [, rerender] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Subscribe to new log lines
  useEffect(() => {
    const cb = () => rerender((n) => n + 1);
    _listeners.add(cb);
    return () => { _listeners.delete(cb); };
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  });

  const clear = useCallback(() => {
    _lines.length = 0;
    rerender((n) => n + 1);
  }, []);

  return (
    <>
      {/* Toggle button */}
      <IconButton
        onClick={() => setOpen((o) => !o)}
        sx={{
          position: 'fixed',
          bottom: 72,
          right: 8,
          zIndex: 9999,
          bgcolor: 'rgba(0,0,0,0.5)',
          color: '#0f0',
          width: 36,
          height: 36,
          '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
        }}
        size="small"
      >
        {open ? <CloseIcon fontSize="small" /> : <BugReportIcon fontSize="small" />}
      </IconButton>

      {/* Log panel */}
      {open && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 114,
            right: 8,
            left: 8,
            maxHeight: '40vh',
            bgcolor: 'rgba(0,0,0,0.88)',
            color: '#0f0',
            borderRadius: 1,
            zIndex: 9998,
            overflow: 'auto',
            p: 1,
            fontFamily: 'monospace',
            fontSize: '11px',
            lineHeight: 1.4,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: '#0f0', fontFamily: 'monospace' }}>
              TTS Debug Log ({_lines.length})
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: '#f88', fontFamily: 'monospace', cursor: 'pointer' }}
              onClick={clear}
            >
              CLEAR
            </Typography>
          </Box>
          {_lines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
          <div ref={bottomRef} />
        </Box>
      )}
    </>
  );
}

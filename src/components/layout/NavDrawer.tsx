import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
  IconButton,
} from '@mui/material';
import {
  Headphones,
  MenuBook,
  Logout,
  Close,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router';
import { useAuth } from '../../hooks/useAuth';

interface NavDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function NavDrawer({ open, onClose }: NavDrawerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const isLibrary = location.pathname.startsWith('/library');

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: 240 } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          Navigation
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <Close fontSize="small" />
        </IconButton>
      </Box>

      <Divider />

      <List sx={{ flex: 1 }}>
        <ListItemButton
          selected={!isLibrary}
          onClick={() => handleNav('/')}
        >
          <ListItemIcon><Headphones /></ListItemIcon>
          <ListItemText primary="Reader" />
        </ListItemButton>

        <ListItemButton
          selected={isLibrary}
          onClick={() => handleNav('/library')}
        >
          <ListItemIcon><MenuBook /></ListItemIcon>
          <ListItemText primary="Library" />
        </ListItemButton>
      </List>

      <Divider />

      <List>
        <ListItemButton
          onClick={() => { logout(); onClose(); }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon sx={{ color: 'inherit' }}><Logout /></ListItemIcon>
          <ListItemText primary="Logout" />
        </ListItemButton>
      </List>
    </Drawer>
  );
}

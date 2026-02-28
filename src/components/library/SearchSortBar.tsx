import {
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  InputAdornment,
  Stack,
  Tooltip,
  Button,
} from '@mui/material';
import {
  Search,
  SortByAlpha,
  LibraryBooks,
  Schedule,
  AccessTime,
  Add,
} from '@mui/icons-material';
import type { SortOption } from '../../hooks/useFilteredBooks';

interface SearchSortBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sort: SortOption;
  onSortChange: (value: SortOption) => void;
  onAdd: () => void;
}

export default function SearchSortBar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  onAdd,
}: SearchSortBarProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.5}
      alignItems={{ sm: 'center' }}
      sx={{ mb: 2 }}
    >
      <Button
        variant="contained"
        size="small"
        startIcon={<Add />}
        onClick={onAdd}
        sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
      >
        New Book
      </Button>

      <TextField
        size="small"
        placeholder="Search books…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
        sx={{ minWidth: 200, maxWidth: { xs: '100%', sm: 300 } }}
      />

      <ToggleButtonGroup
        size="small"
        exclusive
        value={sort}
        onChange={(_, v) => v && onSortChange(v as SortOption)}
      >
        <ToggleButton value="added">
          <Tooltip title="Last added">
            <Schedule fontSize="small" />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="read">
          <Tooltip title="Last read">
            <AccessTime fontSize="small" />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="name">
          <Tooltip title="Name">
            <SortByAlpha fontSize="small" />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="chapters">
          <Tooltip title="Chapters">
            <LibraryBooks fontSize="small" />
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );
}

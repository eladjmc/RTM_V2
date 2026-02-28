import { useMemo, useState } from 'react';
import type { Book } from '../types/models';

export type SortOption = 'added' | 'name' | 'chapters' | 'read';

export function useFilteredBooks(books: Book[]) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('added');

  const displayedBooks = useMemo(() => {
    let filtered = books;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((b) => b.title.toLowerCase().includes(q));
    }

    const sorted = [...filtered];
    switch (sort) {
      case 'name':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'chapters':
        sorted.sort((a, b) => b.chapterCount - a.chapterCount);
        break;
      case 'read':
        sorted.sort((a, b) => {
          const aTime = a.lastReadAt ? new Date(a.lastReadAt).getTime() : 0;
          const bTime = b.lastReadAt ? new Date(b.lastReadAt).getTime() : 0;
          return bTime - aTime;
        });
        break;
      case 'added':
      default:
        sorted.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
    }

    return sorted;
  }, [books, search, sort]);

  return { search, setSearch, sort, setSort, displayedBooks };
}

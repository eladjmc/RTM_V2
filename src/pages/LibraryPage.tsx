import { useState, useEffect, useCallback } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import type { Book } from '../types/models';
import { bookService } from '../services/bookService';
import { useFilteredBooks } from '../hooks/useFilteredBooks';
import { useChapterLoader } from '../hooks/useChapterLoader';
import BookCard from '../components/library/BookCard';
import SearchSortBar from '../components/library/SearchSortBar';
import AddBookDialog from '../components/library/AddBookDialog';
import ConfirmDeleteDialog from '../components/library/ConfirmDeleteDialog';
import ChaptersModal from '../components/library/ChaptersModal';

export default function LibraryPage() {
  const { loadBook, loadChapter } = useChapterLoader();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [deletingBook, setDeletingBook] = useState<Book | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const { search, setSearch, sort, setSort, displayedBooks } = useFilteredBooks(books);

  const fetchBooks = useCallback(() => {
    bookService
      .getAll()
      .then(setBooks)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    bookService
      .getAll()
      .then(setBooks)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleAddBook = async (data: { title: string; author?: string; cover?: string }) => {
    await bookService.create(data);
    fetchBooks();
  };

  const handleEditBook = async (data: { title: string; author?: string; cover?: string }) => {
    if (!editingBook) return;
    await bookService.update(editingBook._id, data);
    setEditingBook(null);
    fetchBooks();
  };

  const handleDeleteBook = async (book: Book) => {
    setDeleteLoading(true);
    try {
      await bookService.delete(book._id);
      setDeletingBook(null);
      fetchBooks();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handlePlayBook = (book: Book) => {
    loadBook(book).catch(console.error);
  };

  const handlePlayChapter = (bookId: string, chapterId: string) => {
    // Find the book to get its title
    const book = books.find((b) => b._id === bookId);
    loadChapter(bookId, book?.title ?? '', chapterId).catch(console.error);
  };

  const handleChapterDeleted = () => {
    fetchBooks();
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: 'auto', width: '100%' }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
        Library
      </Typography>

      <SearchSortBar
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        onAdd={() => setAddOpen(true)}
      />

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : books.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 8 }}>
          No books yet. Click "New Book" to get started.
        </Typography>
      ) : displayedBooks.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No books match your search.
        </Typography>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            justifyContent: { xs: 'center', sm: 'flex-start' },
          }}
        >
          {displayedBooks.map((book) => (
            <BookCard
              key={book._id}
              book={book}
              onClick={setSelectedBook}
              onEdit={setEditingBook}
              onDelete={setDeletingBook}
              onPlay={handlePlayBook}
            />
          ))}
        </Box>
      )}

      <AddBookDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={handleAddBook}
      />

      <AddBookDialog
        open={!!editingBook}
        onClose={() => setEditingBook(null)}
        onSave={handleEditBook}
        initialData={editingBook ? { title: editingBook.title, author: editingBook.author, cover: editingBook.cover } : undefined}
      />

      <ConfirmDeleteDialog
        book={deletingBook}
        onClose={() => setDeletingBook(null)}
        onConfirm={handleDeleteBook}
        loading={deleteLoading}
      />

      <ChaptersModal
        book={selectedBook}
        onClose={() => setSelectedBook(null)}
        onChapterDeleted={handleChapterDeleted}
        onPlayChapter={handlePlayChapter}
      />
    </Box>
  );
}

import { Routes, Route } from 'react-router';
import ProtectedRoute from '../components/routing/ProtectedRoute';
import PublicRoute from '../components/routing/PublicRoute';
import AuthenticatedLayout from '../components/layout/AuthenticatedLayout';
import LoginPage from '../pages/LoginPage';
import ReaderPage from '../pages/ReaderPage';
import LibraryPage from '../pages/LibraryPage';
import ChapterEditorPage from '../pages/ChapterEditorPage';

export default function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<AuthenticatedLayout />}>
          <Route path="/" element={<ReaderPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/library/books/:bookId/chapters/new" element={<ChapterEditorPage />} />
          <Route path="/library/books/:bookId/chapters/:chapterId/edit" element={<ChapterEditorPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

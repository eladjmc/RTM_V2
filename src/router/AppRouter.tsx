import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router';
import ProtectedRoute from '../components/routing/ProtectedRoute';
import PublicRoute from '../components/routing/PublicRoute';
import AuthenticatedLayout from '../components/layout/AuthenticatedLayout';
import LoginPage from '../pages/LoginPage';
import ReaderPage from '../pages/ReaderPage';
import LibraryPage from '../pages/LibraryPage';
import ChapterEditorPage from '../pages/ChapterEditorPage';

const isLocal = import.meta.env.VITE_ENV === 'local';

const ScraperPage = isLocal
  ? lazy(() => import('../pages/ScraperPage'))
  : () => null;

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
          {isLocal && (
            <Route
              path="/scraper"
              element={
                <Suspense fallback={null}>
                  <ScraperPage />
                </Suspense>
              }
            />
          )}
        </Route>
      </Route>
    </Routes>
  );
}

import api from './api';
import type { Book, BookDetail } from '../types/models';

export const bookService = {
  getAll: () => api.get<Book[]>('/api/books'),

  getById: (id: string) => api.get<BookDetail>(`/api/books/${id}`),

  create: (data: { title: string; author?: string; cover?: string }) =>
    api.post<Book>('/api/books', data),

  update: (id: string, data: { title?: string; author?: string; cover?: string }) =>
    api.put<Book>(`/api/books/${id}`, data),

  delete: (id: string) => api.delete<{ message: string }>(`/api/books/${id}`),

  saveProgress: (
    bookId: string,
    data: { chapterId: string; chapterNumber: number; paragraphIndex: number; wordIndex: number },
  ) => api.put<Book>(`/api/books/${bookId}/progress`, data),
};

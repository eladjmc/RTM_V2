import api from './api';
import type { Chapter, ChapterSummary } from '../types/models';

export const chapterService = {
  getByBook: (bookId: string) =>
    api.get<ChapterSummary[]>(`/api/books/${bookId}/chapters`),

  getNextChapterNumber: (bookId: string) =>
    api.get<{ nextChapterNumber: number }>(`/api/books/${bookId}/chapters/next-number`),

  getById: (id: string) => api.get<Chapter>(`/api/chapters/${id}`),

  create: (bookId: string, data: { title?: string; content: string; chapterNumber?: number }) =>
    api.post<Chapter>(`/api/books/${bookId}/chapters`, data),

  update: (id: string, data: { title?: string; content?: string }) =>
    api.put<Chapter>(`/api/chapters/${id}`, data),

  delete: (id: string) =>
    api.delete<{ message: string }>(`/api/chapters/${id}`),
};

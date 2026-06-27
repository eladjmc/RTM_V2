const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export type ListenJobChapterStatus = 'pending' | 'loading' | 'ready' | 'error';

export interface ListenJobChapter {
  chapterNumber: number;
  title: string;
  status: ListenJobChapterStatus;
}

export interface ListenJobStatus {
  jobId: string;
  bookId: string;
  bookTitle: string;
  startChapter: number;
  endChapter: number;
  provider: 'sapi' | 'edge';
  voice: string;
  rate: number;
  status: 'running' | 'complete' | 'failed';
  readyCount: number;
  totalCount: number;
  loadingChapter: number | null;
  combinedReady: boolean;
  chapters: ListenJobChapter[];
  createdAt: string;
  error?: string;
}

export interface ListenJobSummary {
  jobId: string;
  bookId: string;
  bookTitle: string;
  startChapter: number;
  endChapter: number;
  provider: 'sapi' | 'edge';
  voice: string;
  rate: number;
  status: 'running' | 'complete' | 'failed';
  readyCount: number;
  totalCount: number;
  combinedReady: boolean;
  createdAt: string;
  error?: string;
}

export interface CreateListenJobParams {
  bookId: string;
  startChapterNumber: number;
  chapterCount: number;
  provider?: 'sapi' | 'edge';
  voice?: string;
  rate?: number;
}

async function handleJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) {
    const err = new Error((body as { error?: string }).error || `HTTP ${res.status}`) as Error & {
      data?: unknown;
    };
    err.data = body;
    throw err;
  }
  return body as T;
}

export const listenJobService = {
  createJob: async (params: CreateListenJobParams): Promise<ListenJobStatus> => {
    const res = await fetch(`${API_URL}/api/tts/listen-jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });
    return handleJson(res);
  },

  listJobs: async (): Promise<ListenJobSummary[]> => {
    const res = await fetch(`${API_URL}/api/tts/listen-jobs`, {
      credentials: 'include',
    });
    const body = await handleJson<{ jobs: ListenJobSummary[] }>(res);
    return body.jobs;
  },

  getStatus: async (jobId: string): Promise<ListenJobStatus> => {
    const res = await fetch(`${API_URL}/api/tts/listen-jobs/${jobId}`, {
      credentials: 'include',
    });
    return handleJson(res);
  },

  fetchChapterAudio: async (jobId: string, chapterNumber: number): Promise<Blob> => {
    const res = await fetch(
      `${API_URL}/api/tts/listen-jobs/${jobId}/chapters/${chapterNumber}`,
      { credentials: 'include' },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
    }
    return res.blob();
  },

  downloadCombined: async (jobId: string): Promise<void> => {
    const res = await fetch(`${API_URL}/api/tts/listen-jobs/${jobId}/download`, {
      credentials: 'include',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
    }

    const disposition = res.headers.get('Content-Disposition') || '';
    const filenameMatch = disposition.match(/filename="?(.+?)"?$/);
    const filename = filenameMatch ? filenameMatch[1] : 'combined.mp3';

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },

  deleteJob: async (jobId: string): Promise<void> => {
    await fetch(`${API_URL}/api/tts/listen-jobs/${jobId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  },

  clearServerCache: async (): Promise<{ deletedJobs: number }> => {
    const res = await fetch(`${API_URL}/api/tts/listen-jobs/cache`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const body = await handleJson<{ deletedJobs: number; message: string }>(res);
    return { deletedJobs: body.deletedJobs };
  },
};

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listenJobService,
  type ListenJobStatus,
  type ListenJobChapter,
} from '../services/listenJobService';

export interface ListenOfflineJobConfig {
  jobId: string;
  bookId: string;
  bookTitle: string;
  startChapter: number;
  endChapter: number;
  chapterTitles: Map<number, string>;
  chapterIds: Map<number, string>;
  provider: 'sapi' | 'edge';
  voice: string;
  rate: number;
}

export interface ListenOfflineJobState {
  chapters: ListenJobChapter[];
  readyCount: number;
  totalCount: number;
  loadingChapter: number | null;
  complete: boolean;
  combinedReady: boolean;
  error: string | null;
}

const initialState: ListenOfflineJobState = {
  chapters: [],
  readyCount: 0,
  totalCount: 0,
  loadingChapter: null,
  complete: false,
  combinedReady: false,
  error: null,
};

function mapStatus(status: ListenJobStatus): ListenOfflineJobState {
  return {
    chapters: status.chapters,
    readyCount: status.readyCount,
    totalCount: status.totalCount,
    loadingChapter: status.loadingChapter,
    complete: status.status === 'complete',
    combinedReady: status.combinedReady,
    error: status.error ?? (status.status === 'failed' ? 'Listen job failed' : null),
  };
}

/**
 * Polls a server listen job and fetches chapter audio from the backend.
 */
export function useListenOfflineJob(config: ListenOfflineJobConfig | null) {
  const [state, setState] = useState<ListenOfflineJobState>(initialState);
  const audioCacheRef = useRef<Map<number, Blob>>(new Map());

  const fetchChapterAudio = useCallback(
    async (chapterNumber: number): Promise<Blob> => {
      if (!config) throw new Error('No listen job');
      const cached = audioCacheRef.current.get(chapterNumber);
      if (cached) return cached;

      const blob = await listenJobService.fetchChapterAudio(config.jobId, chapterNumber);
      audioCacheRef.current.set(chapterNumber, blob);
      return blob;
    },
    [config],
  );

  useEffect(() => {
    if (!config) {
      audioCacheRef.current.clear();
      setState(initialState);
      return;
    }

    audioCacheRef.current.clear();
    let cancelled = false;

    const poll = async () => {
      try {
        const status = await listenJobService.getStatus(config.jobId);
        if (cancelled) return;
        setState(mapStatus(status));
      } catch (err) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to load job status',
        }));
      }
    };

    poll();
    const interval = setInterval(poll, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [config]);

  const cancel = useCallback(() => {
    if (config) {
      listenJobService.deleteJob(config.jobId).catch(() => {});
    }
  }, [config]);

  return { state, fetchChapterAudio, cancel };
}

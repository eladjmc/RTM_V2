const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface TtsVoice {
  Name: string;
  ShortName: string;
  Gender: string;
  Locale: string;
  FriendlyName: string;
}

export interface DownloadAudioParams {
  startChapterNumber: number;
  chapterCount: number;
  voice: string;
  rate?: number;
  provider?: 'edge' | 'sapi';
}

export interface TtsChapterError {
  chapterNumber: number;
  title: string;
  characters: number;
}

export interface TtsErrorResponse {
  error: string;
  maxCharacters?: number;
  chapters?: TtsChapterError[];
}

export type TtsChunkProvider = 'sapi' | 'edge';

export interface SynthesizeChunkParams {
  text: string;
  provider?: TtsChunkProvider;
  voice?: string;
  rate?: number;
  volume?: number;
}

export interface TtsChunkCacheKeyParts {
  bookId: string;
  chapterId: string;
  chunkIndex: number;
  provider: TtsChunkProvider;
  voice: string;
  rate: number;
}

/** Stable cache key for IndexedDB chunk storage */
export function buildTtsChunkCacheKey(parts: TtsChunkCacheKeyParts): string {
  const { bookId, chapterId, chunkIndex, provider, voice, rate } = parts;
  return `${bookId}|${chapterId}|c${chunkIndex}|${provider}|${voice}|${rate.toFixed(2)}`;
}

export const ttsService = {
  /** Synthesise a single paragraph chunk for server playback mode. */
  synthesizeChunk: async (params: SynthesizeChunkParams): Promise<Blob> => {
    const res = await fetch(`${API_URL}/api/tts/synthesize-chunk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        text: params.text,
        provider: params.provider ?? 'sapi',
        voice: params.voice,
        rate: params.rate ?? 1.0,
        volume: params.volume ?? 100,
      }),
    });

    if (!res.ok) {
      const body: TtsErrorResponse = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(body.error);
    }

    return res.blob();
  },

  /**
   * Synthesise a full chapter MP3 for listen-while-download mode.
   */
  synthesizeChapterAudio: async (
    bookId: string,
    chapterNumber: number,
    params: Pick<SynthesizeChunkParams, 'provider' | 'voice' | 'rate' | 'volume'>,
  ): Promise<Blob> => {
    const res = await fetch(
      `${API_URL}/api/tts/books/${bookId}/chapters/${chapterNumber}/audio`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider: params.provider ?? 'sapi',
          voice: params.voice,
          rate: params.rate ?? 1.0,
          volume: params.volume ?? 100,
        }),
      },
    );

    if (!res.ok) {
      const body: TtsErrorResponse = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      const err = new Error(body.error) as Error & { data?: TtsErrorResponse };
      err.data = body;
      throw err;
    }

    return res.blob();
  },

  /** Fetch available en-US Edge voices */
  getVoices: async (): Promise<TtsVoice[]> => {
    const res = await fetch(`${API_URL}/api/tts/voices`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  /**
   * Request audio generation and trigger a browser download.
   * Throws an error with structured data if chapters are too long.
   */
  downloadAudio: async (
    bookId: string,
    params: DownloadAudioParams,
  ): Promise<void> => {
    const res = await fetch(`${API_URL}/api/tts/books/${bookId}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const body: TtsErrorResponse = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      const err = new Error(body.error) as Error & { data?: TtsErrorResponse };
      err.data = body;
      throw err;
    }

    // Extract filename from Content-Disposition header
    const disposition = res.headers.get('Content-Disposition') || '';
    const filenameMatch = disposition.match(/filename="?(.+?)"?$/);
    const filename = filenameMatch ? filenameMatch[1] : 'audio.mp3';

    // Download the blob
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

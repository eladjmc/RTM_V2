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

export const ttsService = {
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

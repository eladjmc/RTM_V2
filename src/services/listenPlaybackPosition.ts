export interface ListenPlaybackPosition {
  bookId: string;
  jobId: string;
  startChapter: number;
  endChapter: number;
  chapterNumber: number;
  currentTime: number;
  provider: string;
  voice: string;
  rate: number;
  updatedAt: number;
}

function storageKey(
  bookId: string,
  provider: string,
  voice: string,
  rate: number,
): string {
  return `rtm-listen-pos:${bookId}:${provider}:${voice}:${rate.toFixed(2)}`;
}

export function getListenPosition(
  bookId: string,
  provider: string,
  voice: string,
  rate: number,
): ListenPlaybackPosition | null {
  try {
    const raw = localStorage.getItem(storageKey(bookId, provider, voice, rate));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ListenPlaybackPosition;
    // Ignore legacy entries saved before job-scoped resume
    if (!parsed.jobId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveListenPosition(position: Omit<ListenPlaybackPosition, 'updatedAt'>): void {
  try {
    const payload: ListenPlaybackPosition = { ...position, updatedAt: Date.now() };
    localStorage.setItem(
      storageKey(position.bookId, position.provider, position.voice, position.rate),
      JSON.stringify(payload),
    );
  } catch {
    // ignore quota errors
  }
}

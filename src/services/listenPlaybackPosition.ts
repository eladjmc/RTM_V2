export interface ListenPlaybackPosition {
  bookId: string;
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
    return raw ? (JSON.parse(raw) as ListenPlaybackPosition) : null;
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

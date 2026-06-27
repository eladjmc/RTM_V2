/**
 * Mobile-safe HTMLAudioElement playback (Android Chrome, etc.).
 * Waits for decode/buffer before play() to avoid clipping the start of MP3 blobs.
 */

const CHUNK_GAP_MS = 40;

export function prepareAudioElement(audio: HTMLAudioElement): void {
  audio.preload = 'auto';
  audio.setAttribute('playsinline', '');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resolve once enough data is buffered to play from the start reliably. */
export function waitForAudioReady(audio: HTMLAudioElement): Promise<void> {
  if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      audio.removeEventListener('loadeddata', onReady);
      audio.removeEventListener('canplay', onReady);
      audio.removeEventListener('canplaythrough', onReady);
      audio.removeEventListener('error', onError);
    };

    const onReady = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error('Audio failed to load'));
    };

    audio.addEventListener('loadeddata', onReady, { once: true });
    audio.addEventListener('canplay', onReady, { once: true });
    audio.addEventListener('canplaythrough', onReady, { once: true });
    audio.addEventListener('error', onError, { once: true });
  });
}

/**
 * Buffer, seek to startTime (default 0), then play.
 */
export async function playAudioWhenReady(
  audio: HTMLAudioElement,
  startTime = 0,
): Promise<void> {
  await waitForAudioReady(audio);

  if (startTime > 0 && Number.isFinite(audio.duration) && audio.duration > 0) {
    audio.currentTime = Math.min(startTime, audio.duration);
  } else {
    audio.currentTime = 0;
  }

  await audio.play();
}

/** Pause, reset element, brief gap — use before swapping blob URLs on the same element. */
export async function resetAudioElement(audio: HTMLAudioElement): Promise<void> {
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  await sleep(CHUNK_GAP_MS);
}

export { sleep as audioChunkGap };

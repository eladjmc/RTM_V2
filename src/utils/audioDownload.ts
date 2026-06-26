/** Trigger a browser download for a Blob */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Delay revoke so large files finish downloading (immediate revoke truncates on some browsers)
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}

function readId3v2SkipBytes(data: Uint8Array): number {
  if (data.length < 10) return 0;
  if (data[0] !== 0x49 || data[1] !== 0x44 || data[2] !== 0x33) return 0;
  const tagSize =
    ((data[6] & 0x7f) << 21) |
    ((data[7] & 0x7f) << 14) |
    ((data[8] & 0x7f) << 7) |
    (data[9] & 0x7f);
  return 10 + tagSize;
}

function hasId3v1Footer(data: Uint8Array): boolean {
  if (data.length < 128) return false;
  const i = data.length - 128;
  return data[i] === 0x54 && data[i + 1] === 0x41 && data[i + 2] === 0x47;
}

/** Slice MP3 bytes for safe append (strip tags between chapters). */
function sliceMp3ForConcat(data: Uint8Array, index: number, total: number): Uint8Array {
  const start = index === 0 ? 0 : readId3v2SkipBytes(data);
  let end = data.length;
  if (index < total - 1 && hasId3v1Footer(data)) {
    end -= 128;
  }
  if (start >= end) return new Uint8Array(0);
  return data.subarray(start, end);
}

/**
 * Concatenate chapter MP3 blobs in order.
 * Strips ID3 tags between segments so players recognize the full duration.
 */
export async function concatMp3Blobs(blobs: Blob[]): Promise<Blob> {
  if (blobs.length === 0) {
    throw new Error('No audio chapters to combine');
  }
  if (blobs.length === 1) {
    return blobs[0];
  }

  const rawBuffers = await Promise.all(blobs.map((b) => b.arrayBuffer()));
  const slices = rawBuffers.map((buf, i) =>
    sliceMp3ForConcat(new Uint8Array(buf), i, rawBuffers.length),
  );

  const total = slices.reduce((sum, s) => sum + s.byteLength, 0);
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const slice of slices) {
    combined.set(slice, offset);
    offset += slice.byteLength;
  }

  return new Blob([combined], { type: 'audio/mpeg' });
}

export function buildCombinedAudioFilename(
  bookTitle: string,
  startChapter: number,
  endChapter: number,
): string {
  const safeTitle = bookTitle.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'audio';
  const rangeLabel =
    startChapter === endChapter
      ? `Ch${startChapter}`
      : `Ch${startChapter}-${endChapter}`;
  return `${safeTitle}_${rangeLabel}.mp3`;
}

export function formatMegabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

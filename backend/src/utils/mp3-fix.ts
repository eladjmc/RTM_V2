/**
 * MP3 duration-fix utility.
 *
 * Each TTS chunk is a complete MP3 file (ID3v2 tag + Xing frame + audio).
 * When concatenated, the first Xing header reports only the first chunk's
 * duration and mobile players refuse to seek past it.
 *
 * Fix: strip all ID3v2 tags and Xing/Info frames from every chunk,
 * then concatenate pure audio frames. Players fall back to
 * file-size ÷ bitrate = correct full duration.
 */

/** Size of an ID3v2 tag starting at `off`, or 0 if none. */
function id3v2Size(buf: Buffer, off: number): number {
  if (off + 10 > buf.length) return 0;
  // "ID3"
  if (buf[off] !== 0x49 || buf[off + 1] !== 0x44 || buf[off + 2] !== 0x33) return 0;
  const sz =
    ((buf[off + 6] & 0x7F) << 21) |
    ((buf[off + 7] & 0x7F) << 14) |
    ((buf[off + 8] & 0x7F) << 7) |
     (buf[off + 9] & 0x7F);
  return 10 + sz;
}

/** Size of the MPEG audio frame at `off`, or 0 if not a valid frame sync. */
function frameSize(buf: Buffer, off: number): number {
  if (off + 4 > buf.length) return 0;
  if (buf[off] !== 0xFF || (buf[off + 1] & 0xE0) !== 0xE0) return 0;

  const b1 = buf[off + 1], b2 = buf[off + 2];
  const verBits = (b1 >> 3) & 3;
  const layerBits = (b1 >> 1) & 3;
  const brIdx = (b2 >> 4) & 0xF;
  const srIdx = (b2 >> 2) & 3;
  const pad = (b2 >> 1) & 1;

  // Bitrate table index: 0 = MPEG1, 1 = MPEG2/2.5
  const vI = verBits === 3 ? 0 : 1;
  // Layer: 1=L3, 2=L2, 3=L1
  const layer = [0, 3, 2, 1][layerBits];
  if (!layer || brIdx === 0 || brIdx === 15 || srIdx === 3) return 0;

  const BR: number[][] = [
    [0,32,64,96,128,160,192,224,256,288,320,352,384,416,448,0],  // V1 L1
    [0,32,48,56,64,80,96,112,128,160,192,224,256,320,384,0],     // V1 L2
    [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0],      // V1 L3
    [0,32,48,56,64,80,96,112,128,144,160,176,192,224,256,0],     // V2 L1
    [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160,0],          // V2 L2
    [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160,0],          // V2 L3
  ];
  const SR = [[44100,48000,32000],[22050,24000,16000],[11025,12000,8000]];
  const srI = verBits === 3 ? 0 : verBits === 2 ? 1 : 2;

  const br = BR[vI * 3 + (layer - 1)][brIdx];
  const sr = SR[srI]?.[srIdx];
  if (!br || !sr) return 0;

  if (layer === 1) return (Math.floor(12 * br * 1000 / sr) + pad) * 4;
  const spf = (layer === 3 && verBits !== 3) ? 576 : 1152;
  return Math.floor(spf * br * 1000 / (8 * sr)) + pad;
}

/** Check if frame at `off` contains a Xing or Info tag. */
function isXingFrame(buf: Buffer, off: number): boolean {
  const sz = frameSize(buf, off);
  if (!sz) return false;
  const end = Math.min(off + sz, buf.length - 4);
  for (let i = off + 4; i <= end; i++) {
    if (
      (buf[i] === 0x58 && buf[i+1] === 0x69 && buf[i+2] === 0x6E && buf[i+3] === 0x67) || // Xing
      (buf[i] === 0x49 && buf[i+1] === 0x6E && buf[i+2] === 0x66 && buf[i+3] === 0x6F)    // Info
    ) return true;
  }
  return false;
}

/**
 * Strip a single MP3 buffer down to just its audio frames
 * (remove ID3v2 tags and the Xing/Info metadata frame).
 */
function stripChunk(buf: Buffer): Buffer {
  const parts: Buffer[] = [];
  let off = 0;

  while (off < buf.length) {
    // Skip ID3v2 tags
    const tagSz = id3v2Size(buf, off);
    if (tagSz > 0) { off += tagSz; continue; }

    // Check for audio frame
    const fSz = frameSize(buf, off);
    if (fSz > 0 && off + fSz <= buf.length) {
      // Skip Xing/Info frames, keep everything else
      if (!isXingFrame(buf, off)) {
        parts.push(buf.subarray(off, off + fSz));
      }
      off += fSz;
    } else {
      off++; // skip unknown byte
    }
  }

  return Buffer.concat(parts);
}

/**
 * Strip all ID3/Xing metadata from a concatenated MP3 so that the
 * full duration is correctly reported by all players (desktop + mobile).
 */
export function fixMp3Duration(buf: Buffer): Buffer {
  const result = stripChunk(buf);
  const saved = buf.length - result.length;
  if (saved > 0) {
    console.log(`  MP3 fix: stripped ${(saved / 1024).toFixed(0)} KB of metadata`);
  }
  return result;
}

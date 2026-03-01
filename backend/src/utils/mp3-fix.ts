/**
 * MP3 metadata-stripper.
 *
 * Each TTS chunk is a standalone MP3 file (optional ID3v2 + optional
 * Xing/Info frame + audio frames).  When chunks are concatenated the
 * first Xing header still reports only the first chunk's duration,
 * causing mobile players to show the wrong total length.
 *
 * `stripMp3Chunk` removes the ID3v2 tag and the Xing/Info frame from
 * a **single** MP3 buffer.  Call it on every chunk *before* concat so
 * the final file is pure audio frames — all players will derive
 * duration from file-size ÷ bitrate instead.
 */

/**
 * Strip ID3v2 tags and the Xing/Info metadata frame from a single
 * MP3 buffer, returning only the audio frames.
 */
export function stripMp3Chunk(buf: Buffer): Buffer {
  let off = 0;

  // ── 1. Skip ID3v2 tag ────────────────────────────────────
  if (buf.length > 10 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    const tagSize =
      ((buf[6] & 0x7F) << 21) |
      ((buf[7] & 0x7F) << 14) |
      ((buf[8] & 0x7F) << 7) |
       (buf[9] & 0x7F);
    off = 10 + tagSize;
    console.log(`    strip: skipped ID3v2 tag (${off} bytes)`);
  }

  // ── 2. Find first frame sync ─────────────────────────────
  while (off + 1 < buf.length) {
    if (buf[off] === 0xFF && (buf[off + 1] & 0xE0) === 0xE0) break;
    off++;
  }
  if (off + 4 >= buf.length) return buf; // nothing found — return as-is

  // ── 3. Check if first frame is Xing/Info ──────────────────
  //    Search for the 4-byte marker anywhere in the first ~200 bytes
  //    from the frame start (covers all MPEG ver / channel combos).
  const searchLimit = Math.min(off + 200, buf.length - 4);
  let xingFound = false;
  for (let i = off + 4; i < searchLimit; i++) {
    const a = buf[i], b = buf[i + 1], c = buf[i + 2], d = buf[i + 3];
    if (
      (a === 0x58 && b === 0x69 && c === 0x6E && d === 0x67) || // "Xing"
      (a === 0x49 && b === 0x6E && c === 0x66 && d === 0x6F)    // "Info"
    ) {
      xingFound = true;
      break;
    }
  }

  if (xingFound) {
    // We need the frame size to skip past it.
    // Parse the 4-byte header at `off`.
    const fSz = mp3FrameSize(buf, off);
    if (fSz > 0) {
      console.log(`    strip: removed Xing/Info frame (${fSz} bytes)`);
      return buf.subarray(off + fSz);
    }
  }

  // No Xing found — just strip ID3v2 prefix
  return off > 0 ? buf.subarray(off) : buf;
}

/** Frame size helper */
function mp3FrameSize(buf: Buffer, off: number): number {
  if (off + 4 > buf.length) return 0;
  if (buf[off] !== 0xFF || (buf[off + 1] & 0xE0) !== 0xE0) return 0;

  const b1 = buf[off + 1], b2 = buf[off + 2];
  const verBits = (b1 >> 3) & 3;
  const layerBits = (b1 >> 1) & 3;
  const brIdx = (b2 >> 4) & 0xF;
  const srIdx = (b2 >> 2) & 3;
  const pad = (b2 >> 1) & 1;

  const vI = verBits === 3 ? 0 : 1;
  const layer = [0, 3, 2, 1][layerBits];
  if (!layer || brIdx === 0 || brIdx === 15 || srIdx === 3) return 0;

  const BR: number[][] = [
    [0,32,64,96,128,160,192,224,256,288,320,352,384,416,448,0],
    [0,32,48,56,64,80,96,112,128,160,192,224,256,320,384,0],
    [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0],
    [0,32,48,56,64,80,96,112,128,144,160,176,192,224,256,0],
    [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160,0],
    [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160,0],
  ];
  const SR = [[44100,48000,32000],[22050,24000,16000],[11025,12000,8000]];
  const srI = verBits === 3 ? 0 : verBits === 2 ? 1 : 2;

  const br = BR[vI * 3 + (layer - 1)]?.[brIdx];
  const sr = SR[srI]?.[srIdx];
  if (!br || !sr) return 0;

  if (layer === 1) return (Math.floor(12 * br * 1000 / sr) + pad) * 4;
  const spf = (layer === 3 && verBits !== 3) ? 576 : 1152;
  return Math.floor(spf * br * 1000 / (8 * sr)) + pad;
}

/**
 * Legacy wrapper — kept for backward compatibility with the controller.
 * With per-chunk stripping there should be nothing left to fix, but
 * this runs as a safety net.
 */
export function fixMp3Duration(buf: Buffer): Buffer {
  // If somehow a Xing/Info still exists, just zero the tag + flags (8 bytes)
  const xing = Buffer.from('Xing');
  const info = Buffer.from('Info');
  const out = Buffer.from(buf);

  for (let i = 0; i < out.length - 8; i++) {
    if (
      (out[i] === xing[0] && out[i+1] === xing[1] && out[i+2] === xing[2] && out[i+3] === xing[3]) ||
      (out[i] === info[0] && out[i+1] === info[1] && out[i+2] === info[2] && out[i+3] === info[3])
    ) {
      // Zero 120 bytes — tag + flags + frame count + byte count + TOC + quality
      const zeroLen = Math.min(120, out.length - i);
      out.fill(0, i, i + zeroLen);
      console.log(`  MP3 fix (safety): zeroed residual Xing/Info at offset ${i}`);
      i += zeroLen;
    }
  }

  return out;
}

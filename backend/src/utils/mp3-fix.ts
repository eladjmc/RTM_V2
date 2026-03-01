/**
 * MP3 duration-fix utility.
 *
 * When multiple MP3 buffers are concatenated, the Xing/Info VBR header
 * in the first chunk still reports only that chunk's duration.
 * Players use it for seek range, so the file appears shorter.
 *
 * Fix: zero-out every Xing/Info tag **and its flags field** (8 bytes).
 * Some mobile players locate the header by byte-offset rather than by
 * scanning for the tag name, so the flags must also be zeroed — flags=0
 * means "no fields present" and no player will read the stale counts.
 *
 * Without a valid Xing header, players fall back to file-size ÷ bitrate
 * = correct duration for the full concatenated file.
 */

export function fixMp3Duration(buf: Buffer): Buffer {
  const out = Buffer.from(buf);
  const xing = Buffer.from('Xing');
  const info = Buffer.from('Info');

  let patched = 0;
  for (let i = 0; i < out.length - 8; i++) {
    if (
      (out[i] === xing[0] && out[i+1] === xing[1] && out[i+2] === xing[2] && out[i+3] === xing[3]) ||
      (out[i] === info[0] && out[i+1] === info[1] && out[i+2] === info[2] && out[i+3] === info[3])
    ) {
      // Zero out the 4-byte tag + 4-byte flags field (8 bytes total)
      for (let j = 0; j < 8; j++) out[i + j] = 0;
      patched++;
      i += 7; // skip past what we just zeroed
    }
  }

  if (patched) console.log(`  MP3 fix: zeroed ${patched} Xing/Info header(s)`);
  return out;
}

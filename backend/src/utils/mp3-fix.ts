/**
 * MP3 duration-fix utility.
 *
 * When multiple MP3 buffers are concatenated, the Xing/Info VBR header
 * in the first chunk still reports only that chunk's duration.
 * Players use it for seek range, so the file appears shorter.
 *
 * Fix: zero-out every "Xing" / "Info" tag in the buffer.
 * Without it, players fall back to file-size ÷ bitrate = correct duration.
 */

/**
 * Overwrite every Xing / Info tag in the buffer with zeroes
 * so players calculate duration from file-size ÷ bitrate instead.
 */
export function fixMp3Duration(buf: Buffer): Buffer {
  const out = Buffer.from(buf);
  const xing = Buffer.from('Xing');
  const info = Buffer.from('Info');

  let patched = 0;
  for (let i = 0; i < out.length - 4; i++) {
    if (
      (out[i] === xing[0] && out[i+1] === xing[1] && out[i+2] === xing[2] && out[i+3] === xing[3]) ||
      (out[i] === info[0] && out[i+1] === info[1] && out[i+2] === info[2] && out[i+3] === info[3])
    ) {
      // Zero out the 4-byte tag so players ignore this header
      out[i] = out[i+1] = out[i+2] = out[i+3] = 0;
      patched++;
    }
  }

  if (patched) console.log(`  MP3 fix: zeroed ${patched} Xing/Info header(s)`);
  return out;
}

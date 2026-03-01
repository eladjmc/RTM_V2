/**
 * MP3 duration-fix utility — uses ffmpeg to remux concatenated MP3
 * so every player (including mobile) reports the correct duration.
 *
 * `ffmpeg -c:a copy -write_xing 0` stream-copies audio frames and
 * suppresses the Xing VBR header.  No re-encoding, ~instant.
 */

import { execFile, type ExecFileException } from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';

// ffmpeg-static exports the path as default, but TS sees it as a module.
const ffmpegPath: string = ffmpegStatic as unknown as string;

/**
 * Pipe an MP3 buffer through ffmpeg to produce a clean MP3 with
 * correct duration metadata.  Returns the fixed buffer.
 */
export function fixMp3Duration(buf: Buffer): Promise<Buffer> {
  return new Promise((resolve) => {
    if (!ffmpegPath) {
      console.warn('  MP3 fix: ffmpeg-static not found, returning as-is');
      resolve(buf);
      return;
    }

    const args = [
      '-i', 'pipe:0',       // read from stdin
      '-c:a', 'copy',       // no re-encoding
      '-write_xing', '0',   // suppress Xing/Info header
      '-f', 'mp3',          // output format
      'pipe:1',             // write to stdout
    ];

    const proc = execFile(ffmpegPath, args, {
      maxBuffer: 200 * 1024 * 1024,  // 200 MB
      encoding: 'buffer' as BufferEncoding,
    }, (err: ExecFileException | null, stdout: Buffer | string) => {
      if (err) {
        console.error('  MP3 fix: ffmpeg failed:', err.message);
        resolve(buf); // fallback: return original
        return;
      }
      const out = stdout as unknown as Buffer;
      const saved = buf.length - out.length;
      console.log(`  MP3 fix: remuxed via ffmpeg (${saved > 0 ? `-${(saved/1024).toFixed(0)}` : `+${(-saved/1024).toFixed(0)}`} KB)`);
      resolve(out);
    });

    // Feed the MP3 buffer into ffmpeg's stdin
    proc.stdin!.end(buf);
  });
}

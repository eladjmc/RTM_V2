import { spawn } from 'child_process';
import fs from 'fs/promises';
import { getFfmpegPath } from '../utils/ffmpeg.js';

function runFfmpeg(args: string[]): Promise<void> {
  const ffmpeg = getFfmpegPath();
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] });

    let stderr = '';
    proc.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed (${code}): ${stderr.slice(-800)}`));
    });
    proc.on('error', reject);
  });
}

function escapeConcatPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/'/g, "'\\''");
}

/**
 * Merge MP3 files into one file with correct duration/seek metadata.
 *
 * Stream-copy concat (`-c copy`) is unreliable for MP3 — players often show
 * only the first segment's length. Re-encoding via libmp3lame is still fast
 * (no re-TTS) and produces a seekable file.
 */
export async function mergeMp3Files(
  inputPaths: string[],
  outputPath: string,
): Promise<void> {
  if (inputPaths.length === 0) {
    throw new Error('No input files to merge');
  }

  if (inputPaths.length === 1) {
    await fs.copyFile(inputPaths[0], outputPath);
    return;
  }

  const listPath = `${outputPath}.concat.txt`;
  const lines = inputPaths.map((p) => `file '${escapeConcatPath(p)}'`);
  await fs.writeFile(listPath, lines.join('\n'), 'utf8');

  try {
    await runFfmpeg([
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-map_metadata', '-1',
      '-c:a', 'libmp3lame',
      '-q:a', '4',
      '-write_xing', '1',
      '-threads', '0',
      outputPath,
    ]);
  } finally {
    await fs.unlink(listPath).catch(() => {});
  }
}

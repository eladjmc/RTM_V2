import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const bundledPath = require('ffmpeg-static') as string | null;

/**
 * Bundled ffmpeg binary (works on Windows dev + Linux Docker/Render).
 * Falls back to PATH when the package has no binary for the platform.
 */
export function getFfmpegPath(): string {
  if (bundledPath) return bundledPath;
  return 'ffmpeg';
}

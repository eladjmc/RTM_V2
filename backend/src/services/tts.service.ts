import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import type { Voice } from 'msedge-tts';

export interface TtsConfig {
  voice: string;       // e.g. "en-US-AriaNeural"
  rate?: number;       // e.g. 1.0 = normal, 1.5 = fast
  pitch?: string;      // e.g. "+0Hz"
  volume?: number;     // 0-100
}

/**
 * Returns en-US voices from Edge TTS.
 */
export const getEnUsVoices = async (): Promise<Voice[]> => {
  const tts = new MsEdgeTTS();
  const all = await tts.getVoices();
  return all.filter((v) => v.Locale === 'en-US');
};

/**
 * Synthesise a single chunk of text → MP3 Buffer.
 * Each call opens its own WebSocket so they can run in parallel.
 */
export const synthesiseToBuffer = async (
  text: string,
  config: TtsConfig,
): Promise<Buffer> => {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(
    config.voice || 'en-US-AriaNeural',
    OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
  );

  const prosody: { rate?: number; pitch?: string; volume?: number } = {};
  if (config.rate != null) prosody.rate = config.rate;
  if (config.pitch != null) prosody.pitch = config.pitch;
  if (config.volume != null) prosody.volume = config.volume;

  const { audioStream } = tts.toStream(text, prosody);

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
    audioStream.on('end', () => resolve(Buffer.concat(chunks)));
    audioStream.on('error', reject);
  });
};

/**
 * Synthesise multiple text segments in parallel (up to `concurrency` at a time),
 * then concatenate the resulting MP3 buffers in order.
 * Returns a single MP3 Buffer.
 */
export const synthesiseChaptersParallel = async (
  texts: string[],
  config: TtsConfig,
  concurrency = 5,
): Promise<Buffer> => {
  const results: Buffer[] = new Array(texts.length);

  // Process in batches of `concurrency`
  for (let i = 0; i < texts.length; i += concurrency) {
    const batch = texts.slice(i, i + concurrency);
    const buffers = await Promise.all(
      batch.map((text) => synthesiseToBuffer(text, config)),
    );
    buffers.forEach((buf, j) => {
      results[i + j] = buf;
    });
  }

  return Buffer.concat(results);
};

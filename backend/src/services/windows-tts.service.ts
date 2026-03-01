/**
 * Windows SAPI TTS — uses PowerShell + System.Speech.Synthesis
 * to access locally-installed voices like Microsoft Zira Desktop.
 * Outputs WAV buffers (uncompressed).
 */

import { execFile } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';

const TMP_DIR = join(tmpdir(), 'rtm-tts');

export interface WindowsTtsConfig {
  voice: string; // e.g. "Microsoft Zira Desktop"
  rate?: number; // 1.0 = normal, 0.5–2.0
}

/** Ensure temp directory exists */
async function ensureTmpDir() {
  await mkdir(TMP_DIR, { recursive: true });
}

/**
 * Check if Windows SAPI is available (always true on Windows).
 */
export const isAvailable = (): boolean => process.platform === 'win32';

/**
 * List installed SAPI voice names.
 */
export const getInstalledVoices = async (): Promise<string[]> => {
  const psScript = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
foreach ($v in $synth.GetInstalledVoices()) {
    Write-Host $v.VoiceInfo.Name
}
$synth.Dispose()
`;
  await ensureTmpDir();
  const psFile = join(TMP_DIR, `voices-${randomUUID()}.ps1`);
  await writeFile(psFile, psScript, 'utf-8');

  try {
    const stdout = await runPowerShell(psFile);
    return stdout
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  } finally {
    await unlink(psFile).catch(() => {});
  }
};

/**
 * Synthesise a single text → WAV Buffer using Windows SAPI.
 */
export const synthesiseToBuffer = async (
  text: string,
  config: WindowsTtsConfig,
): Promise<Buffer> => {
  await ensureTmpDir();
  const id = randomUUID();
  const txtFile = join(TMP_DIR, `${id}.txt`);
  const wavFile = join(TMP_DIR, `${id}.wav`);
  const psFile = join(TMP_DIR, `${id}.ps1`);

  // SAPI Rate: -10 to 10 (0 = normal)
  // Our rate: 0.5–2.0 (1.0 = normal)
  // Mapping: (rate - 1) * 10, clamped
  const sapiRate = Math.max(-10, Math.min(10, Math.round(((config.rate ?? 1.0) - 1) * 10)));

  // Write text to file to avoid command-line escaping issues
  await writeFile(txtFile, text, 'utf-8');

  // PowerShell script reads from text file, outputs WAV
  const psScript = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice('${config.voice.replace(/'/g, "''")}')
$synth.Rate = ${sapiRate}
$synth.SetOutputToWaveFile('${wavFile.replace(/\\/g, '\\\\')}')
$text = [System.IO.File]::ReadAllText('${txtFile.replace(/\\/g, '\\\\')}', [System.Text.Encoding]::UTF8)
$synth.Speak($text)
$synth.Dispose()
`;

  await writeFile(psFile, psScript, 'utf-8');

  try {
    await runPowerShell(psFile, 300_000); // 5 min timeout per chunk
    const wavBuf = await readFile(wavFile);
    return wavBuf;
  } finally {
    await Promise.all([
      unlink(txtFile).catch(() => {}),
      unlink(wavFile).catch(() => {}),
      unlink(psFile).catch(() => {}),
    ]);
  }
};

/**
 * Synthesise multiple chapters in parallel (batched).
 * Concurrency kept at 3 since each spawns a PowerShell process.
 */
export const synthesiseChaptersParallel = async (
  texts: string[],
  config: WindowsTtsConfig,
  concurrency = 3,
): Promise<Buffer> => {
  const results: Buffer[] = new Array(texts.length);

  for (let i = 0; i < texts.length; i += concurrency) {
    const batch = texts.slice(i, i + concurrency);
    console.log(
      `  Windows TTS: batch ${Math.floor(i / concurrency) + 1} — chapters ${i + 1}–${i + batch.length} of ${texts.length}`,
    );
    const buffers = await Promise.all(
      batch.map((text) => synthesiseToBuffer(text, config)),
    );
    buffers.forEach((buf, j) => {
      results[i + j] = buf;
    });
  }

  return Buffer.concat(results);
};

/* ─── Helper: run a .ps1 file ──────────────────────────────── */
function runPowerShell(psFile: string, timeout = 30_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psFile],
      { timeout },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`PowerShell TTS failed: ${err.message}\n${stderr}`));
        } else {
          resolve(stdout);
        }
      },
    );
  });
}

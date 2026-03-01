/**
 * SAPI TTS service — uses texttospeechfree.io as a proxy
 * to Microsoft SAPI voices (Zira, David, etc.).
 *
 * Flow per synthesis:
 *   1. Scrape homepage for XSRF token + antiforgery cookie (cached)
 *   2. POST /Index?handler=Test  →  { id, file }
 *   3. GET  /Index?handler=Download&id=…&file=…  →  MP3 buffer
 *
 * Session is cached and auto-refreshed on 400 (token expired).
 */

const BASE_URL = 'https://texttospeechfree.io';

/* ────────────────── Session management ───────────────────── */

interface Session {
  token: string;
  cookie: string;
  createdAt: number;
}

let cachedSession: Session | null = null;

const SESSION_TTL_MS = 30 * 60 * 1000; // refresh after 30 min

async function getSession(forceRefresh = false): Promise<Session> {
  if (
    !forceRefresh &&
    cachedSession &&
    Date.now() - cachedSession.createdAt < SESSION_TTL_MS
  ) {
    return cachedSession;
  }

  const res = await fetch(BASE_URL + '/');
  if (!res.ok) throw new Error(`SAPI session: page fetch failed ${res.status}`);

  const html = await res.text();

  // Extract XSRF token from hidden input
  const tokenMatch = html.match(
    /name="__RequestVerificationToken".*?value="([^"]+)"/,
  );
  if (!tokenMatch) throw new Error('SAPI session: XSRF token not found in page');

  // Extract cookies from Set-Cookie headers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setCookies: string[] = (res.headers as any).getSetCookie?.() ?? [];
  const cookieStr = setCookies.map((c: string) => c.split(';')[0]).join('; ');

  if (!cookieStr) throw new Error('SAPI session: no cookies received');

  cachedSession = {
    token: tokenMatch[1],
    cookie: cookieStr,
    createdAt: Date.now(),
  };

  return cachedSession;
}

/* ────────────────── Helpers ──────────────────────────────── */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface SapiTtsConfig {
  voice: string;   // e.g. "Microsoft Zira Desktop"
  rate?: number;    // 1.0 = normal  (maps to -10…+10 scale)
  volume?: number;  // 0–100
}

/**
 * Map a numeric rate multiplier (0.5–2.0) to the site's -10…+10 scale.
 *  1.0 → 0,  2.0 → +10,  0.5 → -10
 * Linear interpolation.
 */
function rateToSiteScale(rate: number): string {
  if (rate == null || rate === 1) return '0';
  // Clamp to 0.5–2.0
  const clamped = Math.max(0.5, Math.min(2.0, rate));
  // Map: 0.5 → -10, 1.0 → 0, 2.0 → +10
  let val: number;
  if (clamped <= 1) {
    val = (clamped - 1) * 20; // 0.5→-10, 1.0→0
  } else {
    val = (clamped - 1) * 10; // 1.0→0, 2.0→10
  }
  return String(Math.round(val));
}

/* ────────────────── Core synthesis ───────────────────────── */

interface SynthResult {
  id: string;
  file: string;
}

const MAX_RETRIES = 2;

/**
 * Synthesise a single text  →  MP3 Buffer.
 * Handles session refresh on 400 and simple retry.
 */
export async function synthesiseToBuffer(
  text: string,
  config: SapiTtsConfig,
): Promise<Buffer> {
  const rateVal = rateToSiteScale(config.rate ?? 1.0);
  const volumeVal = String(config.volume ?? 100);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const session = await getSession(attempt > 1); // force refresh on retry

    // Step 1: Synthesise
    const synthRes = await fetch(BASE_URL + '/Index?handler=Test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json, charset=utf-8',
        Accept: 'application/json',
        'XSRF-TOKEN': session.token,
        Cookie: session.cookie,
      },
      body: JSON.stringify({
        Text: text,
        Voice: config.voice,
        Rate: rateVal,
        Volume: volumeVal,
      }),
    });

    if (synthRes.status === 400 && attempt < MAX_RETRIES) {
      console.warn('SAPI TTS: got 400, refreshing session and retrying…');
      cachedSession = null;
      await sleep(500);
      continue;
    }

    if (!synthRes.ok) {
      throw new Error(`SAPI TTS synthesis failed: ${synthRes.status}`);
    }

    const result = (await synthRes.json()) as SynthResult;
    if (!result.id || !result.file) {
      throw new Error('SAPI TTS: unexpected response — missing id/file');
    }

    // Step 2: Download
    const dlUrl = `${BASE_URL}/Index?handler=Download&id=${result.id}&file=${result.file}`;
    const dlRes = await fetch(dlUrl, {
      headers: { Cookie: session.cookie },
    });

    if (!dlRes.ok) {
      throw new Error(`SAPI TTS download failed: ${dlRes.status}`);
    }

    const arrayBuffer = await dlRes.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  throw new Error('SAPI TTS: exhausted retries');
}

/**
 * Synthesise multiple chapters as a single request.
 * Joins all text with paragraph breaks so the TTS engine pauses
 * naturally between chapters.  Returns one clean MP3 — no concat.
 */
export async function synthesiseChapters(
  texts: string[],
  config: SapiTtsConfig,
): Promise<Buffer> {
  const combined = texts.join('\n\n');
  console.log(`  SAPI: ${texts.length} chapters combined — ${combined.length} chars total`);
  const buf = await synthesiseToBuffer(combined, config);
  console.log(`  SAPI: done — ${(buf.length / 1024).toFixed(0)} KB`);
  return buf;
}

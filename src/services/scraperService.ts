/** Thin client for the Python scraper API (FastAPI on port 8001). */

const SCRAPER_URL =
  import.meta.env.VITE_SCRAPER_URL || 'http://localhost:8001';

/* ── Types ─────────────────────────────────────────────────────────── */

export interface ScrapeRequest {
  url: string;
  book_url?: string;
  max_chapters?: number | null;
  starting_chapter?: number | null;
}

export interface ScrapeJob {
  job_id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  chapters_scraped: number;
  total_expected: number | null;
  book_title: string;
  message: string;
}

/* ── Helpers ───────────────────────────────────────────────────────── */

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { detail?: string }).detail || `HTTP ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
}

/* ── API ───────────────────────────────────────────────────────────── */

export const scraperService = {
  /** Start a new scrape job. */
  start: (body: ScrapeRequest) =>
    fetch(`${SCRAPER_URL}/scrape/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => handleResponse<ScrapeJob>(r)),

  /** Poll a single job's progress. */
  getJob: (jobId: string) =>
    fetch(`${SCRAPER_URL}/scrape/${jobId}`).then((r) =>
      handleResponse<ScrapeJob>(r),
    ),

  /** List all jobs (optionally filter by status). */
  listJobs: (status?: string) => {
    const qs = status ? `?status=${status}` : '';
    return fetch(`${SCRAPER_URL}/scrape/${qs}`).then((r) =>
      handleResponse<ScrapeJob[]>(r),
    );
  },

  /** Cancel a running job. */
  cancel: (jobId: string) =>
    fetch(`${SCRAPER_URL}/scrape/${jobId}/cancel`, { method: 'POST' }).then(
      (r) => handleResponse<ScrapeJob>(r),
    ),
};

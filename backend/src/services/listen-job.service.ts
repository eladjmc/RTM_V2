import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import * as bookDal from '../dal/book.dal.js';
import * as chapterDal from '../dal/chapter.dal.js';
import {
  synthesizeChapterToBuffer,
  type ChapterAudioProvider,
  CHAPTER_MAX_CHARS,
} from './chapter-audio.service.js';
import { mergeMp3Files } from './audio-merge.service.js';

const JOB_TTL_MS = 6 * 60 * 60 * 1000;
const SYNTH_CONCURRENCY = 3;
const JOBS_ROOT = path.join(os.tmpdir(), 'rtm-listen-jobs');

export type ChapterJobStatus = 'pending' | 'loading' | 'ready' | 'error';

export interface ListenJobChapter {
  chapterNumber: number;
  title: string;
  status: ChapterJobStatus;
}

export interface ListenJobStatus {
  jobId: string;
  bookId: string;
  bookTitle: string;
  startChapter: number;
  endChapter: number;
  provider: ChapterAudioProvider;
  voice: string;
  rate: number;
  status: 'running' | 'complete' | 'failed';
  readyCount: number;
  totalCount: number;
  loadingChapter: number | null;
  combinedReady: boolean;
  chapters: ListenJobChapter[];
  error?: string;
}

interface ListenJob {
  id: string;
  bookId: string;
  bookTitle: string;
  startChapter: number;
  endChapter: number;
  provider: ChapterAudioProvider;
  voice: string;
  rate: number;
  dir: string;
  chapterNumbers: number[];
  chapters: Map<number, ListenJobChapter>;
  loadingChapter: number | null;
  status: 'running' | 'complete' | 'failed';
  combinedReady: boolean;
  combinedPath?: string;
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, ListenJob>();

async function ensureJobsRoot(): Promise<void> {
  await fs.mkdir(JOBS_ROOT, { recursive: true });
}

function chapterFilePath(job: ListenJob, chapterNumber: number): string {
  return path.join(job.dir, `ch-${chapterNumber}.mp3`);
}

function combinedFilePath(job: ListenJob): string {
  return path.join(job.dir, 'combined.mp3');
}

function toPublicStatus(job: ListenJob): ListenJobStatus {
  const chapters = job.chapterNumbers.map((n) => job.chapters.get(n)!);
  return {
    jobId: job.id,
    bookId: job.bookId,
    bookTitle: job.bookTitle,
    startChapter: job.startChapter,
    endChapter: job.endChapter,
    provider: job.provider,
    voice: job.voice,
    rate: job.rate,
    status: job.status,
    readyCount: chapters.filter((c) => c.status === 'ready').length,
    totalCount: chapters.length,
    loadingChapter: job.loadingChapter,
    combinedReady: job.combinedReady,
    chapters,
    error: job.error,
  };
}

async function buildCombinedFile(job: ListenJob): Promise<void> {
  const inputPaths = job.chapterNumbers
    .filter((n) => job.chapters.get(n)?.status === 'ready')
    .map((n) => chapterFilePath(job, n));

  const outPath = combinedFilePath(job);
  await mergeMp3Files(inputPaths, outPath);

  job.combinedPath = outPath;
  job.combinedReady = true;
  console.log(`Listen job ${job.id}: combined MP3 ready (${inputPaths.length} chapters)`);
}

async function synthesizeChapter(job: ListenJob, chapterNumber: number): Promise<void> {
  const entry = job.chapters.get(chapterNumber);
  if (!entry) return;

  entry.status = 'loading';
  job.loadingChapter = chapterNumber;

  try {
    const { buffer, title } = await synthesizeChapterToBuffer(job.bookId, chapterNumber, {
      provider: job.provider,
      voice: job.voice,
      rate: job.rate,
    });
    entry.title = title;
    await fs.writeFile(chapterFilePath(job, chapterNumber), buffer);
    entry.status = 'ready';
  } catch (err) {
    entry.status = 'error';
    throw err;
  } finally {
    if (job.loadingChapter === chapterNumber) {
      job.loadingChapter = null;
    }
  }
}

async function runJobWorker(job: ListenJob): Promise<void> {
  try {
    let index = 0;
    const workers = Array.from({ length: SYNTH_CONCURRENCY }, async () => {
      while (index < job.chapterNumbers.length) {
        const chapterNumber = job.chapterNumbers[index++];
        await synthesizeChapter(job, chapterNumber);
      }
    });
    await Promise.all(workers);

    job.status = 'complete';
    await buildCombinedFile(job);
  } catch (err) {
    job.status = 'failed';
    job.error = err instanceof Error ? err.message : 'Listen job failed';
    console.error(`Listen job ${job.id} failed:`, err);
  }
}

async function cleanupOldJobs(): Promise<void> {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) {
      jobs.delete(id);
      await fs.rm(job.dir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

setInterval(() => {
  cleanupOldJobs().catch(console.error);
}, 30 * 60 * 1000);

export interface CreateListenJobParams {
  bookId: string;
  startChapterNumber: number;
  chapterCount: number;
  provider?: ChapterAudioProvider;
  voice?: string;
  rate?: number;
}

export async function createListenJob(params: CreateListenJobParams): Promise<ListenJobStatus> {
  const {
    bookId,
    startChapterNumber,
    chapterCount,
    provider = 'sapi',
    voice,
    rate = 1.25,
  } = params;

  const startNum = Number(startChapterNumber);
  const count = Number(chapterCount);
  if (!Number.isInteger(startNum) || startNum < 1) {
    throw new Error('startChapterNumber must be a positive integer');
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('chapterCount must be a positive integer');
  }

  const endNum = startNum + count - 1;
  const book = await bookDal.findBookById(bookId);
  if (!book) throw new Error('Book not found');

  const dbChapters = await chapterDal.findChaptersByRange(bookId, startNum, endNum);
  if (dbChapters.length === 0) throw new Error('No chapters found in the specified range');

  const tooLong = dbChapters.filter((ch) => ch.content.length > CHAPTER_MAX_CHARS);
  if (tooLong.length > 0) {
    const err = new Error('Some chapters exceed the maximum character limit for audio synthesis') as Error & {
      statusCode?: number;
      details?: unknown;
    };
    err.statusCode = 400;
    err.details = {
      maxCharacters: CHAPTER_MAX_CHARS,
      chapters: tooLong.map((ch) => ({
        chapterNumber: ch.chapterNumber,
        title: ch.title || `Chapter ${ch.chapterNumber}`,
        characters: ch.content.length,
      })),
    };
    throw err;
  }

  await ensureJobsRoot();

  const jobId = randomUUID();
  const dir = path.join(JOBS_ROOT, jobId);
  await fs.mkdir(dir, { recursive: true });

  const chapterNumbers = dbChapters.map((ch) => ch.chapterNumber);
  const chapters = new Map<number, ListenJobChapter>();
  for (const ch of dbChapters) {
    chapters.set(ch.chapterNumber, {
      chapterNumber: ch.chapterNumber,
      title: ch.title || `Chapter ${ch.chapterNumber}`,
      status: 'pending',
    });
  }

  const resolvedVoice =
    voice || (provider === 'sapi' ? 'Microsoft Zira Desktop' : 'en-US-AriaNeural');

  const job: ListenJob = {
    id: jobId,
    bookId,
    bookTitle: book.title,
    startChapter: startNum,
    endChapter: endNum,
    provider,
    voice: resolvedVoice,
    rate: Number(rate),
    dir,
    chapterNumbers,
    chapters,
    loadingChapter: null,
    status: 'running',
    combinedReady: false,
    createdAt: Date.now(),
  };

  jobs.set(jobId, job);
  runJobWorker(job);

  return toPublicStatus(job);
}

export function getListenJob(jobId: string): ListenJob | undefined {
  return jobs.get(jobId);
}

export function getListenJobStatus(jobId: string): ListenJobStatus | null {
  const job = jobs.get(jobId);
  return job ? toPublicStatus(job) : null;
}

export async function getChapterAudioPath(
  jobId: string,
  chapterNumber: number,
): Promise<{ filePath: string; title: string } | null> {
  const job = jobs.get(jobId);
  if (!job) return null;
  const entry = job.chapters.get(chapterNumber);
  if (!entry || entry.status !== 'ready') return null;
  return { filePath: chapterFilePath(job, chapterNumber), title: entry.title };
}

export async function getCombinedDownload(
  jobId: string,
): Promise<{ filePath: string; filename: string } | null> {
  const job = jobs.get(jobId);
  if (!job || !job.combinedReady || !job.combinedPath) return null;

  const safeTitle = job.bookTitle.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'audio';
  const rangeLabel =
    job.startChapter === job.endChapter
      ? `Ch${job.startChapter}`
      : `Ch${job.startChapter}-${job.endChapter}`;
  const filename = `${safeTitle}_${rangeLabel}.mp3`;

  return { filePath: job.combinedPath, filename };
}

export async function deleteListenJob(jobId: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;
  jobs.delete(jobId);
  await fs.rm(job.dir, { recursive: true, force: true }).catch(() => {});
}

/** Dynamic HLS EVENT playlist pointing at ready chapter MP3 segments */
export function buildHlsPlaylist(jobId: string, baseUrl: string): string | null {
  const job = jobs.get(jobId);
  if (!job) return null;

  const ready = job.chapterNumbers.filter((n) => job.chapters.get(n)?.status === 'ready');
  if (ready.length === 0) return null;

  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '#EXT-X-PLAYLIST-TYPE:EVENT',
    '#EXT-X-TARGETDURATION:3600',
    '#EXT-X-MEDIA-SEQUENCE:0',
  ];

  for (const n of ready) {
    lines.push('#EXTINF:3600.0,');
    lines.push(`${baseUrl}/api/tts/listen-jobs/${jobId}/chapters/${n}.mp3`);
  }

  if (job.status === 'complete') {
    lines.push('#EXT-X-ENDLIST');
  }

  return lines.join('\n') + '\n';
}

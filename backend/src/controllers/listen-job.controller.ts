import type { Request, Response } from 'express';
import fs from 'fs/promises';
import {
  createListenJob,
  getListenJobStatus,
  getChapterAudioPath,
  getCombinedDownload,
  deleteListenJob,
  buildHlsPlaylist,
  listListenJobs,
  clearListenJobCache,
} from '../services/listen-job.service.js';

/**
 * POST /tts/listen-jobs
 */
export const startListenJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      bookId,
      startChapterNumber,
      chapterCount,
      provider,
      voice,
      rate,
    } = req.body;

    if (!bookId || !startChapterNumber || !chapterCount) {
      res.status(400).json({ error: 'bookId, startChapterNumber, and chapterCount are required' });
      return;
    }

    const status = await createListenJob({
      bookId,
      startChapterNumber,
      chapterCount,
      provider,
      voice,
      rate,
    });

    res.status(201).json(status);
  } catch (err: unknown) {
    const e = err as Error & { statusCode?: number; details?: unknown };
    if (e.statusCode === 400) {
      res.status(400).json({ error: e.message, ...(e.details as object) });
      return;
    }
    console.error('Start listen job failed:', err);
    res.status(500).json({ error: e.message || 'Failed to start listen job' });
  }
};

/**
 * GET /tts/listen-jobs
 */
export const listListenJobsHandler = async (_req: Request, res: Response): Promise<void> => {
  res.json({ jobs: listListenJobs() });
};

/**
 * GET /tts/listen-jobs/:jobId
 */
export const getListenJob = async (req: Request, res: Response): Promise<void> => {
  const jobId = req.params.jobId as string;
  const status = getListenJobStatus(jobId);
  if (!status) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  res.json(status);
};

/**
 * GET /tts/listen-jobs/:jobId/chapters/:chapterNumber.mp3
 */
export const streamListenJobChapter = async (req: Request, res: Response): Promise<void> => {
  const jobId = req.params.jobId as string;
  const chapterNumber = Number(req.params.chapterNumber);

  if (!Number.isInteger(chapterNumber)) {
    res.status(400).json({ error: 'Invalid chapter number' });
    return;
  }

  const file = await getChapterAudioPath(jobId, chapterNumber);
  if (!file) {
    res.status(404).json({ error: 'Chapter audio not ready' });
    return;
  }

  res.setHeader('Content-Type', 'audio/mpeg');
  res.sendFile(file.filePath);
};

/**
 * GET /tts/listen-jobs/:jobId/download
 */
export const downloadListenJobCombined = async (req: Request, res: Response): Promise<void> => {
  const jobId = req.params.jobId as string;
  const download = await getCombinedDownload(jobId);

  if (!download) {
    res.status(404).json({ error: 'Combined audio not ready yet' });
    return;
  }

  const stat = await fs.stat(download.filePath);
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Disposition', `attachment; filename="${download.filename}"`);
  res.setHeader('Content-Length', stat.size);
  res.sendFile(download.filePath, (err) => {
    if (err) {
      console.error('Combined download send failed:', err);
      return;
    }
    deleteListenJob(jobId).catch((deleteErr) => {
      console.error('Failed to clean up listen job after download:', deleteErr);
    });
  });
};

/**
 * GET /tts/listen-jobs/:jobId/playlist.m3u8
 */
export const getListenJobPlaylist = async (req: Request, res: Response): Promise<void> => {
  const jobId = req.params.jobId as string;
  const proto = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('host') || 'localhost';
  const baseUrl = `${proto}://${host}`;

  const playlist = buildHlsPlaylist(jobId, baseUrl);
  if (!playlist) {
    res.status(404).json({ error: 'No segments ready' });
    return;
  }

  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.send(playlist);
};

/**
 * DELETE /tts/listen-jobs/cache
 */
export const clearListenJobCacheHandler = async (_req: Request, res: Response): Promise<void> => {
  const result = await clearListenJobCache();
  res.json({
    message: 'Server cache cleared',
    deletedJobs: result.deletedJobs,
  });
};

/**
 * DELETE /tts/listen-jobs/:jobId
 */
export const removeListenJob = async (req: Request, res: Response): Promise<void> => {
  const jobId = req.params.jobId as string;
  await deleteListenJob(jobId);
  res.json({ message: 'Job deleted' });
};

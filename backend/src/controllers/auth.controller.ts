import type { Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import type { AuthRequest } from '../middleware/auth.js';

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

export const login = async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  const result = await authService.login(username, password);

  if (!result) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // Set httpOnly cookie
  res.cookie('rtm_token', result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: COOKIE_MAX_AGE,
  });

  res.json({ message: 'Logged in', username });
};

export const logout = (_req: Request, res: Response): void => {
  res.clearCookie('rtm_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  res.json({ message: 'Logged out' });
};

export const me = (req: AuthRequest, res: Response): void => {
  res.json({ username: req.user?.username });
};

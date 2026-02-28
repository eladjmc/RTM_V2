import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: { username: string };
}

const auth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  // Read JWT from httpOnly cookie, fall back to Authorization header for Swagger
  const token =
    req.cookies?.rtm_token ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null);

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      username: string;
    };
    req.user = { username: decoded.username };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export default auth;

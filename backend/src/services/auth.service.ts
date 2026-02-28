import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';

let hashedPassword: string | null = null;

const getHashedPassword = async (): Promise<string> => {
  if (!hashedPassword) {
    hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
  }
  return hashedPassword;
};

export const login = async (
  username: string,
  password: string,
): Promise<{ token: string } | null> => {
  if (username !== ADMIN_USERNAME) return null;

  // For the hardcoded admin, compare directly
  if (password !== ADMIN_PASSWORD) return null;

  const token = jwt.sign({ username }, process.env.JWT_SECRET!, {
    expiresIn: '7d',
  });

  return { token };
};

export const validateToken = (
  token: string,
): { username: string } | null => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as { username: string };
  } catch {
    return null;
  }
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const handleResponse = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error || `HTTP ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
};

export const api = {
  get: <T>(path: string) =>
    fetch(`${API_URL}${path}`, {
      credentials: 'include',
    }).then((r) => handleResponse<T>(r)),

  post: <T>(path: string, body: unknown) =>
    fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    }).then((r) => handleResponse<T>(r)),

  put: <T>(path: string, body: unknown) =>
    fetch(`${API_URL}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    }).then((r) => handleResponse<T>(r)),

  delete: <T>(path: string) =>
    fetch(`${API_URL}${path}`, {
      method: 'DELETE',
      credentials: 'include',
    }).then((r) => handleResponse<T>(r)),
};

export default api;

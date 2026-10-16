/**
 * Browser-side API client. Calls go to /api on this origin and are proxied to the NestJS API,
 * so the httpOnly auth cookie travels automatically.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown,
  ) {
    super(message);
  }
}

function messageFrom(data: unknown, status: number): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const m = (data as { message: unknown }).message;
    if (Array.isArray(m)) return m.join('. ');
    if (typeof m === 'string') return m;
  }
  if (status === 401) return 'Please log in to continue';
  if (status >= 500) return 'Something went wrong on our side. Try again in a moment.';
  return 'Request failed';
}

export async function api<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`/api${path}`, {
    ...rest,
    credentials: 'include',
    headers: { ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const text = await res.text();
  let data: unknown = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  if (!res.ok) throw new ApiError(messageFrom(data, res.status), res.status, data);
  return data as T;
}

export const post = <T = any>(path: string, json: unknown = {}, headers?: Record<string, string>) =>
  api<T>(path, { method: 'POST', json, headers });
export const patch = <T = any>(path: string, json: unknown = {}) => api<T>(path, { method: 'PATCH', json });
export const put = <T = any>(path: string, json: unknown = {}) => api<T>(path, { method: 'PUT', json });
export const del = <T = any>(path: string) => api<T>(path, { method: 'DELETE' });

/** Upload one image; resolves to its public URL (/uploads/...). */
export async function uploadImage(file: File): Promise<string> {
  const body = new FormData();
  body.append('file', file);
  const res = await api<{ url: string }>('/uploads', { method: 'POST', body });
  return res.url;
}

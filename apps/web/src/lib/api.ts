import type {
  HistoryEntry,
  PartId,
  PublicUser,
  SessionResult,
  SessionState,
} from '@fluentpath/shared';

export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = apiUrl(path);
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('fp_auth_token') : null;
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    let msg = `HTTP error ${res.status}`;
    try {
      const data = await res.json();
      msg = data.error?.message || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Auth
  register: (body: { email: string; password: string; name?: string }) =>
    request<{ user: PublicUser; token: string }>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<{ user: PublicUser; token: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  guest: () =>
    request<{ user: PublicUser; token: string }>('/api/auth/guest', { method: 'POST' }),
  logout: () =>
    request<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
  getMe: () =>
    request<{ user: PublicUser | null }>('/api/auth/me'),

  // Sessions
  createSession: (body: { mode: 'full' | 'part'; part?: PartId; level?: 'easy' | 'medium' | 'hard'; questionCount?: number }) =>
    request<SessionState>('/api/sessions', { method: 'POST', body: JSON.stringify(body) }),
  getSessionState: (id: string) =>
    request<SessionState>(`/api/sessions/${id}`),
  startItemTimer: (id: string, body: { itemId: string; sub?: number | null }) =>
    request<{ deadline: string }>(`/api/sessions/${id}/timer`, { method: 'POST', body: JSON.stringify(body) }),
  submitTextAnswer: (
    id: string,
    body: {
      itemId: string;
      sub?: number | null;
      text?: string;
      choice?: number;
      choices?: number[];
      clientElapsedMs?: number;
      integrity?: { pasted: boolean; pasteChars: number };
    }
  ) =>
    request<{ accepted: boolean; answerId: string }>(`/api/sessions/${id}/answers`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  submitAudioAnswer: (id: string, formData: FormData) =>
    request<{ accepted: boolean; answerId: string; jobId?: string }>(`/api/sessions/${id}/answers`, {
      method: 'POST',
      body: formData,
    }),
  advancePart: (id: string) =>
    request<SessionState>(`/api/sessions/${id}/advance`, { method: 'POST' }),
  submitSession: (id: string) =>
    request<{ status: string }>(`/api/sessions/${id}/submit`, { method: 'POST' }),
  getResult: (id: string) =>
    request<SessionResult>(`/api/sessions/${id}/result`),

  // Audio
  signAudioUrl: (sessionId: string, itemId: string, sub?: number | null) => {
    const subParam = sub !== undefined && sub !== null ? `&sub=${sub}` : '';
    return request<{ url: string; expires: number; promptText?: string }>(`/api/audio/sign?sessionId=${sessionId}&itemId=${itemId}${subParam}`);
  },

  // Me
  getHistory: () =>
    request<{ history: HistoryEntry[] }>('/api/me/history'),
  getProgress: () =>
    request<{
      totalTests: number;
      currentGse: number | null;
      targetScore: number;
      targetProfile: string;
      gap: number | null;
      skillAverages: Record<string, number>;
      timeline: { date: string; gse: number; reading: number | null; writing: number | null; listening: number | null; speaking: number | null }[];
    }>('/api/me/progress'),
  updateMe: (body: { name?: string; targetProfile?: string; targetScore?: number }) =>
    request<{ user: PublicUser }>('/api/me', { method: 'PATCH', body: JSON.stringify(body) }),
  submitOfficialScore: (body: { sessionId?: string; scale: 'gse' | 'versant'; score: number; testDate?: string }) =>
    request<{ success: boolean; message: string }>('/api/me/official', { method: 'POST', body: JSON.stringify(body) }),
  deleteMyData: () =>
    request<{ success: boolean; message: string }>('/api/me/data', { method: 'DELETE' }),

  // Health
  checkHealth: () =>
    request<{ status: string }>('/health'),
};

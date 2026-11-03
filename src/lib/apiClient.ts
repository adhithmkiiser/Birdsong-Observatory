import { User } from '@/types/database';

/**
 * Wrapper for standard fetch that automatically attaches the user's session token / credentials
 * and includes Same-Origin HttpOnly cookies for backend API routes.
 */
export async function apiFetch(url: string, options: RequestInit = {}, user?: (User & { sessionToken?: string }) | null) {
  const headers = new Headers(options.headers || {});

  if (user && user.email && user.email !== 'public@birdlab.in') {
    headers.set('X-User-Email', user.email);
    if ((user as any).sessionToken) {
      headers.set('X-Session-Token', (user as any).sessionToken);
    }
    if (user.password) {
      headers.set('X-User-Password', user.password);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('birdlab-session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!headers.has('X-User-Email') && parsed.email) {
          headers.set('X-User-Email', parsed.email);
        }
        if (!headers.has('X-Session-Token') && parsed.token) {
          headers.set('X-Session-Token', parsed.token);
        }
      }
    } catch {}
  }

  headers.set('Content-Type', 'application/json');

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin'
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `HTTP Error ${res.status}`);
  }

  return res.json();
}

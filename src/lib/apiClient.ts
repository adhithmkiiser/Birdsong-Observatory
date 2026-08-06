import { User } from '@/types/database';

/**
 * Wrapper for standard fetch that automatically attaches the user's Basic Auth headers
 * for backend API routes.
 */
export async function apiFetch(url: string, options: RequestInit = {}, user?: User | null) {
  const headers = new Headers(options.headers || {});
  
  if (user && user.email && user.password) {
    headers.set('X-User-Email', user.email);
    headers.set('X-User-Password', user.password);
  }
  
  headers.set('Content-Type', 'application/json');

  const res = await fetch(url, { ...options, headers });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP Error ${res.status}`);
  }
  
  return res.json();
}

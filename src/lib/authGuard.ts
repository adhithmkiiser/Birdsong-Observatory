import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from './supabaseAdmin';

export interface AuthGuardResult {
  error?: string;
  user?: any;
}

const SESSION_SECRET =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXTAUTH_SECRET ||
  'birdlab-fallback-hmac-secret-change-in-env';

/**
 * Generates an HMAC-SHA256 session token bound to the user's ID, email, role, and current password hash.
 * If the user's password or role changes in the database, any previous token is automatically invalidated.
 */
export function createSessionToken(user: { id: string; email: string; role: string; password_hash?: string }): string {
  const payload = `${user.id}:${(user.email || '').toLowerCase().trim()}:${user.role}:${user.password_hash || ''}`;
  return crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
}

/**
 * Constant-time string comparison to prevent timing side-channel attacks.
 */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Safely escapes a value for inclusion inside a PostgREST `.or()` filter expression.
 * Strips control characters and escapes backslashes and double quotes to prevent PostgREST filter injection.
 */
export function escapePostgrestValue(val: string | number | undefined | null): string {
  const cleaned = String(val ?? '').replace(/[\r\n\0]/g, '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${cleaned}"`;
}

/**
 * Validates the caller's session cookie, X-Session-Token, or X-User-Email + X-User-Password headers
 * against the users table.
 * @param req NextRequest
 * @param allowedRoles Array of roles allowed to perform the action. Leave empty to allow any authenticated user.
 */
export async function authGuard(req: NextRequest, allowedRoles: string[] = []): Promise<AuthGuardResult> {
  let email = req.headers.get('X-User-Email')?.trim() || '';
  const password = req.headers.get('X-User-Password') || '';
  let sessionToken = req.headers.get('X-Session-Token')?.trim() || '';

  // Also check HttpOnly session cookie if headers are not present
  const cookieRaw = req.cookies.get('birdlab_session')?.value;
  if (cookieRaw) {
    try {
      const parsedCookie = JSON.parse(decodeURIComponent(cookieRaw));
      if (!email && parsedCookie.email) email = String(parsedCookie.email).trim();
      if (!sessionToken && parsedCookie.token) sessionToken = String(parsedCookie.token).trim();
    } catch {
      // ignore malformed cookie
    }
  }

  if (!email) {
    return { error: 'Authentication required: missing user email or session.' };
  }

  // Find user by email
  const { data: users, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .ilike('email', email);

  if (error || !users || users.length === 0) {
    return { error: 'Invalid credentials.' };
  }

  const user = users[0];

  if (user.status && user.status !== 'active') {
    return { error: 'Account is suspended or inactive.' };
  }

  // Verify credentials: MUST supply either a valid HMAC session token OR the exact password
  const expectedToken = createSessionToken(user);
  const hasValidToken = Boolean(sessionToken) && safeCompare(sessionToken, expectedToken);
  const hasValidPassword = Boolean(password) && Boolean(user.password_hash) && safeCompare(password, String(user.password_hash));

  if (!hasValidToken && !hasValidPassword) {
    return { error: 'Invalid or expired authentication credentials. Please log in again.' };
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return { error: 'Insufficient permissions to perform this action.' };
  }

  return { user };
}

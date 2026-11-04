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
 * Safely escapes a value for inclusion inside a quoted PostgREST `.or()` filter expression (e.g. `col.eq."${safeVal}"`).
 * Strips control characters, quotes, backslashes, and PostgREST operator delimiters to prevent filter injection.
 */
export function escapePostgrestValue(val: string | number | undefined | null): string {
  return String(val ?? '').replace(/[\r\n\0"\\()]/g, '').trim();
}

/**
 * Validates that an email string is a well-formed email address and does not contain SQL/PostgREST LIKE wildcards (% or _ in domain).
 */
export function isSafeEmailLookup(email: string): boolean {
  if (!email || typeof email !== 'string' || email.length > 254) return false;
  if (email.includes('%')) return false;
  return /^[^\s@%]+@[^\s@%_]+\.[^\s@%_]+$/.test(email.trim());
}

/**
 * Server-side RBAC helper: checks whether an authenticated user is Admin or explicitly assigned to the given project.
 */
export function canUserManageProject(user: any, projectIdOrName?: string | null): boolean {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  if (user.role !== 'Project Manager' && user.role !== 'Site Manager') return false;

  const assignedProjs: string[] = [
    ...(Array.isArray(user.assigned_projects) ? user.assigned_projects : []),
    ...(Array.isArray(user.assignedProjects) ? user.assignedProjects : [])
  ].map(p => String(p).toLowerCase().trim()).filter(Boolean);

  const assignedSites: string[] = [
    ...(Array.isArray(user.assigned_sites) ? user.assigned_sites : []),
    ...(Array.isArray(user.assignedSites) ? user.assignedSites : [])
  ].map(s => String(s).toLowerCase().trim()).filter(Boolean);

  if (!projectIdOrName || projectIdOrName === 'ALL' || projectIdOrName === 'ALL_PROJECTS' || projectIdOrName === 'ALL_LANTANA') {
    return assignedProjs.length > 0 || assignedSites.length > 0;
  }

  const target = String(projectIdOrName).toLowerCase().trim();
  if (assignedProjs.includes(target)) return true;

  if ((target === 'test_custom' || target === 'test') && (assignedProjs.includes('test') || assignedProjs.includes('test_custom'))) {
    return true;
  }
  if (target.includes('lantana') && assignedProjs.some(p => p.includes('lantana'))) {
    return true;
  }
  if ((target === 'nilgiri' || target.includes('climate')) && (assignedProjs.includes('nilgiri') || assignedProjs.some(p => p.includes('climate')))) {
    return true;
  }

  if (assignedSites.length > 0) {
    if (assignedSites.some(s => s.startsWith(`${target}_`))) return true;
    if (target.includes('lantana') && assignedSites.some(s => s.startsWith('atr_') || s.startsWith('str_') || s.includes('lantana'))) {
      return true;
    }
    if ((target === 'nilgiri' || target.includes('climate')) && assignedSites.some(s => s.startsWith('nilgiri_') || /^a\d{2}_/.test(s))) {
      return true;
    }
    if ((target === 'test' || target === 'test_custom') && assignedSites.some(s => s.startsWith('test_'))) {
      return true;
    }
  }

  return false;
}

/**
 * Server-side RBAC helper: checks whether an authenticated user can manage a specific site or recorder node.
 */
export function canUserManageSite(user: any, siteIdOrName?: string | null, projectIdOrName?: string | null): boolean {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  if (user.role === 'Project Manager') {
    if (projectIdOrName) return canUserManageProject(user, projectIdOrName);
    if (siteIdOrName) {
      const s = String(siteIdOrName).toLowerCase().trim();
      if (s.startsWith('atr_') || s.startsWith('str_') || s.includes('lantana')) return canUserManageProject(user, 'tst_lantana');
      if (s.startsWith('nilgiri_') || /^a\d{2}_/.test(s)) return canUserManageProject(user, 'nilgiri');
      if (s.startsWith('test_')) return canUserManageProject(user, 'test');
    }
    return false;
  }
  if (user.role === 'Site Manager') {
    const assignedSites: string[] = [
      ...(Array.isArray(user.assigned_sites) ? user.assigned_sites : []),
      ...(Array.isArray(user.assignedSites) ? user.assignedSites : [])
    ].map(s => String(s).toLowerCase().trim()).filter(Boolean);
    if (!siteIdOrName) return false;
    const target = String(siteIdOrName).toLowerCase().trim();
    return assignedSites.some(s => s === target || target.startsWith(`${s}_`) || s.endsWith(`_${target}`));
  }
  return false;
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

  if (!email || !isSafeEmailLookup(email)) {
    return { error: 'Authentication required: missing or invalid user email.' };
  }

  // Find user by exact email (case-insensitive, with wildcards rejected)
  const { data: users, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .ilike('email', email.replace(/_/g, '\\_'));

  if (error || !users || users.length === 0) {
    return { error: 'Invalid credentials.' };
  }

  const rawUser = users[0];
  if (String(rawUser.email || '').toLowerCase().trim() !== email.toLowerCase().trim()) {
    return { error: 'Invalid credentials.' };
  }

  // Normalize snake_case and camelCase properties so all API routes can access either safely
  const user = {
    ...rawUser,
    assignedProjects: rawUser.assigned_projects || rawUser.assignedProjects || [],
    assigned_projects: rawUser.assigned_projects || rawUser.assignedProjects || [],
    assignedSites: rawUser.assigned_sites || rawUser.assignedSites || [],
    assigned_sites: rawUser.assigned_sites || rawUser.assignedSites || [],
    projectScopePermissions: rawUser.project_scope_permissions || rawUser.projectScopePermissions || [],
    project_scope_permissions: rawUser.project_scope_permissions || rawUser.projectScopePermissions || []
  };

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

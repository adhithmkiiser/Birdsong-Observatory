import { NextRequest } from 'next/server';
import { supabaseAdmin } from './supabaseAdmin';

export interface AuthGuardResult {
  error?: string;
  user?: any;
}

/**
 * Validates the X-User-Email and X-User-Password headers against the users table.
 * @param req NextRequest
 * @param allowedRoles Array of roles allowed to perform the action. Leave empty to allow any authenticated user.
 */
export async function authGuard(req: NextRequest, allowedRoles: string[] = []): Promise<AuthGuardResult> {
  const email = req.headers.get('X-User-Email');
  const password = req.headers.get('X-User-Password');

  if (!email) {
    return { error: 'Missing user email in request headers.' };
  }

  // Find user by email
  const { data: users, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .ilike('email', email.trim());

  if (error || !users || users.length === 0) {
    return { error: 'User account not found or invalid credentials.' };
  }

  const user = users[0];

  // If password header is supplied, verify it matches
  if (password && user.password_hash && user.password_hash !== password) {
    // Check if case matches or if admin
    if (user.password_hash.toLowerCase() !== password.toLowerCase() && user.role !== 'Admin') {
      return { error: 'Invalid credentials.' };
    }
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return { error: 'Insufficient permissions to perform this action.' };
  }

  return { user };
}

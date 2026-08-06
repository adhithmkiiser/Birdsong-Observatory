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

  if (!email || !password) {
    return { error: 'Missing authentication credentials in headers.' };
  }

  // Find user by email and verify password
  const { data: users, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .ilike('email', email.trim());

  if (error || !users || users.length === 0) {
    return { error: 'Invalid credentials.' };
  }

  const user = users[0];
  
  if (user.password_hash !== password) {
    return { error: 'Invalid credentials.' };
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return { error: 'Insufficient permissions to perform this action.' };
  }

  return { user };
}

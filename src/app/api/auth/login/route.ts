import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { authGuard, createSessionToken, isSafeEmailLookup } from '@/lib/authGuard';

// In-memory rate limiter for login attempts (max 8 attempts per 10 minutes per IP/email)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return false;
  }
  entry.count += 1;
  return true;
}

function sanitizeUser(dbUser: any, sessionToken?: string) {
  return {
    id: dbUser.id,
    name: dbUser.full_name || dbUser.name || 'User',
    email: dbUser.email,
    role: dbUser.role,
    organization: dbUser.organization || 'IISER Tirupati Bird Lab',
    assignedProjectType: dbUser.assigned_project_type || 'Both',
    projectScopePermissions: dbUser.project_scope_permissions || [],
    assignedProjects: dbUser.assigned_projects || [],
    assignedSites: dbUser.assigned_sites || [],
    isOneTimePassword: dbUser.is_one_time_password || false,
    mustChangePassword: dbUser.must_change_password || false,
    status: dbUser.status || 'active',
    createdAt: dbUser.created_at ? String(dbUser.created_at).split('T')[0] : '2026-01-15',
    lastLogin: dbUser.last_login || 'Just now',
    ...(sessionToken ? { sessionToken } : {})
  };
}

// GET: Validate and restore current logged-in session
export async function GET(req: NextRequest) {
  const { user, error } = await authGuard(req);
  if (error || !user) {
    return NextResponse.json({ authenticated: false, error: error || 'Not authenticated' }, { status: 401 });
  }
  const token = createSessionToken(user);
  return NextResponse.json({
    authenticated: true,
    user: sanitizeUser(user, token)
  });
}

// POST: Authenticate with email + password and issue HttpOnly session cookie + HMAC token
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    const body = await req.json();
    const email = String(body.email || '').trim();
    const password = String(body.password || '');

    if (!email || !password || !isSafeEmailLookup(email)) {
      return NextResponse.json({ success: false, message: 'Valid email and password are required.' }, { status: 400 });
    }

    const rateKey = `${ip}:${email.toLowerCase()}`;
    if (!checkRateLimit(rateKey)) {
      return NextResponse.json(
        { success: false, message: 'Too many failed login attempts. Please wait 10 minutes before trying again.' },
        { status: 429 }
      );
    }

    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .ilike('email', email.replace(/_/g, '\\_'))
      .limit(1);

    if (error || !users || users.length === 0 || String(users[0].email || '').toLowerCase().trim() !== email.toLowerCase()) {
      return NextResponse.json({ success: false, message: 'Invalid email or password.' }, { status: 401 });
    }

    const dbUser = users[0];

    // Constant-time password verification
    const expectedPass = String(dbUser.password_hash || '');
    const bufA = Buffer.from(password);
    const bufB = Buffer.from(expectedPass);
    const matches = bufA.length > 0 && bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);

    if (!matches) {
      return NextResponse.json({ success: false, message: 'Invalid email or password.' }, { status: 401 });
    }

    if (dbUser.status && dbUser.status !== 'active') {
      return NextResponse.json({ success: false, message: 'This account is currently suspended or inactive.' }, { status: 403 });
    }

    // Clear rate limit on successful login
    loginAttempts.delete(rateKey);

    // Update last_login timestamp asynchronously
    const nowIso = new Date().toISOString();
    await supabaseAdmin.from('users').update({ last_login: nowIso }).eq('id', dbUser.id);
    dbUser.last_login = nowIso;

    const sessionToken = createSessionToken(dbUser);
    const sanitized = sanitizeUser(dbUser, sessionToken);

    const res = NextResponse.json({
      success: true,
      message: `Welcome back, ${sanitized.name}!`,
      user: sanitized
    });

    res.cookies.set('birdlab_session', encodeURIComponent(JSON.stringify({ email: dbUser.email, token: sessionToken })), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return res;
  } catch (err: any) {
    return NextResponse.json({ success: false, message: 'Authentication error.' }, { status: 500 });
  }
}

// DELETE: Logout and clear HttpOnly session cookie
export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set('birdlab_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });
  return res;
}


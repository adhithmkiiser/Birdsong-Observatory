import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isSafeEmailLookup } from '@/lib/authGuard';

// Rate limiter for OTP password resets (max 3 requests per 10 minutes per email/IP)
const resetRateLimits = new Map<string, { count: number; resetAt: number }>();
const MAX_RESETS = 3;
const RESET_WINDOW_MS = 10 * 60 * 1000;

function checkResetRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = resetRateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    resetRateLimits.set(key, { count: 1, resetAt: now + RESET_WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_RESETS) return false;
  entry.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    const { email, name } = await req.json();

    if (!email || typeof email !== 'string' || !isSafeEmailLookup(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!checkResetRateLimit(`${ip}:${cleanEmail}`)) {
      return NextResponse.json(
        { error: 'Too many password reset requests. Please wait 10 minutes before requesting another code.' },
        { status: 429 }
      );
    }

    // Generate a cryptographically secure 6-digit OTP
    const generatedOTP = crypto.randomInt(100000, 1000000).toString();

    // 1. Locate the user in the database
    const { data: users, error: findError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name')
      .ilike('email', cleanEmail.replace(/_/g, '\\_'));

    if (findError || !users || users.length === 0 || String(users[0].email || '').toLowerCase().trim() !== cleanEmail) {
      // Return generic success to prevent email enumeration
      return NextResponse.json({ success: true, dispatched: false });
    }

    const targetUser = users[0];
    const userName = name || targetUser.full_name || 'User';

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        password_hash: generatedOTP,
        is_one_time_password: true,
        must_change_password: true
      })
      .eq('id', targetUser.id);

    if (updateError) {
      throw updateError;
    }

    // 2. Send the OTP email using Resend
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL || 'BirdSong Observatory <noreply@onboarding.resend.dev>';

    if (!apiKey) {
      return NextResponse.json(
        { success: true, dispatched: false, message: 'Updated DB, but Resend API key not configured' }
      );
    }

    const subject = 'BirdSong Observatory - Password Reset One-Time Code';
    const textBody = `Dear ${userName},

A password reset request was initiated for your BirdSong Observatory account.
Website link: https://birdsong-observatory.onrender.com/

Your Temporary One-Time Password (OTP) is: ${generatedOTP}

Please log in using your email (${targetUser.email}) and this temporary password. Upon initial login, you will be required to set your new permanent password.

Best regards,
IISER Tirupati Bioacoustics Research Team
BirdSong Observatory System`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: fromEmail,
        to: targetUser.email,
        subject,
        text: textBody
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText);
    }

    return NextResponse.json({
      success: true,
      dispatched: true,
      message: 'OTP email dispatched successfully'
    });

  } catch (error: any) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Failed to process password reset request' }, { status: 500 });
  }
}

// PUT: Set permanent password after initial login with temporary password / OTP
export async function PUT(req: NextRequest) {
  try {
    const { email, currentPassword, newPassword } = await req.json();

    if (!email || !currentPassword || !newPassword || !isSafeEmailLookup(String(email))) {
      return NextResponse.json(
        { error: 'Email, current/temporary password, and new permanent password are all required.' },
        { status: 400 }
      );
    }

    if (String(newPassword).length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const cleanTargetEmail = String(email).trim().toLowerCase();

    // 1. Locate user via supabaseAdmin
    const { data: users, error: findError } = await supabaseAdmin
      .from('users')
      .select('*')
      .ilike('email', cleanTargetEmail.replace(/_/g, '\\_'));

    if (findError || !users || users.length === 0 || String(users[0].email || '').toLowerCase().trim() !== cleanTargetEmail) {
      return NextResponse.json({ error: 'Current credentials could not be verified.' }, { status: 401 });
    }

    const targetUser = users[0];

    // Strictly verify currentPassword / OTP matches in constant time
    const expectedPass = String(targetUser.password_hash || '');
    const suppliedPass = String(currentPassword);
    const bufA = Buffer.from(suppliedPass);
    const bufB = Buffer.from(expectedPass);
    const isMatch = bufA.length > 0 && bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);

    if (!isMatch) {
      return NextResponse.json({ error: 'Current credentials could not be verified.' }, { status: 401 });
    }

    // 2. Update permanent password and clear temporary/OTP flags
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        password_hash: newPassword,
        is_one_time_password: false,
        must_change_password: false,
        last_login: new Date().toISOString()
      })
      .eq('id', targetUser.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: 'Permanent password established successfully.'
    });
  } catch (error: any) {
    console.error('Set permanent password error:', error);
    return NextResponse.json({ error: 'Failed to update credentials' }, { status: 500 });
  }
}

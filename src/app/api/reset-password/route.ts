import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { email, name } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Generate a 6-digit OTP
    const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();

    // 1. Update the user in the database
    const { data: users, error: findError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name')
      .ilike('email', email.trim());

    if (findError || !users || users.length === 0) {
      // Even if user is not found, return success to prevent email enumeration
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

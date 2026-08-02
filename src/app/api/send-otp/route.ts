import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email, name, otpCode, isNewUser = false } = await request.json();

    if (!email || !otpCode) {
      return NextResponse.json(
        { success: false, dispatched: false, message: 'Missing email or OTP' },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL || 'BirdSong Observatory <noreply@onboarding.resend.dev>';

    if (!apiKey) {
      return NextResponse.json(
        { success: false, dispatched: false, message: 'Resend API key not configured' },
        { status: 503 }
      );
    }

    const subject = isNewUser
      ? 'Welcome to BirdSong Observatory - Your One-Time Temporary Password'
      : 'BirdSong Observatory - Password Reset One-Time Code';

    const textBody = `Dear ${name},

${
  isNewUser
    ? 'An account has been created for you on the IISER Tirupati BirdSong Observatory Platform.'
    : 'A password reset request was initiated for your BirdSong Observatory account.'
}

Your Temporary One-Time Password (OTP) is: ${otpCode}

Please log in using your email (${email}) and this temporary password. Upon initial login, you will be required to set your new permanent password.

Best regards,
IISER Tirupati Bioacoustics Research Team
BirdSong Observatory System`.trim();

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: fromEmail,
        to: email,
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
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { success: false, dispatched: false, message: 'Failed to send OTP email' },
      { status: 500 }
    );
  }
}

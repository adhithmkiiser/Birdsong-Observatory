/**
 * BirdSong Observatory - Client-side email dispatcher
 * Sends OTP / welcome emails through the secure /api/send-otp server route.
 */

interface SendOTPEmailParams {
  email: string;
  name: string;
  otpCode: string;
  isNewUser?: boolean;
}

export async function sendOneTimePasswordEmail({
  email,
  name,
  otpCode,
  isNewUser = false
}: SendOTPEmailParams) {
  try {
    const res = await fetch('/api/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, otpCode, isNewUser })
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Email request failed' }));
      return { success: false, dispatched: false, message: error.message };
    }

    return await res.json();
  } catch (err) {
    console.error('Email request error:', err);
    return { success: false, dispatched: false, message: 'Email service unavailable' };
  }
}

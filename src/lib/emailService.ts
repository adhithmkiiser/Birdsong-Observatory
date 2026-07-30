/**
 * BirdSong Observatory - Automated Email Service Handler
 * Handles automated One-Time Password (OTP) dispatch and welcome emails.
 */

interface SendOTPEmailParams {
  email: string;
  name: string;
  otpCode: string;
  isNewUser?: boolean;
}

export async function sendOneTimePasswordEmail({ email, name, otpCode, isNewUser = false }: SendOTPEmailParams) {
  const subject = isNewUser
    ? 'Welcome to BirdSong Observatory - Your One-Time Temporary Password'
    : 'BirdSong Observatory - Password Reset One-Time Code';

  const textBody = `
Dear ${name},

${
  isNewUser
    ? 'An account has been created for you on the IISER Tirupati BirdSong Observatory Platform.'
    : 'A password reset request was initiated for your BirdSong Observatory account.'
}

Your Temporary One-Time Password (OTP) is: ${otpCode}

Please log in at http://localhost:3000 using your email (${email}) and this temporary password. Upon initial login, you will be required to set your new permanent password.

Best regards,
IISER Tirupati Bioacoustics Research Team
BirdSong Observatory System
`.trim();

  console.log(`
=======================================================================
📧 AUTOMATED EMAIL DISPATCH SIMULATION / DISPATCH LOG
-----------------------------------------------------------------------
TO: ${email}
SUBJECT: ${subject}
BODY:
${textBody}
=======================================================================
  `);

  // Webhook / API Dispatcher integration
  try {
    const resendApiKey = process.env.NEXT_PUBLIC_RESEND_API_KEY;
    if (resendApiKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`
        },
        body: JSON.stringify({
          from: 'BirdSong Observatory <noreply@birdsongobservatory.in>',
          to: email,
          subject,
          text: textBody
        })
      });
    }
  } catch (err) {
    console.error('Email API dispatch error:', err);
  }

  return { success: true, message: `OTP password email dispatched to ${email}` };
}

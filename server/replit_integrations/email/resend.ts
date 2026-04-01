import { Resend } from 'resend';

function getCredentials() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  return {
    apiKey,
    fromEmail: process.env.RESEND_FROM_EMAIL || "Co-star Studio <noreply@resend.dev>",
  };
}

export async function getUncachableResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail,
  };
}

export async function sendPasswordResetEmail(toEmail: string, resetToken: string) {
  const { client, fromEmail } = await getUncachableResendClient();

  const baseUrl = process.env.APP_URL || "http://localhost:5000";

  const resetUrl = `${baseUrl}?reset-token=${resetToken}`;

  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: 'Reset your password',
    html: `
      <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
        <h2 style="font-size: 20px; font-weight: 600; color: #0F172A; margin-bottom: 8px;">Reset your password</h2>
        <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 24px;">
          We received a request to reset the password for your Co-star Studio account. Click the button below to choose a new password.
        </p>
        <a href="${resetUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 500;">
          Reset password
        </a>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 24px; line-height: 1.5;">
          This link expires in 1 hour. If you did not request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

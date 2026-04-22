const { Resend } = require('resend');

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = 'Lingee <hello@lingee.app>';

function welcomeHtml(firstName) {
  const name = firstName || 'there';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
        <!-- Header -->
        <tr><td align="center" style="padding-bottom:24px">
          <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:20px;padding:24px 32px;text-align:center">
            <p style="margin:0;font-size:36px">🇭🇷</p>
            <h1 style="margin:12px 0 4px;color:#fff;font-size:24px;font-weight:800">Welcome to Lingee!</h1>
            <p style="margin:0;color:#c4b5fd;font-size:14px">Your Croatian learning journey starts now</p>
          </div>
        </td></tr>
        <!-- Body -->
        <tr><td style="background:#fff;border-radius:20px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
          <p style="margin:0 0 16px;font-size:16px;color:#374151">Hi <strong>${name}</strong>,</p>
          <p style="margin:0 0 16px;font-size:15px;color:#6b7280;line-height:1.6">
            Welcome aboard! You're now ready to start learning Croatian — one of the most in-demand skills for workers in Croatia.
          </p>
          <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6">
            Start with your first lesson today and build your streak. Your <strong>free plan</strong> includes 2 lessons per category and 3 hearts per day.
          </p>
          <div style="text-align:center;margin:0 0 24px">
            <a href="https://lingee.app" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:14px;text-decoration:none">
              Start Learning →
            </a>
          </div>
          <div style="background:#f5f3ff;border-radius:12px;padding:16px">
            <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#4f46e5;text-transform:uppercase;letter-spacing:0.5px">Want unlimited access?</p>
            <p style="margin:0;font-size:13px;color:#6b7280">Try <strong>Lingee Pro free for 30 days</strong> — unlimited hearts, all lessons, certificates and more.</p>
          </div>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 0;text-align:center">
          <p style="margin:0;font-size:12px;color:#9ca3af">© ${new Date().getFullYear()} Lingee · <a href="https://lingee.app" style="color:#6366f1;text-decoration:none">lingee.app</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function trialStartedHtml(firstName, plan) {
  const name = firstName || 'there';
  const planLabel = plan === 'yearly' ? 'Yearly (€9.99/year)' : 'Monthly (€2.99/month)';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
        <tr><td style="background:#fff;border-radius:20px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
          <p style="margin:0 0 8px;text-align:center;font-size:40px">🎉</p>
          <h1 style="margin:0 0 16px;text-align:center;font-size:22px;color:#111827">Your free trial has started!</h1>
          <p style="margin:0 0 16px;font-size:15px;color:#6b7280;line-height:1.6">
            Hi <strong>${name}</strong>, your 30-day free trial of <strong>Lingee Pro</strong> is now active.
          </p>
          <p style="margin:0 0 16px;font-size:14px;color:#6b7280">Selected plan: <strong>${planLabel}</strong></p>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6">
            You have full access to unlimited hearts, all lessons, and certificates for 30 days. After your trial, your selected plan will begin.
          </p>
          <div style="text-align:center">
            <a href="https://lingee.app" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:14px;text-decoration:none">
              Start Learning →
            </a>
          </div>
        </td></tr>
        <tr><td style="padding:20px 0;text-align:center">
          <p style="margin:0;font-size:12px;color:#9ca3af">© ${new Date().getFullYear()} Lingee · <a href="https://lingee.app" style="color:#6366f1;text-decoration:none">lingee.app</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendWelcomeEmail(email, firstName) {
  const resend = getResend();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: FROM,
      to: [email],
      subject: 'Welcome to Lingee! 🇭🇷',
      html: welcomeHtml(firstName),
    });
  } catch (err) {
    console.error('Welcome email error:', err?.message);
  }
}

async function sendTrialStartedEmail(email, firstName, plan) {
  const resend = getResend();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: FROM,
      to: [email],
      subject: 'Your Lingee Pro trial has started 🎉',
      html: trialStartedHtml(firstName, plan),
    });
  } catch (err) {
    console.error('Trial email error:', err?.message);
  }
}

module.exports = { sendWelcomeEmail, sendTrialStartedEmail };

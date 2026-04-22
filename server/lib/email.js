const { Resend } = require('resend');

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = 'Quizzo Club <hello@quizzo.club>';
const BASE = process.env.BASE_URL || 'https://quizzo.club';

function welcomeHtml(firstName) {
  const name = firstName || 'kvizašu';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
        <!-- Header -->
        <tr><td align="center" style="padding-bottom:24px">
          <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:20px;padding:24px 32px;text-align:center">
            <p style="margin:0;font-size:48px">🧠</p>
            <h1 style="margin:12px 0 4px;color:#fff;font-size:24px;font-weight:800">Dobrodošao/la u Quizzo Club!</h1>
            <p style="margin:0;color:#c4b5fd;font-size:14px">Tvoja pub kviz avantura počinje sada</p>
          </div>
        </td></tr>
        <!-- Body -->
        <tr><td style="background:#1e293b;border-radius:20px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,0.3)">
          <p style="margin:0 0 16px;font-size:16px;color:#e2e8f0">Bok <strong>${name}</strong>,</p>
          <p style="margin:0 0 16px;font-size:15px;color:#94a3b8;line-height:1.6">
            Dobrodošao/la na Quizzo Club! Testiraš opće znanje, izazoveš prijatelje i penjete se na ljestvici.
          </p>
          <p style="margin:0 0 24px;font-size:15px;color:#94a3b8;line-height:1.6">
            Počni s dnevnim kvizom danas i gradi svoju seriju. Tvoj <strong>besplatni plan</strong> uključuje do 5 kvizova dnevno.
          </p>
          <div style="text-align:center;margin:0 0 24px">
            <a href="${BASE}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:14px;text-decoration:none">
              Počni kvizati →
            </a>
          </div>
          <div style="background:#0f172a;border-radius:12px;padding:16px">
            <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#818cf8;text-transform:uppercase;letter-spacing:0.5px">Želi neograničen pristup?</p>
            <p style="margin:0;font-size:13px;color:#94a3b8">Isprobaj <strong>Quizzo Pro besplatno 30 dana</strong> — neograničeni kvizovi, Hunter Mode i napredne statistike.</p>
          </div>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 0;text-align:center">
          <p style="margin:0;font-size:12px;color:#475569">© ${new Date().getFullYear()} Quizzo Club · <a href="${BASE}" style="color:#6366f1;text-decoration:none">quizzo.club</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function trialStartedHtml(firstName, plan) {
  const name = firstName || 'kvizašu';
  const planLabel = plan === 'yearly' ? 'Godišnje (€9.99/god.)' : 'Mjesečno (€2.99/mj.)';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
        <tr><td style="background:#1e293b;border-radius:20px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,0.3)">
          <p style="margin:0 0 8px;text-align:center;font-size:40px">🎉</p>
          <h1 style="margin:0 0 16px;text-align:center;font-size:22px;color:#f1f5f9">Tvoj besplatni probni period je počeo!</h1>
          <p style="margin:0 0 16px;font-size:15px;color:#94a3b8;line-height:1.6">
            Bok <strong>${name}</strong>, tvoj 30-dnevni besplatni trial za <strong>Quizzo Pro</strong> je sada aktivan.
          </p>
          <p style="margin:0 0 16px;font-size:14px;color:#94a3b8">Odabrani plan: <strong style="color:#e2e8f0">${planLabel}</strong></p>
          <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.6">
            Imaš potpuni pristup svim kvizovima, Hunter Mode izazovima i statistikama 30 dana. Nakon triala, odabrani plan će biti naplaćen.
          </p>
          <div style="text-align:center">
            <a href="${BASE}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:14px;text-decoration:none">
              Idi na Quizzo Club →
            </a>
          </div>
        </td></tr>
        <tr><td style="padding:20px 0;text-align:center">
          <p style="margin:0;font-size:12px;color:#475569">© ${new Date().getFullYear()} Quizzo Club · <a href="${BASE}" style="color:#6366f1;text-decoration:none">quizzo.club</a></p>
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
      subject: 'Dobrodošao/la u Quizzo Club! 🧠',
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
      subject: 'Tvoj Quizzo Pro trial je počeo! 🎉',
      html: trialStartedHtml(firstName, plan),
    });
  } catch (err) {
    console.error('Trial email error:', err?.message);
  }
}

module.exports = { sendWelcomeEmail, sendTrialStartedEmail };

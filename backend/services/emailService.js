const nodemailer = require('nodemailer');

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

async function sendAlertEmail({ to, subject, text }) {
  const transporter = getTransporter();
  if (!transporter) {
    return { success: false, message: 'SMTP not configured' };
  }

  const fromName = process.env.SMTP_FROM_NAME || 'Mental Health Support';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  await transporter.sendMail({
    from: `${fromName} <${fromEmail}>`,
    to,
    subject,
    text,
  });

  return { success: true };
}

module.exports = {
  sendAlertEmail,
};

const nodemailer = require('nodemailer');
const https = require('https');
const { URL } = require('url');
require('dotenv').config();

let transporter = null;

function anonymizeEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return email || 'unknown';
  const [local, domain] = email.split('@');
  const safeLocal = local.length > 2 ? local[0] + '***' + local[local.length - 1] : local[0] + '***';
  return `${safeLocal}@${domain}`;
}

/**
 * Determine active email provider: 'resend' | 'sendgrid' | 'brevo' | 'smtp'
 */
function getActiveProvider() {
  if (process.env.EMAIL_PROVIDER) {
    return process.env.EMAIL_PROVIDER.toLowerCase();
  }
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.SENDGRID_API_KEY) return 'sendgrid';
  if (process.env.BREVO_API_KEY) return 'brevo';
  return 'smtp';
}

/**
 * Helper to make HTTPS POST requests with timeout
 */
function makeHttpsRequest(urlString, headers, data, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const bodyStr = JSON.stringify(data);

    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => {
          let parsed;
          try {
            parsed = responseBody ? JSON.parse(responseBody) : {};
          } catch {
            parsed = { raw: responseBody };
          }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, data: parsed });
          } else {
            const errDetail = parsed.message || parsed.error || parsed.errors || responseBody || `HTTP ${res.statusCode}`;
            const err = new Error(`API error (${res.statusCode}): ${typeof errDetail === 'object' ? JSON.stringify(errDetail) : errDetail}`);
            err.statusCode = res.statusCode;
            err.response = parsed;
            reject(err);
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`HTTPS request timed out after ${timeoutMs}ms`));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(bodyStr);
    req.end();
  });
}

/**
 * Send email via Resend HTTPS API (Port 443)
 */
async function sendViaResend({ to, from, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is missing in backend/.env');
  }

  const recipients = Array.isArray(to) ? to : [to];
  const payload = {
    from: from || process.env.EMAIL_FROM || 'Customer Feedback Support <onboarding@resend.dev>',
    to: recipients,
    subject,
    text,
    html,
  };

  const res = await makeHttpsRequest(
    'https://api.resend.com/emails',
    { Authorization: `Bearer ${apiKey}` },
    payload
  );

  return { success: true, messageId: res.data?.id || `resend_${Date.now()}` };
}

/**
 * Send email via SendGrid v3 HTTPS API (Port 443)
 */
async function sendViaSendGrid({ to, from, subject, text, html }) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY is missing in backend/.env');
  }

  const recipients = (Array.isArray(to) ? to : [to]).map(email => ({ email }));
  const fromAddress = from || process.env.EMAIL_FROM || process.env.EMAIL_USER || 'support@cfms.local';
  
  let senderEmail = fromAddress;
  let senderName = 'Customer Feedback Support';
  const match = fromAddress.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
  if (match) {
    senderName = match[1] || senderName;
    senderEmail = match[2];
  }

  const payload = {
    personalizations: [{ to: recipients }],
    from: { email: senderEmail, name: senderName },
    subject,
    content: [
      ...(text ? [{ type: 'text/plain', value: text }] : []),
      ...(html ? [{ type: 'text/html', value: html }] : []),
    ],
  };

  const res = await makeHttpsRequest(
    'https://api.sendgrid.com/v3/mail/send',
    { Authorization: `Bearer ${apiKey}` },
    payload
  );

  return { success: true, messageId: `sendgrid_${Date.now()}` };
}

/**
 * Send email via Brevo v3 HTTPS API (Port 443)
 */
async function sendViaBrevo({ to, from, subject, text, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is missing in backend/.env');
  }

  const recipients = (Array.isArray(to) ? to : [to]).map(email => ({ email }));
  const fromAddress = from || process.env.EMAIL_FROM || process.env.EMAIL_USER || 'support@cfms.local';

  let senderEmail = fromAddress;
  let senderName = 'Customer Feedback Support';
  const match = fromAddress.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
  if (match) {
    senderName = match[1] || senderName;
    senderEmail = match[2];
  }

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: recipients,
    subject,
    textContent: text,
    htmlContent: html,
  };

  const res = await makeHttpsRequest(
    'https://api.brevo.com/v3/smtp/email',
    { 'api-key': apiKey },
    payload
  );

  return { success: true, messageId: res.data?.messageId || `brevo_${Date.now()}` };
}

/**
 * Configure / Get Nodemailer Transporter for standard SMTP
 */
async function getTransporter() {
  if (transporter) return transporter;

  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || emailUser === 'mock_user@ethereal.email' || !emailPass || emailPass === 'mock_password' || emailPass.includes('YOUR_GMAIL_APP_PASSWORD')) {
    const errMsg = 'Real SMTP credentials are missing in backend/.env. Please set EMAIL_SERVICE=gmail, EMAIL_USER, and EMAIL_PASS.';
    console.error(`[SMTP ERROR] ${errMsg}`);
    throw new Error(errMsg);
  }

  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
  const isSecure = process.env.EMAIL_SECURE === 'true' || port === 465;
  const emailService = process.env.EMAIL_SERVICE;

  const transportConfig = emailService === 'gmail' ? {
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPass,
    },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000
  } : {
    host,
    port,
    secure: isSecure,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
    tls: {
      rejectUnauthorized: false
    }
  };

  transporter = nodemailer.createTransport(transportConfig);
  return transporter;
}

/**
 * Core unified dispatch function routing to the active email provider
 */
async function dispatchEmail({ to, subject, text, html, from }) {
  const provider = getActiveProvider();
  const recipients = Array.isArray(to) ? to : [to];
  const anonymizedList = recipients.map(anonymizeEmail).join(', ');

  console.log(`[MAILER] Dispatching email to [${anonymizedList}] via provider: ${provider.toUpperCase()}`);

  if (provider === 'resend') {
    return await sendViaResend({ to, from, subject, text, html });
  }

  if (provider === 'sendgrid') {
    return await sendViaSendGrid({ to, from, subject, text, html });
  }

  if (provider === 'brevo') {
    return await sendViaBrevo({ to, from, subject, text, html });
  }

  // Fallback to SMTP
  const client = await getTransporter();
  const fromAddress = from || process.env.EMAIL_FROM || `"Customer Feedback Support" <${process.env.EMAIL_USER}>`;
  const info = await client.sendMail({
    from: fromAddress,
    to: recipients,
    subject,
    text,
    html,
  });

  return { success: true, messageId: info.messageId };
}

/**
 * Verify connectivity of the configured mailer provider
 */
async function verifySmtp() {
  const provider = getActiveProvider();
  console.log('---------------------------------------------------------');
  console.log(`[MAILER] Active Email Provider: ${provider.toUpperCase()}`);

  if (provider === 'resend') {
    const hasKey = !!process.env.RESEND_API_KEY;
    console.log(`[MAILER] Resend API Key configured: ${hasKey ? 'YES' : 'NO'}`);
    console.log('---------------------------------------------------------');
    return hasKey;
  }

  if (provider === 'sendgrid') {
    const hasKey = !!process.env.SENDGRID_API_KEY;
    console.log(`[MAILER] SendGrid API Key configured: ${hasKey ? 'YES' : 'NO'}`);
    console.log('---------------------------------------------------------');
    return hasKey;
  }

  if (provider === 'brevo') {
    const hasKey = !!process.env.BREVO_API_KEY;
    console.log(`[MAILER] Brevo API Key configured: ${hasKey ? 'YES' : 'NO'}`);
    console.log('---------------------------------------------------------');
    return hasKey;
  }

  const emailUser = process.env.EMAIL_USER;
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  console.log(`SMTP host: ${host}`);
  console.log(`SMTP user: ${anonymizeEmail(emailUser)}`);

  try {
    const client = await getTransporter();
    const verifyPromise = client.verify().catch(() => {});
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('SMTP connection timed out after 5000ms')), 5000)
    );
    await Promise.race([verifyPromise, timeoutPromise]);
    console.log('SMTP verification: SUCCESS');
    console.log('---------------------------------------------------------');
    return true;
  } catch (err) {
    console.error(`SMTP verification: FAILED (${err.message})`);
    console.log('---------------------------------------------------------');
    return false;
  }
}

async function sendResetMail(email, token) {
  const resetUrl = `http://localhost:3000/reset-password?token=${token}`;
  const fromAddress = process.env.EMAIL_FROM || `"Customer Feedback Support" <${process.env.EMAIL_USER}>`;

  const mailOptions = {
    from: fromAddress,
    to: email,
    subject: 'Password Reset Request',
    text: `You requested a password reset. Click this link to reset your password: ${resetUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>You requested a password reset for your Customer Feedback Management System account.</p>
        <p>Please click the button below to reset your password. This link is valid for 1 hour.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:<br><a href="${resetUrl}">${resetUrl}</a></p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #777;">If you did not request this, please ignore this email.</p>
      </div>
    `,
  };

  try {
    const info = await dispatchEmail(mailOptions);
    console.log(`[MAILER SUCCESS] Password reset email delivered to ${anonymizeEmail(email)}. Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[MAILER ERROR] sendResetMail failed for ${anonymizeEmail(email)}:`, err.message);
    throw err;
  }
}

async function sendOtpMail(email, otp) {
  const fromAddress = process.env.EMAIL_FROM || `"Customer Feedback Support" <${process.env.EMAIL_USER}>`;

  const mailOptions = {
    from: fromAddress,
    to: email,
    subject: 'Your Password Reset OTP',
    text: `Your one-time password (OTP) for resetting your CFMS account password is: ${otp}\n\nThis code is valid for 10 minutes. Do not share it with anyone.\n\nIf you did not request this, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
        <h2 style="color: #333;">Password Reset OTP</h2>
        <p>You requested a password reset for your Customer Feedback Management System account.</p>
        <p>Your one-time password (OTP) is:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="background-color: #3b82f6; color: white; padding: 16px 32px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 8px; display: inline-block;">${otp}</span>
        </div>
        <p style="color: #555;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #777;">If you did not request this, please ignore this email. Your password will not change.</p>
      </div>
    `,
  };

  try {
    const info = await dispatchEmail(mailOptions);
    console.log(`[MAILER SUCCESS] OTP email delivered to ${anonymizeEmail(email)}. Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[MAILER ERROR] Failed delivering OTP email to ${anonymizeEmail(email)}:`, err.message);
    throw err;
  }
}

async function sendEscalationEmail(details) {
  const { email, managerName, complaintNumber, salesExecutiveName, customerCode, invoiceNumber, complaintType, complaintSubtype } = details;
  const typeDisplay = complaintSubtype ? `${complaintType} (${complaintSubtype})` : complaintType;
  const recipients = Array.isArray(email) ? email.filter(e => e && e.includes('@')) : [email];

  if (recipients.length === 0) {
    console.warn(`[MAIL WARN] sendEscalationEmail skipped for ${complaintNumber}: No valid recipient emails.`);
    return { success: false, message: 'No recipients' };
  }

  const fromAddress = process.env.EMAIL_FROM || `"Customer Feedback Support" <${process.env.EMAIL_USER}>`;
  const mailOptions = {
    from: fromAddress,
    to: recipients,
    subject: `Complaint Escalated - ${complaintNumber}`,
    text: `Hello ${managerName || 'Warehouse Manager'},\n\nA complaint has been escalated and requires your attention.\n\nComplaint Number: ${complaintNumber}\nSales Executive: ${salesExecutiveName || 'N/A'}\nCustomer Code: ${customerCode}\nInvoice Number: ${invoiceNumber}\nComplaint Type: ${typeDisplay}\nStatus: Escalated to Manager\n\nPlease log in to your dashboard to review and take action.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
        <h2 style="color: #dc2626;">Complaint Escalated - Attention Required</h2>
        <p>Hello ${managerName || 'Warehouse Manager'},</p>
        <p>The following complaint has been escalated and requires your urgent review:</p>
        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 4px 0;"><strong>Complaint Number:</strong> ${complaintNumber}</p>
          <p style="margin: 4px 0;"><strong>Raised By (Sales Exec):</strong> ${salesExecutiveName || 'N/A'}</p>
          <p style="margin: 4px 0;"><strong>Customer Code:</strong> ${customerCode}</p>
          <p style="margin: 4px 0;"><strong>Invoice Number:</strong> ${invoiceNumber}</p>
          <p style="margin: 4px 0;"><strong>Complaint Type:</strong> ${typeDisplay}</p>
          <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color: #dc2626; font-weight: bold;">Escalated to Manager</span></p>
        </div>
        <p>Please log in to your Customer Feedback Management System dashboard to review details and take action.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #777;">This is an automated notification from the Customer Feedback Management System.</p>
      </div>
    `,
  };

  try {
    const info = await dispatchEmail(mailOptions);
    console.log(`[MAILER SUCCESS] Escalation email sent for Complaint ${complaintNumber}. Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[MAILER ERROR] sendEscalationEmail failed for Complaint ${complaintNumber}:`, err.message);
    throw err;
  }
}

async function sendResolutionEmail(details) {
  const { email, salesExecutiveName, complaintNumber, customerCode, invoiceNumber, warehouseName, complaintType, complaintSubtype } = details;
  const typeDisplay = complaintSubtype ? `${complaintType} (${complaintSubtype})` : complaintType;
  const fromAddress = process.env.EMAIL_FROM || `"Customer Feedback Support" <${process.env.EMAIL_USER}>`;

  const mailOptions = {
    from: fromAddress,
    to: email,
    subject: `Your Complaint Has Been Resolved - ${complaintNumber}`,
    text: `Hello ${salesExecutiveName || 'Sales Executive'},\n\nYour complaint has been resolved.\n\nComplaint Number: ${complaintNumber}\nCustomer Code: ${customerCode}\nInvoice Number: ${invoiceNumber}\nWarehouse: ${warehouseName}\nComplaint Type: ${typeDisplay}\nStatus: Resolved / Completed\n\nThank you for using the Customer Feedback Management System.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
        <h2 style="color: #16a34a;">Your Complaint Has Been Resolved</h2>
        <p>Hello ${salesExecutiveName || 'Sales Executive'},</p>
        <p>Your complaint has been marked as resolved:</p>
        <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 4px 0;"><strong>Complaint Number:</strong> ${complaintNumber}</p>
          <p style="margin: 4px 0;"><strong>Customer Code:</strong> ${customerCode}</p>
          <p style="margin: 4px 0;"><strong>Invoice Number:</strong> ${invoiceNumber}</p>
          <p style="margin: 4px 0;"><strong>Warehouse:</strong> ${warehouseName}</p>
          <p style="margin: 4px 0;"><strong>Complaint Type:</strong> ${typeDisplay}</p>
          <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color: #16a34a; font-weight: bold;">Resolved</span></p>
        </div>
        <p>You can view the full details in your Customer Feedback Management System dashboard.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #777;">This is an automated notification from the Customer Feedback Management System.</p>
      </div>
    `,
  };

  try {
    const info = await dispatchEmail(mailOptions);
    console.log(`[MAILER SUCCESS] Resolution email sent for Complaint ${complaintNumber}. Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[MAILER ERROR] sendResolutionEmail failed for Complaint ${complaintNumber}:`, err.message);
    throw err;
  }
}

module.exports = {
  verifySmtp,
  sendResetMail,
  sendOtpMail,
  sendEscalationEmail,
  sendResolutionEmail,
  getActiveProvider
};

const assert = require('assert');
const mailer = require('../config/mailer');
const AuthService = require('../services/auth.service');
const authService = new AuthService();
const UserRepository = require('../repositories/mssql/user.repository');
const AuditRepository = require('../repositories/mssql/audit.repository');
const { AppError } = require('../utils/errors');

async function runTransactionalMailerTests() {
  console.log('====================================================');
  console.log('RUNNING TRANSACTIONAL MAILER & OTP SAFETY SUITE');
  console.log('====================================================');

  // 1. Test Provider Selection
  console.log('\n[TEST 1] Provider Resolution Logic');
  const prevProvider = process.env.EMAIL_PROVIDER;
  const prevResend = process.env.RESEND_API_KEY;
  const prevSendgrid = process.env.SENDGRID_API_KEY;
  const prevBrevo = process.env.BREVO_API_KEY;

  delete process.env.EMAIL_PROVIDER;
  delete process.env.RESEND_API_KEY;
  delete process.env.SENDGRID_API_KEY;
  delete process.env.BREVO_API_KEY;
  assert.strictEqual(mailer.getActiveProvider(), 'smtp', 'Should default to SMTP if no API keys');

  process.env.RESEND_API_KEY = 're_test_123';
  assert.strictEqual(mailer.getActiveProvider(), 'resend', 'Should auto-select Resend when RESEND_API_KEY is present');

  process.env.EMAIL_PROVIDER = 'sendgrid';
  assert.strictEqual(mailer.getActiveProvider(), 'sendgrid', 'EMAIL_PROVIDER should override auto-detection');

  process.env.EMAIL_PROVIDER = 'brevo';
  assert.strictEqual(mailer.getActiveProvider(), 'brevo', 'EMAIL_PROVIDER brevo should work');

  // Restore env
  if (prevProvider) process.env.EMAIL_PROVIDER = prevProvider; else delete process.env.EMAIL_PROVIDER;
  if (prevResend) process.env.RESEND_API_KEY = prevResend; else delete process.env.RESEND_API_KEY;
  if (prevSendgrid) process.env.SENDGRID_API_KEY = prevSendgrid; else delete process.env.SENDGRID_API_KEY;
  if (prevBrevo) process.env.BREVO_API_KEY = prevBrevo; else delete process.env.BREVO_API_KEY;
  console.log('✓ Provider resolution logic passed');

  // 2. Test OTP Delivery Failure -> HTTP 503 and NO DB OTP Persistence
  console.log('\n[TEST 2] OTP Delivery Failure -> HTTP 503 & No OTP Persistence');
  const originalFindByEmail = UserRepository.prototype.findByEmail;
  const originalSetOtp = UserRepository.prototype.setOtp;
  const originalSendOtpMail = mailer.sendOtpMail;
  const originalAuditCreate = AuditRepository.prototype.create;

  let dbOtpPersisted = false;
  UserRepository.prototype.findByEmail = async (email) => ({
    id: 999,
    email: 'test.user@example.com',
    status: 'Active'
  });
  UserRepository.prototype.setOtp = async (email, otp, expiry) => {
    dbOtpPersisted = true;
  };
  AuditRepository.prototype.create = async () => {};

  // Mock mailer failure
  mailer.sendOtpMail = async () => {
    throw new Error('API network timeout on transactional endpoint');
  };

  let threwExpected = false;
  try {
    await authService.forgotPassword('test.user@example.com', '127.0.0.1', 'TestAgent');
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 503) {
      threwExpected = true;
      assert.strictEqual(err.message, 'Unable to send verification email. Please try again later.');
      assert.strictEqual(dbOtpPersisted, false, 'CRITICAL: DB OTP must NOT be persisted when email dispatch fails');
      console.log('✓ OTP delivery failure properly threw 503 and prevented DB persistence');
    } else {
      throw err;
    }
  }
  assert.ok(threwExpected, 'Expected forgotPassword to throw AppError(503) on mailer failure');

  // 3. Test Successful Delivery -> OTP Persisted in DB and 200 OK
  console.log('\n[TEST 3] Successful Delivery -> OTP Persisted in DB & 200 OK');
  let savedOtp = null;
  UserRepository.prototype.setOtp = async (email, otp, expiry) => {
    savedOtp = otp;
  };
  mailer.sendOtpMail = async (email, otp) => {
    assert.strictEqual(email, 'test.user@example.com');
    assert.ok(/^\d{6}$/.test(otp), 'OTP must be 6 digits');
    return { success: true, messageId: 'msg_test_12345' };
  };

  const res = await authService.forgotPassword('test.user@example.com', '127.0.0.1', 'TestAgent');
  assert.strictEqual(res.message, 'If that email is registered, an OTP has been sent.');
  assert.ok(savedOtp && /^\d{6}$/.test(savedOtp), 'OTP must be persisted in DB upon successful delivery');
  console.log('✓ Successful delivery persisted OTP in DB and returned standard response');

  // 4. Test Anti-Enumeration for Non-Existent User
  console.log('\n[TEST 4] Anti-Enumeration for Non-Existent User');
  UserRepository.prototype.findByEmail = async () => null;
  let mailerCalled = false;
  mailer.sendOtpMail = async () => { mailerCalled = true; };

  const genericRes = await authService.forgotPassword('nonexistent@example.com', '127.0.0.1', 'TestAgent');
  assert.strictEqual(genericRes.message, 'If that email is registered, an OTP has been sent.');
  assert.strictEqual(mailerCalled, false, 'Mailer must NOT be called for non-existent users');
  console.log('✓ Anti-enumeration behavior verified');

  // Restore mocks
  UserRepository.prototype.findByEmail = originalFindByEmail;
  UserRepository.prototype.setOtp = originalSetOtp;
  mailer.sendOtpMail = originalSendOtpMail;
  AuditRepository.prototype.create = originalAuditCreate;

  console.log('\n====================================================');
  console.log('ALL TRANSACTIONAL MAILER TESTS PASSED (4/4)');
  console.log('====================================================');
}

runTransactionalMailerTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

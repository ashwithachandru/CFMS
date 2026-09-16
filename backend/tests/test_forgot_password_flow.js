const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const http = require('http');
const { connectDB, getPool, sql } = require('../config/db');
const AuthService = require('../services/auth.service');
const UserRepository = require('../repositories/mssql/user.repository');

const authService = new AuthService();
const userRepo = new UserRepository();

async function sendRequest(urlPath, bodyObj) {
  const body = JSON.stringify(bodyObj);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 4000,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, rawBody: data });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('STARTING FORGOT PASSWORD FULL FLOW VERIFICATION');
  console.log('====================================================\n');

  await connectDB();
  const pool = getPool();

  const testEmail = '71762333004@cit.edu.in';

  // 1. Test A: Invalid Email Format
  console.log('--- Test 1: Invalid Email Format ---');
  const resB = await sendRequest('/api/auth/forgot-password', { email: 'not-a-valid-email' });
  console.log('Status:', resB.statusCode);
  console.log('Body:', resB.body);
  if (resB.statusCode !== 400 || resB.body.success !== false) {
    throw new Error('Test 1 failed: Expected 400 for invalid email');
  }
  console.log('✅ PASS: Test 1 (Invalid email format rejected with 400)');

  // 2. Test 2: Empty Email
  console.log('\n--- Test 2: Empty Email ---');
  const resC = await sendRequest('/api/auth/forgot-password', { email: '' });
  console.log('Status:', resC.statusCode);
  console.log('Body:', resC.body);
  if (resC.statusCode !== 400 || resC.body.success !== false) {
    throw new Error('Test 2 failed: Expected 400 for empty email');
  }
  console.log('✅ PASS: Test 2 (Empty email rejected with 400)');

  // 3. Test 3: Unknown / Non-existent Email
  console.log('\n--- Test 3: Unknown / Non-existent Email ---');
  const resE = await sendRequest('/api/auth/forgot-password', { email: 'unknown_account_xyz99@cit.edu.in' });
  console.log('Status:', resE.statusCode);
  console.log('Body:', resE.body);
  // Security standard: Generic 200 response to prevent account enumeration
  if (resE.statusCode !== 200 || !resE.body.success) {
    throw new Error('Test 3 failed: Expected generic 200 for unknown email');
  }
  console.log('✅ PASS: Test 3 (Generic 200 returned for unknown email to prevent enumeration)');

  // 4. Test 4: Live Delivery Failure Behavior (when network blocks SMTP port 587/465)
  console.log('\n--- Test 4: Live Delivery Behavior on Blocked Network ---');
  const resLive = await sendRequest('/api/auth/forgot-password', { email: testEmail });
  console.log('Status:', resLive.statusCode);
  console.log('Body:', resLive.body);
  if (resLive.statusCode === 503) {
    console.log('✅ PASS: Test 4 (Correctly returned 503 "Unable to send verification email" when SMTP is blocked without falsely claiming delivery)');
  } else if (resLive.statusCode === 200) {
    console.log('✅ PASS: Test 4 (SMTP delivery succeeded and returned 200 OK)');
  } else {
    throw new Error(`Test 4 failed: Unexpected status code ${resLive.statusCode}`);
  }

  // 5. Test 5: Simulated Successful Email Dispatch & Full Flow
  console.log('\n--- Test 5: Full Flow with Mocked Successful Email Delivery ---');
  // Generate valid test OTP in DB directly to simulate successful email delivery
  const testOtp = '849201';
  const testExpiry = new Date(Date.now() + 10 * 60 * 1000);
  await userRepo.setOtp(testEmail, testOtp, testExpiry);

  // 5a. Wrong OTP
  console.log('\n--- Test 5a: Wrong OTP Code ---');
  const resWrongOtp = await sendRequest('/api/auth/verify-otp', { email: testEmail, otp: '000000' });
  console.log('Status:', resWrongOtp.statusCode);
  console.log('Body:', resWrongOtp.body);
  if (resWrongOtp.statusCode !== 400) {
    throw new Error('Test 5a failed: Wrong OTP should return 400');
  }
  console.log('✅ PASS: Test 5a (Incorrect OTP rejected)');

  // 5b. Correct OTP
  console.log('\n--- Test 5b: Correct OTP Code ---');
  const resCorrectOtp = await sendRequest('/api/auth/verify-otp', { email: testEmail, otp: testOtp });
  console.log('Status:', resCorrectOtp.statusCode);
  console.log('Body:', resCorrectOtp.body);
  if (resCorrectOtp.statusCode !== 200 || !resCorrectOtp.body.data?.resetToken) {
    throw new Error('Test 5b failed: Valid OTP should return resetToken');
  }
  const resetSessionToken = resCorrectOtp.body.data.resetToken;
  console.log(`✅ PASS: Test 5b (Valid OTP verified, received session token: ${resetSessionToken.slice(0, 8)}...)`);

  // 5c. Weak password rejected
  console.log('\n--- Test 5c: Weak Password on Reset ---');
  const resWeak = await sendRequest('/api/auth/reset-password', { token: resetSessionToken, password: 'weak' });
  console.log('Status:', resWeak.statusCode);
  if (resWeak.statusCode !== 400) {
    throw new Error('Test 5c failed: Weak password should be rejected');
  }
  console.log('✅ PASS: Test 5c (Weak password rejected by complexity validation)');

  // 5d. Strong password reset
  console.log('\n--- Test 5d: Strong Password Reset ---');
  const newPassword = 'NewSecretPassword@2026!';
  const resReset = await sendRequest('/api/auth/reset-password', { token: resetSessionToken, password: newPassword });
  console.log('Status:', resReset.statusCode);
  console.log('Body:', resReset.body);
  if (resReset.statusCode !== 200 || !resReset.body.success) {
    throw new Error('Test 5d failed: Password reset should succeed with 200');
  }
  console.log('✅ PASS: Test 5d (Password reset succeeded)');

  // 5e. Login with new password
  console.log('\n--- Test 5e: Login with Newly Reset Password ---');
  const resLogin = await sendRequest('/api/auth/login', { email: testEmail, password: newPassword });
  console.log('Status:', resLogin.statusCode);
  console.log('Body user:', resLogin.body.data?.user?.email);
  if (resLogin.statusCode !== 200 || !resLogin.body.data?.accessToken) {
    throw new Error('Test 5e failed: Login with new password failed');
  }
  console.log('✅ PASS: Test 5e (Successfully logged in with the new password!)');

  // Restore original test password
  const origPasswordHash = await require('bcrypt').hash('71762333004', 10);
  await pool.request()
    .input('email', sql.VarChar, testEmail)
    .input('pass', sql.VarChar, origPasswordHash)
    .query("UPDATE Users SET password_hash = @pass, reset_token = NULL, reset_token_expiry = NULL WHERE email = @email");
  console.log('\nRestored original test password for 71762333004@cit.edu.in');

  console.log('\n====================================================');
  console.log('ALL FORGOT PASSWORD & OTP TESTS PASSED!');
  console.log('====================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});

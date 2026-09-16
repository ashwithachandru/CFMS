const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const nodemailer = require('nodemailer');

async function testPort(port, secure) {
  console.log(`\nTesting port ${port} (secure: ${secure})...`);
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: port,
    secure: secure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
    tls: {
      rejectUnauthorized: false
    }
  });

  try {
    const res = await transporter.verify();
    console.log(`Port ${port} SUCCESS:`, res);
    return true;
  } catch (err) {
    console.error(`Port ${port} FAILED:`, err.message);
    return false;
  }
}

async function run() {
  await testPort(587, false);
  await testPort(465, true);
  await testPort(25, false);
}

run();

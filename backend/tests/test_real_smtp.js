const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const nodemailer = require('nodemailer');
const dns = require('dns');
const net = require('net');

async function testDns() {
  console.log('--- 1. Testing DNS Resolution for smtp.gmail.com ---');
  return new Promise((resolve) => {
    dns.lookup('smtp.gmail.com', { all: true }, (err, addresses) => {
      if (err) {
        console.error('DNS Lookup Failed:', err.message);
        resolve(false);
      } else {
        console.log('DNS Lookup Succeeded. Resolved IPs:', addresses);
        resolve(true);
      }
    });
  });
}

async function testTcpSocket(host, port, timeoutMs = 5000) {
  console.log(`\n--- 2. Testing Raw TCP Socket to ${host}:${port} ---`);
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let connected = false;

    socket.setTimeout(timeoutMs);

    socket.connect(port, host, () => {
      connected = true;
      console.log(`✅ TCP Socket Connected Successfully to ${host}:${port}`);
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      console.error(`❌ TCP Connection Timed Out to ${host}:${port} after ${timeoutMs}ms`);
      socket.destroy();
      resolve(false);
    });

    socket.on('error', (err) => {
      console.error(`❌ TCP Socket Error on ${host}:${port}:`, err.message);
      resolve(false);
    });
  });
}

async function testNodemailerConfig(name, config) {
  console.log(`\n--- 3. Testing Nodemailer Configuration: [${name}] ---`);
  const transporter = nodemailer.createTransport(config);

  try {
    const verifyRes = await transporter.verify();
    console.log(`✅ [${name}] Transporter Verify Succeeded:`, verifyRes);
    return transporter;
  } catch (err) {
    console.error(`❌ [${name}] Transporter Verify Failed:`, err.message);
    if (err.code) console.error(`   Error Code: ${err.code}`);
    if (err.response) console.error(`   SMTP Response: ${err.response}`);
    return null;
  }
}

async function main() {
  await testDns();

  // Test TCP sockets to Gmail ports
  const tcp587 = await testTcpSocket('smtp.gmail.com', 587);
  const tcp465 = await testTcpSocket('smtp.gmail.com', 465);
  const tcp25 = await testTcpSocket('smtp.gmail.com', 25);

  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  console.log('\n--- Environment Configuration ---');
  console.log('EMAIL_USER:', emailUser ? `${emailUser.slice(0, 3)}***${emailUser.slice(emailUser.indexOf('@'))}` : 'MISSING');
  console.log('EMAIL_PASS length:', emailPass ? emailPass.length : 0);
  console.log('EMAIL_PASS format (16 chars with no spaces):', emailPass && emailPass.length === 16 && !emailPass.includes(' '));

  // Test Nodemailer configs
  // A. Well-known service 'gmail'
  const tService = await testNodemailerConfig("service: 'gmail'", {
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPass
    },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000
  });

  // B. Direct host port 465 SSL
  const tPort465 = await testNodemailerConfig("host: 'smtp.gmail.com', port: 465, secure: true", {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: emailUser,
      pass: emailPass
    },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
    tls: { rejectUnauthorized: false }
  });

  // C. Direct host port 587 TLS
  const tPort587 = await testNodemailerConfig("host: 'smtp.gmail.com', port: 587, secure: false", {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: emailUser,
      pass: emailPass
    },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
    tls: { rejectUnauthorized: false }
  });

  const workingTransporter = tService || tPort465 || tPort587;

  if (workingTransporter) {
    console.log('\n--- 4. Attempting to Send Real Test Email ---');
    try {
      const sendRes = await workingTransporter.sendMail({
        from: `"Customer Feedback Support" <${emailUser}>`,
        to: emailUser,
        subject: 'CFMS Real Email Delivery Test',
        text: 'This is a test email confirming real email delivery from CFMS.',
        html: '<p>This is a test email confirming real email delivery from <strong>CFMS</strong>.</p>'
      });
      console.log('✅ Real Test Email Sent Successfully! Message ID:', sendRes.messageId);
    } catch (sendErr) {
      console.error('❌ Failed Sending Real Test Email:', sendErr.message);
    }
  } else {
    console.log('\n❌ No working transporter configuration could establish connection to smtp.gmail.com.');
  }

  process.exit(0);
}

main();

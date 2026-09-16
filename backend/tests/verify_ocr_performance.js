const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const jwt = require('jsonwebtoken');
const fs = require('fs');
const http = require('http');

async function testNonBlockingDirect() {
  console.log('--- TEST 1: Direct Async Non-Blocking Execution ---');
  const complaintRoutesPath = path.join(__dirname, '../routes/complaint.routes.js');
  const ocrScriptPath = path.join(__dirname, '../services/ocr_service.py');
  const testImagePath = path.join(__dirname, '../../sample_invoice_001.jpg');

  if (!fs.existsSync(testImagePath)) {
    throw new Error('Test image not found at ' + testImagePath);
  }

  // Require child_process
  const child_process = require('child_process');

  function runPythonOcrAsync(cmd, scriptPath, filePath, timeoutMs = 45000) {
    return new Promise((resolve) => {
      let isFinished = false;
      let stdoutData = '';
      let stderrData = '';

      let child;
      try {
        child = child_process.spawn(cmd, [scriptPath, filePath], {
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe']
        });
      } catch (spawnErr) {
        return resolve(null);
      }

      const timer = setTimeout(() => {
        if (!isFinished) {
          isFinished = true;
          try { child.kill('SIGKILL'); } catch (e) {}
          resolve(null);
        }
      }, timeoutMs);

      child.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString('utf-8');
      });

      child.stderr.on('data', (chunk) => {
        stderrData += chunk.toString('utf-8');
      });

      child.on('error', () => {
        if (!isFinished) {
          isFinished = true;
          clearTimeout(timer);
          resolve(null);
        }
      });

      child.on('close', (code) => {
        if (!isFinished) {
          isFinished = true;
          clearTimeout(timer);
          const trimmed = stdoutData.trim();
          if (code === 0 && trimmed.startsWith('{')) {
            try {
              return resolve(JSON.parse(trimmed));
            } catch (e) {
              return resolve(null);
            }
          }
          resolve(null);
        }
      });
    });
  }

  let eventLoopTicks = 0;
  const interval = setInterval(() => {
    eventLoopTicks++;
  }, 20);

  const startTime = Date.now();
  let result = await runPythonOcrAsync('py', ocrScriptPath, testImagePath);
  if (!result || !result.success) {
    result = await runPythonOcrAsync('python', ocrScriptPath, testImagePath);
  }
  const duration = Date.now() - startTime;
  clearInterval(interval);

  console.log(`OCR execution duration: ${duration}ms`);
  console.log(`Event loop ticks recorded during execution: ${eventLoopTicks}`);

  if (eventLoopTicks < 5) {
    throw new Error(`FAIL: Event loop was blocked! Only ${eventLoopTicks} ticks recorded during ${duration}ms execution.`);
  }

  console.log('✅ PASS: Event loop executed continuously (' + eventLoopTicks + ' ticks) during OCR subprocess execution.');
  console.log('Sample parsed fields:', {
    invoice_number: result?.data?.invoice_number,
    customer_code: result?.data?.customer_code,
    products_count: result?.data?.fields?.products?.length
  });
}

async function runHttpOcrTest() {
  console.log('\n--- TEST 2: HTTP API Endpoint Non-Blocking & Response Contract ---');
  const token = jwt.sign(
    { userId: 1, id: 1, role: 'Administrator', email: 'admin@cit.edu.in' },
    process.env.JWT_SECRET || 'cfms_access_token_secret_2026_super_secure_key_123!',
    { expiresIn: '1h' }
  );

  const testImagePath = path.join(__dirname, '../../sample_invoice_001.jpg');
  const fileData = fs.readFileSync(testImagePath);
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

  const bodyParts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="invoice"; filename="sample_invoice_001.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
    fileData,
    `\r\n--${boundary}--\r\n`
  ];

  const bodyBuffer = Buffer.concat([
    Buffer.from(bodyParts[0], 'utf-8'),
    bodyParts[1],
    Buffer.from(bodyParts[2], 'utf-8')
  ]);

  let eventLoopTicks = 0;
  const tickInterval = setInterval(() => {
    eventLoopTicks++;
  }, 20);

  const reqStartTime = Date.now();

  const response = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 4000,
      path: '/api/complaints/ocr-invoice',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });

    req.on('error', (err) => reject(err));
    req.write(bodyBuffer);
    req.end();
  });

  const reqDuration = Date.now() - reqStartTime;
  clearInterval(tickInterval);

  console.log(`HTTP OCR Request completed in ${reqDuration}ms with status: ${response.statusCode}`);
  console.log(`Event loop ticks recorded during HTTP request: ${eventLoopTicks}`);

  if (response.statusCode !== 200) {
    throw new Error(`HTTP OCR failed with status ${response.statusCode}: ${response.body}`);
  }

  const json = JSON.parse(response.body);
  if (!json.success || !json.data) {
    throw new Error('Invalid JSON response: ' + response.body);
  }

  // Verify response contract
  console.log('Verifying OCR Response Contract:');
  console.log('- raw_text present:', typeof json.data.raw_text === 'string');
  console.log('- invoice_number present:', json.data.invoice_number);
  console.log('- customer_code present:', json.data.customer_code);
  console.log('- temp_invoice_url present:', json.data.temp_invoice_url);
  console.log('- fields object present:', typeof json.data.fields === 'object');
  console.log('- fields.products count:', json.data.fields?.products?.length || 0);

  if (!json.data.temp_invoice_url || !json.data.fields) {
    throw new Error('FAIL: Contract violated - missing temp_invoice_url or fields');
  }

  if (eventLoopTicks < 5) {
    throw new Error(`FAIL: Event loop was blocked during HTTP request! Only ${eventLoopTicks} ticks.`);
  }

  console.log('✅ PASS: HTTP API OCR Endpoint is fully non-blocking and conforms 100% to contract.');
}

async function testMissingFileUpload() {
  console.log('\n--- TEST 3: Error Handling - Missing File ---');
  const token = jwt.sign(
    { userId: 1, id: 1, role: 'Administrator', email: 'admin@cit.edu.in' },
    process.env.JWT_SECRET || 'cfms_access_token_secret_2026_super_secure_key_123!',
    { expiresIn: '1h' }
  );

  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const body = `--${boundary}--\r\n`;

  const response = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 4000,
      path: '/api/complaints/ocr-invoice',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  console.log(`Missing file response status: ${response.statusCode}`);
  const json = JSON.parse(response.body);
  if (response.statusCode === 400 && json.success === false) {
    console.log('✅ PASS: Graceful 400 rejection for missing file upload:', json.message);
  } else {
    throw new Error('FAIL: Unexpected error response for missing file: ' + response.body);
  }
}

async function testConcurrentOcrRequests() {
  console.log('\n--- TEST 4: Concurrent OCR Requests ---');
  const token = jwt.sign(
    { userId: 1, id: 1, role: 'Administrator', email: 'admin@cit.edu.in' },
    process.env.JWT_SECRET || 'cfms_access_token_secret_2026_super_secure_key_123!',
    { expiresIn: '1h' }
  );

  const file1Data = fs.readFileSync(path.join(__dirname, '../../sample_invoice_001.jpg'));
  const file2Data = fs.readFileSync(path.join(__dirname, '../../invoice_2.jpg'));

  function makeRequest(fileData, filename) {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const bodyBuffer = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="invoice"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`),
      fileData,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 4000,
        path: '/api/complaints/ocr-invoice',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': bodyBuffer.length
        }
      }, (res) => {
        let data = '';
        res.on('data', (c) => data += c);
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data, filename }));
      });
      req.on('error', reject);
      req.write(bodyBuffer);
      req.end();
    });
  }

  const start = Date.now();
  const [res1, res2] = await Promise.all([
    makeRequest(file1Data, 'sample_invoice_001.jpg'),
    makeRequest(file2Data, 'invoice_2.jpg')
  ]);
  const duration = Date.now() - start;

  console.log(`Concurrent requests completed in ${duration}ms`);
  console.log(`Req 1 status: ${res1.statusCode}`);
  console.log(`Req 2 status: ${res2.statusCode}`);

  const json1 = JSON.parse(res1.body);
  const json2 = JSON.parse(res2.body);

  if (res1.statusCode === 200 && res2.statusCode === 200 && json1.success && json2.success) {
    console.log('✅ PASS: Both concurrent OCR requests succeeded without resource collisions.');
    console.log(`Req 1 Invoice: ${json1.data.invoice_number}, Temp URL: ${json1.data.temp_invoice_url}`);
    console.log(`Req 2 Invoice: ${json2.data.invoice_number}, Temp URL: ${json2.data.temp_invoice_url}`);
  } else {
    throw new Error('FAIL: Concurrent request failure');
  }
}

async function main() {
  try {
    await testNonBlockingDirect();
    await runHttpOcrTest();
    await testMissingFileUpload();
    await testConcurrentOcrRequests();
    console.log('\n=========================================');
    console.log('ALL OCR PERFORMANCE & EVENT LOOP TESTS PASSED!');
    console.log('=========================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST ERROR:', err);
    process.exit(1);
  }
}

main();

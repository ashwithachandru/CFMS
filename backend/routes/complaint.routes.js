const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');
const ComplaintRepository = require('../repositories/mssql/complaint.repository');
const { getPool } = require('../config/db');
const { requirePermission } = require('../middlewares/rbac.middleware');
const complaintRepo = new ComplaintRepository();

// GET /api/complaints/metadata
// Returns warehouses, complaint types, and complaint subtypes for form population
router.get('/metadata', authMiddleware, requirePermission('complaints', 'read'), async (req, res, next) => {
  try {
    const data = await complaintRepo.getFormMetadata();
    res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
});
// Returns dynamic aggregate counts for Total, Pending, In Progress, Escalated, Completed
router.get('/stats', authMiddleware, requirePermission('complaints', 'read'), async (req, res, next) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.userId;
    let warehouseId = req.user.warehouseId;

    if (!warehouseId && userId) {
      const pool = getPool();
      const uRes = await pool.request()
        .input('uid', userId)
        .query("SELECT warehouse_id FROM Users WHERE id = @uid");
      if (uRes.recordset.length > 0) {
        warehouseId = uRes.recordset[0].warehouse_id;
      }
    }

    const stats = await complaintRepo.getStats(userRole, userId, warehouseId);
    res.status(200).json({
      success: true,
      data: { stats }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/complaints
// Returns complaint list scoped strictly to user role and assigned warehouse.
// Accepts optional ?sort=date (default, raised_at DESC) or ?sort=priority (CASE-based ranking)
router.get('/', authMiddleware, requirePermission('complaints', 'read'), async (req, res, next) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.userId;
    let warehouseId = req.user.warehouseId;

    if (!warehouseId && userId) {
      const pool = getPool();
      const uRes = await pool.request()
        .input('uid', userId)
        .query("SELECT warehouse_id FROM Users WHERE id = @uid");
      if (uRes.recordset.length > 0) {
        warehouseId = uRes.recordset[0].warehouse_id;
      }
    }

    // Accept ?sort=priority or ?sort=date (default)
    const sortBy = req.query.sort === 'priority' ? 'priority' : 'date';
    const history = req.query.history === 'true';

    const complaints = await complaintRepo.findAll(userRole, userId, warehouseId, sortBy, history);
    res.status(200).json({
      success: true,
      data: { complaints }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/complaints/:id
router.get('/:id', authMiddleware, requirePermission('complaints', 'read'), async (req, res, next) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.userId;
    let warehouseId = req.user.warehouseId;

    if (!warehouseId && userId) {
      const pool = getPool();
      const uRes = await pool.request()
        .input('uid', userId)
        .query("SELECT warehouse_id FROM Users WHERE id = @uid");
      if (uRes.recordset.length > 0) {
        warehouseId = uRes.recordset[0].warehouse_id;
      }
    }

    const complaint = await complaintRepo.findById(req.params.id, userRole, userId, warehouseId);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }
    res.status(200).json({
      success: true,
      data: { complaint }
    });
  } catch (err) {
    console.error("BACKEND GET SINGLE COMPLAINT ERROR:", err);
    next(err);
  }
});

const Tesseract = require('tesseract.js');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const child_process = require('child_process');

// Asynchronous non-blocking child process runner for Python OCR
function runPythonOcrAsync(cmd, ocrScriptPath, filePath, timeoutMs = 45000) {
  return new Promise((resolve) => {
    let isFinished = false;
    let stdoutData = '';
    let stderrData = '';

    let child;
    try {
      child = child_process.spawn(cmd, [ocrScriptPath, filePath], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
    } catch (spawnErr) {
      console.warn(`[OCR] Spawn exception with ${cmd}:`, spawnErr.message);
      return resolve(null);
    }

    const timer = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        try { child.kill('SIGKILL'); } catch (e) {}
        console.warn(`[OCR] Execution timed out with ${cmd} after ${timeoutMs}ms.`);
        resolve(null);
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString('utf-8');
    });

    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString('utf-8');
    });

    child.on('error', (err) => {
      if (!isFinished) {
        isFinished = true;
        clearTimeout(timer);
        console.warn(`[OCR] ${cmd} process error:`, err.message);
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
            const parsed = JSON.parse(trimmed);
            return resolve(parsed);
          } catch (jsonErr) {
            console.warn('[OCR] Failed to parse JSON stdout:', jsonErr.message);
            return resolve(null);
          }
        }
        if (code !== 0) {
          console.warn(`[OCR] ${cmd} exited with code ${code}. Stderr snippet:`, stderrData.slice(0, 200));
        }
        resolve(null);
      }
    });
  });
}

// Helper to preprocess low-resolution/low-contrast invoice images via offscreen Chrome canvas
async function preprocessImageForOCR(filePath) {
  try {
    const stats = await fs.promises.stat(filePath);
    // If file is small (< 500KB), apply upscaling & adaptive binarization
    if (stats.size < 500 * 1024) {
      console.log(`[OCR PREPROCESS] Low-res upload detected (${(stats.size / 1024).toFixed(1)} KB). Running canvas upscaling & binarization...`);
      const fileUrl = 'file:///' + path.resolve(filePath).replace(/\\/g, '/');
      const browser = await chromium.launch({ channel: 'chrome' });
      const page = await browser.newPage();
      await page.goto(fileUrl);

      const base64Png = await page.evaluate(async () => {
        const img = document.querySelector('img');
        if (!img || !img.naturalWidth) return null;
        const scale = 3.5;
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth * scale;
        canvas.height = img.naturalHeight * scale;

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const val = Math.max(0, Math.min(255, (lum - 128) * 1.6 + 128));
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        }

        ctx.putImageData(imgData, 0, 0);
        return canvas.toDataURL('image/png');
      });

      await browser.close();

      if (base64Png) {
        const processedPath = filePath + '_' + Date.now() + '_proc.png';
        await fs.promises.writeFile(processedPath, base64Png.replace(/^data:image\/png;base64,/, ''), 'base64');
        console.log(`[OCR PREPROCESS] Saved preprocessed image to: ${processedPath}`);
        return processedPath;
      }
    }
  } catch (err) {
    console.warn('[OCR PREPROCESS WARNING] Preprocessing skipped:', err.message);
  }
  return filePath;
}

function isPhoneNumber(candidate, lineText = '') {
  if (!candidate) return true;
  const cleanCandidate = candidate.replace(/[\s\-\(\)\.]/g, '');

  // 1. If line text contains phone/care/contact/support keywords
  if (/\b(?:customer\s*care|care|help\s*line|toll\s*free|support|service|phone|mobile|mob|tel|ph|contact|fax|whatsapp)\b/i.test(lineText)) {
    return true;
  }

  // 2. If candidate is 7-11 digits without letters
  if (/^\d{7,11}$/.test(cleanCandidate) && !/[A-Z]/i.test(candidate)) {
    return true;
  }

  // 3. Known STD code prefix checks (e.g. 0421, 044, 080)
  if (/^(?:0\d{3,4}|\+?91)/.test(cleanCandidate)) {
    return true;
  }

  return false;
}

function parseInvoiceText(text) {
  if (!text) return { customer_code: '', invoice_number: '' };

  let customerCode = '';
  let invoiceNumber = '';

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Global filter: skip customer care, support, contact, and phone number lines for BOTH fields
    const isPhoneOrContactLine = /\b(?:customer\s*care|care|help\s*line|toll\s*free|support|service\s*center|phone|mobile|mob|tel|ph|contact|fax|whatsapp)\b/i.test(line);
    if (isPhoneOrContactLine) continue;

    // 1. Customer Code Line Matching
    if (!customerCode) {
      const custMatch = line.match(/\b(?:customer\s*code|cust\s*code|customer\s*id|cust\s*id|customer\s*no|cust\s*no|account\s*no|acc\s*no|party\s*code|client\s*code|customer|cust)\b[:\s\-\.]*([A-Z0-9\-_/]+)/i);
      if (custMatch && custMatch[1] && custMatch[1].length >= 3) {
        const candidate = custMatch[1].trim();
        if (!/care|support|service|phone|mobile|tele|total/i.test(candidate) && !isPhoneNumber(candidate, line)) {
          customerCode = candidate;
        }
      }
    }

    // 2. Invoice Number Line Matching
    if (!invoiceNumber) {
      const invMatch = line.match(/\b(?:invoice\s*number|invoice\s*no|invoice\s*num|invoice\s*#|inv\s*no|inv\s*#|bill\s*no|bill\s*#|doc\s*no|doc\s*#|receipt\s*no|memo\s*no|cash\s*memo|sl\s*no|invoice|inv|bill|receipt|doc)\b[:\s\-\.]*([A-Z0-9\-_/]+)/i);
      if (invMatch && invMatch[1] && invMatch[1].length >= 3) {
        const candidate = invMatch[1].trim();
        if (!/customer|invoice|number|official|factory|cotton|handlooms|care|total|grand/i.test(candidate) && !isPhoneNumber(candidate, line)) {
          invoiceNumber = candidate;
        }
      }
    }
  }

  // 3. Standalone Format Fallbacks (Direct Code Format Matching)
  if (!customerCode) {
    const custFormats = [
      /\b(?:ACCOUNTS?|ACC|CUST|CST)\b[:\s\-\.]*([A-Z0-9\s]{4,15})/i,
      /\b(?:CUST|CST|ACC)[-_]?[0-9]{3,10}\b/i,
      /\bC[0-9]{5,7}\b/i
    ];
    for (const fmt of custFormats) {
      const m = text.match(fmt);
      if (m) {
        const val = (m[1] || m[0]).trim();
        if (!isPhoneNumber(val, text)) {
          customerCode = val;
          break;
        }
      }
    }
  }

  if (!invoiceNumber) {
    const invFormats = [
      /\b(?:INV|INVOICE|BILL|REC|DOC)[-_/][A-Z0-9\-_/]+\b/i,
      /\b[P|R|I][0-9]{6,10}\b/i,
      /\bI-[0-9]{4,6}\/[A-Z0-9]{5,10}\b/i
    ];
    for (const fmt of invFormats) {
      const m = text.match(fmt);
      if (m) {
        const val = (m[1] || m[0]).trim();
        if (!isPhoneNumber(val, text)) {
          invoiceNumber = val;
          break;
        }
      }
    }
  }

  customerCode = customerCode.replace(/^[:\-\s,]+|[:\-\s,]+$/g, '');
  invoiceNumber = invoiceNumber.replace(/^[:\-\s,]+|[:\-\s,]+$/g, '');

  return { customer_code: customerCode, invoice_number: invoiceNumber };
}

// POST /api/complaints/ocr-invoice
// Processes an uploaded invoice photo with offline RapidOCR full document extractor asynchronously
router.post('/ocr-invoice', authMiddleware, requirePermission('complaints', 'write'), (req, res, next) => {
  upload.single('invoice')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Invoice upload error'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No invoice image file uploaded.'
      });
    }

    const filePath = path.resolve(req.file.path);
    const ocrScriptPath = path.resolve(__dirname, '../services/ocr_service.py');

    console.log(`[OCR] Executing asynchronous invoice OCR on: ${filePath}`);

    let ocrOutput = null;

    // Try py first, then python asynchronously without blocking event loop
    for (const cmd of ['py', 'python']) {
      ocrOutput = await runPythonOcrAsync(cmd, ocrScriptPath, filePath);
      if (ocrOutput && ocrOutput.success) {
        break;
      }
    }

    if (ocrOutput && ocrOutput.success) {
      ocrOutput.data.temp_invoice_url = `/uploads/${req.file.filename}`;
      return res.status(200).json(ocrOutput);
    }

    // Fallback if python is not responding
    try {
      console.log(`[OCR FALLBACK] Running local Tesseract OCR on file: ${filePath}`);
      const processedFilePath = await preprocessImageForOCR(filePath);
      const ocrResult = await Tesseract.recognize(processedFilePath, 'eng');
      const rawText = ocrResult?.data?.text || '';
      const parsed = parseInvoiceText(rawText);

      if (processedFilePath !== filePath) {
        await fs.promises.unlink(processedFilePath).catch(() => {});
      }

      return res.status(200).json({
        success: true,
        data: {
          raw_text: rawText,
          fields: {
            warehouse_unit: '',
            customer_code: parsed.customer_code || '',
            invoice_number: parsed.invoice_number || '',
            invoice_date: '',
            customer_name: '',
            customer_address: '',
            billing_address: '',
            shipping_address: '',
            gstin: '',
            phone: '',
            email: '',
            order_number: '',
            reference_number: '',
            products: [],
            totals: {
              subtotal: '',
              cgst: '',
              sgst: '',
              igst: '',
              grand_total: ''
            },
            other_fields: {}
          },
          invoice_number: parsed.invoice_number || '',
          customer_code: parsed.customer_code || '',
          temp_invoice_url: `/uploads/${req.file.filename}`
        }
      });
    } catch (fallbackErr) {
      console.error('[OCR ERROR]:', fallbackErr);
      return res.status(500).json({
        success: false,
        message: 'Failed to process invoice OCR: ' + fallbackErr.message
      });
    }
  });
});

// POST /api/complaints/check-duplicate
// Pre-submission duplicate check based on Customer + Invoice + Product + Issue Type
router.post('/check-duplicate', authMiddleware, requirePermission('complaints', 'read'), async (req, res, next) => {
  try {
    const { customer_code, invoice_number, product_name, complaint_type_id, complaint_subtype_id } = req.body;
    const duplicate = await complaintRepo.findPossibleDuplicate({
      customer_code,
      invoice_number,
      product_name,
      complaint_type_id,
      complaint_subtype_id
    });

    if (duplicate) {
      return res.status(200).json({
        success: true,
        possibleDuplicate: true,
        message: 'A similar complaint already exists for this invoice and product.',
        existingComplaint: duplicate
      });
    }

    return res.status(200).json({
      success: true,
      possibleDuplicate: false
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/complaints
// Creates a new complaint (Restricted to Sales Executive only)
router.post('/', authMiddleware, requirePermission('complaints', 'write'), (req, res, next) => {
  if (req.user.role !== 'Sales Executive') {
    return res.status(403).json({
      success: false,
      message: 'Access Denied. Only Sales Executives can raise complaints.'
    });
  }

  const cpUpload = upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'invoice', maxCount: 1 }
  ]);

  cpUpload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error'
      });
    }

    try {
      const { 
        warehouse_id, 
        customer_code, 
        invoice_number, 
        product_name,
        complaint_type_id, 
        complaint_subtype_id, 
        description, 
        submission_type, 
        ocr_text,
        allow_duplicate,
        bypass_duplicate_check
      } = req.body;

      const isOcr = submission_type === 'ocr' || req.body.entry_mode === 'ocr';

      // For Option A (OCR/Invoice flow): warehouse_id remains NULL (Global Shared Queue)
      const finalWarehouseId = isOcr ? (warehouse_id ? parseInt(warehouse_id, 10) : null) : parseInt(warehouse_id, 10);
      const finalCustomerCode = customer_code || (isOcr ? 'SCANNED-INV' : '');
      const finalInvoiceNumber = invoice_number || (isOcr ? `INV-OCR-${Date.now().toString().slice(-6)}` : '');
      const finalProductName = product_name ? product_name.trim() : null;
      const finalComplaintTypeId = complaint_type_id ? parseInt(complaint_type_id, 10) : 1;
      const finalDescription = description || (isOcr ? 'Invoice Scanned Complaint (OCR Submission)' : '');

      if (!isOcr) {
        if (!warehouse_id || !customer_code || !invoice_number || !complaint_type_id || !description) {
          return res.status(400).json({
            success: false,
            message: 'Warehouse, Customer Code, Invoice Number, Complaint Type, and Description are required.'
          });
        }
      }

      // Backend safety check: Duplicate detection based on Customer + Invoice + Product + Issue Type
      const shouldBypassDuplicate = allow_duplicate === true || allow_duplicate === 'true' || bypass_duplicate_check === true || bypass_duplicate_check === 'true';

      if (!shouldBypassDuplicate && finalCustomerCode && finalInvoiceNumber) {
        const existingDup = await complaintRepo.findPossibleDuplicate({
          customer_code: finalCustomerCode,
          invoice_number: finalInvoiceNumber,
          product_name: finalProductName,
          complaint_type_id: finalComplaintTypeId,
          complaint_subtype_id: complaint_subtype_id ? parseInt(complaint_subtype_id, 10) : null
        });

        if (existingDup) {
          return res.status(200).json({
            success: false,
            possibleDuplicate: true,
            message: 'A similar complaint already exists for this invoice and product.',
            existingComplaint: existingDup
          });
        }
      }

      let attachment_url = null;
      let invoice_url = null;

      if (req.files?.photo?.[0]) {
        attachment_url = `/uploads/${req.files.photo[0].filename}`;
      } else if (req.body.photo_url) {
        attachment_url = req.body.photo_url;
      }

      if (req.files?.invoice?.[0]) {
        invoice_url = `/uploads/${req.files.invoice[0].filename}`;
      } else if (req.body.invoice_url) {
        invoice_url = req.body.invoice_url;
      }

      const result = await complaintRepo.create({
        sales_executive_id: req.user.userId,
        warehouse_id: finalWarehouseId,
        customer_code: finalCustomerCode,
        invoice_number: finalInvoiceNumber,
        product_name: finalProductName,
        complaint_type_id: finalComplaintTypeId,
        complaint_subtype_id: complaint_subtype_id ? parseInt(complaint_subtype_id, 10) : null,
        description: finalDescription,
        attachment_url,
        invoice_url,
        ocr_text: ocr_text || null,
        submission_type: isOcr ? 'ocr' : 'manual'
      });

      res.status(201).json({
        success: true,
        message: `Complaint ${result.complaint_number} raised successfully!`,
        data: result
      });
    } catch (dbErr) {
      next(dbErr);
    }
  });
});



// PUT /api/complaints/:id/status
// Updates complaint action status (Take Action, Complete, Escalate)
router.put('/:id/status', authMiddleware, requirePermission('complaints', 'write'), async (req, res, next) => {
  try {
    const complaintId = req.params.id;
    const { status, action } = req.body;
    const userId = req.user.userId;
    const userRole = req.user.role;
    let warehouseId = req.user.warehouseId;

    if (!warehouseId && userId) {
      const pool = getPool();
      const uRes = await pool.request()
        .input('uid', userId)
        .query("SELECT warehouse_id FROM Users WHERE id = @uid");
      if (uRes.recordset.length > 0) {
        warehouseId = uRes.recordset[0].warehouse_id;
      }
    }

    if (userRole === 'Sales Executive') {
      return res.status(403).json({
        success: false,
        message: 'Access Denied. Sales Executives cannot change complaint action status.'
      });
    }

    const updated = await complaintRepo.updateStatus(complaintId, status || action, userId, userRole, warehouseId);
    res.status(200).json({
      success: true,
      message: `Complaint ${complaintId} status updated successfully`,
      data: updated
    });
  } catch (err) {
    if (err.statusCode === 403 || (err.message && err.message.includes('Access Denied'))) {
      return res.status(403).json({
        success: false,
        message: err.message
      });
    }
    if (err.statusCode === 404 || (err.message && err.message.includes('not found'))) {
      return res.status(404).json({
        success: false,
        message: err.message
      });
    }
    next(err);
  }
});

module.exports = router;

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
    console.log("BACKEND GET SINGLE COMPLAINT ID:", req.params.id);
    const complaint = await complaintRepo.findById(req.params.id);
    console.log("BACKEND GET SINGLE COMPLAINT FOUND:", complaint ? complaint.id : null);
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

// POST /api/complaints
// Creates a new complaint (Restricted to Sales Executive only)
router.post('/', authMiddleware, requirePermission('complaints', 'write'), (req, res, next) => {
  if (req.user.role !== 'Sales Executive') {
    return res.status(403).json({
      success: false,
      message: 'Access Denied. Only Sales Executives can raise complaints.'
    });
  }

  upload.single('photo')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error'
      });
    }

    try {
      const { warehouse_id, customer_code, invoice_number, complaint_type_id, complaint_subtype_id, description } = req.body;

      if (!warehouse_id || !customer_code || !invoice_number || !complaint_type_id || !description) {
        return res.status(400).json({
          success: false,
          message: 'Warehouse, Customer Code, Invoice Number, Complaint Type, and Description are required.'
        });
      }

      let attachment_url = null;
      if (req.file) {
        attachment_url = `/uploads/${req.file.filename}`;
      }

      const result = await complaintRepo.create({
        sales_executive_id: req.user.userId,
        warehouse_id: parseInt(warehouse_id, 10),
        customer_code,
        invoice_number,
        complaint_type_id: parseInt(complaint_type_id, 10),
        complaint_subtype_id: complaint_subtype_id ? parseInt(complaint_subtype_id, 10) : null,
        description,
        attachment_url
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

    if (userRole === 'Sales Executive') {
      return res.status(403).json({
        success: false,
        message: 'Access Denied. Sales Executives cannot change complaint action status.'
      });
    }

    const updated = await complaintRepo.updateStatus(complaintId, status || action, userId, userRole);
    res.status(200).json({
      success: true,
      message: `Complaint ${complaintId} status updated successfully`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

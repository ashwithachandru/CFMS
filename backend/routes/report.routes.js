const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const reportController = require('../controllers/report.controller');
const { requirePermission } = require('../middlewares/rbac.middleware');

// Explicit Role-Based Report Endpoints protected by RBAC
router.get('/admin', authMiddleware, requirePermission('reports', 'read'), reportController.getAdminReport);
router.get('/sales-executive', authMiddleware, requirePermission('reports', 'read'), reportController.getSalesExecutiveReport);
router.get('/warehouse-team', authMiddleware, requirePermission('reports', 'read'), reportController.getWarehouseTeamReport);
router.get('/warehouse-manager', authMiddleware, requirePermission('reports', 'read'), reportController.getWarehouseManagerReport);
router.get('/warehouse', authMiddleware, requirePermission('reports', 'read'), reportController.getWarehouseReport);

// Default auto-detecting route protected by RBAC
router.get('/', authMiddleware, requirePermission('reports', 'read'), reportController.getReportData);

module.exports = router;

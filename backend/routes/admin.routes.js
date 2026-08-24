const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const adminMiddleware = require('../middlewares/admin.middleware');
const adminController = require('../controllers/admin.controller');
const rbacController = require('../controllers/rbac.controller');
const { requirePermission } = require('../middlewares/rbac.middleware');

// All admin routes require valid JWT auth
router.use(authMiddleware);

// User Effective Permissions Endpoint (Accessible to all authenticated users)
router.get('/rbac/my-permissions', rbacController.getMyPermissions);

// Admin-Only Access Control & RBAC Management Endpoints
router.get('/rbac/matrix', adminMiddleware, rbacController.getMatrix);
router.put('/rbac/role-permissions', adminMiddleware, rbacController.updateRolePermission);
router.put('/rbac/user-overrides', adminMiddleware, rbacController.updateUserOverride);
router.delete('/rbac/user-overrides/:userId', adminMiddleware, rbacController.resetUserOverrides);

// Audit Logs Endpoint
router.get('/audit-logs', requirePermission('audit_logs', 'read'), adminController.getAuditLogs);

// Operational Dashboard Endpoint
router.get('/dashboard', requirePermission('dashboard', 'read'), adminController.getDashboard);

// User Management Endpoints
router.get('/users', requirePermission('users', 'read'), adminController.getUsers);
router.post('/users', requirePermission('users', 'write'), adminController.createUser);
router.put('/users/:id', requirePermission('users', 'write'), adminController.updateUser);
router.patch('/users/:id/status', requirePermission('users', 'write'), adminController.toggleUserStatus);
router.post('/users/:id/reset-password', requirePermission('users', 'write'), adminController.resetUserPassword);

// Warehouse Management Endpoints
router.get('/warehouses', requirePermission('warehouses', 'read'), adminController.getWarehouses);
router.post('/warehouses', requirePermission('warehouses', 'write'), adminController.createWarehouse);
router.put('/warehouses/:id', requirePermission('warehouses', 'write'), adminController.updateWarehouse);
router.delete('/warehouses/:id', requirePermission('warehouses', 'write'), adminController.deleteWarehouse);

// Complaint Types & Subtypes Endpoints
router.get('/complaint-types', requirePermission('categories', 'read'), adminController.getComplaintTypes);
router.post('/complaint-types', requirePermission('categories', 'write'), adminController.createComplaintType);
router.post('/complaint-subtypes', requirePermission('categories', 'write'), adminController.createComplaintSubtype);

// System Settings & Dynamic SLA Endpoints
router.get('/settings', requirePermission('sla', 'read'), adminController.getSystemSettings);
router.put('/settings', requirePermission('sla', 'write'), adminController.updateSystemSettings);

module.exports = router;

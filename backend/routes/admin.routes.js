const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const adminMiddleware = require('../middlewares/admin.middleware');
const adminController = require('../controllers/admin.controller');
const rbacController = require('../controllers/rbac.controller');
const { requirePermission } = require('../middlewares/rbac.middleware');

// All admin routes require valid JWT auth + Administrator role
router.use(authMiddleware);
router.use(adminMiddleware);

// RBAC & Access Control Endpoints
router.get('/rbac/matrix', rbacController.getMatrix);
router.put('/rbac/role-permissions', rbacController.updateRolePermission);
router.put('/rbac/user-overrides', rbacController.updateUserOverride);
router.delete('/rbac/user-overrides/:userId', rbacController.resetUserOverrides);

// Operational Dashboard Endpoint
router.get('/dashboard', adminController.getDashboard);

// User Management Endpoints
router.get('/users', adminController.getUsers);
router.post('/users', requirePermission('users', 'write'), adminController.createUser);
router.put('/users/:id', requirePermission('users', 'write'), adminController.updateUser);
router.patch('/users/:id/status', requirePermission('users', 'write'), adminController.toggleUserStatus);
router.post('/users/:id/reset-password', requirePermission('users', 'write'), adminController.resetUserPassword);

// Warehouse Management Endpoints
router.get('/warehouses', adminController.getWarehouses);
router.post('/warehouses', requirePermission('warehouses', 'write'), adminController.createWarehouse);
router.put('/warehouses/:id', requirePermission('warehouses', 'write'), adminController.updateWarehouse);
router.delete('/warehouses/:id', requirePermission('warehouses', 'write'), adminController.deleteWarehouse);

// Complaint Types & Subtypes Endpoints
router.get('/complaint-types', adminController.getComplaintTypes);
router.post('/complaint-types', requirePermission('categories', 'write'), adminController.createComplaintType);
router.post('/complaint-subtypes', requirePermission('categories', 'write'), adminController.createComplaintSubtype);

// System Settings & Dynamic SLA Endpoints
router.get('/settings', adminController.getSystemSettings);
router.put('/settings', requirePermission('sla', 'write'), adminController.updateSystemSettings);

module.exports = router;

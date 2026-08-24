const adminRepository = require('../repositories/mssql/admin.repository');
const AuditRepository = require('../repositories/mssql/audit.repository');
const auditRepository = new AuditRepository();

class AdminController {
  // Operational Dashboard Payload
  async getDashboard(req, res) {
    try {
      const snapshot = await adminRepository.getOperationalSnapshot();
      const actionFeed = await adminRepository.getActionNeededFeed();
      const recentAuditLogs = await auditRepository.findRecent(15);

      return res.json({
        success: true,
        data: {
          snapshot,
          actionFeed,
          recentAuditLogs
        }
      });
    } catch (err) {
      console.error('Error fetching admin dashboard:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // User Management
  async getUsers(req, res) {
    try {
      const { search, role, warehouseId } = req.query;
      const users = await adminRepository.getUsers(search, role, warehouseId);
      return res.json({ success: true, data: users });
    } catch (err) {
      console.error('Error fetching users:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async createUser(req, res) {
    try {
      const { email, password, firstName, lastName, role, warehouseId } = req.body;
      if (!email || !password || !firstName || !lastName || !role) {
        return res.status(400).json({ success: false, message: 'All required user fields must be provided.' });
      }

      if (['Warehouse Team', 'Warehouse Manager'].includes(role) && !warehouseId) {
        return res.status(400).json({ success: false, message: 'Warehouse selection is required for Warehouse Team and Manager roles.' });
      }

      if (password.length < 8) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
      }

      const newUserId = await adminRepository.createUser({
        email, password, firstName, lastName, role, warehouseId
      });

      await auditRepository.create({
        userId: req.user.id,
        action: 'CREATE_USER',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Admin System',
        details: `Created new user ${email} (ID: ${newUserId}, Role: ${role})`
      });

      return res.status(201).json({
        success: true,
        message: 'User created successfully.',
        data: { userId: newUserId }
      });
    } catch (err) {
      console.error('Error creating user:', err);
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { firstName, lastName, role, warehouseId } = req.body;

      if (!firstName || !lastName || !role) {
        return res.status(400).json({ success: false, message: 'First name, last name, and role are required.' });
      }

      if (['Warehouse Team', 'Warehouse Manager'].includes(role) && !warehouseId) {
        return res.status(400).json({ success: false, message: 'Warehouse assignment is required for Warehouse Team and Manager roles.' });
      }

      await adminRepository.updateUser(id, { firstName, lastName, role, warehouseId });

      await auditRepository.create({
        userId: req.user.id,
        action: 'UPDATE_USER',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Admin System',
        details: `Updated user ID ${id} details (Role: ${role}, Warehouse: ${warehouseId || 'None'})`
      });

      return res.json({ success: true, message: 'User updated successfully.' });
    } catch (err) {
      console.error('Error updating user:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async toggleUserStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['Active', 'Inactive'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Status must be either Active or Inactive.' });
      }

      await adminRepository.updateUserStatus(id, status);

      await auditRepository.create({
        userId: req.user.id,
        action: 'TOGGLE_USER_STATUS',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Admin System',
        details: `Toggled status for user ID ${id} to ${status}`
      });

      return res.json({ success: true, message: `User status updated to ${status}.` });
    } catch (err) {
      console.error('Error toggling user status:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async resetUserPassword(req, res) {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long.' });
      }

      await adminRepository.resetUserPassword(id, newPassword);

      await auditRepository.create({
        userId: req.user.id,
        action: 'ADMIN_RESET_PASSWORD',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Admin System',
        details: `Reset password for user ID ${id}`
      });

      return res.json({ success: true, message: 'User password reset successfully.' });
    } catch (err) {
      console.error('Error resetting password:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Warehouse Management
  async getWarehouses(req, res) {
    try {
      const warehouses = await adminRepository.getWarehouses();
      return res.json({ success: true, data: warehouses });
    } catch (err) {
      console.error('Error fetching warehouses:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async createWarehouse(req, res) {
    try {
      const { name, location } = req.body;
      if (!name || !location) {
        return res.status(400).json({ success: false, message: 'Warehouse name and location are required.' });
      }

      const id = await adminRepository.createWarehouse(name, location);

      await auditRepository.create({
        userId: req.user.id,
        action: 'CREATE_WAREHOUSE',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Admin System',
        details: `Created warehouse "${name}" at "${location}" (ID: ${id})`
      });

      return res.status(201).json({ success: true, message: 'Warehouse created successfully.', data: { id } });
    } catch (err) {
      console.error('Error creating warehouse:', err);
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  async updateWarehouse(req, res) {
    try {
      const { id } = req.params;
      const { name, location } = req.body;
      if (!name || !location) {
        return res.status(400).json({ success: false, message: 'Warehouse name and location are required.' });
      }

      await adminRepository.updateWarehouse(id, name, location);

      await auditRepository.create({
        userId: req.user.id,
        action: 'UPDATE_WAREHOUSE',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Admin System',
        details: `Updated warehouse ID ${id} to "${name}", "${location}"`
      });

      return res.json({ success: true, message: 'Warehouse updated successfully.' });
    } catch (err) {
      console.error('Error updating warehouse:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async deleteWarehouse(req, res) {
    try {
      const { id } = req.params;
      await adminRepository.deleteWarehouse(id);

      await auditRepository.create({
        userId: req.user.id,
        action: 'DELETE_WAREHOUSE',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Admin System',
        details: `Deleted warehouse ID ${id}`
      });

      return res.json({ success: true, message: 'Warehouse deleted successfully.' });
    } catch (err) {
      console.error('Error deleting warehouse:', err);
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // Complaint Type & Subtype Management
  async getComplaintTypes(req, res) {
    try {
      const data = await adminRepository.getComplaintTypes();
      return res.json({ success: true, data });
    } catch (err) {
      console.error('Error fetching complaint types:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async createComplaintType(req, res) {
    try {
      const { name, description } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, message: 'Complaint type name is required.' });
      }

      const id = await adminRepository.createComplaintType(name, description);

      await auditRepository.create({
        userId: req.user.id,
        action: 'CREATE_COMPLAINT_TYPE',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Admin System',
        details: `Created complaint type "${name}" (ID: ${id})`
      });

      return res.status(201).json({ success: true, message: 'Complaint type created successfully.', data: { id } });
    } catch (err) {
      console.error('Error creating complaint type:', err);
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  async createComplaintSubtype(req, res) {
    try {
      const { complaintTypeId, name } = req.body;
      if (!complaintTypeId || !name) {
        return res.status(400).json({ success: false, message: 'Complaint type ID and subtype name are required.' });
      }

      const id = await adminRepository.createComplaintSubtype(complaintTypeId, name);

      await auditRepository.create({
        userId: req.user.id,
        action: 'CREATE_COMPLAINT_SUBTYPE',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Admin System',
        details: `Created complaint subtype "${name}" under type ID ${complaintTypeId} (ID: ${id})`
      });

      return res.status(201).json({ success: true, message: 'Complaint subtype created successfully.', data: { id } });
    } catch (err) {
      console.error('Error creating complaint subtype:', err);
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // Dynamic System Settings
  async getSystemSettings(req, res) {
    try {
      const settings = await adminRepository.getSystemSettings();
      return res.json({ success: true, data: settings });
    } catch (err) {
      console.error('Error fetching system settings:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async updateSystemSettings(req, res) {
    try {
      const settings = req.body;
      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ success: false, message: 'Invalid settings payload.' });
      }

      await adminRepository.updateSystemSettings(settings, req.user.id);

      await auditRepository.create({
        userId: req.user.id,
        action: 'UPDATE_SYSTEM_SETTINGS',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Admin System',
        details: `Updated system settings: ${JSON.stringify(settings)}`
      });

      return res.json({ success: true, message: 'System settings updated successfully.' });
    } catch (err) {
      console.error('Error updating system settings:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Audit Logs inspection
  async getAuditLogs(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const logs = await auditRepository.findRecent(limit);
      return res.json({ success: true, data: logs });
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new AdminController();

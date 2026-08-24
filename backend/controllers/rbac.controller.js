const rbacRepo = require('../repositories/mssql/rbac.repository');
const adminRepository = require('../repositories/mssql/admin.repository');
const AuditRepository = require('../repositories/mssql/audit.repository');
const auditRepo = new AuditRepository();

class RbacController {
  async getMatrix(req, res) {
    try {
      const modules = rbacRepo.getModules();
      const roles = rbacRepo.getRoles();
      const rolePermissions = await rbacRepo.getRolePermissions();
      const userOverrides = await rbacRepo.getUserOverrides();

      // Fetch all users with warehouse metadata for Tab 2 User-Based list
      const usersList = await adminRepository.getUsers();

      // Format rolePermissions into structured map: { [role_name]: { [module_key]: { canRead, canWrite } } }
      const roleMatrix = {};
      roles.forEach(r => {
        roleMatrix[r] = {};
        modules.forEach(m => {
          roleMatrix[r][m.key] = { canRead: true, canWrite: false };
        });
      });

      rolePermissions.forEach(rp => {
        if (!roleMatrix[rp.role_name]) roleMatrix[rp.role_name] = {};
        roleMatrix[rp.role_name][rp.module_key] = {
          canRead: Boolean(rp.can_read),
          canWrite: Boolean(rp.can_write)
        };
      });

      // Format userOverrides into map: { [user_id]: { [module_key]: { overrideRead, overrideWrite } } }
      const userOverrideMap = {};
      userOverrides.forEach(uo => {
        if (!userOverrideMap[uo.user_id]) userOverrideMap[uo.user_id] = {};
        userOverrideMap[uo.user_id][uo.module_key] = {
          overrideRead: uo.override_read === null ? null : Boolean(uo.override_read),
          overrideWrite: uo.override_write === null ? null : Boolean(uo.override_write)
        };
      });

      // Compute summarized viewCount and editCount per user
      const usersSummarized = usersList.map(u => {
        let viewCount = 0;
        let editCount = 0;

        modules.forEach(m => {
          const roleDefaults = roleMatrix[u.role]?.[m.key] || { canRead: true, canWrite: false };
          const overrides = userOverrideMap[u.id]?.[m.key] || { overrideRead: null, overrideWrite: null };

          const effectiveRead = overrides.overrideRead !== null ? overrides.overrideRead : roleDefaults.canRead;
          const effectiveWrite = overrides.overrideWrite !== null ? overrides.overrideWrite : roleDefaults.canWrite;

          if (effectiveRead) viewCount++;
          if (effectiveWrite) editCount++;
        });

        return {
          id: u.id,
          name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || u.email,
          email: u.email,
          role: u.role,
          warehouseName: u.warehouse_name || 'Organization Wide',
          status: u.status,
          viewCount,
          editCount,
          totalModules: modules.length
        };
      });

      return res.json({
        success: true,
        data: {
          modules,
          roles,
          roleMatrix,
          userOverrideMap,
          users: usersSummarized
        }
      });
    } catch (err) {
      console.error('Error fetching RBAC matrix:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async updateRolePermission(req, res) {
    try {
      const { roleName, moduleKey, canRead, canWrite } = req.body;
      if (!roleName || !moduleKey) {
        return res.status(400).json({ success: false, message: 'roleName and moduleKey are required' });
      }

      await rbacRepo.updateRolePermission(roleName, moduleKey, canRead, canWrite);

      await auditRepo.create({
        userId: req.user.id,
        action: 'UPDATE_ROLE_PERMISSION',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || 'unknown',
        details: `Updated role permission for ${roleName} on ${moduleKey}: Read=${canRead ? 1 : 0}, Write=${canWrite ? 1 : 0}`
      });

      return res.json({ success: true, message: 'Role permission updated successfully' });
    } catch (err) {
      console.error('Error updating role permission:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async updateUserOverride(req, res) {
    try {
      const { userId, moduleKey, overrideRead, overrideWrite } = req.body;
      if (!userId || !moduleKey) {
        return res.status(400).json({ success: false, message: 'userId and moduleKey are required' });
      }

      await rbacRepo.updateUserOverride(userId, moduleKey, overrideRead, overrideWrite);

      await auditRepo.create({
        userId: req.user.id,
        action: 'UPDATE_USER_OVERRIDE',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || 'unknown',
        details: `Updated user permission override for user ID ${userId} on ${moduleKey}: Read=${overrideRead}, Write=${overrideWrite}`
      });

      return res.json({ success: true, message: 'User permission override updated successfully' });
    } catch (err) {
      console.error('Error updating user override:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async resetUserOverrides(req, res) {
    try {
      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({ success: false, message: 'userId parameter is required' });
      }

      await rbacRepo.resetUserOverrides(userId);

      await auditRepo.create({
        userId: req.user.id,
        action: 'RESET_USER_OVERRIDES',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || 'unknown',
        details: `Reset all user permission overrides to role defaults for user ID ${userId}`
      });

      return res.json({ success: true, message: 'User overrides reset to role defaults successfully' });
    } catch (err) {
      console.error('Error resetting user overrides:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async getMyPermissions(req, res) {
    try {
      const userId = req.user.id || req.user.userId;
      const roleName = req.user.role;

      const permissions = await rbacRepo.getUserEffectivePermissionsMap(userId, roleName);
      return res.json({ success: true, data: permissions });
    } catch (err) {
      console.error('Error fetching user permissions:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new RbacController();

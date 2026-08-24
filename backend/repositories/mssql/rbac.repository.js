const { getPool, sql } = require('../../config/db');

const MODULE_LIST = [
  { key: 'complaints', name: 'Complaints', description: 'Complaint filing, claiming, resolution & tracking' },
  { key: 'reports', name: 'Reports', description: 'Performance reports, PDF & Excel export generation' },
  { key: 'warehouses', name: 'Warehouse Management', description: 'Facility addition, editing & staff scoping' },
  { key: 'users', name: 'User Management', description: 'User account creation, role assignment & status toggle' },
  { key: 'categories', name: 'Complaint Categories', description: 'Complaint types & subtypes configuration' },
  { key: 'sla', name: 'SLA Configuration', description: 'Dynamic SLA window & breach threshold settings' },
  { key: 'docuflow', name: 'DocuFlow Workflow Configuration', description: 'Automated workflow rules & routing' },
  { key: 'audit_logs', name: 'Audit Logs', description: 'System-wide activity trail & audit logs inspection' },
  { key: 'dashboard', name: 'Dashboard', description: 'Operational dashboard metrics & quick action cards' }
];

const ROLE_LIST = ['Administrator', 'Warehouse Manager', 'Warehouse Team', 'Sales Executive'];

class RbacRepository {
  getModules() {
    return MODULE_LIST;
  }

  getRoles() {
    return ROLE_LIST;
  }

  async getRolePermissions() {
    const pool = getPool();
    // Auto-correct any audit_logs rows in database to guarantee can_write = 0
    await pool.request().query(`
      UPDATE RolePermissions SET can_write = 0 WHERE module_key = 'audit_logs';
      UPDATE UserPermissionOverrides SET override_write = 0 WHERE module_key = 'audit_logs';
    `);

    const result = await pool.request().query(`
      SELECT id, role_name, module_key, can_read, can_write, updated_at
      FROM RolePermissions
      ORDER BY role_name ASC, module_key ASC
    `);

    return result.recordset.map(row => {
      if (row.module_key === 'audit_logs') {
        return { ...row, can_write: 0 };
      }
      return row;
    });
  }

  async updateRolePermission(roleName, moduleKey, canRead, canWrite) {
    const pool = getPool();
    // Audit logs module is strictly read-only for ALL roles including Administrator
    if (moduleKey === 'audit_logs') {
      canWrite = false;
    }

    await pool.request()
      .input('role', sql.VarChar, roleName)
      .input('module', sql.VarChar, moduleKey)
      .input('read', sql.Bit, canRead ? 1 : 0)
      .input('write', sql.Bit, canWrite ? 1 : 0)
      .query(`
        IF EXISTS (SELECT 1 FROM RolePermissions WHERE role_name = @role AND module_key = @module)
        BEGIN
          UPDATE RolePermissions
          SET can_read = @read, can_write = @write, updated_at = GETUTCDATE()
          WHERE role_name = @role AND module_key = @module
        END
        ELSE
        BEGIN
          INSERT INTO RolePermissions (role_name, module_key, can_read, can_write)
          VALUES (@role, @module, @read, @write)
        END
      `);
  }

  async getUserOverrides() {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT id, user_id, module_key, override_read, override_write, updated_at
      FROM UserPermissionOverrides
      ORDER BY user_id ASC, module_key ASC
    `);

    return result.recordset.map(row => {
      if (row.module_key === 'audit_logs') {
        return { ...row, override_write: 0 };
      }
      return row;
    });
  }

  async updateUserOverride(userId, moduleKey, overrideRead, overrideWrite) {
    const pool = getPool();
    
    // Audit logs module is strictly read-only for ALL users
    if (moduleKey === 'audit_logs') {
      overrideWrite = false;
    }

    // If both overrides are null/undefined, delete the override record (revert to role default)
    if (overrideRead === null && (overrideWrite === null || moduleKey === 'audit_logs')) {
      if (moduleKey === 'audit_logs' && overrideRead === null) {
        await pool.request()
          .input('userId', sql.Int, userId)
          .input('module', sql.VarChar, moduleKey)
          .query(`DELETE FROM UserPermissionOverrides WHERE user_id = @userId AND module_key = @module`);
        return;
      }
    }

    await pool.request()
      .input('userId', sql.Int, userId)
      .input('module', sql.VarChar, moduleKey)
      .input('read', sql.Bit, overrideRead === null ? null : (overrideRead ? 1 : 0))
      .input('write', sql.Bit, overrideWrite === null ? null : (overrideWrite ? 1 : 0))
      .query(`
        IF EXISTS (SELECT 1 FROM UserPermissionOverrides WHERE user_id = @userId AND module_key = @module)
        BEGIN
          UPDATE UserPermissionOverrides
          SET override_read = @read, override_write = @write, updated_at = GETUTCDATE()
          WHERE user_id = @userId AND module_key = @module
        END
        ELSE
        BEGIN
          INSERT INTO UserPermissionOverrides (user_id, module_key, override_read, override_write)
          VALUES (@userId, @module, @read, @write)
        END
      `);
  }

  async resetUserOverrides(userId) {
    const pool = getPool();
    await pool.request()
      .input('userId', sql.Int, userId)
      .query(`DELETE FROM UserPermissionOverrides WHERE user_id = @userId`);
  }

  async getEffectiveUserPermission(userId, roleName, moduleKey) {
    const pool = getPool();
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .input('role', sql.VarChar, roleName)
      .input('module', sql.VarChar, moduleKey)
      .query(`
        SELECT 
          r.can_read as role_read, 
          r.can_write as role_write,
          u.override_read, 
          u.override_write
        FROM RolePermissions r
        LEFT JOIN UserPermissionOverrides u ON u.user_id = @userId AND u.module_key = r.module_key
        WHERE r.role_name = @role AND r.module_key = @module
      `);

    if (result.recordset.length === 0) {
      if (roleName === 'Administrator') {
        return { canRead: true, canWrite: moduleKey !== 'audit_logs' };
      }
      return { canRead: false, canWrite: false };
    }

    const row = result.recordset[0];
    const canRead = row.override_read !== null ? Boolean(row.override_read) : Boolean(row.role_read);
    let canWrite = row.override_write !== null ? Boolean(row.override_write) : Boolean(row.role_write);

    // Audit logs module is strictly read-only for all roles/users
    if (moduleKey === 'audit_logs') {
      canWrite = false;
    }

    return { canRead, canWrite };
  }

  async getUserEffectivePermissionsMap(userId, roleName) {
    const pool = getPool();
    const modules = this.getModules();

    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .input('role', sql.VarChar, roleName)
      .query(`
        SELECT 
          r.module_key,
          r.can_read as role_read, 
          r.can_write as role_write,
          u.override_read, 
          u.override_write
        FROM RolePermissions r
        LEFT JOIN UserPermissionOverrides u ON u.user_id = @userId AND u.module_key = r.module_key
        WHERE r.role_name = @role
      `);

    const map = {};

    // Initialize defaults
    modules.forEach(m => {
      if (roleName === 'Administrator') {
        map[m.key] = { canRead: true, canWrite: m.key !== 'audit_logs' };
      } else {
        map[m.key] = { canRead: false, canWrite: false };
      }
    });

    result.recordset.forEach(row => {
      const canRead = row.override_read !== null ? Boolean(row.override_read) : Boolean(row.role_read);
      let canWrite = row.override_write !== null ? Boolean(row.override_write) : Boolean(row.role_write);

      if (row.module_key === 'audit_logs') {
        canWrite = false;
      }

      map[row.module_key] = { canRead, canWrite };
    });

    return map;
  }
}

module.exports = new RbacRepository();

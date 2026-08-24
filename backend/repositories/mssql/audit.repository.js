const { getPool, sql } = require('../../config/db');

class AuditRepository {
  async create(logEntry) {
    try {
      const pool = getPool();
      await pool.request()
        .input('user_id', sql.Int, logEntry.userId || null)
        .input('action', sql.VarChar, logEntry.action)
        .input('ip_address', sql.VarChar, logEntry.ipAddress)
        .input('user_agent', sql.VarChar, logEntry.userAgent)
        .input('details', sql.VarChar, logEntry.details || null)
        .query(`
          INSERT INTO AuditLogs (user_id, action, ip_address, user_agent, details, timestamp)
          VALUES (@user_id, @action, @ip_address, @user_agent, @details, GETUTCDATE())
        `);
    } catch (err) {
      // We don't want audit log failures to crash the whole request, but we must log it
      console.error('Failed to write audit log:', err.message);
    }
  }

  async findByUserId(userId) {
    const pool = getPool();
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT * FROM AuditLogs 
        WHERE user_id = @userId 
        ORDER BY timestamp DESC
      `);
    return result.recordset;
  }

  async findRecent(limit = 15) {
    const pool = getPool();
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit) a.id, a.user_id, a.action, a.ip_address, a.user_agent, a.details, a.timestamp,
               ISNULL(u.first_name + ' ' + u.last_name, 'System') AS user_name,
               ISNULL(u.role, 'System') AS user_role,
               u.email AS user_email
        FROM AuditLogs a
        LEFT JOIN Users u ON a.user_id = u.id
        ORDER BY a.timestamp DESC
      `);
    return result.recordset;
  }
}

module.exports = AuditRepository;

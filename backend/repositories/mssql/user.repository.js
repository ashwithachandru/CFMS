const { getPool, sql } = require('../../config/db');

class UserRepository {
  async findByEmail(email) {
    const pool = getPool();
    const cleanEmail = (email || '').trim().toLowerCase();
    const result = await pool.request()
      .input('email', sql.VarChar, cleanEmail)
      .query(`
        SELECT u.*, u.role AS role_name, w.name AS warehouse_name 
        FROM Users u
        LEFT JOIN Warehouses w ON u.warehouse_id = w.id
        WHERE LOWER(u.email) = @email OR LOWER(u.username) = @email
      `);
    return result.recordset[0] || null;
  }

  async findById(id) {
    const pool = getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.role, u.role AS role_name, u.warehouse_id, u.status, u.created_at,
               w.name AS warehouse_name
        FROM Users u
        LEFT JOIN Warehouses w ON u.warehouse_id = w.id
        WHERE u.id = @id
      `);
    return result.recordset[0] || null;
  }

  async create(user) {
    const pool = getPool();
    const result = await pool.request()
      .input('username', sql.VarChar, user.username)
      .input('email', sql.VarChar, user.email)
      .input('password_hash', sql.VarChar, user.passwordHash)
      .input('first_name', sql.VarChar, user.firstName)
      .input('last_name', sql.VarChar, user.lastName)
      .input('role', sql.VarChar, user.role || 'Sales Executive')
      .input('warehouse_id', sql.Int, user.warehouseId || null)
      .input('status', sql.VarChar, user.status || 'Active')
      .query(`
        INSERT INTO Users (username, email, password_hash, first_name, last_name, role, warehouse_id, status)
        OUTPUT INSERTED.id
        VALUES (@username, @email, @password_hash, @first_name, @last_name, @role, @warehouse_id, @status)
      `);
    return result.recordset[0].id;
  }

  async updateRefreshToken(id, token) {
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, id)
      .input('token', sql.VarChar, token || null)
      .query(`
        UPDATE Users 
        SET refresh_token = @token, updated_at = GETDATE()
        WHERE id = @id
      `);
  }

  async setResetToken(email, token, expiry) {
    const pool = getPool();
    const cleanEmail = (email || '').trim().toLowerCase();
    const result = await pool.request()
      .input('email', sql.VarChar, cleanEmail)
      .input('token', sql.VarChar, token)
      .input('expiry', sql.DateTime, expiry)
      .query(`
        UPDATE Users 
        SET reset_token = @token, reset_token_expiry = @expiry, updated_at = GETDATE()
        WHERE LOWER(email) = @email OR LOWER(username) = @email
      `);
    return result.rowsAffected[0] > 0;
  }

  async findByResetToken(token) {
    const pool = getPool();
    const result = await pool.request()
      .input('token', sql.VarChar, token)
      .query(`
        SELECT u.*, u.role AS role_name 
        FROM Users u
        WHERE u.reset_token = @token AND (u.reset_token_expiry > GETDATE() OR u.reset_token_expiry > GETUTCDATE())
      `);
    return result.recordset[0] || null;
  }

  // OTP-specific: store 6-digit OTP with 10-minute expiry
  async setOtp(email, otp, expiry) {
    const pool = getPool();
    const cleanEmail = (email || '').trim().toLowerCase();
    const result = await pool.request()
      .input('email', sql.VarChar, cleanEmail)
      .input('otp', sql.VarChar, otp)
      .input('expiry', sql.DateTime, expiry)
      .query(`
        UPDATE Users
        SET reset_token = @otp, reset_token_expiry = @expiry, updated_at = GETDATE()
        WHERE LOWER(email) = @email OR LOWER(username) = @email
      `);
    return result.rowsAffected[0] > 0;
  }

  // Find user by OTP or post-verify session token (token must not be expired)
  async findByOtp(token) {
    const pool = getPool();
    const result = await pool.request()
      .input('token', sql.VarChar, token)
      .query(`
        SELECT u.*, u.role AS role_name
        FROM Users u
        WHERE u.reset_token = @token AND (u.reset_token_expiry > GETDATE() OR u.reset_token_expiry > GETUTCDATE())
      `);
    return result.recordset[0] || null;
  }

  async updatePassword(id, hashedPassword) {
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, id)
      .input('password_hash', sql.VarChar, hashedPassword)
      .query(`
        UPDATE Users 
        SET password_hash = @password_hash, 
            reset_token = NULL, 
            reset_token_expiry = NULL,
            refresh_token = NULL,
            updated_at = GETDATE()
        WHERE id = @id
      `);
  }

  async updateThemePreference(id, theme) {
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, id)
      .input('theme', sql.VarChar, theme)
      .query(`
        UPDATE Users 
        SET theme_preference = @theme, updated_at = GETDATE()
        WHERE id = @id
      `);
  }
}

module.exports = UserRepository;

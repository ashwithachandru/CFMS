const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { connectDB, getPool } = require('../config/db');

async function inspectRbac() {
  await connectDB();
  const pool = getPool();

  console.log('--- USERS IN DATABASE ---');
  const users = await pool.request().query("SELECT id, username, email, role, status FROM Users ORDER BY id ASC");
  console.table(users.recordset);

  console.log('\n--- ROLE PERMISSIONS FOR ALL ROLES ---');
  const rolePerms = await pool.request().query("SELECT role_name, module_key, can_read, can_write FROM RolePermissions ORDER BY role_name, module_key");
  console.table(rolePerms.recordset);

  console.log('\n--- USER PERMISSION OVERRIDES ---');
  const overrides = await pool.request().query("SELECT user_id, module_key, override_read, override_write FROM UserPermissionOverrides");
  console.table(overrides.recordset);

  process.exit(0);
}

inspectRbac();

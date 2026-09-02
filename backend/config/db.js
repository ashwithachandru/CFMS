const sql = require('mssql');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { execSync } = require('child_process');
require('dotenv').config();

const baseConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
  requestTimeout: 30000,
  connectionTimeout: 30000,
  options: {
    instanceName: process.env.DB_INSTANCE || undefined,
    encrypt: true, // required for local SQL Server 2022 TLS handshake
    trustServerCertificate: true,
    requestTimeout: 30000
  }
};

function getDynamicSqlPorts() {
  const candidatePorts = [];
  if (process.env.DB_PORT) {
    const envPort = parseInt(process.env.DB_PORT, 10);
    if (!isNaN(envPort)) candidatePorts.push(envPort);
  }
  try {
    const cmd = 'powershell -Command "Get-NetTCPConnection -State Listen -OwningProcess (Get-Process sqlservr).Id | Select-Object -ExpandProperty LocalPort"';
    const output = execSync(cmd).toString().trim();
    if (output) {
      const ports = output.split(/\r?\n/).map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p));
      for (const p of ports) {
        if (!candidatePorts.includes(p)) candidatePorts.push(p);
      }
    }
  } catch (err) {
    console.warn('Failed to resolve dynamic ports via PowerShell:', err.message);
  }
  if (!candidatePorts.includes(1433)) candidatePorts.push(1433);
  return candidatePorts;
}

let pool = null;

async function attemptConnection(config) {
  const masterConfig = { 
    ...config, 
    database: 'master'
  };
  const masterPool = new sql.ConnectionPool(masterConfig);
  await masterPool.connect();
  return masterPool;
}

async function connectDB(maxRetries = 3) {
  const dbName = process.env.DB_DATABASE || 'CustomerFeedbackDB';
  const candidatePorts = getDynamicSqlPorts();
  console.log(`Available SQL Server candidate ports to test: ${candidatePorts.join(', ')}`);

  let connectedMasterPool = null;
  let workingPort = null;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`Database connection attempt ${attempt} of ${maxRetries}...`);
    for (const port of candidatePorts) {
      const configToTest = {
        ...baseConfig,
        port: port,
        options: {
          ...baseConfig.options,
          encrypt: false, // Local SQL Server encryption disabled for direct TDS handshake
          instanceName: undefined
        }
      };
      console.log(`Trying SQL Server at ${configToTest.server}:${port}...`);
      try {
        connectedMasterPool = await attemptConnection(configToTest);
        workingPort = port;
        baseConfig.port = port;
        baseConfig.options.encrypt = false;
        baseConfig.options.instanceName = undefined;
        console.log(`Successfully established connection on port ${port}!`);
        break;
      } catch (err) {
        lastError = err;
        console.warn(`Connection to port ${port} failed (${err.message}). Trying next candidate...`);
      }
    }

    if (connectedMasterPool) break;

    if (attempt < maxRetries) {
      console.log(`Retrying in 1 second...`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (!connectedMasterPool) {
    throw new Error(`Failed to connect to SQL Server on any candidate port (${candidatePorts.join(', ')}). Last error: ${lastError ? lastError.message : 'Unknown'}`);
  }

  try {
    console.log(`Checking/Creating database "${dbName}"...`);
    await connectedMasterPool.request().query(`
      IF DB_ID('${dbName}') IS NULL
      BEGIN
        CREATE DATABASE [${dbName}];
      END
    `);
    console.log(`Database "${dbName}" verified/created successfully.`);
    await connectedMasterPool.close();

    // Connect to target database
    const targetConfig = {
      ...baseConfig,
      database: dbName
    };

    console.log(`Connecting to target database "${dbName}" on port ${workingPort}...`);
    pool = new sql.ConnectionPool(targetConfig);
    await pool.connect();
    console.log(`Connected to target database "${dbName}" successfully on port ${workingPort}.`);

    // Run schema and seed scripts
    await initializeDatabase();

    return pool;
  } catch (err) {
    console.error('Database connection / initialization failed:', err.message);
    throw err;
  }
}

async function initializeDatabase() {
  try {
    console.log('Initializing database schema...');
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute DDL schema statements
    await pool.request().query(schemaSql);
    console.log('Database schema verified.');
  } catch (err) {
    console.error('Error initializing database:', err.message);
    throw err;
  }
}

function createMockPool() {
  const bcrypt = require('bcrypt');
  
  if (!global.mockDatabaseState) {
    const adminHash = bcrypt.hashSync('Admin@123', 10);
    global.mockDatabaseState = {
      users: [
        {
          id: 1,
          email: 'admin@complaint.com',
          password_hash: adminHash,
          first_name: 'System',
          last_name: 'Admin',
          role_id: 1,
          department_id: 1,
          status: 'Active',
          refresh_token: null,
          theme_preference: 'dark',
          role_name: 'Administrator',
          department_name: 'Administration'
        }
      ],
      roles: [
        { id: 1, name: 'Administrator' },
        { id: 2, name: 'Warehouse Executive' }
      ],
      departments: [
        { id: 1, name: 'Administration' },
        { id: 2, name: 'Logistics' }
      ],
      messages: [
        {
          id: 1,
          complaint_id: 'CMP-0041',
          sender_id: 1,
          sender_role: 'Administrator',
          recipient_id: 2,
          recipient_role: 'Warehouse Team',
          message_text: 'Please verify the sizing mismatch of packaging labels.',
          read_status: 'Unread',
          created_at: new Date(Date.now() - 3600000),
          first_name: 'System',
          last_name: 'Admin'
        }
      ]
    };
  }

  const request = () => {
    const inputs = {};
    const reqObj = {
      input: (name, type, value) => {
        inputs[name] = value;
        return reqObj;
      },
      query: async (queryString) => {
        const queryNormalized = queryString.trim().replace(/\s+/g, ' ').toLowerCase();

        if (queryNormalized.includes('from users u') && queryNormalized.includes('email = @email')) {
          const user = global.mockDatabaseState.users.find(u => u.email.toLowerCase() === inputs.email?.toLowerCase());
          return { recordset: user ? [user] : [] };
        }

        if (queryNormalized.includes('from users u') && queryNormalized.includes('id = @id')) {
          const user = global.mockDatabaseState.users.find(u => u.id === inputs.id);
          return { recordset: user ? [user] : [] };
        }

        if (queryNormalized.includes('update users') && queryNormalized.includes('refresh_token = @token')) {
          const user = global.mockDatabaseState.users.find(u => u.id === inputs.id);
          if (user) {
            user.refresh_token = inputs.token;
          }
          return { recordset: [] };
        }

        if (queryNormalized.includes('update users') && queryNormalized.includes('theme_preference = @theme')) {
          const user = global.mockDatabaseState.users.find(u => u.id === inputs.id);
          if (user) {
            user.theme_preference = inputs.theme;
          }
          return { recordset: [] };
        }

        if (queryNormalized.includes('select * from roles') || queryNormalized.includes('select id from roles')) {
          return { recordset: global.mockDatabaseState.roles };
        }

        if (queryNormalized.includes('select * from departments') || queryNormalized.includes('select id from departments')) {
          return { recordset: global.mockDatabaseState.departments };
        }

        // Messages repository mocks
        if (queryNormalized.includes('from messages m') && queryNormalized.includes('m.complaint_id = @complaint_id')) {
          const msgs = global.mockDatabaseState.messages.filter(m => m.complaint_id === inputs.complaint_id);
          return { recordset: msgs };
        }

        if (queryNormalized.includes('insert into messages')) {
          const newId = global.mockDatabaseState.messages.length + 1;
          const sender = global.mockDatabaseState.users.find(u => u.id === inputs.sender_id) || { first_name: 'System', last_name: 'Admin' };
          const newMsg = {
            id: newId,
            complaint_id: inputs.complaint_id,
            sender_id: inputs.sender_id,
            sender_role: inputs.sender_role,
            recipient_id: inputs.recipient_id,
            recipient_role: inputs.recipient_role,
            message_text: inputs.message_text,
            read_status: inputs.read_status || 'Unread',
            created_at: new Date(),
            first_name: sender.first_name,
            last_name: sender.last_name
          };
          global.mockDatabaseState.messages.push(newMsg);
          return { recordset: [{ id: newId }] };
        }

        if (queryNormalized.includes('update messages') && queryNormalized.includes("read_status = 'read'")) {
          global.mockDatabaseState.messages.forEach(m => {
            if (m.complaint_id === inputs.complaint_id && m.recipient_role === inputs.recipient_role) {
              m.read_status = 'Read';
            }
          });
          return { recordset: [] };
        }

        if (queryNormalized.includes('from messages') && queryNormalized.includes("read_status = 'unread'")) {
          const count = global.mockDatabaseState.messages.filter(m => m.recipient_role === inputs.recipient_role && m.read_status === 'Unread').length;
          return { recordset: [{ count }] };
        }

        if (queryNormalized.includes('insert into auditlogs') || queryNormalized.includes('insert into audit_logs') || queryNormalized.includes('insert into')) {
          return { recordset: [{ id: 1 }] };
        }

        return { recordset: [] };
      }
    };
    return reqObj;
  };

  return {
    request,
    close: async () => {}
  };
}

function getPool() {
  if (!pool) {
    if (process.env.ALLOW_MOCK_DB === 'true') {
      console.warn("=================================================");
      console.warn("WARNING: USING IN-MEMORY MOCK DATABASE FALLBACK!");
      console.warn("ALLOW_MOCK_DB=true is enabled. Data will NOT persist to SQL Server!");
      console.warn("=================================================");
      return createMockPool();
    }
    throw new Error("FATAL: Database pool is not connected to SQL Server. Check SQL Server service and credentials.");
  }
  return pool;
}

module.exports = {
  connectDB,
  getPool,
  sql
};

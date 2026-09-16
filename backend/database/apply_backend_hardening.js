const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { connectDB, getPool, sql } = require('../config/db');

async function applyBackendHardening() {
  try {
    await connectDB();
    const pool = getPool();
    console.log('--- Applying Backend Hardening Migrations ---');

    // 1. Add escalation_email_sent_at to Complaints
    console.log('Checking escalation_email_sent_at column in Complaints...');
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID(N'[dbo].[Complaints]') 
          AND name = N'escalation_email_sent_at'
      )
      BEGIN
        ALTER TABLE Complaints ADD escalation_email_sent_at DATETIME NULL;
        PRINT 'Added escalation_email_sent_at column to Complaints.';
      END
    `);

    // 2. Add Foreign Keys on Messages (sender_id and recipient_id)
    console.log('Checking Foreign Keys on Messages table...');
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.foreign_keys 
        WHERE name = 'FK_Messages_Sender' AND parent_object_id = OBJECT_ID(N'[dbo].[Messages]')
      )
      BEGIN
        ALTER TABLE Messages ADD CONSTRAINT FK_Messages_Sender 
        FOREIGN KEY (sender_id) REFERENCES Users(id) ON DELETE NO ACTION;
        PRINT 'Added FK_Messages_Sender constraint.';
      END
    `);

    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.foreign_keys 
        WHERE name = 'FK_Messages_Recipient' AND parent_object_id = OBJECT_ID(N'[dbo].[Messages]')
      )
      BEGIN
        ALTER TABLE Messages ADD CONSTRAINT FK_Messages_Recipient 
        FOREIGN KEY (recipient_id) REFERENCES Users(id) ON DELETE NO ACTION;
        PRINT 'Added FK_Messages_Recipient constraint.';
      END
    `);

    // 3. Add Performance Indexes
    console.log('Creating database indexes idempotently...');

    // Complaints indexes
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Complaints_Warehouse_Status' AND object_id = OBJECT_ID(N'[dbo].[Complaints]'))
      BEGIN
        CREATE NONCLUSTERED INDEX IX_Complaints_Warehouse_Status 
        ON Complaints(warehouse_id, status)
        INCLUDE (raised_at, sales_executive_id, customer_code, invoice_number);
        PRINT 'Created IX_Complaints_Warehouse_Status';
      END
    `);

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Complaints_SalesExecutive_Status' AND object_id = OBJECT_ID(N'[dbo].[Complaints]'))
      BEGIN
        CREATE NONCLUSTERED INDEX IX_Complaints_SalesExecutive_Status 
        ON Complaints(sales_executive_id, status)
        INCLUDE (raised_at, warehouse_id, customer_code, invoice_number);
        PRINT 'Created IX_Complaints_SalesExecutive_Status';
      END
    `);

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Complaints_SLA_AutoEscalate' AND object_id = OBJECT_ID(N'[dbo].[Complaints]'))
      BEGIN
        CREATE NONCLUSTERED INDEX IX_Complaints_SLA_AutoEscalate 
        ON Complaints(status, warehouse_team_deadline)
        INCLUDE (complaint_number, warehouse_id, escalation_email_sent_at);
        PRINT 'Created IX_Complaints_SLA_AutoEscalate';
      END
    `);

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Complaints_DuplicateCheck' AND object_id = OBJECT_ID(N'[dbo].[Complaints]'))
      BEGIN
        CREATE NONCLUSTERED INDEX IX_Complaints_DuplicateCheck 
        ON Complaints(customer_code, invoice_number)
        INCLUDE (product_name, complaint_type_id, complaint_subtype_id, status);
        PRINT 'Created IX_Complaints_DuplicateCheck';
      END
    `);

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Complaints_RaisedAt' AND object_id = OBJECT_ID(N'[dbo].[Complaints]'))
      BEGIN
        CREATE NONCLUSTERED INDEX IX_Complaints_RaisedAt 
        ON Complaints(raised_at DESC);
        PRINT 'Created IX_Complaints_RaisedAt';
      END
    `);

    // Messages indexes
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Messages_Recipient_Read' AND object_id = OBJECT_ID(N'[dbo].[Messages]'))
      BEGIN
        CREATE NONCLUSTERED INDEX IX_Messages_Recipient_Read 
        ON Messages(recipient_id, read_status)
        INCLUDE (complaint_id, sender_id, created_at);
        PRINT 'Created IX_Messages_Recipient_Read';
      END
    `);

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Messages_Sender' AND object_id = OBJECT_ID(N'[dbo].[Messages]'))
      BEGIN
        CREATE NONCLUSTERED INDEX IX_Messages_Sender 
        ON Messages(sender_id, created_at);
        PRINT 'Created IX_Messages_Sender';
      END
    `);

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Messages_Complaint' AND object_id = OBJECT_ID(N'[dbo].[Messages]'))
      BEGIN
        CREATE NONCLUSTERED INDEX IX_Messages_Complaint 
        ON Messages(complaint_id, created_at);
        PRINT 'Created IX_Messages_Complaint';
      END
    `);

    // ComplaintHistory index
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ComplaintHistory_ComplaintId' AND object_id = OBJECT_ID(N'[dbo].[ComplaintHistory]'))
      BEGIN
        CREATE NONCLUSTERED INDEX IX_ComplaintHistory_ComplaintId 
        ON ComplaintHistory(complaint_id, timestamp);
        PRINT 'Created IX_ComplaintHistory_ComplaintId';
      END
    `);

    // AuditLogs index
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AuditLogs_UserId_Timestamp' AND object_id = OBJECT_ID(N'[dbo].[AuditLogs]'))
      BEGIN
        CREATE NONCLUSTERED INDEX IX_AuditLogs_UserId_Timestamp 
        ON AuditLogs(user_id, timestamp DESC);
        PRINT 'Created IX_AuditLogs_UserId_Timestamp';
      END
    `);

    console.log('✅ All backend hardening database schema changes applied successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

applyBackendHardening();

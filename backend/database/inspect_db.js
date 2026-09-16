const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { connectDB, getPool, sql } = require('../config/db');

async function inspectDatabase() {
  try {
    await connectDB();
    const pool = getPool();
    console.log('Connected to DB. Inspecting Messages, Complaints, Indexes, and FKs...');

    // 1. Check orphan sender_ids in Messages
    const orphanSenders = await pool.request().query(`
      SELECT m.id, m.sender_id, m.complaint_id 
      FROM Messages m 
      LEFT JOIN Users u ON m.sender_id = u.id 
      WHERE u.id IS NULL
    `);
    console.log(`Orphan sender_id count in Messages: ${orphanSenders.recordset.length}`);
    if (orphanSenders.recordset.length > 0) {
      console.log('Sample orphan senders:', orphanSenders.recordset.slice(0, 5));
    }

    // 2. Check orphan recipient_ids in Messages
    const orphanRecipients = await pool.request().query(`
      SELECT m.id, m.recipient_id, m.complaint_id 
      FROM Messages m 
      LEFT JOIN Users u ON m.recipient_id = u.id 
      WHERE m.recipient_id IS NOT NULL AND u.id IS NULL
    `);
    console.log(`Orphan recipient_id count in Messages: ${orphanRecipients.recordset.length}`);
    if (orphanRecipients.recordset.length > 0) {
      console.log('Sample orphan recipients:', orphanRecipients.recordset.slice(0, 5));
    }

    // 3. Inspect existing indexes on Complaints, Messages, ComplaintHistory
    const existingIndexes = await pool.request().query(`
      SELECT 
        t.name AS TableName,
        i.name AS IndexName,
        i.type_desc AS IndexType
      FROM sys.indexes i
      JOIN sys.tables t ON i.object_id = t.object_id
      WHERE t.name IN ('Complaints', 'Messages', 'ComplaintHistory', 'AuditLogs')
      ORDER BY t.name, i.name
    `);
    console.log('Existing Indexes:');
    console.table(existingIndexes.recordset);

    // 4. Inspect existing foreign keys
    const existingFks = await pool.request().query(`
      SELECT 
        fk.name AS FKName,
        tp.name AS TableName,
        ref.name AS ReferencedTable
      FROM sys.foreign_keys fk
      JOIN sys.tables tp ON fk.parent_object_id = tp.object_id
      JOIN sys.tables ref ON fk.referenced_object_id = ref.object_id
      WHERE tp.name IN ('Complaints', 'Messages', 'ComplaintHistory', 'AuditLogs')
      ORDER BY tp.name, fk.name
    `);
    console.log('Existing Foreign Keys:');
    console.table(existingFks.recordset);

    process.exit(0);
  } catch (err) {
    console.error('Inspection error:', err);
    process.exit(1);
  }
}

inspectDatabase();

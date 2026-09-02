const { getPool, sql } = require('../../config/db');
const mailer = require('../../config/mailer');

function triggerEscalationEmail(complaintId) {
  setImmediate(async () => {
    try {
      const repo = new ComplaintRepository();
      const details = await repo.getNotificationDetails(complaintId);
      const recipients = details?.managerEmails?.length > 0 ? details.managerEmails : (details?.managerEmail ? [details.managerEmail] : []);
      if (details && recipients.length > 0) {
        await mailer.sendEscalationEmail({
          email: recipients,
          managerName: details.managerName,
          complaintNumber: details.complaintNumber,
          salesExecutiveName: details.salesExecutiveName,
          customerCode: details.customerCode,
          invoiceNumber: details.invoiceNumber,
          complaintType: details.complaintType,
          complaintSubtype: details.complaintSubtype
        });
      } else {
        console.warn(`[MAIL WARN] Escalation email skipped for complaint ID ${complaintId}: No active Warehouse Manager found for warehouse ID ${details?.warehouseId || 'unknown'}.`);
      }
    } catch (err) {
      console.error(`[MAIL ERROR] Failed sending escalation email for complaint ID ${complaintId}:`, err.message);
    }
  });
}

function triggerResolutionEmail(complaintId) {
  setImmediate(async () => {
    try {
      const repo = new ComplaintRepository();
      const details = await repo.getNotificationDetails(complaintId);
      if (details && details.salesExecutiveEmail) {
        console.log(`[RESOLUTION MAIL] Complaint ${details.complaintNumber} (ID: ${complaintId}) resolved. Original Sales Executive ID: ${details.salesExecutiveId} (${details.salesExecutiveName}). Sending resolution email to: ${details.salesExecutiveEmail}`);
        await mailer.sendResolutionEmail({
          email: details.salesExecutiveEmail,
          salesExecutiveName: details.salesExecutiveName,
          complaintNumber: details.complaintNumber,
          customerCode: details.customerCode,
          invoiceNumber: details.invoiceNumber,
          warehouseName: details.warehouseName,
          complaintType: details.complaintType,
          complaintSubtype: details.complaintSubtype
        });
      } else {
        console.warn(`[MAIL WARN] Resolution email skipped for complaint ID ${complaintId}: Sales Executive email not found for sales_executive_id ${details?.salesExecutiveId || 'unknown'}.`);
      }
    } catch (err) {
      console.error(`[MAIL ERROR] Failed sending resolution email for complaint ID ${complaintId}:`, err.message);
    }
  });
}

class ComplaintRepository {
  async getFormMetadata() {
    const pool = getPool();
    const warehousesRes = await pool.request().query('SELECT id, name, location FROM Warehouses ORDER BY name ASC');
    const typesRes = await pool.request().query('SELECT id, name, description FROM ComplaintTypes ORDER BY id ASC');
    const subtypesRes = await pool.request().query('SELECT id, complaint_type_id, name FROM ComplaintSubtypes ORDER BY id ASC');

    return {
      warehouses: warehousesRes.recordset,
      complaintTypes: typesRes.recordset,
      complaintSubtypes: subtypesRes.recordset
    };
  }

  async create(data) {
    const pool = getPool();

    // 1. Auto-generate next complaint_number e.g. CMP-0001
    const maxRes = await pool.request().query(`
      SELECT MAX(CAST(SUBSTRING(complaint_number, 5, 8) AS INT)) AS maxSeq 
      FROM Complaints
      WHERE ISNUMERIC(SUBSTRING(complaint_number, 5, 8)) = 1
    `);
    const nextSeq = (maxRes.recordset[0].maxSeq || 0) + 1;
    const complaintNumber = `CMP-${String(nextSeq).padStart(4, '0')}`;

    // 2. Lookup Warehouse Team user for auto-assignment based on selected warehouse_id
    const teamRes = await pool.request()
      .input('warehouse_id', sql.Int, data.warehouse_id)
      .query(`
        SELECT TOP 1 id FROM Users 
        WHERE role = 'Warehouse Team' AND warehouse_id = @warehouse_id AND status = 'Active'
      `);
    const assignedTeamId = teamRes.recordset[0]?.id || null;

    // Fetch dynamic SLA window from SystemSettings (default to 24 if missing)
    let slaWindowHours = 24;
    try {
      const settingRes = await pool.request().query(`
        SELECT setting_value FROM SystemSettings WHERE setting_key = 'sla_window_hours'
      `);
      if (settingRes.recordset.length > 0 && !isNaN(parseInt(settingRes.recordset[0].setting_value, 10))) {
        slaWindowHours = parseInt(settingRes.recordset[0].setting_value, 10);
      }
    } catch (e) {
      slaWindowHours = 24;
    }

    // 3. Insert Complaint into database
    const insertRes = await pool.request()
      .input('complaint_number', sql.VarChar, complaintNumber)
      .input('sales_executive_id', sql.Int, data.sales_executive_id)
      .input('warehouse_id', sql.Int, data.warehouse_id ? parseInt(data.warehouse_id, 10) : null)
      .input('customer_code', sql.VarChar, data.customer_code)
      .input('invoice_number', sql.VarChar, data.invoice_number)
      .input('complaint_type_id', sql.Int, data.complaint_type_id)
      .input('complaint_subtype_id', sql.Int, data.complaint_subtype_id || null)
      .input('description', sql.NVarChar, data.description)
      .input('attachment_url', sql.VarChar, data.attachment_url || null)
      .input('invoice_url', sql.VarChar, data.invoice_url || null)
      .input('submission_type', sql.VarChar, data.submission_type || (data.invoice_url ? 'ocr' : 'manual'))
      .input('assigned_team_id', sql.Int, assignedTeamId)
      .input('sla_hours', sql.Int, slaWindowHours)
      .query(`
        INSERT INTO Complaints (
          complaint_number, sales_executive_id, warehouse_id, customer_code, invoice_number, 
          complaint_type_id, complaint_subtype_id, description, attachment_url, invoice_url, submission_type, status, 
          assigned_warehouse_team_id, raised_at, warehouse_team_deadline
        )
        OUTPUT INSERTED.id, INSERTED.complaint_number
        VALUES (
          @complaint_number, @sales_executive_id, @warehouse_id, @customer_code, @invoice_number, 
          @complaint_type_id, @complaint_subtype_id, @description, @attachment_url, @invoice_url, @submission_type, 'Assigned', 
          @assigned_team_id, GETDATE(), DATEADD(hour, @sla_hours, GETDATE())
        )
      `);

    const createdId = insertRes.recordset[0].id;

    // 4. Log initial ComplaintHistory entry
    await pool.request()
      .input('complaint_id', sql.Int, createdId)
      .input('performed_by', sql.Int, data.sales_executive_id)
      .input('notes', sql.NVarChar, `Complaint ${complaintNumber} raised by Sales Executive`)
      .query(`
        INSERT INTO ComplaintHistory (complaint_id, action, performed_by, notes)
        VALUES (@complaint_id, 'Created', @performed_by, @notes)
      `);

    return {
      id: createdId,
      complaint_number: complaintNumber,
      assigned_warehouse_team_id: assignedTeamId
    };
  }

  async checkAndAutoEscalate() {
    const pool = getPool();
    const expiredRes = await pool.request().query(`
      SELECT id, complaint_number, warehouse_id 
      FROM Complaints 
      WHERE status IN ('Assigned', 'New', 'In Progress') 
        AND GETDATE() > warehouse_team_deadline
    `);

    if (expiredRes.recordset.length === 0) {
      return 0;
    }

    for (const comp of expiredRes.recordset) {
      await pool.request()
        .input('id', comp.id)
        .query(`
          UPDATE Complaints 
          SET status = 'Escalated to Manager',
              escalated_to_manager_at = ISNULL(escalated_to_manager_at, GETDATE()),
              updated_at = GETDATE()
          WHERE id = @id
        `);

      await pool.request()
        .input('complaint_id', comp.id)
        .input('action', 'Automatic Escalation')
        .input('notes', 'Auto-escalated to Warehouse Manager due to 24h SLA expiry')
        .query(`
          INSERT INTO ComplaintHistory (complaint_id, action, notes)
          VALUES (@complaint_id, @action, @notes)
        `);

      // Trigger automated escalation email to Warehouse Manager
      triggerEscalationEmail(comp.id);
    }

    return expiredRes.recordset.length;
  }

  async findAll(userRole, userId, warehouseId, sortBy = 'date', history = false) {
    const pool = getPool();

    // 1. Automatic Escalation Check for expired SLAs past 24 hours
    await this.checkAndAutoEscalate();


    let whereClause = 'WHERE 1=1';

    // Role-based data scoping (Enforces exact Visibility Matrix & Global Shared Invoice Queue)
    if (userRole === 'Sales Executive') {
      whereClause += ` AND c.sales_executive_id = ${parseInt(userId, 10)} AND c.status <> 'Closed'`;
    } else if (userRole === 'Warehouse Team') {
      // Visible for their warehouse, plus the shared global pool of invoice complaints
      whereClause += ` AND (c.warehouse_id = ${parseInt(warehouseId || 0, 10)} OR c.warehouse_id IS NULL OR c.submission_type = 'ocr') AND c.status <> 'Closed'`;
    } else if (userRole === 'Warehouse Manager') {
      // Visible for their warehouse escalated complaints, escalated invoice complaints actioned by their team, plus shared global invoice complaints
      if (history) {
        whereClause += ` AND (
          (c.warehouse_id = ${parseInt(warehouseId || 0, 10)} AND c.escalated_to_manager_at IS NOT NULL)
          OR (c.warehouse_id IS NULL AND c.taken_action_by IN (SELECT id FROM Users WHERE warehouse_id = ${parseInt(warehouseId || 0, 10)}) AND c.escalated_to_manager_at IS NOT NULL)
          OR c.warehouse_id IS NULL 
          OR c.submission_type = 'ocr'
        ) AND c.status <> 'Closed'`;
      } else {
        whereClause += ` AND (
          (c.warehouse_id = ${parseInt(warehouseId || 0, 10)} AND c.escalated_to_manager_at IS NOT NULL AND c.status NOT IN ('Resolved', 'Completed', 'Closed'))
          OR (c.warehouse_id IS NULL AND c.taken_action_by IN (SELECT id FROM Users WHERE warehouse_id = ${parseInt(warehouseId || 0, 10)}) AND c.escalated_to_manager_at IS NOT NULL AND c.status NOT IN ('Resolved', 'Completed', 'Closed'))
          OR c.warehouse_id IS NULL 
          OR c.submission_type = 'ocr'
        ) AND c.status <> 'Closed'`;
      }
    }

    // Build ORDER BY clause based on sortBy parameter
    let orderByClause;
    if (sortBy === 'priority') {
      // Server-side priority ranking: Escalated → Red(<6h) → Amber(6-12h) → Green(>12h) → Completed last
      orderByClause = `
        ORDER BY
          CASE
            WHEN c.status LIKE '%Escalated%'                                                        THEN 1
            WHEN DATEDIFF(hour, GETDATE(), c.warehouse_team_deadline) < 6
                 AND c.status NOT IN ('Resolved', 'Completed')                                      THEN 2
            WHEN DATEDIFF(hour, GETDATE(), c.warehouse_team_deadline) BETWEEN 6 AND 12
                 AND c.status NOT IN ('Resolved', 'Completed')                                      THEN 3
            WHEN c.status IN ('Resolved', 'Completed')                                              THEN 5
            ELSE                                                                                         4
          END ASC,
          c.raised_at DESC
      `;
    } else {
      // Default: newest raised complaints first
      orderByClause = 'ORDER BY c.raised_at DESC';
    }

    const query = `
      SELECT 
        c.id,
        c.complaint_number AS id_display,
        c.customer_code AS customer,
        c.invoice_number AS invoice,
        ct.name AS type,
        cs.name AS subtype,
        (u_sales.first_name + ' ' + u_sales.last_name) AS raisedBy,
        CONVERT(VARCHAR(20), c.raised_at, 106) AS date,
        CONVERT(VARCHAR(30), c.raised_at, 126) AS raised_at_iso,
        c.status,
        ISNULL(w.name, 'Global / Shared Queue') AS warehouse_name,
        c.warehouse_id,
        c.attachment_url,
        c.invoice_url,
        c.submission_type,
        (CASE WHEN c.attachment_url IS NOT NULL THEN 1 ELSE 0 END) AS attach,
        DATEDIFF(hour, GETDATE(), c.warehouse_team_deadline) AS hours_left,
        c.taken_action_by,
        (u_actor.first_name + ' ' + u_actor.last_name) AS actor_name,
        w_actor.name AS actor_warehouse_name
      FROM Complaints c
      JOIN Users u_sales ON c.sales_executive_id = u_sales.id
      LEFT JOIN Warehouses w ON c.warehouse_id = w.id
      LEFT JOIN Users u_actor ON c.taken_action_by = u_actor.id
      LEFT JOIN Warehouses w_actor ON u_actor.warehouse_id = w_actor.id
      JOIN ComplaintTypes ct ON c.complaint_type_id = ct.id
      LEFT JOIN ComplaintSubtypes cs ON c.complaint_subtype_id = cs.id
      ${whereClause}
      ${orderByClause}
    `;

    const result = await pool.request().query(query);
    return result.recordset.map(row => {
      const isResolved = row.status === 'Resolved' || row.status === 'Completed';
      let slaText = 'Resolved';
      if (!isResolved) {
        slaText = row.hours_left > 0 ? `${row.hours_left}h` : 'Expired !';
      }

      // Compute priority rank for display (mirrors the SQL CASE for client reference)
      let priorityLabel;
      if (row.status && row.status.includes('Escalated')) {
        priorityLabel = 'Critical';
      } else if (!isResolved && row.hours_left < 6) {
        priorityLabel = 'High';
      } else if (!isResolved && row.hours_left <= 12) {
        priorityLabel = 'Medium';
      } else if (isResolved) {
        priorityLabel = 'Completed';
      } else {
        priorityLabel = 'Low';
      }

      return {
        id: row.id_display,
        numeric_id: row.id,
        customer: row.customer,
        invoice: row.invoice,
        type: row.type,
        subtype: row.subtype || 'General',
        raisedBy: row.raisedBy,
        date: row.date,
        raised_at: row.raised_at_iso,   // Raw ISO timestamp for spot-checking
        sla: slaText,
        hours_left: isResolved ? 999 : row.hours_left,
        status: row.status,
        priority: priorityLabel,
        department: row.warehouse_name,
        warehouse_name: row.warehouse_name,
        warehouse: row.warehouse_name,
        warehouse_id: row.warehouse_id,
        attach: Boolean(row.attach),
        attachment_url: row.attachment_url,
        invoice_url: row.invoice_url,
        submission_type: row.submission_type || (row.invoice_url ? 'ocr' : 'manual'),
        taken_action_by: row.taken_action_by,
        actor_name: row.actor_name,
        actor_warehouse_name: row.actor_warehouse_name
      };
    });
  }

  async updateStatus(complaintIdOrNumber, targetStatusOrAction, userId, userRole) {
    const pool = getPool();

    // 1. Resolve Complaint
    const compRes = await pool.request()
      .input('comp_id', sql.VarChar, String(complaintIdOrNumber))
      .query(`
        SELECT id, complaint_number, status, warehouse_id 
        FROM Complaints 
        WHERE complaint_number = @comp_id OR CAST(id AS VARCHAR) = @comp_id
      `);

    if (compRes.recordset.length === 0) {
      throw new Error(`Complaint ${complaintIdOrNumber} not found.`);
    }

    const comp = compRes.recordset[0];
    let newStatus = comp.status;
    let actionName = targetStatusOrAction;

    if (targetStatusOrAction === 'In Progress' || targetStatusOrAction === 'Take Action') {
      newStatus = 'In Progress';
      actionName = 'Take Action';
    } else if (targetStatusOrAction === 'Resolved' || targetStatusOrAction === 'Completed' || targetStatusOrAction === 'Complete') {
      newStatus = 'Resolved';
      actionName = 'Complete';
    } else if (targetStatusOrAction === 'Escalate' || targetStatusOrAction === 'Escalated' || targetStatusOrAction === 'Escalated to Manager' || targetStatusOrAction === 'Escalated to Warehouse Head') {
      if (userRole === 'Warehouse Manager') {
        newStatus = 'Escalated to Warehouse Head';
        actionName = 'Escalated to Warehouse Head';
      } else {
        newStatus = 'Escalated to Manager';
        actionName = 'Escalated to Manager';
      }
    } else {
      newStatus = targetStatusOrAction;
    }

    // 2. Update status in database
    await pool.request()
      .input('id', sql.Int, comp.id)
      .input('new_status', sql.VarChar, newStatus)
      .input('user_id', sql.Int, parseInt(userId, 10))
      .query(`
        UPDATE Complaints 
        SET status = @new_status,
            updated_at = GETDATE(),
            taken_action_by = (CASE WHEN @new_status = 'In Progress' THEN @user_id ELSE ISNULL(taken_action_by, @user_id) END),
            warehouse_team_responded_at = (CASE WHEN @new_status = 'In Progress' THEN ISNULL(warehouse_team_responded_at, GETDATE()) ELSE warehouse_team_responded_at END),
            escalated_to_manager_at = (CASE WHEN @new_status LIKE '%Escalated%' THEN ISNULL(escalated_to_manager_at, GETDATE()) ELSE escalated_to_manager_at END)
        WHERE id = @id
      `);

    // 3. Log history
    await pool.request()
      .input('complaint_id', sql.Int, comp.id)
      .input('action', sql.VarChar, actionName)
      .input('performed_by', sql.Int, parseInt(userId, 10))
      .input('notes', sql.NVarChar, `Status updated to '${newStatus}' by ${userRole}`)
      .query(`
        INSERT INTO ComplaintHistory (complaint_id, action, performed_by, notes)
        VALUES (@complaint_id, @action, @performed_by, @notes)
      `);

    // 4. Trigger automated email notifications (non-blocking)
    if (newStatus === 'Escalated to Manager') {
      triggerEscalationEmail(comp.id);
    } else if (newStatus === 'Resolved') {
      triggerResolutionEmail(comp.id);
    }

    return { id: comp.complaint_number, status: newStatus };
  }

  async getFormMetadata() {
    const pool = getPool();
    const warehousesRes = await pool.request().query("SELECT id, name, location FROM Warehouses ORDER BY id ASC");
    const typesRes = await pool.request().query("SELECT id, name, description FROM ComplaintTypes ORDER BY id ASC");
    const subtypesRes = await pool.request().query("SELECT id, complaint_type_id, name FROM ComplaintSubtypes ORDER BY id ASC");

    return {
      warehouses: warehousesRes.recordset,
      complaintTypes: typesRes.recordset,
      complaintSubtypes: subtypesRes.recordset
    };
  }

  async getStats(userRole, userId, warehouseId) {
    const pool = getPool();

    // Trigger auto-escalations first so stats match real-time DB state
    await this.findAll(userRole, userId, warehouseId);

    if (userRole === 'Warehouse Manager') {
      const query = `
        SELECT 
          COALESCE(SUM(CASE WHEN c.warehouse_id = @warehouse_id THEN 1 ELSE 0 END), 0) AS totalCount,
          COALESCE(SUM(CASE WHEN c.warehouse_id = @warehouse_id AND c.escalated_to_manager_at IS NOT NULL AND c.status IN ('Escalated to Manager', 'Escalated to Warehouse Head') THEN 1 ELSE 0 END), 0) AS pendingCount,
          COALESCE(SUM(CASE WHEN c.warehouse_id = @warehouse_id AND c.escalated_to_manager_at IS NOT NULL AND c.status = 'In Progress' THEN 1 ELSE 0 END), 0) AS inprogressCount,
          COALESCE(SUM(CASE WHEN c.warehouse_id = @warehouse_id AND c.escalated_to_manager_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS escalatedCount,
          COALESCE(SUM(CASE WHEN c.warehouse_id = @warehouse_id AND c.status IN ('Completed', 'Resolved') THEN 1 ELSE 0 END), 0) AS completedCount
        FROM Complaints c
      `;
      const res = await pool.request()
        .input('warehouse_id', sql.Int, warehouseId)
        .query(query);
      const row = res.recordset[0] || {};
      return {
        totalCount: row.totalCount || 0,
        pendingCount: row.pendingCount || 0,
        inprogressCount: row.inprogressCount || 0,
        escalatedCount: row.escalatedCount || 0,
        completedCount: row.completedCount || 0
      };
    }

    let whereClause = 'WHERE 1=1';

    if (userRole === 'Sales Executive') {
      whereClause += ` AND c.sales_executive_id = ${parseInt(userId, 10)} AND c.status <> 'Closed'`;
    } else if (userRole === 'Warehouse Team') {
      whereClause += ` AND c.warehouse_id = ${parseInt(warehouseId || 0, 10)} AND c.status <> 'Closed'`;
    }

    const query = `
      SELECT 
        COUNT(*) AS totalCount,
        SUM(CASE WHEN c.status IN ('Pending', 'Assigned', 'New') THEN 1 ELSE 0 END) AS pendingCount,
        SUM(CASE WHEN c.status = 'In Progress' THEN 1 ELSE 0 END) AS inprogressCount,
        SUM(CASE WHEN c.status LIKE '%Escalated%' OR c.status = 'Escalated' THEN 1 ELSE 0 END) AS escalatedCount,
        SUM(CASE WHEN c.status IN ('Completed', 'Resolved') THEN 1 ELSE 0 END) AS completedCount
      FROM Complaints c
      ${whereClause}
    `;

    const res = await pool.request().query(query);
    const row = res.recordset[0] || {};

    return {
      totalCount: row.totalCount || 0,
      pendingCount: row.pendingCount || 0,
      inprogressCount: row.inprogressCount || 0,
      escalatedCount: row.escalatedCount || 0,
      completedCount: row.completedCount || 0
    };
  }

  async findById(id) {
    const pool = getPool();
    const result = await pool.request()
      .input('id', sql.VarChar, String(id))
      .query(`
        SELECT 
          c.id AS db_id,
          c.complaint_number AS id_display,
          c.customer_code AS customer,
          c.invoice_number AS invoice,
          ct.name AS type,
          cs.name AS subtype,
          (u_sales.first_name + ' ' + u_sales.last_name) AS raisedBy,
          CONVERT(VARCHAR(20), c.raised_at, 106) AS date,
          CONVERT(VARCHAR(30), c.raised_at, 126) AS raised_at_iso,
          c.status,
          ISNULL(w.name, 'Global / Shared Queue') AS warehouse_name,
          c.attachment_url,
          c.invoice_url,
          c.submission_type,
          DATEDIFF(hour, GETDATE(), c.warehouse_team_deadline) AS hours_left,
          c.taken_action_by,
          c.sales_executive_id,
          c.warehouse_id
        FROM Complaints c
        JOIN Users u_sales ON c.sales_executive_id = u_sales.id
        LEFT JOIN Warehouses w ON c.warehouse_id = w.id
        JOIN ComplaintTypes ct ON c.complaint_type_id = ct.id
        LEFT JOIN ComplaintSubtypes cs ON c.complaint_subtype_id = cs.id
        WHERE c.complaint_number = @id OR CAST(c.id AS VARCHAR) = @id
      `);

    const row = result.recordset[0];
    if (!row) return null;

    const isResolved = row.status === 'Resolved' || row.status === 'Completed';
    let slaText = 'Resolved';
    if (!isResolved) {
      slaText = row.hours_left > 0 ? `${row.hours_left}h` : 'Expired !';
    }

    let priorityLabel;
    if (row.status && row.status.includes('Escalated')) {
      priorityLabel = 'Critical';
    } else if (!isResolved && row.hours_left < 6) {
      priorityLabel = 'High';
    } else if (!isResolved && row.hours_left <= 12) {
      priorityLabel = 'Medium';
    } else if (isResolved) {
      priorityLabel = 'Completed';
    } else {
      priorityLabel = 'Low';
    }

    return {
      id: row.id_display,
      customer: row.customer,
      invoice: row.invoice,
      type: row.type,
      subtype: row.subtype || 'General',
      raisedBy: row.raisedBy,
      date: row.date,
      raised_at: row.raised_at_iso,
      sla: slaText,
      hours_left: isResolved ? 999 : row.hours_left,
      status: row.status,
      priority: priorityLabel,
      department: row.warehouse_name,
      attachment_url: row.attachment_url,
      invoice_url: row.invoice_url,
      taken_action_by: row.taken_action_by,
      sales_executive_id: row.sales_executive_id,
      warehouse_id: row.warehouse_id
    };
  }

  async getNotificationDetails(complaintId) {
    try {
      const pool = getPool();
      const res = await pool.request()
        .input('id', sql.VarChar, String(complaintId))
        .query(`
          SELECT 
            c.id,
            c.complaint_number,
            c.customer_code,
            c.invoice_number,
            c.warehouse_id,
            c.taken_action_by,
            c.sales_executive_id,
            ISNULL(w.name, 'Global / Shared Queue') AS warehouse_name,
            u_actor.warehouse_id AS actor_warehouse_id,
            w_actor.name AS actor_warehouse_name,
            ct.name AS complaint_type,
            cs.name AS complaint_subtype,
            (u_sales.first_name + ' ' + u_sales.last_name) AS sales_executive_name,
            u_sales.email AS sales_executive_email
          FROM Complaints c
          LEFT JOIN Warehouses w ON c.warehouse_id = w.id
          LEFT JOIN Users u_actor ON c.taken_action_by = u_actor.id
          LEFT JOIN Warehouses w_actor ON u_actor.warehouse_id = w_actor.id
          JOIN ComplaintTypes ct ON c.complaint_type_id = ct.id
          LEFT JOIN ComplaintSubtypes cs ON c.complaint_subtype_id = cs.id
          JOIN Users u_sales ON c.sales_executive_id = u_sales.id
          WHERE c.complaint_number = @id OR CAST(c.id AS VARCHAR) = @id
        `);

      if (res.recordset.length === 0) return null;
      const row = res.recordset[0];

      // If warehouse_id is unset (unassigned invoice complaint), route escalation to actor's warehouse manager
      const targetWarehouseId = row.warehouse_id || row.actor_warehouse_id;
      const targetWarehouseName = row.warehouse_name !== 'Global / Shared Queue' ? row.warehouse_name : (row.actor_warehouse_name || 'Global Shared Queue');

      let managersRes;
      if (targetWarehouseId) {
        managersRes = await pool.request()
          .input('warehouse_id', sql.Int, targetWarehouseId)
          .query(`
            SELECT email, (first_name + ' ' + last_name) AS manager_name
            FROM Users
            WHERE role = 'Warehouse Manager' 
              AND warehouse_id = @warehouse_id 
              AND status = 'Active'
            ORDER BY id DESC
          `);
      } else {
        managersRes = await pool.request().query(`
          SELECT email, (first_name + ' ' + last_name) AS manager_name
          FROM Users
          WHERE role = 'Warehouse Manager' AND status = 'Active'
          ORDER BY id DESC
        `);
      }

      const managerEmails = managersRes.recordset.map(m => m.email).filter(Boolean);
      const managerNames = managersRes.recordset.map(m => m.manager_name).filter(Boolean).join(', ');

      return {
        id: row.id,
        complaintNumber: row.complaint_number,
        customerCode: row.customer_code,
        invoiceNumber: row.invoice_number,
        warehouseId: targetWarehouseId,
        warehouseName: targetWarehouseName,
        salesExecutiveId: row.sales_executive_id,
        salesExecutiveName: row.sales_executive_name,
        salesExecutiveEmail: row.sales_executive_email,
        managerEmails: managerEmails,
        managerEmail: managerEmails[0] || null,
        managerName: managerNames || 'Warehouse Manager',
        complaintType: row.complaint_type,
        complaintSubtype: row.complaint_subtype
      };
    } catch (err) {
      console.error('[MAIL ERROR] Failed to fetch complaint notification details:', err.message);
      return null;
    }
  }
}

module.exports = ComplaintRepository;

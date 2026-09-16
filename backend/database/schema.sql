-- Redesigned DDL Schema Script for SQL Server Express
-- Creates Tables: Warehouses, Users, ComplaintTypes, ComplaintSubtypes, Complaints, ComplaintHistory, Messages, AuditLogs

-- 1. Warehouses Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Warehouses' and xtype='U')
BEGIN
    CREATE TABLE Warehouses (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        location VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT GETDATE()
    );
END;

-- 2. Users Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' and xtype='U')
BEGIN
    CREATE TABLE Users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL, -- 'Sales Executive', 'Warehouse Team', 'Warehouse Manager', 'Administrator'
        warehouse_id INT FOREIGN KEY REFERENCES Warehouses(id) NULL,
        status VARCHAR(20) DEFAULT 'Active',
        refresh_token VARCHAR(500) NULL,
        reset_token VARCHAR(255) NULL,
        reset_token_expiry DATETIME NULL,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
    );
END;

-- 3. ComplaintTypes Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ComplaintTypes' and xtype='U')
BEGIN
    CREATE TABLE ComplaintTypes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description VARCHAR(255) NULL,
        created_at DATETIME DEFAULT GETDATE()
    );
END;

-- 4. ComplaintSubtypes Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ComplaintSubtypes' and xtype='U')
BEGIN
    CREATE TABLE ComplaintSubtypes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        complaint_type_id INT FOREIGN KEY REFERENCES ComplaintTypes(id) NOT NULL,
        name VARCHAR(100) NOT NULL,
        created_at DATETIME DEFAULT GETDATE()
    );
END;

-- 5. Complaints Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Complaints' and xtype='U')
BEGIN
    CREATE TABLE Complaints (
        id INT IDENTITY(1,1) PRIMARY KEY,
        complaint_number VARCHAR(50) UNIQUE NOT NULL,
        sales_executive_id INT FOREIGN KEY REFERENCES Users(id) NOT NULL,
        warehouse_id INT FOREIGN KEY REFERENCES Warehouses(id) NOT NULL,
        customer_code VARCHAR(100) NOT NULL,
        invoice_number VARCHAR(100) NOT NULL,
        complaint_type_id INT FOREIGN KEY REFERENCES ComplaintTypes(id) NOT NULL,
        complaint_subtype_id INT FOREIGN KEY REFERENCES ComplaintSubtypes(id) NULL,
        description NVARCHAR(MAX) NOT NULL,
        attachment_url VARCHAR(500) NULL,
        invoice_url VARCHAR(500) NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'New', -- 'New', 'Assigned', 'In Progress', 'Escalated to Manager', 'Escalated to Warehouse Head', 'Resolved', 'Closed'
        assigned_warehouse_team_id INT FOREIGN KEY REFERENCES Users(id) NULL,
        taken_action_by INT FOREIGN KEY REFERENCES Users(id) NULL,
        raised_at DATETIME DEFAULT GETDATE(),
        warehouse_team_deadline DATETIME NULL,
        warehouse_team_responded_at DATETIME NULL,
        escalated_to_manager_at DATETIME NULL,
        manager_deadline DATETIME NULL,
        manager_responded_at DATETIME NULL,
        escalated_to_warehouse_head_at DATETIME NULL,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
    );
END;

-- 6. ComplaintHistory Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ComplaintHistory' and xtype='U')
BEGIN
    CREATE TABLE ComplaintHistory (
        id INT IDENTITY(1,1) PRIMARY KEY,
        complaint_id INT FOREIGN KEY REFERENCES Complaints(id) NOT NULL,
        action VARCHAR(100) NOT NULL,
        performed_by INT FOREIGN KEY REFERENCES Users(id) NULL,
        notes NVARCHAR(MAX) NULL,
        timestamp DATETIME DEFAULT GETDATE()
    );
END;

-- 7. Messages Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Messages' and xtype='U')
BEGIN
    CREATE TABLE Messages (
        id INT IDENTITY(1,1) PRIMARY KEY,
        complaint_id VARCHAR(50) NOT NULL,
        sender_id INT NOT NULL,
        sender_role VARCHAR(50) NOT NULL,
        recipient_id INT NULL,
        recipient_role VARCHAR(50) NULL,
        message_text NVARCHAR(MAX) NULL,
        attachment_url VARCHAR(500) NULL,
        read_status VARCHAR(20) DEFAULT 'Unread',
        created_at DATETIME DEFAULT GETDATE()
    );
END;

-- 8. AuditLogs Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AuditLogs' and xtype='U')
BEGIN
    CREATE TABLE AuditLogs (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT FOREIGN KEY REFERENCES Users(id) ON DELETE SET NULL NULL,
        action VARCHAR(100) NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        user_agent VARCHAR(255) NOT NULL,
        details VARCHAR(500) NULL,
        timestamp DATETIME DEFAULT GETDATE()
    );
END;

-- Migration to add taken_action_by to Complaints table if it doesn't exist
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[Complaints]') 
      AND name = N'taken_action_by'
)
BEGIN
    ALTER TABLE Complaints 
    ADD taken_action_by INT FOREIGN KEY REFERENCES Users(id) NULL;
END;

-- Migration to add invoice_url to Complaints table if it doesn't exist
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[Complaints]') 
      AND name = N'invoice_url'
)
BEGIN
    ALTER TABLE Complaints 
    ADD invoice_url VARCHAR(500) NULL;
END;

-- Migration to add ocr_text to Complaints table if it doesn't exist
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[Complaints]') 
      AND name = N'ocr_text'
)
BEGIN
    ALTER TABLE Complaints 
    ADD ocr_text NVARCHAR(MAX) NULL;
END;

-- Migration to add product_name to Complaints table if it doesn't exist
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[Complaints]') 
      AND name = N'product_name'
)
BEGIN
    ALTER TABLE Complaints 
    ADD product_name NVARCHAR(255) NULL;
END;

-- Migration to add escalation_email_sent_at to Complaints table if it doesn't exist
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[Complaints]') 
      AND name = N'escalation_email_sent_at'
)
BEGIN
    ALTER TABLE Complaints 
    ADD escalation_email_sent_at DATETIME NULL;
END;

-- Foreign Keys on Messages
IF NOT EXISTS (
    SELECT * FROM sys.foreign_keys 
    WHERE name = 'FK_Messages_Sender' AND parent_object_id = OBJECT_ID(N'[dbo].[Messages]')
)
BEGIN
    ALTER TABLE Messages ADD CONSTRAINT FK_Messages_Sender 
    FOREIGN KEY (sender_id) REFERENCES Users(id) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM sys.foreign_keys 
    WHERE name = 'FK_Messages_Recipient' AND parent_object_id = OBJECT_ID(N'[dbo].[Messages]')
)
BEGIN
    ALTER TABLE Messages ADD CONSTRAINT FK_Messages_Recipient 
    FOREIGN KEY (recipient_id) REFERENCES Users(id) ON DELETE NO ACTION;
END;

-- Nonclustered Performance Indexes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Complaints_Warehouse_Status' AND object_id = OBJECT_ID(N'[dbo].[Complaints]'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Complaints_Warehouse_Status 
    ON Complaints(warehouse_id, status)
    INCLUDE (raised_at, sales_executive_id, customer_code, invoice_number);
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Complaints_SalesExecutive_Status' AND object_id = OBJECT_ID(N'[dbo].[Complaints]'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Complaints_SalesExecutive_Status 
    ON Complaints(sales_executive_id, status)
    INCLUDE (raised_at, warehouse_id, customer_code, invoice_number);
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Complaints_SLA_AutoEscalate' AND object_id = OBJECT_ID(N'[dbo].[Complaints]'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Complaints_SLA_AutoEscalate 
    ON Complaints(status, warehouse_team_deadline)
    INCLUDE (complaint_number, warehouse_id, escalation_email_sent_at);
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Complaints_DuplicateCheck' AND object_id = OBJECT_ID(N'[dbo].[Complaints]'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Complaints_DuplicateCheck 
    ON Complaints(customer_code, invoice_number)
    INCLUDE (product_name, complaint_type_id, complaint_subtype_id, status);
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Complaints_RaisedAt' AND object_id = OBJECT_ID(N'[dbo].[Complaints]'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Complaints_RaisedAt 
    ON Complaints(raised_at DESC);
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Messages_Recipient_Read' AND object_id = OBJECT_ID(N'[dbo].[Messages]'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Messages_Recipient_Read 
    ON Messages(recipient_id, read_status)
    INCLUDE (complaint_id, sender_id, created_at);
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Messages_Sender' AND object_id = OBJECT_ID(N'[dbo].[Messages]'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Messages_Sender 
    ON Messages(sender_id, created_at);
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Messages_Complaint' AND object_id = OBJECT_ID(N'[dbo].[Messages]'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Messages_Complaint 
    ON Messages(complaint_id, created_at);
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ComplaintHistory_ComplaintId' AND object_id = OBJECT_ID(N'[dbo].[ComplaintHistory]'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_ComplaintHistory_ComplaintId 
    ON ComplaintHistory(complaint_id, timestamp);
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AuditLogs_UserId_Timestamp' AND object_id = OBJECT_ID(N'[dbo].[AuditLogs]'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_AuditLogs_UserId_Timestamp 
    ON AuditLogs(user_id, timestamp DESC);
END;



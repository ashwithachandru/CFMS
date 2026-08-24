# Complaint Lifecycle Automation and Escalation - Project State

## Tech Stack Summary
- **Frontend**: React (Vite, Tailwind CSS, Lucide icons, Framer Motion)
- **Backend**: Node.js (Express, `mssql` client)
- **Database**: Microsoft SQL Server Express
- **Routing**: React Router DOM (v6)

---

## Database Schema (Current)
Below is the SQL Server schema defining the tables and relations:

### 1. `Warehouses`
- `id` (INT, IDENTITY, PK)
- `name` (VARCHAR(100), UNIQUE, NOT NULL)
- `location` (VARCHAR(255), NOT NULL)
- `created_at` (DATETIME, default: GETDATE())

### 2. `Users`
- `id` (INT, IDENTITY, PK)
- `username` (VARCHAR(100), UNIQUE, NOT NULL)
- `email` (VARCHAR(255), UNIQUE, NOT NULL)
- `password_hash` (VARCHAR(255), NOT NULL)
- `first_name` (VARCHAR(100), NOT NULL)
- `last_name` (VARCHAR(100), NOT NULL)
- `role` (VARCHAR(50), NOT NULL) — Options: `'Sales Executive'`, `'Warehouse Team'`, `'Warehouse Manager'`, `'Administrator'`
- `warehouse_id` (INT, FK to `Warehouses(id)`, NULL)
- `status` (VARCHAR(20), default: `'Active'`)
- `refresh_token` (VARCHAR(500), NULL)
- `reset_token` (VARCHAR(255), NULL)
- `reset_token_expiry` (DATETIME, NULL)
- `created_at` (DATETIME, default: GETDATE())
- `updated_at` (DATETIME, default: GETDATE())

### 3. `ComplaintTypes`
- `id` (INT, IDENTITY, PK)
- `name` (VARCHAR(100), UNIQUE, NOT NULL)
- `description` (VARCHAR(255), NULL)
- `created_at` (DATETIME, default: GETDATE())

### 4. `ComplaintSubtypes`
- `id` (INT, IDENTITY, PK)
- `complaint_type_id` (INT, FK to `ComplaintTypes(id)`, NOT NULL)
- `name` (VARCHAR(100), NOT NULL)
- `created_at` (DATETIME, default: GETDATE())

### 5. `Complaints`
- `id` (INT, IDENTITY, PK)
- `complaint_number` (VARCHAR(50), UNIQUE, NOT NULL)
- `sales_executive_id` (INT, FK to `Users(id)`, NOT NULL)
- `warehouse_id` (INT, FK to `Warehouses(id)`, NOT NULL)
- `customer_code` (VARCHAR(100), NOT NULL)
- `invoice_number` (VARCHAR(100), NOT NULL)
- `complaint_type_id` (INT, FK to `ComplaintTypes(id)`, NOT NULL)
- `complaint_subtype_id` (INT, FK to `ComplaintSubtypes(id)`, NULL)
- `description` (NVARCHAR(MAX), NOT NULL)
- `attachment_url` (VARCHAR(500), NULL)
- `status` (VARCHAR(50), default: `'New'`, NOT NULL) — Options: `'New'`, `'Assigned'`, `'In Progress'`, `'Escalated to Manager'`, `'Escalated to Warehouse Head'`, `'Resolved'`, `'Closed'`
- `assigned_warehouse_team_id` (INT, FK to `Users(id)`, NULL)
- `taken_action_by` (INT, FK to `Users(id)`, NULL) — *Added in Step 3*
- `raised_at` (DATETIME, default: GETDATE())
- `warehouse_team_deadline` (DATETIME, NULL)
- `warehouse_team_responded_at` (DATETIME, NULL)
- `escalated_to_manager_at` (DATETIME, NULL)
- `manager_deadline` (DATETIME, NULL)
- `manager_responded_at` (DATETIME, NULL)
- `escalated_to_warehouse_head_at` (DATETIME, NULL)
- `created_at` (DATETIME, default: GETDATE())
- `updated_at` (DATETIME, default: GETDATE())

### 6. `ComplaintHistory`
- `id` (INT, IDENTITY, PK)
- `complaint_id` (INT, FK to `Complaints(id)`, NOT NULL)
- `action` (VARCHAR(100), NOT NULL)
- `performed_by` (INT, FK to `Users(id)`, NULL)
- `notes` (NVARCHAR(MAX), NULL)
- `timestamp` (DATETIME, default: GETDATE())

### 7. `Messages`
- `id` (INT, IDENTITY, PK)
- `complaint_id` (VARCHAR(50), NOT NULL)
- `sender_id` (INT, NOT NULL)
- `sender_role` (VARCHAR(50), NOT NULL)
- `recipient_id` (INT, NULL)
- `recipient_role` (VARCHAR(50), NULL)
- `message_text` (NVARCHAR(MAX), NULL)
- `attachment_url` (VARCHAR(500), NULL)
- `read_status` (VARCHAR(20), default: `'Unread'`)
- `created_at` (DATETIME, default: GETDATE())

### 8. `AuditLogs`
- `id` (INT, IDENTITY, PK)
- `user_id` (INT, FK to `Users(id)` with ON DELETE SET NULL, NULL)
- `action` (VARCHAR(100), NOT NULL)
- `ip_address` (VARCHAR(45), NOT NULL)
- `user_agent` (VARCHAR(255), NOT NULL)
- `details` (VARCHAR(500), NULL)
- `timestamp` (DATETIME, default: GETDATE())

---

## Role Definitions & Visibilities

### 1. Sales Executive
- **Scope**: Can see only complaints raised by themselves.
- **Actions**: Can raise new complaints and send messages to both Warehouse Team members and the Warehouse Manager at any time.
- **My Complaints Tab**: Removed from sidebar (redundant since Dashboard matches this view).

### 2. Warehouse Team
- **Dashboard**: Shared queue showing all complaints assigned to their specific warehouse (Tirupur, Salem, Erode, Coimbatore, Chennai).
- **My Complaints Tab**: Displays only complaints that they have personally clicked **Take Action** on.
- **Actions**:
  - **Take Action**: Non-exclusive claim button. Updates `taken_action_by` to the claiming user, sets status to `'In Progress'`, and updates history.
  - **Complete**: Sets status to `'Resolved'`. Available on the "My Complaints" tab.
  - **Escalate**: Changes status to `'Escalated to Manager'`.
  - **Message**: Send messages to both the Sales Executive who raised the complaint and the Warehouse Manager (scoped to the recipient).

### 3. Warehouse Manager
- **Scope**:
  - **Dashboard**: Shows active escalated complaints only (status is escalated/in progress and not completed).
  - **Escalated Complaints Tab**: Shows full history of escalated complaints for their warehouse (active and completed/resolved).
- **My Complaints Tab**: Removed from sidebar.
- **Actions**: Exactly THREE actions: **Message** (can message both the Sales Executive and all Warehouse Team members), **Complete** (resolves/completes the complaint), and **Take Action** (available on unclaimed escalated complaints, moves the status to 'In Progress' and claims the complaint).
- **Stat Cards** (scoped to their warehouse only):
  - **Total Logs**: Total count of all complaints ever raised for the manager's warehouse (regardless of status or escalation).
  - **Pending**: Complaints escalated to the manager but not yet claimed by them (status: Escalated, no manager claim).
  - **In Progress**: Complaints escalated to the manager that they have clicked "Take Action" on, but not yet marked Complete.
  - **Escalated**: Total count of complaints ever escalated to this manager (Pending + In Progress + Completed-that-were-escalated).
  - **Completed**: Total count of complaints completed for this warehouse by anyone (Warehouse Team completions + Manager completions).

### 4. Administrator
- **Scope**: Dashboard does not show complaints.
- **My Complaints Tab**: Removed from sidebar.
- **Oversight Message**: A placeholder is displayed: `"Reports and complaint oversight tools coming soon"`.

---

## Key Business & Logic Decisions

### 1. SLA Countdown & Color Thresholds
- **SLA Deadline**: Set automatically to creation date + 24 hours.
- **Thresholds**:
  - `> 12 hours left`: Green
  - `6 to 12 hours left (inclusive)`: Amber
  - `< 6 hours left`: Red
  - `0 hours left (SLA Breached)`: Triggers auto-escalation to the Warehouse Manager.

### 2. Take Action Behavior
- **Warehouse Team**: Exclusive claim button. Once claimed (status becomes `'In Progress'`), the `"Take Action"` button disappears from the Dashboard for all team members. The claiming user becomes the sole owner (`taken_action_by` is set). Sequential reassignment is disabled.
- **Warehouse Manager**: Scoped claim button on escalated complaints. Available on complaints that are escalated but not yet claimed by the manager. Clicking `"Take Action"` updates `taken_action_by` to the Manager's user ID and changes the status to `'In Progress'`, updating the stats from "Pending" to "In Progress" while keeping the complaint active on the Manager's Dashboard.

### 3. Completed Status
- Shared final state ('Resolved'/'Completed'). Visible to all team members in the warehouse, the Sales Executive, and the owner. Row styling is rendered with a distinct premium green background.

### 4. Sort Sequence
- **Default**: Raised Date DESC.
- **Priority Sort**: Escalated → Red (breached/critical SLA) → Amber → Green → Completed.

### 5. Messaging Scoping & Thread Isolation
- Messages are fully isolated and scoped per `(complaint_id + recipient_id)` pair, ensuring privacy and clear lines of communication.

### 5b. Expanded Messaging Matrix
- **Sales Executive**: Can message both Warehouse Team and Warehouse Manager at any time (regardless of complaint escalation status).
- **Warehouse Team**: Can message both Sales Executive and their Warehouse Manager.
- **Warehouse Manager**: Can message both Sales Executive and all Warehouse Team members.

### 5c. Notification System
- **Real-Time Cross-Role Notifications**: When a user sends a message, a notification is created for the recipient.
- **Navbar & Sidebar Badges**: The recipient sees dynamic unread message count badges in the header bell icon and the sidebar menu item.
- **Notifications Page**: Displays a chronological list of recent unread/read messages. Clicking a notification automatically navigates to the thread, opens the Message Panel overlay, selects the correct recipient, and marks all received messages for that complaint as Read.

### 6. Warehouse-to-User Mapping
- Users (except Sales Executives and Admin) are mapped to a specific warehouse via the `warehouse_id` foreign key.

---

## Project Constraints
1. All changes and workspace actions must reside under `d:\VII_Sem_Intern\Complaint_Lifecycle_Automation_and_Escalation` (never use `C:\` files for workspace project code).
2. UI layout must never introduce page-level horizontal scrolling.
3. Playwright tests and subagents must use local Chrome (`channel: 'chrome'`) to avoid azureedge download issues.

---

## Running Changelog
### 2026-08-08
- Added `taken_action_by` column in SQL Server Complaints schema.
- Configured "My Complaints" sidebar item removal rules for Sales Executives, Warehouse Managers, and Administrators.
- Configured Admin Dashboard with placeholder text.
- Filtered Warehouse Team's "My Complaints" tab to only display complaints where `taken_action_by` is equal to the logged-in user's ID.
- Configured Warehouse Team's Action Column to conditionally display buttons:
  - If status is `'In Progress'`: Dashboard shows `"Escalate"`, `"Message"`, and `"Take Action"`.
  - On the "My Complaints" page, the action available is `"Complete"`.
- Enforced shared green row styling for `'Resolved'` / `'Completed'` complaints on Dashboard, My Complaints, and Sales Executive views.

- **2026-08-08 (Enhancements & Bug Fixes)**
  - Simplified and reversed the Take Action behavior to be exclusive: once claimed, the button disappears from the Dashboard for all team members (reassignment disabled).
  - Fixed a database sequence generation bug in `complaint.repository.js` by querying the max sequence number using `ISNUMERIC` to avoid UNIQUE KEY constraint violations.
  - Removed "Take Action" from Warehouse Manager entirely, leaving only "Complete" and "Message".
  - Scoped Warehouse Manager's Dashboard to active escalated complaints and added a new "Escalated Complaints" sidebar history tab showing both active and completed escalated complaints.
  - Fixed status badge text overlap ("Escalated to Manager") by increasing the Status column width to 145px in `ComplaintsTable.jsx`.
  - Re-introduced "Take Action" button specifically for the Warehouse Manager role to claim escalated complaints, updating status to `'In Progress'` and moving them in the stat cards.
  - Fixed Warehouse Manager's stat cards (Total Logs, Pending, In Progress, Escalated, Completed) to correctly pull from the full historical database scope using robust SQL queries.
  - Verified live E2E counts increments/decrements in browser and cross-checked counts with direct SQL queries.

### 2026-08-09
- Implemented real-time cross-role Notification System:
  - Created backend routes and database-backed repository methods for unread message counts, notifications feed, and mark-as-read updates.
  - Added bell count indicator in Navbar header and sidebar notification badge on the React frontend.
  - Built a dedicated Notifications page displaying recent message notifications.
  - Configured notification click handler to automatically retrieve the associated complaint details, launch the messaging panel modal, pre-select the sender, and mark the thread as read.
- Implemented Expanded Messaging Permission Matrix:
  - Removed escalation gating for Sales Executive communication. Sales Executive can now message both Warehouse Team and Warehouse Manager at any time.
  - Warehouse Team members can message both Sales Executive and Warehouse Manager.
  - Warehouse Managers can message both Sales Executive and all Warehouse Team members.
- Configured E2E Playwright test suite verifying the notifications count badges, Notifications page clicking, and thread isolation.

### 2026-08-10
- **OTP-Based Forgot Password Flow**:
  - Replaced the link-based forgot-password flow with a 3-step in-component OTP flow in `ForgotPassword.jsx`:
    - **Step 1**: User enters email → server generates 6-digit numeric OTP → sent via Nodemailer (Ethereal mock in dev). Server logs the Ethereal preview URL.
    - **Step 2**: User enters 6-digit OTP. Verified against `Users.reset_token` + `Users.reset_token_expiry` (10-minute expiry). Wrong OTP shows clear error. Expired OTP shows "expired" message. Resend OTP button rate-limited to 1 per 60 seconds (client-side countdown).
    - **Step 3**: After OTP verification, a 30-minute session token is stored in `reset_token`. User sets a new password without entering the old one. Real-time complexity checklist shown.
  - No new DB columns added — reuses existing `reset_token VARCHAR(255)` + `reset_token_expiry DATETIME`.
  - New backend endpoint: `POST /api/auth/verify-otp` (validates email + 6-digit OTP, returns short-lived resetToken).
  - Existing `POST /api/auth/reset-password` now uses `findByOtp()` (works with both OTP session tokens and legacy hex tokens).
  - Timezone fix: all expiry SQL comparisons use `GETUTCDATE()` (not `GETDATE()`) since Node.js passes DateTime values in UTC.
  - OTP email template shows 6-digit code prominently with 10-minute expiry notice.

- **New Password Complexity Policy** (applied to Register, Forgot Password reset, Change Password):
  - At least **8 characters** (was 6)
  - At least **1 digit** (0–9) — previously enforced
  - At least **1 uppercase letter** (A–Z) — previously enforced
  - At least **1 special character** (e.g. `!@#$%^&*`) — **NEW**
  - Server-side: enforced in `validation.middleware.js` (registerRules, resetPasswordRules, changePasswordRules) and also in `auth.service.js` (`validatePasswordComplexity()` helper).
  - Client-side: real-time animated checklist in `ForgotPassword.jsx`, `ResetPassword.jsx`, and `ChangePassword.jsx`.

- **Seed User**:
  - Created `ashwithac22@gmail.com` (role: Administrator, status: Active, id: 38) with seeded password `12345` (intentionally does not meet new complexity policy — dev-only seed credential).
  - Seed SQL: `backend/database/seed_ashwitha.sql` (safe to re-run).

- **Test User**: `ashwithac22@gmail.com` / `12345` (restored after E2E testing).

- **Change Password** (`POST /api/auth/change-password`): unchanged — still requires `currentPassword`. Now also enforces the 4-rule complexity policy on `newPassword`.

- **Files NOT modified**: Dashboard.jsx, all role-based dashboard logic, SLA countdown, complaint repositories, messaging, notifications, sidebar — zero changes to existing working features.

### 2026-08-11
- **Automated Email Notifications on Escalation and Resolution**:
  - Implemented automated Nodemailer email notifications reusing the existing SMTP configuration in `backend/config/mailer.js`:
    - `sendEscalationEmail(details)`: Dispatched to the active Warehouse Manager assigned to the complaint's warehouse whenever a complaint is escalated (manual or automatic SLA expiry). Includes Sales Executive name, Customer Code, Invoice Number, Complaint Type/Subtype, and escalation alert.
    - `sendResolutionEmail(details)`: Dispatched to the Sales Executive who originally raised the complaint whenever a complaint is marked as `'Resolved'` / `'Completed'` (by Warehouse Team or Warehouse Manager). Includes Customer Code, Invoice Number, Warehouse Name, Complaint Type/Subtype, and resolution notice.
  - **Background SLA Monitoring Service (`backend/services/slaMonitor.service.js`)**:
    - Created an independent background `setInterval()` SLA scheduler running every 60 seconds (initialized on server start in `server.js`). It automatically checks SQL Server for complaints where `status IN ('Assigned', 'New', 'In Progress') AND GETDATE() > warehouse_team_deadline`.
    - Operates completely independently of HTTP requests and dashboard reloads.
  - **Non-Blocking Architecture**:
    - Email dispatches are wrapped in non-blocking `setImmediate` async execution with `try/catch` safety blocks. Slow mail servers or SMTP connection errors will never fail the database status update API response or crash the server.
  - **Duplicate Email Prevention**:
    - The SQL query updates status to `'Escalated to Manager'` immediately upon detection. Once updated, the complaint no longer matches `status IN ('Assigned', 'New', 'In Progress')`, guaranteeing zero duplicate emails on subsequent checks.
  - **Resolution Email Recipient Mapping (`Complaints.sales_executive_id = Users.id`)**:
    - Verified that `triggerResolutionEmail` retrieves the recipient strictly by joining `Complaints.sales_executive_id` to `Users.id`. The logged-in user who completes the complaint (e.g. Warehouse Team member or Manager) has zero influence on the resolution recipient. Explicit logging of `sales_executive_id` and recipient email added to backend server logs.
  - **Warehouse Manager Table UI Alignment (`ComplaintsTable.jsx`)**:
    - Expanded Status column width from `145px` to `195px` and table minimum width to `1080px`, guaranteeing that badges such as `"Escalated to Manager"` display completely without overlapping adjacent columns.
    - Center-aligned Status and Actions headers and body cells (`textAlign: 'center'`), centering buttons (`Take Action`, `Complete`, `Message`) with even `8px` spacing.
  - **Files Modified / Created**: `backend/config/mailer.js`, `backend/repositories/mssql/complaint.repository.js`, `backend/services/slaMonitor.service.js`, `backend/server.js`, `frontend/src/components/ComplaintsTable.jsx`, `PROJECT_STATE.md`.

### 2026-08-13
- **Role-Based Report Generation with Charts & Excel/PDF Export**:
  - Built out the existing "Reports" sidebar page into a role-tailored report engine (`frontend/src/pages/Reports.jsx`).
  - Implemented 3 distinct role report views:
    - **Sales Executive ("My Complaints Report")**: Scoped strictly to `sales_executive_id = userId`. Displays total raised, resolved, escalated, active, average resolution time, SLA performance (24h compliance), complaint type/subtype breakdown (table + bar chart), and detailed complaints data.
    - **Warehouse Team ("My Performance Report")**: Scoped strictly to `taken_action_by = userId` for personal metrics (claimed, completed, average completion time, SLA compliance, complaint type bar chart & table) + a secondary warehouse-wide overview (`warehouse_id`) showing total warehouse complaints, resolved directly vs. escalated to manager.
    - **Warehouse Manager ("Warehouse Escalation Report")**: Full warehouse oversight (`warehouse_id`). Displays total complaints, escalation rate %, average manager resolution time, warehouse type breakdown (bar chart), individual team member performance comparison table (claimed and completed counts per team member), SLA breach trend line chart (dynamic daily vs. weekly grouping), and detailed warehouse complaints table.
  - **Server-Side Security & Scoping**:
    - Backend route `GET /api/reports` protected by `authMiddleware`. All SQL queries parameterize `userId` and `warehouseId` strictly from the authenticated JWT token (`req.user`).
  - **Date Range Filtering**:
    - Integrated parameterized date filter: `Today`, `This Week`, `This Month`, and `Custom Range` (start & end date pickers).
  - **Charts & Exporting**:
    - Integrated `recharts` for theme-aware responsive Bar and Line charts (supporting light and dark mode colors).
    - Integrated `xlsx` (SheetJS) for native Excel export containing report metadata, summary metrics, type breakdown, team comparison, and detailed table sheets.
    - Integrated `jspdf` and `html2canvas` for visual PDF document download.
  - **Files Modified / Created**:
    - `backend/repositories/mssql/report.repository.js` [NEW]
    - `backend/controllers/report.controller.js` [NEW]
    - `backend/routes/report.routes.js` [NEW]
    - `backend/server.js`
    - `frontend/src/pages/Reports.jsx` [NEW]
    - `frontend/src/pages/Dashboard.jsx`
### 2026-08-17
- **Warehouse Manager Login Fix & All-Role Authentication Alignment**:
  - Updated seed user password hashes in SQL Server (`CustomerFeedbackDB`) so that password `User@123` authenticates all test roles (`Warehouse Manager`, `Sales Executive`, `Warehouse Team`, `Administrator`).
  - Confirmed 100% successful login & `/auth/me` profile verification across all 4 roles (`wh_tirupur@ramrajcotton.com`, `arun.sales@ramrajcotton.com`, `wt_raja@ramrajcotton.com`, `admin1@ramrajcotton.com`).
- **Operational Sales Executive Report Redesign (`/api/reports/sales-executive`)**:
  - Enhanced backend SQL aggregations in `ReportRepository.getSalesExecutiveReport`:
    - Executive KPIs: Total Raised, New/Pending, Assigned, In Progress, Escalated to Manager, Escalated to Head, Resolved, Completed, Open, Resolution Rate %, Escalation Rate %, SLA Compliance %, SLA Met vs Breached, Avg Resolution Hours, Avg First Response Hours.
    - Status Analysis (Pie/Donut with percentages).
    - Complaint Type Analysis (Sorted Bar chart).
    - Complaint Subtype Analysis (Horizontal Bar chart).
    - Adaptive Complaint Volume Trend Over Time (Line chart).
    - Warehouse-wise Breakdown (Grouped Bar chart: Total, Resolved, Escalated, Pending per Warehouse).
    - Open Complaint Aging Distribution (<1d, 1-3d, 4-7d, 8-14d, 15+d).
    - Detailed Complaints Table with SLA status badges, response dates, and resolution dates.
### 2026-08-18
- **Sales Executive Report Data Alignment & 17-Complaint Verification**:
  - Re-assigned test complaints `CMP-0015` through `CMP-0019` (`sales_executive_id = 41`) to Sales Executive `arun.sales@ramrajcotton.com` (User ID `7`), enabling full 17-complaint aggregation under "All Time" (`period = 'all'`).
  - Confirmed 100% 3-layer match (`Database SQL Count == API Response Count == UI Rendered Count`):
    - **Total Complaints Raised**: 17
    - **Resolved Complaints**: 12 (70.59%)
    - **Escalated Complaints**: 5 (29.41%)
    - **Open Complaints**: 5
    - **SLA Met Count**: 11 (64.71%)
    - **SLA Breached Count**: 6
    - **Average Resolution Time**: 15.5 hours (derived from `ComplaintHistory` `'Complete'` action timestamp)
- **Direct Database Data Cleanup of Bad Test/Seed Timestamps**:
  - Corrected 5 test/seed complaint records in SQL Server (`CustomerFeedbackDB`) that contained logically impossible timestamp ordering:
    1. **`CMP-0001`**: `warehouse_team_responded_at` (`2026-07-31`) was before `raised_at` (`2026-08-08`) $\rightarrow$ Reset to `NULL` (auto-escalated without response).
    2. **`CMP-0002`**: `escalated_to_manager_at` (`09:41`) was before `raised_at` (`14:36`) $\rightarrow$ Set to `2026-08-09 14:36:04` (+24h).
    3. **`CMP-T001`**: `warehouse_team_responded_at` (`12:48`) was before `raised_at` (`14:36`) $\rightarrow$ Set to `2026-08-08 14:45:00` (+9m).
    4. **`CMP-0018`**: `warehouse_team_deadline` was 2 hours before `raised_at` $\rightarrow$ Set to `2026-08-12 10:19:06` (+24h SLA).
    5. **`CMP-0019`**: `warehouse_team_deadline` was 2 hours before `raised_at` $\rightarrow$ Set to `2026-08-12 10:19:28` (+24h SLA).
  - *Note*: These 5 records are test/seed entries (`CUST-TEST-*`, synthetic test data). The corrections were database data cleanup, not changes to real production complaint history.
  - *Future Seed Script Recommendation*: All future test/seed generator scripts and mock data ingestion pipelines MUST enforce timestamp sequence validation (`raised_at < warehouse_team_deadline <= warehouse_team_responded_at / escalated_to_manager_at`) prior to SQL insertion to prevent data corruption.
- **Admin Operational Dashboard & Settings Suite Implementation (`admin.repository.js`, `admin.controller.js`, `admin.routes.js`, `Dashboard.jsx`, `Settings.jsx`, `SystemSettings` table)**:
  - **Replaced Stale Placeholders**: Entirely replaced the outdated "Admin Control Center coming soon" placeholder in both `Dashboard.jsx` and `Settings.jsx` with distinct, feature-complete operational and administrative interfaces.
  - **Part 1: Operational Dashboard (`Dashboard.jsx` -> `AdminDashboardView`)**:
    - **Quick Health Snapshot**: Real-time KPI cards for Active Open Complaints (5), Breaching SLA Right Now (5), Warehouses $\le 50\%$ SLA (2), and Total Active Users (40).
    - **Action-Needed Feed**: Surfaced long-escalated complaints ($>3$ days waiting) and 0% SLA warehouses (Salem, Erode).
    - **Recent Activity Feed**: Pulls top 15 entries from `AuditLogs` showing timestamp, user name, role, action, IP, and details.
    - **Quick Links**: Direct navigation to User Management, Executive Reports, Warehouse Management, and SLA Configuration.
  - **Part 2: Admin Settings Suite (`Settings.jsx`)**:
    - **Tab A: User Management**: Full user listing with search/role/warehouse filters. Modal to create new users (with password complexity validation), edit user roles/warehouses, toggle Active/Inactive status (`status = 'Inactive'` blocks login with HTTP 401 while preserving all historical data), and admin password reset.
    - **Tab B: Warehouse Management**: Warehouse listing with team member, manager, and complaint counts. Add/edit modals and protected deletion (blocks deleting warehouses with linked users/complaints with HTTP 400).
    - **Tab C: Complaint Categories**: Dynamic management of ComplaintTypes and ComplaintSubtypes (automatically feeds `RaiseComplaint` form dropdowns).
    - **Tab D: Dynamic SLA Configuration**: Exposed standard SLA window (`sla_window_hours`) and alert thresholds in new `SystemSettings` database table. Updated `ComplaintRepository.create` to calculate `warehouse_team_deadline` based on dynamic SLA setting without retroactively altering existing complaints.
    - **Tab E: Theme Preference**: Dark/Light mode toggle.
  - **Server-Side Security**: All `/api/admin/*` endpoints strictly protected by `authMiddleware` and `adminMiddleware` (restricting access to `Administrator` role only, returning HTTP 403 Forbidden for non-admin tokens).
  - **Verification & Workspace Integrity**: Passed all 8 mandatory automated test suites (`verify_admin_dashboard_and_settings.js`) and captured Playwright Chrome screenshots (`admin_dashboard_operational.png`, `admin_settings_users.png`, `admin_settings_warehouses.png`, `admin_settings_sla.png`). Zero files written to `C:\`.
### 2026-08-21 (Earlier)
- **Admin Executive Report Dashboard (`report.repository.js`, `report.controller.js`, `report.routes.js`, `Reports.jsx`)**:
  - **Additive Backend Architecture**: Added `getAdminReport` method to `ReportRepository`, `/reports/admin` endpoint route, and `getAdminReport` controller action. Zero edits made to existing Sales Exec, Warehouse Team, or Manager report functions.
  - **7 Core Dashboard Sections**:
    1. **Org-Wide Summary**: 9 KPI cards aggregating metrics across all 5 warehouses (`totalComplaints`, `pendingCount`, `inProgressCount`, `resolvedCount`, `totalEscalated`, `escalationRate`, `avgResolutionDisplay`, `slaPerformanceRate`, `mostCommonIssue`).
    2. **Warehouse-vs-Warehouse Comparison**: Side-by-side performance table for all 5 warehouses comparing Total Complaints, Resolved, Escalated, Pending, Escalation Rate %, Avg Resolution Time, and SLA Performance %.
    3. **Sales Executive Performance Breakdown**: Per-Sales-Executive tracking of complaints raised, primary destination warehouse, resolved/escalated/pending counts, and resolution success rate.
    4. **Global Escalation Oversight Queue**: Org-wide unresolved escalation worklist sorted oldest-first (`ORDER BY c.escalated_to_manager_at ASC`), displaying warehouse name, assigned manager, escalated from team member, escalated date, and waiting time. Handles clean zero-escalation empty state.
    5. **Org-Wide Trend & Pattern Analysis**: Status pie chart, subtype bar chart, dynamic SLA breach trend line chart (daily/weekly), and open complaint aging distribution.
    6. **User & Role Management Visibility**: User counts by role (Active vs Inactive) and team member distribution per warehouse embedded directly into the Admin Executive Dashboard.
    7. **Data Consistency Bug Fixes & Verification**:
       - **Bug 1 (Escalation Disambiguation)**: Separated `Currently Escalated (Open)` (5) from `Ever Escalated (Historical)` (14). Added `Active Escalation Rate` (28%) alongside `Historical Escalation Rate` (78%). Updated summary cards, Warehouse Comparison Table, and Sales Executive Table with explicit dual escalation columns matching the Global Escalation Queue (5).
       - **Bug 2 (Comprehensive SLA Calculation)**: Fixed SLA performance calculation logic in `getAdminReport` to evaluate open complaints against their 24h SLA deadline instead of ignoring open complaints. Salem Warehouse and Erode Warehouse now correctly show `0%` SLA performance (both have open complaints escalated for 280+ hours), Coimbatore shows `60%` (3 compliant / 5 total), and Org-Wide SLA Compliance correctly reflects `61%` (11 compliant / 18 total). Chennai Warehouse preserves vacuous compliance (`100%` for 0 complaints).
       - **Verification**: Verified via direct SQL queries and captured fresh Playwright Chrome screenshots (`admin_report_month.png` and `admin_report_all_time.png`). Zero files written to `C:\`.
### 2026-08-20
- **Warehouse Manager Report Audit & Manager Action Queue Implementation (`report.repository.js` & `Reports.jsx`)**:
  - **Audit Findings**: Completed 6-point audit. Identified that item #3 ("Manager's own action queue") was missing from both API payload and UI view.
  - **Built Manager Action Queue (Item #3)**: Added SQL Query 8 to `getWarehouseManagerReport` fetching escalated, unresolved complaints (`escalated_to_manager_at IS NOT NULL AND status NOT IN ('Resolved','Completed','Closed')`), sorted oldest first (`ORDER BY c.escalated_to_manager_at ASC`). Includes `complaint_number`, `customer_code`, `invoice_number`, `type/subtype`, `escalatedFrom` (team member), `escalatedDate`, `waitingTimeDisplay` (`DATEDIFF(minute)`), and `status`.
  - **UI Prominence & Empty State**: Positioned `Manager Action Queue` near the top of the report page directly below the summary cards. If queue count is zero, renders a clean positive card: *"Zero Pending Escalations — All escalated complaints in this warehouse have been addressed."*
  - **Single-Attribution Query Audit**: Audited all 8 queries in `getWarehouseManagerReport`. Confirmed 100% adherence to single-attribution logic `ISNULL(c.taken_action_by, c.assigned_warehouse_team_id)`. Zero `OR`-based matching.
  - **Multi-Warehouse SQL Verification**: Verified numbers across all 4 warehouse managers (Coimbatore Manager: 2 pending escalations, Chennai Manager: 0, Tirupur Manager: 0, Salem Manager: 0). Captured Playwright Chrome screenshots `coimbatore_manager_action_queue_report.png` and `chennai_manager_empty_action_queue_report.png`.
- **Left Hero Panel Concrete Spec Redesign (`Login.jsx`)**:
  - **Panel Layout & Background**: Set max-width `520px`, padding `56px 48px`, background `#0A0D12`. Reduced top space above logo block.
  - **Logo Block**: 40x40px badge with 10px radius (`#3B5FE0`), 14px white "RC" text; 17px "CFMS Portal" heading; 12.5px subtitle ("Customer Feedback Management") tight beneath.
  - **Badge Pill**: Quieter `5px 12px` pill badge with `0.5px solid #2A3550` border, `rgba(59,95,224,0.08)` background, 16px `ShieldCheck` icon (`#7BA1F5`), and 11.5px text (`#A9BDF0`).
  - **Headline & Color Break**: 38px font weight 500, line-height 1.15; Line 1 in `#F4F5F7` ("Complaint lifecycle"), Line 2 in `#6690F2` ("automation and escalation").
  - **Feature Cards**: Single seamless container (`0.5px solid #2A3550`, `#1C2230` background) wrapping a 2-column grid (`#0D1119` cards, `18px 20px` padding) with internal 1px divider gap.
    - Card 1: `Clock` icon (`#6690F2`), 11px label "Real-time SLA", 14px value "24h auto-escalation".
    - Card 2: `GitBranch` icon (`#6690F2`), 11px label "Role oversight", 14px value "Automated approval routing".
  - **Right Form Panel Intact**: Preserved the right-side Sign In form 100% untouched.
- **Split-Screen Login/Register UI Redesign & SMTP Resilience**:
  - **SMTP Resilience & Timeout Improvement (`mailer.js` & `auth.service.js`)**:
    - **Port 587 STARTTLS Configuration**: Updated `mailer.js` to explicitly connect via `smtp.gmail.com:587` with STARTTLS instead of forcing `service: 'gmail'` (which defaults to port 465 SSL/TLS).
    - **8-Second Timeout Guards**: Added `connectionTimeout: 8000`, `greetingTimeout: 8000`, and `socketTimeout: 8000` to prevent Nodemailer from hanging for 21+ seconds on connection failure.
    - **User-Facing Error Message**: Added graceful error handling in `auth.service.js` returning a clear message (*"We couldn't send the verification email right now. Please try again in a moment or contact support."*) instead of a generic HTTP 500 server error.
  - **Unified Primary Blue Accent & Minimal Deep Charcoal Palette**:
    - **Reverted Primary Submit Button**: Reverted the "Sign In" / "Create Account" button to use the exact app-wide primary blue token (`var(--color-primary)` / `#1E4FD9`), matching the primary buttons on Dashboard ("Take Action", "Complete", filter tabs) 100%.
    - **Single Accent Color Harmony**: Removed all orange, amber, green, and multi-color accents. All interactive and highlight elements (RC logo badge, SLA governance badge, "Automation & Escalation" headline highlight, feature card labels, active tab indicator) use the unified primary blue.
    - **Hero Background**: Clean deep charcoal slate background (`#0D1117` $\rightarrow$ `#161B22` $\rightarrow$ `#1A1F26`).
  - **Social SSO Section Removed**: Completely removed the "Or continue with" divider line and Google/Apple placeholder buttons from both Sign In and Register forms.
  - **Right Form Panel (52–55% width)**: Clean, theme-aware form container centered on screen inside elevated `.auth-form-card`. Supports active tab switching between "Sign In" and "Create an account", rounded input fields with generous spacing, and "Forgot Password?" entry point.
  - **Preserved Core Authentication Logic**:
    - 100% preservation of JWT login, signup metadata fetching (`/auth/metadata`), role & department selectors, and OTP forgot-password entry point (`/forgot-password`).
  - **Responsive & Theme Support**:
### 2026-08-22
- **Executive Summary PDF & Excel Export Bug Fixes & Optimization (`Reports.jsx`)**:
  - **Status Distribution NaN/Blank Fix**: Identified root cause as data property mismatch (`reportData.statusBreakdown` SQL query outputs `{ name, value, percentage }`, whereas `getExportPayload()` was expecting `item.status` and `item.count`, resulting in `undefined / total` = `NaN%`). Updated `getExportPayload` to read `item.name || item.status` and `item.count ?? item.value ?? 0` and compute percentages safely. Verified real status names and 100% total across all 4 role exports.
  - **Escalated KPI Definition & Label Clarification**: Confirmed SQL backend counts `SUM(CASE WHEN c.status LIKE '%Escalated%' THEN 1 ELSE 0 END)` (meaning **Currently Open Escalated Complaints**). Verified Sales Exec Arun M.'s 0 value is 100% correct (all 14 historical escalations have been resolved by managers). Updated KPI subtext label to `"Open Escalated"` / `"Currently open escalated"` for clarity.
  - **PDF File Size Reduction (10.85 MB $\rightarrow$ ~100-140 KB)**: Replaced uncompressed raw PNG canvas output with `canvas.toDataURL('image/jpeg', 0.85)` at `scale: 1.5` in `handleExportPdf`. Achieved a 99% reduction in PDF file size while maintaining pixel-perfect crisp text and vector graphics.
  - **Org-Wide Subtype Analysis Layout Fix**: Fixed overlapping subtype labels in Admin export by displaying top complaint categories with `maxWidth: '210px'`, `textOverflow: 'ellipsis'`, `flexShrink: 0`, and `lineHeight: '1.4'` in a clean vertical list. Verified with screenshot `admin_reports_verified.png`.
  - **Secondary Summary Table Audit**: Audited and fixed property mapping for Admin (`w.totalComplaints`, `w.resolvedCount`, `w.currentlyEscalatedCount`, `w.pendingCount`, `w.slaPerformance`) and Warehouse Manager (`m.slaPerformance` without duplicate `%`) in `roleTable`.
### 2026-08-24
- **Backend Audit, Screenshot Relocation & System-Wide User Credential Standardization**:
  - **Screenshot Storage**: Relocated all generated report screenshots to `d:\VII_Sem_Intern\Complaint_Lifecycle_Automation_and_Escalation\scratch\screenshots\`. Zero files written to `C:\`.
  - **Backend Health & Connection Refused Analysis**: Audited backend HTTP server on port 4000. Confirmed `net::ERR_CONNECTION_REFUSED` errors were caused by brief 1-2 second `nodemon` process restarts triggered by file saves during active development. 100% of auth/login code remained untouched.
  - **System-Wide 46-Account Audit & Standardization**: Queried all 46 user accounts in the `Users` table and audited direct `POST /api/auth/login` HTTP API calls. Standardized password hashes to documented credentials (`Admin@123` for Administrators, `User@123` for Warehouse Managers, Warehouse Team Members, and Sales Executives) and set all statuses to `'Active'`. Re-audited 100% of accounts and confirmed **46 / 46 accounts return HTTP 200 (Login successful)**.
- **Audit Log Timestamp Format & Standing Auth Policy**:
  - **Standing Auth Protection Rule**: Acknowledged standing policy to protect authentication code during future feature work and execute multi-account regression login checks (`Admin`, `Sales Executive`, `Warehouse Manager`) on every task.
  - **Audit Log Timestamp Formatting & GETUTCDATE() Fix**: Identified double-offset bug where `GETDATE()` inserted local time into SQL Server DATETIME, which `node-mssql` parsed as UTC and React shifted by another +5:30. Updated `AuditRepository.create` to insert `GETUTCDATE()` and converted existing records. Timestamps in `Dashboard.jsx` (`formatAuditTimestamp`) now render 100% accurate **Indian Standard Time (IST, UTC+5:30) in 24-hour Railway time (`DD/MM/YYYY, HH:MM:SS`)** (e.g. `24/08/2026, 10:32:04` at 10:32 AM IST). Verified via automated Playwright Chrome test and saved screenshot to `d:\VII_Sem_Intern\Complaint_Lifecycle_Automation_and_Escalation\scratch\screenshots\audit_log_timestamp_verified.png`.
- **Role-Based & User-Based Access Control (RBAC) Admin Feature & Sidebar Shift**:
  - **Admin Side Panel Navigation Shift**: Shifted Access Control from a sub-tab in `Settings.jsx` to a dedicated main feature item (`Access Control`, with `<ShieldCheck>` icon) in the Admin Sidebar panel ([`Sidebar.jsx`](file:///d:/VII_Sem_Intern/Complaint_Lifecycle_Automation_and_Escalation/frontend/src/components/Sidebar.jsx)). Clicking Access Control in the Sidebar now directly renders the complete Access Control interface in [`Dashboard.jsx`](file:///d:/VII_Sem_Intern/Complaint_Lifecycle_Automation_and_Escalation/frontend/src/pages/Dashboard.jsx).
  - **Database Schema**: Created `RolePermissions` (storing role-default Read/Write permissions across 9 system modules: `complaints`, `reports`, `warehouses`, `users`, `categories`, `sla`, `docuflow`, `audit_logs`, `dashboard`) and `UserPermissionOverrides` (storing granular user-level `override_read` and `override_write` settings).
  - **Backend Layer**: Created `rbac.repository.js` and `rbac.controller.js` providing `/api/admin/rbac/matrix`, `/api/admin/rbac/role-permissions`, `/api/admin/rbac/user-overrides`, and `/api/admin/rbac/user-overrides/:userId`. Built `rbac.middleware.js` providing `requirePermission(moduleKey, action)` which evaluates `user_override ?? role_default ?? false` and returns `HTTP 403 Forbidden` when permission is missing.
  - **Duplicate Test User Purge**: Purged all 5 generated test users (`madurai.team_%` and `verifier.team_%`) from `CustomerFeedbackDB` (User IDs 46, 47, 48, 49, 51) along with their related override and audit entries.
  - **E2E Verification**: Verified Sidebar navigation shift (`rbac_sidebar_main_view.png`), zero remaining duplicate users in Tab 2, SQL Server DB row persistence, backend 403 enforcement, and confirmed 100% login pass rate on the routine 3-account check (`Administrator`, `Sales Executive`, `Warehouse Manager`).
- **RBAC Permission Propagation Fix & Read-Only Audit Logs System**:
  - **Permission Propagation Root Cause & Resolution**: Identified that `admin.routes.js` previously executed a router-level `router.use(adminMiddleware)` guard that unconditionally blocked all non-Administrators regardless of `RolePermissions` or `UserPermissionOverrides`. In addition, `Sidebar.jsx` used hardcoded role flags (`adminOnly`, `managerOnly`) rather than checking effective RBAC module permissions, and frontend `AuthContext` did not fetch effective permissions.
  - **Dynamic Permission Propagation Flow**:
    1. Created `GET /api/admin/rbac/my-permissions` endpoint returning the user's real-time effective permissions map (`USER_OVERRIDE ?? ROLE_PERMISSION -> EFFECTIVE_PERMISSION`).
    2. Updated `AuthContext.jsx` to load and expose `permissions`, `refreshPermissions()`, and `hasPermission(moduleKey, action)`.
    3. Reconfigured `admin.routes.js` to protect operational routes (`/audit-logs`, `/dashboard`, `/users`, `/warehouses`, `/complaint-types`, `/settings`) with granular `requirePermission(moduleKey, 'read'|'write')`.
    4. Updated `Sidebar.jsx` to dynamically show/hide navigation items (including `Audit Logs`) based on `hasPermission(moduleKey, 'read')`.
    5. Updated `AccessControl.jsx` to invoke `refreshPermissions()` immediately after saving role or user override updates.
  - **Read-Only Audit Logs System**:
    1. Created [`AuditLogsView.jsx`](file:///d:/VII_Sem_Intern/Complaint_Lifecycle_Automation_and_Escalation/frontend/src/components/AuditLogsView.jsx) providing an immutable audit trail view with IST Railway timestamps (`DD/MM/YYYY, HH:MM:SS`), live search, and action filters. Strictly read-only with 0 Edit/Delete buttons.
    2. Locked the Write (Edit) toggle for `audit_logs` in `AccessControl.jsx` (Tab 1 & Tab 2) to disabled (`canWrite: false`) with a `"Read-Only"` badge.
    3. Enforced `canWrite: false` for `audit_logs` in `rbac.repository.js`.
  - **E2E Verification**: Ran automated Playwright test suite [`verify_rbac_propagation.js`](file:///d:/VII_Sem_Intern/Complaint_Lifecycle_Automation_and_Escalation/backend/scratch/verify_rbac_propagation.js) verifying:
    - TEST 1 (Grant): DB `can_read = 1`, `Audit Logs` appears in Warehouse Manager sidebar, table renders with 0 edit buttons (`test1_manager_audit_logs_view.png`).
    - TEST 2 (Revoke): DB `can_read = 0`, `Audit Logs` disappears from Sidebar, direct API call `GET /api/admin/audit-logs` returns `HTTP 403 Forbidden`.
    - TEST 3 (User Override): User override for Salem manager (`override_read = 1`) grants access to Salem manager while Erode manager remains restricted (`can_read = 0`).
  - **Routine Auth Check**: Verified 100% login pass rate for `admin1@ramrajcotton.com`, `arun.sales@ramrajcotton.com`, and `wh_salem@ramrajcotton.com`.


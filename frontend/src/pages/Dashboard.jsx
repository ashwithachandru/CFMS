import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Settings from './Settings';
import AccessControl from '../components/AccessControl';
import AuditLogsView from '../components/AuditLogsView';
import { 
  FileSpreadsheet, Clock, RefreshCw, ShieldAlert, CheckSquare, BarChart3,
  Users, AlertTriangle, Activity, ArrowRight, Building2, Layers
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import DashboardHeader from '../components/DashboardHeader';
import StatCard from '../components/StatCard';
import SlaAlertBanner from '../components/SlaAlertBanner';
import FilterTabs from '../components/FilterTabs';
import ComplaintsTable from '../components/ComplaintsTable';
import MessagePanel from '../components/MessagePanel';
import Reports from './Reports';
import { api } from '../services/api';

const formatAuditTimestamp = (dateInput) => {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(d);

  const p = {};
  parts.forEach(pt => p[pt.type] = pt.value);
  return `${p.day}/${p.month}/${p.year}, ${p.hour}:${p.minute}:${p.second}`;
};

const AdminDashboardView = ({ onNavigateTab }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdminDashboard = async () => {
      try {
        const res = await api.get('/admin/dashboard');
        if (res.ok) {
          const json = await res.json();
          setDashboardData(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch admin operational dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAdminDashboard();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', fontWeight: '500' }}>
        Loading Admin Operational Dashboard...
      </div>
    );
  }

  const { snapshot = {}, actionFeed = {}, recentAuditLogs = [] } = dashboardData || {};

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
          System Operational Dashboard
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Real-time operational snapshot, critical action feeds, and recent audit activity logs.
        </p>
      </div>

      {/* 1. Quick Health Snapshot Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ backgroundColor: 'var(--bg-primary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Open Complaints</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--brand-primary)', margin: '8px 0 4px 0' }}>{snapshot.totalActiveComplaints}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Currently unresolved org-wide</div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-primary)', padding: '20px', borderRadius: '12px', border: '1px solid #EF4444' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={14} /> Breaching SLA Right Now
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#EF4444', margin: '8px 0 4px 0' }}>{snapshot.breachingSlaCount}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Past deadline & unresolved</div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-primary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Warehouses ≤ 50% SLA</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: snapshot.lowSlaWarehouseCount > 0 ? '#F59E0B' : '#10B981', margin: '8px 0 4px 0' }}>{snapshot.lowSlaWarehouseCount}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Locations needing attention</div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-primary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Active Users</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#10B981', margin: '8px 0 4px 0' }}>{snapshot.totalActiveUsers}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Active system accounts</div>
        </div>
      </div>

      {/* 2. Action-Needed Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
        {/* Long Escalated Complaints */}
        <div style={{ backgroundColor: 'var(--bg-primary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} style={{ color: '#EF4444' }} />
            Complaints Escalated & Unresolved &gt; 3 Days
          </h3>
          {(!actionFeed.longEscalated || actionFeed.longEscalated.length === 0) ? (
            <div style={{ padding: '20px', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '13px', color: '#10B981', fontWeight: '600' }}>
              Zero complaints waiting &gt; 3 days!
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Complaint ID</th>
                    <th style={{ padding: '8px' }}>Warehouse</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Days Waiting</th>
                    <th style={{ padding: '8px' }}>Escalated Date</th>
                  </tr>
                </thead>
                <tbody>
                  {actionFeed.longEscalated.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px', fontWeight: '700', color: 'var(--brand-primary)' }}>{item.complaint_number}</td>
                      <td style={{ padding: '8px', color: 'var(--text-primary)' }}>{item.warehouseName}</td>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700', color: '#EF4444' }}>{item.daysWaiting} days</td>
                      <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{item.escalatedDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Warehouses at 0% SLA */}
        <div style={{ backgroundColor: 'var(--bg-primary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} style={{ color: '#F59E0B' }} />
            Critical Warehouses (0% SLA Performance)
          </h3>
          {(!actionFeed.zeroSlaWarehouses || actionFeed.zeroSlaWarehouses.length === 0) ? (
            <div style={{ padding: '20px', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '13px', color: '#10B981', fontWeight: '600' }}>
              No warehouses at 0% SLA performance!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {actionFeed.zeroSlaWarehouses.map(wh => (
                <div key={wh.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>{wh.warehouseName}</div>
                    <div style={{ fontSize: '12px', color: '#EF4444', fontWeight: '600' }}>0% Compliant ({wh.total} active complaints breached)</div>
                  </div>
                  <button onClick={() => onNavigateTab('Reports')} style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#EF4444', color: '#FFF', fontSize: '12px', fontWeight: '600', border: 'none', cursor: 'pointer' }}>
                    View Report
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. Recent System Activity Feed */}
      <div style={{ backgroundColor: 'var(--bg-primary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} style={{ color: 'var(--brand-primary)' }} />
          Recent System Audit Trail Logs
        </h3>
        <div style={{ overflowX: 'auto' }} className="scrollbar-thin">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', minWidth: '750px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px' }}>Timestamp</th>
                <th style={{ padding: '10px' }}>User</th>
                <th style={{ padding: '10px' }}>Role</th>
                <th style={{ padding: '10px' }}>Action</th>
                <th style={{ padding: '10px' }}>IP Address</th>
                <th style={{ padding: '10px' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {(!recentAuditLogs || recentAuditLogs.length === 0) ? (
                <tr>
                  <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No audit log records recorded yet.
                  </td>
                </tr>
              ) : (
                recentAuditLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatAuditTimestamp(log.timestamp)}
                    </td>
                    <td style={{ padding: '10px', fontWeight: '600', color: 'var(--text-primary)' }}>{log.user_name}</td>
                    <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{log.user_role}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', backgroundColor: 'var(--bg-secondary)', color: 'var(--brand-primary)' }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{log.ip_address}</td>
                    <td style={{ padding: '10px', color: 'var(--text-primary)' }}>{log.details || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Quick Links to Admin Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <button
          onClick={() => onNavigateTab('Settings')}
          style={{ padding: '16px', borderRadius: '10px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          <Users size={20} style={{ color: 'var(--brand-primary)' }} />
          <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>User Management</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Create, edit roles, deactivate users</div>
        </button>

        <button
          onClick={() => onNavigateTab('Reports')}
          style={{ padding: '16px', borderRadius: '10px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          <BarChart3 size={20} style={{ color: '#10B981' }} />
          <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>Executive Reports</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Org-wide trends & warehouse comparison</div>
        </button>

        <button
          onClick={() => onNavigateTab('Settings')}
          style={{ padding: '16px', borderRadius: '10px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          <Building2 size={20} style={{ color: '#F59E0B' }} />
          <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>Warehouse Facilities</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Add/edit warehouses and staff scoping</div>
        </button>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user, hasPermission } = useAuth();

  // Navigation and dropdown states
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // Handle navigation redirect state (e.g., from Raise Complaint sidebar clicks)
  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
      // Clear navigation state to avoid re-triggering on fresh reload
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // Responsive state observer
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isDesktop = windowWidth >= 1024;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;
  const isMobile = windowWidth < 768;

  // Filters State
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedPriority, setSelectedPriority] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sorting State
  const [sortBy, setSortBy] = useState('Raised Date');
  const [categories, setCategories] = useState([]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // Message Panel State
  const [messagePanelOpen, setMessagePanelOpen] = useState(false);
  const [replyToComplaint, setReplyToComplaint] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [messages, setMessages] = useState([]);
const [unreadCount, setUnreadCount] = useState(0);
  const [selectedQuickComplaint, setSelectedQuickComplaint] = useState(null);
  const [notificationsList, setNotificationsList] = useState([]);
  const [preselectedRecipientId, setPreselectedRecipientId] = useState(null);

  // User-to-user Contacts States
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Fetch unread count from backend
  const refreshUnreadCount = async () => {
    try {
      const res = await api.get('/messages/unread-count');
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.data.count);
      }
    } catch (err) {
      console.error('Failed to refresh unread message count:', err);
    }
  };

  const fetchComplaints = async (sort = sortBy) => {
    try {
      // Map frontend label to backend param value
      const sortParam = sort === 'Priority' ? 'priority' : 'date';
      let url = `/complaints?sort=${sortParam}`;
      if (user?.role === 'Warehouse Manager' && activeTab === 'Escalated Complaints') {
        url += '&history=true';
      }
      const res = await api.get(url);
      if (res.ok) {
        const data = await res.json();
        setComplaints(data.data.complaints || []);
      }
    } catch (err) {
      console.error('Failed to fetch complaints:', err);
    }
  };

  const fetchMetadata = async () => {
    try {
      const res = await api.get('/complaints/metadata');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.data.complaintTypes || []);
      }
    } catch (err) {
      console.error('Failed to fetch metadata:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get('/complaints/stats');
      if (res.ok) {
        const result = await res.json();
        setStats(result.data.stats || null);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchNotificationsList = async () => {
    try {
      const res = await api.get('/messages/notifications');
      if (res.ok) {
        const result = await res.json();
        setNotificationsList(result.data.notifications || []);
      }
    } catch (err) {
      console.error('Failed to fetch notifications list:', err);
    }
  };

  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const res = await api.get('/messages/contacts');
      if (res.ok) {
        const result = await res.json();
        setContacts(result.data.contacts || []);
      }
    } catch (err) {
      console.error('Failed to fetch contacts list:', err);
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleNotificationEntryClick = async (notif) => {
    console.log('handleNotificationEntryClick TRIGGERED', notif);
    try {
      if (notif.complaint_id === 'DIRECT') {
        const dummyComp = { id: 'DIRECT', customer: 'Direct Chat', invoice: 'N/A' };
        setPreselectedRecipientId(notif.sender_id);
        handleMessageClick(dummyComp);
        return;
      }

      const url = `/complaints/${notif.complaint_id}`;
      console.log('Calling api.get', url);
      const res = await api.get(url);
      console.log('api.get response status', res.status);
      if (res.ok) {
        const result = await res.json();
        const comp = result.data.complaint;
        console.log('Retrieved complaint from notification', comp);
        if (comp) {
          console.log('Setting preselectedRecipientId to', notif.sender_id);
          setPreselectedRecipientId(notif.sender_id);
          handleMessageClick(comp);
        }
      }
    } catch (err) {
      console.error('Failed to handle notification click:', err);
    }
  };

  // Initial load + polling (refresh every 8s)
  // Load and poll complaints + metadata on mount, tab change, or sort change
  useEffect(() => {
    refreshUnreadCount();
    fetchComplaints(sortBy);
    fetchStats();
    fetchMetadata();
    fetchNotificationsList();
    if (activeTab === 'Messages') {
      fetchContacts();
    }
    setCurrentPage(1); // Reset to page 1 on tab/sort change
    
    const interval = setInterval(() => {
      refreshUnreadCount();
      fetchComplaints(sortBy);
      fetchStats();
      fetchNotificationsList();
      if (activeTab === 'Messages') {
        fetchContacts();
      }
    }, 8000);
    
    return () => clearInterval(interval);
  }, [sortBy, activeTab, user]);

  // Initialize clean empty complaints state
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState(null);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const res = await api.put(`/complaints/${id}/status`, { action: newStatus });
      if (res.ok) {
        fetchComplaints();
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to update complaint status:', err);
    }
  };

  const fetchThreadForRecipient = useCallback(async (complaintId, recipientId) => {
    try {
      const url = recipientId 
        ? `/messages/thread/${complaintId}?recipient_id=${recipientId}` 
        : `/messages/thread/${complaintId}`;
      const res = await api.get(url);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.data.messages);
        refreshUnreadCount();
      }
    } catch (err) {
      console.error('Failed to load scoped message thread:', err);
    }
  }, []);

  const handleMessageClick = (comp) => {
    setReplyToComplaint(comp);
    setMessageText('');
    setAttachmentFile(null);
    setMessages([]); // Clear thread immediately to prevent stale flash
    setMessagePanelOpen(true);
    refreshUnreadCount();

    // Auto-focus text input and scroll smoothly into view
    setTimeout(() => {
      const inputEl = document.querySelector('#quick-message-input') || document.querySelector('input[placeholder*="Type"]');
      if (inputEl) {
        inputEl.focus();
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 120);
  };

  const [selectedRecipient, setSelectedRecipient] = useState(null);

  const handleSendMessageSubmit = async (e) => {
    e.preventDefault();
    if ((!messageText.trim() && !attachmentFile) || !replyToComplaint) return;

    const recipientRole = selectedRecipient?.role || (replyToComplaint.raisedBy === 'System Admin' ? 'Administrator' : 'Warehouse Team');
    const recipientId = selectedRecipient?.id || null;

    try {
      const formData = new FormData();
      formData.append('complaint_id', replyToComplaint.id);
      formData.append('message_text', messageText.trim());
      formData.append('recipient_role', recipientRole);
      if (recipientId) {
        formData.append('recipient_id', recipientId);
      }
      if (attachmentFile) {
        formData.append('attachment', attachmentFile);
      }

      const res = await api.postFormData('/messages', formData);
      if (res.ok) {
        setMessageText('');
        setAttachmentFile(null);
        // Reload recipient-scoped thread list
        await fetchThreadForRecipient(replyToComplaint.id, recipientId);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  // Derived state to filter complaints for "My Complaints" tab for Warehouse Team members
  const displayComplaints = (user?.role === 'Warehouse Team' && activeTab === 'My Complaints')
    ? complaints.filter(c => c.taken_action_by === user.id)
    : complaints;

  // Filter complaints based on selection
  const filteredComplaints = displayComplaints.filter(c => {
    if (selectedStatus === 'Pending' && !(c.status === 'Pending' || c.status === 'Assigned' || c.status === 'New')) return false;
    if (selectedStatus === 'In Progress' && c.status !== 'In Progress') return false;
    if (selectedStatus === 'Escalated' && !(c.status === 'Escalated' || c.status === 'Escalated to Manager' || c.status === 'Escalated to Warehouse Head' || (c.sla && (c.sla.includes('Expired') || c.sla.includes('!')) && c.status !== 'Resolved' && c.status !== 'Completed'))) return false;
    if (selectedStatus === 'Completed' && !(c.status === 'Completed' || c.status === 'Resolved')) return false;
    if (selectedDept && selectedDept !== 'All' && c.type?.trim().toLowerCase() !== selectedDept?.trim().toLowerCase()) return false;
    if (selectedPriority !== 'All' && c.priority !== selectedPriority) return false;
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (c.id && c.id.toLowerCase().includes(q)) ||
        (c.customer && c.customer.toLowerCase().includes(q)) ||
        (c.invoice && c.invoice.toLowerCase().includes(q)) ||
        (c.type && c.type.toLowerCase().includes(q)) ||
        (c.subtype && c.subtype.toLowerCase().includes(q)) ||
        (c.raisedBy && c.raisedBy.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Sort the filtered complaints dynamically based on selected sortBy option
  const sortedComplaints = [...filteredComplaints].sort((a, b) => {
    if (sortBy === 'ID' || sortBy === 'Complaint ID') {
      const numA = parseInt((a.id || '').replace(/\D/g, ''), 10) || 0;
      const numB = parseInt((b.id || '').replace(/\D/g, ''), 10) || 0;
      return numA !== numB ? numA - numB : (a.id || '').localeCompare(b.id || '');
    }
    if (sortBy === 'Priority') {
      const priorityOrder = { 'Critical': 1, 'High': 2, 'Medium': 3, 'Low': 4, 'Completed': 5 };
      const rankA = priorityOrder[a.priority] || 4;
      const rankB = priorityOrder[b.priority] || 4;
      return rankA - rankB;
    }
    if (sortBy === 'Category') {
      return (a.type || '').localeCompare(b.type || '');
    }
    // Default: 'Raised Date' (newest first)
    const dateA = new Date(a.raised_at || a.date || 0).getTime();
    const dateB = new Date(b.raised_at || b.date || 0).getTime();
    return dateB - dateA;
  });

  // KPI count statistics calculated dynamically from current scoped complaint records
  const totalCount = (user?.role === 'Warehouse Manager' && stats) ? stats.totalCount : displayComplaints.length;
  const pendingCount = (user?.role === 'Warehouse Manager' && stats) ? stats.pendingCount : displayComplaints.filter(c => c.status === 'Pending' || c.status === 'Assigned' || c.status === 'New').length;
  const inprogressCount = (user?.role === 'Warehouse Manager' && stats) ? stats.inprogressCount : displayComplaints.filter(c => c.status === 'In Progress').length;
  const escalatedCount = (user?.role === 'Warehouse Manager' && stats) ? stats.escalatedCount : displayComplaints.filter(c => c.status === 'Escalated' || c.status === 'Escalated to Manager' || c.status === 'Escalated to Warehouse Head' || (c.sla && (c.sla.includes('Expired') || c.sla.includes('!')) && c.status !== 'Resolved' && c.status !== 'Completed')).length;
  const completedCount = (user?.role === 'Warehouse Manager' && stats) ? stats.completedCount : displayComplaints.filter(c => c.status === 'Completed' || c.status === 'Resolved').length;
  const breachedCount = displayComplaints.filter(c => c.status === 'Escalated to Manager' || c.status === 'Escalated to Warehouse Head').length;

  return (
    <div className="min-h-screen flex flex-col select-none" style={{ backgroundColor: 'var(--bg-secondary)', minHeight: '100vh' }}>
      
      {/* 1. TOP NAVBAR */}
      <Navbar 
        profileDropdownOpen={profileDropdownOpen}
        setProfileDropdownOpen={setProfileDropdownOpen}
        handleLogout={logout}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        isDesktop={isDesktop}
        unreadCount={unreadCount}
        onNotificationSelect={async (compNumber, senderId) => {
          try {
            const res = await api.get(`/complaints/${compNumber}`);
            if (res.ok) {
              const result = await res.json();
              const comp = result.data.complaint;
              if (comp) {
                if (senderId) {
                  setPreselectedRecipientId(senderId);
                }
                handleMessageClick(comp);
              }
            }
          } catch (err) {
            console.error('Failed to open complaint message thread from navbar notification:', err);
          }
        }}
      />

      <div className="flex-1 flex overflow-hidden w-full max-w-full" style={{ overflowX: 'hidden', height: 'calc(100vh - 64px)' }}>
        
        <Sidebar 
          activeTab={activeTab}
          setActiveTab={(tab) => {
            if (tab === 'Raise Complaint') {
              navigate('/raise-complaint');
            } else {
              setActiveTab(tab);
            }
          }}
          handleLogout={logout}
          isDesktop={isDesktop}
          sidebarOpen={sidebarOpen}
          onCloseSidebar={() => setSidebarOpen(false)}
          unreadMessagesCount={unreadCount}
        />

        <main 
          style={{ 
            flex: 1, 
            marginLeft: isDesktop ? '220px' : '0',
            overflowY: 'auto', 
            padding: '24px 24px 88px 24px', 
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            minWidth: 0,
            boxSizing: 'border-box'
          }}
        >
          {activeTab === 'Messages' ? (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                    Messages
                  </h1>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    Select a contact to view or continue your conversation.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('Dashboard')}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
                    border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-secondary)', cursor: 'pointer'
                  }}
                >
                  ← Back to Dashboard
                </button>
              </div>

              {/* Search Bar */}
              <div style={{ width: '100%', maxWidth: '400px' }}>
                <input 
                  type="text"
                  placeholder="Search users..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    height: '40px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    padding: '0 14px',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div 
                style={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  boxShadow: 'var(--shadow-sm)',
                  overflow: 'hidden'
                }}
              >
                {loadingContacts && contacts.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                    Loading contacts...
                  </div>
                ) : (
                  (() => {
                    const filteredContacts = contacts.filter(c => 
                      c.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                      c.role.toLowerCase().includes(userSearchQuery.toLowerCase())
                    );
                    if (filteredContacts.length === 0) {
                      return (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                          No contacts found.
                        </div>
                      );
                    }
                    return filteredContacts.map((c, index) => {
                      const initials = c.name.split(' ').map(n => n[0]).join('').toUpperCase();
                      return (
                        <div
                          key={c.id}
                          className="contact-item-row"
                          onClick={() => {
                            setPreselectedRecipientId(c.id);
                            handleMessageClick({ id: 'DIRECT', customer: 'Direct Chat', invoice: 'N/A' });
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            padding: '16px 20px',
                            cursor: 'pointer',
                            backgroundColor: 'transparent',
                            borderBottom: index === filteredContacts.length - 1 ? 'none' : '1px solid var(--border-color)',
                            transition: 'background-color 150ms ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          {/* User Avatar Initials */}
                          <div 
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--brand-primary)',
                              color: '#FFFFFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: '700',
                              fontSize: '14px'
                            }}
                          >
                            {initials}
                          </div>
                          
                          {/* Name and Role */}
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
                              {c.name}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {c.role}{c.warehouseName && c.warehouseName !== 'N/A' ? ` • ${c.warehouseName}` : ''}
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()
                )}
              </div>

              <MessagePanel 
                replyToComplaint={replyToComplaint}
                messageText={messageText}
                setMessageText={setMessageText}
                attachmentFile={attachmentFile}
                setAttachmentFile={setAttachmentFile}
                setSelectedRecipient={setSelectedRecipient}
                onSubmit={handleSendMessageSubmit}
                onClose={() => { setMessagePanelOpen(false); setReplyToComplaint(null); setSelectedQuickComplaint(null); setAttachmentFile(null); setMessages([]); setPreselectedRecipientId(null); }}
                messages={messages}
                setMessages={setMessages}
                onFetchThread={fetchThreadForRecipient}
                currentUserId={user?.id || user?.userId}
                preselectedRecipientId={preselectedRecipientId}
              />
            </div>
          ) : activeTab === 'Notifications' ? (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                    Notifications
                  </h1>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    Recent messages and updates on your complaints.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('Dashboard')}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
                    border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-secondary)', cursor: 'pointer'
                  }}
                >
                  ← Back to Dashboard
                </button>
              </div>

              <div 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '12px',
                  backgroundColor: 'var(--bg-primary)', 
                  borderRadius: '12px', 
                  border: '1px solid var(--border-color)',
                  padding: '20px',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {notificationsList.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                    No notifications available.
                  </div>
                ) : (
                  notificationsList.map(notif => (
                    <div 
                      key={notif.id}
                      onClick={() => handleNotificationEntryClick(notif)}
                      style={{
                        padding: '16px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: notif.read_status === 'Unread' ? 'var(--card-selected-bg)' : 'var(--bg-primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        transition: 'transform 150ms ease, background-color 150ms ease',
                        textAlign: 'left'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--brand-primary)' }}>
                          Complaint {notif.complaint_id}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(notif.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: notif.read_status === 'Unread' ? 'bold' : 'normal', color: 'var(--text-primary)' }}>
                        {notif.title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        "{notif.preview}"
                      </div>
                    </div>
                  ))
                )}
              </div>

              <MessagePanel 
                replyToComplaint={replyToComplaint}
                messageText={messageText}
                setMessageText={setMessageText}
                attachmentFile={attachmentFile}
                setAttachmentFile={setAttachmentFile}
                setSelectedRecipient={setSelectedRecipient}
                onSubmit={handleSendMessageSubmit}
                onClose={() => { setMessagePanelOpen(false); setReplyToComplaint(null); setSelectedQuickComplaint(null); setAttachmentFile(null); setMessages([]); setPreselectedRecipientId(null); }}
                messages={messages}
                setMessages={setMessages}
                onFetchThread={fetchThreadForRecipient}
                currentUserId={user?.id || user?.userId}
                preselectedRecipientId={preselectedRecipientId}
              />
            </div>
          ) : activeTab === 'Reports' ? (
            <Reports />
          ) : activeTab === 'Access Control' ? (
            <AccessControl />
          ) : activeTab === 'Audit Logs' ? (
            hasPermission('audit_logs', 'read') ? (
              <AuditLogsView />
            ) : (
              <div style={{ padding: '60px 20px', textAlign: 'center', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <ShieldAlert size={48} style={{ color: '#EF4444', margin: '0 auto 16px auto' }} />
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 8px 0' }}>Access Denied (HTTP 403)</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>You do not have Read (View) permission for Audit Logs.</p>
              </div>
            )
          ) : activeTab === 'Settings' ? (
            <Settings />
          ) : activeTab === 'My Complaints' || activeTab === 'Escalated Complaints' ? (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                    {activeTab}
                  </h1>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    {activeTab === 'My Complaints' ? (
                      'Your claimed complaints requiring resolution.'
                    ) : (
                      'Historical and active escalated complaints requiring manager attention.'
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('Dashboard')}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
                    border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-secondary)', cursor: 'pointer'
                  }}
                >
                  ← Back to Dashboard
                </button>
              </div>

              {/* Stat cards — same as dashboard */}
              <section style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(5, 1fr)' : isTablet ? 'repeat(3, 1fr)' : 'repeat(1, 1fr)', gap: '16px', width: '100%', boxSizing: 'border-box' }}>
                <StatCard title="Total Logs" value={totalCount} icon={<FileSpreadsheet size={16} />} color="slate" status="All" activeStatus={selectedStatus} onClick={() => setSelectedStatus('All')} />
                <StatCard title="Pending" value={pendingCount} icon={<Clock size={16} />} color="amber" status="Pending" activeStatus={selectedStatus} onClick={() => setSelectedStatus('Pending')} />
                <StatCard title="In Progress" value={inprogressCount} icon={<RefreshCw size={16} />} color="blue" status="In Progress" activeStatus={selectedStatus} onClick={() => setSelectedStatus('In Progress')} />
                <StatCard title="Escalated" value={escalatedCount} icon={<ShieldAlert size={16} />} color="red" status="Escalated" activeStatus={selectedStatus} onClick={() => setSelectedStatus('Escalated')} />
                <StatCard title="Completed" value={completedCount} icon={<CheckSquare size={16} />} color="green" status="Completed" activeStatus={selectedStatus} onClick={() => setSelectedStatus('Completed')} />
              </section>

              {/* Filter + Sort toolbar */}
              <div style={{ position: 'relative', zIndex: 100 }}>
                <FilterTabs 
                  selectedStatus={selectedStatus}
                  setSelectedStatus={setSelectedStatus}
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                  selectedDept={selectedDept}
                  setSelectedDept={setSelectedDept}
                  categories={categories}
                />
              </div>

              {/* Complaints table */}
              <div style={{ position: 'relative', zIndex: 10 }}>
                <ComplaintsTable 
                  complaints={sortedComplaints}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  onMessageClick={handleMessageClick}
                  onStatusChange={handleStatusChange}
                  isMobile={isMobile}
                  selectedQuickComplaint={selectedQuickComplaint}
                  onRowSelect={setSelectedQuickComplaint}
                  activeTab={activeTab}
                />
              </div>

              <MessagePanel 
                replyToComplaint={replyToComplaint}
                messageText={messageText}
                setMessageText={setMessageText}
                attachmentFile={attachmentFile}
                setAttachmentFile={setAttachmentFile}
                setSelectedRecipient={setSelectedRecipient}
                onSubmit={handleSendMessageSubmit}
                onClose={() => { setMessagePanelOpen(false); setReplyToComplaint(null); setSelectedQuickComplaint(null); setAttachmentFile(null); setMessages([]); setPreselectedRecipientId(null); }}
                messages={messages}
                setMessages={setMessages}
                onFetchThread={fetchThreadForRecipient}
                currentUserId={user?.id || user?.userId}
                preselectedRecipientId={preselectedRecipientId}
              />
            </div>
          ) : (
          /* ─────────────────────────────── DASHBOARD VIEW ─────────────────────────────── */
          user?.role === 'Administrator' ? (
            <AdminDashboardView onNavigateTab={setActiveTab} />
          ) : (
          <>
          <div className="animate-fade-in">
            <DashboardHeader 
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onRaiseComplaint={() => navigate('/raise-complaint')}
            />
          </div>

          <section 
            className="animate-slide-up stagger-1"
            style={{ 
              display: 'grid', 
              gridTemplateColumns: isDesktop ? 'repeat(5, 1fr)' : isTablet ? 'repeat(3, 1fr)' : 'repeat(1, 1fr)', 
              gap: '16px', 
              width: '100%',
              boxSizing: 'border-box'
            }}
          >
            <StatCard title="Total Logs" value={totalCount} icon={<FileSpreadsheet size={16} />} color="slate" status="All" activeStatus={selectedStatus} onClick={() => setSelectedStatus('All')} />
            <StatCard title="Pending" value={pendingCount} icon={<Clock size={16} />} color="amber" status="Pending" activeStatus={selectedStatus} onClick={() => setSelectedStatus('Pending')} />
            <StatCard title="In Progress" value={inprogressCount} icon={<RefreshCw size={16} />} color="blue" status="In Progress" activeStatus={selectedStatus} onClick={() => setSelectedStatus('In Progress')} />
            <StatCard title="Escalated" value={escalatedCount} icon={<ShieldAlert size={16} />} color="red" status="Escalated" activeStatus={selectedStatus} onClick={() => setSelectedStatus('Escalated')} />
            <StatCard title="Completed" value={completedCount} icon={<CheckSquare size={16} />} color="green" status="Completed" activeStatus={selectedStatus} onClick={() => setSelectedStatus('Completed')} />
          </section>

          <div className="stagger-banner">
            <SlaAlertBanner breachCount={breachedCount} onViewEscalatedClick={() => setSelectedStatus('Escalated')} />
          </div>

          <div className="animate-slide-up stagger-filter" style={{ position: 'relative', zIndex: 100 }}>
            <FilterTabs 
              selectedStatus={selectedStatus}
              setSelectedStatus={setSelectedStatus}
              sortBy={sortBy}
              setSortBy={setSortBy}
              selectedDept={selectedDept}
              setSelectedDept={setSelectedDept}
              categories={categories}
            />
          </div>

          <div className="animate-slide-up stagger-table" style={{ position: 'relative', zIndex: 10 }}>
            <ComplaintsTable 
              complaints={sortedComplaints}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              onMessageClick={handleMessageClick}
              onStatusChange={handleStatusChange}
              isMobile={isMobile}
              selectedQuickComplaint={selectedQuickComplaint}
              onRowSelect={setSelectedQuickComplaint}
              activeTab={activeTab}
            />
          </div>

          <MessagePanel 
            replyToComplaint={replyToComplaint}
            messageText={messageText}
            setMessageText={setMessageText}
            attachmentFile={attachmentFile}
            setAttachmentFile={setAttachmentFile}
            setSelectedRecipient={setSelectedRecipient}
            onSubmit={handleSendMessageSubmit}
            onClose={() => { setMessagePanelOpen(false); setReplyToComplaint(null); setSelectedQuickComplaint(null); setAttachmentFile(null); setMessages([]); setPreselectedRecipientId(null); }}
            messages={messages}
            setMessages={setMessages}
            onFetchThread={fetchThreadForRecipient}
            currentUserId={user?.id || user?.userId}
            preselectedRecipientId={preselectedRecipientId}
          />
          </>
          )
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;

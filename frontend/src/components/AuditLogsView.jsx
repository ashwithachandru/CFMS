import React, { useState, useEffect } from 'react';
import { 
  Activity, Search, Filter, RefreshCw, Clock, User, Shield, Info, FileSpreadsheet, Eye, ChevronRight, CheckCircle, AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';

const formatAuditTimestamp = (dateInput) => {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(d);
};

const ACTION_COLORS = {
  'CREATE_USER': { bg: 'rgba(59, 130, 246, 0.12)', text: '#3B82F6', border: 'rgba(59, 130, 246, 0.3)' },
  'UPDATE_USER': { bg: 'rgba(59, 130, 246, 0.12)', text: '#3B82F6', border: 'rgba(59, 130, 246, 0.3)' },
  'UPDATE_ROLE_PERMISSION': { bg: 'rgba(139, 92, 246, 0.12)', text: '#8B5CF6', border: 'rgba(139, 92, 246, 0.3)' },
  'UPDATE_USER_OVERRIDE': { bg: 'rgba(236, 72, 153, 0.12)', text: '#EC4899', border: 'rgba(236, 72, 153, 0.3)' },
  'RESET_USER_OVERRIDES': { bg: 'rgba(245, 158, 11, 0.12)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.3)' },
  'UPDATE_SYSTEM_SETTINGS': { bg: 'rgba(16, 185, 129, 0.12)', text: '#10B981', border: 'rgba(16, 185, 129, 0.3)' },
  'LOGIN': { bg: 'rgba(16, 185, 129, 0.12)', text: '#10B981', border: 'rgba(16, 185, 129, 0.3)' },
  'LOGOUT': { bg: 'rgba(107, 114, 128, 0.12)', text: '#9CA3AF', border: 'rgba(107, 114, 128, 0.3)' }
};

const AuditLogsView = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [selectedLogModal, setSelectedLogModal] = useState(null);

  const fetchAuditLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/audit-logs?limit=200');
      if (res.ok) {
        const body = await res.json();
        if (body.success) {
          setLogs(body.data || []);
        } else {
          setError(body.message || 'Failed to fetch audit logs');
        }
      } else {
        const errBody = await res.json();
        setError(errBody.message || 'Access Denied: You do not have permission to view Audit Logs.');
      }
    } catch (err) {
      console.error('Error loading audit logs:', err);
      setError('An error occurred while loading audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  // Filter logs
  const filteredLogs = logs.filter(log => {
    if (selectedAction !== 'ALL' && log.action !== selectedAction) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const userName = (log.user_name || '').toLowerCase();
      const userEmail = (log.user_email || '').toLowerCase();
      const action = (log.action || '').toLowerCase();
      const details = (log.details || '').toLowerCase();
      const ip = (log.ip_address || '').toLowerCase();

      return userName.includes(q) || userEmail.includes(q) || action.includes(q) || details.includes(q) || ip.includes(q);
    }
    return true;
  });

  const uniqueActions = Array.from(new Set(logs.map(l => l.action).filter(Boolean)));

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* HEADER BAR */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              Audit Logs & Activity Trail
            </h1>
            <span style={{
              padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700',
              backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)'
            }}>
              Immutable Read-Only System Record
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            Complete system activity audit trail. All timestamps are displayed in Indian Standard Time (IST, 24-hr Railway Format).
          </p>
        </div>

        <button
          onClick={fetchAuditLogs}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px',
            border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)',
            fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 150ms ease'
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh Activity
        </button>
      </div>

      {/* ERROR FEEDBACK */}
      {error && (
        <div style={{
          padding: '16px', borderRadius: '10px', backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)', color: '#EF4444', fontSize: '13px', fontWeight: '600',
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {/* FILTER & SEARCH BAR */}
      <div style={{
        backgroundColor: 'var(--bg-primary)', padding: '16px', borderRadius: '12px',
        border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          {/* Search Box */}
          <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search user, action, IP, or details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%', height: '38px', paddingLeft: '36px', paddingRight: '12px', borderRadius: '8px',
                border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)',
                fontSize: '13px', outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Action Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              style={{
                height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none'
              }}
            >
              <option value="ALL">All System Actions ({logs.length})</option>
              {uniqueActions.map(act => (
                <option key={act} value={act}>{act}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>
          Showing <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{filteredLogs.length}</span> audit records
        </div>
      </div>

      {/* AUDIT LOGS TABLE */}
      <div style={{
        backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)',
        overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        {loading && logs.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto', color: 'var(--brand-primary)' }} />
            Loading system audit logs...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            <Activity size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
            No audit log records match the selected filter criteria.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }} className="scrollbar-thin">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: '700' }}>Timestamp (IST Railway)</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700' }}>User</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700' }}>Role</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700' }}>System Action</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700' }}>IP & Agent</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700' }}>Action Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, idx) => {
                  const actStyle = ACTION_COLORS[log.action] || { bg: 'var(--bg-secondary)', text: 'var(--text-primary)', border: 'var(--border-color)' };
                  return (
                    <tr 
                      key={log.id || idx}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)',
                        transition: 'background-color 150ms ease'
                      }}
                    >
                      {/* TIMESTAMP */}
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={13} style={{ color: 'var(--brand-primary)' }} />
                          {formatAuditTimestamp(log.timestamp)}
                        </div>
                      </td>

                      {/* USER */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                          {log.user_name || 'System Auto'}
                        </div>
                        {log.user_email && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{log.user_email}</div>
                        )}
                      </td>

                      {/* ROLE */}
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                          backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)'
                        }}>
                          {log.user_role || 'System'}
                        </span>
                      </td>

                      {/* ACTION */}
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700',
                          backgroundColor: actStyle.bg, color: actStyle.text, border: `1px solid ${actStyle.border}`
                        }}>
                          {log.action}
                        </span>
                      </td>

                      {/* IP & AGENT */}
                      <td style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        <div>{log.ip_address || '127.0.0.1'}</div>
                      </td>

                      {/* DETAILS */}
                      <td style={{ padding: '12px 16px', maxWidth: '360px' }}>
                        <div style={{
                          fontSize: '12px', color: 'var(--text-secondary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                          {log.details || 'No additional parameters logged'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default AuditLogsView;

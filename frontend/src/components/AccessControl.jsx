import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Users, Search, RefreshCw, Check, X, Building2, ChevronDown, ChevronUp, RotateCcw, Lock, Edit3, Eye
} from 'lucide-react';
import { api } from '../services/api';

const ROLE_COLORS = {
  'Administrator': { bg: 'rgba(139, 92, 246, 0.12)', text: '#8B5CF6', border: 'rgba(139, 92, 246, 0.3)' },
  'Warehouse Manager': { bg: 'rgba(245, 158, 11, 0.12)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.3)' },
  'Warehouse Team': { bg: 'rgba(59, 130, 246, 0.12)', text: '#3B82F6', border: 'rgba(59, 130, 246, 0.3)' },
  'Sales Executive': { bg: 'rgba(16, 185, 129, 0.12)', text: '#10B981', border: 'rgba(16, 185, 129, 0.3)' }
};

const getInitials = (name) => {
  if (!name) return 'U';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const AccessControl = () => {
  const [activeTab, setActiveTab] = useState('role-based'); // 'role-based' | 'user-based'
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState([]);
  const [roles, setRoles] = useState([]);
  const [roleMatrix, setRoleMatrix] = useState({});
  const [userOverrideMap, setUserOverrideMap] = useState({});
  const [users, setUsers] = useState([]);

  // Search & Filter
  const [moduleSearch, setModuleSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('All');

  // Expanded User Row State in Tab 2
  const [expandedUserId, setExpandedUserId] = useState(null);

  // Status Toast
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg, isError = false) => {
    setToastMessage({ text: msg, isError });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchRbacData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/rbac/matrix');
      if (res.ok) {
        const json = await res.json();
        const data = json.data || {};
        setModules(data.modules || []);
        setRoles(data.roles || []);
        setRoleMatrix(data.roleMatrix || {});
        setUserOverrideMap(data.userOverrideMap || {});
        setUsers(data.users || []);
      } else {
        showToast('Failed to load RBAC permissions matrix', true);
      }
    } catch (err) {
      console.error('Error loading RBAC matrix:', err);
      showToast('Server error loading permissions', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRbacData();
  }, []);

  // Handle Role Matrix Cell Toggle
  const handleToggleRolePermission = async (roleName, moduleKey, permType) => {
    const current = roleMatrix[roleName]?.[moduleKey] || { canRead: false, canWrite: false };
    const canRead = permType === 'read' ? !current.canRead : current.canRead;
    const canWrite = permType === 'write' ? !current.canWrite : current.canWrite;

    // Optimistic Update
    setRoleMatrix(prev => ({
      ...prev,
      [roleName]: {
        ...prev[roleName],
        [moduleKey]: { canRead, canWrite }
      }
    }));

    try {
      const res = await api.put('/admin/rbac/role-permissions', {
        roleName,
        moduleKey,
        canRead,
        canWrite
      });

      if (!res.ok) {
        // Revert on error
        fetchRbacData();
        showToast(`Failed to update ${roleName} permission on ${moduleKey}`, true);
      } else {
        showToast(`Updated ${roleName} defaults for ${moduleKey}`);
        fetchRbacData(); // recalculate pill counts
      }
    } catch (err) {
      console.error(err);
      fetchRbacData();
      showToast('Error persisting role permission update', true);
    }
  };

  // Handle User Override Toggle
  const handleToggleUserOverride = async (userId, moduleKey, permType, value) => {
    const current = userOverrideMap[userId]?.[moduleKey] || { overrideRead: null, overrideWrite: null };
    const overrideRead = permType === 'read' ? value : current.overrideRead;
    const overrideWrite = permType === 'write' ? value : current.overrideWrite;

    // Optimistic Update
    setUserOverrideMap(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [moduleKey]: { overrideRead, overrideWrite }
      }
    }));

    try {
      const res = await api.put('/admin/rbac/user-overrides', {
        userId,
        moduleKey,
        overrideRead,
        overrideWrite
      });

      if (!res.ok) {
        fetchRbacData();
        showToast('Failed to update user override', true);
      } else {
        showToast('Updated user permission override');
        fetchRbacData(); // recalculate pill counts
      }
    } catch (err) {
      console.error(err);
      fetchRbacData();
      showToast('Error persisting user override', true);
    }
  };

  // Handle Reset User Overrides
  const handleResetUserOverrides = async (userId, userName) => {
    if (!window.confirm(`Reset all custom permission overrides for ${userName} back to role defaults?`)) return;

    try {
      const res = await api.delete(`/admin/rbac/user-overrides/${userId}`);
      if (res.ok) {
        showToast(`Reset overrides for ${userName}`);
        fetchRbacData();
      } else {
        showToast('Failed to reset user overrides', true);
      }
    } catch (err) {
      console.error(err);
      showToast('Error resetting user overrides', true);
    }
  };

  if (loading && modules.length === 0) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto', color: 'var(--brand-primary)' }} />
        Loading Access Control & RBAC Matrix...
      </div>
    );
  }

  const filteredModules = modules.filter(m => 
    m.name.toLowerCase().includes(moduleSearch.toLowerCase()) ||
    m.description.toLowerCase().includes(moduleSearch.toLowerCase())
  );

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                          u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
                          (u.warehouseName || '').toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = selectedRoleFilter === 'All' || u.role === selectedRoleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header Toast */}
      {toastMessage && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
          padding: '12px 20px', borderRadius: '8px',
          backgroundColor: toastMessage.isError ? '#EF4444' : '#10B981',
          color: '#FFFFFF', fontWeight: '600', fontSize: '13px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          {toastMessage.isError ? <X size={16} /> : <Check size={16} />}
          {toastMessage.text}
        </div>
      )}

      {/* Access Control Navigation Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px',
        backgroundColor: 'var(--bg-primary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)'
      }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} style={{ color: 'var(--brand-primary)' }} />
            Role & User Access Control (RBAC)
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', margin: '4px 0 0 0' }}>
            Manage role-default access policies and assign granular user-level permission overrides across system modules.
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', backgroundColor: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', gap: '4px' }}>
          <button
            onClick={() => setActiveTab('role-based')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '6px',
              fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer',
              backgroundColor: activeTab === 'role-based' ? 'var(--bg-primary)' : 'transparent',
              color: activeTab === 'role-based' ? 'var(--brand-primary)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'role-based' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 150ms ease'
            }}
          >
            <ShieldCheck size={16} />
            Role-Based Permissions
          </button>
          <button
            onClick={() => setActiveTab('user-based')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '6px',
              fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer',
              backgroundColor: activeTab === 'user-based' ? 'var(--bg-primary)' : 'transparent',
              color: activeTab === 'user-based' ? 'var(--brand-primary)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'user-based' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 150ms ease'
            }}
          >
            <Users size={16} />
            User-Based Permissions ({users.length})
          </button>
        </div>
      </div>

      {/* TAB 1: ROLE-BASED PERMISSIONS MATRIX */}
      {activeTab === 'role-based' && (
        <div style={{ backgroundColor: 'var(--bg-primary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Module Search Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Filter modules..."
                value={moduleSearch}
                onChange={(e) => setModuleSearch(e.target.value)}
                style={{
                  width: '100%', height: '38px', paddingLeft: '36px', paddingRight: '12px', borderRadius: '8px',
                  border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)',
                  fontSize: '13px', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Showing {filteredModules.length} of {modules.length} system modules
            </div>
          </div>

          {/* Role Matrix Table */}
          <div style={{ overflowX: 'auto' }} className="scrollbar-thin">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', minWidth: '950px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '12px 16px', minWidth: '240px', color: 'var(--text-primary)', fontWeight: '700' }}>System Module</th>
                  {roles.map(r => {
                    const badgeStyle = ROLE_COLORS[r] || { bg: 'var(--bg-secondary)', text: 'var(--text-primary)', border: 'var(--border-color)' };
                    return (
                      <th key={r} colSpan={2} style={{ padding: '12px 8px', textAlign: 'center', borderLeft: '1px solid var(--border-color)' }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700',
                          backgroundColor: badgeStyle.bg, color: badgeStyle.text, border: `1px solid ${badgeStyle.border}`
                        }}>
                          {r}
                        </span>
                      </th>
                    );
                  })}
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '11px' }}>
                  <th style={{ padding: '8px 16px' }}>Module & Description</th>
                  {roles.map(r => (
                    <React.Fragment key={`${r}-sub`}>
                      <th style={{ padding: '6px 8px', textAlign: 'center', borderLeft: '1px solid var(--border-color)', width: '70px' }}>
                        <Eye size={12} style={{ display: 'inline', marginRight: '3px' }} /> View
                      </th>
                      <th style={{ padding: '6px 8px', textAlign: 'center', width: '70px' }}>
                        <Edit3 size={12} style={{ display: 'inline', marginRight: '3px' }} /> Edit
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredModules.map((m, idx) => (
                  <tr key={m.key} style={{
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)'
                  }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '13px' }}>{m.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{m.description}</div>
                    </td>

                    {roles.map(r => {
                      const perm = roleMatrix[r]?.[m.key] || { canRead: false, canWrite: false };
                      return (
                        <React.Fragment key={`${r}-${m.key}`}>
                          {/* READ TOGGLE */}
                          <td style={{ padding: '10px 8px', textAlign: 'center', borderLeft: '1px solid var(--border-color)' }}>
                            <button
                              onClick={() => handleToggleRolePermission(r, m.key, 'read')}
                              style={{
                                width: '36px', height: '20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                                backgroundColor: perm.canRead ? '#3B82F6' : 'var(--border-color)',
                                position: 'relative', transition: 'background-color 200ms ease', padding: 0
                              }}
                              title={`${r} Read ${m.name}: ${perm.canRead ? 'Granted' : 'Revoked'}`}
                            >
                              <div style={{
                                width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#FFF',
                                position: 'absolute', top: '2px', left: perm.canRead ? '18px' : '2px',
                                transition: 'left 200ms ease', boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                              }} />
                            </button>
                          </td>

                          {/* WRITE TOGGLE */}
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            <button
                              onClick={() => handleToggleRolePermission(r, m.key, 'write')}
                              style={{
                                width: '36px', height: '20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                                backgroundColor: perm.canWrite ? '#10B981' : 'var(--border-color)',
                                position: 'relative', transition: 'background-color 200ms ease', padding: 0
                              }}
                              title={`${r} Write ${m.name}: ${perm.canWrite ? 'Granted' : 'Revoked'}`}
                            >
                              <div style={{
                                width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#FFF',
                                position: 'absolute', top: '2px', left: perm.canWrite ? '18px' : '2px',
                                transition: 'left 200ms ease', boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                              }} />
                            </button>
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: USER-BASED PERMISSIONS LIST & OVERRIDES */}
      {activeTab === 'user-based' && (
        <div style={{ backgroundColor: 'var(--bg-primary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Filters Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
              <div style={{ position: 'relative', width: '300px', maxWidth: '100%' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search user name, email, warehouse..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  style={{
                    width: '100%', height: '38px', paddingLeft: '36px', paddingRight: '12px', borderRadius: '8px',
                    border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)',
                    fontSize: '13px', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>

              <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                style={{
                  height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none'
                }}
              >
                <option value="All">All Roles</option>
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Showing {filteredUsers.length} of {users.length} users
            </div>
          </div>

          {/* User Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredUsers.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                No users found matching search criteria.
              </div>
            ) : (
              filteredUsers.map(u => {
                const badgeStyle = ROLE_COLORS[u.role] || { bg: 'var(--bg-secondary)', text: 'var(--text-primary)', border: 'var(--border-color)' };
                const isExpanded = expandedUserId === u.id;
                const userOverrides = userOverrideMap[u.id] || {};
                const hasOverrides = Object.keys(userOverrides).length > 0;

                return (
                  <div key={u.id} style={{
                    borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)',
                    overflow: 'hidden', transition: 'border-color 150ms ease, box-shadow 150ms ease'
                  }}>
                    {/* User Row Header */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', flexWrap: 'wrap', gap: '14px',
                      backgroundColor: isExpanded ? 'var(--bg-secondary)' : 'transparent'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        {/* Avatar Initials */}
                        <div style={{
                          width: '42px', height: '42px', borderRadius: '50%', backgroundColor: badgeStyle.bg,
                          color: badgeStyle.text, border: `1px solid ${badgeStyle.border}`, fontWeight: '700',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px'
                        }}>
                          {getInitials(u.name)}
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>{u.name}</span>
                            <span style={{
                              padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700',
                              backgroundColor: badgeStyle.bg, color: badgeStyle.text, border: `1px solid ${badgeStyle.border}`
                            }}>
                              {u.role}
                            </span>
                            {hasOverrides && (
                              <span style={{
                                padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)'
                              }}>
                                Custom Overrides Active
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', flexWrap: 'wrap' }}>
                            <span>{u.email}</span>
                            <span>•</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Building2 size={13} style={{ color: 'var(--brand-primary)' }} />
                              {u.warehouseName}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Pill Counters & Action Controls */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* View Pill */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '12px',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6', fontWeight: '700', fontSize: '12px', border: '1px solid rgba(59, 130, 246, 0.25)'
                        }}>
                          <Eye size={13} />
                          View {u.viewCount}/{u.totalModules}
                        </div>

                        {/* Edit Pill */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '12px',
                          backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10B981', fontWeight: '700', fontSize: '12px', border: '1px solid rgba(16, 185, 129, 0.25)'
                        }}>
                          <Edit3 size={13} />
                          Edit {u.editCount}/{u.totalModules}
                        </div>

                        <button
                          onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
                          style={{
                            padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: '600',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                          }}
                        >
                          {isExpanded ? 'Hide Overrides' : 'Manage Overrides'}
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* EXPANDED USER OVERRIDE MATRIX */}
                    {isExpanded && (
                      <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                            Module Permission Overrides for {u.name} (Role: {u.role})
                          </div>
                          {hasOverrides && (
                            <button
                              onClick={() => handleResetUserOverrides(u.id, u.name)}
                              style={{
                                padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.4)',
                                backgroundColor: 'rgba(239, 68, 68, 0.08)', color: '#EF4444', fontSize: '12px', fontWeight: '600',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                              }}
                            >
                              <RotateCcw size={12} />
                              Reset to Role Defaults
                            </button>
                          )}
                        </div>

                        <div style={{ overflowX: 'auto' }} className="scrollbar-thin">
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left', minWidth: '750px' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                                <th style={{ padding: '8px 12px' }}>System Module</th>
                                <th style={{ padding: '8px 12px', textAlign: 'center' }}>Role Default</th>
                                <th style={{ padding: '8px 12px', textAlign: 'center' }}>Read (View) Override</th>
                                <th style={{ padding: '8px 12px', textAlign: 'center' }}>Write (Edit) Override</th>
                                <th style={{ padding: '8px 12px', textAlign: 'center' }}>Effective Access</th>
                              </tr>
                            </thead>
                            <tbody>
                              {modules.map(m => {
                                const roleDef = roleMatrix[u.role]?.[m.key] || { canRead: false, canWrite: false };
                                const uOverride = userOverrides[m.key] || { overrideRead: null, overrideWrite: null };

                                const effRead = uOverride.overrideRead !== null ? uOverride.overrideRead : roleDef.canRead;
                                const effWrite = uOverride.overrideWrite !== null ? uOverride.overrideWrite : roleDef.canWrite;

                                return (
                                  <tr key={m.key} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '10px 12px' }}>
                                      <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{m.name}</div>
                                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{m.description}</div>
                                    </td>

                                    {/* Role Default */}
                                    <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                      View: {roleDef.canRead ? 'Yes' : 'No'} | Edit: {roleDef.canWrite ? 'Yes' : 'No'}
                                    </td>

                                    {/* Read Override Selector */}
                                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                      <select
                                        value={uOverride.overrideRead === null ? 'default' : uOverride.overrideRead ? 'grant' : 'revoke'}
                                        onChange={(e) => {
                                          const val = e.target.value === 'default' ? null : e.target.value === 'grant';
                                          handleToggleUserOverride(u.id, m.key, 'read', val);
                                        }}
                                        style={{
                                          padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-color)',
                                          backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '12px'
                                        }}
                                      >
                                        <option value="default">Role Default ({roleDef.canRead ? 'View' : 'No View'})</option>
                                        <option value="grant">Grant View</option>
                                        <option value="revoke">Revoke View</option>
                                      </select>
                                    </td>

                                    {/* Write Override Selector */}
                                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                      <select
                                        value={uOverride.overrideWrite === null ? 'default' : uOverride.overrideWrite ? 'grant' : 'revoke'}
                                        onChange={(e) => {
                                          const val = e.target.value === 'default' ? null : e.target.value === 'grant';
                                          handleToggleUserOverride(u.id, m.key, 'write', val);
                                        }}
                                        style={{
                                          padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-color)',
                                          backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '12px'
                                        }}
                                      >
                                        <option value="default">Role Default ({roleDef.canWrite ? 'Edit' : 'No Edit'})</option>
                                        <option value="grant">Grant Edit</option>
                                        <option value="revoke">Revoke Edit</option>
                                      </select>
                                    </td>

                                    {/* Effective Access Pill */}
                                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                        <span style={{
                                          padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
                                          backgroundColor: effRead ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-secondary)',
                                          color: effRead ? '#3B82F6' : 'var(--text-muted)'
                                        }}>
                                          {effRead ? 'View' : 'No View'}
                                        </span>
                                        <span style={{
                                          padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
                                          backgroundColor: effWrite ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-secondary)',
                                          color: effWrite ? '#10B981' : 'var(--text-muted)'
                                        }}>
                                          {effWrite ? 'Edit' : 'No Edit'}
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default AccessControl;

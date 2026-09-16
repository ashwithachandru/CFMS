import React, { useState, useEffect } from 'react';
import { 
  Users, Building2, Layers, Clock, Moon, Sun, Plus, Search, Edit2, ShieldAlert,
  Key, UserCheck, UserX, AlertTriangle, CheckCircle2, RefreshCw, Trash2, X, ShieldCheck
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AccessControl from '../components/AccessControl';

const Settings = ({ initialTab = 'users' }) => {
  const { user, hasPermission } = useAuth();

  const canViewUsers = hasPermission('users', 'read');
  const canWriteUsers = hasPermission('users', 'write');
  const canViewWarehouses = hasPermission('warehouses', 'read');
  const canWriteWarehouses = hasPermission('warehouses', 'write');
  const canViewCategories = hasPermission('categories', 'read');
  const canWriteCategories = hasPermission('categories', 'write');
  const canViewSla = hasPermission('sla', 'read');
  const canWriteSla = hasPermission('sla', 'write');

  // Determine initial valid tab
  const getFirstValidTab = () => {
    if (canViewUsers) return 'users';
    if (canViewWarehouses) return 'warehouses';
    if (canViewCategories) return 'categories';
    if (canViewSla) return 'sla';
    return 'theme';
  };

  const [activeTab, setActiveTab] = useState(() => {
    if (initialTab === 'users' && !canViewUsers) return getFirstValidTab();
    if (initialTab === 'warehouses' && !canViewWarehouses) return getFirstValidTab();
    if (initialTab === 'categories' && !canViewCategories) return getFirstValidTab();
    if (initialTab === 'sla' && !canViewSla) return getFirstValidTab();
    return initialTab;
  });

  // System Settings state (SLA Configuration)
  const [settings, setSettings] = useState({
    sla_window_hours: '24',
    sla_threshold_green_hours: '12',
    sla_threshold_amber_hours: '6'
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState('');

  // User Management state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [whFilter, setWhFilter] = useState('');

  // Create/Edit User Modals
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'Sales Executive',
    warehouseId: ''
  });
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');

  // Warehouse Management state
  const [warehouses, setWarehouses] = useState([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [warehouseForm, setWarehouseForm] = useState({ name: '', location: '' });
  const [warehouseError, setWarehouseError] = useState('');
  const [warehouseSuccess, setWarehouseSuccess] = useState('');

  // Complaint Type / Subtype state
  const [typesData, setTypesData] = useState({ types: [], subtypes: [] });
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showSubtypeModal, setShowSubtypeModal] = useState(false);
  const [typeForm, setTypeForm] = useState({ name: '', description: '' });
  const [subtypeForm, setSubtypeForm] = useState({ complaintTypeId: '', name: '' });
  const [typeError, setTypeError] = useState('');
  const [typeSuccess, setTypeSuccess] = useState('');

  // Theme state
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  // Loaders
  const fetchSettings = async () => {
    try {
      const res = await api.get('/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data.data || {});
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      let query = `/admin/users?search=${encodeURIComponent(userSearch)}&role=${encodeURIComponent(roleFilter)}&warehouseId=${encodeURIComponent(whFilter)}`;
      const res = await api.get(query);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchWarehouses = async () => {
    setLoadingWarehouses(true);
    try {
      const res = await api.get('/admin/warehouses');
      if (res.ok) {
        const data = await res.json();
        setWarehouses(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch warehouses:', err);
    } finally {
      setLoadingWarehouses(false);
    }
  };

  const fetchTypes = async () => {
    setLoadingTypes(true);
    try {
      const res = await api.get('/admin/complaint-types');
      if (res.ok) {
        const data = await res.json();
        setTypesData(data.data || { types: [], subtypes: [] });
      }
    } catch (err) {
      console.error('Failed to fetch complaint types:', err);
    } finally {
      setLoadingTypes(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchUsers();
    fetchWarehouses();
    fetchTypes();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [userSearch, roleFilter, whFilter]);

  // Handle Settings Save
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccess('');
    try {
      const res = await api.put('/admin/settings', settings);
      const data = await res.json();
      if (res.ok) {
        setSettingsSuccess('System settings updated successfully!');
        setTimeout(() => setSettingsSuccess(''), 4000);
      } else {
        alert(data.message || 'Failed to update settings');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  // Handle User Create
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUserError('');
    setUserSuccess('');

    try {
      const res = await api.post('/admin/users', userForm);
      const data = await res.json();
      if (!res.ok) {
        setUserError(data.message || 'Failed to create user');
        return;
      }
      setUserSuccess('User created successfully!');
      setShowCreateUserModal(false);
      setUserForm({ email: '', password: '', firstName: '', lastName: '', role: 'Sales Executive', warehouseId: '' });
      fetchUsers();
    } catch (err) {
      setUserError('Server error creating user');
    }
  };

  // Handle User Edit
  const handleEditUser = async (e) => {
    e.preventDefault();
    setUserError('');
    try {
      const res = await api.put(`/admin/users/${selectedUser.id}`, {
        firstName: userForm.firstName,
        lastName: userForm.lastName,
        role: userForm.role,
        warehouseId: userForm.warehouseId
      });
      const data = await res.json();
      if (!res.ok) {
        setUserError(data.message || 'Failed to update user');
        return;
      }
      setUserSuccess('User updated successfully!');
      setShowEditUserModal(false);
      fetchUsers();
    } catch (err) {
      setUserError('Server error updating user');
    }
  };

  // Handle Toggle User Status
  const handleToggleStatus = async (targetUser) => {
    const newStatus = targetUser.status === 'Active' ? 'Inactive' : 'Active';
    if (!window.confirm(`Are you sure you want to set ${targetUser.email} to ${newStatus}?`)) return;

    try {
      const res = await api.patch(`/admin/users/${targetUser.id}/status`, { status: newStatus });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to toggle status');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setUserError('');
    try {
      const res = await api.post(`/admin/users/${selectedUser.id}/reset-password`, { newPassword: resetPasswordValue });
      const data = await res.json();
      if (!res.ok) {
        setUserError(data.message || 'Failed to reset password');
        return;
      }
      setUserSuccess(`Password for ${selectedUser.email} reset successfully!`);
      setShowResetPasswordModal(false);
      setResetPasswordValue('');
    } catch (err) {
      setUserError('Server error resetting password');
    }
  };

  // Handle Warehouse Create/Edit/Delete
  const handleSaveWarehouse = async (e) => {
    e.preventDefault();
    setWarehouseError('');
    setWarehouseSuccess('');

    try {
      if (editingWarehouse) {
        const res = await api.put(`/admin/warehouses/${editingWarehouse.id}`, warehouseForm);
        const data = await res.json();
        if (!res.ok) {
          setWarehouseError(data.message || 'Failed to update warehouse');
          return;
        }
        setWarehouseSuccess('Warehouse updated successfully!');
      } else {
        const res = await api.post('/admin/warehouses', warehouseForm);
        const data = await res.json();
        if (!res.ok) {
          setWarehouseError(data.message || 'Failed to create warehouse');
          return;
        }
        setWarehouseSuccess('Warehouse created successfully!');
      }
      setShowWarehouseModal(false);
      setEditingWarehouse(null);
      setWarehouseForm({ name: '', location: '' });
      fetchWarehouses();
    } catch (err) {
      setWarehouseError('Server error saving warehouse');
    }
  };

  const handleDeleteWarehouse = async (wh) => {
    if (!window.confirm(`Are you sure you want to delete warehouse "${wh.name}"?`)) return;
    setWarehouseError('');
    try {
      const res = await api.delete(`/admin/warehouses/${wh.id}`);
      const data = await res.json();
      if (!res.ok) {
        setWarehouseError(data.message || 'Cannot delete warehouse');
        return;
      }
      setWarehouseSuccess(`Warehouse "${wh.name}" deleted successfully.`);
      fetchWarehouses();
    } catch (err) {
      setWarehouseError('Server error deleting warehouse');
    }
  };

  // Handle Complaint Types & Subtypes Save
  const handleSaveType = async (e) => {
    e.preventDefault();
    setTypeError('');
    try {
      const res = await api.post('/admin/complaint-types', typeForm);
      const data = await res.json();
      if (!res.ok) {
        setTypeError(data.message || 'Failed to create complaint type');
        return;
      }
      setTypeSuccess('Complaint type created successfully!');
      setShowTypeModal(false);
      setTypeForm({ name: '', description: '' });
      fetchTypes();
    } catch (err) {
      setTypeError('Server error');
    }
  };

  const handleSaveSubtype = async (e) => {
    e.preventDefault();
    setTypeError('');
    try {
      const res = await api.post('/admin/complaint-subtypes', subtypeForm);
      const data = await res.json();
      if (!res.ok) {
        setTypeError(data.message || 'Failed to create complaint subtype');
        return;
      }
      setTypeSuccess('Complaint subtype created successfully!');
      setShowSubtypeModal(false);
      setSubtypeForm({ complaintTypeId: '', name: '' });
      fetchTypes();
    } catch (err) {
      setTypeError('Server error');
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  return (
    <div className="animate-fade-in" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
          Admin Control Center & Settings
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Manage organization users, warehouses, complaint categories, and dynamic SLA policies.
        </p>
      </div>

      {/* Settings Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px', overflowX: 'auto' }}>
        {canViewUsers && (
          <button
            onClick={() => setActiveTab('users')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 18px',
              fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === 'users' ? '2px solid var(--brand-primary)' : '2px solid transparent',
              color: activeTab === 'users' ? 'var(--brand-primary)' : 'var(--text-secondary)',
              backgroundColor: 'transparent'
            }}
          >
            <Users size={18} /> User Management
          </button>
        )}
        {canViewWarehouses && (
          <button
            onClick={() => setActiveTab('warehouses')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 18px',
              fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === 'warehouses' ? '2px solid var(--brand-primary)' : '2px solid transparent',
              color: activeTab === 'warehouses' ? 'var(--brand-primary)' : 'var(--text-secondary)',
              backgroundColor: 'transparent'
            }}
          >
            <Building2 size={18} /> Warehouse Management
          </button>
        )}
        {canViewCategories && (
          <button
            onClick={() => setActiveTab('categories')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 18px',
              fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === 'categories' ? '2px solid var(--brand-primary)' : '2px solid transparent',
              color: activeTab === 'categories' ? 'var(--brand-primary)' : 'var(--text-secondary)',
              backgroundColor: 'transparent'
            }}
          >
            <Layers size={18} /> Complaint Categories
          </button>
        )}
        {canViewSla && (
          <button
            onClick={() => setActiveTab('sla')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 18px',
              fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === 'sla' ? '2px solid var(--brand-primary)' : '2px solid transparent',
              color: activeTab === 'sla' ? 'var(--brand-primary)' : 'var(--text-secondary)',
              backgroundColor: 'transparent'
            }}
          >
            <Clock size={18} /> SLA Configuration
          </button>
        )}
        <button
          onClick={() => setActiveTab('theme')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 18px',
            fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer',
            borderBottom: activeTab === 'theme' ? '2px solid var(--brand-primary)' : '2px solid transparent',
            color: activeTab === 'theme' ? 'var(--brand-primary)' : 'var(--text-secondary)',
            backgroundColor: 'transparent'
          }}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />} Appearance & Theme
        </button>
      </div>

      {/* Global Alerts */}
      {userSuccess && (
        <div style={{ padding: '12px 16px', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10B981', color: '#10B981', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontWeight: '600' }}>
          {userSuccess}
        </div>
      )}
      {warehouseSuccess && (
        <div style={{ padding: '12px 16px', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10B981', color: '#10B981', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontWeight: '600' }}>
          {warehouseSuccess}
        </div>
      )}
      {warehouseError && (
        <div style={{ padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #EF4444', color: '#EF4444', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontWeight: '600' }}>
          {warehouseError}
        </div>
      )}

      {/* TAB A: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div style={{ backgroundColor: 'var(--bg-primary)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>System User Accounts</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Manage all Sales Executives, Warehouse Team Members, Managers, and Administrators.</p>
            </div>
            {canWriteUsers && (
              <button
                onClick={() => {
                  setUserError('');
                  setUserForm({ email: '', password: '', firstName: '', lastName: '', role: 'Sales Executive', warehouseId: '' });
                  setShowCreateUserModal(true);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                  borderRadius: '8px', backgroundColor: 'var(--brand-primary)', color: '#FFFFFF',
                  fontWeight: '600', fontSize: '13px', border: 'none', cursor: 'pointer'
                }}
              >
                <Plus size={16} /> Create New User
              </button>
            )}
          </div>

          {/* Search & Filters Toolbar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search name, email, username..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px',
                  border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box'
                }}
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{
                padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px'
              }}
            >
              <option value="">All Roles</option>
              <option value="Sales Executive">Sales Executive</option>
              <option value="Warehouse Team">Warehouse Team</option>
              <option value="Warehouse Manager">Warehouse Manager</option>
              <option value="Administrator">Administrator</option>
            </select>

            <select
              value={whFilter}
              onChange={(e) => setWhFilter(e.target.value)}
              style={{
                padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px'
              }}
            >
              <option value="">All Warehouses</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          {/* User Table */}
          <div style={{ overflowX: 'auto' }} className="scrollbar-thin">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', minWidth: '900px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 10px' }}>User Name</th>
                  <th style={{ padding: '12px 10px' }}>Email</th>
                  <th style={{ padding: '12px 10px' }}>Role</th>
                  <th style={{ padding: '12px 10px' }}>Assigned Warehouse</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Loading system users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No matching user accounts found.
                    </td>
                  </tr>
                ) : (
                  users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 10px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {u.first_name} {u.last_name}
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>@{u.username}</span>
                      </td>
                      <td style={{ padding: '12px 10px', color: 'var(--text-secondary)' }}>{u.email}</td>
                      <td style={{ padding: '12px 10px', fontWeight: '500' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600',
                          backgroundColor: u.role === 'Administrator' ? 'rgba(139, 92, 246, 0.15)' : u.role === 'Warehouse Manager' ? 'rgba(245, 158, 11, 0.15)' : 'var(--brand-primary-light, rgba(27, 67, 50, 0.15))',
                          color: u.role === 'Administrator' ? '#8B5CF6' : u.role === 'Warehouse Manager' ? '#D97706' : 'var(--brand-primary)'
                        }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px', color: 'var(--text-secondary)' }}>{u.warehouse_name || 'N/A (Global)'}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600',
                          backgroundColor: u.status === 'Active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: u.status === 'Active' ? '#10B981' : '#EF4444'
                        }}>
                          {u.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                        {canWriteUsers ? (
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              title="Edit User Role/Warehouse"
                              onClick={() => {
                                setSelectedUser(u);
                                setUserForm({
                                  email: u.email,
                                  password: '',
                                  firstName: u.first_name,
                                  lastName: u.last_name,
                                  role: u.role,
                                  warehouseId: u.warehouse_id || ''
                                });
                                setShowEditUserModal(true);
                              }}
                              style={{ padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', cursor: 'pointer' }}
                            >
                              <Edit2 size={14} style={{ color: 'var(--text-secondary)' }} />
                            </button>

                            <button
                              title={u.status === 'Active' ? 'Deactivate User Account' : 'Reactivate User Account'}
                              onClick={() => handleToggleStatus(u)}
                              style={{ padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', cursor: 'pointer' }}
                            >
                              {u.status === 'Active' ? <UserX size={14} style={{ color: '#EF4444' }} /> : <UserCheck size={14} style={{ color: '#10B981' }} />}
                            </button>

                            <button
                              title="Reset User Password"
                              onClick={() => {
                                setSelectedUser(u);
                                setResetPasswordValue('');
                                setShowResetPasswordModal(true);
                              }}
                              style={{ padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', cursor: 'pointer' }}
                            >
                              <Key size={14} style={{ color: '#F59E0B' }} />
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Read-Only</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB B: WAREHOUSE MANAGEMENT */}
      {activeTab === 'warehouses' && (
        <div style={{ backgroundColor: 'var(--bg-primary)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Warehouse Facilities</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Manage physical warehouse locations, team staffing, and complaint scoping.</p>
            </div>
            {canWriteWarehouses && (
              <button
                onClick={() => {
                  setEditingWarehouse(null);
                  setWarehouseForm({ name: '', location: '' });
                  setWarehouseError('');
                  setShowWarehouseModal(true);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                  borderRadius: '8px', backgroundColor: 'var(--brand-primary)', color: '#FFFFFF',
                  fontWeight: '600', fontSize: '13px', border: 'none', cursor: 'pointer'
                }}
              >
                <Plus size={16} /> Add New Warehouse
              </button>
            )}
          </div>

          <div style={{ overflowX: 'auto' }} className="scrollbar-thin">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', minWidth: '700px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 10px' }}>Warehouse Name</th>
                  <th style={{ padding: '12px 10px' }}>Location</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center' }}>Team Members</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center' }}>Managers</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center' }}>Total Complaints</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingWarehouses ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Loading warehouses...
                    </td>
                  </tr>
                ) : (
                  warehouses.map(w => (
                    <tr key={w.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 10px', fontWeight: '700', color: 'var(--text-primary)' }}>{w.name}</td>
                      <td style={{ padding: '12px 10px', color: 'var(--text-secondary)' }}>{w.location}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '600', color: 'var(--brand-primary)' }}>{w.teamMemberCount}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '600', color: '#F59E0B' }}>{w.managerCount}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '600', color: 'var(--text-primary)' }}>{w.totalComplaints}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                        {canWriteWarehouses ? (
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => {
                                setEditingWarehouse(w);
                                setWarehouseForm({ name: w.name, location: w.location });
                                setWarehouseError('');
                                setShowWarehouseModal(true);
                              }}
                              style={{ padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', cursor: 'pointer' }}
                            >
                              <Edit2 size={14} style={{ color: 'var(--text-secondary)' }} />
                            </button>
                            <button
                              onClick={() => handleDeleteWarehouse(w)}
                              style={{ padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', cursor: 'pointer' }}
                            >
                              <Trash2 size={14} style={{ color: '#EF4444' }} />
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Read-Only</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB C: COMPLAINT TYPES & SUBTYPES */}
      {activeTab === 'categories' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
          {/* Complaint Types Column */}
          <div style={{ backgroundColor: 'var(--bg-primary)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Complaint Types</h2>
              {canWriteCategories && (
                <button
                  onClick={() => { setTypeError(''); setShowTypeModal(true); }}
                  style={{ padding: '8px 14px', borderRadius: '6px', backgroundColor: 'var(--brand-primary)', color: '#FFF', fontSize: '12px', fontWeight: '600', border: 'none', cursor: 'pointer' }}
                >
                  + Add Type
                </button>
              )}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>ID</th>
                  <th style={{ padding: '8px' }}>Type Name</th>
                  <th style={{ padding: '8px' }}>Description</th>
                </tr>
              </thead>
              <tbody>
                {typesData.types.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{t.id}</td>
                    <td style={{ padding: '8px', fontWeight: '600', color: 'var(--text-primary)' }}>{t.name}</td>
                    <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{t.description || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Subtypes Column */}
          <div style={{ backgroundColor: 'var(--bg-primary)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Complaint Subtypes</h2>
              {canWriteCategories && (
                <button
                  onClick={() => { setTypeError(''); setShowSubtypeModal(true); }}
                  style={{ padding: '8px 14px', borderRadius: '6px', backgroundColor: 'var(--brand-primary)', color: '#FFF', fontSize: '12px', fontWeight: '600', border: 'none', cursor: 'pointer' }}
                >
                  + Add Subtype
                </button>
              )}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>Subtype Name</th>
                  <th style={{ padding: '8px' }}>Parent Type</th>
                </tr>
              </thead>
              <tbody>
                {typesData.subtypes.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '8px', fontWeight: '600', color: 'var(--text-primary)' }}>{s.name}</td>
                    <td style={{ padding: '8px', color: 'var(--brand-primary)', fontWeight: '500' }}>{s.type_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB D: DYNAMIC SLA CONFIGURATION */}
      {activeTab === 'sla' && (
        <div style={{ backgroundColor: 'var(--bg-primary)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', maxWidth: '700px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>Dynamic SLA & Escalation Settings</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Configure default resolution SLA windows and dashboard alert color thresholds. Changes apply dynamically to new complaints.
          </p>

          {settingsSuccess && (
            <div style={{ padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10B981', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontWeight: '600' }}>
              {settingsSuccess}
            </div>
          )}

          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                Standard SLA Window (Hours)
              </label>
              <input
                type="number"
                min="1"
                max="168"
                disabled={!canWriteSla}
                value={settings.sla_window_hours || '24'}
                onChange={(e) => setSettings({ ...settings, sla_window_hours: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                New complaints raised will automatically calculate resolution deadline as (Raised Time + SLA Window).
              </span>
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                Green Status Threshold (Hours Remaining)
              </label>
              <input
                type="number"
                disabled={!canWriteSla}
                value={settings.sla_threshold_green_hours || '12'}
                onChange={(e) => setSettings({ ...settings, sla_threshold_green_hours: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                Amber Status Threshold (Hours Remaining)
              </label>
              <input
                type="number"
                disabled={!canWriteSla}
                value={settings.sla_threshold_amber_hours || '6'}
                onChange={(e) => setSettings({ ...settings, sla_threshold_amber_hours: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              />
            </div>

            {canWriteSla && (
              <button
                type="submit"
                disabled={savingSettings}
                style={{
                  padding: '12px 24px', borderRadius: '8px', backgroundColor: 'var(--brand-primary)',
                  color: '#FFF', fontWeight: '700', border: 'none', cursor: 'pointer', alignSelf: 'flex-start'
                }}
              >
                {savingSettings ? 'Saving Settings...' : 'Save SLA Settings'}
              </button>
            )}
          </form>
        </div>
      )}

      {/* TAB E: THEME PREFERENCE */}
      {activeTab === 'theme' && (
        <div style={{ backgroundColor: 'var(--bg-primary)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', maxWidth: '600px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>Appearance & Theme Preference</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Customize your visual workspace theme interface.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {theme === 'dark' ? <Moon size={24} style={{ color: '#818CF8' }} /> : <Sun size={24} style={{ color: '#F59E0B' }} />}
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  Current Theme: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Toggle interface visual theme
                </div>
              </div>
            </div>

            <button
              onClick={toggleTheme}
              style={{
                padding: '8px 16px', borderRadius: '8px', backgroundColor: 'var(--brand-primary)',
                color: '#FFF', fontWeight: '600', border: 'none', cursor: 'pointer', fontSize: '13px'
              }}
            >
              Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode
            </button>
          </div>
        </div>
      )}

      {/* MODAL: CREATE USER */}
      {showCreateUserModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: 'var(--bg-primary)', width: '100%', maxWidth: '500px', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Create New User Account</h3>
              <button onClick={() => setShowCreateUserModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>

            {userError && <div style={{ padding: '10px', backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444', borderRadius: '6px', marginBottom: '12px', fontSize: '12px', fontWeight: '600' }}>{userError}</div>}

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Email Address *</label>
                <input required type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Initial Password * (Min 8 chars)</label>
                <input required type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>First Name *</label>
                  <input required type="text" value={userForm.firstName} onChange={e => setUserForm({ ...userForm, firstName: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Last Name *</label>
                  <input required type="text" value={userForm.lastName} onChange={e => setUserForm({ ...userForm, lastName: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>System Role *</label>
                <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }}>
                  <option value="Sales Executive">Sales Executive</option>
                  <option value="Warehouse Team">Warehouse Team</option>
                  <option value="Warehouse Manager">Warehouse Manager</option>
                  <option value="Administrator">Administrator</option>
                </select>
              </div>

              {['Warehouse Team', 'Warehouse Manager'].includes(userForm.role) && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Assigned Warehouse *</label>
                  <select required value={userForm.warehouseId} onChange={e => setUserForm({ ...userForm, warehouseId: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }}>
                    <option value="">Select Warehouse...</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowCreateUserModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'var(--brand-primary)', color: '#FFF', fontWeight: '600', border: 'none', cursor: 'pointer' }}>Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT USER */}
      {showEditUserModal && selectedUser && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: 'var(--bg-primary)', width: '100%', maxWidth: '500px', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Edit User Details</h3>
              <button onClick={() => setShowEditUserModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>

            {userError && <div style={{ padding: '10px', backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444', borderRadius: '6px', marginBottom: '12px', fontSize: '12px' }}>{userError}</div>}

            <form onSubmit={handleEditUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>First Name</label>
                  <input required type="text" value={userForm.firstName} onChange={e => setUserForm({ ...userForm, firstName: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Last Name</label>
                  <input required type="text" value={userForm.lastName} onChange={e => setUserForm({ ...userForm, lastName: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>System Role</label>
                <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }}>
                  <option value="Sales Executive">Sales Executive</option>
                  <option value="Warehouse Team">Warehouse Team</option>
                  <option value="Warehouse Manager">Warehouse Manager</option>
                  <option value="Administrator">Administrator</option>
                </select>
              </div>

              {['Warehouse Team', 'Warehouse Manager'].includes(userForm.role) && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Assigned Warehouse</label>
                  <select value={userForm.warehouseId} onChange={e => setUserForm({ ...userForm, warehouseId: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }}>
                    <option value="">Select Warehouse...</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowEditUserModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'var(--brand-primary)', color: '#FFF', fontWeight: '600', border: 'none', cursor: 'pointer' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET PASSWORD */}
      {showResetPasswordModal && selectedUser && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: 'var(--bg-primary)', width: '100%', maxWidth: '420px', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Reset User Password</h3>
              <button onClick={() => setShowResetPasswordModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Set a new temporary password for <strong>{selectedUser.email}</strong>.
            </p>

            {userError && <div style={{ padding: '10px', backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444', borderRadius: '6px', marginBottom: '12px', fontSize: '12px' }}>{userError}</div>}

            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>New Password (Min 8 chars)</label>
                <input required type="password" value={resetPasswordValue} onChange={e => setResetPasswordValue(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowResetPasswordModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: '#F59E0B', color: '#FFF', fontWeight: '600', border: 'none', cursor: 'pointer' }}>Reset Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE/EDIT WAREHOUSE */}
      {showWarehouseModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: 'var(--bg-primary)', width: '100%', maxWidth: '450px', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{editingWarehouse ? 'Edit Warehouse' : 'Add New Warehouse'}</h3>
              <button onClick={() => setShowWarehouseModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>

            {warehouseError && <div style={{ padding: '10px', backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444', borderRadius: '6px', marginBottom: '12px', fontSize: '12px' }}>{warehouseError}</div>}

            <form onSubmit={handleSaveWarehouse} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Warehouse Name *</label>
                <input required type="text" value={warehouseForm.name} onChange={e => setWarehouseForm({ ...warehouseForm, name: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Location / City *</label>
                <input required type="text" value={warehouseForm.location} onChange={e => setWarehouseForm({ ...warehouseForm, location: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowWarehouseModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'var(--brand-primary)', color: '#FFF', fontWeight: '600', border: 'none', cursor: 'pointer' }}>Save Warehouse</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE COMPLAINT TYPE */}
      {showTypeModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: 'var(--bg-primary)', width: '100%', maxWidth: '420px', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Add Complaint Type</h3>
              <button onClick={() => setShowTypeModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            {typeError && <div style={{ padding: '10px', backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444', borderRadius: '6px', marginBottom: '12px', fontSize: '12px' }}>{typeError}</div>}

            <form onSubmit={handleSaveType} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Type Name *</label>
                <input required type="text" value={typeForm.name} onChange={e => setTypeForm({ ...typeForm, name: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Description</label>
                <input type="text" value={typeForm.description} onChange={e => setTypeForm({ ...typeForm, description: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowTypeModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'var(--brand-primary)', color: '#FFF', fontWeight: '600', border: 'none', cursor: 'pointer' }}>Create Type</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE COMPLAINT SUBTYPE */}
      {showSubtypeModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: 'var(--bg-primary)', width: '100%', maxWidth: '420px', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Add Complaint Subtype</h3>
              <button onClick={() => setShowSubtypeModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            {typeError && <div style={{ padding: '10px', backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444', borderRadius: '6px', marginBottom: '12px', fontSize: '12px' }}>{typeError}</div>}

            <form onSubmit={handleSaveSubtype} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Parent Complaint Type *</label>
                <select required value={subtypeForm.complaintTypeId} onChange={e => setSubtypeForm({ ...subtypeForm, complaintTypeId: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }}>
                  <option value="">Select Parent Type...</option>
                  {typesData.types.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Subtype Name *</label>
                <input required type="text" value={subtypeForm.name} onChange={e => setSubtypeForm({ ...subtypeForm, name: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowSubtypeModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'var(--brand-primary)', color: '#FFF', fontWeight: '600', border: 'none', cursor: 'pointer' }}>Create Subtype</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;

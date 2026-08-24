import React from 'react';
import { 
  Grid, PlusCircle, FileText, Bell, MessageSquare, BarChart3, Settings, LogOut, ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ activeTab, setActiveTab, handleLogout, isDesktop, sidebarOpen, onCloseSidebar, unreadMessagesCount }) => {
  const { user } = useAuth();

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return (user.firstName[0] + user.lastName[0]).toUpperCase();
    }
    return 'KS';
  };

  const getUserName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return 'Karthik S.';
  };

  const getUserRole = () => {
    return user?.role || 'Warehouse Team';
  };

  const getUserDetailsText = () => {
    const role = getUserRole();
    if (role === 'Warehouse Team' || role === 'Warehouse Manager') {
      if (user?.warehouseName) {
        return `${role} • ${user.warehouseName}`;
      }
    }
    return role;
  };

  const renderSidebarContent = () => {
    const isSalesExec = user?.role === 'Sales Executive';
    const isWarehouseTeam = user?.role === 'Warehouse Team';
    const isWarehouseManager = user?.role === 'Warehouse Manager' || user?.role === 'Manager';
    const isAdmin = user?.role === 'Administrator' || user?.role === 'Admin';

    const allNavItems = [
      { name: 'Dashboard', icon: <Grid size={18} /> },
      { name: 'Raise Complaint', icon: <PlusCircle size={18} />, salesOnly: true },
      { name: 'My Complaints', icon: <FileText size={18} />, teamOnly: true },
      { name: 'Escalated Complaints', icon: <FileText size={18} />, managerOnly: true },
      { name: 'Notifications', icon: <Bell size={18} />, badge: unreadMessagesCount, badgeType: 'normal' },
      { name: 'Messages', icon: <MessageSquare size={18} />, badge: unreadMessagesCount, badgeType: 'high' },
      { name: 'Reports', icon: <BarChart3 size={18} /> },
      { name: 'Access Control', icon: <ShieldCheck size={18} />, adminOnly: true },
      { name: 'Settings', icon: <Settings size={18} />, adminOnly: true }
    ];

    const navItems = allNavItems.filter(item => {
      if (item.salesOnly && !isSalesExec) return false;
      if (item.teamOnly && !isWarehouseTeam) return false;
      if (item.managerOnly && !isWarehouseManager) return false;
      if (item.adminOnly && !isAdmin) return false;
      return true;
    });

    return (
      <div 
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%', 
          justifyContent: 'space-between',
          boxSizing: 'border-box'
        }}
      >
        {/* Navigation flat list */}
        <div 
          style={{ 
            padding: '16px 12px', 
            overflowY: 'auto', 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column',
            boxSizing: 'border-box'
          }}
          className="scrollbar-thin"
        >
          {navItems.map(item => {
            const isActive = activeTab === item.name;
            return (
              <button
                key={item.name}
                onClick={() => { setActiveTab(item.name); if (!isDesktop) onCloseSidebar(); }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: isActive ? 'var(--brand-primary)' : 'transparent',
                  color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                  marginBottom: '4px', // Critical gap to prevent visual overlap
                  transition: 'background-color 200ms cubic-bezier(0.16, 1, 0.3, 1), color 200ms ease, transform 150ms ease',
                  boxSizing: 'border-box'
                }}
                type="button"
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', color: isActive ? '#FFFFFF' : 'var(--text-secondary)' }}>
                    {item.icon}
                  </span>
                  <span style={{ whiteSpace: 'nowrap' }}>{item.name}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span 
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: item.badgeType === 'high' ? '#EF4444' : 'var(--bg-secondary)',
                      color: item.badgeType === 'high' ? '#FFFFFF' : 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      lineHeight: 1
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom User Card & Sign Out (Docked) */}
        <div 
          style={{ 
            padding: '16px 12px', 
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            backgroundColor: 'var(--bg-primary)'
          }}
        >
          {/* User profile layout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div 
              style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontWeight: 'bold', 
                fontSize: '13px',
                backgroundColor: '#4F7CFF', 
                color: '#FFFFFF'
              }}
            >
              {getInitials()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', lineHeight: 1.3, flex: 1 }}>
              <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }} title={getUserName()}>{getUserName()}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }} title={getUserDetailsText()}>{getUserDetailsText()}</span>
            </div>
          </div>

          {/* Sign Out link with identical padding/alignment */}
          <button 
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              textAlign: 'left',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              marginTop: '8px',
              transition: 'background-color 150ms ease, color 150ms ease',
              whiteSpace: 'nowrap',
              boxSizing: 'border-box'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F3F4F6';
              e.currentTarget.style.color = '#EF4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#6B7280';
            }}
            type="button"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  };

  if (isDesktop) {
    return (
      <aside 
        style={{ 
          width: '220px', 
          flexShrink: 0, 
          height: 'calc(100vh - 64px)', 
          position: 'fixed', 
          top: '64px', 
          left: 0,
          borderRight: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-primary)',
          userSelect: 'none',
          boxSizing: 'border-box',
          overflowY: 'hidden',
          zIndex: 10
        }}
      >
        {renderSidebarContent()}
      </aside>
    );
  }

  if (!sidebarOpen) return null;

  return (
    <>
      <div 
        onClick={onCloseSidebar}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}
      />
      <aside 
        className="animate-slide-in-left"
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '220px',
          backgroundColor: 'var(--bg-primary)', 
          zIndex: 1001,
          boxShadow: 'var(--shadow-lg)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          userSelect: 'none'
        }}
      >
        {renderSidebarContent()}
      </aside>
    </>
  );
};

export default Sidebar;

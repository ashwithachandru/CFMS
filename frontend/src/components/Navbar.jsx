import React, { useState, useEffect } from 'react';
import { Bell, ChevronDown, MessageSquare, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from './common/ThemeToggle';
import { api } from '../services/api';

const Navbar = ({ profileDropdownOpen, setProfileDropdownOpen, handleLogout, onToggleSidebar, isDesktop, unreadCount = 0, onNotificationSelect }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const shouldReduceMotion = useReducedMotion();
  const [bellWiggle, setBellWiggle] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!notificationsOpen) return;

    const fetchNotifications = async () => {
      try {
        const res = await api.get('/messages/notifications');
        if (res.ok) {
          const result = await res.json();
          setNotifications(result.data.notifications || []);
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    };

    fetchNotifications();
  }, [notificationsOpen]);

  const triggerBellClick = () => {
    if (!shouldReduceMotion) {
      setBellWiggle(true);
      setTimeout(() => setBellWiggle(false), 450);
    }
    setNotificationsOpen(!notificationsOpen);
  };

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return (user.firstName[0] + user.lastName[0]).toUpperCase();
    }
    return 'SE';
  };

  const getUserName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return 'User';
  };

  const getUserRole = () => {
    return user?.role || 'Sales Executive';
  };

  return (
    <header 
      style={{ 
        height: '64px',
        backgroundColor: 'var(--brand-primary)',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        width: '100%',
        boxSizing: 'border-box',
        whiteSpace: 'nowrap',
        userSelect: 'none'
      }}
    >
      {/* Left side: Hamburger menu (if mobile) + RC Logo square + Title/Subtitle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {!isDesktop && (
          <button
            onClick={onToggleSidebar}
            style={{ 
              width: '36px', 
              height: '36px', 
              background: 'transparent', 
              border: 'none', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              marginRight: '4px',
              padding: 0,
              borderRadius: '8px'
            }}
            type="button"
          >
            <span style={{ fontSize: '20px', fontWeight: 'bold' }}>☰</span>
          </button>
        )}
        
        {/* White square logo badge */}
        <div 
          style={{ 
            width: '36px', 
            height: '36px', 
            borderRadius: '8px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontWeight: 'bold', 
            fontSize: '16px',
            backgroundColor: '#FFFFFF', 
            color: '#1B4332'
          }}
        >
          RC
        </div>

        {/* Two-line text stack */}
        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '4px', lineHeight: 1.1, textAlign: 'left' }}>
          <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#FFFFFF' }}>Ramraj Cotton CFMS</span>
          <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#A7D7C5', marginTop: '2px' }}>
            Complaint Lifecycle Automation & Escalation
          </span>
        </div>
      </div>

      {/* Right side: Role/Location, Theme toggle, Bell icon, User avatar & dropdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        
        {/* Role text */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22C55E', display: 'inline-block' }}></span>
          <span style={{ fontSize: '14px', color: '#FFFFFF', fontWeight: 'normal' }}>{getUserRole()}</span>
        </div>

        {/* Dot separator & Location text (only for warehouse roles) */}
        {(getUserRole() === 'Warehouse Team' || getUserRole() === 'Warehouse Manager') && (
          <>
            {/* Dot separator */}
            <span style={{ fontSize: '14px', color: '#FFFFFF', opacity: 0.8 }}>·</span>

            {/* Location text */}
            <span style={{ fontSize: '14px', color: '#FFFFFF', fontWeight: 'normal' }}>
              {user?.warehouseName || 'Tirupur Warehouse'}
            </span>
          </>
        )}

        {/* Navbar Theme Toggle */}
        <ThemeToggle style={{ borderColor: 'rgba(255, 255, 255, 0.3)', color: '#FFFFFF' }} />

        {/* Bell Icon with Unread Count Badge & Dropdown */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <motion.button 
            onClick={triggerBellClick}
            animate={bellWiggle ? { rotate: [0, -10, 10, -6, 6, 0] } : {}}
            transition={{ duration: 0.45, ease: "easeInOut" }}
            whileHover={shouldReduceMotion ? {} : { scale: 1.1 }}
            whileTap={shouldReduceMotion ? {} : { scale: 0.9 }}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              cursor: 'pointer', 
              padding: '6px', 
              borderRadius: '8px',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}
            type="button"
          >
            <Bell size={20} style={{ color: '#FFFFFF' }} />
            {unreadCount > 0 && (
              <span 
                style={{ 
                  position: 'absolute', 
                  top: '-2px', 
                  right: '-2px', 
                  backgroundColor: '#EF4444', 
                  color: '#FFFFFF',
                  borderRadius: '50%',
                  minWidth: '16px',
                  height: '16px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  border: '2px solid var(--brand-primary)'
                }}
              >
                {unreadCount}
              </span>
            )}
          </motion.button>

          {/* Notifications Dropdown */}
          <AnimatePresence>
            {notificationsOpen && (
              <motion.div 
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.95 }}
                animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                style={{ 
                  position: 'absolute', 
                  right: 0, 
                  top: '100%', 
                  marginTop: '8px', 
                  width: '320px', 
                  backgroundColor: 'var(--bg-primary)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '12px', 
                  boxShadow: 'var(--shadow-lg)', 
                  padding: '12px', 
                  zIndex: 2000,
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)' }}>Notifications</span>
                  <span style={{ fontSize: '11px', color: 'var(--brand-primary)', fontWeight: '600' }}>{unreadCount} Unread</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                      No recent notifications
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.id}
                        onClick={() => {
                          setNotificationsOpen(false);
                          if (onNotificationSelect) onNotificationSelect(n.complaint_id, n.sender_id);
                        }}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          backgroundColor: n.read_status === 'Unread' ? 'var(--bg-secondary)' : 'transparent',
                          border: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MessageSquare size={12} style={{ color: 'var(--brand-primary)' }} />
                          <span>{n.title}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {n.preview}
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Profile Menu Dropdown */}
        <div style={{ position: 'relative' }}>
          <motion.button 
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            whileHover={shouldReduceMotion ? {} : { scale: 1.02 }}
            whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '4px 8px',
              borderRadius: '8px',
              color: '#FFFFFF'
            }}
            type="button"
          >
            <div 
              style={{ 
                width: '34px', 
                height: '34px', 
                borderRadius: '50%', 
                backgroundColor: '#FFFFFF',
                color: '#1B4332',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '14px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}
            >
              {getInitials()}
            </div>
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#FFFFFF' }}>{getUserName()}</span>
            <ChevronDown size={16} style={{ color: '#FFFFFF', transform: profileDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease' }} />
          </motion.button>

          <AnimatePresence>
            {profileDropdownOpen && (
              <motion.div 
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.95 }}
                animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                style={{ 
                  position: 'absolute', 
                  right: 0, 
                  top: '100%', 
                  marginTop: '8px', 
                  width: '200px', 
                  backgroundColor: 'var(--bg-primary)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '12px', 
                  boxShadow: 'var(--shadow-lg)', 
                  padding: '8px 0', 
                  zIndex: 2000,
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{getUserName()}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{getUserRole()}</div>
                </div>
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    background: 'transparent',
                    color: '#EF4444',
                    fontWeight: '600',
                    fontSize: '13px',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                  type="button"
                >
                  Sign Out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

export default Navbar;

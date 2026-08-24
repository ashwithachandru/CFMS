import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { api, setAccessToken, registerLogoutHandler } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await api.get('/admin/rbac/my-permissions');
      if (res.ok) {
        const body = await res.json();
        if (body.success) {
          setPermissions(body.data || {});
        }
      }
    } catch (err) {
      console.error('Failed to fetch user permissions:', err);
    }
  }, []);

  const refreshPermissions = useCallback(async () => {
    await fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = useCallback((moduleKey, action = 'read') => {
    if (!user) return false;
    const modulePerm = permissions[moduleKey];

    // Administrator fallback if permissions map isn't fully loaded yet
    if (user.role === 'Administrator' && !modulePerm) {
      if (moduleKey === 'audit_logs' && action === 'write') return false;
      return true;
    }

    if (!modulePerm) return false;
    return action === 'write' ? Boolean(modulePerm.canWrite) : Boolean(modulePerm.canRead);
  }, [user, permissions]);

  const logout = useCallback(async () => {
    try {
      if (localStorage.getItem('user_logged_in') === 'true') {
        await api.post('/auth/logout');
      }
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      setUser(null);
      setPermissions({});
      setAccessToken('');
      localStorage.removeItem('user_logged_in');
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const response = await api.post('/auth/refresh');
      if (response.ok) {
        const result = await response.json();
        const token = result.data.accessToken;
        setAccessToken(token);
        
        // Fetch current user details
        const meResponse = await api.get('/auth/me');
        if (meResponse.ok) {
          const meResult = await meResponse.json();
          const fetchedUser = meResult.data.user;
          setUser({
            id: fetchedUser.id,
            username: fetchedUser.username,
            email: fetchedUser.email,
            firstName: fetchedUser.first_name,
            lastName: fetchedUser.last_name,
            role: fetchedUser.role || fetchedUser.role_name,
            warehouseId: fetchedUser.warehouse_id,
            warehouseName: fetchedUser.warehouse_name
          });
          localStorage.setItem('user_logged_in', 'true');

          // Fetch permissions for the logged in user
          await fetchPermissions();
          return token;
        }
      }
    } catch (err) {
      console.error('Session refresh failed:', err.message);
    }
    return null;
  }, [fetchPermissions]);

  // Initialize and check active session on app mount
  useEffect(() => {
    registerLogoutHandler(logout);
    
    const initAuth = async () => {
      const loggedInFlag = localStorage.getItem('user_logged_in');
      if (loggedInFlag === 'true') {
        await refreshSession();
      }
      setLoading(false);
    };

    initAuth();
  }, [refreshSession, logout]);

  // Periodic proactive token refresh (every 14 minutes)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      console.log('Proactive token refresh cycle triggered...');
      refreshSession();
    }, 14 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, refreshSession]);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Login failed');
    }
    const result = await response.json();
    const fetchedUser = result.data.user;
    
    setAccessToken(result.data.accessToken);
    setUser(fetchedUser);
    localStorage.setItem('user_logged_in', 'true');

    // Fetch effective permissions after login
    await fetchPermissions();
    return result;
  };

  const register = async (userData) => {
    const response = await api.post('/auth/register', userData);
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(result.message || 'Registration failed');
      error.errors = result.errors;
      throw error;
    }
    return result;
  };

  const forgotPassword = async (email) => {
    const response = await api.post('/auth/forgot-password', { email });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Forgot password request failed');
    }
    return await response.json();
  };

  const verifyOtp = async (email, otp) => {
    const response = await api.post('/auth/verify-otp', { email, otp });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'OTP verification failed');
    }
    return await response.json();
  };

  const resetPassword = async (token, password) => {
    const response = await api.post('/auth/reset-password', { token, password });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Reset password request failed');
    }
    return await response.json();
  };

  const changePassword = async (currentPassword, newPassword) => {
    const response = await api.post('/auth/change-password', { currentPassword, newPassword });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Password change request failed');
    }
    return await response.json();
  };

  const updateLocalTheme = useCallback((newTheme) => {
    setUser(prev => prev ? { ...prev, themePreference: newTheme } : null);
  }, []);

  const value = {
    user,
    permissions,
    refreshPermissions,
    hasPermission,
    loading,
    login,
    logout,
    register,
    forgotPassword,
    verifyOtp,
    resetPassword,
    changePassword,
    updateLocalTheme,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

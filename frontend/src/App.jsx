import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';

import RaiseComplaint from './pages/RaiseComplaint';

import Reports from './pages/Reports';

function App() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const checkOverflow = () => {
      console.log('Overflow check:', document.body.scrollWidth, 'vs', window.innerWidth);
    };
    window.addEventListener('resize', checkOverflow);
    // Timeout to make sure render/paint cycles have completed
    const t = setTimeout(checkOverflow, 1500);
    return () => {
      window.removeEventListener('resize', checkOverflow);
      clearTimeout(t);
    };
  }, []);

  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} 
      />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      {/* Protected Routes */}
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />

      <Route 
        path="/reports" 
        element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/raise-complaint" 
        element={
          <ProtectedRoute>
            <RaiseComplaint />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/complaints" 
        element={
          <ProtectedRoute>
            <RaiseComplaint />
          </ProtectedRoute>
        } 
      />

      <Route 
        path="/change-password" 
        element={
          <ProtectedRoute>
            <ChangePassword />
          </ProtectedRoute>
        } 
      />

      {/* Catch-all redirects to Dashboard (which redirects to Login if unauthenticated) */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;

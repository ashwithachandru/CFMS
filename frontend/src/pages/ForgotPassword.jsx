import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Mail, ArrowLeft, Lock, Eye, EyeOff, CheckCircle, RefreshCw, ShieldCheck } from 'lucide-react';

// ─── Password complexity rules ────────────────────────────────────────────────
const COMPLEXITY_RULES = [
  { id: 'length',    label: 'At least 8 characters',           test: (p) => p.length >= 8 },
  { id: 'digit',     label: 'At least one digit (0–9)',         test: (p) => /[0-9]/.test(p) },
  { id: 'uppercase', label: 'At least one uppercase letter',    test: (p) => /[A-Z]/.test(p) },
  { id: 'special',   label: 'At least one special character',  test: (p) => /[!@#$%^&*()\-_+=\[\]{};:'"<>,.?/\\|`~]/.test(p) },
];

function PasswordChecklist({ password }) {
  return (
    <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {COMPLEXITY_RULES.map((rule) => {
        const met = password.length > 0 && rule.test(password);
        return (
          <li key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: met ? '#22c55e' : 'var(--text-secondary)', transition: 'color 200ms ease' }}>
            <span style={{ width: '14px', height: '14px', borderRadius: '50%', border: `2px solid ${met ? '#22c55e' : 'var(--border-card)'}`, background: met ? '#22c55e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 200ms ease' }}>
              {met && <span style={{ width: '6px', height: '6px', background: 'white', borderRadius: '50%' }} />}
            </span>
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────
const STEP_EMAIL = 'email';
const STEP_OTP   = 'otp';
const STEP_RESET = 'reset';

const ForgotPassword = () => {
  const { forgotPassword, verifyOtp, resetPassword } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [step, setStep] = useState(STEP_EMAIL);

  // Step 1 — Email
  const [email, setEmail] = useState('');

  // Step 2 — OTP
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0); // seconds remaining
  const cooldownRef = useRef(null);

  // Step 3 — New Password
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Shared
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ─── Cooldown timer ──────────────────────────────────────────────────────
  const startCooldown = (seconds = 60) => {
    setResendCooldown(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  // ─── Step 1: Request OTP ─────────────────────────────────────────────────
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await forgotPassword(email);
      setStep(STEP_OTP);
      startCooldown(60);
      setSuccess('');
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 2: Resend OTP ──────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await forgotPassword(email);
      startCooldown(60);
      setOtp('');
      setSuccess('A new OTP has been sent to your email.');
    } catch (err) {
      setError(err.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 2: Verify OTP ──────────────────────────────────────────────────
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!/^\d{6}$/.test(otp)) {
      setError('Please enter a valid 6-digit OTP.');
      return;
    }

    setLoading(true);
    try {
      const result = await verifyOtp(email, otp);
      setResetToken(result.data.resetToken);
      setStep(STEP_RESET);
    } catch (err) {
      setError(err.message || 'OTP verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 3: Set new password ────────────────────────────────────────────
  const allRulesMet = COMPLEXITY_RULES.every((r) => r.test(newPassword));

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!allRulesMet) {
      setError('Password does not meet all complexity requirements.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(resetToken, newPassword);
      setSuccess('Password reset successfully! Redirecting to Sign In...');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Shared UI helpers ───────────────────────────────────────────────────
  const themeBtn = (
    <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 1000 }}>
      <button
        onClick={toggleTheme}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', fontSize: '20px', lineHeight: 1, transition: 'transform 200ms ease', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'rotate(15deg)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'rotate(0deg)'; }}
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        type="button"
      >
        {theme === 'light' ? '☀️' : '🌙'}
      </button>
    </div>
  );

  const errorBox = error && (
    <div className="p-4 mb-4 rounded-lg text-red-400" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--border-card)', fontSize: '14px' }}>
      {error}
    </div>
  );

  const successBox = success && (
    <div className="p-4 mb-4 rounded-lg text-green-400 flex items-start gap-2" style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid var(--border-card)', fontSize: '14px' }}>
      <CheckCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
      <span>{success}</span>
    </div>
  );

  // ─── Step indicator ───────────────────────────────────────────────────────
  const steps = [
    { label: 'Email', active: step === STEP_EMAIL, done: step === STEP_OTP || step === STEP_RESET },
    { label: 'Verify OTP', active: step === STEP_OTP, done: step === STEP_RESET },
    { label: 'New Password', active: step === STEP_RESET, done: false },
  ];

  const stepIndicator = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '24px' }}>
      {steps.map((s, i) => (
        <React.Fragment key={s.label}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: s.done ? '#22c55e' : s.active ? 'var(--color-primary)' : 'var(--bg-secondary)',
              border: `2px solid ${s.done ? '#22c55e' : s.active ? 'var(--color-primary)' : 'var(--border-card)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 700,
              color: s.done || s.active ? 'white' : 'var(--text-secondary)',
              transition: 'all 300ms ease'
            }}>
              {s.done ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: '10px', color: s.active ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: s.active ? 600 : 400 }}>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ width: '32px', height: '2px', background: steps[i + 1].done || step === steps[i + 1].label ? '#22c55e' : 'var(--border-card)', marginBottom: '16px', transition: 'background 300ms ease' }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
      {themeBtn}

      <div className="glass-card max-w-md w-full p-8 animate-fade-in-up" style={{ zIndex: 1, position: 'relative' }}>
        {/* Back link */}
        <div
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 text-sm font-medium mb-6 cursor-pointer transition w-fit"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <ArrowLeft size={16} />
          <span>Back to Sign In</span>
        </div>

        {/* Step Indicator */}
        {stepIndicator}

        {/* ── STEP 1: Email ── */}
        {step === STEP_EMAIL && (
          <>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Forgot Password</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Enter your registered email address. We'll send a 6-digit OTP to verify your identity.
              </p>
            </div>
            {errorBox}
            {successBox}
            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '16px', top: '14px', color: '#94a3b8' }}>
                    <Mail size={18} />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john.doe@company.com"
                    className="glass-input"
                    style={{ paddingLeft: '44px' }}
                    id="fp-email"
                    autoComplete="email"
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className="glass-button mt-2">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending OTP...
                  </span>
                ) : 'Send OTP'}
              </button>
            </form>
          </>
        )}

        {/* ── STEP 2: OTP Entry ── */}
        {step === STEP_OTP && (
          <>
            <div className="text-center mb-6">
              <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'var(--brand-primary-light, rgba(27,67,50,0.12))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <ShieldCheck size={26} style={{ color: 'var(--color-primary)' }} />
              </div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Enter OTP</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                A 6-digit code was sent to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>. It expires in 10 minutes.
              </p>
            </div>
            {errorBox}
            {successBox}
            <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>6-Digit OTP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  className="glass-input"
                  style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '12px', fontWeight: 700 }}
                  id="fp-otp"
                  autoComplete="one-time-code"
                />
              </div>
              <button type="submit" disabled={loading || otp.length !== 6} className="glass-button mt-2">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Verifying...
                  </span>
                ) : 'Verify OTP'}
              </button>
            </form>

            {/* Resend OTP */}
            <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Didn't receive the code?{' '}
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || loading}
                style={{
                  background: 'none', border: 'none', cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                  color: resendCooldown > 0 ? 'var(--text-secondary)' : 'var(--color-primary)',
                  fontWeight: 600, fontSize: '13px', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '4px'
                }}
              >
                <RefreshCw size={12} />
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
              </button>
            </div>
          </>
        )}

        {/* ── STEP 3: Set New Password ── */}
        {step === STEP_RESET && (
          <>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Set New Password</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Create a strong password for your account. All rules below must be met.
              </p>
            </div>
            {errorBox}
            {successBox}
            {!success && (
              <form onSubmit={handleResetSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>New Password</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '16px', top: '14px', color: '#94a3b8' }}>
                      <Lock size={18} />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                      className="glass-input"
                      style={{ paddingLeft: '44px', paddingRight: '44px' }}
                      id="fp-new-password"
                      autoComplete="new-password"
                    />
                    <span
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: '16px', top: '14px', color: '#94a3b8', cursor: 'pointer' }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </span>
                  </div>
                  {/* Real-time complexity checker */}
                  <PasswordChecklist password={newPassword} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>Confirm New Password</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '16px', top: '14px', color: '#94a3b8' }}>
                      <Lock size={18} />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="glass-input"
                      style={{ paddingLeft: '44px' }}
                      id="fp-confirm-password"
                      autoComplete="new-password"
                    />
                  </div>
                  {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                    <span style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                      Passwords do not match.
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loading || !allRulesMet || newPassword !== confirmPassword}
                  className="glass-button mt-2"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </span>
                  ) : 'Save New Password'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const Button = ({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size = 'md', // 'sm' | 'md' | 'lg'
  disabled = false,
  loading = false,
  icon = null,
  onClick,
  type = 'button',
  className = '',
  style = {},
  ...props
}) => {
  const shouldReduceMotion = useReducedMotion();

  // Variant color mapping matching established tokens
  const variants = {
    primary: {
      background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
      color: '#FFFFFF',
      border: 'none',
      boxShadow: '0 4px 12px rgba(27, 67, 50, 0.25)'
    },
    takeAction: {
      background: 'var(--brand-primary)',
      color: '#FFFFFF',
      border: 'none',
      boxShadow: 'none'
    },
    escalate: {
      background: '#E8A33D',
      color: '#FFFFFF',
      border: 'none',
      boxShadow: 'none'
    },
    complete: {
      background: '#34A853',
      color: '#FFFFFF',
      border: 'none',
      boxShadow: 'none'
    },
    message: {
      background: '#9CA3AF',
      color: '#FFFFFF',
      border: 'none',
      boxShadow: 'none'
    },
    secondary: {
      background: 'var(--bg-secondary)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-color)',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
    },
    outline: {
      background: 'transparent',
      color: 'var(--color-primary)',
      border: '1px solid var(--color-primary)',
      boxShadow: 'none'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-secondary)',
      border: 'none',
      boxShadow: 'none'
    },
    danger: {
      background: 'rgba(239, 68, 68, 0.1)',
      color: '#EF4444',
      border: '1px solid rgba(239, 68, 68, 0.2)',
      boxShadow: 'none'
    }
  };

  const sizes = {
    sm: { padding: '6px 12px', fontSize: '12px', borderRadius: '6px', height: '28px' },
    md: { padding: '10px 18px', fontSize: '14px', borderRadius: '8px', height: '38px' },
    lg: { padding: '12px 24px', fontSize: '15px', borderRadius: '8px', height: '44px' }
  };

  const currentVariant = variants[variant] || variants.primary;
  const currentSize = sizes[size] || sizes.md;

  const motionProps = shouldReduceMotion ? {} : {
    whileHover: disabled || loading ? {} : { scale: 1.02, y: -1 },
    whileTap: disabled || loading ? {} : { scale: 0.96 }
  };

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontWeight: '600',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled || loading ? 'none' : 'auto',
        boxSizing: 'border-box',
        transition: 'background 200ms ease, color 200ms ease, border-color 200ms ease, box-shadow 200ms ease',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        ...currentVariant,
        ...currentSize,
        ...style
      }}
      className={className}
      {...motionProps}
      {...props}
    >
      {loading ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <motion.span
            animate={shouldReduceMotion ? {} : { rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
            style={{
              width: '14px',
              height: '14px',
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              display: 'inline-block'
            }}
          />
          <span>Loading...</span>
        </span>
      ) : (
        <>
          {icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
          {children}
        </>
      )}
    </motion.button>
  );
};

export default Button;

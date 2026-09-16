import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const Badge = ({
  children,
  color = 'slate', // 'slate' | 'amber' | 'blue' | 'red' | 'green' | 'purple'
  dot = false,
  onClick,
  style = {},
  className = ''
}) => {
  const shouldReduceMotion = useReducedMotion();

  // Status pills desaturated color tokens for light and dark modes
  const badgeStyles = {
    slate: {
      bg: 'var(--bg-secondary)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-color)',
      dotColor: 'var(--text-secondary)'
    },
    amber: {
      bg: 'var(--pending-bg)',
      color: 'var(--pending-text)',
      border: 'none',
      dotColor: 'var(--color-pending)'
    },
    blue: {
      bg: 'var(--inprogress-bg)',
      color: 'var(--inprogress-text)',
      border: 'none',
      dotColor: 'var(--color-inprogress)'
    },
    red: {
      bg: 'var(--escalated-bg)',
      color: 'var(--escalated-text)',
      border: 'none',
      dotColor: 'var(--color-escalated)'
    },
    green: {
      bg: 'var(--completed-bg)',
      color: 'var(--completed-text)',
      border: 'none',
      dotColor: 'var(--color-completed)'
    },
    purple: {
      bg: 'var(--mismatch-bg)',
      color: 'var(--mismatch-text)',
      border: 'none',
      dotColor: 'var(--mismatch-text)'
    }
  };

  const current = badgeStyles[color] || badgeStyles.slate;

  return (
    <motion.span
      onClick={onClick}
      whileHover={shouldReduceMotion ? {} : { scale: 1.05 }}
      whileTap={shouldReduceMotion ? {} : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '600',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: current.bg,
        color: current.color,
        border: current.border,
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        lineHeight: 1.2,
        ...style
      }}
      className={className}
    >
      {dot && (
        <span 
          style={{ 
            width: '6px', 
            height: '6px', 
            borderRadius: '50%', 
            backgroundColor: current.dotColor,
            flexShrink: 0 
          }} 
        />
      )}
      {children}
    </motion.span>
  );
};

export default Badge;

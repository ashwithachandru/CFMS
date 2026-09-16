import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

const CustomSelect = ({
  options = [],
  value,
  onChange,
  label = '',
  placeholder = 'Select...',
  className = '',
  style = {},
  disabled = false,
  align = 'left' // 'left' | 'right'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef(null);

  // Normalize options array to { value, label }
  const normalizedOptions = options.map(opt => {
    if (typeof opt === 'object' && opt !== null) {
      return { value: opt.value ?? opt.id, label: opt.label ?? opt.name ?? opt.value };
    }
    return { value: opt, label: opt };
  });

  const selectedIndex = normalizedOptions.findIndex(opt => String(opt.value) === String(value));
  const selectedOption = selectedIndex >= 0 ? normalizedOptions[selectedIndex] : null;

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset focused index when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    } else {
      setFocusedIndex(-1);
    }
  }, [isOpen]);

  const handleSelect = (optionValue) => {
    if (disabled) return;
    onChange(optionValue);
    setIsOpen(false);
  };

  // Comprehensive Keyboard Navigation
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => (prev + 1) % normalizedOptions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => (prev - 1 + normalizedOptions.length) % normalizedOptions.length);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < normalizedOptions.length) {
        handleSelect(normalizedOptions[focusedIndex].value);
      }
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  return (
    <div 
      ref={dropdownRef}
      className={`relative inline-block ${className}`}
      style={{
        position: 'relative',
        userSelect: 'none',
        boxSizing: 'border-box',
        ...style
      }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-primary)',
          border: isOpen ? '1px solid var(--brand-primary)' : '1px solid var(--border-card)',
          borderRadius: '8px',
          padding: '0 14px',
          height: '40px',
          width: '100%',
          fontSize: '14px',
          fontFamily: 'Inter, sans-serif',
          fontWeight: '500',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'all 150ms ease',
          boxShadow: isOpen ? '0 0 0 3px rgba(45, 106, 79, 0.18)' : '0 1px 2px rgba(0, 0, 0, 0.04)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {label && (
            <span style={{ color: 'var(--text-secondary)', fontWeight: '500', fontSize: '13.5px' }}>
              {label}
            </span>
          )}
          <span style={{ color: selectedOption ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: '600' }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.15 }}
          style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}
        >
          <ChevronDown size={15} />
        </motion.span>
      </button>

      {/* Dropdown Menu Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            role="listbox"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: align === 'right' ? 'auto' : 0,
              right: align === 'right' ? 0 : 'auto',
              minWidth: '100%',
              maxWidth: '200px',
              width: 'max-content',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.14)',
              zIndex: 1000,
              overflow: 'hidden',
              padding: '4px 0',
              maxHeight: '260px',
              overflowY: 'auto',
              boxSizing: 'border-box'
            }}
          >
            {normalizedOptions.length === 0 ? (
              <div style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                No options available
              </div>
            ) : (
              normalizedOptions.map((opt, index) => {
                const isSelected = String(opt.value) === String(value);
                const isFocused = focusedIndex === index;

                let itemBg = 'transparent';
                if (isSelected) {
                  itemBg = 'var(--brand-primary)';
                } else if (isFocused) {
                  itemBg = 'rgba(45, 106, 79, 0.14)';
                }

                return (
                  <div
                    key={String(opt.value)}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={() => setFocusedIndex(index)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      padding: '10px 14px',
                      fontSize: '13.5px',
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: isSelected ? '600' : '400',
                      cursor: 'pointer',
                      backgroundColor: itemBg,
                      color: isSelected ? '#FFFFFF' : 'var(--text-primary)',
                      transition: 'background-color 120ms ease, color 120ms ease',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check size={14} style={{ color: '#FFFFFF', flexShrink: 0 }} />}
                  </div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomSelect;

import React, { useEffect } from 'react';
import { X, FileText } from 'lucide-react';
import Button from './Button';

const InvoiceModal = ({ isOpen, onClose, imageUrl, title = 'Invoice Document — Full View', fileName = '' }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  const resolvedUrl = imageUrl.startsWith('http') || imageUrl.startsWith('blob:')
    ? imageUrl
    : `http://localhost:4000${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '14px',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={20} style={{ color: '#2563eb' }} />
            <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
              {title}
            </span>
            {fileName && (
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                ({fileName})
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content */}
        <div style={{
          padding: '20px',
          overflowY: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a'
        }}>
          <img
            src={resolvedUrl}
            alt="Invoice Document Preview"
            style={{
              maxWidth: '100%',
              maxHeight: '75vh',
              borderRadius: '8px',
              objectFit: 'contain'
            }}
            onError={(e) => {
              console.error('Failed to load invoice image:', resolvedUrl);
              e.target.style.display = 'none';
              const parent = e.target.parentElement;
              if (parent && !parent.querySelector('.err-msg')) {
                const errDiv = document.createElement('div');
                errDiv.className = 'err-msg';
                errDiv.style.color = '#f87171';
                errDiv.style.padding = '40px';
                errDiv.style.textAlign = 'center';
                errDiv.innerText = 'Unable to load invoice image. Please verify the file exists on the server.';
                parent.appendChild(errDiv);
              }
            }}
          />
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end',
          backgroundColor: 'var(--bg-secondary)'
        }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close Preview
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;

import React, { useEffect, useState } from 'react';
import { X, FileText, Image as ImageIcon, Copy, Check } from 'lucide-react';
import Button from './Button';

const InvoiceModal = ({ 
  isOpen, 
  onClose, 
  imageUrl, 
  ocrText = '', 
  title = 'Invoice Document — Full View', 
  fileName = '' 
}) => {
  const [activeTab, setActiveTab] = useState('image');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(imageUrl ? 'image' : 'ocr');
      setCopied(false);
    }
  }, [isOpen, imageUrl, ocrText]);

  if (!isOpen || (!imageUrl && !ocrText)) return null;

  const resolvedUrl = imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('blob:'))
    ? imageUrl
    : (imageUrl ? `http://localhost:4000${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}` : '');

  const handleCopyText = () => {
    if (!ocrText) return;
    navigator.clipboard.writeText(ocrText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => console.error('Copy failed:', err));
  };

  const hasBoth = Boolean(imageUrl && ocrText);

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
          maxWidth: '920px',
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

        {/* View Toggle Tabs (When both image and OCR text are present) */}
        {hasBoth && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            backgroundColor: 'var(--bg-primary)',
            borderBottom: '1px solid var(--border-color)'
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('image')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                border: activeTab === 'image' ? '1px solid #2563eb' : '1px solid var(--border-color)',
                backgroundColor: activeTab === 'image' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                color: activeTab === 'image' ? '#2563eb' : 'var(--text-secondary)',
                transition: 'all 0.15s ease'
              }}
            >
              <ImageIcon size={15} />
              <span>Invoice Image</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ocr')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                border: activeTab === 'ocr' ? '1px solid #2563eb' : '1px solid var(--border-color)',
                backgroundColor: activeTab === 'ocr' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                color: activeTab === 'ocr' ? '#2563eb' : 'var(--text-secondary)',
                transition: 'all 0.15s ease'
              }}
            >
              <FileText size={15} />
              <span>Extracted OCR Text</span>
            </button>
          </div>
        )}

        {/* Modal Content */}
        {activeTab === 'image' && imageUrl ? (
          <div style={{
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0f172a',
            minHeight: '360px'
          }}>
            <img
              src={resolvedUrl}
              alt="Invoice Document Preview"
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
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
        ) : (
          <div style={{
            padding: '20px',
            overflowY: 'auto',
            backgroundColor: 'var(--bg-primary)',
            maxHeight: '70vh'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '10px'
            }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📄 Complete OCR Text</span>
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Structured document raw text reference extracted from invoice image
                </p>
              </div>

              {ocrText && (
                <button
                  type="button"
                  onClick={handleCopyText}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: copied ? '#10b981' : 'var(--text-primary)',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                  title="Copy OCR text to clipboard"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied!' : 'Copy Text'}</span>
                </button>
              )}
            </div>

            {ocrText ? (
              <div style={{
                maxHeight: '440px',
                overflowY: 'auto',
                padding: '14px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                fontSize: '13px',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                color: 'var(--text-primary)',
                wordBreak: 'break-word'
              }}>
                {ocrText}
              </div>
            ) : (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No OCR extracted text available for this document.
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-secondary)'
        }}>
          <div>
            {activeTab === 'ocr' && ocrText && (
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {ocrText.split('\n').length} lines extracted
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;

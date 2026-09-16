import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  FileText, 
  Image as ImageIcon, 
  Copy, 
  Check, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  RotateCcw, 
  ExternalLink,
  Info,
  Calendar,
  Hash,
  User,
  DollarSign,
  Layers
} from 'lucide-react';
import Button from './Button';

function extractStructuredFields(text, complaintData = {}) {
  if (!text && !complaintData) return null;
  const fields = {};
  
  // 1. Invoice Number
  if (complaintData?.invoice && complaintData.invoice !== 'N/A') {
    fields.invoiceNumber = complaintData.invoice;
  } else if (text) {
    const m = text.match(/\b(?:Invoice\s*(?:Number|No|#|Num)?|Bill\s*No|Inv\s*No)[:\s\-\.]*([A-Z0-9\-_/]+)/i);
    if (m && m[1] && m[1].length >= 3 && !/customer|date|total|official/i.test(m[1])) {
      fields.invoiceNumber = m[1].trim();
    }
  }

  // 2. Customer
  if (complaintData?.customer && complaintData.customer !== 'N/A') {
    fields.customer = complaintData.customer;
  } else if (text) {
    const m = text.match(/\b(?:Customer(?:\s*Code|\s*ID|\s*No)?|Invoice\s*To|Party\s*Name|Client(?:\s*Code|\s*ID)?|Customer)[:\s\-\.]*([A-Za-z0-9\s\-_/]+)/i);
    if (m && m[1] && m[1].trim().length >= 3 && !/care|support|phone|service/i.test(m[1])) {
      fields.customer = m[1].trim().split(/\r?\n/)[0].trim();
    }
  }

  // 3. Invoice Date
  if (text) {
    const m = text.match(/\b(?:Date|Invoice\s*Date|Dated)[:\s\-\.]*([0-9]{1,2}[-/\.][0-9]{1,2}[-/\.][0-9]{2,4}|[A-Za-z]+\s+[0-9]{1,2},?\s+[0-9]{4}|[0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})/i);
    if (m && m[1]) {
      fields.date = m[1].trim();
    }
  }

  // 4. Total Amount
  if (text) {
    const m = text.match(/\b(?:Grand\s*Total|Total\s*Amount|Total|TotalAmount|Net\s*Amount)[:\s\-\.]*(?:Rs\.?|INR|₹|\$)?\s*([0-9,]+\.?[0-9]*)/i);
    if (m && m[1] && parseFloat(m[1].replace(/,/g, '')) > 0) {
      fields.totalAmount = m[1].trim();
    }
  }

  // 5. Category / Subtype if present in complaintData
  if (complaintData?.type) {
    fields.category = `${complaintData.type}${complaintData.subtype ? ' — ' + complaintData.subtype : ''}`;
  }

  return Object.keys(fields).length > 0 ? fields : null;
}

const InvoiceModal = ({ 
  isOpen, 
  onClose, 
  imageUrl, 
  ocrText = '', 
  title = 'Invoice Document Preview', 
  fileName = '',
  complaintData = null
}) => {
  const [copied, setCopied] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isMobileView, setIsMobileView] = useState(false);
  const imageContainerRef = useRef(null);

  // Responsive layout tracking
  useEffect(() => {
    const checkWidth = () => {
      setIsMobileView(window.innerWidth < 880);
    };
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock background body scroll while modal is active
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Reset controls when opened or image changes
  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      setZoomLevel(1);
      setRotation(0);
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

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setRotation(0);
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const structuredFields = extractStructuredFields(ocrText, complaintData);
  const lineCount = ocrText ? ocrText.split(/\r?\n/).filter(Boolean).length : 0;

  const modalContent = (
    <div 
      id="invoice-modal-portal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        id="invoice-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-modal-title"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '16px',
          maxWidth: '1240px',
          width: '96vw',
          maxHeight: '92vh',
          height: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          position: 'relative',
          boxSizing: 'border-box'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1, paddingRight: '12px' }}>
            <FileText size={20} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
            <span 
              id="invoice-modal-title"
              style={{ 
                fontSize: '15px', 
                fontWeight: '700', 
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {title}
            </span>
            {fileName && (
              <span style={{ 
                fontSize: '12px', 
                color: 'var(--text-secondary)', 
                flexShrink: 0,
                backgroundColor: 'var(--bg-primary)',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)'
              }}>
                {fileName}
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s ease'
            }}
            title="Close modal (Esc)"
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body: Side-by-Side Split View on Desktop, Stacked on Mobile */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: isMobileView ? 'column' : 'row',
          minHeight: 0,
          overflow: 'hidden'
        }}>
          
          {/* ========================================================================= */}
          {/* LEFT PANE: INVOICE IMAGE                                                  */}
          {/* ========================================================================= */}
          <div style={{
            flex: isMobileView ? '0 0 45%' : '1 1 50%',
            display: 'flex',
            flexDirection: 'column',
            borderRight: isMobileView ? 'none' : '1px solid var(--border-color)',
            borderBottom: isMobileView ? '1px solid var(--border-color)' : 'none',
            backgroundColor: '#070b12',
            minHeight: 0,
            overflow: 'hidden'
          }}>
            {/* Image Pane Top Bar / Toolbar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 14px',
              backgroundColor: '#0f172a',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              flexShrink: 0,
              gap: '8px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>
                <ImageIcon size={14} style={{ color: '#38bdf8' }} />
                <span style={{ color: '#f1f5f9' }}>Original Invoice</span>
              </div>

              {resolvedUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    disabled={zoomLevel <= 0.5}
                    title="Zoom Out (-)"
                    style={{
                      padding: '4px 7px',
                      borderRadius: '5px',
                      border: '1px solid #334155',
                      backgroundColor: '#1e293b',
                      color: '#f8fafc',
                      cursor: zoomLevel <= 0.5 ? 'not-allowed' : 'pointer',
                      opacity: zoomLevel <= 0.5 ? 0.4 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '11px'
                    }}
                  >
                    <ZoomOut size={12} />
                  </button>

                  <span style={{ fontSize: '11px', fontWeight: '700', minWidth: '38px', textAlign: 'center', color: '#94a3b8' }}>
                    {Math.round(zoomLevel * 100)}%
                  </span>

                  <button
                    type="button"
                    onClick={handleZoomIn}
                    disabled={zoomLevel >= 3}
                    title="Zoom In (+)"
                    style={{
                      padding: '4px 7px',
                      borderRadius: '5px',
                      border: '1px solid #334155',
                      backgroundColor: '#1e293b',
                      color: '#f8fafc',
                      cursor: zoomLevel >= 3 ? 'not-allowed' : 'pointer',
                      opacity: zoomLevel >= 3 ? 0.4 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '11px'
                    }}
                  >
                    <ZoomIn size={12} />
                  </button>

                  <button
                    type="button"
                    onClick={handleRotate}
                    title="Rotate 90° Clockwise"
                    style={{
                      padding: '4px 7px',
                      borderRadius: '5px',
                      border: '1px solid #334155',
                      backgroundColor: '#1e293b',
                      color: '#f8fafc',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '11px',
                      marginLeft: '2px'
                    }}
                  >
                    <RotateCw size={12} />
                  </button>

                  {(zoomLevel !== 1 || rotation !== 0) && (
                    <button
                      type="button"
                      onClick={handleResetZoom}
                      title="Reset View"
                      style={{
                        padding: '4px 7px',
                        borderRadius: '5px',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        backgroundColor: 'rgba(56, 189, 248, 0.15)',
                        color: '#38bdf8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '11px',
                        fontWeight: '600',
                        gap: '3px',
                        marginLeft: '2px'
                      }}
                    >
                      <RotateCcw size={11} />
                      <span>Reset</span>
                    </button>
                  )}

                  <a
                    href={resolvedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open Original Image in New Tab"
                    style={{
                      padding: '4px 7px',
                      borderRadius: '5px',
                      border: '1px solid #334155',
                      backgroundColor: '#1e293b',
                      color: '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '11px',
                      textDecoration: 'none',
                      marginLeft: '2px'
                    }}
                  >
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>

            {/* Image Viewport (Contained scrolling inside pane) */}
            <div 
              ref={imageContainerRef}
              style={{
                flex: 1,
                overflow: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                position: 'relative',
                boxSizing: 'border-box'
              }}
            >
              {resolvedUrl ? (
                <div 
                  style={{ 
                    transition: 'transform 0.15s ease-out',
                    transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                    transformOrigin: 'center center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    maxWidth: '100%',
                    maxHeight: '100%'
                  }}
                >
                  <img
                    src={resolvedUrl}
                    alt="Original Invoice Preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: isMobileView ? '32vh' : '68vh',
                      borderRadius: '6px',
                      objectFit: 'contain',
                      boxShadow: '0 8px 30px rgba(0,0,0,0.7)',
                      display: 'block'
                    }}
                    onError={(e) => {
                      console.error('Failed to load invoice image:', resolvedUrl);
                      e.target.style.display = 'none';
                      const parent = e.target.parentElement;
                      if (parent && !parent.querySelector('.err-msg')) {
                        const errDiv = document.createElement('div');
                        errDiv.className = 'err-msg';
                        errDiv.style.color = '#f87171';
                        errDiv.style.padding = '30px';
                        errDiv.style.textAlign = 'center';
                        errDiv.style.fontSize = '13px';
                        errDiv.innerText = 'Unable to load invoice image from server.';
                        parent.appendChild(errDiv);
                      }
                    }}
                  />
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#64748b', padding: '30px', fontSize: '13px' }}>
                  <ImageIcon size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                  <div>Invoice image is not available for this document.</div>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT PANE: OCR EXTRACTED TEXT & STRUCTURED INFORMATION                   */}
          {/* ========================================================================= */}
          <div style={{
            flex: isMobileView ? '0 0 55%' : '1 1 50%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-primary)',
            minHeight: 0,
            overflow: 'hidden'
          }}>
            {/* OCR Pane Top Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 16px',
              backgroundColor: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border-color)',
              flexShrink: 0,
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={14} style={{ color: 'var(--brand-primary)' }} />
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  OCR Extracted Information
                </span>
                {lineCount > 0 && (
                  <span style={{ 
                    fontSize: '11px', 
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--bg-primary)',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)'
                  }}>
                    {lineCount} lines
                  </span>
                )}
              </div>

              {ocrText && (
                <button
                  type="button"
                  onClick={handleCopyText}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: copied ? '#10b981' : 'var(--text-primary)',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                  title="Copy complete OCR text to clipboard"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copied ? 'Copied!' : 'Copy Text'}</span>
                </button>
              )}
            </div>

            {/* OCR Content Body */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxSizing: 'border-box'
            }}>
              {/* Structured OCR Fields Grid (if extractable) */}
              {structuredFields && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobileView ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '8px',
                  padding: '12px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)'
                }}>
                  {structuredFields.invoiceNumber && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Hash size={11} style={{ color: 'var(--brand-primary)' }} /> Invoice Number
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {structuredFields.invoiceNumber}
                      </span>
                    </div>
                  )}

                  {structuredFields.customer && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <User size={11} style={{ color: 'var(--brand-primary)' }} /> Customer
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {structuredFields.customer}
                      </span>
                    </div>
                  )}

                  {structuredFields.date && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Calendar size={11} style={{ color: 'var(--brand-primary)' }} /> Date
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {structuredFields.date}
                      </span>
                    </div>
                  )}

                  {structuredFields.totalAmount && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <DollarSign size={11} style={{ color: '#10b981' }} /> Total Amount
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#10b981' }}>
                        {structuredFields.totalAmount}
                      </span>
                    </div>
                  )}

                  {structuredFields.category && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', gridColumn: isMobileView ? 'span 2' : 'auto' }}>
                      <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Layers size={11} style={{ color: 'var(--brand-primary)' }} /> Category
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {structuredFields.category}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Complete Extracted Text Block */}
              {ocrText ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minHeight: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Extracted OCR Text
                  </div>
                  <div style={{
                    flex: 1,
                    minHeight: '160px',
                    overflowY: 'auto',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                    fontSize: '12px',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    color: 'var(--text-primary)',
                    wordBreak: 'break-word',
                    boxSizing: 'border-box'
                  }}>
                    {ocrText}
                  </div>
                </div>
              ) : (
                <div style={{ 
                  padding: '36px 20px', 
                  textAlign: 'center', 
                  color: 'var(--text-muted)', 
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  border: '1px dashed var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Info size={24} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '13px', fontWeight: '500' }}>
                    OCR text is not available for this invoice.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '10px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-secondary)',
          flexShrink: 0
        }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Use zoom/rotate controls to inspect • Press <kbd style={{ padding: '1px 4px', borderRadius: '3px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', fontSize: '10px' }}>Esc</kbd> or click outside to close
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button type="button" variant="secondary" onClick={onClose} size="sm">
              Close Preview
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default InvoiceModal;

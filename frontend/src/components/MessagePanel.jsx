import React, { useRef, useEffect, useState } from 'react';
import { MessageSquare, X, Send, Paperclip, Users, ImageOff, FileText, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import Button from './common/Button';
import CustomSelect from './common/CustomSelect';
import InvoiceModal from './common/InvoiceModal';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const MessagePanel = ({ 
  replyToComplaint, 
  messageText, 
  setMessageText, 
  onSubmit, 
  onClose,
  messages = [],
  setMessages,
  onFetchThread,
  currentUserId,
  attachmentFile,
  setAttachmentFile,
  setSelectedRecipient,
  preselectedRecipientId
}) => {
  const { user } = useAuth();
  const scrollRef = useRef(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const fileInputRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();
  const [fileError, setFileError] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [failedImages, setFailedImages] = useState({});

  // Recipient selector state
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState('');
  const [countText, setCountText] = useState('');
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  const complaintId = replyToComplaint?.id;

  // Fetch dynamic recipients when complaint context changes
  useEffect(() => {
    if (!complaintId) return;

    // Reset state for new complaint
    setRecipients([]);
    setSelectedRecipientId('');
    if (setSelectedRecipient) setSelectedRecipient(null);

    const fetchRecipients = async () => {
      setLoadingRecipients(true);
      try {
        const res = await api.get(`/messages/recipients/${complaintId}`);
        if (res.ok) {
          const result = await res.json();
          const recs = result.data.recipients || [];
          setRecipients(recs);
          setCountText(result.data.countText || '');
          if (recs.length > 0) {
            const hasPreselected = preselectedRecipientId && recs.some(r => String(r.id) === String(preselectedRecipientId));
            const defaultRec = hasPreselected 
              ? recs.find(r => String(r.id) === String(preselectedRecipientId))
              : recs[0];
            setSelectedRecipientId(String(defaultRec.id));
            if (setSelectedRecipient) {
              setSelectedRecipient(defaultRec);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch recipients:', err);
      } finally {
        setLoadingRecipients(false);
      }
    };

    fetchRecipients();
  }, [complaintId]);

  // Fetch recipient-scoped thread whenever selected recipient or complaint changes
  useEffect(() => {
    if (!complaintId) return;

    if (selectedRecipientId && onFetchThread) {
      if (setMessages) setMessages([]); // Clear thread state immediately to prevent stale flash
      onFetchThread(complaintId, selectedRecipientId);
    } else if (!selectedRecipientId && onFetchThread) {
      onFetchThread(complaintId, null);
    }
  }, [complaintId, selectedRecipientId, onFetchThread, setMessages]);

  // Auto scroll to bottom of thread on message update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Generate preview URL when attachment file changes
  useEffect(() => {
    if (attachmentFile) {
      const url = URL.createObjectURL(attachmentFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [attachmentFile]);

  if (!replyToComplaint) return null;

  const handleRecipientChange = (val) => {
    if (setMessages) setMessages([]); // Clear thread state immediately to prevent stale flash
    setSelectedRecipientId(val);
    const chosen = recipients.find(r => String(r.id) === String(val));
    if (chosen && setSelectedRecipient) {
      setSelectedRecipient(chosen);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setFileError('');
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFileError('Only image files (JPEG, PNG, GIF, WEBP, etc.) are allowed as attachments.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFileError('File size exceeds the 5MB maximum limit.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (setAttachmentFile) {
      setAttachmentFile(file);
    }
  };

  const removeAttachment = () => {
    if (setAttachmentFile) setAttachmentFile(null);
    setFileError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const canViewInvoice = (replyToComplaint?.invoice_url || replyToComplaint?.ocr_text) && ['Sales Executive', 'Warehouse Team', 'Warehouse Manager', 'Administrator'].includes(user?.role);

  return (
    <AnimatePresence>
      <div 
        id="message-panel-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(3px)',
          zIndex: 2500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          boxSizing: 'border-box'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.section 
          key={complaintId || 'modal'}
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.96 }}
          animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          style={{ 
            padding: '20px', 
            borderRadius: '16px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '14px', 
            position: 'relative',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-primary)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
            boxSizing: 'border-box',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '85vh'
          }}
        >
        {/* Close button icon top-right */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            padding: '4px',
            borderRadius: '6px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          type="button"
        >
          <X size={16} />
        </button>

        {/* Header Info Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              gap: '8px', 
              fontSize: '13px', 
              fontWeight: 'bold', 
              color: 'var(--text-primary)', 
              userSelect: 'none',
              paddingRight: '28px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={16} style={{ color: 'var(--brand-primary)' }} />
              <span>{replyToComplaint.id === 'DIRECT' ? 'Direct Messaging Thread' : `Complaint Messaging Thread — ${replyToComplaint.id} (${replyToComplaint.customer})`}</span>
            </div>

            {canViewInvoice && (
              <button
                type="button"
                onClick={() => setInvoiceModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: 'var(--brand-primary)',
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer'
                }}
                title="Click to view invoice document in popup modal"
              >
                <FileText size={14} />
                <span>Click to View Invoice</span>
              </button>
            )}
          </div>

          {/* Dynamic Recipient Selector Bar */}
          {recipients.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                <Users size={14} style={{ color: 'var(--brand-primary)' }} />
                <span>Message To:</span>
              </div>

              <div style={{ width: '260px' }}>
                <CustomSelect
                  value={selectedRecipientId}
                  onChange={handleRecipientChange}
                  placeholder="Select Recipient"
                  options={recipients.map(r => ({ value: r.id, label: r.name }))}
                  style={{ width: '100%' }}
                />
              </div>

              {countText && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', backgroundColor: 'var(--bg-primary)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  {countText}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Error Alert */}
        {fileError && (
          <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#EF4444', fontSize: '12px' }}>
            {fileError}
          </div>
        )}

        {/* Message Thread List (Chat style) */}
        {messages.length > 0 && (
          <div 
            ref={scrollRef}
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '8px', 
              maxHeight: '220px', 
              overflowY: 'auto', 
              padding: '12px', 
              backgroundColor: 'var(--bg-primary)', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color)',
              boxSizing: 'border-box'
            }}
            className="scrollbar-thin"
          >
            {messages.map(m => {
              const isMe = m.sender_id === currentUserId;
              return (
                <motion.div 
                  key={m.id} 
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  style={{ 
                    alignSelf: isMe ? 'flex-end' : 'flex-start', 
                    backgroundColor: isMe ? 'var(--bg-secondary)' : 'var(--bg-primary)', 
                    border: '1px solid var(--border-color)',
                    padding: '8px 12px', 
                    borderRadius: '12px', 
                    maxWidth: '75%', 
                    fontSize: '12px', 
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    boxShadow: 'var(--shadow-sm)',
                    boxSizing: 'border-box'
                  }}
                >
                  <div style={{ fontWeight: '800', color: isMe ? 'var(--brand-primary)' : 'var(--inprogress-text)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    {m.sender_name || `User #${m.sender_id}`} ({m.sender_role})
                  </div>
                  {m.message_text && <div style={{ color: 'var(--text-primary)', lineHeight: 1.4 }}>{m.message_text}</div>}
                  
                  {/* Inline Image Attachment Display */}
                  {m.attachment_url && !failedImages[m.id] && (() => {
                    const fullUrl = m.attachment_url.startsWith('http') 
                      ? m.attachment_url 
                      : `http://localhost:4000${m.attachment_url}`;

                    return (
                      <div style={{ marginTop: '6px' }}>
                        <a 
                          href={fullUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          style={{ display: 'inline-block', textDecoration: 'none' }}
                        >
                          <img 
                            src={fullUrl} 
                            alt="Message attachment" 
                            onError={() => setFailedImages(prev => ({ ...prev, [m.id]: true }))}
                            style={{ 
                              maxWidth: '220px', 
                              maxHeight: '160px', 
                              borderRadius: '8px', 
                              border: '1px solid var(--border-color)',
                              objectFit: 'cover',
                              display: 'block',
                              cursor: 'pointer'
                            }} 
                          />
                          <span style={{ fontSize: '10px', color: 'var(--brand-primary)', fontWeight: 'bold', marginTop: '4px', display: 'inline-block' }}>
                            View Full Photo ↗
                          </span>
                        </a>
                      </div>
                    );
                  })()}

                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', textAlign: 'right', marginTop: '2px' }}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Thumbnail Preview Before Sending */}
        {previewUrl && attachmentFile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '8px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', width: 'fit-content' }}>
            <img src={previewUrl} alt="Preview" style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>{attachmentFile?.name || 'Attachment'}</span>
            <button type="button" onClick={removeAttachment} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', color: 'var(--text-muted)' }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Input reply form */}
        <form onSubmit={onSubmit} style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
          <input 
            type="file" 
            ref={fileInputRef} 
            accept="image/*" 
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
          />
          
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            title="Attach image"
            style={{ 
              height: '44px', 
              width: '44px', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color)', 
              backgroundColor: 'var(--bg-primary)', 
              color: 'var(--text-secondary)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <Paperclip size={18} />
          </button>

          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder={loadingRecipients ? "Loading recipients..." : "Type your message here..."}
            style={{ 
              flex: 1, 
              padding: '12px 16px', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color)',
              outline: 'none',
              fontSize: '13px',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              minHeight: '44px',
              boxSizing: 'border-box'
            }}
          />
          <Button 
            type="submit"
            variant="primary"
            size="md"
            disabled={loadingRecipients || recipients.length === 0 || (!messageText.trim() && !attachmentFile)}
            icon={<Send size={14} />}
            style={{ minHeight: '44px', padding: '0 20px' }}
          >
            Send
          </Button>
        </form>
      </motion.section>

      {/* Invoice Popup Modal */}
      {replyToComplaint && (
        <InvoiceModal 
          isOpen={invoiceModalOpen}
          onClose={() => setInvoiceModalOpen(false)}
          imageUrl={replyToComplaint.invoice_url}
          ocrText={replyToComplaint.ocr_text || ''}
          title={`Invoice Document — ${replyToComplaint.id} (${replyToComplaint.customer || ''})`}
          fileName={replyToComplaint.invoice || ''}
          complaintData={replyToComplaint}
        />
      )}
      </div>
    </AnimatePresence>
  );
};

export default MessagePanel;

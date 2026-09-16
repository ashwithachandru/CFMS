import React, { useState } from 'react';
import { Clock, Paperclip, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import Badge from './common/Badge';
import Button from './common/Button';
import InvoiceModal from './common/InvoiceModal';
import { TableSkeleton } from './common/SkeletonLoader';
import { useAuth } from '../context/AuthContext';

const ComplaintsTable = ({ 
  complaints, 
  currentPage, 
  setCurrentPage, 
  onMessageClick, 
  onStatusChange, 
  isMobile,
  selectedQuickComplaint,
  onRowSelect,
  loading = false,
  activeTab = 'Dashboard'
}) => {
  const { user, hasPermission } = useAuth();
  const canReadComplaints = hasPermission ? hasPermission('complaints', 'read') : true;
  const isSalesExec = user?.role === 'Sales Executive';
  const pageSize = 5;
  const totalPages = Math.ceil(complaints.length / pageSize) || 1;
  const pageComplaints = complaints.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Invoice popup modal state
  const [activeInvoiceModal, setActiveInvoiceModal] = useState({
    isOpen: false,
    imageUrl: '',
    ocrText: '',
    title: '',
    fileName: '',
    complaintData: null
  });

  const renderActions = (comp) => {
    const isCompleted = comp.status === 'Completed' || comp.status === 'Resolved';
    const messageBtn = (
      <Button 
        key="message"
        size="sm"
        variant="message"
        onClick={() => onMessageClick(comp)}
      >
        Message
      </Button>
    );

    if (isSalesExec) {
      return messageBtn;
    }

    if (isCompleted) {
      return messageBtn;
    }

    if (user?.role === 'Warehouse Team') {
      if (activeTab === 'My Complaints') {
        return (
          <>
            <Button 
              key="complete"
              size="sm"
              variant="complete"
              onClick={() => onStatusChange(comp.id, 'Complete')}
            >
              Complete
            </Button>
            {messageBtn}
          </>
        );
      } else {
        if (comp.status === 'In Progress') {
          return (
            <>
              <Button 
                key="escalate"
                size="sm"
                variant="escalate"
                onClick={() => onStatusChange(comp.id, 'Escalate')}
              >
                Escalate
              </Button>
              {messageBtn}
            </>
          );
        } else if (comp.status === 'New' || comp.status === 'Assigned' || comp.status === 'Pending') {
          return (
            <>
              <Button 
                key="takeAction"
                size="sm"
                variant="takeAction"
                onClick={() => onStatusChange(comp.id, 'In Progress')}
              >
                Take Action
              </Button>
              {messageBtn}
            </>
          );
        } else {
          return messageBtn;
        }
      }
    }

    if (user?.role === 'Warehouse Manager') {
      const showTakeAction = comp.status !== 'In Progress';
      return (
        <>
          {showTakeAction && (
            <Button 
              key="takeAction"
              size="sm"
              variant="takeAction"
              onClick={() => onStatusChange(comp.id, 'In Progress')}
            >
              Take Action
            </Button>
          )}
          <Button 
            key="complete"
            size="sm"
            variant="complete"
            onClick={() => onStatusChange(comp.id, 'Complete')}
          >
            Complete
          </Button>
          {messageBtn}
        </>
      );
    }

    return messageBtn;
  };

  const [hoveredRowId, setHoveredRowId] = useState(null);
  const shouldReduceMotion = useReducedMotion();

  const getBadgeColorForCategory = (type) => {
    return {
      'Mismatch': 'slate',
      'Packaging': 'blue',
      'Quality Issues': 'amber',
      'Transport Related': 'purple'
    }[type] || 'slate';
  };

  const getStatusBorderColor = (status) => {
    if (status === 'Resolved' || status === 'Completed') return '#10B981';
    if (status === 'In Progress') return '#F59E0B';
    if (status && status.includes('Escalated')) return '#EF4444';
    return 'var(--brand-primary)'; // New / Assigned default
  };

  const getBadgeColorForStatus = (status) => {
    return {
      'New': 'slate',
      'Assigned': 'slate',
      'Pending': 'amber',
      'In Progress': 'blue',
      'Escalated to Manager': 'red',
      'Escalated to Warehouse Head': 'red',
      'Escalated': 'red',
      'Completed': 'green',
      'Resolved': 'green'
    }[status] || 'slate';
  };

  const getSlaColor = (comp) => {
    if (comp.status === 'Resolved' || comp.status === 'Completed') {
      return '#10B981'; // Green for resolved
    }
    const hours = comp.hours_left !== undefined ? comp.hours_left : parseInt(comp.sla, 10);
    if (comp.sla?.includes('Expired') || comp.sla?.includes('!') || (hours !== undefined && hours <= 0)) {
      return '#EF4444'; // Red for expired
    }
    if (isNaN(hours)) return '#10B981';
    if (hours > 12) return '#10B981'; // Green above 12h
    if (hours >= 6) return '#F59E0B'; // Amber 12h down to 6h
    return '#EF4444'; // Red below 6h
  };

  const renderStatusBadge = (comp) => {
    const status = comp.status;
    if (status === 'New' || status === 'Assigned') {
      const hours = comp.hours_left !== undefined ? comp.hours_left : parseInt(comp.sla, 10);
      let badgeColor = 'green';
      if (comp.sla?.includes('Expired') || comp.sla?.includes('!') || (hours !== undefined && hours <= 0)) {
        badgeColor = 'red';
      } else if (hours !== undefined && !isNaN(hours)) {
        if (hours <= 6) {
          badgeColor = 'red';
        } else if (hours <= 12) {
          badgeColor = 'amber';
        }
      }
      return <Badge color={badgeColor} dot>{comp.sla || '24h'}</Badge>;
    }
    return <Badge color={getBadgeColorForStatus(status)} dot>{status}</Badge>;
  };

  // Stagger container animation for table rows
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.03
      }
    }
  };

  const rowVariants = {
    hidden: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 },
    show: shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }
  };

  // Mobile stacked cards view
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', boxSizing: 'border-box' }}>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading complaints...</div>
        ) : pageComplaints.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <motion.div animate={shouldReduceMotion ? {} : { scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
              <Inbox size={40} style={{ color: 'var(--text-muted)' }} />
            </motion.div>
            <span>No complaints found matching selected filters.</span>
          </div>
        ) : (
          pageComplaints.map((comp) => {
            const isSelected = selectedQuickComplaint?.id === comp.id;
            const isCompleted = comp.status === 'Completed' || comp.status === 'Resolved';
            const slaColor = getSlaColor(comp);
            const borderColor = getStatusBorderColor(comp.status);
            
            return (
              <motion.div 
                key={comp.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={(e) => {
                  const tagName = e.target.tagName;
                  if (tagName !== 'BUTTON' && !e.target.closest('button')) {
                    if (onRowSelect) onRowSelect(comp);
                  }
                }}
                style={{
                  backgroundColor: isCompleted ? 'rgba(16, 185, 129, 0.12)' : (isSelected ? 'var(--card-selected-bg)' : 'var(--bg-primary)'),
                  border: isCompleted ? '2px solid #10B981' : (isSelected ? '2px solid var(--brand-primary)' : `2px solid ${borderColor}`),
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  textAlign: 'left',
                  boxShadow: isSelected ? '0 4px 12px rgba(30,79,217,0.15)' : '0 1px 2px rgba(0,0,0,0.05)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--brand-primary)', fontSize: '14px' }}>{comp.id}</span>
                  {renderStatusBadge(comp)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 'bold' }}>{comp.customer}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>{comp.invoice || '—'}</span>
                  </div>
                  {(comp.invoice_url || comp.ocr_text) && canReadComplaints && ['Sales Executive', 'Warehouse Team', 'Warehouse Manager', 'Administrator'].includes(user?.role) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveInvoiceModal({
                          isOpen: true,
                          imageUrl: comp.invoice_url,
                          ocrText: comp.ocr_text || '',
                          title: `Invoice Document — ${comp.id} (${comp.customer})`,
                          fileName: comp.invoice || '',
                          complaintData: comp
                        });
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '2px 0',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: 'var(--brand-primary)',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Click to View Invoice
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <Badge color={getBadgeColorForCategory(comp.type)}>{comp.type} - {comp.subtype}</Badge>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: slaColor, fontSize: '12px', fontWeight: 'bold' }}>
                    <Clock size={12} style={{ color: slaColor }} />
                    <span>{comp.sla}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '10px' }}>
                  {renderActions(comp)}
                </div>
              </motion.div>
            );
          })
        )}

        {/* Invoice Popup Modal for Mobile View */}
        <InvoiceModal
          isOpen={activeInvoiceModal.isOpen}
          onClose={() => setActiveInvoiceModal(prev => ({ ...prev, isOpen: false }))}
          imageUrl={activeInvoiceModal.imageUrl}
          ocrText={activeInvoiceModal.ocrText}
          title={activeInvoiceModal.title}
          fileName={activeInvoiceModal.fileName}
          complaintData={activeInvoiceModal.complaintData}
        />
      </div>
    );
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', backgroundColor: 'var(--bg-primary)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1140px', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '14px 10px', width: '95px', minWidth: '95px', boxSizing: 'border-box', textAlign: 'left' }}>Complaint ID</th>
              <th style={{ padding: '14px 10px', width: '110px', minWidth: '110px', boxSizing: 'border-box', textAlign: 'left' }}>Customer</th>
              <th style={{ padding: '14px 10px', width: '125px', minWidth: '125px', boxSizing: 'border-box', textAlign: 'center' }}>Invoice</th>
              <th style={{ padding: '14px 10px', width: '175px', minWidth: '175px', boxSizing: 'border-box', textAlign: 'left' }}>Category</th>
              <th style={{ padding: '14px 10px', width: '110px', minWidth: '110px', boxSizing: 'border-box', textAlign: 'left' }}>Raised By</th>
              <th style={{ padding: '14px 10px', width: '110px', minWidth: '110px', boxSizing: 'border-box', textAlign: 'left' }}>Warehouse</th>
              <th style={{ padding: '14px 10px', width: '80px', minWidth: '80px', boxSizing: 'border-box', textAlign: 'left' }}>SLA Timer</th>
              <th style={{ padding: '14px 10px', width: '195px', minWidth: '195px', boxSizing: 'border-box', textAlign: 'center' }}>Status</th>
              {isSalesExec && (
                <th style={{ padding: '14px 6px', width: '55px', minWidth: '55px', boxSizing: 'border-box', textAlign: 'center' }}>Attach</th>
              )}
              <th style={{ padding: '14px 10px', width: isSalesExec ? '100px' : '230px', minWidth: isSalesExec ? '100px' : '230px', boxSizing: 'border-box', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          {loading ? (
            <TableSkeleton rows={pageSize} cols={isSalesExec ? 10 : 9} />
          ) : pageComplaints.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={isSalesExec ? 10 : 9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <Inbox size={40} style={{ color: 'var(--text-muted)' }} />
                    <span>No complaints found matching selected filters.</span>
                  </motion.div>
                </td>
              </tr>
            </tbody>
          ) : (
            <motion.tbody variants={containerVariants} initial="hidden" animate="show" style={{ backgroundColor: 'var(--bg-primary)' }}>
              {pageComplaints.map((comp) => {
                const slaColor = getSlaColor(comp);
                const isCompleted = comp.status === 'Completed' || comp.status === 'Resolved';
                const borderColor = getStatusBorderColor(comp.status);
                const isRowHovered = hoveredRowId === comp.id;
                const isSelected = selectedQuickComplaint?.id === comp.id;

                return (
                  <motion.tr
                    key={comp.id}
                    variants={rowVariants}
                    onMouseEnter={() => setHoveredRowId(comp.id)}
                    onMouseLeave={() => setHoveredRowId(null)}
                    onClick={(e) => {
                      const tagName = e.target.tagName;
                      if (tagName !== 'BUTTON' && tagName !== 'INPUT' && tagName !== 'SELECT' && tagName !== 'A' && !e.target.closest('button')) {
                        if (onRowSelect) onRowSelect(comp);
                      }
                    }}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      backgroundColor: isCompleted ? 'rgba(16, 185, 129, 0.12)' : (isSelected ? 'var(--card-selected-bg)' : isRowHovered ? 'var(--bg-secondary)' : 'var(--bg-primary)'),
                      borderLeft: isCompleted ? '4px solid #10B981' : (isSelected ? '4px solid var(--brand-primary)' : `4px solid ${borderColor}`),
                      transition: 'background-color 150ms ease, border-left-color 150ms ease',
                      cursor: 'pointer'
                    }}
                  >
                    <td style={{ padding: '12px 10px', width: '95px', minWidth: '95px', boxSizing: 'border-box', textAlign: 'left' }}>
                      <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--brand-primary)', fontWeight: 'bold', fontSize: '13px', textDecoration: 'underline' }}>
                        {comp.id}
                      </button>
                    </td>

                    <td style={{ padding: '12px 10px', width: '110px', minWidth: '110px', boxSizing: 'border-box', textAlign: 'left', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                      {comp.customer}
                    </td>

                    <td style={{ padding: '10px 8px', width: '125px', minWidth: '125px', boxSizing: 'border-box', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                        <span style={{ fontWeight: '600', fontSize: '12.5px', color: 'var(--text-primary)', letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>
                          {comp.invoice || '—'}
                        </span>
                        {(comp.invoice_url || comp.ocr_text) && canReadComplaints && ['Sales Executive', 'Warehouse Team', 'Warehouse Manager', 'Administrator'].includes(user?.role) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveInvoiceModal({
                                isOpen: true,
                                imageUrl: comp.invoice_url,
                                ocrText: comp.ocr_text || '',
                                title: `Invoice Document — ${comp.id} (${comp.customer})`,
                                fileName: comp.invoice || '',
                                complaintData: comp
                              });
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '1px 4px',
                              fontSize: '11px',
                              fontWeight: '600',
                              color: 'var(--brand-primary)',
                              textDecoration: 'underline',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '3px',
                              cursor: 'pointer',
                              borderRadius: '4px',
                              transition: 'all 0.15s ease',
                              lineHeight: '1.2'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = 'var(--brand-primary-hover, #143426)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--brand-primary)';
                            }}
                            title="Click to view stored invoice document in popup modal"
                          >
                            <span>Click to View Invoice</span>
                          </button>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '12px 10px', width: '180px', minWidth: '180px', boxSizing: 'border-box', textAlign: 'left', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div>
                          <Badge color={getBadgeColorForCategory(comp.type)}>{comp.type}</Badge>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ 
                            fontSize: '10px', 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            backgroundColor: (comp.submission_type === 'ocr' || comp.invoice_url) ? 'rgba(27, 67, 50, 0.12)' : 'rgba(100, 116, 139, 0.1)', 
                            color: (comp.submission_type === 'ocr' || comp.invoice_url) ? 'var(--brand-primary)' : 'var(--text-muted)', 
                            fontWeight: '600',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}>
                            {(comp.submission_type === 'ocr' || comp.invoice_url) ? 'Invoice OCR' : 'Manual'}
                          </span>
                          {comp.subtype && (
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'normal', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {comp.subtype}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '12px 10px', width: '110px', minWidth: '110px', boxSizing: 'border-box', textAlign: 'left' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{comp.raisedBy}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{comp.date}</span>
                      </div>
                    </td>

                    <td style={{ padding: '12px 10px', width: '110px', minWidth: '110px', boxSizing: 'border-box', textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--brand-primary)', flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {comp.warehouse_name || comp.department || '—'}
                        </span>
                      </div>
                    </td>

                    <td style={{ padding: '12px 10px', width: '80px', minWidth: '80px', boxSizing: 'border-box', textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: slaColor, fontSize: '13px' }}>
                        <Clock size={14} style={{ color: slaColor }} />
                        <span>{comp.sla}</span>
                      </div>
                    </td>

                    <td style={{ padding: '12px 10px', width: '195px', minWidth: '195px', boxSizing: 'border-box', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        {renderStatusBadge(comp)}
                      </div>
                    </td>

                    {isSalesExec && (
                      <td style={{ padding: '12px 6px', width: '55px', minWidth: '55px', boxSizing: 'border-box', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onMessageClick) onMessageClick(comp);
                          }}
                          title={comp.attachment_url ? "Has photo attachment — Click to open messaging" : "Click to open messaging"}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Paperclip size={15} style={{ color: comp.attachment_url ? 'var(--brand-primary)' : 'var(--text-muted)', opacity: comp.attachment_url ? 1 : 0.6 }} />
                        </button>
                      </td>
                    )}

                    <td style={{ padding: '12px 10px', width: isSalesExec ? '100px' : '230px', minWidth: isSalesExec ? '100px' : '230px', boxSizing: 'border-box', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                        {renderActions(comp)}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </motion.tbody>
          )}
        </table>
      </div>

      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '14px 16px', 
          borderTop: '1px solid var(--border-color)', 
          backgroundColor: 'var(--bg-primary)',
          userSelect: 'none',
          boxSizing: 'border-box'
        }}
      >
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 'normal' }}>
          Showing {Math.min(complaints.length, (currentPage - 1) * pageSize + 1)}–{Math.min(complaints.length, currentPage * pageSize)} of {complaints.length} complaints{(user?.role === 'Warehouse Team' || user?.role === 'Warehouse Manager') && user?.warehouseName ? ` for ${user.warehouseName}` : ''}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', fontWeight: 'bold' }}>
          {/* Prev chevron */}
          <button
            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color)', 
              backgroundColor: 'var(--bg-primary)', 
              color: 'var(--text-primary)',
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxSizing: 'border-box',
              opacity: currentPage === 1 ? 0.4 : 1
            }}
            type="button"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Numbered buttons */}
          {[...Array(totalPages).keys()].map(idx => {
            const page = idx + 1;
            const isCurrent = currentPage === page;
            return (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: isCurrent ? 'none' : '1px solid var(--border-color)',
                  backgroundColor: isCurrent ? 'var(--brand-primary)' : 'var(--bg-primary)',
                  color: isCurrent ? '#FFFFFF' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box'
                }}
                type="button"
              >
                {page}
              </button>
            );
          })}

          {/* Next chevron */}
          <button
            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
            style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color)', 
              backgroundColor: 'var(--bg-primary)', 
              color: 'var(--text-primary)',
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxSizing: 'border-box',
              opacity: currentPage === totalPages ? 0.4 : 1
            }}
            type="button"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Invoice Popup Modal */}
      <InvoiceModal
        isOpen={activeInvoiceModal.isOpen}
        onClose={() => setActiveInvoiceModal(prev => ({ ...prev, isOpen: false }))}
        imageUrl={activeInvoiceModal.imageUrl}
        ocrText={activeInvoiceModal.ocrText}
        title={activeInvoiceModal.title}
        fileName={activeInvoiceModal.fileName}
        complaintData={activeInvoiceModal.complaintData}
      />
    </div>
  );
};

export default ComplaintsTable;

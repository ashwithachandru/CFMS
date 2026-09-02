import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import CustomSelect from '../components/common/CustomSelect';
import Button from '../components/common/Button';
import { api } from '../services/api';
import { Eye, X, Image as ImageIcon, FileText } from 'lucide-react';

const RaiseComplaint = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const invoiceFileInputRef = useRef(null);

  // Mode Selection: 'ocr' (Option A: Via Invoice) vs 'manual' (Option B: Manual Entry)
  const [entryMode, setEntryMode] = useState('ocr');

  // Core Complaint Form State (Option B)
  const [warehouseId, setWarehouseId] = useState('');
  const [customerCode, setCustomerCode] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [complaintTypeId, setComplaintTypeId] = useState('');
  const [complaintSubtypeId, setComplaintSubtypeId] = useState('');
  const [description, setDescription] = useState('');

  // Complaint Photo Upload State (Shared by both flows)
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);

  // OCR Invoice State (Option A)
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [invoiceFilePreview, setInvoiceFilePreview] = useState(null);
  const [invoiceUrl, setInvoiceUrl] = useState('');
  const [isOcrScanning, setIsOcrScanning] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [ocrSuccessNotice, setOcrSuccessNotice] = useState('');
  const [rawOcrText, setRawOcrText] = useState('');
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);

  // App Metadata State
  const [warehouses, setWarehouses] = useState([]);
  const [complaintTypes, setComplaintTypes] = useState([]);
  const [subtypesMap, setSubtypesMap] = useState({});
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetchMetadata();
  }, []);

  const fetchMetadata = async () => {
    try {
      const res = await api.get('/complaints/metadata');
      if (res.ok) {
        const json = await res.json();
        const mData = json.data || {};
        const whList = mData.warehouses || [];
        const ctList = mData.complaintTypes || mData.types || [];
        const csList = mData.complaintSubtypes || mData.subtypes || [];

        setWarehouses(whList);
        setComplaintTypes(ctList);

        const sMap = {};
        if (Array.isArray(csList)) {
          csList.forEach(st => {
            const tId = String(st.complaint_type_id);
            if (!sMap[tId]) sMap[tId] = [];
            sMap[tId].push(st);
          });
        } else if (typeof csList === 'object') {
          Object.assign(sMap, csList);
        }
        setSubtypesMap(sMap);

        if (whList.length > 0 && !warehouseId) {
          setWarehouseId(String(whList[0].id));
        }
      }
    } catch (err) {
      console.error('Error fetching metadata:', err);
    }
  };

  const filteredSubtypes = complaintTypeId ? (subtypesMap[complaintTypeId] || []) : [];

  // --- OCR INVOICE UPLOAD HANDLER ---
  const handleInvoiceChange = async (e) => {
    setOcrError('');
    setOcrSuccessNotice('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setOcrError('Invoice file size exceeds maximum limit of 5MB.');
      return;
    }

    setInvoiceFile(file);
    if (file.type.startsWith('image/')) {
      setInvoiceFilePreview(URL.createObjectURL(file));
    } else {
      setInvoiceFilePreview(null);
    }
    setIsOcrScanning(true);

    try {
      const ocrFormData = new FormData();
      ocrFormData.append('invoice', file);

      const res = await api.postFormData('/complaints/ocr-invoice', ocrFormData);
      if (res.ok) {
        const result = await res.json();
        const resData = result.data || {};
        const raw = resData.raw_text || '';
        const tempUrl = resData.temp_invoice_url || '';

        setRawOcrText(raw);
        setInvoiceUrl(tempUrl);
        setOcrSuccessNotice('Invoice scanned — review the extracted text below to fill in the details.');
      } else {
        const errJson = await res.json().catch(() => ({}));
        setOcrError(errJson.message || 'Invoice upload completed but OCR failed. Please check the image quality.');
      }
    } catch (err) {
      console.error('OCR Error:', err);
      setOcrError('Failed to process invoice OCR. Please check your network connection.');
    } finally {
      setIsOcrScanning(false);
    }
  };

  const removeInvoice = () => {
    setInvoiceFile(null);
    if (invoiceFilePreview) URL.revokeObjectURL(invoiceFilePreview);
    setInvoiceFilePreview(null);
    setInvoiceUrl('');
    setOcrError('');
    setOcrSuccessNotice('');
    setRawOcrText('');
    setInvoiceModalOpen(false);
    if (invoiceFileInputRef.current) invoiceFileInputRef.current.value = '';
  };

  // --- COMPLAINT PHOTO HANDLER ---
  const handlePhotoChange = (e) => {
    setErrorMsg('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Complaint photo size exceeds maximum limit of 5MB.');
      return;
    }
    setPhotoFile(file);
    if (file.type.startsWith('image/')) {
      setPhotoPreviewUrl(URL.createObjectURL(file));
    } else {
      setPhotoPreviewUrl(null);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- FORM SUBMIT HANDLER FOR OPTION A (INVOICE / OCR) ---
  const handleSubmitOcrComplaint = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!invoiceFile && !invoiceUrl) {
      setErrorMsg('Please upload an invoice document before submitting.');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('submission_type', 'ocr');
      formData.append('entry_mode', 'ocr');

      if (invoiceFile) formData.append('invoice', invoiceFile);
      else if (invoiceUrl) formData.append('invoice_url', invoiceUrl);

      if (photoFile) formData.append('photo', photoFile);
      if (rawOcrText) formData.append('ocr_text', rawOcrText);

      const res = await api.postFormData('/complaints', formData);
      const result = await res.json();

      if (res.ok) {
        setSuccessMsg(result.message || 'Invoice-based complaint raised successfully!');
        removePhoto();
        removeInvoice();
        setTimeout(() => navigate('/dashboard'), 1800);
      } else {
        setErrorMsg(result.message || 'Failed to raise invoice complaint.');
      }
    } catch (err) {
      console.error('Submit OCR Complaint Error:', err);
      setErrorMsg('Failed to raise complaint. Please check your network connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- FORM SUBMIT HANDLER FOR OPTION B (MANUAL ENTRY) ---
  const handleSubmitManualComplaint = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!warehouseId || !customerCode.trim() || !invoiceNumber.trim() || !complaintTypeId || !description.trim()) {
      setErrorMsg('Please fill in all required fields marked with *');
      return;
    }

    if (filteredSubtypes.length > 0 && !complaintSubtypeId) {
      setErrorMsg('Please select a complaint subtype.');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('warehouse_id', warehouseId);
      formData.append('customer_code', customerCode.trim());
      formData.append('invoice_number', invoiceNumber.trim());
      formData.append('complaint_type_id', complaintTypeId);
      if (complaintSubtypeId) formData.append('complaint_subtype_id', complaintSubtypeId);
      formData.append('description', description.trim());
      formData.append('submission_type', 'manual');
      formData.append('entry_mode', 'manual');

      if (photoFile) formData.append('photo', photoFile);

      const res = await api.postFormData('/complaints', formData);
      const result = await res.json();

      if (res.ok) {
        setSuccessMsg(result.message || 'Manual complaint raised successfully!');
        setCustomerCode('');
        setInvoiceNumber('');
        setComplaintTypeId('');
        setComplaintSubtypeId('');
        setDescription('');
        removePhoto();
        setTimeout(() => navigate('/dashboard'), 1800);
      } else {
        setErrorMsg(result.message || 'Failed to raise manual complaint.');
      }
    } catch (err) {
      console.error('Submit Manual Complaint Error:', err);
      setErrorMsg('Failed to raise complaint. Please check your network connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- STYLES ---
  const cardStyle = {
    backgroundColor: 'var(--bg-primary)',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    padding: '22px',
    marginBottom: '22px'
  };

  const optionCardStyle = (isActive) => ({
    padding: '16px 20px',
    borderRadius: '10px',
    border: isActive ? '2px solid #2563eb' : '1px solid var(--border-color)',
    backgroundColor: isActive ? 'rgba(37, 99, 235, 0.04)' : 'var(--bg-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    transition: 'all 0.15s ease'
  });

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    boxSizing: 'border-box'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '6px'
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
      <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} unreadCount={0} />

      <div style={{ display: 'flex', paddingTop: '64px' }}>
        <Sidebar
          activeTab="Raise Complaint"
          setActiveTab={(tab) => {
            if (tab === 'Dashboard') navigate('/dashboard');
            else if (tab === 'Raise Complaint') { /* current page */ }
            else navigate('/dashboard', { state: { activeTab: tab } });
          }}
          handleLogout={() => {
            localStorage.removeItem('user_logged_in');
            window.location.href = '/login';
          }}
          isDesktop={true}
          sidebarOpen={sidebarOpen}
          onCloseSidebar={() => setSidebarOpen(false)}
          unreadMessagesCount={0}
        />

        <main style={{ flex: 1, marginLeft: '220px', padding: '24px', maxWidth: '880px', boxSizing: 'border-box' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '36px', height: '36px', borderRadius: '8px',
                border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)', cursor: 'pointer'
              }}
              type="button"
            >
              &larr;
            </button>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>Raise Complaint</h1>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Select your submission flow: Option A (Invoice / OCR) or Option B (Manual Entry)
              </p>
            </div>
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <div style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', marginBottom: '18px', fontSize: '14px' }}>
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', marginBottom: '18px', fontSize: '14px' }}>
              {successMsg}
            </div>
          )}

          {/* ===== TOP OPTION SELECTOR ===== */}
          <div style={cardStyle}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '14px' }}>
              Select Submission Method:
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {/* Option A: Via Invoice (OCR) */}
              <div onClick={() => setEntryMode('ocr')} style={optionCardStyle(entryMode === 'ocr')}>
                <input
                  type="radio"
                  id="radio-ocr"
                  name="entryMode"
                  checked={entryMode === 'ocr'}
                  onChange={() => setEntryMode('ocr')}
                  style={{ accentColor: '#2563eb', marginTop: '3px', cursor: 'pointer' }}
                />
                <div>
                  <label htmlFor="radio-ocr" style={{ cursor: 'pointer', display: 'block', fontSize: '15px', fontWeight: '600', color: entryMode === 'ocr' ? '#2563eb' : 'var(--text-primary)' }}>
                    Option A: Via Invoice (OCR)
                  </label>
                  <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Upload invoice document with structured raw text reference. No manual fields required.
                  </p>
                </div>
              </div>

              {/* Option B: Manual Entry */}
              <div onClick={() => setEntryMode('manual')} style={optionCardStyle(entryMode === 'manual')}>
                <input
                  type="radio"
                  id="radio-manual"
                  name="entryMode"
                  checked={entryMode === 'manual'}
                  onChange={() => setEntryMode('manual')}
                  style={{ accentColor: '#2563eb', marginTop: '3px', cursor: 'pointer' }}
                />
                <div>
                  <label htmlFor="radio-manual" style={{ cursor: 'pointer', display: 'block', fontSize: '15px', fontWeight: '600', color: entryMode === 'manual' ? '#2563eb' : 'var(--text-primary)' }}>
                    Option B: Manual Entry
                  </label>
                  <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Manually fill in Customer Code, Invoice Number, Complaint Type & Description.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* OPTION A: VIA INVOICE (OCR) FLOW — NO COMPLAINT INFORMATION FIELDS        */}
          {/* ========================================================================= */}
          {entryMode === 'ocr' && (
            <form onSubmit={handleSubmitOcrComplaint} style={{ marginBottom: '22px' }}>
              {/* Upload Invoice Card */}
              <div style={cardStyle}>
                <h2 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 4px 0' }}>
                  Upload Invoice Image / Document
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
                  Upload an invoice photo to display structured extracted text. Supported formats: JPG, JPEG, PNG, WEBP, PDF (Max 5MB).
                </p>

                {!invoiceFile ? (
                  <div
                    onClick={() => invoiceFileInputRef.current?.click()}
                    style={{
                      border: '2px dashed var(--border-color)',
                      borderRadius: '8px',
                      padding: '32px 20px',
                      textAlign: 'center',
                      backgroundColor: 'var(--bg-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="file"
                      ref={invoiceFileInputRef}
                      onChange={handleInvoiceChange}
                      accept=".jpg,.jpeg,.png,.webp,.pdf"
                      style={{ display: 'none' }}
                    />
                    <FileText size={32} style={{ margin: '0 auto 8px auto', color: '#2563eb' }} />
                    <p style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '600' }}>
                      Choose Invoice File
                    </p>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Click to browse or drag and drop invoice image
                    </p>
                  </div>
                ) : (
                  <div>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', borderRadius: '8px',
                      border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)',
                      marginBottom: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        {/* INVOICE THUMBNAIL */}
                        {invoiceFilePreview ? (
                          <div
                            onClick={() => setInvoiceModalOpen(true)}
                            style={{
                              position: 'relative',
                              width: '54px', height: '54px', borderRadius: '6px',
                              overflow: 'hidden', border: '1px solid var(--border-color)',
                              cursor: 'pointer', flexShrink: 0
                            }}
                            title="Click to view full image"
                          >
                            <img src={invoiceFilePreview} alt="Invoice Thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{
                              position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
                            }}>
                              <Eye size={16} />
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            width: '48px', height: '48px', borderRadius: '6px', backgroundColor: 'rgba(37, 99, 235, 0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', flexShrink: 0
                          }}>
                            <FileText size={24} />
                          </div>
                        )}

                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '600' }}>{invoiceFile.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {(invoiceFile.size / 1024).toFixed(1)} KB
                          </div>
                          {invoiceFilePreview && (
                            <button
                              type="button"
                              onClick={() => setInvoiceModalOpen(true)}
                              style={{
                                background: 'none', border: 'none', color: '#2563eb', padding: 0,
                                fontSize: '12px', fontWeight: '600', cursor: 'pointer', marginTop: '4px',
                                display: 'inline-flex', alignItems: 'center', gap: '4px'
                              }}
                            >
                              <Eye size={12} /> Click to see full image
                            </button>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={removeInvoice}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                      >
                        Remove Invoice
                      </button>
                    </div>

                    {isOcrScanning && (
                      <div style={{
                        padding: '14px 16px', borderRadius: '8px',
                        backgroundColor: 'rgba(37, 99, 235, 0.06)', border: '1px solid rgba(37, 99, 235, 0.2)',
                        color: '#2563eb', fontSize: '14px', fontWeight: '500'
                      }}>
                        Scanning invoice with offline Tesseract OCR... Extracting text lines...
                      </div>
                    )}

                    {ocrError && (
                      <div style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '13px', marginTop: '10px' }}>
                        {ocrError}
                      </div>
                    )}

                    {ocrSuccessNotice && (
                      <div style={{
                        padding: '12px 16px', borderRadius: '8px',
                        backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d',
                        fontSize: '13px', marginTop: '10px', fontWeight: '500'
                      }}>
                        {ocrSuccessNotice}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* STRUCTURED "COMPLETE OCR TEXT" DISPLAY BOX */}
              {rawOcrText && (
                <div style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>
                        📄 Complete OCR Text
                      </h3>
                      <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Structured document raw text reference extracted from invoice image
                      </p>
                    </div>
                  </div>

                  <div style={{
                    maxHeight: '320px',
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
                    {rawOcrText}
                  </div>
                </div>
              )}

              {/* SEPARATE DEFECT / DAMAGE PHOTO UPLOAD FIELD (OPTION A) */}
              <div style={cardStyle}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 4px 0' }}>
                  Upload Complaint Photo (Product / Defect Evidence)
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px 0' }}>
                  Optional defect photo attachment. Supported formats: JPG, JPEG, PNG, WEBP (Max 5MB).
                </p>

                {!photoFile ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '1px dashed var(--border-color)',
                      borderRadius: '8px',
                      padding: '20px',
                      textAlign: 'center',
                      backgroundColor: 'var(--bg-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handlePhotoChange}
                      accept="image/*"
                      style={{ display: 'none' }}
                    />
                    <ImageIcon size={24} style={{ margin: '0 auto 6px auto', color: 'var(--text-secondary)' }} />
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Click to upload product/defect issue photo
                    </span>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', borderRadius: '8px',
                    border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {photoPreviewUrl && (
                        <img
                          src={photoPreviewUrl}
                          alt="Defect Photo Preview"
                          style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                        />
                      )}
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600' }}>{photoFile.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {(photoFile.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>
                    <button type="button" onClick={removePhoto} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', fontSize: '13px', fontWeight: '600' }}>
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* ACTIONS FOR OPTION A */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <Button type="button" variant="secondary" onClick={() => navigate('/dashboard')}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting || (!invoiceFile && !invoiceUrl)}>
                  {isSubmitting ? 'Submitting Invoice Complaint...' : 'Submit Invoice Complaint'}
                </Button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* OPTION B: MANUAL ENTRY FLOW — FULL FORM WITH FIXED PHOTO PREVIEW          */}
          {/* ========================================================================= */}
          {entryMode === 'manual' && (
            <form onSubmit={handleSubmitManualComplaint} style={cardStyle}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 18px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                Complaint Information
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Warehouse / Unit *</label>
                  <CustomSelect
                    options={warehouses.map(w => ({ value: String(w.id), label: `${w.name} (${w.location || w.code || ''})` }))}
                    value={warehouseId}
                    onChange={(val) => setWarehouseId(val)}
                    placeholder="Select Warehouse"
                  />
                </div>

                <div>
                  <label style={labelStyle}>Customer Code *</label>
                  <input
                    type="text"
                    value={customerCode}
                    onChange={(e) => setCustomerCode(e.target.value)}
                    placeholder="e.g. C014479"
                    required
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Invoice Number *</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="e.g. I-73788/RHL2425"
                    required
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Complaint Type *</label>
                  <CustomSelect
                    options={complaintTypes.map(t => ({ value: String(t.id), label: t.name }))}
                    value={complaintTypeId}
                    onChange={(val) => {
                      setComplaintTypeId(val);
                      setComplaintSubtypeId('');
                    }}
                    placeholder="Select Complaint Type"
                  />
                </div>
              </div>

              {filteredSubtypes.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Complaint Subtype *</label>
                  <CustomSelect
                    options={filteredSubtypes.map(st => ({ value: String(st.id), label: st.name }))}
                    value={complaintSubtypeId}
                    onChange={(val) => setComplaintSubtypeId(val)}
                    placeholder="Select Complaint Subtype"
                  />
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Detailed Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Describe the complaint issue in detail..."
                  required
                  style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

              {/* FIXED PHOTO PREVIEW FOR MANUAL FLOW */}
              <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>
                  Upload Complaint Photo (Product / Defect Evidence, Optional, Max 5MB)
                </label>

                {!photoFile ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '1px dashed var(--border-color)',
                      borderRadius: '8px',
                      padding: '18px',
                      textAlign: 'center',
                      backgroundColor: 'var(--bg-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handlePhotoChange}
                      accept="image/*"
                      style={{ display: 'none' }}
                    />
                    <ImageIcon size={24} style={{ margin: '0 auto 6px auto', color: 'var(--text-secondary)' }} />
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Click to upload product/defect issue photo
                    </span>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', borderRadius: '8px',
                    border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      {photoPreviewUrl ? (
                        <img
                          src={photoPreviewUrl}
                          alt="Defect Photo Thumbnail Preview"
                          style={{
                            width: '54px', height: '54px', borderRadius: '6px',
                            objectFit: 'cover', border: '1px solid var(--border-color)'
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '48px', height: '48px', borderRadius: '6px', backgroundColor: 'rgba(37, 99, 235, 0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb'
                        }}>
                          <ImageIcon size={24} />
                        </div>
                      )}

                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '600' }}>{photoFile.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {(photoFile.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>

                    <button type="button" onClick={removePhoto} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', fontSize: '13px', fontWeight: '600' }}>
                      Remove Photo
                    </button>
                  </div>
                )}
              </div>

              {/* ACTIONS FOR OPTION B */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <Button type="button" variant="secondary" onClick={() => navigate('/dashboard')}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting Complaint...' : 'Submit Complaint'}
                </Button>
              </div>
            </form>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* INVOICE POPUP MODAL (ENLARGED FULL IMAGE VIEW WITHOUT LEAVING PAGE)        */}
      {/* ========================================================================= */}
      {invoiceModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-primary)', borderRadius: '14px',
            maxWidth: '900px', width: '100%', maxHeight: '90vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            border: '1px solid var(--border-color)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={20} style={{ color: '#2563eb' }} />
                <span style={{ fontSize: '16px', fontWeight: '700' }}>
                  Uploaded Invoice — Full View
                </span>
                {invoiceFile && (
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                    ({invoiceFile.name})
                  </span>
                )}
              </div>
              <button
                onClick={() => setInvoiceModalOpen(false)}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-secondary)',
                  cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{
              padding: '20px', overflowY: 'auto', display: 'flex',
              alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a'
            }}>
              {invoiceFilePreview ? (
                <img
                  src={invoiceFilePreview}
                  alt="Full Invoice Preview"
                  style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '8px', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ color: '#94a3b8', padding: '40px', textAlign: 'center' }}>
                  Document preview unavailable for PDF format. (File uploaded successfully)
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 20px', borderTop: '1px solid var(--border-color)',
              display: 'flex', justifyContent: 'flex-end', backgroundColor: 'var(--bg-secondary)'
            }}>
              <Button type="button" variant="secondary" onClick={() => setInvoiceModalOpen(false)}>
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RaiseComplaint;

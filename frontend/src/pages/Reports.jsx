import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar, Download, FileSpreadsheet, FileText, RefreshCw, 
  CheckCircle2, ShieldAlert, Clock, BarChart3, TrendingUp, UserCheck, 
  Building2, AlertTriangle, PieChart as PieIcon, AlertCircle
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, 
  Legend, CartesianGrid, LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export const getStatusColor = (statusName) => {
  const normalized = (statusName || '').trim().toLowerCase();
  if (normalized.includes('warehouse head') || normalized.includes('head')) return '#DC2626'; // Deep Crimson Red (Tier 2 Escalation)
  if (normalized.includes('escalat') || normalized.includes('manager')) return '#F97316'; // Vivid Orange (Tier 1 Escalation)
  if (normalized === 'in progress') return '#0EA5E9'; // Cyan / Sky Blue (Active Work)
  if (normalized === 'assigned') return '#6366F1'; // Indigo / Blue (Assigned / Neutral)
  if (normalized === 'pending') return '#F59E0B'; // Amber (Waiting)
  if (normalized === 'resolved' || normalized === 'completed') return '#10B981'; // Emerald Green (Resolved)
  if (normalized === 'closed') return '#64748B'; // Slate Gray (Archived)
  return '#1B4332'; // Default Fallback
};

const PIE_COLORS = ['#6366F1', '#0EA5E9', '#F97316', '#DC2626', '#10B981', '#F59E0B', '#64748B'];

const Reports = () => {
  const { user } = useAuth();
  const reportRef = useRef(null);

  const [period, setPeriod] = useState('month'); // today, week, month, custom, all
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const role = user?.role || 'Warehouse Team';

  // Theme checking for charts
  const isDarkMode = document.documentElement.classList.contains('dark') || 
    document.body.classList.contains('dark') ||
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  const chartTextColor = isDarkMode ? '#9CA3AF' : '#4B5563';
  const chartGridColor = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  const chartTooltipBg = isDarkMode ? '#1F2937' : '#FFFFFF';
  const chartTooltipBorder = isDarkMode ? '#374151' : '#E5E7EB';

  const fetchReportData = async () => {
    setLoading(true);
    setError('');
    try {
      let endpoint = '/reports/sales-executive';
      if (role === 'Administrator' || role === 'Admin') {
        endpoint = '/reports/admin';
      } else if (role === 'Sales Executive') {
        endpoint = '/reports/sales-executive';
      } else if (role === 'Warehouse Team') {
        endpoint = '/reports/warehouse-team';
      } else if (role === 'Warehouse Manager' || role === 'Manager') {
        endpoint = '/reports/warehouse-manager';
      } else {
        endpoint = '/reports/warehouse';
      }

      let url = `${endpoint}?period=${period}`;
      if (period === 'custom' && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }

      const response = await api.get(url);
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Expected JSON but received ${contentType || 'non-JSON'}: ${text.slice(0, 200)}`);
      }

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.message || 'Failed to load report data');
      }

      setReportData(json.data);
    } catch (err) {
      console.error('Report fetch error:', err);
      setError(err.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchReportData();
    }
  }, [period, role, user]);

  const handleApplyCustomDate = () => {
    if (!startDate || !endDate) {
      alert('Please select both start date and end date.');
      return;
    }
    fetchReportData();
  };

  // Excel Export Handler
  const singlePagePdfRef = useRef(null);

  const getExportPayload = () => {
    if (!reportData) return null;

    let title = '';
    let periodText = period === 'today' ? 'Today'
      : period === 'week' ? 'This Week'
      : period === 'month' ? 'This Month'
      : period === 'all' ? 'All Time'
      : `${startDate} to ${endDate}`;

    let kpiList = [];
    let highlight = '';
    let statusList = [];
    let categoryList = [];
    let roleTable = null;

    // Status Breakdown
    if (reportData.statusBreakdown && Array.isArray(reportData.statusBreakdown)) {
      const totalCount = reportData.statusBreakdown.reduce((sum, item) => {
        const val = item.count !== undefined ? item.count : (item.value !== undefined ? item.value : 0);
        return sum + val;
      }, 0);

      statusList = reportData.statusBreakdown.map(item => {
        const name = item.name || item.status || 'Unknown';
        const count = item.count !== undefined ? item.count : (item.value !== undefined ? item.value : 0);
        const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : (item.percentage ? Math.round(item.percentage) : 0);
        return {
          name,
          count,
          pct,
          color: getStatusColor(name)
        };
      });
    }

    // Category Breakdown (Subtype / Type)
    if (reportData.subtypeBreakdown && Array.isArray(reportData.subtypeBreakdown)) {
      categoryList = reportData.subtypeBreakdown.map(item => ({
        name: item.subtypeName || item.typeName || item.name || 'General',
        count: item.count !== undefined ? item.count : (item.value !== undefined ? item.value : 0)
      }));
    } else if (reportData.typeBreakdown && Array.isArray(reportData.typeBreakdown)) {
      categoryList = reportData.typeBreakdown.map(item => ({
        name: item.subtypeName ? `${item.typeName} (${item.subtypeName})` : (item.typeName || item.name || 'General'),
        count: item.count !== undefined ? item.count : (item.value !== undefined ? item.value : 0)
      }));
    }

    if (role === 'Sales Executive') {
      const s = reportData.summary || {};
      title = `${user?.name || 'Sales Executive'} — Performance Summary`;
      highlight = reportData.mostCommonIssue ? `Most Common Issue: ${reportData.mostCommonIssue}` : 'No recurring issue pattern detected';

      kpiList = [
        { label: 'Total Raised', value: s.totalRaised || 0, subtext: 'Complaints filed', color: '#1B4332', borderColor: '#A7D7C5' },
        { label: 'Resolved', value: s.resolvedCount || 0, subtext: 'Successfully resolved', color: '#16A34A', borderColor: '#BBF7D0' },
        { label: 'Open Escalated', value: s.escalatedCount || 0, subtext: 'Currently open escalated', color: '#DC2626', borderColor: '#FECACA' },
        { label: 'SLA Compliance', value: `${s.slaComplianceRate || 0}%`, subtext: 'On-time resolution rate', color: '#059669', borderColor: '#A7F3D0' },
        { label: 'Avg Resolution', value: `${s.avgResolutionHours || 0}h`, subtext: 'Average resolution time', color: '#D97706', borderColor: '#FDE68A' }
      ];

      if (reportData.volumeTrend && reportData.volumeTrend.length > 0) {
        roleTable = {
          title: 'Recent Complaint Volume Trend',
          headers: ['Date / Period', 'Volume'],
          rows: reportData.volumeTrend.slice(-5).map(v => [v.date || v.label, `${v.count} complaints`])
        };
      }
    } else if (role === 'Warehouse Team') {
      const ps = reportData.personalSummary || {};
      const ws = reportData.warehouseSummary || {};
      title = `${ws.warehouseName || user?.warehouse_name || 'Warehouse'} — Team Member Summary (${user?.name || 'Member'})`;
      highlight = reportData.mostCommonIssue ? `Most Common Issue: ${reportData.mostCommonIssue}` : 'No recurring issue pattern detected';

      kpiList = [
        { label: 'Handled', value: ps.handledCount || 0, subtext: 'Claimed complaints', color: '#1B4332', borderColor: '#A7D7C5' },
        { label: 'Completed', value: ps.completedCount || 0, subtext: 'Resolved by member', color: '#16A34A', borderColor: '#BBF7D0' },
        { label: 'Open Escalated', value: ps.escalatedCount || 0, subtext: 'Currently open escalated', color: '#DC2626', borderColor: '#FECACA' },
        { label: 'SLA Compliance', value: `${ps.slaComplianceRate || 0}%`, subtext: 'On-time completion', color: '#059669', borderColor: '#A7F3D0' },
        { label: 'Avg Completion', value: `${ps.avgCompletionHours || 0}h`, subtext: 'Average resolution time', color: '#D97706', borderColor: '#FDE68A' }
      ];

      roleTable = {
        title: 'Warehouse-Wide Overview',
        headers: ['Warehouse Metric', 'Value'],
        rows: [
          ['Total Warehouse Complaints', `${ws.totalWarehouseComplaints || 0}`],
          ['Resolved Directly by Team', `${ws.resolvedDirectlyByTeam || 0}`],
          ['Escalated to Manager', `${ws.escalatedToManager || 0}`]
        ]
      };
    } else if (role === 'Warehouse Manager' || role === 'Manager') {
      const s = reportData.summary || {};
      title = `${s.warehouseName || user?.warehouse_name || 'Warehouse'} — Executive Escalation Summary`;
      highlight = reportData.mostCommonIssue ? `Most Common Issue: ${reportData.mostCommonIssue}` : 'No recurring issue pattern detected';

      kpiList = [
        { label: 'Total Complaints', value: s.totalComplaints || 0, subtext: 'Total warehouse volume', color: '#1B4332', borderColor: '#A7D7C5' },
        { label: 'Resolved', value: s.resolvedCount || 0, subtext: 'Resolved complaints', color: '#16A34A', borderColor: '#BBF7D0' },
        { label: 'Escalated (Open)', value: s.totalEscalated || s.pendingCount || 0, subtext: 'Requiring manager action', color: '#DC2626', borderColor: '#FECACA' },
        { label: 'Escalation Rate', value: `${s.escalationRate || 0}%`, subtext: 'Pct ever escalated', color: '#7C3AED', borderColor: '#DDD6FE' },
        { label: 'SLA Performance', value: `${s.slaPerformanceRate || 0}%`, subtext: 'Overall SLA compliance', color: '#059669', borderColor: '#A7F3D0' },
        { label: 'Avg Manager Time', value: `${s.avgEscalatedResolutionHours || 0}h`, subtext: 'Manager resolution time', color: '#D97706', borderColor: '#FDE68A' }
      ];

      if (reportData.teamMemberPerformance && reportData.teamMemberPerformance.length > 0) {
        roleTable = {
          title: 'Team Member Performance Comparison',
          headers: ['Team Member', 'Handled', 'Completed', 'Escalated', 'Pending', 'SLA %'],
          rows: reportData.teamMemberPerformance.slice(0, 5).map(m => [
            m.memberName,
            `${m.handledCount || 0}`,
            `${m.completedCount || 0}`,
            `${m.escalatedCount || 0}`,
            `${m.pendingCount || 0}`,
            m.slaPerformance || '100%'
          ])
        };
      }
    } else {
      // Administrator / Admin
      const s = reportData.summary || {};
      title = 'Organization-Wide Executive Summary';

      const topWh = reportData.warehouseComparison?.reduce((best, curr) => 
        (curr.slaPerformance > (best?.slaPerformance || -1) ? curr : best), null);

      highlight = topWh 
        ? `Top Performing Warehouse: ${topWh.warehouseName} (${topWh.slaPerformance}% SLA Performance)`
        : `Most Common Issue: ${s.mostCommonIssue || 'N/A'}`;

      kpiList = [
        { label: 'Org Complaints', value: s.totalComplaints || 0, subtext: 'Org-wide volume', color: '#1B4332', borderColor: '#A7D7C5' },
        { label: 'Open Escalated', value: s.currentlyEscalated || 0, subtext: 'Currently open escalated', color: '#DC2626', borderColor: '#FECACA' },
        { label: 'Resolved', value: s.resolvedCount || 0, subtext: 'Org-wide resolved', color: '#16A34A', borderColor: '#BBF7D0' },
        { label: 'Active Escalation %', value: `${s.activeEscalationRate || s.escalationRate || 0}%`, subtext: 'Open escalated pct', color: '#7C3AED', borderColor: '#DDD6FE' },
        { label: 'Org SLA Compliance', value: `${s.slaPerformanceRate || 0}%`, subtext: 'Org-wide SLA score', color: '#059669', borderColor: '#A7F3D0' },
        { label: 'Avg Resolution', value: s.avgResolutionDisplay || `${s.avgEscalatedResolutionHours || 0}h`, subtext: 'Avg resolution time', color: '#D97706', borderColor: '#FDE68A' }
      ];

      if (reportData.warehouseComparison && reportData.warehouseComparison.length > 0) {
        roleTable = {
          title: 'Warehouse Performance Comparison Summary',
          headers: ['Warehouse Name', 'Total', 'Resolved', 'Open Escalated', 'Pending', 'SLA %'],
          rows: reportData.warehouseComparison.slice(0, 5).map(w => [
            w.warehouseName,
            `${w.totalComplaints ?? w.total ?? 0}`,
            `${w.resolvedCount ?? w.resolved ?? 0}`,
            `${w.currentlyEscalatedCount ?? w.escalatedCount ?? w.openEscalated ?? 0}`,
            `${w.pendingCount ?? w.pending ?? 0}`,
            w.slaPerformance || '100%'
          ])
        };
      }
    }

    return { title, periodText, kpiList, highlight, statusList, categoryList, roleTable };
  };

  // Excel Export Handler (Single Page Summary Spreadsheet)
  const handleExportExcel = () => {
    if (!reportData) return;
    setExportingExcel(true);

    try {
      const payload = getExportPayload();
      if (!payload) return;

      const wb = XLSX.utils.book_new();

      const summaryRows = [
        ['CFMS 1-PAGE EXECUTIVE SUMMARY REPORT'],
        ['Report Scope:', payload.title],
        ['Date Range Filter:', payload.periodText],
        ['Generated On:', new Date().toLocaleString()],
        ['Generated By User:', `${user?.name || 'User'} (${role})`],
        [],
        ['KEY PERFORMANCE INDICATORS'],
        ['Metric', 'Value', 'Details']
      ];

      payload.kpiList.forEach(kpi => {
        summaryRows.push([kpi.label, kpi.value, kpi.subtext]);
      });

      summaryRows.push([]);
      summaryRows.push(['EXECUTIVE HIGHLIGHTS']);
      summaryRows.push(['Highlight:', payload.highlight]);
      summaryRows.push([]);

      summaryRows.push(['STATUS DISTRIBUTION']);
      summaryRows.push(['Status Name', 'Complaint Count', 'Percentage']);
      payload.statusList.forEach(st => {
        summaryRows.push([st.name, st.count, `${st.pct}%`]);
      });

      if (payload.categoryList && payload.categoryList.length > 0) {
        summaryRows.push([]);
        summaryRows.push(['TOP COMPLAINT CATEGORIES']);
        summaryRows.push(['Category / Subtype Name', 'Complaint Count']);
        payload.categoryList.slice(0, 6).forEach(cat => {
          summaryRows.push([cat.name, cat.count]);
        });
      }

      if (payload.roleTable) {
        summaryRows.push([]);
        summaryRows.push([payload.roleTable.title.toUpperCase()]);
        summaryRows.push(payload.roleTable.headers);
        payload.roleTable.rows.forEach(r => summaryRows.push(r));
      }

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);

      wsSummary['!cols'] = [
        { wch: 35 },
        { wch: 22 },
        { wch: 30 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 }
      ];

      XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

      const fileName = `${role.replace(/\s+/g, '_')}_Executive_Summary_${period}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error('Excel Export Error:', err);
      alert('Failed to export Excel file: ' + err.message);
    } finally {
      setExportingExcel(false);
    }
  };

  // PDF Export Handler (Single Page Executive Document)
  const handleExportPdf = async () => {
    if (!reportData || !singlePagePdfRef.current) return;
    setExportingPdf(true);

    try {
      const element = singlePagePdfRef.current;
      const canvas = await html2canvas(element, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: '#FFFFFF',
        logging: false
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.85);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = 297; // Exactly fit A4 height

      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);

      const fileName = `${role.replace(/\s+/g, '_')}_Executive_Summary_${period}_${new Date().toISOString().slice(0, 10)}.pdf`;
      const pdfBlob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      console.error('PDF Export Error:', err);
      alert('Failed to export PDF: ' + err.message);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Top Header & Export Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart3 size={26} style={{ color: 'var(--brand-primary)' }} />
            {role === 'Sales Executive' ? 'My Complaints Report' :
             role === 'Warehouse Team' ? 'My Performance Report' :
             'Warehouse Escalation Report'}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Role-scoped operational performance, SLA metrics, and complaint analytics.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={fetchReportData}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
              borderRadius: '8px', border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)',
              fontSize: '13px', fontWeight: '600', cursor: 'pointer'
            }}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
          </button>
          
          <button
            onClick={handleExportExcel}
            disabled={exportingExcel || loading || !reportData}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
              borderRadius: '8px', border: '1px solid #16A34A',
              backgroundColor: '#16A34A', color: '#FFFFFF',
              fontSize: '13px', fontWeight: '600', cursor: 'pointer',
              opacity: (exportingExcel || loading || !reportData) ? 0.6 : 1
            }}
          >
            <FileSpreadsheet size={15} /> {exportingExcel ? 'Exporting...' : 'Export Excel'}
          </button>

          <button
            onClick={handleExportPdf}
            disabled={exportingPdf || loading || !reportData}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
              borderRadius: '8px', border: '1px solid var(--brand-primary)',
              backgroundColor: 'var(--brand-primary)', color: '#FFFFFF',
              fontSize: '13px', fontWeight: '600', cursor: 'pointer',
              opacity: (exportingPdf || loading || !reportData) ? 0.6 : 1
            }}
          >
            <Download size={15} /> {exportingPdf ? 'Exporting PDF...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Date Range Selector Toolbar */}
      <div 
        style={{ 
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px', 
          backgroundColor: 'var(--bg-primary)', padding: '12px 16px', borderRadius: '12px',
          border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)'
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={16} /> Filter Date Range:
        </span>

        {[
          { id: 'today', label: 'Today' },
          { id: 'week', label: 'This Week' },
          { id: 'month', label: 'This Month' },
          { id: 'all', label: 'All Time' },
          { id: 'custom', label: 'Custom Range' }
        ].map(p => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            style={{
              padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: '600',
              border: period === p.id ? '1px solid var(--brand-primary)' : '1px solid var(--border-color)',
              backgroundColor: period === p.id ? 'var(--brand-primary)' : 'transparent',
              color: period === p.id ? '#FFFFFF' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            {p.label}
          </button>
        ))}

        {period === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '12px'
              }}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>to</span>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '12px'
              }}
            />
            <button
              onClick={handleApplyCustomDate}
              style={{
                padding: '6px 12px', borderRadius: '6px', border: 'none',
                backgroundColor: 'var(--brand-primary)', color: '#FFFFFF',
                fontSize: '12px', fontWeight: '600', cursor: 'pointer'
              }}
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Main Report Canvas */}
      <div ref={reportRef} style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
        {loading ? (
          <div style={{ padding: '64px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            Loading role report data...
          </div>
        ) : error ? (
          <div style={{ padding: '32px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', borderRadius: '12px', color: '#EF4444', fontSize: '14px', textAlign: 'center' }}>
            {error}
          </div>
        ) : !reportData ? (
          <div style={{ padding: '64px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            No report data available.
          </div>
        ) : (
          <>
            {/* ───────────────────────────────────────────────────────────── */}
            {/* 1. SALES EXECUTIVE REPORT VIEW                                 */}
            {/* ───────────────────────────────────────────────────────────── */}
            {role === 'Sales Executive' && reportData.summary && (
              <>
                {/* 1. Executive KPI Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '16px' }}>
                  <StatSummaryCard title="Total Raised" value={reportData.summary.totalRaised} icon={<FileText size={18} />} color="blue" subtitle={`Resolution Rate: ${reportData.summary.resolutionRate}%`} />
                  <StatSummaryCard title="Pending / Open" value={reportData.summary.openCount} icon={<Clock size={18} />} color="amber" subtitle={`Overdue: ${reportData.summary.overdueCount}`} />
                  <StatSummaryCard title="In Progress" value={reportData.summary.inProgressCount} icon={<RefreshCw size={18} />} color="purple" subtitle={`Assigned: ${reportData.summary.assignedCount}`} />
                  <StatSummaryCard title="Escalated to Manager" value={reportData.summary.escalatedToManagerCount} icon={<ShieldAlert size={18} />} color="red" subtitle={`Escalation Rate: ${reportData.summary.escalationRate}%`} />
                  <StatSummaryCard title="Resolved / Completed" value={reportData.summary.totalResolvedCompleted} icon={<CheckCircle2 size={18} />} color="green" subtitle={`Resolved: ${reportData.summary.resolvedCount}`} />
                  <StatSummaryCard title="SLA Compliance" value={`${reportData.summary.slaComplianceRate}%`} icon={<TrendingUp size={18} />} color="green" subtitle={`Met: ${reportData.summary.slaMetCount} | Breached: ${reportData.summary.slaBreachedCount}`} />
                  <StatSummaryCard title="Avg Resolution Time" value={`${reportData.summary.avgResolutionHours} hrs`} icon={<Clock size={18} />} color="purple" subtitle="From Raised to Resolution" />
                  <StatSummaryCard title="Avg First Response" value={`${reportData.summary.avgFirstResponseHours} hrs`} icon={<TrendingUp size={18} />} color="blue" subtitle="Initial Team Response" />
                </div>

                {/* 2. Visual Analytics Row 1: Status, Types, Subtypes */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                  {/* Chart 1: Status Breakdown */}
                  <ChartCard title="Complaint Status Analysis">
                    <StatusDonutChart 
                      data={reportData.statusBreakdown} 
                      chartTooltipBg={chartTooltipBg} 
                      chartTooltipBorder={chartTooltipBorder} 
                    />
                  </ChartCard>

                  {/* Chart 2: Complaint Type Breakdown */}
                  <ChartCard title="Complaint Type Analysis (Sorted)">
                    {reportData.typeBreakdown && reportData.typeBreakdown.length > 0 ? (
                      <ResponsiveContainer width="100%" height={270}>
                        <BarChart data={reportData.typeBreakdown} margin={{ bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                          <XAxis 
                            dataKey="typeName" 
                            stroke={chartTextColor} 
                            fontSize={10} 
                            interval={0} 
                            angle={-25} 
                            textAnchor="end" 
                            height={45}
                          />
                          <YAxis stroke={chartTextColor} fontSize={12} allowDecimals={false} />
                          <Tooltip contentStyle={{ backgroundColor: chartTooltipBg, borderColor: chartTooltipBorder, borderRadius: '8px' }} />
                          <Bar dataKey="count" name="Complaints" fill="#2D6A4F" radius={[4, 4, 0, 0]} barSize={18} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <EmptyStateText message="No type data for selected date range" />}
                  </ChartCard>

                  {/* Chart 3: Complaint Subtype Analysis */}
                  <ChartCard title="Complaint Subtype Analysis">
                    {reportData.subtypeBreakdown && reportData.subtypeBreakdown.length > 0 ? (
                      <ResponsiveContainer width="100%" height={270}>
                        <BarChart data={reportData.subtypeBreakdown} layout="vertical" margin={{ left: 5, right: 15 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                          <XAxis type="number" stroke={chartTextColor} fontSize={12} allowDecimals={false} />
                          <YAxis dataKey="subtypeName" type="category" stroke={chartTextColor} fontSize={10} width={145} interval={0} />
                          <Tooltip contentStyle={{ backgroundColor: chartTooltipBg, borderColor: chartTooltipBorder, borderRadius: '8px' }} />
                          <Bar dataKey="count" name="Count" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={12} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <EmptyStateText message="No subtype data for selected date range" />}
                  </ChartCard>
                </div>

                {/* 3. Visual Analytics Row 2: Trends, Warehouse Breakdown & SLA */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                  {/* Chart 4: Complaint Trend */}
                  <ChartCard title={`Complaint Volume Trend (${period.toUpperCase()})`}>
                    {reportData.complaintTrend && reportData.complaintTrend.length > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={reportData.complaintTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                          <XAxis dataKey="label" stroke={chartTextColor} fontSize={12} />
                          <YAxis stroke={chartTextColor} fontSize={12} allowDecimals={false} />
                          <Tooltip contentStyle={{ backgroundColor: chartTooltipBg, borderColor: chartTooltipBorder, borderRadius: '8px' }} />
                          <Line type="monotone" dataKey="count" name="Complaints Raised" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : <EmptyStateText message="No trend data for selected date range" />}
                  </ChartCard>

                  {/* Chart 5: Warehouse-wise Analysis */}
                  <ChartCard title="Warehouse-wise Complaint Breakdown">
                    {reportData.warehouseBreakdown && reportData.warehouseBreakdown.length > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={reportData.warehouseBreakdown} barGap={4} barCategoryGap="20%" margin={{ bottom: 15 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                          <XAxis 
                            dataKey="warehouseName" 
                            stroke={chartTextColor} 
                            fontSize={11} 
                            interval={0} 
                            angle={-15} 
                            textAnchor="end"
                            height={45}
                            tickFormatter={(name) => name ? name.replace(' Warehouse', '') : ''}
                          />
                          <YAxis stroke={chartTextColor} fontSize={12} allowDecimals={false} />
                          <Tooltip contentStyle={{ backgroundColor: chartTooltipBg, borderColor: chartTooltipBorder, borderRadius: '8px' }} />
                          <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '10px' }} />
                          <Bar dataKey="totalCount" name="Total Raised" fill="#1B4332" radius={[4, 4, 0, 0]} barSize={14} />
                          <Bar dataKey="resolvedCount" name="Resolved" fill="#10B981" radius={[4, 4, 0, 0]} barSize={14} />
                          <Bar dataKey="escalatedCount" name="Escalated" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={14} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <EmptyStateText message="No warehouse data for selected date range" />}
                  </ChartCard>

                  {/* Chart 6: SLA Performance */}
                  <ChartCard title="SLA Performance (Met vs Breached)">
                    {reportData.slaPerformance && reportData.slaPerformance.slaDistribution ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie data={reportData.slaPerformance.slaDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={75} label={(e) => `${e.name}: ${e.value}`}>
                            <Cell fill="#10B981" />
                            <Cell fill="#EF4444" />
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: chartTooltipBg, borderColor: chartTooltipBorder, borderRadius: '8px' }} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <EmptyStateText message="No SLA data for selected date range" />}
                  </ChartCard>
                </div>

                {/* 4. Open Complaint Aging Buckets */}
                <ChartCard title="Open Complaint Aging Distribution">
                  {reportData.agingBuckets && reportData.agingBuckets.some(b => b.count > 0) ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={reportData.agingBuckets}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                        <XAxis dataKey="bucket" stroke={chartTextColor} fontSize={12} />
                        <YAxis stroke={chartTextColor} fontSize={12} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: chartTooltipBg, borderColor: chartTooltipBorder, borderRadius: '8px' }} />
                        <Bar dataKey="count" name="Open Complaints" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#10B981', fontWeight: '600', fontSize: '13px' }}>
                      {(reportData.summary?.totalComplaints || 0) === 0 
                        ? "No complaints raised in this period." 
                        : "All complaints in this period are either resolved or within initial SLA limits. Zero overdue open complaints!"}
                    </div>
                  )}
                </ChartCard>

                {/* 5. Detailed Complaints Table */}
                <DetailedComplaintsSection complaints={reportData.detailedComplaints || []} role={role} />
              </>
            )}

            {/* ───────────────────────────────────────────────────────────── */}
            {/* 2. WAREHOUSE TEAM REPORT VIEW                                 */}
            {/* ───────────────────────────────────────────────────────────── */}
            {role === 'Warehouse Team' && reportData.personalSummary && (
              <>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                  A. My Complaint Activity
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                  <StatSummaryCard title="Handled / Assigned" value={reportData.personalSummary.handledCount} icon={<UserCheck size={18} />} color="blue" />
                  <StatSummaryCard title="Pending" value={reportData.personalSummary.pendingCount} icon={<Clock size={18} />} color="amber" />
                  <StatSummaryCard title="In Progress" value={reportData.personalSummary.inProgressCount} icon={<RefreshCw size={18} />} color="purple" />
                  <StatSummaryCard title="Completed" value={reportData.personalSummary.completedCount} icon={<CheckCircle2 size={18} />} color="green" />
                  <StatSummaryCard title="Escalated" value={reportData.personalSummary.escalatedCount} icon={<ShieldAlert size={18} />} color="red" />
                  <StatSummaryCard title="Avg Completion Time" value={typeof reportData.personalSummary.avgCompletionHours === 'string' && (reportData.personalSummary.avgCompletionHours.includes('min') || reportData.personalSummary.avgCompletionHours.includes('hr')) ? reportData.personalSummary.avgCompletionHours : `${reportData.personalSummary.avgCompletionHours} hrs`} icon={<Clock size={18} />} color="purple" />
                  <StatSummaryCard title="SLA Compliance" value={`${reportData.personalSummary.slaComplianceRate}%`} icon={<TrendingUp size={18} />} color="green" />
                  <StatSummaryCard title="Most Common Issue" value={reportData.mostCommonIssue?.display || 'N/A'} icon={<AlertCircle size={18} />} color="amber" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                  {/* Status Breakdown Chart */}
                  <ChartCard title="My Status Breakdown">
                    <StatusDonutChart 
                      data={reportData.statusBreakdown} 
                      chartTooltipBg={chartTooltipBg} 
                      chartTooltipBorder={chartTooltipBorder} 
                    />
                  </ChartCard>

                  {/* Subtype Breakdown Chart */}
                  <ChartCard title="Handled Complaints by Subtype">
                    {reportData.subtypeBreakdown && reportData.subtypeBreakdown.length > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={reportData.subtypeBreakdown} margin={{ bottom: 25, top: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                          <XAxis dataKey="subtypeName" stroke={chartTextColor} fontSize={10} interval={0} angle={-20} textAnchor="end" height={45} />
                          <YAxis stroke={chartTextColor} fontSize={11} allowDecimals={false} />
                          <Tooltip contentStyle={{ backgroundColor: chartTooltipBg, borderColor: chartTooltipBorder, borderRadius: '8px' }} />
                          <Bar dataKey="count" name="Handled" fill="#10B981" radius={[4, 4, 0, 0]} barSize={16} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <EmptyStateText message="No subtype data for selected date range" />}
                  </ChartCard>

                  {/* Warehouse Complaint Trend */}
                  <ChartCard title="Warehouse Volume Trend">
                    {reportData.complaintTrend && reportData.complaintTrend.length > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={reportData.complaintTrend} margin={{ top: 15, right: 20, left: 0, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                          <XAxis dataKey="label" stroke={chartTextColor} fontSize={11} />
                          <YAxis stroke={chartTextColor} fontSize={11} allowDecimals={false} domain={[0, (dataMax) => Math.max(dataMax + 1, 4)]} />
                          <Tooltip contentStyle={{ backgroundColor: chartTooltipBg, borderColor: chartTooltipBorder, borderRadius: '8px' }} />
                          <Line type="monotone" dataKey="count" name="Warehouse Complaints" stroke="#2D6A4F" strokeWidth={3} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : <EmptyStateText message="No volume trend data for selected date range" />}
                  </ChartCard>
                </div>

                {/* Open Complaint Aging Distribution for Member */}
                <ChartCard title="Open Complaint Aging Distribution (Assigned)">
                  {reportData.agingBuckets && reportData.agingBuckets.some(b => b.count > 0) ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={reportData.agingBuckets} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                        <XAxis dataKey="bucket" stroke={chartTextColor} fontSize={11} />
                        <YAxis stroke={chartTextColor} fontSize={11} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: chartTooltipBg, borderColor: chartTooltipBorder, borderRadius: '8px' }} />
                        <Bar dataKey="count" name="Open Complaints" fill="#2D6A4F" radius={[4, 4, 0, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#10B981', fontWeight: '600', fontSize: '13px' }}>
                      {(reportData.personalSummary?.handledCount || 0) === 0 
                        ? "No complaints assigned or handled in this period." 
                        : "All assigned complaints in this date range are resolved! Zero open complaints!"}
                    </div>
                  )}
                </ChartCard>

                <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: '16px 0 0 0' }}>
                  B. Warehouse Complaint Overview
                </h2>
                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div style={{ padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Warehouse Complaints</span>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '4px' }}>{reportData.warehouseSummary?.totalWarehouseComplaints || 0}</div>
                  </div>
                  <div style={{ padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#10B981' }}>Resolved Directly by Team</span>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: '#10B981', marginTop: '4px' }}>{reportData.warehouseSummary?.resolvedDirectlyByTeam || 0}</div>
                  </div>
                  <div style={{ padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#EF4444' }}>Escalated to Manager</span>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: '#EF4444', marginTop: '4px' }}>{reportData.warehouseSummary?.escalatedToManager || 0}</div>
                  </div>
                </div>

                <DetailedComplaintsSection complaints={reportData.detailedComplaints || []} role={role} />
              </>
            )}

            {/* ───────────────────────────────────────────────────────────── */}
            {/* 3. WAREHOUSE MANAGER REPORT VIEW                              */}
            {/* ───────────────────────────────────────────────────────────── */}
            {(role === 'Warehouse Manager' || role === 'Manager') && reportData.summary && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                  <StatSummaryCard title="Total Complaints" value={reportData.summary.totalComplaints} icon={<Building2 size={18} />} color="blue" />
                  <StatSummaryCard title="Pending / Open" value={reportData.summary.openCount || reportData.summary.pendingCount} icon={<Clock size={18} />} color="amber" />
                  <StatSummaryCard title="In Progress" value={reportData.summary.inProgressCount} icon={<RefreshCw size={18} />} color="purple" />
                  <StatSummaryCard title="Resolved" value={reportData.summary.resolvedCount} icon={<CheckCircle2 size={18} />} color="green" />
                  <StatSummaryCard title="Escalated to Manager" value={reportData.summary.totalEscalated} icon={<ShieldAlert size={18} />} color="red" />
                  <StatSummaryCard title="Escalation Rate" value={`${reportData.summary.escalationRate}%`} icon={<AlertTriangle size={18} />} color="red" />
                  <StatSummaryCard title="Avg Resolution Time" value={typeof reportData.summary.avgEscalatedResolutionHours === 'string' && (reportData.summary.avgEscalatedResolutionHours.includes('min') || reportData.summary.avgEscalatedResolutionHours.includes('hr')) ? reportData.summary.avgEscalatedResolutionHours : `${reportData.summary.avgEscalatedResolutionHours} hrs`} icon={<Clock size={18} />} color="purple" />
                  <StatSummaryCard title="SLA Compliance" value={`${reportData.summary.slaPerformanceRate}%`} icon={<TrendingUp size={18} />} color="blue" />
                  <StatSummaryCard title="Most Common Issue in Warehouse" value={reportData.mostCommonIssue?.display || 'N/A'} icon={<AlertCircle size={18} />} color="amber" />
                </div>

                {/* Manager's Action Queue — Escalated & Pending Resolution */}
                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', margin: '20px 0 0 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShieldAlert size={18} style={{ color: '#EF4444' }} />
                      Manager Action Queue (Escalated & Pending Action)
                    </h3>
                    <span 
                      style={{ 
                        fontSize: '12px', 
                        fontWeight: '600', 
                        padding: '4px 10px', 
                        borderRadius: '12px', 
                        backgroundColor: (reportData.managerActionQueue || []).length > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', 
                        color: (reportData.managerActionQueue || []).length > 0 ? '#EF4444' : '#10B981' 
                      }}
                    >
                      {(reportData.managerActionQueue || []).length} Pending Escalation{(reportData.managerActionQueue || []).length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {(reportData.managerActionQueue || []).length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px border-dashed var(--border-color)' }}>
                      <CheckCircle2 size={32} style={{ color: '#10B981', margin: '0 auto 8px auto' }} />
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#10B981' }}>
                        Zero Pending Escalations
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        All escalated complaints in this warehouse have been addressed. No items waiting in your queue!
                      </div>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }} className="scrollbar-thin">
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', minWidth: '750px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                            <th style={{ padding: '10px' }}>Complaint ID</th>
                            <th style={{ padding: '10px' }}>Customer</th>
                            <th style={{ padding: '10px' }}>Invoice</th>
                            <th style={{ padding: '10px' }}>Type / Subtype</th>
                            <th style={{ padding: '10px' }}>Escalated From</th>
                            <th style={{ padding: '10px' }}>Escalated Date</th>
                            <th style={{ padding: '10px' }}>Waiting Time</th>
                            <th style={{ padding: '10px' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(reportData.managerActionQueue || []).map((item) => (
                            <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '10px', fontWeight: '700', color: 'var(--brand-primary)' }}>{item.complaint_number}</td>
                              <td style={{ padding: '10px', color: 'var(--text-primary)' }}>{item.customer_code}</td>
                              <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{item.invoice_number}</td>
                              <td style={{ padding: '10px', color: 'var(--text-primary)' }}>
                                <span style={{ fontWeight: '500' }}>{item.type}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>{item.subtype}</span>
                              </td>
                              <td style={{ padding: '10px', fontWeight: '600', color: 'var(--text-primary)' }}>{item.escalatedFrom}</td>
                              <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{item.escalatedDate}</td>
                              <td style={{ padding: '10px', fontWeight: '700', color: '#EF4444' }}>{item.waitingTimeDisplay}</td>
                              <td style={{ padding: '10px' }}>
                                <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#EF4444' }}>
                                  {item.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginTop: '20px' }}>
                  {/* Status Breakdown */}
                  <ChartCard title="Complaint Status Breakdown">
                    <StatusDonutChart 
                      data={reportData.statusBreakdown} 
                      chartTooltipBg={chartTooltipBg} 
                      chartTooltipBorder={chartTooltipBorder} 
                    />
                  </ChartCard>

                  {/* Subtype Breakdown */}
                  <ChartCard title="Complaint Subtype Analysis">
                    {reportData.subtypeBreakdown && reportData.subtypeBreakdown.length > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={reportData.subtypeBreakdown} margin={{ bottom: 25, top: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                          <XAxis dataKey="subtypeName" stroke={chartTextColor} fontSize={10} interval={0} angle={-20} textAnchor="end" height={45} />
                          <YAxis stroke={chartTextColor} fontSize={11} allowDecimals={false} />
                          <Tooltip contentStyle={{ backgroundColor: chartTooltipBg, borderColor: chartTooltipBorder, borderRadius: '8px' }} />
                          <Bar dataKey="count" name="Count" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} barSize={16} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <EmptyStateText message="No subtype data for selected date range" />}
                  </ChartCard>

                  {/* SLA Breach Trend */}
                  <ChartCard title={`SLA Breach Trend (${reportData.trendGrouping === 'daily' ? 'Grouped Daily' : 'Grouped Weekly'})`}>
                    {reportData.slaBreachTrend && reportData.slaBreachTrend.length > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={reportData.slaBreachTrend} margin={{ top: 15, right: 20, left: 0, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                          <XAxis dataKey="label" stroke={chartTextColor} fontSize={11} />
                          <YAxis stroke={chartTextColor} fontSize={11} allowDecimals={false} domain={[0, (dataMax) => Math.max(dataMax + 1, 4)]} />
                          <Tooltip contentStyle={{ backgroundColor: chartTooltipBg, borderColor: chartTooltipBorder, borderRadius: '8px' }} />
                          <Line type="monotone" dataKey="breachCount" name="SLA Breaches" stroke="#EF4444" strokeWidth={3} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : <EmptyStateText message="No SLA breach incidents in selected date range" />}
                  </ChartCard>
                </div>

                {/* Open Complaint Aging Distribution for Warehouse */}
                <ChartCard title="Warehouse Open Complaint Aging Distribution">
                  {reportData.agingBuckets && reportData.agingBuckets.some(b => b.count > 0) ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={reportData.agingBuckets} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                        <XAxis dataKey="bucket" stroke={chartTextColor} fontSize={11} />
                        <YAxis stroke={chartTextColor} fontSize={11} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: chartTooltipBg, borderColor: chartTooltipBorder, borderRadius: '8px' }} />
                        <Bar dataKey="count" name="Open Complaints" fill="#2D6A4F" radius={[4, 4, 0, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#10B981', fontWeight: '600', fontSize: '13px' }}>
                      {(reportData.summary?.totalComplaints || 0) === 0 
                        ? "No complaints raised in this period." 
                        : "All complaints in this warehouse are resolved! Zero open complaints!"}
                    </div>
                  )}
                </ChartCard>

                {/* Team Comparison Table */}
                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>
                    Warehouse Team Member Performance Comparison
                  </h3>
                  <div style={{ overflowX: 'auto' }} className="scrollbar-thin">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '10px' }}>Team Member</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Handled / Assigned</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Completed</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Escalated</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Pending</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Avg Resolution Time</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>SLA Performance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reportData.teamMemberPerformance || []).length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                              No active team members found for this warehouse.
                            </td>
                          </tr>
                        ) : (
                          (reportData.teamMemberPerformance || []).map((row) => (
                            <tr key={row.memberId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '10px', fontWeight: '600', color: 'var(--text-primary)' }}>{row.memberName}</td>
                              <td style={{ padding: '10px', textAlign: 'center', fontWeight: '600', color: 'var(--brand-primary)' }}>{row.handledCount}</td>
                              <td style={{ padding: '10px', textAlign: 'center', fontWeight: '600', color: '#10B981' }}>{row.completedCount}</td>
                              <td style={{ padding: '10px', textAlign: 'center', fontWeight: '600', color: '#EF4444' }}>{row.escalatedCount}</td>
                              <td style={{ padding: '10px', textAlign: 'center', fontWeight: '600', color: '#F59E0B' }}>{row.pendingCount}</td>
                              <td style={{ padding: '10px', textAlign: 'center', color: 'var(--text-secondary)' }}>{row.avgResolutionDisplay || (typeof row.avgResolutionHours === 'string' && (row.avgResolutionHours.includes('min') || row.avgResolutionHours.includes('hr')) ? row.avgResolutionHours : `${row.avgResolutionHours} hrs`)}</td>
                              <td style={{ padding: '10px', textAlign: 'center', fontWeight: '700', color: 'var(--brand-primary)' }}>{row.slaPerformance}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <DetailedComplaintsSection complaints={reportData.detailedComplaints || []} role={role} />
              </>
            )}

            {/* ───────────────────────────────────────────────────────────── */}
            {/* 4. ADMINISTRATOR / GLOBAL EXECUTIVE REPORT VIEW               */}
            {/* ───────────────────────────────────────────────────────────── */}
            {(role === 'Administrator' || role === 'Admin') && reportData.summary && (
              <>
                {/* Section Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Building2 size={20} style={{ color: 'var(--brand-primary)' }} />
                      Organization-Wide Executive Dashboard
                    </h2>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                      Global oversight across all 5 warehouses, Sales Executives, and escalation queues.
                    </p>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '600', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'var(--brand-primary-light, rgba(27, 67, 50, 0.15))', color: 'var(--brand-primary)' }}>
                    Global Org Scope
                  </span>
                </div>

                {/* Section 1: Org-Wide Summary Stat Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                  <StatSummaryCard title="Total Complaints (Org)" value={reportData.summary.totalComplaints} icon={<Building2 size={18} />} color="blue" />
                  <StatSummaryCard title="Pending / Open" value={reportData.summary.openCount || reportData.summary.pendingCount} icon={<Clock size={18} />} color="amber" />
                  <StatSummaryCard title="In Progress" value={reportData.summary.inProgressCount} icon={<RefreshCw size={18} />} color="purple" />
                  <StatSummaryCard title="Resolved (Org)" value={reportData.summary.resolvedCount} icon={<CheckCircle2 size={18} />} color="green" />
                  <StatSummaryCard title="Currently Escalated (Open)" value={reportData.summary.currentlyEscalatedCount} icon={<ShieldAlert size={18} />} color="red" />
                  <StatSummaryCard title="Ever Escalated (Historical)" value={reportData.summary.totalEverEscalated} icon={<ShieldAlert size={18} />} color="amber" />
                  <StatSummaryCard title="Active Escalation Rate" value={`${reportData.summary.activeEscalationRate}%`} icon={<AlertTriangle size={18} />} color="red" />
                  <StatSummaryCard title="Historical Escalation Rate" value={`${reportData.summary.historicalEscalationRate}%`} icon={<AlertTriangle size={18} />} color="amber" />
                  <StatSummaryCard title="Avg Resolution Time" value={typeof reportData.summary.avgResolutionDisplay === 'string' ? reportData.summary.avgResolutionDisplay : `${reportData.summary.avgResolutionDisplay} hrs`} icon={<Clock size={18} />} color="purple" />
                  <StatSummaryCard title="Org SLA Compliance" value={`${reportData.summary.slaPerformanceRate}%`} icon={<TrendingUp size={18} />} color={parseInt(reportData.summary.slaPerformanceRate) >= 80 ? 'green' : 'red'} />
                  <StatSummaryCard title="Most Common Issue (Org)" value={reportData.mostCommonIssue?.display || 'N/A'} icon={<AlertCircle size={18} />} color="amber" />
                </div>

                {/* Section 2: Warehouse-vs-Warehouse Comparison Table (Core Feature) */}
                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', margin: '20px 0 0 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BarChart3 size={18} style={{ color: 'var(--brand-primary)' }} />
                      Warehouse-vs-Warehouse Performance Comparison
                    </h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Side-by-side metrics across all 5 warehouses
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto' }} className="scrollbar-thin">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', minWidth: '920px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '10px' }}>Warehouse</th>
                          <th style={{ padding: '10px' }}>Location</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Total Complaints</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Resolved</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Currently Escalated</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Ever Escalated</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Pending</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Active Esc. Rate</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Avg Resolution Time</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>SLA Performance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reportData.warehouseComparison || []).map((wh) => (
                          <tr key={wh.warehouseId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '10px', fontWeight: '700', color: 'var(--text-primary)' }}>{wh.warehouseName}</td>
                            <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{wh.location || 'N/A'}</td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: '700', color: 'var(--brand-primary)' }}>{wh.totalComplaints}</td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: '600', color: '#10B981' }}>{wh.resolvedCount}</td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: '700', color: wh.currentlyEscalatedCount > 0 ? '#EF4444' : 'var(--text-muted)' }}>{wh.currentlyEscalatedCount}</td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: '600', color: '#F59E0B' }}>{wh.totalEverEscalated}</td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: '600', color: '#F59E0B' }}>{wh.pendingCount}</td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: '600', color: parseInt(wh.activeEscalationRate) > 30 ? '#EF4444' : 'var(--text-primary)' }}>{wh.activeEscalationRate}</td>
                            <td style={{ padding: '10px', textAlign: 'center', color: 'var(--text-secondary)' }}>{wh.avgResolutionDisplay}</td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: '700', color: parseInt(wh.slaPerformance) >= 80 ? '#10B981' : '#EF4444' }}>{wh.slaPerformance}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 4: Global Escalation Oversight Queue */}
                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', margin: '20px 0 0 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShieldAlert size={18} style={{ color: '#EF4444' }} />
                      Global Escalation Oversight Queue (Unresolved Across All Warehouses)
                    </h3>
                    <span 
                      style={{ 
                        fontSize: '12px', 
                        fontWeight: '600', 
                        padding: '4px 10px', 
                        borderRadius: '12px', 
                        backgroundColor: (reportData.globalEscalationQueue || []).length > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', 
                        color: (reportData.globalEscalationQueue || []).length > 0 ? '#EF4444' : '#10B981' 
                      }}
                    >
                      {(reportData.globalEscalationQueue || []).length} Pending Escalation{(reportData.globalEscalationQueue || []).length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {(reportData.globalEscalationQueue || []).length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px border-dashed var(--border-color)' }}>
                      <CheckCircle2 size={32} style={{ color: '#10B981', margin: '0 auto 8px auto' }} />
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#10B981' }}>
                        Zero Pending Escalations Across All Warehouses
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        All escalated complaints in the organization have been addressed! No items pending manager action.
                      </div>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }} className="scrollbar-thin">
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', minWidth: '850px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                            <th style={{ padding: '10px' }}>Complaint ID</th>
                            <th style={{ padding: '10px' }}>Warehouse</th>
                            <th style={{ padding: '10px' }}>Manager</th>
                            <th style={{ padding: '10px' }}>Customer</th>
                            <th style={{ padding: '10px' }}>Type / Subtype</th>
                            <th style={{ padding: '10px' }}>Escalated From</th>
                            <th style={{ padding: '10px' }}>Escalated Date</th>
                            <th style={{ padding: '10px' }}>Waiting Time</th>
                            <th style={{ padding: '10px' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(reportData.globalEscalationQueue || []).map((item) => (
                            <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '10px', fontWeight: '700', color: 'var(--brand-primary)' }}>{item.complaint_number}</td>
                              <td style={{ padding: '10px', fontWeight: '600', color: 'var(--text-primary)' }}>{item.warehouseName}</td>
                              <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{item.managerName}</td>
                              <td style={{ padding: '10px', color: 'var(--text-primary)' }}>{item.customer_code}</td>
                              <td style={{ padding: '10px', color: 'var(--text-primary)' }}>
                                <span style={{ fontWeight: '500' }}>{item.type}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>{item.subtype}</span>
                              </td>
                              <td style={{ padding: '10px', fontWeight: '600', color: 'var(--text-primary)' }}>{item.escalatedFrom}</td>
                              <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{item.escalatedDate}</td>
                              <td style={{ padding: '10px', fontWeight: '700', color: '#EF4444' }}>{item.waitingTimeDisplay}</td>
                              <td style={{ padding: '10px' }}>
                                <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#EF4444' }}>
                                  {item.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Section 3: Sales Executive Performance Breakdown */}
                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', margin: '20px 0 0 0' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>
                    Sales Executive Activity & Resolution Breakdown
                  </h3>
                  <div style={{ overflowX: 'auto' }} className="scrollbar-thin">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', minWidth: '850px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '10px' }}>Sales Executive</th>
                          <th style={{ padding: '10px' }}>Email</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Complaints Raised</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Primary Destination Warehouse</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Resolved</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Currently Escalated</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Ever Escalated</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Pending</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Resolution Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reportData.salesExecutivePerformance || []).map((exec) => (
                          <tr key={exec.executiveId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '10px', fontWeight: '600', color: 'var(--text-primary)' }}>{exec.executiveName}</td>
                            <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{exec.email}</td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: '700', color: 'var(--brand-primary)' }}>{exec.raisedCount}</td>
                            <td style={{ padding: '10px', textAlign: 'center', color: 'var(--text-secondary)' }}>{exec.primaryWarehouse}</td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: '600', color: '#10B981' }}>{exec.resolvedCount}</td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: '700', color: exec.currentlyEscalatedCount > 0 ? '#EF4444' : 'var(--text-muted)' }}>{exec.currentlyEscalatedCount}</td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: '600', color: '#F59E0B' }}>{exec.totalEverEscalated}</td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: '600', color: '#F59E0B' }}>{exec.pendingCount}</td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: '700', color: 'var(--brand-primary)' }}>{exec.resolutionRate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 5: Org-Wide Trend & Pattern Analysis Charts */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginTop: '20px' }}>
                  {/* Status Breakdown */}
                  <ChartCard title="Org-Wide Complaint Status Breakdown">
                    <StatusDonutChart 
                      data={reportData.statusBreakdown} 
                      chartTooltipBg={chartTooltipBg} 
                      chartTooltipBorder={chartTooltipBorder} 
                    />
                  </ChartCard>

                  {/* Subtype Analysis */}
                  <ChartCard title="Org-Wide Subtype Analysis">
                    {reportData.subtypeBreakdown && reportData.subtypeBreakdown.length > 0 ? (
                      <ResponsiveContainer width="100%" height={270}>
                        <BarChart data={reportData.subtypeBreakdown} layout="vertical" margin={{ left: 5, right: 15 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                          <XAxis type="number" stroke={chartTextColor} fontSize={11} allowDecimals={false} />
                          <YAxis dataKey="subtypeName" type="category" stroke={chartTextColor} fontSize={10} width={145} interval={0} />
                          <Tooltip contentStyle={{ backgroundColor: chartTooltipBg, borderColor: chartTooltipBorder, borderRadius: '8px' }} />
                          <Bar dataKey="count" name="Count" fill="var(--brand-primary)" radius={[0, 4, 4, 0]} barSize={12} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <EmptyStateText message="No subtype data for selected date range" />}
                  </ChartCard>

                  {/* SLA Breach Trend */}
                  <ChartCard title={`Org-Wide SLA Breach Trend (${reportData.trendGrouping === 'daily' ? 'Grouped Daily' : 'Grouped Weekly'})`}>
                    {reportData.slaBreachTrend && reportData.slaBreachTrend.length > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={reportData.slaBreachTrend} margin={{ top: 15, right: 20, left: 0, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                          <XAxis dataKey="label" stroke={chartTextColor} fontSize={11} />
                          <YAxis stroke={chartTextColor} fontSize={11} allowDecimals={false} domain={[0, (dataMax) => Math.max(dataMax + 1, 4)]} />
                          <Tooltip contentStyle={{ backgroundColor: chartTooltipBg, borderColor: chartTooltipBorder, borderRadius: '8px' }} />
                          <Line type="monotone" dataKey="breachCount" name="SLA Breaches" stroke="#EF4444" strokeWidth={3} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : <EmptyStateText message="No SLA breach incidents in selected date range" />}
                  </ChartCard>
                </div>

                {/* Open Complaint Aging Distribution */}
                <ChartCard title="Org-Wide Open Complaint Aging Distribution">
                  {reportData.agingBuckets && reportData.agingBuckets.some(b => b.count > 0) ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={reportData.agingBuckets} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                        <XAxis dataKey="bucket" stroke={chartTextColor} fontSize={11} />
                        <YAxis stroke={chartTextColor} fontSize={11} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: chartTooltipBg, borderColor: chartTooltipBorder, borderRadius: '8px' }} />
                        <Bar dataKey="count" name="Open Complaints" fill="#2D6A4F" radius={[4, 4, 0, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#10B981', fontWeight: '600', fontSize: '13px' }}>
                      All complaints across all warehouses are resolved! Zero open overdue complaints.
                    </div>
                  )}
                </ChartCard>

                {/* Section 6: User & Role Management Visibility */}
                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', margin: '20px 0 0 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                      System User & Role Management Visibility
                    </h3>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Note: User Management visibility embedded in Admin Executive Dashboard.
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    <div>
                      <h4 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '10px' }}>User Counts by System Role</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                            <th style={{ padding: '6px' }}>Role</th>
                            <th style={{ padding: '6px', textAlign: 'center' }}>Total</th>
                            <th style={{ padding: '6px', textAlign: 'center' }}>Active</th>
                            <th style={{ padding: '6px', textAlign: 'center' }}>Inactive</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(reportData.userManagementSummary?.roleBreakdown || []).map((r, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '6px', fontWeight: '600', color: 'var(--text-primary)' }}>{r.role}</td>
                              <td style={{ padding: '6px', textAlign: 'center', fontWeight: '700', color: 'var(--brand-primary)' }}>{r.totalUsers}</td>
                              <td style={{ padding: '6px', textAlign: 'center', color: '#10B981' }}>{r.activeUsers}</td>
                              <td style={{ padding: '6px', textAlign: 'center', color: '#EF4444' }}>{r.inactiveUsers}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div>
                      <h4 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '10px' }}>Team Member Distribution per Warehouse</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                            <th style={{ padding: '6px' }}>Warehouse</th>
                            <th style={{ padding: '6px', textAlign: 'center' }}>Team Members</th>
                            <th style={{ padding: '6px', textAlign: 'center' }}>Managers</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(reportData.userManagementSummary?.warehouseUserBreakdown || []).map((w, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '6px', fontWeight: '600', color: 'var(--text-primary)' }}>{w.warehouseName}</td>
                              <td style={{ padding: '6px', textAlign: 'center', fontWeight: '600', color: 'var(--brand-primary)' }}>{w.teamMemberCount}</td>
                              <td style={{ padding: '6px', textAlign: 'center', color: 'var(--text-secondary)' }}>{w.managerCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Section 7: Detailed Complaints Data Table (Org-Wide) */}
                <DetailedComplaintsSection complaints={reportData.detailedComplaints || []} role={role} />
              </>
            )}
          </>
        )}
      </div>

      {/* Hidden Single-Page Executive Summary Container for PDF Export */}
      {reportData && (() => {
        const exportPayload = getExportPayload();
        if (!exportPayload) return null;
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, zIndex: -9999, opacity: 0.01, pointerEvents: 'none' }}>
            <div
              ref={singlePagePdfRef}
              style={{
                width: '800px',
                height: '1130px',
                padding: '32px 36px',
                boxSizing: 'border-box',
                backgroundColor: '#FFFFFF',
                color: '#1E293B',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between'
              }}
            >
              <div>
                {/* Header Banner */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #E2E8F0', paddingBottom: '14px', marginBottom: '18px' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#1B4332', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      CUSTOMER FEEDBACK & COMPLAINT MANAGEMENT SYSTEM (CFMS)
                    </div>
                    <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: '4px 0 2px 0' }}>
                      {exportPayload.title}
                    </h1>
                    <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                      Period Filter: <strong style={{ color: '#0F172A' }}>{exportPayload.periodText}</strong>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ padding: '4px 10px', backgroundColor: '#E8F5E9', color: '#1B4332', borderRadius: '6px', fontSize: '11px', fontWeight: '700', border: '1px solid #C8E6C9' }}>
                      1-PAGE EXECUTIVE SUMMARY
                    </div>
                    <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '6px' }}>
                      Generated: {new Date().toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Key Summary Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(exportPayload.kpiList.length, 6)}, 1fr)`, gap: '10px', marginBottom: '16px' }}>
                  {exportPayload.kpiList.map((card, idx) => (
                    <div key={idx} style={{ backgroundColor: '#F8FAFC', border: `1px solid ${card.borderColor || '#E2E8F0'}`, borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '9px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: card.color || '#0F172A', marginTop: '3px' }}>{card.value}</div>
                      <div style={{ fontSize: '9px', color: '#94A3B8', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.subtext}</div>
                    </div>
                  ))}
                </div>

                {/* Highlight Line */}
                {exportPayload.highlight && (
                  <div style={{ backgroundColor: '#F0F9FF', borderLeft: '4px solid #0284C7', padding: '9px 14px', borderRadius: '4px', marginBottom: '16px', fontSize: '12px', fontWeight: '600', color: '#0369A1' }}>
                    💡 {exportPayload.highlight}
                  </div>
                )}

                {/* 2 Compact Visual Sections */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                  {/* Status Breakdown Box */}
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 14px' }}>
                    <h3 style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', margin: '0 0 10px 0', borderBottom: '1px solid #F1F5F9', paddingBottom: '4px' }}>
                      Status Distribution
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {exportPayload.statusList.map((st, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                          <span style={{ color: '#475569', fontWeight: '500' }}>{st.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '70px', height: '6px', backgroundColor: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${st.pct}%`, height: '100%', backgroundColor: st.color }} />
                            </div>
                            <span style={{ fontWeight: '700', color: '#0F172A', minWidth: '35px', textAlign: 'right' }}>{st.count} ({st.pct}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Category / Subtype Breakdown Box */}
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 14px' }}>
                    <h3 style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', margin: '0 0 10px 0', borderBottom: '1px solid #F1F5F9', paddingBottom: '4px' }}>
                      {role === 'Administrator' ? 'Org-Wide Subtype Analysis' : 'Top Complaint Categories'}
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {exportPayload.categoryList.slice(0, 6).map((tp, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                          <span style={{ color: '#475569', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }} title={tp.name}>
                            {tp.name}
                          </span>
                          <span style={{ fontWeight: '700', color: '#1B4332', backgroundColor: '#E8F5E9', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', flexShrink: 0 }}>
                            {tp.count} complaints
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Role-Specific Secondary Table */}
                {exportPayload.roleTable && (
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 14px' }}>
                    <h3 style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', margin: '0 0 8px 0', borderBottom: '1px solid #F1F5F9', paddingBottom: '4px' }}>
                      {exportPayload.roleTable.title}
                    </h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                          {exportPayload.roleTable.headers.map((h, i) => (
                            <th key={i} style={{ padding: '5px 8px', fontWeight: '600' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {exportPayload.roleTable.rows.slice(0, 5).map((row, rIdx) => (
                          <tr key={rIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} style={{ padding: '5px 8px', color: cIdx === 0 ? '#0F172A' : '#475569', fontWeight: cIdx === 0 ? '600' : '400' }}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#94A3B8' }}>
                <span>Customer Feedback & Complaint Management System (CFMS)</span>
                <span style={{ fontWeight: '600', color: '#64748B' }}>Executive Report Summary • Page 1 of 1</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

const ChartCard = ({ title, children }) => (
  <div style={{ backgroundColor: 'var(--bg-primary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
    <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>{title}</h3>
    {children}
  </div>
);

const EmptyStateText = ({ message }) => (
  <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
    {message}
  </div>
);

const StatusDonutChart = ({ data = [], chartTooltipBg, chartTooltipBorder }) => {
  const validData = Array.isArray(data) ? data : [];
  const totalCount = validData.reduce((sum, item) => sum + (Number(item.value) || Number(item.count) || 0), 0);

  if (validData.length === 0 || totalCount === 0) {
    return <EmptyStateText message="No status data for selected date range" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
      {/* Donut Chart with Center Metric */}
      <div style={{ width: '100%', height: '175px', position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie
              data={validData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={46}
              outerRadius={70}
              paddingAngle={3}
              isAnimationActive={false}
            >
              {validData.map((entry, index) => (
                <Cell key={`status-cell-${index}`} fill={getStatusColor(entry.name)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: chartTooltipBg,
                borderColor: chartTooltipBorder,
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
              formatter={(val, name, item) => {
                const count = Number(val) || 0;
                const pct = item?.payload?.percentage !== undefined 
                  ? item.payload.percentage 
                  : (totalCount > 0 ? Math.round((count / totalCount) * 100) : 0);
                return [`${count} complaints (${pct}%)`, name];
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center Total Count Display */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none',
          lineHeight: 1.1
        }}>
          <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>
            {totalCount}
          </div>
          <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total
          </div>
        </div>
      </div>

      {/* Clean, Non-Overlapping Structured Legend Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
        gap: '8px 12px',
        padding: '12px 14px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        boxSizing: 'border-box'
      }}>
        {validData.map((item, idx) => {
          const color = getStatusColor(item.name);
          const count = item.value !== undefined ? item.value : (item.count || 0);
          const pct = item.percentage !== undefined 
            ? item.percentage 
            : (totalCount > 0 ? Math.round((count / totalCount) * 100) : 0);
          
          // Clean concise name formatting for legend grid
          const displayLabel = item.name
            .replace('Escalated to Warehouse Head', 'Esc. to WH Head')
            .replace('Escalated to Manager', 'Esc. to Manager');

          return (
            <div 
              key={idx} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                fontSize: '12px',
                minWidth: 0
              }}
            >
              <span style={{ 
                width: '10px', 
                height: '10px', 
                borderRadius: '50%', 
                backgroundColor: color, 
                flexShrink: 0,
                boxShadow: `0 0 0 2px ${color}33`
              }} />
              <span 
                style={{ 
                  color: 'var(--text-secondary)', 
                  fontWeight: '500', 
                  fontSize: '11px',
                  whiteSpace: 'nowrap', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis',
                  flex: 1
                }} 
                title={item.name}
              >
                {displayLabel}
              </span>
              <span style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '11px', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
                {count} <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal' }}>({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const StatSummaryCard = ({ title, value, icon, color, subtitle }) => {
  const colorMap = {
    blue: { bg: 'var(--brand-primary-light, rgba(27, 67, 50, 0.12))', text: 'var(--brand-primary)' },
    green: { bg: 'rgba(16, 185, 129, 0.1)', text: '#10B981' },
    red: { bg: 'rgba(239, 68, 68, 0.1)', text: '#EF4444' },
    amber: { bg: 'rgba(245, 158, 11, 0.1)', text: '#F59E0B' },
    purple: { bg: 'rgba(139, 92, 246, 0.1)', text: '#8B5CF6' }
  };
  const theme = colorMap[color] || colorMap.blue;

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>{title}</span>
        <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: theme.bg, color: theme.text }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{value}</div>
      {subtitle && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '-2px' }}>
          {subtitle}
        </div>
      )}
    </div>
  );
};

const DetailedComplaintsSection = ({ complaints, role }) => {
  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
      <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>
        Detailed Complaints Data ({complaints.length})
      </h3>
      <div style={{ overflowX: 'auto' }} className="scrollbar-thin">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', minWidth: '850px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '10px' }}>Complaint ID</th>
              <th style={{ padding: '10px' }}>Customer</th>
              <th style={{ padding: '10px' }}>Invoice</th>
              <th style={{ padding: '10px' }}>Type / Subtype</th>
              {role !== 'Sales Executive' && <th style={{ padding: '10px' }}>Raised By</th>}
              {role === 'Warehouse Manager' && <th style={{ padding: '10px' }}>Claimed / Handled By</th>}
              {role === 'Sales Executive' && <th style={{ padding: '10px' }}>Warehouse</th>}
              <th style={{ padding: '10px' }}>Raised Date</th>
              {role === 'Warehouse Manager' && <th style={{ padding: '10px' }}>Escalated Date</th>}
              <th style={{ padding: '10px' }}>Status</th>
              <th style={{ padding: '10px' }}>Resolved Date</th>
            </tr>
          </thead>
          <tbody>
            {complaints.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No complaints found for the selected date range.
                </td>
              </tr>
            ) : (
              complaints.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px', fontWeight: '700', color: 'var(--brand-primary)' }}>{c.complaint_number}</td>
                  <td style={{ padding: '10px', color: 'var(--text-primary)' }}>{c.customer_code}</td>
                  <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{c.invoice_number}</td>
                  <td style={{ padding: '10px', color: 'var(--text-primary)' }}>
                    <span style={{ fontWeight: '500' }}>{c.type}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>{c.subtype}</span>
                  </td>
                  {role !== 'Sales Executive' && <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{c.raisedBy}</td>}
                  {role === 'Warehouse Manager' && <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{c.claimedBy}</td>}
                  {role === 'Sales Executive' && <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{c.warehouse_name}</td>}
                  <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{c.raised_date}</td>
                  {role === 'Warehouse Manager' && <td style={{ padding: '10px', color: c.escalated_date ? '#EF4444' : 'var(--text-muted)' }}>{c.escalated_date || 'N/A'}</td>}
                  <td style={{ padding: '10px' }}>
                    <span 
                      style={{
                        padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600',
                        backgroundColor: (c.status === 'Resolved' || c.status === 'Completed') ? 'rgba(16, 185, 129, 0.15)' :
                                         c.status?.includes('Escalated') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: (c.status === 'Resolved' || c.status === 'Completed') ? '#10B981' :
                               c.status?.includes('Escalated') ? '#EF4444' : '#F59E0B'
                      }}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{c.resolved_date}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Reports;

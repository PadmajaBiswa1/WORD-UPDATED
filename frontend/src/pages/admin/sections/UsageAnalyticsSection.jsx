import { useState, useEffect, useRef } from 'react';
import {
  BarChart3, HardDrive, Sparkles, FileText, Download,
  Printer, Users, CheckCircle2, XCircle, ArrowUpRight, RefreshCw
} from 'lucide-react';
import { adminApi } from '@/services/adminApi';

export function UsageAnalyticsSection() {
  const [timeframe, setTimeframe] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'inactive'

  // Canvas refs for Chart.js
  const docCanvasRef = useRef(null);
  const aiCanvasRef = useRef(null);
  const storageCanvasRef = useRef(null);

  const docChartInstance = useRef(null);
  const aiChartInstance = useRef(null);
  const storageChartInstance = useRef(null);

  const fetchAnalytics = async (days) => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getAnalytics(days);
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(timeframe);
  }, [timeframe]);

  // Render Charts with Chart.js
  useEffect(() => {
    if (!data || loading) return;

    let destroyed = false;

    const renderCharts = async () => {
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);

      // Clean up previous instances
      if (docChartInstance.current) { docChartInstance.current.destroy(); docChartInstance.current = null; }
      if (aiChartInstance.current) { aiChartInstance.current.destroy(); aiChartInstance.current = null; }
      if (storageChartInstance.current) { storageChartInstance.current.destroy(); storageChartInstance.current = null; }

      if (destroyed) return;

      const labels = data.labels || [];
      const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1f2937',
            titleColor: '#d4af37',
            bodyColor: '#f9fafb',
            borderColor: 'rgba(212,175,55,0.3)',
            borderWidth: 1,
            padding: 10,
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#8e9aa8', font: { size: 10 }, maxTicksLimit: 10 },
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#8e9aa8', font: { size: 10 } },
          },
        },
      };

      // 1. Documents Chart
      if (docCanvasRef.current) {
        const ctx = docCanvasRef.current.getContext('2d');
        docChartInstance.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Documents Created',
              data: data.metrics?.documentsCreated || [],
              backgroundColor: 'rgba(212, 175, 55, 0.75)',
              borderColor: '#d4af37',
              borderWidth: 1,
              borderRadius: 4,
            }],
          },
          options: commonOptions,
        });
      }

      // 2. AI Credits Chart
      if (aiCanvasRef.current) {
        const ctx = aiCanvasRef.current.getContext('2d');
        aiChartInstance.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: 'AI Credits Consumed',
              data: data.metrics?.aiCredits || [],
              borderColor: '#a855f7',
              backgroundColor: 'rgba(168, 85, 247, 0.15)',
              borderWidth: 2,
              fill: true,
              tension: 0.35,
              pointRadius: 2,
            }],
          },
          options: commonOptions,
        });
      }

      // 3. Storage Trajectory Chart
      if (storageCanvasRef.current) {
        const ctx = storageCanvasRef.current.getContext('2d');
        storageChartInstance.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: 'Total Storage (GB)',
              data: data.metrics?.storageGrowth || [],
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              borderWidth: 2,
              fill: true,
              tension: 0.25,
              pointRadius: 2,
            }],
          },
          options: commonOptions,
        });
      }
    };

    renderCharts();

    return () => {
      destroyed = true;
      if (docChartInstance.current) docChartInstance.current.destroy();
      if (aiChartInstance.current) aiChartInstance.current.destroy();
      if (storageChartInstance.current) storageChartInstance.current.destroy();
    };
  }, [data, loading]);

  // Export CSV Data
  const handleExportCSV = () => {
    if (!data) return;

    let csv = 'Timeframe (Day),Documents Created,AI Credits Consumed,Storage (GB)\n';
    const labels = data.labels || [];
    labels.forEach((day, idx) => {
      const docs = data.metrics?.documentsCreated[idx] || 0;
      const credits = data.metrics?.aiCredits[idx] || 0;
      const storage = data.metrics?.storageGrowth[idx] || 0;
      csv += `"${day}",${docs},${credits},${storage}\n`;
    });

    csv += '\n\nTop Storage Consumers\nName,Email,Department,Storage Used (Bytes)\n';
    (data.topStorageUsers || []).forEach((u) => {
      csv += `"${u.name}","${u.email}","${u.department}",${u.storageBytes}\n`;
    });

    csv += '\n\nTop AI Consumers\nName,Email,Department,Credits Consumed\n';
    (data.topAiUsers || []).forEach((u) => {
      csv += `"${u.name}","${u.email}","${u.department}",${u.aiCreditsUsed}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `etherx-org-usage-analytics-${timeframe}d.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Print Summary
  const handlePrintSummary = () => {
    window.print();
  };

  if (loading && !data) {
    return (
      <div style={styles.loaderWrap}>
        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: '#d4af37' }} />
        <span style={{ color: '#8e9aa8', fontSize: 14 }}>Aggregating analytics data…</span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header & Controls */}
      <div style={styles.toolbar}>
        <div>
          <h2 style={styles.sectionHeading}>Usage & Activity Analytics</h2>
          <p style={styles.sectionSub}>Historical tracking for document velocity, AI queries, and storage expansion</p>
        </div>

        <div style={styles.controlsGroup}>
          {/* Timeframe selector */}
          <div style={styles.timeframeToggle}>
            {[
              { label: '7 Days', val: 7 },
              { label: '30 Days', val: 30 },
              { label: '90 Days', val: 90 },
            ].map((item) => (
              <button
                key={item.val}
                style={{
                  ...styles.timeBtn,
                  ...(timeframe === item.val ? styles.timeBtnActive : {}),
                }}
                onClick={() => setTimeframe(item.val)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Export CSV */}
          <button style={styles.exportBtn} onClick={handleExportCSV}>
            <Download size={15} />
            <span>Export CSV</span>
          </button>

          {/* Print/PDF */}
          <button style={styles.secondaryBtn} onClick={handlePrintSummary}>
            <Printer size={15} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Primary Analytics Charts Grid */}
      <div style={styles.chartsGrid}>
        {/* Documents Created */}
        <div style={styles.chartCard}>
          <div style={styles.chartHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={17} color="#d4af37" />
              <h3 style={styles.chartTitle}>Documents Created Over Time</h3>
            </div>
            <span style={styles.chartMetricTag}>Daily Velocity</span>
          </div>
          <div style={styles.canvasWrap}>
            <canvas ref={docCanvasRef} />
          </div>
        </div>

        {/* AI Credits Consumed */}
        <div style={styles.chartCard}>
          <div style={styles.chartHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={17} color="#a855f7" />
              <h3 style={styles.chartTitle}>Pragna AI Credits Consumed</h3>
            </div>
            <span style={{ ...styles.chartMetricTag, color: '#a855f7', background: 'rgba(168,85,247,0.1)' }}>
              Monthly Pool: 50,000
            </span>
          </div>
          <div style={styles.canvasWrap}>
            <canvas ref={aiCanvasRef} />
          </div>
        </div>
      </div>

      {/* Storage Growth Trajectory & Top Users */}
      <div style={styles.chartsGrid}>
        {/* Storage Growth Trajectory */}
        <div style={styles.chartCard}>
          <div style={styles.chartHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <HardDrive size={17} color="#3b82f6" />
              <h3 style={styles.chartTitle}>Cloud Storage Growth (GB)</h3>
            </div>
            <span style={{ ...styles.chartMetricTag, color: '#3b82f6', background: 'rgba(59,130,246,0.1)' }}>
              Pro Unlimited
            </span>
          </div>
          <div style={styles.canvasWrap}>
            <canvas ref={storageCanvasRef} />
          </div>
        </div>

        {/* Top Consumers Breakdown */}
        <div style={styles.chartCard}>
          <div style={styles.chartHeader}>
            <h3 style={styles.chartTitle}>Top Organization Consumers</h3>
            <span style={styles.chartMetricTag}>Usage Ranking</span>
          </div>

          <div style={styles.topConsumersList}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8e9aa8', textTransform: 'uppercase', marginBottom: 4 }}>
              Leading Storage Users
            </div>
            {(data?.topStorageUsers || []).slice(0, 3).map((u, i) => (
              <div key={u.email} style={styles.consumerRow}>
                <div style={styles.consumerRank}>#{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f9fafb' }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{u.department}</div>
                </div>
                <strong style={{ color: '#d4af37', fontSize: 13 }}>{u.storageDisplay}</strong>
              </div>
            ))}

            <div style={{ fontSize: 11, fontWeight: 700, color: '#8e9aa8', textTransform: 'uppercase', margin: '12px 0 4px' }}>
              Leading AI Writing Users
            </div>
            {(data?.topAiUsers || []).slice(0, 2).map((u, i) => (
              <div key={u.email} style={styles.consumerRow}>
                <div style={styles.consumerRank}>#{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f9fafb' }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{u.department}</div>
                </div>
                <strong style={{ color: '#a855f7', fontSize: 13 }}>{u.aiCreditsUsed} credits</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active Users Tracking Table */}
      <div style={styles.activeUsersCard}>
        <div style={styles.activeUsersHeader}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: '#f9fafb', fontWeight: 600 }}>Active Users Tracking</h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>
              Daily Active Users: <strong style={{ color: '#10b981' }}>{data?.activeUsers?.dau}</strong> • Total Active Accounts: <strong style={{ color: '#f9fafb' }}>{data?.activeUsers?.mau}</strong>
            </p>
          </div>

          <div style={styles.togglePillWrap}>
            <button
              style={{ ...styles.togglePill, ...(activeTab === 'active' ? styles.togglePillActive : {}) }}
              onClick={() => setActiveTab('active')}
            >
              Active Users ({(data?.activeUsers?.activeList || []).length})
            </button>
            <button
              style={{ ...styles.togglePill, ...(activeTab === 'inactive' ? styles.togglePillActive : {}) }}
              onClick={() => setActiveTab('inactive')}
            >
              Inactive / Suspended ({(data?.activeUsers?.inactiveList || []).length})
            </button>
          </div>
        </div>

        <table style={styles.userTable}>
          <thead>
            <tr style={styles.userThRow}>
              <th style={styles.userTh}>USER</th>
              <th style={styles.userTh}>DEPARTMENT</th>
              <th style={styles.userTh}>ROLE</th>
              <th style={styles.userTh}>LAST ACTIVE</th>
              <th style={styles.userTh}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {(activeTab === 'active' ? data?.activeUsers?.activeList : data?.activeUsers?.inactiveList || []).map((u) => (
              <tr key={u.id} style={styles.userTr}>
                <td style={styles.userTd}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={styles.userAvatar}>{u.name.slice(0, 2).toUpperCase()}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#f9fafb' }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td style={styles.userTd}><span style={styles.deptBadge}>{u.department}</span></td>
                <td style={styles.userTd}><strong style={{ color: '#d4af37', fontSize: 12 }}>{u.role}</strong></td>
                <td style={styles.userTd}>
                  <span style={{ fontSize: 12, color: '#d1d5db' }}>
                    {u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString() : 'Never'}
                  </span>
                </td>
                <td style={styles.userTd}>
                  <span style={u.status === 'active' ? styles.badgeActive : styles.badgeInactive}>
                    {u.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 22,
  },
  loaderWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
    gap: 12,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
  },
  sectionHeading: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    color: '#f9fafb',
  },
  sectionSub: {
    margin: '4px 0 0',
    fontSize: 13,
    color: '#9ca3af',
  },
  controlsGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  timeframeToggle: {
    display: 'flex',
    background: '#12161f',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: 2,
  },
  timeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: 500,
    padding: '6px 12px',
    borderRadius: 6,
    cursor: 'pointer',
  },
  timeBtnActive: {
    background: 'rgba(212,175,55,0.15)',
    color: '#d4af37',
    fontWeight: 600,
  },
  exportBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'linear-gradient(135deg, #d4af37 0%, #aa8528 100%)',
    color: '#0b0d11',
    border: 'none',
    fontWeight: 600,
    fontSize: 13,
    padding: '8px 14px',
    borderRadius: 8,
    cursor: 'pointer',
  },
  secondaryBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#e5e7eb',
    fontWeight: 500,
    fontSize: 13,
    padding: '8px 14px',
    borderRadius: 8,
    cursor: 'pointer',
  },
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 20,
  },
  chartCard: {
    background: '#12161f',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: 22,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  chartHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chartTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: '#f9fafb',
  },
  chartMetricTag: {
    fontSize: 11,
    fontWeight: 600,
    color: '#d4af37',
    background: 'rgba(212,175,55,0.1)',
    padding: '3px 8px',
    borderRadius: 4,
  },
  canvasWrap: {
    height: 220,
    position: 'relative',
    width: '100%',
  },
  topConsumersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  consumerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.04)',
  },
  consumerRank: {
    width: 24,
    height: 24,
    borderRadius: 4,
    background: 'rgba(255,255,255,0.06)',
    color: '#d4af37',
    fontSize: 11,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeUsersCard: {
    background: '#12161f',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  activeUsersHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  togglePillWrap: {
    display: 'flex',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    padding: 3,
  },
  togglePill: {
    background: 'transparent',
    border: 'none',
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: 500,
    padding: '6px 14px',
    borderRadius: 6,
    cursor: 'pointer',
  },
  togglePillActive: {
    background: 'rgba(212,175,55,0.15)',
    color: '#d4af37',
    fontWeight: 600,
  },
  userTable: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  userThRow: {
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.01)',
  },
  userTh: {
    padding: '12px 20px',
    fontSize: 11,
    color: '#8e9aa8',
    letterSpacing: '0.06em',
  },
  userTr: {
    borderBottom: '1px solid rgba(255,255,255,0.03)',
  },
  userTd: {
    padding: '14px 20px',
    verticalAlign: 'middle',
  },
  userAvatar: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    background: '#1f2937',
    color: '#d4af37',
    fontSize: 11,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deptBadge: {
    fontSize: 11,
    color: '#d1d5db',
    background: 'rgba(255,255,255,0.04)',
    padding: '2px 8px',
    borderRadius: 4,
  },
  badgeActive: {
    fontSize: 10,
    fontWeight: 700,
    color: '#10b981',
    background: 'rgba(16,185,129,0.1)',
    padding: '2px 8px',
    borderRadius: 4,
  },
  badgeInactive: {
    fontSize: 10,
    fontWeight: 700,
    color: '#ef4444',
    background: 'rgba(239,68,68,0.1)',
    padding: '2px 8px',
    borderRadius: 4,
  },
};

import React, { useState, useEffect } from 'react';
import {
  Printer,
  Download,
  Calendar,
  Filter,
  BarChart2,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  CreditCard,
  Briefcase
} from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
import '../utils/chartConfig';
import { api } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';

export default function Reports({ categories }) {
  const { formatAmount, symbol } = useCurrency();
  const [period, setPeriod] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchReport = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.append('period', period);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (selectedCategory) params.append('category_id', selectedCategory);

      const res = await api.get(`/reports/summary?${params.toString()}`);
      setReportData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [period, startDate, endDate, selectedCategory]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCsv = async () => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (selectedCategory) params.append('category_id', selectedCategory);
    await api.downloadCsv(`/expenses/export/csv?${params.toString()}`, `financial-report-${new Date().toISOString().substring(0, 10)}.csv`);
  };

  const metrics = reportData?.metrics || {};
  const categoryBreakdown = reportData?.categoryBreakdown || [];
  const paymentMethods = reportData?.paymentMethods || [];
  const bizSplit = reportData?.bizSplit || [];

  // Income vs Expenses Comparison Chart
  const incomeVsExpenseData = {
    labels: ['Income (Base)', 'Expenses (Actual)', 'Net Savings'],
    datasets: [
      {
        label: `Amount (${symbol})`,
        data: [
          metrics.monthlyIncome || 0,
          metrics.totalSpending || 0,
          metrics.netSavings || 0
        ],
        backgroundColor: ['#3b82f6', '#ef4444', '#10b981'],
        borderRadius: 6
      }
    ]
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${symbol}${Number(ctx.raw).toFixed(2)}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: (val) => `${symbol}${val}` }
      }
    }
  };

  return (
    <div>
      {/* Top Filter and Actions Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 600 }}>Financial Reports & Analytics</h2>
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>
            Comprehensive statements, period comparison, and exportable ledgers.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="no-print">
          <button onClick={handleDownloadCsv} className="btn btn-secondary btn-sm">
            <Download size={14} /> Download CSV
          </button>
          <button onClick={handlePrint} className="btn btn-primary btn-sm">
            <Printer size={14} /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Filter Control Box */}
      <div className="card no-print" style={{ marginBottom: '24px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            {['week', 'month', 'quarter'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-secondary'}`}
                style={{ textTransform: 'capitalize' }}
              >
                {p}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="text-muted" style={{ fontSize: '0.8rem' }}>Range:</span>
            <input
              type="date"
              className="form-control"
              style={{ width: 'auto' }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-muted">—</span>
            <input
              type="date"
              className="form-control"
              style={{ width: 'auto' }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <select
            className="form-control"
            style={{ width: 'auto' }}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Printable Report Header */}
      <div style={{ display: 'none' }} className="printable-header">
        <h1>Automated Expense Tracker - Financial Statement</h1>
        <p>Period: {reportData?.startDate} to {reportData?.endDate}</p>
        <hr style={{ margin: '16px 0' }} />
      </div>

      {/* Summary KPI Cards */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="card">
          <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Total Expenditures</div>
          <div className="text-mono font-bold" style={{ fontSize: '1.6rem', color: '#ef4444' }}>
            {formatAmount(metrics.totalSpending || 0)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {metrics.spendingChangePercent >= 0 ? '+' : ''}{metrics.spendingChangePercent}% vs prior period
          </div>
        </div>

        <div className="card">
          <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Baseline Income</div>
          <div className="text-mono font-bold" style={{ fontSize: '1.6rem', color: '#3b82f6' }}>
            {formatAmount(metrics.monthlyIncome || 0)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Configured in user settings
          </div>
        </div>

        <div className="card">
          <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Net Cashflow</div>
          <div className="text-mono font-bold" style={{ fontSize: '1.6rem', color: '#10b981' }}>
            {formatAmount(metrics.netSavings || 0)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Savings Rate: {metrics.savingsRate}%
          </div>
        </div>

        <div className="card">
          <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Transaction Count</div>
          <div className="text-mono font-bold" style={{ fontSize: '1.6rem' }}>
            {metrics.txnCount || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Avg Ticket: {formatAmount(metrics.avgTxn || 0)}
          </div>
        </div>
      </div>

      {/* Cashflow Bar Chart & Business Split */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', marginBottom: '28px' }}>
        <div className="card" style={{ height: '340px', display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">Cash Flow & Net Savings</h3>
              <p className="text-muted" style={{ fontSize: '0.8rem' }}>Income vs actual recorded expense outflows</p>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Bar data={incomeVsExpenseData} options={barChartOptions} />
          </div>
        </div>

        <div className="card" style={{ height: '340px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="card-header">
              <div>
                <h3 className="card-title">Classification & Payment Mix</h3>
                <p className="text-muted" style={{ fontSize: '0.8rem' }}>Personal vs Business & Payment Methods</p>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Tax & Expense Classification
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                {bizSplit.map((b) => (
                  <div
                    key={b.type}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.type}</div>
                    <div className="text-mono font-bold" style={{ fontSize: '1.1rem' }}>{formatAmount(b.total_amount)}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{b.count} txns</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Payment Methods
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {paymentMethods.slice(0, 3).map((pm) => (
                  <div key={pm.payment_method} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>{pm.payment_method} ({pm.count})</span>
                    <span className="text-mono font-semibold">{formatAmount(pm.total_amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Ledger Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Category Spending Ledger</h3>
          <span className="text-muted" style={{ fontSize: '0.8rem' }}>{categoryBreakdown.length} active spending categories</span>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Total Spent</th>
                <th>Share of Total</th>
                <th>Transactions</th>
                <th>Avg / Txn</th>
              </tr>
            </thead>
            <tbody>
              {categoryBreakdown.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No transactions recorded for this period.
                  </td>
                </tr>
              ) : (
                categoryBreakdown.map((cat) => (
                  <tr key={cat.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: cat.color }} />
                        <span className="font-semibold">{cat.name}</span>
                      </div>
                    </td>
                    <td className="text-mono font-bold">{formatAmount(cat.total_amount)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="progress-bar-container" style={{ width: '80px', height: '6px' }}>
                          <div className="progress-bar-fill" style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }} />
                        </div>
                        <span className="text-mono" style={{ fontSize: '0.8rem' }}>{cat.percentage}%</span>
                      </div>
                    </td>
                    <td>{cat.count}</td>
                    <td className="text-mono" style={{ fontSize: '0.85rem' }}>
                      {formatAmount(cat.count > 0 ? cat.total_amount / cat.count : 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

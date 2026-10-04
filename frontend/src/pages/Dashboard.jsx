import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Wallet,
  PiggyBank,
  AlertCircle,
  Calendar,
  ArrowRight,
  Receipt,
  CreditCard,
  PlusCircle,
  FileCheck
} from 'lucide-react';
import { Line, Doughnut } from 'react-chartjs-2';
import '../utils/chartConfig';
import StatCard from '../components/StatCard';
import { api } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';

export default function Dashboard({ period, setTab, onOpenAddExpense }) {
  const { formatAmount, symbol } = useCurrency();
  const [reportData, setReportData] = useState(null);
  const [budgetData, setBudgetData] = useState(null);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [upcomingRecurring, setUpcomingRecurring] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError('');

      const [reportRes, budgetRes, expensesRes, recurringRes] = await Promise.all([
        api.get(`/reports/summary?period=${period}`),
        api.get('/budgets'),
        api.get('/expenses?limit=6&sort_by=date&sort_order=desc'),
        api.get('/recurring')
      ]);

      setReportData(reportRes);
      setBudgetData(budgetRes);
      setRecentExpenses(expensesRes.expenses || []);
      setUpcomingRecurring(recurringRes.recurring ? recurringRes.recurring.slice(0, 4) : []);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [period]);

  const handleLogRecurring = async (id) => {
    try {
      await api.post(`/recurring/${id}/log-as-expense`, {});
      loadDashboardData();
    } catch (err) {
      alert(err.message || 'Could not log recurring expense');
    }
  };

  if (isLoading && !reportData) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid var(--border-subtle)', borderTopColor: 'var(--primary-600)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '12px', fontSize: '0.9rem' }}>Analyzing financial telemetry...</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const metrics = reportData?.metrics || {};
  const totalSpending = metrics.totalSpending || 0;
  const overallBudget = budgetData?.overall?.amount || 0;
  const remainingBudget = Math.max(0, overallBudget - totalSpending);
  const savings = metrics.netSavings || 0;
  const changePercent = metrics.spendingChangePercent || 0;
  const changeType = changePercent > 0 ? 'positive' : changePercent < 0 ? 'negative' : 'neutral';

  // Timeline Chart Setup
  const timelineData = reportData?.timeline || [];
  const lineChartData = {
    labels: timelineData.map((t) => t.date.substring(5)),
    datasets: [
      {
        label: `Daily Spending (${symbol})`,
        data: timelineData.map((t) => t.daily_amount),
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#4f46e5',
        pointRadius: 4,
        pointHoverRadius: 6
      }
    ]
  };

  const lineChartOptions = {
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
        grid: { color: '#f1f5f9' },
        ticks: {
          callback: (val) => `${symbol}${val}`
        }
      },
      x: {
        grid: { display: false }
      }
    }
  };

  // Category Breakdown Doughnut Chart Setup
  const categoryBreakdown = reportData?.categoryBreakdown || [];
  const doughnutData = {
    labels: categoryBreakdown.map((c) => c.name),
    datasets: [
      {
        data: categoryBreakdown.map((c) => c.total_amount),
        backgroundColor: categoryBreakdown.map((c) => c.color || '#6366f1'),
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: { boxWidth: 12, padding: 14, font: { size: 12 } }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${symbol}${Number(ctx.raw).toFixed(2)} (${categoryBreakdown[ctx.dataIndex]?.percentage}%)`
        }
      }
    },
    cutout: '68%'
  };

  return (
    <div>
      {/* KPI Stats Grid */}
      <div className="stats-grid">
        <StatCard
          title="Total Spending"
          value={formatAmount(totalSpending)}
          subtitle={`vs ${formatAmount(metrics.priorSpending || 0)} prior`}
          change={changePercent}
          changeType={changeType}
          isGood={false}
          icon={TrendingUp}
          iconColor="#ef4444"
          iconBg="#fee2e2"
        />

        <StatCard
          title="Monthly Budget"
          value={formatAmount(overallBudget)}
          subtitle={budgetData?.overall?.status === 'exceeded' ? 'Budget exceeded' : `${budgetData?.overall?.percentage || 0}% allocated`}
          icon={Wallet}
          iconColor="#4f46e5"
          iconBg="#eef2ff"
        />

        <StatCard
          title="Remaining Budget"
          value={formatAmount(remainingBudget)}
          subtitle={overallBudget > 0 ? `${Math.round((remainingBudget / overallBudget) * 100)}% available` : 'No budget set'}
          icon={PiggyBank}
          iconColor="#10b981"
          iconBg="#ecfdf5"
        />

        <StatCard
          title="Net Cashflow (Savings)"
          value={formatAmount(savings)}
          subtitle={`Based on ${formatAmount(metrics.monthlyIncome || 5000)}/mo income`}
          change={metrics.savingsRate}
          changeType="positive"
          isGood={true}
          icon={CreditCard}
          iconColor="#0ea5e9"
          iconBg="#f0f9ff"
        />
      </div>

      {/* Main Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', marginBottom: '28px' }}>
        {/* Spending Over Time Chart */}
        <div className="card" style={{ height: '360px', display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">Spending Telemetry</h3>
              <p className="text-muted" style={{ fontSize: '0.8rem' }}>Daily expense expenditure over selected period</p>
            </div>
            <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>{period}</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            {timelineData.length > 0 ? (
              <Line data={lineChartData} options={lineChartOptions} />
            ) : (
              <div className="empty-state" style={{ height: '100%' }}>
                <Receipt className="empty-state-icon" />
                <p>No transactions recorded in this period.</p>
              </div>
            )}
          </div>
        </div>

        {/* Category Breakdown Doughnut Chart */}
        <div className="card" style={{ height: '360px', display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">Category Breakdown</h3>
              <p className="text-muted" style={{ fontSize: '0.8rem' }}>Distribution of expenses by category</p>
            </div>
            <button
              onClick={() => setTab('reports')}
              style={{ background: 'none', border: 'none', color: 'var(--primary-600)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              Details <ArrowRight size={14} />
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            {categoryBreakdown.length > 0 ? (
              <Doughnut data={doughnutData} options={doughnutOptions} />
            ) : (
              <div className="empty-state" style={{ height: '100%' }}>
                <AlertCircle className="empty-state-icon" />
                <p>No category expenditure data available.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Two Column Grid: Recent Transactions & Upcoming Recurring */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Recent Transactions Card */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Transactions</h3>
            <button
              onClick={() => setTab('expenses')}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              View All <ArrowRight size={14} />
            </button>
          </div>

          {recentExpenses.length === 0 ? (
            <div className="empty-state">
              <Receipt className="empty-state-icon" />
              <p style={{ marginBottom: '12px' }}>No expenses recorded yet.</p>
              <button onClick={onOpenAddExpense} className="btn btn-primary btn-sm">
                Record First Expense
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Merchant</th>
                    <th>Category</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentExpenses.map((exp) => (
                    <tr key={exp.id}>
                      <td className="text-mono" style={{ fontSize: '0.8rem' }}>{exp.date}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{exp.merchant}</div>
                        {exp.notes && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '160px' }}>
                            {exp.notes}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: `${exp.category_color}18`,
                            color: exp.category_color,
                            border: `1px solid ${exp.category_color}40`
                          }}
                        >
                          {exp.category_name}
                        </span>
                      </td>
                      <td className="text-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {formatAmount(exp.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Upcoming Recurring Expenses Card */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Upcoming Recurring Commitments</h3>
              <p className="text-muted" style={{ fontSize: '0.8rem' }}>Scheduled bills and subscriptions</p>
            </div>
            <button
              onClick={() => setTab('budgets')}
              style={{ background: 'none', border: 'none', color: 'var(--primary-600)', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              Manage
            </button>
          </div>

          {upcomingRecurring.length === 0 ? (
            <div className="empty-state">
              <Calendar className="empty-state-icon" />
              <p>No upcoming recurring bills configured.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {upcomingRecurring.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary-600)'
                      }}
                    >
                      <Calendar size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Due on {item.next_due_date} • {item.frequency}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="text-mono font-bold" style={{ fontSize: '0.95rem' }}>
                      {formatAmount(item.amount)}
                    </span>
                    <button
                      onClick={() => handleLogRecurring(item.id)}
                      className="btn btn-secondary btn-sm"
                      title="Log as paid transaction today"
                      style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                    >
                      <FileCheck size={14} /> Log
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

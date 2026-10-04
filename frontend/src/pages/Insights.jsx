import React, { useState, useEffect } from 'react';
import {
  Lightbulb,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  ThumbsUp,
  X,
  RotateCcw,
  CheckCircle2,
  DollarSign,
  Info,
  HelpCircle
} from 'lucide-react';
import { api } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';

export default function Insights() {
  const { formatAmount } = useCurrency();
  const [insights, setInsights] = useState([]);
  const [metrics, setMetrics] = useState({ activeCount: 0, potentialMonthlySavings: 0, helpfulCount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchInsights = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/insights');
      setInsights(res.insights || []);
      setMetrics(res.metrics || { activeCount: 0, potentialMonthlySavings: 0, helpfulCount: 0 });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await api.post('/insights/refresh', {});
      await fetchInsights();
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDismiss = async (id) => {
    try {
      await api.post(`/insights/${id}/dismiss`, {});
      setInsights(prev => prev.filter(i => i.id !== id));
      setMetrics(prev => ({ ...prev, activeCount: Math.max(0, prev.activeCount - 1) }));
    } catch (err) {
      alert(err.message || 'Failed to dismiss insight');
    }
  };

  const handleToggleHelpful = async (id) => {
    try {
      const res = await api.post(`/insights/${id}/helpful`, {});
      setInsights(prev => prev.map(i => i.id === id ? { ...i, is_helpful: res.is_helpful } : i));
      setMetrics(prev => ({
        ...prev,
        helpfulCount: res.is_helpful ? prev.helpfulCount + 1 : Math.max(0, prev.helpfulCount - 1)
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const getSeverityBadge = (severity, type) => {
    switch (severity) {
      case 'danger':
        return <span className="badge badge-danger">High Impact</span>;
      case 'warning':
        return <span className="badge badge-warning">Spending Alert</span>;
      case 'info':
      default:
        return type === 'savings_tip'
          ? <span className="badge badge-success">Optimization Opportunity</span>
          : <span className="badge badge-info">Trend Observation</span>;
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 600 }}>Spending Intelligence & Suggestions</h2>
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>
            Telemetry-driven recommendations derived mathematically from your recorded transactions.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RotateCcw size={14} className={isRefreshing ? 'spin' : ''} />
          <span>{isRefreshing ? 'Analyzing Data...' : 'Re-Run Analytics'}</span>
        </button>
      </div>

      {/* Metrics Top Cards */}
      <div className="stats-grid" style={{ marginBottom: '28px' }}>
        <div className="card">
          <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '4px' }}>
            Active Insights
          </div>
          <div className="text-mono font-bold" style={{ fontSize: '1.6rem', color: 'var(--primary-600)' }}>
            {metrics.activeCount}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Actionable alerts generated</span>
        </div>

        <div className="card">
          <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '4px' }}>
            Potential Monthly Savings
          </div>
          <div className="text-mono font-bold" style={{ fontSize: '1.6rem', color: '#10b981' }}>
            {formatAmount(metrics.potentialMonthlySavings)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Identified through spend optimization</span>
        </div>

        <div className="card">
          <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '4px' }}>
            Helpful Ratings
          </div>
          <div className="text-mono font-bold" style={{ fontSize: '1.6rem', color: '#f59e0b' }}>
            {metrics.helpfulCount}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>User-confirmed relevant suggestions</span>
        </div>
      </div>

      {/* Insights List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          Computing algorithmic insights from database transactions...
        </div>
      ) : insights.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '64px 24px' }}>
          <CheckCircle2 size={48} color="#10b981" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.15rem', marginBottom: '6px' }}>No Active Anomalies Detected</h3>
          <p className="text-muted" style={{ maxWidth: '480px', margin: '0 auto 16px', fontSize: '0.875rem' }}>
            Your spending patterns are currently aligned with your configured budgets. As you record more transactions, the automated intelligence engine will detect trends, merchant frequencies, and savings opportunities.
          </p>
          <button onClick={handleRefresh} className="btn btn-secondary btn-sm">
            Check Telemetry Now
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {insights.map((item) => (
            <div
              key={item.id}
              className="card"
              style={{
                borderLeft: `4px solid ${item.severity === 'danger' ? '#ef4444' : item.severity === 'warning' ? '#f59e0b' : '#4f46e5'}`,
                transition: 'box-shadow 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {getSeverityBadge(item.severity, item.type)}
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {item.title}
                  </h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {item.potential_savings > 0 && (
                    <span
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'var(--success-text)',
                        backgroundColor: 'var(--success-bg)',
                        border: '1px solid var(--success-border)',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      Save up to {formatAmount(item.potential_savings)}/mo
                    </span>
                  )}
                  <button
                    onClick={() => handleDismiss(item.id)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '4px 8px' }}
                    title="Dismiss this insight"
                  >
                    <X size={14} /> Dismiss
                  </button>
                </div>
              </div>

              {/* Main recommendation text */}
              <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '14px', lineHeight: 1.5 }}>
                {item.description}
              </p>

              {/* Mathematical Derivation Box */}
              <div
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>
                  <HelpCircle size={14} /> How this suggestion was derived:
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.4, fontFamily: 'var(--font-mono)' }}>
                  {item.derivation}
                </div>
              </div>

              {/* Bottom Footer Action */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                  Category: {item.category_name || 'Cross-Category'}
                </span>

                <button
                  onClick={() => handleToggleHelpful(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: item.is_helpful ? 'var(--primary-50)' : 'transparent',
                    border: `1px solid ${item.is_helpful ? 'var(--primary-500)' : 'var(--border-subtle)'}`,
                    color: item.is_helpful ? 'var(--primary-600)' : 'var(--text-secondary)',
                    borderRadius: 'var(--radius-md)',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <ThumbsUp size={13} />
                  <span>{item.is_helpful ? 'Marked Helpful' : 'Helpful?'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

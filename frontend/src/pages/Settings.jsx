import React, { useState, useEffect } from 'react';
import {
  User,
  DollarSign,
  Clock,
  Bell,
  Activity,
  Check,
  Server,
  Database,
  Cpu,
  RefreshCw,
  LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { api } from '../services/api';

export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const { formatAmount } = useCurrency();

  const [name, setName] = useState(user?.name || '');
  const [currency, setCurrency] = useState(user?.currency || 'USD');
  const [monthlyIncome, setMonthlyIncome] = useState(user?.monthly_income || 5000);
  const [timezone, setTimezone] = useState(user?.timezone || 'UTC');
  const [dateFormat, setDateFormat] = useState(user?.date_format || 'YYYY-MM-DD');

  // Notification toggles
  const [budgetAlerts, setBudgetAlerts] = useState(user?.notification_budget_alerts !== 0);
  const [recurringReminders, setRecurringReminders] = useState(user?.notification_recurring_reminders !== 0);
  const [spendingSpikes, setSpendingSpikes] = useState(user?.notification_spending_spikes !== 0);

  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setCurrency(user.currency || 'USD');
      setMonthlyIncome(user.monthly_income || 5000);
      setTimezone(user.timezone || 'UTC');
      setDateFormat(user.date_format || 'YYYY-MM-DD');
      setBudgetAlerts(user.notification_budget_alerts !== 0);
      setRecurringReminders(user.notification_recurring_reminders !== 0);
      setSpendingSpikes(user.notification_spending_spikes !== 0);
    }
  }, [user]);

  const fetchHealth = async () => {
    try {
      setCheckingHealth(true);
      const res = await fetch('/health');
      const data = await res.json();
      setHealthStatus(data);
    } catch (err) {
      setHealthStatus({ status: 'unreachable', error: err.message });
    } finally {
      setCheckingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setSavedSuccess(false);

      const res = await api.put('/auth/profile', {
        name,
        currency,
        monthly_income: parseFloat(monthlyIncome),
        timezone,
        date_format: dateFormat,
        notification_budget_alerts: budgetAlerts ? 1 : 0,
        notification_recurring_reminders: recurringReminders ? 1 : 0,
        notification_spending_spikes: spendingSpikes ? 1 : 0
      });

      updateUser(res.user);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      alert(err.message || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '840px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 600 }}>Account & System Settings</h2>
        <p className="text-muted" style={{ fontSize: '0.85rem' }}>
          Manage your personal profile, preferred currency formatting, notification preferences, and DevOps telemetry.
        </p>
      </div>

      {savedSuccess && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            backgroundColor: 'var(--success-bg)',
            color: 'var(--success-text)',
            border: '1px solid var(--success-border)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            fontSize: '0.875rem'
          }}
        >
          <Check size={16} />
          <span>Preferences saved successfully and dynamically updated across the application!</span>
        </div>
      )}

      <form onSubmit={handleSaveProfile}>
        {/* Profile Card */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={18} color="var(--primary-600)" /> Profile Details
            </h3>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                required
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address (Read-only)</label>
              <input
                type="email"
                disabled
                className="form-control"
                style={{ backgroundColor: 'var(--bg-subtle)' }}
                value={user?.email || ''}
              />
            </div>
          </div>
        </div>

        {/* Currency & Financial Preferences Card */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={18} color="var(--primary-600)" /> Currency & Financial Baseline
            </h3>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Primary Currency</label>
              <select
                className="form-control"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="USD">USD ($) - US Dollar</option>
                <option value="EUR">EUR (€) - Euro</option>
                <option value="GBP">GBP (£) - British Pound</option>
                <option value="INR">INR (₹) - Indian Rupee</option>
                <option value="CAD">CAD (CA$) - Canadian Dollar</option>
                <option value="AUD">AUD (A$) - Australian Dollar</option>
                <option value="JPY">JPY (¥) - Japanese Yen</option>
                <option value="CHF">CHF - Swiss Franc</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Estimated Monthly Income</label>
              <input
                type="number"
                step="100"
                className="form-control text-mono"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(e.target.value)}
                placeholder="5000"
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Used to benchmark savings rates in reports and dashboards.
              </span>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Timezone</label>
              <select
                className="form-control"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                <option value="UTC">UTC (Coordinated Universal Time)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Date Format</label>
              <select
                className="form-control"
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (EU)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notifications Preferences Card */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={18} color="var(--primary-600)" /> In-App Notification Alerts
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={budgetAlerts}
                onChange={(e) => setBudgetAlerts(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary-600)' }}
              />
              <div>
                <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>Budget Threshold Alerts</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Notify me when any category exceeds 80% or 100% of its budget limit.
                </div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={recurringReminders}
                onChange={(e) => setRecurringReminders(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary-600)' }}
              />
              <div>
                <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>Recurring Bill Reminders</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Receive advance reminders when scheduled subscriptions or rent payments are due.
                </div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={spendingSpikes}
                onChange={(e) => setSpendingSpikes(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary-600)' }}
              />
              <div>
                <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>Spending Spike Alerts</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Alert when algorithmic telemetry identifies an unusual increase in category spending.
                </div>
              </div>
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? 'Saving Changes...' : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* DevOps System & Health Telemetry Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Server size={18} color="var(--primary-600)" /> DevOps Service Health & Probes
            </h3>
            <p className="text-muted" style={{ fontSize: '0.8rem' }}>Live status of container and backend runtime</p>
          </div>
          <button
            onClick={fetchHealth}
            disabled={checkingHealth}
            className="btn btn-secondary btn-sm"
          >
            <RefreshCw size={14} className={checkingHealth ? 'spin' : ''} /> Check Now
          </button>
        </div>

        {healthStatus ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '12px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>API Health</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: healthStatus.status === 'healthy' ? '#10b981' : '#ef4444'
                  }}
                />
                <span className="font-semibold" style={{ textTransform: 'capitalize' }}>
                  {healthStatus.status}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Uptime: {healthStatus.uptimeSeconds || 0}s
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Database Engine</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <Database size={14} color="#4f46e5" />
                <span className="font-semibold">
                  SQLite (WASM WAL)
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Ping: {healthStatus.database?.responseTimeMs || 1}ms
              </div>
            </div>

            <div style={{ padding: '12px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Runtime Memory</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <Cpu size={14} color="#06b6d4" />
                <span className="font-semibold text-mono">
                  {healthStatus.system?.memoryUsageMb?.heapUsed || 0} MB
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Node {healthStatus.system?.nodeVersion || 'v24'}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Probing backend...</div>
        )}
      </div>

      {/* Session Sign Out */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Sign Out of Session</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            End current session on this browser device.
          </div>
        </div>
        <button onClick={logout} className="btn btn-danger btn-sm">
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </div>
  );
}

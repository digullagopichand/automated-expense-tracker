import React from 'react';
import { Menu, Plus, Calendar } from 'lucide-react';
import NotificationCenter from './NotificationCenter';

export default function Navbar({
  pageTitle,
  period,
  setPeriod,
  onOpenAddExpense,
  setIsSidebarOpen
}) {
  return (
    <header
      className="navbar"
      style={{
        height: 'var(--navbar-height)',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        position: 'sticky',
        top: 0,
        zIndex: 90
      }}
    >
      {/* Left: Mobile Toggle & Page Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="mobile-toggle-btn"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '6px',
            display: 'none'
          }}
          title="Open menu"
        >
          <Menu size={22} />
        </button>

        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {pageTitle}
          </h2>
        </div>
      </div>

      {/* Right: Period Switcher, Quick Add Button & Notification Center */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Period Selector (visible on relevant pages) */}
        {setPeriod && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-subtle)',
              padding: '3px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            {[
              { id: 'week', label: 'Week' },
              { id: 'month', label: 'Month' },
              { id: 'quarter', label: 'Quarter' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                style={{
                  background: period === p.id ? '#ffffff' : 'transparent',
                  color: period === p.id ? 'var(--primary-600)' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 10px',
                  fontSize: '0.8rem',
                  fontWeight: period === p.id ? 600 : 500,
                  cursor: 'pointer',
                  boxShadow: period === p.id ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* Quick Add Expense Action */}
        {onOpenAddExpense && (
          <button
            onClick={onOpenAddExpense}
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>Add Expense</span>
          </button>
        )}

        {/* In-app Notification Dropdown */}
        <NotificationCenter />
      </div>
    </header>
  );
}

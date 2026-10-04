import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export default function StatCard({
  title,
  value,
  subtitle,
  change,
  changeType, // 'positive' (increase), 'negative' (decrease), 'neutral'
  isGood, // whether positive change is desirable (e.g. for savings, up is good; for expenses, down is good)
  icon: Icon,
  iconColor = '#4f46e5',
  iconBg = '#eef2ff'
}) {
  const getBadgeStyle = () => {
    if (changeType === 'neutral' || change === undefined) {
      return {
        bg: 'var(--bg-subtle)',
        text: 'var(--text-secondary)',
        icon: <Minus size={12} />
      };
    }

    const isFavorable = isGood ? changeType === 'positive' : changeType === 'negative';
    if (isFavorable) {
      return {
        bg: 'var(--success-bg)',
        text: 'var(--success-text)',
        border: 'var(--success-border)',
        icon: changeType === 'positive' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />
      };
    } else {
      return {
        bg: 'var(--danger-bg)',
        text: 'var(--danger-text)',
        border: 'var(--danger-border)',
        icon: changeType === 'positive' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />
      };
    }
  };

  const badge = getBadgeStyle();

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
          {title}
        </span>
        {Icon && (
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Icon size={18} color={iconColor} />
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '6px' }}>
          {value}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {change !== undefined && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: badge.bg,
                color: badge.text,
                border: badge.border ? `1px solid ${badge.border}` : 'none'
              }}
            >
              {badge.icon}
              {Math.abs(change)}%
            </span>
          )}
          {subtitle && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {subtitle}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

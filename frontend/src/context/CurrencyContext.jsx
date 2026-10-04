import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';

const CurrencyContext = createContext(null);

const currencySymbols = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  JPY: '¥',
  CAD: 'CA$',
  AUD: 'A$',
  CHF: 'CHF '
};

export function CurrencyProvider({ children }) {
  const { user } = useAuth();
  const currencyCode = user?.currency || 'USD';
  const symbol = currencySymbols[currencyCode] || '$';

  const formatAmount = (val) => {
    if (val === null || val === undefined || isNaN(val)) return `${symbol}0.00`;
    const num = Number(val);
    return `${symbol}${num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  return (
    <CurrencyContext.Provider value={{
      currencyCode,
      symbol,
      formatAmount
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}

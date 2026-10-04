import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  Upload,
  Download,
  Trash2,
  Edit2,
  FileText,
  RotateCcw,
  CheckCircle2,
  Image as ImageIcon,
  ExternalLink,
  Briefcase,
  User
} from 'lucide-react';
import { api } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';
import CSVImportModal from '../components/CSVImportModal';

export default function Expenses({ onOpenAddExpense, onEditExpense, categories }) {
  const { formatAmount, symbol } = useCurrency();
  const [expenses, setExpenses] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1, totalAmount: 0 });
  const [isLoading, setIsLoading] = useState(false);

  // Filters state
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const fetchExpenses = async (page = 1) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', 20);

      if (search.trim()) params.append('search', search.trim());
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (selectedCategory) params.append('category_id', selectedCategory);
      if (selectedMethod) params.append('payment_method', selectedMethod);
      if (selectedType !== '') params.append('is_business', selectedType);
      if (minAmount) params.append('min_amount', minAmount);
      if (maxAmount) params.append('max_amount', maxAmount);

      const res = await api.get(`/expenses?${params.toString()}`);
      setExpenses(res.expenses || []);
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1, totalAmount: 0 });
    } catch (err) {
      console.error('Failed to load expenses', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses(1);
  }, [startDate, endDate, selectedCategory, selectedMethod, selectedType, minAmount, maxAmount]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchExpenses(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleResetFilters = () => {
    setSearch('');
    setStartDate('');
    setEndDate('');
    setSelectedCategory('');
    setSelectedMethod('');
    setSelectedType('');
    setMinAmount('');
    setMaxAmount('');
  };

  const handleDelete = async (id, merchant) => {
    if (window.confirm(`Delete expense record for "${merchant}"?`)) {
      try {
        await api.delete(`/expenses/${id}`);
        fetchExpenses(pagination.page);
      } catch (err) {
        alert(err.message || 'Failed to delete expense');
      }
    }
  };

  const handleExportCsv = async () => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (selectedCategory) params.append('category_id', selectedCategory);
    await api.downloadCsv(`/expenses/export/csv?${params.toString()}`, `expenses-${new Date().toISOString().substring(0, 10)}.csv`);
  };

  return (
    <div>
      {/* Top Action Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 600 }}>Expense Transactions</h2>
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>
            Showing {pagination.total} records totaling <strong className="text-mono" style={{ color: 'var(--text-primary)' }}>{formatAmount(pagination.totalAmount)}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setIsCsvModalOpen(true)} className="btn btn-secondary btn-sm">
            <Upload size={14} /> Import CSV
          </button>
          <button onClick={handleExportCsv} className="btn btn-secondary btn-sm">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={onOpenAddExpense} className="btn btn-primary btn-sm">
            <Plus size={16} /> Add Expense
          </button>
        </div>
      </div>

      {/* Filter and Search Bar Card */}
      <div className="card" style={{ marginBottom: '20px', padding: '18px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'center' }}>
          {/* Search box */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search merchant, notes..."
              className="form-control"
              style={{ paddingLeft: '32px' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          <select
            className="form-control"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Payment Method Filter */}
          <select
            className="form-control"
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
          >
            <option value="">All Payment Methods</option>
            <option value="Credit Card">Credit Card</option>
            <option value="Debit Card">Debit Card</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Cash">Cash</option>
            <option value="Electronic / UPI">Electronic / UPI</option>
          </select>

          {/* Type Filter: Personal vs Business */}
          <select
            className="form-control"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="">Personal & Business</option>
            <option value="0">Personal Only</option>
            <option value="1">Business Only</option>
          </select>

          {/* Date Range Start */}
          <input
            type="date"
            className="form-control"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            title="Start Date"
          />

          {/* Date Range End */}
          <input
            type="date"
            className="form-control"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            title="End Date"
          />

          {/* Reset Filters */}
          <button
            type="button"
            onClick={handleResetFilters}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
          >
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Merchant</th>
                <th>Category</th>
                <th>Type</th>
                <th>Payment Method</th>
                <th>Amount</th>
                <th>Receipt</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    Loading transactions...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '12px' }}>No expenses found matching the selected filters.</div>
                    <button onClick={handleResetFilters} className="btn btn-secondary btn-sm">Clear Active Filters</button>
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id}>
                    <td className="text-mono" style={{ fontSize: '0.8125rem' }}>{exp.date}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{exp.merchant}</div>
                      {exp.notes && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                    <td>
                      {exp.is_business ? (
                        <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Briefcase size={11} /> Business
                        </span>
                      ) : (
                        <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <User size={11} /> Personal
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {exp.payment_method}
                    </td>
                    <td className="text-mono font-bold" style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      {formatAmount(exp.amount)}
                    </td>
                    <td>
                      {exp.receipt_url ? (
                        <button
                          onClick={() => setSelectedReceipt(exp.receipt_url)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          title="View attached receipt"
                        >
                          <ImageIcon size={13} color="var(--primary-600)" /> View
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => onEditExpense(exp)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px' }}
                          title="Edit transaction"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(exp.id, exp.merchant)}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '4px 8px' }}
                          title="Delete transaction"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-subtle)'
            }}
          >
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchExpenses(pagination.page - 1)}
                className="btn btn-secondary btn-sm"
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchExpenses(pagination.page + 1)}
                className="btn btn-secondary btn-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onImported={() => fetchExpenses(1)}
      />

      {/* Receipt Viewer Lightbox Modal */}
      {selectedReceipt && (
        <div className="modal-overlay" onClick={() => setSelectedReceipt(null)}>
          <div className="modal-content" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="card-title">Attached Receipt</h3>
              <button onClick={() => setSelectedReceipt(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', backgroundColor: '#0f172a', padding: '16px' }}>
              <img
                src={selectedReceipt}
                alt="Receipt Preview"
                style={{ maxWidth: '100%', maxHeight: '480px', objectFit: 'contain', borderRadius: 'var(--radius-md)' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentNode.innerHTML += '<div style="color: #fff; padding: 40px;">PDF or unsupported file preview. <a href="' + selectedReceipt + '" target="_blank" style="color: #818cf8; text-decoration: underline;">Open Receipt File</a></div>';
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

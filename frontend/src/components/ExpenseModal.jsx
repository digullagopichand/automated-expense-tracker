import React, { useState, useEffect } from 'react';
import { X, Upload, Check, AlertCircle, FileText, Image } from 'lucide-react';
import { api } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';

export default function ExpenseModal({ isOpen, onClose, onSaved, expenseToEdit, categories }) {
  const { symbol } = useCurrency();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [merchant, setMerchant] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Credit Card');
  const [notes, setNotes] = useState('');
  const [isBusiness, setIsBusiness] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState('monthly');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (expenseToEdit) {
      setAmount(expenseToEdit.amount || '');
      setDate(expenseToEdit.date || new Date().toISOString().substring(0, 10));
      setMerchant(expenseToEdit.merchant || '');
      setCategoryId(expenseToEdit.category_id || (categories[0]?.id || ''));
      setPaymentMethod(expenseToEdit.payment_method || 'Credit Card');
      setNotes(expenseToEdit.notes || '');
      setIsBusiness(!!expenseToEdit.is_business);
      setIsRecurring(!!expenseToEdit.is_recurring);
      setRecurringFrequency(expenseToEdit.recurring_frequency || 'monthly');
      setReceiptUrl(expenseToEdit.receipt_url || '');
    } else {
      setAmount('');
      setDate(new Date().toISOString().substring(0, 10));
      setMerchant('');
      setCategoryId(categories.length > 0 ? categories[0].id : '');
      setPaymentMethod('Credit Card');
      setNotes('');
      setIsBusiness(false);
      setIsRecurring(false);
      setRecurringFrequency('monthly');
      setReceiptUrl('');
      setReceiptFile(null);
    }
    setError('');
  }, [expenseToEdit, categories, isOpen]);

  if (!isOpen) return null;

  const handleReceiptUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setReceiptFile(file);
    const formData = new FormData();
    formData.append('receipt', file);

    try {
      setUploadingReceipt(true);
      setError('');
      const res = await api.uploadFile('/expenses/upload-receipt', formData);
      setReceiptUrl(res.receipt_url);
    } catch (err) {
      setError(err.message || 'Failed to upload receipt');
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      setError('Please enter a valid positive expense amount.');
      return;
    }
    if (!merchant.trim()) {
      setError('Merchant name is required.');
      return;
    }
    if (!categoryId) {
      setError('Please select a category.');
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        amount: parseFloat(amount),
        date,
        merchant: merchant.trim(),
        category_id: parseInt(categoryId, 10),
        payment_method: paymentMethod,
        notes: notes.trim(),
        receipt_url: receiptUrl,
        is_recurring: isRecurring ? 1 : 0,
        recurring_frequency: isRecurring ? recurringFrequency : 'none',
        is_business: isBusiness ? 1 : 0
      };

      if (expenseToEdit) {
        await api.put(`/expenses/${expenseToEdit.id}`, payload);
      } else {
        await api.post('/expenses', payload);
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save expense');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="card-title">
            {expenseToEdit ? 'Edit Expense Record' : 'Record New Expense'}
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  backgroundColor: 'var(--danger-bg)',
                  border: '1px solid var(--danger-border)',
                  color: 'var(--danger-text)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '16px',
                  fontSize: '0.85rem'
                }}
              >
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Amount ({symbol}) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  className="form-control text-mono"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Date *</label>
                <input
                  type="date"
                  required
                  className="form-control"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Merchant / Vendor *</label>
              <input
                type="text"
                required
                placeholder="e.g. AWS, Whole Foods, Delta Airlines"
                className="form-control"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select
                  required
                  className="form-control"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="" disabled>Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select
                  className="form-control"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="Credit Card">Credit Card</option>
                  <option value="Debit Card">Debit Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="Electronic / UPI">Electronic / UPI</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes & Description</label>
              <textarea
                rows="2"
                placeholder="Add contextual details or receipt notes..."
                className="form-control"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Receipt Upload & Preview */}
            <div className="form-group">
              <label className="form-label">Receipt Attachment (Optional)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label
                  className="btn btn-secondary btn-sm"
                  style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Upload size={14} />
                  <span>{uploadingReceipt ? 'Uploading...' : 'Upload Receipt / Invoice'}</span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    style={{ display: 'none' }}
                    onChange={handleReceiptUpload}
                    disabled={uploadingReceipt}
                  />
                </label>

                {receiptUrl && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.8rem',
                      color: 'var(--success-text)',
                      backgroundColor: 'var(--success-bg)',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--success-border)'
                    }}
                  >
                    <Check size={14} />
                    Receipt Attached
                  </span>
                )}
              </div>
            </div>

            {/* Classifications: Business Expense & Recurring */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                padding: '12px 16px',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)',
                marginTop: '8px'
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={isBusiness}
                  onChange={(e) => setIsBusiness(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary-600)' }}
                />
                <span>Business Expense (Tax Deductible)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary-600)' }}
                />
                <span>Recurring Schedule</span>
              </label>
            </div>

            {isRecurring && (
              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label">Recurring Frequency</label>
                <select
                  className="form-control"
                  value={recurringFrequency}
                  onChange={(e) => setRecurringFrequency(e.target.value)}
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving || uploadingReceipt}
            >
              {isSaving ? 'Saving...' : expenseToEdit ? 'Save Changes' : 'Record Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

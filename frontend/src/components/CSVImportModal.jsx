import React, { useState } from 'react';
import { X, Upload, CheckCircle2, AlertTriangle, FileSpreadsheet, Download } from 'lucide-react';
import { api } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';

export default function CSVImportModal({ isOpen, onClose, onImported }) {
  const { symbol } = useCurrency();
  const [file, setFile] = useState(null);
  const [csvText, setCsvText] = useState('');
  const [useManualInput, setUseManualInput] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleDownloadSample = () => {
    const sample = `Amount,Date,Merchant,Category,Payment Method,Notes,Business\n54.20,2026-10-02,Trader Joes,Food & Dining,Debit Card,Weekly fruits,0\n18.50,2026-10-03,Blue Bottle Coffee,Food & Dining,Credit Card,Client meeting,1\n85.00,2026-10-04,AWS Cloud,Utilities,Credit Card,Staging servers,1\n45.00,2026-10-04,Metro Transit Card,Transport,Debit Card,Subway recharge,0`;
    const blob = new Blob([sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-expense-import.csv';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handlePreview = async () => {
    setError('');
    if (!file && !csvText.trim()) {
      setError('Please select a CSV file or enter CSV data.');
      return;
    }

    try {
      setIsProcessing(true);
      let res;
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        res = await api.uploadFile('/expenses/import/preview', formData);
      } else {
        res = await api.post('/expenses/import/preview', { csvText });
      }

      setPreviewResult(res);
      if (!res.isValid && res.error) {
        setError(res.error);
      }
    } catch (err) {
      setError(err.message || 'Failed to parse CSV preview.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommit = async () => {
    if (!previewResult || !previewResult.rows) return;
    const validRows = previewResult.rows.filter(r => r.isValid);
    if (validRows.length === 0) {
      setError('No valid rows available to import.');
      return;
    }

    try {
      setIsCommitting(true);
      await api.post('/expenses/import/commit', { rows: validRows });
      onImported();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to complete import.');
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={20} color="var(--primary-600)" />
            <h3 className="card-title">Import Expenses via CSV</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

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
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {!previewResult ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  Upload your bank or credit card export file. Column headers like <code>Amount</code>, <code>Date</code>, <code>Merchant</code>, and <code>Category</code> are automatically mapped.
                </p>
                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                >
                  <Download size={14} /> Sample CSV
                </button>
              </div>

              {!useManualInput ? (
                <div
                  style={{
                    border: '2px dashed var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '36px 20px',
                    textAlign: 'center',
                    backgroundColor: 'var(--bg-subtle)',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s'
                  }}
                  onClick={() => document.getElementById('csv-file-input').click()}
                >
                  <Upload size={36} color="var(--primary-500)" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {file ? file.name : 'Click to browse or drag and drop CSV file'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Supports UTF-8 CSV exports up to 5MB
                  </div>
                  <input
                    id="csv-file-input"
                    type="file"
                    accept=".csv"
                    style={{ display: 'none' }}
                    onChange={(e) => setFile(e.target.files[0])}
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Paste CSV Content</label>
                  <textarea
                    rows="6"
                    className="form-control text-mono"
                    placeholder="Amount,Date,Merchant,Category,Payment Method&#10;45.00,2026-10-02,Trader Joes,Food & Dining,Debit Card"
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                  />
                </div>
              )}

              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setUseManualInput(!useManualInput)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary-600)', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  {useManualInput ? 'Switch to file upload' : 'Or paste raw CSV text instead'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* Validation Summary Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  backgroundColor: previewResult.validRowsCount > 0 ? 'var(--success-bg)' : 'var(--danger-bg)',
                  border: `1px solid ${previewResult.validRowsCount > 0 ? 'var(--success-border)' : 'var(--danger-border)'}`,
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '16px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={18} color="var(--success-main)" />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Previewing {previewResult.totalRows} transactions ({previewResult.validRowsCount} ready to import)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewResult(null)}
                  className="btn btn-secondary btn-sm"
                >
                  Change File
                </button>
              </div>

              {/* Interactive Preview Table */}
              <div className="table-container" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Date</th>
                      <th>Merchant</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewResult.rows.map((row) => (
                      <tr key={row.rowNumber} style={{ opacity: row.isValid ? 1 : 0.6 }}>
                        <td className="text-muted">{row.rowNumber}</td>
                        <td className="text-mono">{row.date}</td>
                        <td className="font-semibold">{row.merchant}</td>
                        <td>
                          <span className="badge badge-neutral">{row.category_name}</span>
                        </td>
                        <td className="text-mono font-semibold">
                          {symbol}{Number(row.amount).toFixed(2)}
                        </td>
                        <td>{row.payment_method}</td>
                        <td>
                          {row.isValid ? (
                            <span className="badge badge-success">Valid</span>
                          ) : (
                            <span className="badge badge-danger" title={row.errors.join(', ')}>Error</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isProcessing || isCommitting}>
            Cancel
          </button>
          {!previewResult ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handlePreview}
              disabled={isProcessing || (!file && !csvText.trim())}
            >
              {isProcessing ? 'Validating CSV...' : 'Preview Import'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCommit}
              disabled={isCommitting || previewResult.validRowsCount === 0}
            >
              {isCommitting ? 'Importing...' : `Import ${previewResult.validRowsCount} Transactions`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

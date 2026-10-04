import React, { useState, useEffect } from 'react';
import {
  Wallet,
  AlertTriangle,
  CheckCircle,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  TrendingDown,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';

export default function Budgets({ categories, onCategoriesUpdated }) {
  const { formatAmount, symbol } = useCurrency();
  const [budgetInfo, setBudgetInfo] = useState(null);
  const [recurringList, setRecurringList] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [budgetTargetCategory, setBudgetTargetCategory] = useState(null); // null = overall
  const [budgetAmountInput, setBudgetAmountInput] = useState('');
  const [budgetRolloverInput, setBudgetRolloverInput] = useState(false);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryNameInput, setCategoryNameInput] = useState('');
  const [categoryColorInput, setCategoryColorInput] = useState('#4f46e5');

  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [recTitle, setRecTitle] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recCategory, setRecCategory] = useState('');
  const [recFreq, setRecFreq] = useState('monthly');
  const [recNextDate, setRecNextDate] = useState(new Date().toISOString().substring(0, 10));
  const [recMethod, setRecMethod] = useState('Credit Card');

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [bRes, rRes] = await Promise.all([
        api.get(`/budgets?month=${selectedMonth}`),
        api.get('/recurring')
      ]);
      setBudgetInfo(bRes);
      setRecurringList(rRes.recurring || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const handleOpenBudgetModal = (cat = null, currentAmount = 0, rollover = false) => {
    setBudgetTargetCategory(cat);
    setBudgetAmountInput(currentAmount > 0 ? String(currentAmount) : '');
    setBudgetRolloverInput(rollover);
    setIsBudgetModalOpen(true);
  };

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    if (!budgetAmountInput || parseFloat(budgetAmountInput) <= 0) return;

    try {
      await api.post('/budgets', {
        category_id: budgetTargetCategory ? budgetTargetCategory.id : null,
        amount: parseFloat(budgetAmountInput),
        month: selectedMonth,
        rollover_enabled: budgetRolloverInput ? 1 : 0
      });
      setIsBudgetModalOpen(false);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to save budget');
    }
  };

  const handleOpenCategoryModal = (cat = null) => {
    if (cat) {
      setEditingCategory(cat);
      setCategoryNameInput(cat.name);
      setCategoryColorInput(cat.color || '#4f46e5');
    } else {
      setEditingCategory(null);
      setCategoryNameInput('');
      setCategoryColorInput('#4f46e5');
    }
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!categoryNameInput.trim()) return;

    try {
      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, {
          name: categoryNameInput.trim(),
          color: categoryColorInput
        });
      } else {
        await api.post('/categories', {
          name: categoryNameInput.trim(),
          color: categoryColorInput,
          icon: 'Tag'
        });
      }
      setIsCategoryModalOpen(false);
      onCategoriesUpdated();
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to save category');
    }
  };

  const handleDeleteCategory = async (id, name) => {
    if (window.confirm(`Delete category "${name}"? Any assigned expenses will be moved to Miscellaneous.`)) {
      try {
        await api.delete(`/categories/${id}`);
        onCategoriesUpdated();
        loadData();
      } catch (err) {
        alert(err.message || 'Failed to delete category');
      }
    }
  };

  const handleSaveRecurring = async (e) => {
    e.preventDefault();
    if (!recTitle.trim() || !recAmount || !recCategory) return;

    try {
      await api.post('/recurring', {
        title: recTitle.trim(),
        amount: parseFloat(recAmount),
        category_id: parseInt(recCategory, 10),
        frequency: recFreq,
        next_due_date: recNextDate,
        payment_method: recMethod
      });
      setIsRecurringModalOpen(false);
      setRecTitle('');
      setRecAmount('');
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to save recurring bill');
    }
  };

  const handleDeleteRecurring = async (id, title) => {
    if (window.confirm(`Remove recurring schedule for "${title}"?`)) {
      try {
        await api.delete(`/recurring/${id}`);
        loadData();
      } catch (err) {
        alert(err.message || 'Failed to delete recurring bill');
      }
    }
  };

  const overall = budgetInfo?.overall || { amount: 0, spent: 0, remaining: 0, percentage: 0, status: 'normal' };
  const categoryBudgets = budgetInfo?.categories || [];

  return (
    <div>
      {/* Header and Month Picker */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 600 }}>Budget Management & Limits</h2>
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>
            Set departmental or personal limits and monitor automated alert thresholds.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="month"
            className="form-control"
            style={{ width: 'auto' }}
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
          <button onClick={() => handleOpenCategoryModal()} className="btn btn-secondary btn-sm">
            <Plus size={14} /> Add Category
          </button>
          <button onClick={() => setIsRecurringModalOpen(true)} className="btn btn-secondary btn-sm">
            <Calendar size={14} /> Add Recurring Bill
          </button>
        </div>
      </div>

      {/* Overall Monthly Budget Banner Card */}
      <div
        className="card"
        style={{
          marginBottom: '28px',
          borderLeft: `4px solid ${overall.status === 'exceeded' ? '#ef4444' : overall.status === 'approaching' ? '#f59e0b' : '#4f46e5'}`
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Wallet size={20} color="var(--primary-600)" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Overall Monthly Budget</h3>
              {overall.status === 'exceeded' ? (
                <span className="badge badge-danger">Budget Exceeded</span>
              ) : overall.status === 'approaching' ? (
                <span className="badge badge-warning">Approaching Limit</span>
              ) : (
                <span className="badge badge-success">On Track</span>
              )}
            </div>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>
              Month: {selectedMonth} {overall.budget?.rollover_enabled ? `(Rollover enabled: +${formatAmount(overall.budget.rollover_amount)})` : ''}
            </p>
          </div>

          <button
            onClick={() => handleOpenBudgetModal(null, overall.budget?.amount || 0, !!overall.budget?.rollover_enabled)}
            className="btn btn-secondary btn-sm"
          >
            <Edit2 size={14} /> Adjust Overall Budget
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', margin: '20px 0 16px' }}>
          <div>
            <div className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Total Budget Target</div>
            <div className="text-mono font-bold" style={{ fontSize: '1.4rem' }}>{formatAmount(overall.amount)}</div>
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Total Spent to Date</div>
            <div className="text-mono font-bold" style={{ fontSize: '1.4rem', color: overall.status === 'exceeded' ? '#ef4444' : 'var(--text-primary)' }}>
              {formatAmount(overall.spent)}
            </div>
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Remaining Balance</div>
            <div className="text-mono font-bold" style={{ fontSize: '1.4rem', color: overall.remaining >= 0 ? '#10b981' : '#ef4444' }}>
              {formatAmount(overall.remaining)}
            </div>
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Utilization Rate</div>
            <div className="text-mono font-bold" style={{ fontSize: '1.4rem' }}>{overall.percentage}%</div>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="progress-bar-container" style={{ height: '10px' }}>
          <div
            className="progress-bar-fill"
            style={{
              width: `${Math.min(overall.percentage, 100)}%`,
              backgroundColor: overall.status === 'exceeded' ? '#ef4444' : overall.status === 'approaching' ? '#f59e0b' : '#4f46e5'
            }}
          />
        </div>
      </div>

      {/* Category Budgets Grid */}
      <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '16px' }}>Category Budgets</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px', marginBottom: '36px' }}>
        {categoryBudgets.map((b) => (
          <div key={b.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: b.category_color || '#4f46e5'
                    }}
                  />
                  <h4 style={{ fontWeight: 600, fontSize: '0.95rem' }}>{b.category_name}</h4>
                </div>

                {b.status === 'exceeded' ? (
                  <span className="badge badge-danger">Exceeded</span>
                ) : b.status === 'approaching' ? (
                  <span className="badge badge-warning">Approaching</span>
                ) : (
                  <span className="badge badge-success">{b.percentage}%</span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                <div>
                  <span className="text-mono font-bold" style={{ fontSize: '1.15rem' }}>{formatAmount(b.spent)}</span>
                  <span className="text-muted" style={{ fontSize: '0.8rem' }}> of {formatAmount(b.amount)}</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: b.remaining >= 0 ? 'var(--text-muted)' : '#ef4444' }}>
                  {b.remaining >= 0 ? `${formatAmount(b.remaining)} left` : `+${formatAmount(Math.abs(b.remaining))} over`}
                </span>
              </div>

              <div className="progress-bar-container" style={{ marginBottom: '14px' }}>
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${Math.min(b.percentage, 100)}%`,
                    backgroundColor: b.status === 'exceeded' ? '#ef4444' : b.status === 'approaching' ? '#f59e0b' : b.category_color || '#4f46e5'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
              <button
                onClick={() => handleOpenBudgetModal({ id: b.category_id, name: b.category_name }, b.amount, !!b.rollover_enabled)}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
              >
                <Edit2 size={12} /> Edit Limit
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Categories Catalog Section */}
      <div className="card" style={{ marginBottom: '32px' }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Category Catalog</h3>
            <p className="text-muted" style={{ fontSize: '0.8rem' }}>Default & custom expense classifications</p>
          </div>
          <button onClick={() => handleOpenCategoryModal()} className="btn btn-primary btn-sm">
            <Plus size={14} /> New Category
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          {categories.map((c) => (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: c.color }} />
                <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{c.name}</span>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => handleOpenCategoryModal(c)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  title="Edit category"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  onClick={() => handleDeleteCategory(c.id, c.name)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  title="Delete category"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scheduled Recurring Bills Section */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Recurring Commitments & Subscriptions</h3>
            <p className="text-muted" style={{ fontSize: '0.8rem' }}>Automated schedules and upcoming billing dates</p>
          </div>
          <button onClick={() => setIsRecurringModalOpen(true)} className="btn btn-primary btn-sm">
            <Plus size={14} /> New Recurring Bill
          </button>
        </div>

        {recurringList.length === 0 ? (
          <div className="empty-state">
            <Calendar className="empty-state-icon" />
            <p>No recurring subscriptions configured.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Subscription / Commitment</th>
                  <th>Category</th>
                  <th>Frequency</th>
                  <th>Payment Method</th>
                  <th>Next Due Date</th>
                  <th>Amount</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recurringList.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold">{r.title}</td>
                    <td>
                      <span className="badge badge-neutral">{r.category_name}</span>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{r.frequency}</td>
                    <td style={{ fontSize: '0.8125rem' }}>{r.payment_method}</td>
                    <td className="text-mono" style={{ fontSize: '0.8125rem' }}>{r.next_due_date}</td>
                    <td className="text-mono font-bold">{formatAmount(r.amount)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handleDeleteRecurring(r.id, r.title)}
                        className="btn btn-danger btn-sm"
                        style={{ padding: '4px 8px' }}
                        title="Delete recurring schedule"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Set/Edit Budget Modal */}
      {isBudgetModalOpen && (
        <div className="modal-overlay" onClick={() => setIsBudgetModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="card-title">
                {budgetTargetCategory ? `Set Budget: ${budgetTargetCategory.name}` : 'Set Overall Monthly Budget'}
              </h3>
              <button onClick={() => setIsBudgetModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveBudget}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Monthly Target Amount ({symbol}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="0.00"
                    className="form-control text-mono"
                    value={budgetAmountInput}
                    onChange={(e) => setBudgetAmountInput(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '10px' }}>
                    <input
                      type="checkbox"
                      checked={budgetRolloverInput}
                      onChange={(e) => setBudgetRolloverInput(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary-600)' }}
                    />
                    <span style={{ fontSize: '0.85rem' }}>Enable budget rollover (carry forward unspent/overspent balances)</span>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsBudgetModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Budget Limit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCategoryModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="card-title">{editingCategory ? 'Edit Category' : 'Create Category'}</h3>
              <button onClick={() => setIsCategoryModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveCategory}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Category Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cloud Services, Gym & Health"
                    className="form-control"
                    value={categoryNameInput}
                    onChange={(e) => setCategoryNameInput(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Theme Color</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="color"
                      value={categoryColorInput}
                      onChange={(e) => setCategoryColorInput(e.target.value)}
                      style={{ width: '40px', height: '36px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    />
                    <span className="text-mono" style={{ fontSize: '0.85rem' }}>{categoryColorInput}</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCategoryModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingCategory ? 'Update' : 'Create'} Category</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recurring Bill Modal */}
      {isRecurringModalOpen && (
        <div className="modal-overlay" onClick={() => setIsRecurringModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="card-title">Schedule Recurring Commitment</h3>
              <button onClick={() => setIsRecurringModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveRecurring}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Title / Service Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AWS Infrastructure, Office Rent, Fiber Internet"
                    className="form-control"
                    value={recTitle}
                    onChange={(e) => setRecTitle(e.target.value)}
                    autoFocus
                  />
                </div>

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
                      value={recAmount}
                      onChange={(e) => setRecAmount(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <select
                      required
                      className="form-control"
                      value={recCategory}
                      onChange={(e) => setRecCategory(e.target.value)}
                    >
                      <option value="" disabled>Select category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Frequency</label>
                    <select
                      className="form-control"
                      value={recFreq}
                      onChange={(e) => setRecFreq(e.target.value)}
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Next Due Date *</label>
                    <input
                      type="date"
                      required
                      className="form-control"
                      value={recNextDate}
                      onChange={(e) => setRecNextDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <select
                    className="form-control"
                    value={recMethod}
                    onChange={(e) => setRecMethod(e.target.value)}
                  >
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Electronic / UPI">Electronic / UPI</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsRecurringModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Schedule Commitment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

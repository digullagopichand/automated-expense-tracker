const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middleware/auth');

router.use(authenticate);

// List active recurring expenses
router.get('/', (req, res, next) => {
  try {
    const recurring = db.query(
      `SELECT r.*, c.name as category_name, c.color as category_color, c.icon as category_icon
       FROM recurring_expenses r
       JOIN categories c ON c.id = r.category_id
       WHERE r.user_id = ? AND r.is_active = 1
       ORDER BY r.next_due_date ASC`,
      [req.user.id]
    );

    const totalMonthlyCommitment = recurring.reduce((sum, item) => {
      let monthlyVal = item.amount;
      if (item.frequency === 'weekly') monthlyVal = item.amount * 4.33;
      else if (item.frequency === 'yearly') monthlyVal = item.amount / 12;
      return sum + monthlyVal;
    }, 0);

    res.json({
      recurring,
      totalMonthlyCommitment: Math.round(totalMonthlyCommitment * 100) / 100
    });
  } catch (err) {
    next(err);
  }
});

// Create recurring expense
router.post('/', (req, res, next) => {
  try {
    const { title, amount, category_id, frequency = 'monthly', next_due_date, payment_method = 'Credit Card' } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: { message: 'Title is required.' } });
    }

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: { message: 'A valid positive amount is required.' } });
    }

    if (!category_id) {
      return res.status(400).json({ error: { message: 'Category is required.' } });
    }

    if (!next_due_date) {
      return res.status(400).json({ error: { message: 'Next due date is required.' } });
    }

    const r = db.run(
      `INSERT INTO recurring_expenses (user_id, title, amount, category_id, frequency, next_due_date, payment_method, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [req.user.id, title.trim(), parseFloat(amount), category_id, frequency, next_due_date, payment_method]
    );

    const item = db.queryOne(
      `SELECT r.*, c.name as category_name, c.color as category_color, c.icon as category_icon
       FROM recurring_expenses r
       JOIN categories c ON c.id = r.category_id
       WHERE r.id = ?`,
      [r.lastInsertRowid]
    );

    res.status(201).json({ message: 'Recurring expense created.', item });
  } catch (err) {
    next(err);
  }
});

// Update recurring expense
router.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, amount, category_id, frequency, next_due_date, payment_method, is_active } = req.body;

    const existing = db.queryOne('SELECT * FROM recurring_expenses WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      return res.status(404).json({ error: { message: 'Recurring expense not found.' } });
    }

    db.run(
      `UPDATE recurring_expenses
       SET title = COALESCE(?, title),
           amount = COALESCE(?, amount),
           category_id = COALESCE(?, category_id),
           frequency = COALESCE(?, frequency),
           next_due_date = COALESCE(?, next_due_date),
           payment_method = COALESCE(?, payment_method),
           is_active = COALESCE(?, is_active)
       WHERE id = ? AND user_id = ?`,
      [
        title ? title.trim() : null,
        amount !== undefined ? parseFloat(amount) : null,
        category_id || null,
        frequency || null,
        next_due_date || null,
        payment_method || null,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        id,
        req.user.id
      ]
    );

    const updated = db.queryOne(
      `SELECT r.*, c.name as category_name, c.color as category_color, c.icon as category_icon
       FROM recurring_expenses r
       JOIN categories c ON c.id = r.category_id
       WHERE r.id = ?`,
      [id]
    );

    res.json({ message: 'Recurring expense updated.', item: updated });
  } catch (err) {
    next(err);
  }
});

// Delete recurring expense
router.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = db.queryOne('SELECT * FROM recurring_expenses WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      return res.status(404).json({ error: { message: 'Recurring expense not found.' } });
    }

    db.run('DELETE FROM recurring_expenses WHERE id = ? AND user_id = ?', [id, req.user.id]);
    res.json({ message: 'Recurring expense deleted.' });
  } catch (err) {
    next(err);
  }
});

// Quick Action: Log as expense now and advance next due date
router.post('/:id/log-as-expense', (req, res, next) => {
  try {
    const { id } = req.params;
    const item = db.queryOne('SELECT * FROM recurring_expenses WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!item) {
      return res.status(404).json({ error: { message: 'Recurring expense not found.' } });
    }

    const todayStr = new Date().toISOString().substring(0, 10);

    // Insert expense
    db.run(
      `INSERT INTO expenses (user_id, amount, date, merchant, category_id, payment_method, notes, is_recurring, recurring_frequency)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [req.user.id, item.amount, todayStr, item.title, item.category_id, item.payment_method, `Auto-logged recurring payment`, item.frequency]
    );

    // Advance next due date
    const d = new Date(item.next_due_date || todayStr);
    if (item.frequency === 'weekly') {
      d.setDate(d.getDate() + 7);
    } else if (item.frequency === 'yearly') {
      d.setFullYear(d.getFullYear() + 1);
    } else {
      // Monthly default
      d.setMonth(d.getMonth() + 1);
    }
    const nextDateStr = d.toISOString().substring(0, 10);

    db.run('UPDATE recurring_expenses SET next_due_date = ? WHERE id = ?', [nextDateStr, id]);

    res.json({
      message: `Recorded expense of $${item.amount.toFixed(2)} for ${item.title}. Next due date moved to ${nextDateStr}.`,
      next_due_date: nextDateStr
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

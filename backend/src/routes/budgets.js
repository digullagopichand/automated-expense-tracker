const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middleware/auth');

router.use(authenticate);

// Get budgets for a given month with spent calculation and progress
router.get('/', (req, res, next) => {
  try {
    const month = req.query.month || new Date().toISOString().substring(0, 7);

    // Fetch overall budget for this month
    const overallBudget = db.queryOne(
      'SELECT * FROM budgets WHERE user_id = ? AND category_id IS NULL AND month = ?',
      [req.user.id, month]
    );

    // Fetch total spent for this month across all categories
    const totalSpentRow = db.queryOne(
      `SELECT COALESCE(SUM(amount), 0) AS total_spent
       FROM expenses
       WHERE user_id = ? AND strftime('%Y-%m', date) = ?`,
      [req.user.id, month]
    );
    const totalSpent = totalSpentRow.total_spent;

    // Fetch category budgets for this month with spent amount per category
    const categoryBudgets = db.query(
      `SELECT b.*,
              c.name AS category_name,
              c.color AS category_color,
              c.icon AS category_icon,
              COALESCE(
                (SELECT SUM(e.amount)
                 FROM expenses e
                 WHERE e.category_id = b.category_id
                   AND e.user_id = b.user_id
                   AND strftime('%Y-%m', e.date) = b.month),
                0
              ) AS spent
       FROM budgets b
       JOIN categories c ON c.id = b.category_id
       WHERE b.user_id = ? AND b.month = ?
       ORDER BY b.amount DESC`,
      [req.user.id, month]
    );

    // Add progress percentage and status for each category budget
    const enrichedCategoryBudgets = categoryBudgets.map(b => {
      const effectiveBudget = b.amount + (b.rollover_enabled ? b.rollover_amount : 0);
      const spent = b.spent;
      const remaining = effectiveBudget - spent;
      const percentage = effectiveBudget > 0 ? Math.round((spent / effectiveBudget) * 100) : 0;
      let status = 'normal';
      if (percentage >= 100) {
        status = 'exceeded';
      } else if (percentage >= 80) {
        status = 'approaching';
      }

      return {
        ...b,
        effective_budget: effectiveBudget,
        remaining,
        percentage,
        status
      };
    });

    const overallAmount = overallBudget ? overallBudget.amount + (overallBudget.rollover_enabled ? overallBudget.rollover_amount : 0) : 0;
    const overallRemaining = overallAmount - totalSpent;
    const overallPercentage = overallAmount > 0 ? Math.round((totalSpent / overallAmount) * 100) : 0;
    let overallStatus = 'normal';
    if (overallPercentage >= 100) {
      overallStatus = 'exceeded';
    } else if (overallPercentage >= 80) {
      overallStatus = 'approaching';
    }

    res.json({
      month,
      overall: {
        budget: overallBudget,
        amount: overallAmount,
        spent: totalSpent,
        remaining: overallRemaining,
        percentage: overallPercentage,
        status: overallStatus
      },
      categories: enrichedCategoryBudgets
    });
  } catch (err) {
    next(err);
  }
});

// Set or update a budget (overall or category)
router.post('/', (req, res, next) => {
  try {
    const { category_id = null, amount, month, rollover_enabled = 0 } = req.body;

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: { message: 'A valid positive budget amount is required.' } });
    }

    const targetMonth = month || new Date().toISOString().substring(0, 7);

    // Check if category exists if provided
    if (category_id) {
      const cat = db.queryOne('SELECT id FROM categories WHERE id = ? AND user_id = ?', [category_id, req.user.id]);
      if (!cat) {
        return res.status(404).json({ error: { message: 'Category not found.' } });
      }
    }

    // Check if budget exists for this month/category
    let existing;
    if (category_id) {
      existing = db.queryOne(
        'SELECT * FROM budgets WHERE user_id = ? AND category_id = ? AND month = ?',
        [req.user.id, category_id, targetMonth]
      );
    } else {
      existing = db.queryOne(
        'SELECT * FROM budgets WHERE user_id = ? AND category_id IS NULL AND month = ?',
        [req.user.id, targetMonth]
      );
    }

    let budgetId;
    if (existing) {
      db.run(
        `UPDATE budgets
         SET amount = ?,
             rollover_enabled = ?,
             updated_at = datetime('now')
         WHERE id = ?`,
        [parseFloat(amount), rollover_enabled ? 1 : 0, existing.id]
      );
      budgetId = existing.id;
    } else {
      const r = db.run(
        `INSERT INTO budgets (user_id, category_id, amount, month, rollover_enabled, rollover_amount)
         VALUES (?, ?, ?, ?, ?, 0.00)`,
        [req.user.id, category_id || null, parseFloat(amount), targetMonth, rollover_enabled ? 1 : 0]
      );
      budgetId = r.lastInsertRowid;
    }

    const budget = db.queryOne('SELECT * FROM budgets WHERE id = ?', [budgetId]);
    res.status(201).json({ message: 'Budget saved successfully.', budget });
  } catch (err) {
    next(err);
  }
});

// Delete budget
router.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = db.queryOne('SELECT * FROM budgets WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      return res.status(404).json({ error: { message: 'Budget not found.' } });
    }

    db.run('DELETE FROM budgets WHERE id = ? AND user_id = ?', [id, req.user.id]);
    res.json({ message: 'Budget deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

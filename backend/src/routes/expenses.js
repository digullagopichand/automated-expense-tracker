const express = require('express');
const router = express.Router();
const fs = require('fs');
const db = require('../db/database');
const authenticate = require('../middleware/auth');
const upload = require('../middleware/upload');
const { parseCSV, validateAndMapRows, stringifyCSV } = require('../services/csvService');
const logger = require('../utils/logger');

router.use(authenticate);

// Get expenses with filtering, search, pagination, and sorting
router.get('/', (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 25,
      search,
      start_date,
      end_date,
      category_id,
      payment_method,
      is_business,
      min_amount,
      max_amount,
      sort_by = 'date',
      sort_order = 'desc'
    } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const params = [req.user.id];
    let whereClauses = ['e.user_id = ?'];

    if (search && search.trim()) {
      whereClauses.push('(e.merchant LIKE ? OR e.notes LIKE ?)');
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (start_date) {
      whereClauses.push('e.date >= ?');
      params.push(start_date);
    }

    if (end_date) {
      whereClauses.push('e.date <= ?');
      params.push(end_date);
    }

    if (category_id) {
      whereClauses.push('e.category_id = ?');
      params.push(parseInt(category_id, 10));
    }

    if (payment_method) {
      whereClauses.push('e.payment_method = ?');
      params.push(payment_method);
    }

    if (is_business !== undefined && is_business !== '') {
      whereClauses.push('e.is_business = ?');
      params.push(parseInt(is_business, 10));
    }

    if (min_amount) {
      whereClauses.push('e.amount >= ?');
      params.push(parseFloat(min_amount));
    }

    if (max_amount) {
      whereClauses.push('e.amount <= ?');
      params.push(parseFloat(max_amount));
    }

    const allowedSortFields = ['date', 'amount', 'merchant', 'created_at'];
    const safeSortBy = allowedSortFields.includes(sort_by) ? `e.${sort_by}` : 'e.date';
    const safeSortOrder = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const whereSql = whereClauses.join(' AND ');

    // Total count and total amount for the filtered set
    const countQuery = `
      SELECT COUNT(*) AS total_count, COALESCE(SUM(e.amount), 0) AS total_amount
      FROM expenses e
      WHERE ${whereSql}
    `;
    const countRes = db.queryOne(countQuery, params);
    const total = countRes ? countRes.total_count : 0;
    const totalAmount = countRes ? countRes.total_amount : 0;

    // Expenses page
    const listQuery = `
      SELECT e.*,
             c.name AS category_name,
             c.color AS category_color,
             c.icon AS category_icon
      FROM expenses e
      LEFT JOIN categories c ON c.id = e.category_id
      WHERE ${whereSql}
      ORDER BY ${safeSortBy} ${safeSortOrder}, e.id DESC
      LIMIT ? OFFSET ?
    `;

    const listParams = [...params, parseInt(limit, 10), parseInt(offset, 10)];
    const expenses = db.query(listQuery, listParams);

    res.json({
      expenses,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / parseInt(limit, 10)) || 1,
        totalAmount
      }
    });
  } catch (err) {
    next(err);
  }
});

// Single expense detail
router.get('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const expense = db.queryOne(
      `SELECT e.*, c.name as category_name, c.color as category_color, c.icon as category_icon
       FROM expenses e
       LEFT JOIN categories c ON c.id = e.category_id
       WHERE e.id = ? AND e.user_id = ?`,
      [id, req.user.id]
    );

    if (!expense) {
      return res.status(404).json({ error: { message: 'Expense not found.' } });
    }

    res.json({ expense });
  } catch (err) {
    next(err);
  }
});

// Create new expense
router.post('/', (req, res, next) => {
  try {
    const {
      amount,
      date,
      merchant,
      category_id,
      payment_method = 'Credit Card',
      notes = '',
      receipt_url = null,
      is_recurring = 0,
      recurring_frequency = 'none',
      is_business = 0
    } = req.body;

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: { message: 'A valid positive amount is required.' } });
    }

    if (!date) {
      return res.status(400).json({ error: { message: 'Date is required.' } });
    }

    if (!merchant || !merchant.trim()) {
      return res.status(400).json({ error: { message: 'Merchant name is required.' } });
    }

    if (!category_id) {
      return res.status(400).json({ error: { message: 'Category is required.' } });
    }

    // Verify category exists
    const category = db.queryOne('SELECT * FROM categories WHERE id = ? AND user_id = ?', [category_id, req.user.id]);
    if (!category) {
      return res.status(400).json({ error: { message: 'Selected category does not exist.' } });
    }

    const result = db.run(
      `INSERT INTO expenses (
        user_id, amount, date, merchant, category_id, payment_method,
        notes, receipt_url, is_recurring, recurring_frequency, is_business
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        parseFloat(amount),
        date,
        merchant.trim(),
        category_id,
        payment_method,
        notes.trim(),
        receipt_url,
        is_recurring ? 1 : 0,
        recurring_frequency || 'none',
        is_business ? 1 : 0
      ]
    );

    const expenseId = result.lastInsertRowid;
    const newExpense = db.queryOne(
      `SELECT e.*, c.name as category_name, c.color as category_color, c.icon as category_icon
       FROM expenses e
       LEFT JOIN categories c ON c.id = e.category_id
       WHERE e.id = ?`,
      [expenseId]
    );

    // Automated trigger: check if this expense causes category or overall budget to exceed 80% or 100%
    const expenseMonth = date.substring(0, 7);
    checkBudgetAlerts(req.user.id, category_id, expenseMonth, category.name);

    res.status(201).json({
      message: 'Expense recorded successfully.',
      expense: newExpense
    });
  } catch (err) {
    next(err);
  }
});

// Update expense
router.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      amount,
      date,
      merchant,
      category_id,
      payment_method,
      notes,
      receipt_url,
      is_recurring,
      recurring_frequency,
      is_business
    } = req.body;

    const existing = db.queryOne('SELECT * FROM expenses WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      return res.status(404).json({ error: { message: 'Expense not found.' } });
    }

    if (category_id) {
      const category = db.queryOne('SELECT id FROM categories WHERE id = ? AND user_id = ?', [category_id, req.user.id]);
      if (!category) {
        return res.status(400).json({ error: { message: 'Selected category does not exist.' } });
      }
    }

    db.run(
      `UPDATE expenses
       SET amount = COALESCE(?, amount),
           date = COALESCE(?, date),
           merchant = COALESCE(?, merchant),
           category_id = COALESCE(?, category_id),
           payment_method = COALESCE(?, payment_method),
           notes = COALESCE(?, notes),
           receipt_url = COALESCE(?, receipt_url),
           is_recurring = COALESCE(?, is_recurring),
           recurring_frequency = COALESCE(?, recurring_frequency),
           is_business = COALESCE(?, is_business),
           updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
      [
        amount !== undefined ? parseFloat(amount) : null,
        date || null,
        merchant ? merchant.trim() : null,
        category_id || null,
        payment_method || null,
        notes !== undefined ? notes.trim() : null,
        receipt_url !== undefined ? receipt_url : null,
        is_recurring !== undefined ? (is_recurring ? 1 : 0) : null,
        recurring_frequency || null,
        is_business !== undefined ? (is_business ? 1 : 0) : null,
        id,
        req.user.id
      ]
    );

    const updated = db.queryOne(
      `SELECT e.*, c.name as category_name, c.color as category_color, c.icon as category_icon
       FROM expenses e
       LEFT JOIN categories c ON c.id = e.category_id
       WHERE e.id = ?`,
      [id]
    );

    res.json({
      message: 'Expense updated successfully.',
      expense: updated
    });
  } catch (err) {
    next(err);
  }
});

// Delete expense
router.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = db.queryOne('SELECT * FROM expenses WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      return res.status(404).json({ error: { message: 'Expense not found.' } });
    }

    db.run('DELETE FROM expenses WHERE id = ? AND user_id = ?', [id, req.user.id]);
    res.json({ message: 'Expense deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

// Upload receipt attachment
router.post('/upload-receipt', upload.single('receipt'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: { message: 'No receipt file provided.' } });
  }

  const receiptUrl = `/uploads/${req.file.filename}`;
  res.json({
    message: 'Receipt uploaded successfully.',
    receipt_url: receiptUrl,
    filename: req.file.originalname,
    size: req.file.size
  });
});

// CSV Import Preview: parse & validate without saving
router.post('/import/preview', upload.single('file'), (req, res, next) => {
  try {
    let csvContent = '';
    if (req.file) {
      csvContent = fs.readFileSync(req.file.path, 'utf8');
      // Clean up uploaded temp file
      fs.unlinkSync(req.file.path);
    } else if (req.body.csvText) {
      csvContent = req.body.csvText;
    } else {
      return res.status(400).json({ error: { message: 'Please upload a CSV file or provide CSV text.' } });
    }

    const categories = db.query('SELECT id, name FROM categories WHERE user_id = ?', [req.user.id]);
    const parsedRows = parseCSV(csvContent);
    const result = validateAndMapRows(parsedRows, categories);

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// CSV Import Commit: batch insert validated rows
router.post('/import/commit', (req, res, next) => {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: { message: 'No valid rows provided to import.' } });
    }

    let insertedCount = 0;
    db.transaction((database) => {
      for (const row of rows) {
        if (!row.amount || !row.date || !row.merchant || !row.category_id) continue;
        database.run(
          `INSERT INTO expenses (user_id, amount, date, merchant, category_id, payment_method, notes, is_business)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.id,
            parseFloat(row.amount),
            row.date,
            row.merchant.trim(),
            row.category_id,
            row.payment_method || 'Credit Card',
            row.notes || 'Imported via CSV',
            row.is_business ? 1 : 0
          ]
        );
        insertedCount++;
      }
    });

    res.json({
      message: `Successfully imported ${insertedCount} expenses.`,
      importedCount: insertedCount
    });
  } catch (err) {
    next(err);
  }
});

// Export expenses as CSV
router.get('/export/csv', (req, res, next) => {
  try {
    const { start_date, end_date, category_id } = req.query;
    const params = [req.user.id];
    let whereClauses = ['e.user_id = ?'];

    if (start_date) {
      whereClauses.push('e.date >= ?');
      params.push(start_date);
    }
    if (end_date) {
      whereClauses.push('e.date <= ?');
      params.push(end_date);
    }
    if (category_id) {
      whereClauses.push('e.category_id = ?');
      params.push(parseInt(category_id, 10));
    }

    const expenses = db.query(
      `SELECT e.date, e.merchant, e.amount, c.name AS category, e.payment_method, e.notes,
              CASE WHEN e.is_business = 1 THEN 'Business' ELSE 'Personal' END AS type
       FROM expenses e
       LEFT JOIN categories c ON c.id = e.category_id
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY e.date DESC`,
      params
    );

    const columns = [
      { header: 'Date', key: 'date' },
      { header: 'Merchant', key: 'merchant' },
      { header: 'Amount', key: 'amount', format: (val) => Number(val).toFixed(2) },
      { header: 'Category', key: 'category' },
      { header: 'Payment Method', key: 'payment_method' },
      { header: 'Type', key: 'type' },
      { header: 'Notes', key: 'notes' }
    ];

    const csvData = stringifyCSV(expenses, columns);
    const filename = `expenses-export-${new Date().toISOString().substring(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvData);
  } catch (err) {
    next(err);
  }
});

// Helper to check budget threshold and create in-app notification if breached
function checkBudgetAlerts(userId, categoryId, month, categoryName) {
  try {
    const budget = db.queryOne(
      'SELECT amount FROM budgets WHERE user_id = ? AND category_id = ? AND month = ?',
      [userId, categoryId, month]
    );

    if (!budget || budget.amount <= 0) return;

    const spentRow = db.queryOne(
      `SELECT SUM(amount) as spent FROM expenses
       WHERE user_id = ? AND category_id = ? AND strftime('%Y-%m', date) = ?`,
      [userId, categoryId, month]
    );

    const spent = spentRow ? spentRow.spent : 0;
    const percentage = Math.round((spent / budget.amount) * 100);

    if (percentage >= 100) {
      const exists = db.queryOne(
        `SELECT id FROM notifications
         WHERE user_id = ? AND title LIKE ? AND created_at >= date('now', '-1 day')`,
        [userId, `%Budget Exceeded: ${categoryName}%`]
      );
      if (!exists) {
        db.run(
          `INSERT INTO notifications (user_id, title, message, type)
           VALUES (?, ?, ?, 'budget_alert')`,
          [
            userId,
            `Budget Exceeded: ${categoryName}`,
            `You have spent $${spent.toFixed(2)} on ${categoryName}, which is ${percentage}% of your $${budget.amount.toFixed(2)} budget.`
          ]
        );
      }
    } else if (percentage >= 80) {
      const exists = db.queryOne(
        `SELECT id FROM notifications
         WHERE user_id = ? AND title LIKE ? AND created_at >= date('now', '-2 days')`,
        [userId, `%Budget Warning: ${categoryName}%`]
      );
      if (!exists) {
        db.run(
          `INSERT INTO notifications (user_id, title, message, type)
           VALUES (?, ?, ?, 'budget_alert')`,
          [
            userId,
            `Budget Warning: ${categoryName}`,
            `You have used ${percentage}% of your monthly ${categoryName} budget ($${spent.toFixed(2)} of $${budget.amount.toFixed(2)}).`
          ]
        );
      }
    }
  } catch (err) {
    logger.error('Budget alert check error', { error: err });
  }
}

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middleware/auth');

router.use(authenticate);

// List all categories for the authenticated user
router.get('/', (req, res, next) => {
  try {
    const currentMonth = new Date().toISOString().substring(0, 7);
    const categories = db.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM expenses e WHERE e.category_id = c.id AND e.user_id = c.user_id) AS expense_count,
              (SELECT COALESCE(SUM(e.amount), 0) FROM expenses e WHERE e.category_id = c.id AND e.user_id = c.user_id AND strftime('%Y-%m', e.date) = ?) AS current_month_spent
       FROM categories c
       WHERE c.user_id = ?
       ORDER BY c.name ASC`,
      [currentMonth, req.user.id]
    );

    res.json({ categories });
  } catch (err) {
    next(err);
  }
});

// Create new category
router.post('/', (req, res, next) => {
  try {
    const { name, color = '#6366F1', icon = 'Tag' } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: { message: 'Category name is required.' } });
    }

    const existing = db.queryOne(
      'SELECT id FROM categories WHERE user_id = ? AND LOWER(name) = ?',
      [req.user.id, name.trim().toLowerCase()]
    );

    if (existing) {
      return res.status(409).json({ error: { message: 'A category with this name already exists.' } });
    }

    const result = db.run(
      'INSERT INTO categories (user_id, name, color, icon, is_default) VALUES (?, ?, ?, ?, 0)',
      [req.user.id, name.trim(), color, icon]
    );

    const category = db.queryOne('SELECT * FROM categories WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ message: 'Category created successfully.', category });
  } catch (err) {
    next(err);
  }
});

// Update category
router.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, color, icon } = req.body;

    const existing = db.queryOne('SELECT * FROM categories WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      return res.status(404).json({ error: { message: 'Category not found.' } });
    }

    if (name && name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = db.queryOne(
        'SELECT id FROM categories WHERE user_id = ? AND LOWER(name) = ? AND id != ?',
        [req.user.id, name.trim().toLowerCase(), id]
      );
      if (duplicate) {
        return res.status(409).json({ error: { message: 'Another category with this name already exists.' } });
      }
    }

    db.run(
      `UPDATE categories
       SET name = COALESCE(?, name),
           color = COALESCE(?, color),
           icon = COALESCE(?, icon)
       WHERE id = ? AND user_id = ?`,
      [name ? name.trim() : null, color, icon, id, req.user.id]
    );

    const updated = db.queryOne('SELECT * FROM categories WHERE id = ?', [id]);
    res.json({ message: 'Category updated successfully.', category: updated });
  } catch (err) {
    next(err);
  }
});

// Delete category
router.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = db.queryOne('SELECT * FROM categories WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      return res.status(404).json({ error: { message: 'Category not found.' } });
    }

    // Check if expenses exist for this category
    const expenseCount = db.queryOne(
      'SELECT COUNT(*) as count FROM expenses WHERE category_id = ? AND user_id = ?',
      [id, req.user.id]
    ).count;

    if (expenseCount > 0) {
      // Find or create 'Miscellaneous' category to reassign
      let misc = db.queryOne(
        "SELECT id FROM categories WHERE user_id = ? AND name = 'Miscellaneous'",
        [req.user.id]
      );
      if (!misc) {
        const r = db.run(
          "INSERT INTO categories (user_id, name, color, icon, is_default) VALUES (?, 'Miscellaneous', '#64748B', 'MoreHorizontal', 1)",
          [req.user.id]
        );
        misc = { id: r.lastInsertRowid };
      }

      // Reassign expenses to miscellaneous
      db.run('UPDATE expenses SET category_id = ? WHERE category_id = ? AND user_id = ?', [misc.id, id, req.user.id]);
    }

    // Delete budgets for this category
    db.run('DELETE FROM budgets WHERE category_id = ? AND user_id = ?', [id, req.user.id]);
    // Delete the category
    db.run('DELETE FROM categories WHERE id = ? AND user_id = ?', [id, req.user.id]);

    res.json({ message: 'Category deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

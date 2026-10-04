const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middleware/auth');
const { refreshUserInsights } = require('../services/insightEngine');

router.use(authenticate);

// Get insights for current user
router.get('/', (req, res, next) => {
  try {
    // Optionally trigger fresh analysis on access
    refreshUserInsights(req.user.id);

    const insights = db.query(
      `SELECT i.*, c.name as category_name, c.color as category_color, c.icon as category_icon
       FROM insights i
       LEFT JOIN categories c ON c.id = i.category_id
       WHERE i.user_id = ? AND i.is_dismissed = 0
       ORDER BY
         CASE i.severity
           WHEN 'danger' THEN 1
           WHEN 'warning' THEN 2
           WHEN 'info' THEN 3
           ELSE 4
         END ASC, i.id DESC`,
      [req.user.id]
    );

    // Calculate potential total savings from active insights
    const totalPotentialSavings = insights.reduce((sum, item) => sum + (item.potential_savings || 0), 0);

    const helpfulCountRow = db.queryOne(
      'SELECT COUNT(*) as count FROM insights WHERE user_id = ? AND is_helpful = 1',
      [req.user.id]
    );

    res.json({
      insights,
      metrics: {
        activeCount: insights.length,
        potentialMonthlySavings: totalPotentialSavings,
        helpfulCount: helpfulCountRow ? helpfulCountRow.count : 0
      }
    });
  } catch (err) {
    next(err);
  }
});

// Dismiss insight
router.post('/:id/dismiss', (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = db.queryOne('SELECT * FROM insights WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      return res.status(404).json({ error: { message: 'Insight not found.' } });
    }

    db.run('UPDATE insights SET is_dismissed = 1 WHERE id = ?', [id]);
    res.json({ message: 'Insight dismissed.' });
  } catch (err) {
    next(err);
  }
});

// Mark insight helpful
router.post('/:id/helpful', (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = db.queryOne('SELECT * FROM insights WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      return res.status(404).json({ error: { message: 'Insight not found.' } });
    }

    const newHelpful = existing.is_helpful ? 0 : 1;
    db.run('UPDATE insights SET is_helpful = ? WHERE id = ?', [newHelpful, id]);

    res.json({
      message: newHelpful ? 'Marked as helpful.' : 'Unmarked.',
      is_helpful: newHelpful
    });
  } catch (err) {
    next(err);
  }
});

// Force refresh insights
router.post('/refresh', (req, res, next) => {
  try {
    refreshUserInsights(req.user.id);
    res.json({ message: 'Insights refreshed based on latest expense data.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

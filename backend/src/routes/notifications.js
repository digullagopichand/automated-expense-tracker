const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middleware/auth');

router.use(authenticate);

// Get user notifications and unread badge count
router.get('/', (req, res, next) => {
  try {
    const notifications = db.query(
      `SELECT * FROM notifications
       WHERE user_id = ?
       ORDER BY is_read ASC, id DESC
       LIMIT 50`,
      [req.user.id]
    );

    const unreadCountRow = db.queryOne(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );

    res.json({
      notifications,
      unreadCount: unreadCountRow ? unreadCountRow.count : 0
    });
  } catch (err) {
    next(err);
  }
});

// Mark single notification as read
router.put('/:id/read', (req, res, next) => {
  try {
    const { id } = req.params;
    db.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, req.user.id]);
    res.json({ message: 'Notification marked as read.' });
  } catch (err) {
    next(err);
  }
});

// Mark all notifications as read
router.put('/read-all', (req, res, next) => {
  try {
    db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    next(err);
  }
});

// Clear single notification
router.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    db.run('DELETE FROM notifications WHERE id = ? AND user_id = ?', [id, req.user.id]);
    res.json({ message: 'Notification removed.' });
  } catch (err) {
    next(err);
  }
});

// Clear all notifications
router.delete('/clear-all', (req, res, next) => {
  try {
    db.run('DELETE FROM notifications WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'All notifications cleared.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

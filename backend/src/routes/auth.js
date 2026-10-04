const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const config = require('../config');
const authenticate = require('../middleware/auth');
const logger = require('../utils/logger');

const defaultCategories = [
  { name: 'Housing', color: '#4F46E5', icon: 'Home' },
  { name: 'Food & Dining', color: '#F59E0B', icon: 'Utensils' },
  { name: 'Transport', color: '#06B6D4', icon: 'Car' },
  { name: 'Utilities', color: '#10B981', icon: 'Zap' },
  { name: 'Healthcare', color: '#EC4899', icon: 'Heart' },
  { name: 'Shopping', color: '#8B5CF6', icon: 'ShoppingBag' },
  { name: 'Travel', color: '#3B82F6', icon: 'Plane' },
  { name: 'Entertainment', color: '#F97316', icon: 'Film' },
  { name: 'Education', color: '#6366F1', icon: 'GraduationCap' },
  { name: 'Miscellaneous', color: '#64748B', icon: 'MoreHorizontal' }
];

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

// Register
router.post('/register', (req, res, next) => {
  try {
    const { email, password, name, currency = 'USD', monthly_income = 5000 } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        error: { message: 'Name, email, and password are required.' }
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: { message: 'Password must be at least 6 characters long.' }
      });
    }

    const existing = db.queryOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing) {
      return res.status(409).json({
        error: { message: 'An account with this email address already exists.' }
      });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const userRes = db.run(
      `INSERT INTO users (email, password_hash, name, currency, monthly_income)
       VALUES (?, ?, ?, ?, ?)`,
      [email.toLowerCase().trim(), passwordHash, name.trim(), currency.toUpperCase(), parseFloat(monthly_income) || 5000]
    );

    const userId = userRes.lastInsertRowid;

    // Seed default categories for this user
    for (const cat of defaultCategories) {
      db.run(
        'INSERT INTO categories (user_id, name, color, icon, is_default) VALUES (?, ?, ?, ?, 1)',
        [userId, cat.name, cat.color, cat.icon]
      );
    }

    // Seed a welcome notification
    db.run(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES (?, ?, ?, ?)`,
      [userId, 'Welcome to Automated Expense Tracker!', 'Your account has been created. Start by adding your first expense or setting a monthly budget.', 'system']
    );

    const user = db.queryOne(
      'SELECT id, email, name, currency, monthly_income, timezone, date_format FROM users WHERE id = ?',
      [userId]
    );

    const token = generateToken(user);
    res.status(201).json({
      message: 'Account created successfully.',
      token,
      user
    });
  } catch (err) {
    next(err);
  }
});

// Login
router.post('/login', (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: { message: 'Email and password are required.' }
      });
    }

    const user = db.queryOne('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!user) {
      return res.status(401).json({
        error: { message: 'Invalid email or password.' }
      });
    }

    const passwordValid = bcrypt.compareSync(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({
        error: { message: 'Invalid email or password.' }
      });
    }

    const token = generateToken(user);
    const { password_hash, ...safeUser } = user;

    res.json({
      message: 'Signed in successfully.',
      token,
      user: safeUser
    });
  } catch (err) {
    next(err);
  }
});

// Quick Demo Login (Instant evaluation)
router.post('/demo', (req, res, next) => {
  try {
    let user = db.queryOne('SELECT * FROM users WHERE email = ?', ['demo@expensetracker.io']);
    if (!user) {
      // If demo user does not exist, run seed
      const seed = require('../db/seed');
      seed();
      user = db.queryOne('SELECT * FROM users WHERE email = ?', ['demo@expensetracker.io']);
    }

    const token = generateToken(user);
    const { password_hash, ...safeUser } = user;

    res.json({
      message: 'Signed in to Demo workspace.',
      token,
      user: safeUser
    });
  } catch (err) {
    next(err);
  }
});

// Current User Profile
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Update Profile & Preferences
router.put('/profile', authenticate, (req, res, next) => {
  try {
    const {
      name,
      currency,
      monthly_income,
      timezone,
      date_format,
      notification_budget_alerts,
      notification_recurring_reminders,
      notification_spending_spikes
    } = req.body;

    db.run(
      `UPDATE users
       SET name = COALESCE(?, name),
           currency = COALESCE(?, currency),
           monthly_income = COALESCE(?, monthly_income),
           timezone = COALESCE(?, timezone),
           date_format = COALESCE(?, date_format),
           notification_budget_alerts = COALESCE(?, notification_budget_alerts),
           notification_recurring_reminders = COALESCE(?, notification_recurring_reminders),
           notification_spending_spikes = COALESCE(?, notification_spending_spikes),
           updated_at = datetime('now')
       WHERE id = ?`,
      [
        name,
        currency,
        monthly_income !== undefined ? parseFloat(monthly_income) : null,
        timezone,
        date_format,
        notification_budget_alerts !== undefined ? (notification_budget_alerts ? 1 : 0) : null,
        notification_recurring_reminders !== undefined ? (notification_recurring_reminders ? 1 : 0) : null,
        notification_spending_spikes !== undefined ? (notification_spending_spikes ? 1 : 0) : null,
        req.user.id
      ]
    );

    const updatedUser = db.queryOne(
      'SELECT id, email, name, currency, monthly_income, timezone, date_format, notification_budget_alerts, notification_recurring_reminders, notification_spending_spikes FROM users WHERE id = ?',
      [req.user.id]
    );

    res.json({
      message: 'Profile updated successfully.',
      user: updatedUser
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

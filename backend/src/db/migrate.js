const db = require('./database');
const logger = require('../utils/logger');

const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  currency TEXT DEFAULT 'USD',
  monthly_income REAL DEFAULT 5000.00,
  timezone TEXT DEFAULT 'UTC',
  date_format TEXT DEFAULT 'YYYY-MM-DD',
  notification_budget_alerts INTEGER DEFAULT 1,
  notification_recurring_reminders INTEGER DEFAULT 1,
  notification_spending_spikes INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  category_id INTEGER,
  amount REAL NOT NULL,
  month TEXT NOT NULL,
  rollover_enabled INTEGER DEFAULT 0,
  rollover_amount REAL DEFAULT 0.00,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, category_id, month)
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  merchant TEXT NOT NULL,
  category_id INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  notes TEXT,
  receipt_url TEXT,
  is_recurring INTEGER DEFAULT 0,
  recurring_frequency TEXT DEFAULT 'none',
  is_business INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  amount REAL NOT NULL,
  category_id INTEGER NOT NULL,
  frequency TEXT NOT NULL,
  next_due_date TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  derivation TEXT NOT NULL,
  category_id INTEGER,
  severity TEXT DEFAULT 'info',
  potential_savings REAL DEFAULT 0.00,
  is_dismissed INTEGER DEFAULT 0,
  is_helpful INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_user_cat ON expenses(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_id, month);
CREATE INDEX IF NOT EXISTS idx_insights_user ON insights(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
`;

async function runMigrations() {
  logger.info('Running database migrations...');
  db.exec(schemaSql);
  logger.info('Database migrations completed successfully.');
}

if (require.main === module) {
  (async () => {
    try {
      await db.init();
      await runMigrations();
      db.flush();
      logger.info('Migration script finished.');
    } catch (err) {
      logger.error('Migration failed', { error: err });
      process.exitCode = 1;
    }
  })();
}

module.exports = {
  runMigrations,
  schemaSql
};

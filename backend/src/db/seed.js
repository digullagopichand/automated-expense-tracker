const bcrypt = require('bcryptjs');
const db = require('./database');
const { runMigrations } = require('./migrate');
const logger = require('../utils/logger');

async function seed() {
  logger.info('Starting database seeding...');
  await db.init();
  await runMigrations();

  // Check if demo user already exists
  let user = db.queryOne('SELECT * FROM users WHERE email = ?', ['demo@expensetracker.io']);
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('Password123!', salt);

  let userId;
  if (!user) {
    const res = db.run(
      `INSERT INTO users (email, password_hash, name, currency, monthly_income, timezone, date_format)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['demo@expensetracker.io', passwordHash, 'Alex Morgan', 'USD', 6500.00, 'America/New_York', 'YYYY-MM-DD']
    );
    userId = res.lastInsertRowid;
    logger.info(`Created demo user with ID: ${userId}`);
  } else {
    userId = user.id;
    logger.info(`Demo user already exists with ID: ${userId}`);
  }

  // Clear existing demo user data for repeatable clean state
  db.run('DELETE FROM categories WHERE user_id = ?', [userId]);
  db.run('DELETE FROM budgets WHERE user_id = ?', [userId]);
  db.run('DELETE FROM expenses WHERE user_id = ?', [userId]);
  db.run('DELETE FROM recurring_expenses WHERE user_id = ?', [userId]);
  db.run('DELETE FROM insights WHERE user_id = ?', [userId]);
  db.run('DELETE FROM notifications WHERE user_id = ?', [userId]);

  // Insert standard corporate & personal categories
  const categoriesData = [
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

  const catMap = {};
  for (const cat of categoriesData) {
    const r = db.run(
      'INSERT INTO categories (user_id, name, color, icon, is_default) VALUES (?, ?, ?, ?, 1)',
      [userId, cat.name, cat.color, cat.icon]
    );
    catMap[cat.name] = r.lastInsertRowid;
  }
  logger.info(`Seeded ${categoriesData.length} categories.`);

  // Insert Budgets for October 2026 (current period)
  const currentMonth = '2026-10';
  const prevMonth = '2026-09';

  // Total monthly budget: $4,200
  db.run(
    'INSERT INTO budgets (user_id, category_id, amount, month, rollover_enabled, rollover_amount) VALUES (?, NULL, ?, ?, 1, 150.00)',
    [userId, 4200.00, currentMonth]
  );
  db.run(
    'INSERT INTO budgets (user_id, category_id, amount, month, rollover_enabled, rollover_amount) VALUES (?, NULL, ?, ?, 1, 0.00)',
    [userId, 4200.00, prevMonth]
  );

  const categoryBudgets = [
    { cat: 'Housing', amount: 1400.00 },
    { cat: 'Food & Dining', amount: 750.00 },
    { cat: 'Transport', amount: 350.00 },
    { cat: 'Utilities', amount: 250.00 },
    { cat: 'Healthcare', amount: 200.00 },
    { cat: 'Shopping', amount: 450.00 },
    { cat: 'Entertainment', amount: 250.00 },
    { cat: 'Miscellaneous', amount: 150.00 }
  ];

  for (const b of categoryBudgets) {
    db.run(
      'INSERT INTO budgets (user_id, category_id, amount, month, rollover_enabled, rollover_amount) VALUES (?, ?, ?, ?, 0, 0)',
      [userId, catMap[b.cat], b.amount, currentMonth]
    );
    db.run(
      'INSERT INTO budgets (user_id, category_id, amount, month, rollover_enabled, rollover_amount) VALUES (?, ?, ?, ?, 0, 0)',
      [userId, catMap[b.cat], b.amount, prevMonth]
    );
  }
  logger.info('Seeded monthly budgets.');

  // Insert Expenses across September and October 2026
  const sampleExpenses = [
    // October 2026 (Current Month)
    { amount: 1400.00, date: '2026-10-01', merchant: 'Grandview Apartments', cat: 'Housing', method: 'Bank Transfer', notes: 'Monthly rent payment', recurring: 1, freq: 'monthly', biz: 0 },
    { amount: 142.50, date: '2026-10-01', merchant: 'Whole Foods Market', cat: 'Food & Dining', method: 'Credit Card', notes: 'Weekly grocery run', recurring: 0, freq: 'none', biz: 0 },
    { amount: 18.75, date: '2026-10-02', merchant: 'Starbucks Coffee', cat: 'Food & Dining', method: 'Credit Card', notes: 'Team coffee sync', recurring: 0, freq: 'none', biz: 1 },
    { amount: 45.00, date: '2026-10-02', merchant: 'Metro Transit Card', cat: 'Transport', method: 'Debit Card', notes: 'Monthly transit recharge', recurring: 0, freq: 'none', biz: 0 },
    { amount: 89.20, date: '2026-10-03', merchant: 'ConEdison Electric', cat: 'Utilities', method: 'Bank Transfer', notes: 'September electric bill', recurring: 1, freq: 'monthly', biz: 0 },
    { amount: 64.99, date: '2026-10-03', merchant: 'Amazon.com', cat: 'Shopping', method: 'Credit Card', notes: 'USB-C hub and cables', recurring: 0, freq: 'none', biz: 1 },
    { amount: 32.50, date: '2026-10-04', merchant: 'Chipotle Mexican Grill', cat: 'Food & Dining', method: 'Credit Card', notes: 'Dinner with coworker', recurring: 0, freq: 'none', biz: 0 },
    { amount: 16.99, date: '2026-10-04', merchant: 'Spotify Family', cat: 'Entertainment', method: 'Credit Card', notes: 'Family music subscription', recurring: 1, freq: 'monthly', biz: 0 },
    { amount: 120.00, date: '2026-10-04', merchant: 'City Dental Clinic', cat: 'Healthcare', method: 'Debit Card', notes: 'Routine checkup copay', recurring: 0, freq: 'none', biz: 0 },
    { amount: 55.40, date: '2026-10-04', merchant: 'Shell Gasoline', cat: 'Transport', method: 'Credit Card', notes: 'Fuel for weekend drive', recurring: 0, freq: 'none', biz: 0 },

    // September 2026 (Previous Month - for comparisons and trend analytics)
    { amount: 1400.00, date: '2026-09-01', merchant: 'Grandview Apartments', cat: 'Housing', method: 'Bank Transfer', notes: 'September rent', recurring: 1, freq: 'monthly', biz: 0 },
    { amount: 135.20, date: '2026-09-03', merchant: 'Trader Joe’s', cat: 'Food & Dining', method: 'Credit Card', notes: 'Groceries', recurring: 0, freq: 'none', biz: 0 },
    { amount: 62.00, date: '2026-09-05', merchant: 'Uber Ride', cat: 'Transport', method: 'Credit Card', notes: 'Airport commute', recurring: 0, freq: 'none', biz: 1 },
    { amount: 72.50, date: '2026-09-08', merchant: 'ConEdison Electric', cat: 'Utilities', method: 'Bank Transfer', notes: 'Electricity bill', recurring: 1, freq: 'monthly', biz: 0 },
    { amount: 48.00, date: '2026-09-10', merchant: 'AMC Theatres', cat: 'Entertainment', method: 'Debit Card', notes: 'Movie tickets and snacks', recurring: 0, freq: 'none', biz: 0 },
    { amount: 180.00, date: '2026-09-12', merchant: 'Target Department Store', cat: 'Shopping', method: 'Credit Card', notes: 'Home essentials & organizers', recurring: 0, freq: 'none', biz: 0 },
    { amount: 115.40, date: '2026-09-15', merchant: 'Whole Foods Market', cat: 'Food & Dining', method: 'Credit Card', notes: 'Groceries', recurring: 0, freq: 'none', biz: 0 },
    { amount: 45.00, date: '2026-09-18', merchant: 'Metro Transit Card', cat: 'Transport', method: 'Debit Card', notes: 'Commute reload', recurring: 0, freq: 'none', biz: 0 },
    { amount: 95.00, date: '2026-09-22', merchant: 'Blue Bottle Coffee', cat: 'Food & Dining', method: 'Credit Card', notes: 'Coffee subscription beans', recurring: 0, freq: 'none', biz: 0 },
    { amount: 220.00, date: '2026-09-25', merchant: 'Delta Air Lines', cat: 'Travel', method: 'Credit Card', notes: 'Client onsite flight', recurring: 0, freq: 'none', biz: 1 },
    { amount: 16.99, date: '2026-09-24', merchant: 'Spotify Family', cat: 'Entertainment', method: 'Credit Card', notes: 'Monthly subscription', recurring: 1, freq: 'monthly', biz: 0 },
    { amount: 85.00, date: '2026-09-28', merchant: 'AWS Cloud Services', cat: 'Utilities', method: 'Credit Card', notes: 'Cloud infrastructure staging server', recurring: 1, freq: 'monthly', biz: 1 }
  ];

  for (const exp of sampleExpenses) {
    db.run(
      `INSERT INTO expenses (user_id, amount, date, merchant, category_id, payment_method, notes, is_recurring, recurring_frequency, is_business)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, exp.amount, exp.date, exp.merchant, catMap[exp.cat], exp.method, exp.notes, exp.recurring, exp.freq, exp.biz]
    );
  }
  logger.info(`Seeded ${sampleExpenses.length} sample expenses across 2 months.`);

  // Insert Upcoming Recurring Expenses
  const recurringList = [
    { title: 'Apartment Rent', amount: 1400.00, cat: 'Housing', freq: 'monthly', nextDue: '2026-11-01', method: 'Bank Transfer' },
    { title: 'AWS Cloud Hosting', amount: 85.00, cat: 'Utilities', freq: 'monthly', nextDue: '2026-10-15', method: 'Credit Card' },
    { title: 'Fiber Internet (Verizon Fios)', amount: 69.99, cat: 'Utilities', freq: 'monthly', nextDue: '2026-10-20', method: 'Credit Card' },
    { title: 'Equinox Gym Membership', amount: 55.00, cat: 'Healthcare', freq: 'monthly', nextDue: '2026-10-12', method: 'Debit Card' },
    { title: 'Spotify Family Subscription', amount: 16.99, cat: 'Entertainment', freq: 'monthly', nextDue: '2026-10-24', method: 'Credit Card' }
  ];

  for (const rec of recurringList) {
    db.run(
      `INSERT INTO recurring_expenses (user_id, title, amount, category_id, frequency, next_due_date, payment_method, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [userId, rec.title, rec.amount, catMap[rec.cat], rec.freq, rec.nextDue, rec.method]
    );
  }
  logger.info(`Seeded ${recurringList.length} recurring expenses.`);

  // Insert Initial Explainable Insights
  const initialInsights = [
    {
      type: 'budget_warning',
      title: 'Housing Budget Allocation',
      description: 'Your monthly rent of $1,400 represents 33.3% of your total monthly budget ($4,200).',
      derivation: 'Calculated as ($1,400 rent / $4,200 total budget) * 100 = 33.33%. This adheres to the recommended 30-35% maximum housing guideline.',
      cat: 'Housing',
      severity: 'info',
      potential_savings: 0.00
    },
    {
      type: 'spike',
      title: 'Dining & Coffee Frequency',
      description: 'You recorded 3 dining and coffee purchases in the first 4 days of October totalling $193.75.',
      derivation: 'Average daily dining spend is currently $48.44/day vs $14.20/day in September. At this rate, projected Food & Dining spend will reach $1,501, exceeding your $750 category budget by 100%.',
      cat: 'Food & Dining',
      severity: 'warning',
      potential_savings: 150.00
    },
    {
      type: 'savings_tip',
      title: 'Active Recurring Subscriptions Audit',
      description: 'You have 5 recurring commitments amounting to $1,626.98 per month ($19,523.76 annually).',
      derivation: 'Aggregated sum of all active subscriptions: Rent ($1,400) + AWS ($85) + Internet ($70) + Gym ($55) + Spotify ($17) = $1,626.98/mo.',
      cat: 'Utilities',
      severity: 'info',
      potential_savings: 45.00
    }
  ];

  for (const ins of initialInsights) {
    db.run(
      `INSERT INTO insights (user_id, type, title, description, derivation, category_id, severity, potential_savings, is_dismissed, is_helpful)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      [userId, ins.type, ins.title, ins.description, ins.derivation, catMap[ins.cat], ins.severity, ins.potential_savings]
    );
  }
  logger.info(`Seeded ${initialInsights.length} explainable insights.`);

  // Insert In-App Notifications
  const initialNotifications = [
    {
      title: 'Budget Alert: Food & Dining',
      message: 'Food & Dining has reached $193.75 (25.8% of $750.00 budget) in the first 4 days of October.',
      type: 'budget_alert'
    },
    {
      title: 'Upcoming Bill: Equinox Gym',
      message: 'Equinox Gym Membership ($55.00) is scheduled for deduction on October 12, 2026.',
      type: 'recurring_reminder'
    },
    {
      title: 'Welcome to Automated Expense Tracker',
      message: 'Demo dataset loaded. You can track spending, test CSV imports, customize budgets, and inspect AI suggestions.',
      type: 'system'
    }
  ];

  for (const notif of initialNotifications) {
    db.run(
      'INSERT INTO notifications (user_id, title, message, type, is_read) VALUES (?, ?, ?, ?, 0)',
      [userId, notif.title, notif.message, notif.type]
    );
  }
  logger.info(`Seeded ${initialNotifications.length} in-app notifications.`);

  db.flush();
  logger.info('Database seeding completed successfully!');
}

if (require.main === module) {
  (async () => {
    try {
      await seed();
    } catch (err) {
      logger.error('Seeding failed', { error: err });
      process.exitCode = 1;
    }
  })();
}

module.exports = seed;

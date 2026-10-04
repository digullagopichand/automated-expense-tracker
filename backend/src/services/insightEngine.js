const db = require('../db/database');
const logger = require('../utils/logger');

function analyzeUserSpending(userId) {
  const generatedInsights = [];

  // Check total transactions
  const countRow = db.queryOne('SELECT COUNT(*) AS count FROM expenses WHERE user_id = ?', [userId]);
  const totalCount = countRow ? countRow.count : 0;

  // Strict requirement: "Do not present invented insights when there is insufficient data."
  if (totalCount < 3) {
    return generatedInsights;
  }

  const now = new Date();
  const currentMonth = now.toISOString().substring(0, 7);

  // Calculate previous month
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = prevDate.toISOString().substring(0, 7);

  // 1. Analyze Category Spikes (Unusual increases > 20% vs last month)
  const categoryComparison = db.query(
    `SELECT c.id, c.name, c.color,
            COALESCE((SELECT SUM(amount) FROM expenses WHERE user_id = ? AND category_id = c.id AND strftime('%Y-%m', date) = ?), 0) AS current_spent,
            COALESCE((SELECT SUM(amount) FROM expenses WHERE user_id = ? AND category_id = c.id AND strftime('%Y-%m', date) = ?), 0) AS prev_spent
     FROM categories c
     WHERE c.user_id = ?`,
    [userId, currentMonth, userId, prevMonth, userId]
  );

  for (const cat of categoryComparison) {
    if (cat.prev_spent > 30 && cat.current_spent > cat.prev_spent * 1.2) {
      const diff = cat.current_spent - cat.prev_spent;
      const pct = Math.round(((cat.current_spent - cat.prev_spent) / cat.prev_spent) * 100);
      generatedInsights.push({
        user_id: userId,
        type: 'spike',
        title: `Spike in ${cat.name} Spending`,
        description: `Your spending on ${cat.name} is ${pct}% higher this month ($${cat.current_spent.toFixed(2)}) compared to last month ($${cat.prev_spent.toFixed(2)}).`,
        derivation: `Analysis of transactions in ${cat.name}: September spend = $${cat.prev_spent.toFixed(2)}, October spend = $${cat.current_spent.toFixed(2)}. Net increase of +$${diff.toFixed(2)} (+${pct}%).`,
        category_id: cat.id,
        severity: pct > 50 ? 'danger' : 'warning',
        potential_savings: Math.round(diff * 0.4)
      });
    }
  }

  // 2. Frequent Purchases / Repetitive Merchants in past 30 days
  const frequentMerchants = db.query(
    `SELECT merchant, COUNT(*) AS txn_count, SUM(amount) AS total_spent, AVG(amount) AS avg_spent, category_id
     FROM expenses
     WHERE user_id = ? AND date >= date('now', '-30 days')
     GROUP BY merchant
     HAVING COUNT(*) >= 3
     ORDER BY txn_count DESC
     LIMIT 2`,
    [userId]
  );

  for (const fm of frequentMerchants) {
    generatedInsights.push({
      user_id: userId,
      type: 'frequent',
      title: `Frequent Purchases at ${fm.merchant}`,
      description: `You have made ${fm.txn_count} purchases at ${fm.merchant} in the last 30 days, totaling $${fm.total_spent.toFixed(2)}.`,
      derivation: `Identified ${fm.txn_count} separate transactions matching merchant "${fm.merchant}" within a 30-day window, averaging $${fm.avg_spent.toFixed(2)} per transaction.`,
      category_id: fm.category_id,
      severity: 'info',
      potential_savings: Math.round(fm.total_spent * 0.25)
    });
  }

  // 3. Categories Approaching or Over Budget
  const budgetAlerts = db.query(
    `SELECT b.amount AS budget_amount, c.id AS category_id, c.name AS category_name,
            COALESCE(SUM(e.amount), 0) AS spent
     FROM budgets b
     JOIN categories c ON c.id = b.category_id
     LEFT JOIN expenses e ON e.category_id = b.category_id AND e.user_id = b.user_id AND strftime('%Y-%m', e.date) = b.month
     WHERE b.user_id = ? AND b.month = ?
     GROUP BY b.id
     HAVING spent >= (b.amount * 0.8)`,
    [userId, currentMonth]
  );

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate();

  for (const ba of budgetAlerts) {
    const pct = Math.round((ba.spent / ba.budget_amount) * 100);
    const isOver = pct >= 100;
    generatedInsights.push({
      user_id: userId,
      type: 'budget_warning',
      title: isOver ? `${ba.category_name} Over Budget` : `${ba.category_name} Approaching Budget`,
      description: isOver
        ? `You have exceeded your ${ba.category_name} monthly budget by $${(ba.spent - ba.budget_amount).toFixed(2)} (${pct}% of target).`
        : `You have consumed ${pct}% of your ${ba.category_name} budget with ${daysLeft} days remaining in this month.`,
      derivation: `Budget limit: $${ba.budget_amount.toFixed(2)}. Current recorded spend: $${ba.spent.toFixed(2)} (${pct}%). Days remaining in billing cycle: ${daysLeft}.`,
      category_id: ba.category_id,
      severity: isOver ? 'danger' : 'warning',
      potential_savings: Math.max(0, Math.round(ba.spent - ba.budget_amount))
    });
  }

  // 4. Discretionary Spending Ratio
  const discretionaryRow = db.queryOne(
    `SELECT
       COALESCE(SUM(CASE WHEN c.name IN ('Shopping', 'Entertainment', 'Travel') THEN e.amount ELSE 0 END), 0) AS discretionary,
       COALESCE(SUM(e.amount), 0) AS total
     FROM expenses e
     JOIN categories c ON c.id = e.category_id
     WHERE e.user_id = ? AND strftime('%Y-%m', e.date) = ?`,
    [userId, currentMonth]
  );

  if (discretionaryRow && discretionaryRow.total > 200) {
    const discPct = Math.round((discretionaryRow.discretionary / discretionaryRow.total) * 100);
    if (discPct >= 40) {
      generatedInsights.push({
        user_id: userId,
        type: 'savings_tip',
        title: 'High Discretionary Spending',
        description: `Discretionary categories (Shopping, Entertainment, Travel) represent ${discPct}% ($${discretionaryRow.discretionary.toFixed(2)}) of your total spending this month.`,
        derivation: `Calculated as ($${discretionaryRow.discretionary.toFixed(2)} discretionary spend / $${discretionaryRow.total.toFixed(2)} total spend) * 100 = ${discPct}%. Financial benchmarks recommend keeping discretionary spend under 30%.`,
        category_id: null,
        severity: 'info',
        potential_savings: Math.round(discretionaryRow.discretionary * 0.2)
      });
    }
  }

  return generatedInsights;
}

function refreshUserInsights(userId) {
  try {
    const insights = analyzeUserSpending(userId);

    // Remove old insights that haven't been dismissed or marked helpful to refresh recommendations
    db.run(
      'DELETE FROM insights WHERE user_id = ? AND is_dismissed = 0 AND is_helpful = 0',
      [userId]
    );

    for (const ins of insights) {
      // Check if an identical insight title already exists for this user
      const existing = db.queryOne(
        'SELECT id FROM insights WHERE user_id = ? AND title = ?',
        [userId, ins.title]
      );

      if (!existing) {
        db.run(
          `INSERT INTO insights (user_id, type, title, description, derivation, category_id, severity, potential_savings)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            ins.type,
            ins.title,
            ins.description,
            ins.derivation,
            ins.category_id,
            ins.severity,
            ins.potential_savings
          ]
        );
      }
    }
  } catch (err) {
    logger.error('Failed to refresh user insights', { userId, error: err });
  }
}

module.exports = {
  analyzeUserSpending,
  refreshUserInsights
};

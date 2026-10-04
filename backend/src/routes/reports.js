const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middleware/auth');

router.use(authenticate);

// Generate comprehensive report summary
router.get('/summary', (req, res, next) => {
  try {
    const { period = 'month', start_date, end_date, category_id } = req.query;

    const now = new Date();
    let startDateStr = start_date;
    let endDateStr = end_date;
    let priorStartDateStr;
    let priorEndDateStr;

    if (!startDateStr || !endDateStr) {
      if (period === 'week') {
        const d = new Date(now);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
        d.setDate(diff);
        startDateStr = d.toISOString().substring(0, 10);
        endDateStr = now.toISOString().substring(0, 10);

        const priorStart = new Date(d);
        priorStart.setDate(priorStart.getDate() - 7);
        const priorEnd = new Date(d);
        priorEnd.setDate(priorEnd.getDate() - 1);
        priorStartDateStr = priorStart.toISOString().substring(0, 10);
        priorEndDateStr = priorEnd.toISOString().substring(0, 10);
      } else if (period === 'quarter') {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const qStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
        const qEnd = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);
        startDateStr = qStart.toISOString().substring(0, 10);
        endDateStr = now.toISOString().substring(0, 10);

        const priorQStart = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1);
        const priorQEnd = new Date(now.getFullYear(), currentQuarter * 3, 0);
        priorStartDateStr = priorQStart.toISOString().substring(0, 10);
        priorEndDateStr = priorQEnd.toISOString().substring(0, 10);
      } else {
        // Default: this month
        const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
        startDateStr = mStart.toISOString().substring(0, 10);
        endDateStr = now.toISOString().substring(0, 10);

        const priorMStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const priorMEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        priorStartDateStr = priorMStart.toISOString().substring(0, 10);
        priorEndDateStr = priorMEnd.toISOString().substring(0, 10);
      }
    }

    const params = [req.user.id, startDateStr, endDateStr];
    let catFilter = '';
    if (category_id) {
      catFilter = ' AND e.category_id = ?';
      params.push(parseInt(category_id, 10));
    }

    // Current period total and count
    const totalRow = db.queryOne(
      `SELECT COALESCE(SUM(amount), 0) AS total_spending, COUNT(*) AS txn_count,
              COALESCE(AVG(amount), 0) AS avg_txn
       FROM expenses e
       WHERE e.user_id = ? AND e.date >= ? AND e.date <= ? ${catFilter}`,
      params
    );

    const totalSpending = totalRow ? totalRow.total_spending : 0;
    const txnCount = totalRow ? totalRow.txn_count : 0;
    const avgTxn = totalRow ? totalRow.avg_txn : 0;

    // Prior period comparison
    let priorSpending = 0;
    if (priorStartDateStr && priorEndDateStr) {
      const priorParams = [req.user.id, priorStartDateStr, priorEndDateStr];
      if (category_id) priorParams.push(parseInt(category_id, 10));

      const priorRow = db.queryOne(
        `SELECT COALESCE(SUM(amount), 0) AS prior_spending
         FROM expenses e
         WHERE e.user_id = ? AND e.date >= ? AND e.date <= ? ${catFilter}`,
        priorParams
      );
      priorSpending = priorRow ? priorRow.prior_spending : 0;
    }

    const spendingDifference = totalSpending - priorSpending;
    const spendingChangePercent = priorSpending > 0
      ? Math.round(((totalSpending - priorSpending) / priorSpending) * 100)
      : (totalSpending > 0 ? 100 : 0);

    // Category Breakdown
    const categoryBreakdown = db.query(
      `SELECT c.id, c.name, c.color, c.icon,
              COALESCE(SUM(e.amount), 0) AS total_amount,
              COUNT(e.id) AS count
       FROM categories c
       JOIN expenses e ON e.category_id = c.id
       WHERE e.user_id = ? AND e.date >= ? AND e.date <= ? ${catFilter}
       GROUP BY c.id
       ORDER BY total_amount DESC`,
      params
    ).map(c => ({
      ...c,
      percentage: totalSpending > 0 ? Math.round((c.total_amount / totalSpending) * 100) : 0
    }));

    // Spending Over Time (daily timeline)
    const timeline = db.query(
      `SELECT e.date, SUM(e.amount) AS daily_amount, COUNT(*) as count
       FROM expenses e
       WHERE e.user_id = ? AND e.date >= ? AND e.date <= ? ${catFilter}
       GROUP BY e.date
       ORDER BY e.date ASC`,
      params
    );

    // Payment Methods Breakdown
    const paymentMethods = db.query(
      `SELECT e.payment_method, SUM(e.amount) AS total_amount, COUNT(*) as count
       FROM expenses e
       WHERE e.user_id = ? AND e.date >= ? AND e.date <= ? ${catFilter}
       GROUP BY e.payment_method
       ORDER BY total_amount DESC`,
      params
    );

    // Business vs Personal
    const bizSplit = db.query(
      `SELECT
         CASE WHEN e.is_business = 1 THEN 'Business' ELSE 'Personal' END AS type,
         SUM(e.amount) AS total_amount,
         COUNT(*) as count
       FROM expenses e
       WHERE e.user_id = ? AND e.date >= ? AND e.date <= ? ${catFilter}
       GROUP BY e.is_business`,
      params
    );

    // Income vs Expenses
    const monthlyIncome = req.user.monthly_income || 5000.00;
    const netSavings = Math.max(0, monthlyIncome - totalSpending);
    const savingsRate = monthlyIncome > 0 ? Math.round((netSavings / monthlyIncome) * 100) : 0;

    res.json({
      period,
      startDate: startDateStr,
      endDate: endDateStr,
      metrics: {
        totalSpending,
        priorSpending,
        spendingDifference,
        spendingChangePercent,
        txnCount,
        avgTxn,
        monthlyIncome,
        netSavings,
        savingsRate
      },
      categoryBreakdown,
      timeline,
      paymentMethods,
      bizSplit
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

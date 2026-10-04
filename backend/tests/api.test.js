const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db/database');
const { runMigrations } = require('../src/db/migrate');
const seed = require('../src/db/seed');

let authToken = '';
let testCategoryId = null;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await db.init({ inMemory: true });
  await runMigrations();
  await seed();

  // Log in as demo user to obtain token
  const res = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'demo@expensetracker.io',
      password: 'Password123!'
    });

  expect(res.statusCode).toBe(200);
  expect(res.body.token).toBeDefined();
  authToken = res.body.token;

  // Fetch a category ID
  const catRes = await request(app)
    .get('/api/categories')
    .set('Authorization', `Bearer ${authToken}`);
  expect(catRes.statusCode).toBe(200);
  testCategoryId = catRes.body.categories[0].id;
});

afterAll(() => {
  db.flush();
});

describe('1. Health Check Endpoint', () => {
  it('GET /health returns healthy status and system metrics', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.database.healthy).toBe(true);
    expect(res.body.version).toBe('1.0.0');
    expect(res.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
});

describe('2. Authentication Flow', () => {
  it('POST /api/auth/login fails with invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'demo@expensetracker.io', password: 'WrongPassword' });

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('POST /api/auth/register creates a new user account with default categories', async () => {
    const uniqueEmail = `test-${Date.now()}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: uniqueEmail,
        password: 'SecurePassword123!',
        name: 'Unit Tester',
        currency: 'EUR'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.user.email).toBe(uniqueEmail);
    expect(res.body.token).toBeDefined();

    // Verify default categories seeded for new user
    const catsRes = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${res.body.token}`);
    expect(catsRes.statusCode).toBe(200);
    expect(catsRes.body.categories.length).toBeGreaterThanOrEqual(5);
  });

  it('POST /api/auth/demo logs in to demo user seamlessly', async () => {
    const res = await request(app).post('/api/auth/demo');
    expect(res.statusCode).toBe(200);
    expect(res.body.user.email).toBe('demo@expensetracker.io');
    expect(res.body.token).toBeDefined();
  });

  it('GET /api/auth/me returns authenticated user details', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.user.name).toBe('Alex Morgan');
  });
});

describe('3. Expense Management Flow', () => {
  let createdExpenseId;

  it('POST /api/expenses creates an expense with validation', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 54.25,
        date: '2026-10-04',
        merchant: 'DevOps Cloud Books',
        category_id: testCategoryId,
        payment_method: 'Credit Card',
        notes: 'Kubernetes in Action book',
        is_business: 1
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.expense).toBeDefined();
    expect(res.body.expense.amount).toBe(54.25);
    expect(res.body.expense.merchant).toBe('DevOps Cloud Books');
    createdExpenseId = res.body.expense.id;
  });

  it('GET /api/expenses lists expenses with filters and pagination', async () => {
    const res = await request(app)
      .get('/api/expenses?search=Kubernetes')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.expenses.length).toBeGreaterThanOrEqual(1);
    expect(res.body.expenses[0].merchant).toBe('DevOps Cloud Books');
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
  });

  it('PUT /api/expenses/:id updates an expense', async () => {
    const res = await request(app)
      .put(`/api/expenses/${createdExpenseId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 60.00,
        notes: 'Updated note'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.expense.amount).toBe(60.00);
    expect(res.body.expense.notes).toBe('Updated note');
  });

  it('DELETE /api/expenses/:id removes an expense', async () => {
    const res = await request(app)
      .delete(`/api/expenses/${createdExpenseId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);

    const check = await request(app)
      .get(`/api/expenses/${createdExpenseId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(check.statusCode).toBe(404);
  });
});

describe('4. Budgets and Progress Flow', () => {
  it('POST /api/budgets sets category and overall budget', async () => {
    const res = await request(app)
      .post('/api/budgets')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        category_id: testCategoryId,
        amount: 900.00,
        month: '2026-10'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.budget.amount).toBe(900.00);
  });

  it('GET /api/budgets returns progress and threshold status', async () => {
    const res = await request(app)
      .get('/api/budgets?month=2026-10')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.overall).toBeDefined();
    expect(res.body.categories).toBeInstanceOf(Array);
    expect(res.body.categories.length).toBeGreaterThan(0);
  });
});

describe('5. Insights and Suggestions Engine', () => {
  it('GET /api/insights returns data-backed explainable insights', async () => {
    const res = await request(app)
      .get('/api/insights')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.insights).toBeInstanceOf(Array);
    if (res.body.insights.length > 0) {
      const ins = res.body.insights[0];
      expect(ins.title).toBeDefined();
      expect(ins.derivation).toBeDefined();
      expect(ins.derivation.length).toBeGreaterThan(10);
    }
  });

  it('POST /api/insights/:id/helpful toggles helpful feedback', async () => {
    const listRes = await request(app)
      .get('/api/insights')
      .set('Authorization', `Bearer ${authToken}`);

    if (listRes.body.insights.length > 0) {
      const id = listRes.body.insights[0].id;
      const res = await request(app)
        .post(`/api/insights/${id}/helpful`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.is_helpful).toBeDefined();
    }
  });
});

describe('6. CSV Validation and Import Flow', () => {
  it('POST /api/expenses/import/preview parses and validates CSV rows', async () => {
    const sampleCsv = `Amount,Date,Merchant,Category,Payment Method,Notes\n45.50,2026-10-02,Trader Joes,Food & Dining,Debit Card,Weekly fruits\n12.00,2026-10-03,Blue Bottle,Food & Dining,Credit Card,Espresso`;

    const res = await request(app)
      .post('/api/expenses/import/preview')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ csvText: sampleCsv });

    expect(res.statusCode).toBe(200);
    expect(res.body.isValid).toBe(true);
    expect(res.body.rows.length).toBe(2);
    expect(res.body.rows[0].merchant).toBe('Trader Joes');
    expect(res.body.rows[0].amount).toBe(45.5);
  });

  it('POST /api/expenses/import/commit inserts validated transactions', async () => {
    const rows = [
      {
        amount: 29.99,
        date: '2026-10-04',
        merchant: 'DigitalOcean Cloud',
        category_id: testCategoryId,
        payment_method: 'Credit Card',
        notes: 'VPS droplet'
      }
    ];

    const res = await request(app)
      .post('/api/expenses/import/commit')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ rows });

    expect(res.statusCode).toBe(200);
    expect(res.body.importedCount).toBe(1);
  });
});

describe('7. Reports & Summary Flow', () => {
  it('GET /api/reports/summary calculates totals, comparisons, and cash flow', async () => {
    const res = await request(app)
      .get('/api/reports/summary?period=month')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.metrics.totalSpending).toBeGreaterThan(0);
    expect(res.body.categoryBreakdown).toBeInstanceOf(Array);
    expect(res.body.timeline).toBeInstanceOf(Array);
  });
});

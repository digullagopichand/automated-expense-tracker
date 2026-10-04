# Automated Expense Tracker

[![CI Pipeline](https://github.com/jvssiddhartha/automated-expense-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/jvssiddhartha/automated-expense-tracker/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B%20%7C%20v20%20%7C%20v22%20%7C%20v24-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Manifests-326CE5.svg)](https://kubernetes.io/)

A production-style, containerized financial management and expense tracking platform built for DevOps projects and enterprise engineering teams.

---

## Architecture Overview

The system adheres to clean separation of concerns across presentation, business logic, persistence, and container orchestration:

```
                          ┌───────────────────────────┐
                          │    Browser Client (SPA)   │
                          │   React 18 + Vite 6 + CSS │
                          └─────────────┬─────────────┘
                                        │
                                        │ HTTP / REST (JWT)
                                        ▼
                          ┌───────────────────────────┐
                          │     Nginx Web Server      │
                          │  (Reverse Proxy / Port 80)│
                          └─────────────┬─────────────┘
                                        │
                     ┌──────────────────┴──────────────────┐
                     │ /api/*                              │ /health
                     ▼                                     ▼
        ┌─────────────────────────┐           ┌─────────────────────────┐
        │   Backend API Service   │           │   Health Probes / K8s   │
        │ Express + JWT + Security│           │ Database Latency & Mem  │
        └────────────┬────────────┘           └─────────────────────────┘
                     │
                     ▼
        ┌─────────────────────────┐
        │  Embedded SQLite Engine │
        │ WASM WAL / Persistent   │
        └─────────────────────────┘
```

### Technology Stack Decisions

| Tier | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite 6, Vanilla CSS Modules | Fast hot module replacement (HMR), sub-second build times, zero bloated CSS runtime dependencies, responsive cross-device layout. |
| **Charts** | Chart.js 4, React-Chartjs-2 | Crisp hardware-accelerated HTML5 Canvas visualization for daily spending trends, doughnut breakdown, and cashflow bars. |
| **Backend** | Node.js, Express 4 | Widely supported, lightweight event loop, high throughput REST API, standard middleware ecosystem. |
| **Database** | SQLite with WASM (`sql.js`) | Zero-configuration local execution with zero C++ compilation dependencies on Windows/Linux/Mac/Docker, atomic transactions, WAL durability, and portable file volumes. |
| **Authentication** | JSON Web Tokens (JWT) + Bcrypt | Stateless authorization, cross-service portability, password salt hashing with multi-tenant user isolation. |
| **Containers** | Docker & Docker Compose | Multi-stage Dockerfiles with unprivileged users (`USER node`), Alpine bases, automated health probes, and persistent volumes. |
| **Cloud Deploy** | Kubernetes Manifests (`k8s/`) | Declarative Deployments, ClusterIP Services, ConfigMaps, Secrets, PVCs, and Ingress routing. |
| **CI/CD** | GitHub Actions (`.github/workflows/ci.yml`) | Multi-node automated test matrix, linting, production build verification, and container build checks. |

---

## Core Features

### 1. Executive Financial Dashboard
- **KPI Metrics**: Real-time Total Spending, Monthly Target, Remaining Balance, Net Cashflow (Savings), and % variation versus the prior comparative period.
- **Spending Telemetry Chart**: Smooth line chart showing daily spend patterns over selectable periods (*This Week*, *This Month*, *This Quarter*).
- **Category Doughnut Chart**: Interactive visual breakdown of spending across all active categories.
- **Recent Transactions Ledger**: Instant transaction preview with category tags, payment methods, and notes.
- **Upcoming Commitments**: Proactive schedule of upcoming recurring bills with an instant *"Log as Paid"* button.

### 2. Comprehensive Expense Management
- **Full CRUD**: Create, read, update, delete, and paginate expenses.
- **Multi-Parametric Filtering**: Filter by date range, category, merchant search, payment method (Credit Card, Debit Card, Bank Transfer, Cash, UPI), and tax classification (*Personal* vs. *Business*).
- **Receipt Attachments**: Upload and preview receipts/invoices (JPG, PNG, WEBP, PDF) with instant lightbox viewing.
- **CSV Data Pipeline**:
  - **Import**: Drag-and-drop CSV upload, header auto-mapping, row-by-row syntax & schema validation, interactive preview table, and batch commit.
  - **Export**: Instant CSV generation based on active filters.

### 3. Categories, Budgets & Rollover
- **Pre-Seeded & Custom Categories**: Housing, Food & Dining, Transport, Utilities, Healthcare, Shopping, Travel, Entertainment, Education, and Miscellaneous with custom hex colors and icons.
- **Monthly Budget Targets**: Configure overall targets and category-specific allowances.
- **Visual Alert Thresholds**:
  - `Normal`: < 80% of limit
  - `Approaching`: 80% - 99% of limit (amber warning badge & notification)
  - `Exceeded`: ≥ 100% of limit (red danger badge & notification)
- **Budget Rollover**: Optional carry-forward of unspent or overspent balances into subsequent months.

### 4. Automated Spending Intelligence & Suggestions
- **Algorithmic Analytics Engine**: Derives insights exclusively from real database telemetry (avoids invented/hallucinated insights when data is sparse).
- **Analysis Categories**:
  - **Spending Spikes**: Detects >20% increases in category expenditures compared to prior periods.
  - **Merchant Frequency**: Highlights repeat merchant micro-transactions compounding over time.
  - **Budget Run-Rate Risks**: Identifies categories consuming >85% of budget with significant billing cycle days remaining.
  - **Discretionary Ratio**: Flags when discretionary spending (Shopping, Entertainment, Travel) exceeds 35% of total spend.
- **Explainable Derivations**: Transparent mathematical rationale displayed on every insight card (*"How this suggestion was derived"*).
- **Feedback & Persistence**: Dismiss insights or mark them as helpful with database persistence.

### 5. Financial Reports & Statements
- **Comparative Statements**: Period-over-period variance analysis and net cashflow calculations.
- **Income vs. Expense Balance**: Cashflow bar chart benchmarking actual outflows against baseline income.
- **Tax Classification Split**: Clear breakdown of Personal versus Business expenditures for deductions.
- **Print & PDF Mode**: Clean, high-contrast dedicated `@media print` layout removing navigation elements for physical printing or PDF archival.

### 6. In-App Notifications
- **Notification Center**: Bell icon with real-time unread badge counter in the navigation bar.
- **Automated Alerts**: Threshold breach warnings, 3-day recurring bill due reminders, and spending spike alerts.
- **Notification Controls**: Mark single read, mark all read, or clear all.

### 7. Profile & User Access
- **Multi-Tenant Isolation**: Strict server-side authorization ensuring users only ever query or mutate their own records.
- **Multi-Currency Engine**: Dynamically format the entire UI into USD (`$`), EUR (`€`), GBP (`£`), INR (`₹`), CAD (`CA$`), AUD (`A$`), or JPY (`¥`).
- **Instant Demo Evaluation**: One-click *"Launch Demo Workspace"* button for DevOps reviewers without needing to register or enter credentials.

---

## Quickstart & Local Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v18.0.0 or higher (Tested on Node v20, v22, v24)
- [npm](https://www.npmjs.com/) v9.0.0 or higher

### 1. Clone the Repository
```bash
git clone https://github.com/jvssiddhartha/automated-expense-tracker.git
cd automated-expense-tracker
```

### 2. Install Dependencies
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Run Database Migrations & Seed Demo Data
```bash
cd ../backend
npm run seed
```
> **Default Demo Credentials:**
> - **Email**: `demo@expensetracker.io`
> - **Password**: `Password123!`

### 4. Start the Application Locally
In two separate terminals:

**Terminal 1 (Backend API on Port 5000):**
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend Web App on Port 3000):**
```bash
cd frontend
npm run dev
```

Open your browser at **[http://localhost:3000](http://localhost:3000)**.

---

## Docker & Container Deployment

### Local Docker Compose Orchestration

Run both the frontend (served via Nginx reverse proxy) and backend in isolated containers with health checks and persistent storage:

```bash
# Build and start all services
docker compose up --build -d

# Verify container status and health probes
docker compose ps

# View live application logs
docker compose logs -f
```

- **Frontend Application**: `http://localhost:3000`
- **Backend API & Health**: `http://localhost:5000/health`

To stop and remove containers:
```bash
docker compose down
```

---

## Kubernetes Deployment

Deploy to any Kubernetes cluster (Minikube, EKS, GKE, AKS, or K3s):

```bash
# 1. Apply namespace, configmap, and secrets
kubectl apply -f k8s/configmap.yaml

# 2. Deploy backend service and persistent volumes
kubectl apply -f k8s/backend-deployment.yaml

# 3. Deploy frontend service and ingress
kubectl apply -f k8s/frontend-deployment.yaml

# 4. Check pod and service status
kubectl get all -n expense-tracker
```

---

## Environment Variables Reference

Configure environment variables in `backend/.env` or via container environment mappings:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | HTTP listening port for Express backend |
| `NODE_ENV` | `development` | Environment mode (`development`, `production`, `test`) |
| `JWT_SECRET` | *(Random 32-char string)* | Symmetric key used to sign and verify authentication tokens |
| `JWT_EXPIRES_IN` | `7d` | Token expiry duration |
| `DB_PATH` | `./data/expense_tracker.sqlite`| Filesystem path to the SQLite database file |
| `CORS_ORIGIN` | `*` | Allowed CORS origins (comma-separated or `*`) |
| `MAX_FILE_SIZE_MB`| `5` | Maximum receipt/CSV upload size in megabytes |
| `RATE_LIMIT_WINDOW_MS`| `900000` | Rate limiter window in milliseconds (15 mins) |
| `RATE_LIMIT_MAX` | `1000` | Maximum requests permitted per IP in window |

---

## Automated Testing & CI Pipeline

The project includes an end-to-end integration and unit test suite covering health probes, authentication, expense CRUD, budget calculations, CSV validation, insights generation, and reporting:

```bash
cd backend
npm test
```

### GitHub Actions Pipeline
Every commit and pull request triggers `.github/workflows/ci.yml`:
1. **Backend Matrix Tests**: Executes migrations and Jest tests against Node 20.x and 22.x.
2. **Frontend Build Verification**: Validates Vite production bundling with zero warnings.
3. **Docker Build Validation**: Builds multi-stage Docker images to guarantee deployment readiness.

---

## API Reference Summary

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | No | Service telemetry, memory usage, uptime, and database ping |
| `POST` | `/api/auth/register` | No | Create user account and seed default categories |
| `POST` | `/api/auth/login` | No | Sign in and receive JWT token |
| `POST` | `/api/auth/demo` | No | One-click instant login to demo account |
| `GET` | `/api/auth/me` | Yes | Get authenticated user profile and settings |
| `PUT` | `/api/auth/profile` | Yes | Update currency, income baseline, notifications |
| `GET` | `/api/expenses` | Yes | Paginated, filtered, searchable transaction ledger |
| `POST` | `/api/expenses` | Yes | Record expense with automated budget alerts |
| `PUT` | `/api/expenses/:id` | Yes | Update expense record |
| `DELETE` | `/api/expenses/:id` | Yes | Delete expense record |
| `POST` | `/api/expenses/upload-receipt` | Yes | Upload receipt image/PDF |
| `POST` | `/api/expenses/import/preview` | Yes | Parse & validate CSV rows prior to import |
| `POST` | `/api/expenses/import/commit` | Yes | Batch insert validated CSV transactions |
| `GET` | `/api/expenses/export/csv` | Yes | Download filtered transactions as CSV |
| `GET` | `/api/budgets` | Yes | Monthly overall & category budget progress |
| `POST` | `/api/budgets` | Yes | Create or update budget target with rollover |
| `GET` | `/api/categories` | Yes | List user categories with spending totals |
| `POST` | `/api/categories` | Yes | Create custom category |
| `GET` | `/api/insights` | Yes | Get explainable algorithmic suggestions |
| `POST` | `/api/insights/:id/helpful` | Yes | Mark suggestion as helpful |
| `POST` | `/api/insights/:id/dismiss` | Yes | Dismiss suggestion |
| `GET` | `/api/reports/summary` | Yes | Period comparison, cashflow balance, and ledger |
| `GET` | `/api/notifications` | Yes | List notifications with unread count |
| `PUT` | `/api/notifications/read-all` | Yes | Mark all notifications as read |
| `GET` | `/api/recurring` | Yes | Scheduled recurring expenses |
| `POST` | `/api/recurring/:id/log-as-expense` | Yes | Log recurring bill as expense and advance due date |

---

## Troubleshooting & FAQ

1. **How do I reset the demo dataset to initial state?**
   Run `npm run seed` inside the `backend` directory. It re-migrates the database and repopulates the standard demo user transactions, budgets, insights, and categories.

2. **Can I change the currency format?**
   Yes. Go to **Settings & Profile** in the web app, select your preferred currency (USD, EUR, GBP, INR, CAD, AUD, JPY, CHF), and save. The entire UI and all reports will immediately format amounts with that currency.

3. **Where is data stored in Docker?**
   Data is preserved in the Docker named volume `expense_tracker_data` mounted at `/app/data/expense_tracker.sqlite`. Receipts are stored in `expense_tracker_uploads`.

---

## License

This project is licensed under the [MIT License](LICENSE).

DevOps deployment verified using Docker and Kubernetes.
CI workflow trigger test.

hello 
import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { CurrencyProvider } from './context/CurrencyContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import ExpenseModal from './components/ExpenseModal';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Budgets from './pages/Budgets';
import Insights from './pages/Insights';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import { api } from './services/api';

function MainApp() {
  const { isAuthenticated, isLoading } = useAuth();
  const [authView, setAuthView] = useState('login'); // 'login' or 'register'
  const [currentTab, setTab] = useState('dashboard');
  const [period, setPeriod] = useState('month');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Categories shared state
  const [categories, setCategories] = useState([]);

  // Expense modal state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState(null);

  const fetchCategories = async () => {
    if (!isAuthenticated) return;
    try {
      const data = await api.get('/categories');
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Failed to fetch categories', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchCategories();
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', color: '#ffffff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-block', width: '36px', height: '36px', border: '3px solid #334155', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '16px', fontSize: '0.9rem', color: '#94a3b8' }}>Initializing secure session...</p>
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return authView === 'login' ? (
      <Login onSwitchToRegister={() => setAuthView('register')} />
    ) : (
      <Register onSwitchToLogin={() => setAuthView('login')} />
    );
  }

  const handleOpenAddExpense = () => {
    setExpenseToEdit(null);
    setIsExpenseModalOpen(true);
  };

  const handleEditExpense = (expense) => {
    setExpenseToEdit(expense);
    setIsExpenseModalOpen(true);
  };

  const getPageTitle = () => {
    switch (currentTab) {
      case 'dashboard': return 'Executive Financial Dashboard';
      case 'expenses': return 'Expense Ledger & Transactions';
      case 'budgets': return 'Budgets, Categories & Schedules';
      case 'insights': return 'Automated Spending Intelligence';
      case 'reports': return 'Financial Analytics & Statements';
      case 'settings': return 'System Settings & Telemetry';
      default: return 'Expense Tracker';
    }
  };

  return (
    <div className="app-container">
      {/* Persistent / Responsive Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setTab={setTab}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      {/* Main Content Area */}
      <div className="main-content">
        <Navbar
          pageTitle={getPageTitle()}
          period={currentTab === 'dashboard' ? period : null}
          setPeriod={currentTab === 'dashboard' ? setPeriod : null}
          onOpenAddExpense={handleOpenAddExpense}
          setIsSidebarOpen={setIsSidebarOpen}
        />

        <main className="page-wrapper">
          {currentTab === 'dashboard' && (
            <Dashboard
              period={period}
              setTab={setTab}
              onOpenAddExpense={handleOpenAddExpense}
            />
          )}

          {currentTab === 'expenses' && (
            <Expenses
              onOpenAddExpense={handleOpenAddExpense}
              onEditExpense={handleEditExpense}
              categories={categories}
            />
          )}

          {currentTab === 'budgets' && (
            <Budgets
              categories={categories}
              onCategoriesUpdated={fetchCategories}
            />
          )}

          {currentTab === 'insights' && (
            <Insights />
          )}

          {currentTab === 'reports' && (
            <Reports
              categories={categories}
            />
          )}

          {currentTab === 'settings' && (
            <Settings />
          )}
        </main>
      </div>

      {/* Universal Expense Add/Edit Modal */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        expenseToEdit={expenseToEdit}
        categories={categories}
        onSaved={() => {
          fetchCategories();
          // Dispatch custom event to let active page reload data smoothly
          window.dispatchEvent(new Event('expense:updated'));
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <CurrencyProvider>
      <MainApp />
    </CurrencyProvider>
  );
}

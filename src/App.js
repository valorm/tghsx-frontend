import React from 'react';
import { Routes, Route } from 'react-router-dom';

// Import the page components
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import AdminPage from './pages/AdminPage';
import TransactionHistoryPage from './pages/TransactionHistoryPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/history" element={<TransactionHistoryPage />} />
    </Routes>
  );
}

export default App;

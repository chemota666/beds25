import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Guests } from './pages/Guests';
import { Properties } from './pages/Properties';
import { Owners } from './pages/Owners';
import { Managers } from './pages/Managers';
import { Reservations } from './pages/Reservations';
import { Analytics } from './pages/Analytics';
import { Incidents } from './pages/Incidents';
import { Invoices } from './pages/Invoices';
import { Settings } from './pages/Settings';
import { Notes } from './pages/Notes';
import { Login } from './pages/Login';
import { db } from './services/db';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!db.getAuthUser());

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <Router>
      <Layout onLogout={() => setIsAuthenticated(false)}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/guests" element={<Guests />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/owners" element={<Owners />} />
          <Route path="/managers" element={<Managers />} />
          <Route path="/reservas" element={<Reservations />} />
          <Route path="/facturas" element={<Invoices />} />
          <Route path="/incidencias" element={<Incidents />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/notas" element={<Notes />} />
          {db.isAdmin() && <Route path="/settings" element={<Settings />} />}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;

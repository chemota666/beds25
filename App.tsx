
import React from 'react';
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

const App: React.FC = () => {
  // Login deshabilitado temporalmente: cargamos directamente el Router
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/guests" element={<Guests />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/owners" element={<Owners />} />
          <Route path="/managers" element={<Managers />} />
          <Route path="/reservas" element={<Reservations />} />
          <Route path="/incidencias" element={<Incidents />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;

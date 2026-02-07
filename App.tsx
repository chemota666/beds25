
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Guests } from './pages/Guests';
import { Properties } from './pages/Properties';
import { Owners } from './pages/Owners';
import { Reservations } from './pages/Reservations';

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
          <Route path="/reservations" element={<Reservations />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;

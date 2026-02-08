
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { db } from '../services/db';

const SidebarLink: React.FC<{ to: string, icon: React.ReactNode, label: string, collapsed?: boolean, onClick?: () => void }> = ({ to, icon, label, collapsed, onClick }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link 
      to={to} 
      onClick={onClick}
      className={`w-full flex items-center ${collapsed ? 'justify-center' : 'space-x-3'} p-3 rounded-lg transition-colors ${
        isActive ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <span className="w-6 h-6 flex items-center justify-center">{icon}</span>
      {!collapsed && <span className="font-medium">{label}</span>}
    </Link>
  );
};

const SidebarSubLink: React.FC<{ to: string, label: string, onClick?: () => void }> = ({ to, label, onClick }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
        isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <span className="ml-1">{label}</span>
    </Link>
  );
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = db.getAuthUser() || 'Admin';
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isConfigRoute = ['/properties', '/guests', '/managers', '/owners'].includes(location.pathname);

  useEffect(() => {
    if (isConfigRoute) setIsConfigOpen(true);
  }, [isConfigRoute]);

  const handleLogout = () => {
    db.setAuthUser(null);
    window.location.reload();
  };

  const handleMobileClose = () => setIsMobileMenuOpen(false);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={handleMobileClose}
        />
      )}
      {/* Sidebar */}
      <aside className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} bg-white border-r border-gray-200 flex flex-col ${isSidebarCollapsed ? 'p-4' : 'p-6'} fixed inset-y-0 left-0 z-50 overflow-y-auto transition-all duration-200 md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:flex`}>
        <div className={`mb-10 ${isSidebarCollapsed ? 'px-0' : 'px-2'} flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} gap-2`}>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
            </div>
            {!isSidebarCollapsed && <h1 className="text-xl font-bold text-gray-800">Beds25</h1>}
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(prev => !prev)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            aria-label={isSidebarCollapsed ? 'Expandir menú' : 'Minimizar menú'}
            title={isSidebarCollapsed ? 'Expandir menú' : 'Minimizar menú'}
          >
            <svg className={`w-5 h-5 transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
        </div>
        
        <nav className="flex-1 space-y-2">
          <SidebarLink 
            to="/" 
            label="Calendario" 
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 2v3m8-3v3M3.5 9h17M5 5h14a2 2 0 012 2v11a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 13h4"></path></svg>}
            collapsed={isSidebarCollapsed}
            onClick={handleMobileClose}
          />
          <SidebarLink
            to="/reservas"
            label="Reservas"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5h7a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V8l4-3z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5v3h-3m3 5h6m-6 4h6"></path></svg>}
            collapsed={isSidebarCollapsed}
            onClick={handleMobileClose}
          />
          <SidebarLink
            to="/incidencias"
            label="Incidencias"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.29 3.86l-6.2 10.74A2 2 0 005.83 18h12.34a2 2 0 001.74-3.4l-6.2-10.74a2 2 0 00-3.42 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v4m0 4h.01"></path></svg>}
            collapsed={isSidebarCollapsed}
            onClick={handleMobileClose}
          />
          <hr className="my-4 border-gray-100" />
          <SidebarLink
            to="/analytics"
            label="Dashboard"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a2 2 0 012-2h4a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 11a2 2 0 012-2h2a2 2 0 012 2v8a2 2 0 01-2 2h-2a2 2 0 01-2-2v-8z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>}
            collapsed={isSidebarCollapsed}
            onClick={handleMobileClose}
          />
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setIsConfigOpen(prev => !prev)}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} p-3 rounded-lg transition-colors ${
                isConfigRoute ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className={`flex items-center ${isSidebarCollapsed ? '' : 'space-x-3'}`}>
                <span className="w-6 h-6 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9a3 3 0 100 6 3 3 0 000-6z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.4 15a1 1 0 00.2 1.1l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1 1 0 00-1.1-.2 1 1 0 00-.6.9V20a2 2 0 01-4 0v-.2a1 1 0 00-.6-.9 1 1 0 00-1.1.2l-.1.1a2 2 0 01-2.8-2.8l.1-.1a1 1 0 00.2-1.1 1 1 0 00-.9-.6H4a2 2 0 010-4h.2a1 1 0 00.9-.6 1 1 0 00-.2-1.1l-.1-.1a2 2 0 012.8-2.8l.1.1a1 1 0 001.1.2 1 1 0 00.6-.9V4a2 2 0 014 0v.2a1 1 0 00.6.9 1 1 0 001.1-.2l.1-.1a2 2 0 012.8 2.8l-.1.1a1 1 0 00-.2 1.1 1 1 0 00.9.6H20a2 2 0 010 4h-.2a1 1 0 00-.4.1z"></path></svg>
                </span>
                {!isSidebarCollapsed && <span className="font-medium">Configuración</span>}
              </span>
              {!isSidebarCollapsed && (
                <svg className={`w-4 h-4 transition-transform ${isConfigOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              )}
            </button>
            {!isSidebarCollapsed && isConfigOpen && (
              <div className="mt-2 ml-7 space-y-1">
                <SidebarSubLink to="/properties" label="Inmuebles" onClick={handleMobileClose} />
                <SidebarSubLink to="/guests" label="Huéspedes" onClick={handleMobileClose} />
                <SidebarSubLink to="/managers" label="Gestores" onClick={handleMobileClose} />
                <SidebarSubLink to="/owners" label="Propietarios" onClick={handleMobileClose} />
              </div>
            )}
          </div>
        </nav>
        
        <div className="mt-auto border-t border-gray-100 pt-6">
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} px-2`}>
            <div className={`flex items-center ${isSidebarCollapsed ? '' : 'space-x-3'}`}>
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                 <span className="font-bold uppercase">{currentUser[0]}</span>
              </div>
              {!isSidebarCollapsed && (
                <div>
                  <p className="text-sm font-semibold capitalize">{currentUser}</p>
                  <p className="text-xs text-gray-500">Gestor</p>
                </div>
              )}
            </div>
            {!isSidebarCollapsed && (
              <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 ${isSidebarCollapsed ? 'md:ml-16' : 'md:ml-64'} min-h-screen transition-all duration-200`}>
        <div className="md:hidden sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="Abrir menú"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span className="text-sm font-semibold text-gray-700">Beds25</span>
          <div className="w-8" />
        </div>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

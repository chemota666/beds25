import React, { useState, useEffect } from 'react';
import { EmailService } from '../services/email';
import { PaymentService } from '../services/payments';
import { mysqlApi } from '../services/mysqlApi';

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'email' | 'payments' | 'notifications'>('users');
  const [users, setUsers] = useState<Array<{ id: string; username: string; role: string }>>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<{ id?: string; username: string; password: string; role: string } | null>(null);
  const [userError, setUserError] = useState('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilters, setAuditFilters] = useState<{ username: string; table: string; from: string; to: string }>({ username: '', table: '', from: '', to: '' });
  const [emailConfig, setEmailConfig] = useState({ configured: false, provider: 'Not configured' });
  const [paymentConfig, setPaymentConfig] = useState({ configured: false, provider: 'Not configured' });
  const [loading, setLoading] = useState(true);
  const [testEmail, setTestEmail] = useState('');
  const [testEmailStatus, setTestEmailStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [notificationSettings, setNotificationSettings] = useState({
    reservationConfirmation: true,
    paymentReminder: true,
    invoiceGeneration: true,
    overbookingAlert: true,
  });

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const data = await mysqlApi.getUsers();
      setUsers(data);
    } catch (err: any) {
      console.error('Error loading users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  const loadAuditLogs = async (filters?: { username?: string; table?: string; from?: string; to?: string }) => {
    setAuditLoading(true);
    try {
      const f = filters || auditFilters;
      const data = await mysqlApi.getAuditLogs({
        username: f.username || undefined,
        table: f.table || undefined,
        from: f.from || undefined,
        to: f.to || undefined,
        limit: 200
      });
      setAuditLogs(data);
    } catch (err: any) {
      console.error('Error loading audit logs:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    const loadConfiguration = async () => {
      setLoading(true);
      const [emailStatus, paymentStatus] = await Promise.all([
        EmailService.verifyConfiguration(),
        PaymentService.verifyConfiguration()
      ]);

      setEmailConfig(emailStatus);
      setPaymentConfig(paymentStatus);
      setLoading(false);
    };

    loadConfiguration();

    const savedNotif = localStorage.getItem('notificationSettings');
    if (savedNotif) {
      try { setNotificationSettings(JSON.parse(savedNotif)); } catch {}
    }
  }, []);

  const handleTestEmail = async () => {
    if (!testEmail) return;

    setTestEmailStatus('loading');
    try {
      const result = await EmailService.sendCustomEmail(
        testEmail,
        'Test Email from Beds25',
        '<h1>Testing email configuration</h1><p>If you received this email, your email setup is working correctly!</p>'
      );
      setTestEmailStatus(result.success ? 'success' : 'error');
    } catch {
      setTestEmailStatus('error');
    }
    setTimeout(() => setTestEmailStatus('idle'), 3000);
  };

  const handleSaveNotifications = () => {
    // Guardar preferencias en localStorage
    localStorage.setItem('notificationSettings', JSON.stringify(notificationSettings));
    alert('✅ Preferencias guardadas correctamente');
  };

  const handleCancelNotifications = () => {
    // Restaurar desde localStorage
    const saved = localStorage.getItem('notificationSettings');
    if (saved) {
      setNotificationSettings(JSON.parse(saved));
    } else {
      setNotificationSettings({
        reservationConfirmation: true,
        paymentReminder: true,
        invoiceGeneration: true,
        overbookingAlert: true,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">⚙️ Configuración</h1>
          <p className="text-sm text-gray-500">Integra servicios externos y configura notificaciones.</p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex border-b border-gray-100 bg-white rounded-t-2xl overflow-hidden">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
            activeTab === 'users'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Usuarios
        </button>
        <button
          onClick={() => { setActiveTab('logs'); if (auditLogs.length === 0) loadAuditLogs(); }}
          className={`flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
            activeTab === 'logs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Registro
        </button>
        <button
          onClick={() => setActiveTab('email')}
          className={`flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
            activeTab === 'email'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          📧 Email
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
            activeTab === 'payments'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          💳 Pagos
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
            activeTab === 'notifications'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          🔔 Notificaciones
        </button>
      </div>

      <div className="bg-white rounded-b-2xl shadow-sm border border-gray-100 p-8">
        {/* TAB: USERS */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900">Gestion de Usuarios</h3>
              <button
                onClick={() => setEditingUser({ username: '', password: '', role: 'gestor' })}
                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 text-sm"
              >
                + Nuevo Usuario
              </button>
            </div>

            {userError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{userError}</div>
            )}

            {editingUser && (
              <div className="p-6 bg-blue-50 rounded-2xl border border-blue-200 space-y-4">
                <h4 className="font-bold text-blue-900">
                  {editingUser.id ? 'Editar Usuario' : 'Nuevo Usuario'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Usuario</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"
                      value={editingUser.username}
                      onChange={e => setEditingUser({ ...editingUser, username: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                      {editingUser.id ? 'Nueva contraseña (vacío = no cambiar)' : 'Contraseña'}
                    </label>
                    <input
                      type="password"
                      className="w-full bg-white border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"
                      value={editingUser.password}
                      onChange={e => setEditingUser({ ...editingUser, password: e.target.value })}
                      placeholder={editingUser.id ? '••••••••' : ''}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Rol</label>
                    <select
                      className="w-full bg-white border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"
                      value={editingUser.role}
                      onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                    >
                      <option value="admin">Admin</option>
                      <option value="gestor">Gestor</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setEditingUser(null); setUserError(''); }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      setUserError('');
                      try {
                        if (editingUser.id) {
                          const updateData: any = { username: editingUser.username, role: editingUser.role };
                          if (editingUser.password) updateData.password = editingUser.password;
                          await mysqlApi.updateUser(editingUser.id, updateData);
                        } else {
                          if (!editingUser.username || !editingUser.password) {
                            setUserError('Usuario y contraseña son requeridos');
                            return;
                          }
                          await mysqlApi.createUser({
                            username: editingUser.username,
                            password: editingUser.password,
                            role: editingUser.role
                          });
                        }
                        setEditingUser(null);
                        await loadUsers();
                      } catch (err: any) {
                        setUserError(err.message || 'Error al guardar usuario');
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 text-sm"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-6 py-3 font-bold text-gray-500 uppercase text-xs">Usuario</th>
                    <th className="px-6 py-3 font-bold text-gray-500 uppercase text-xs">Rol</th>
                    <th className="px-6 py-3 font-bold text-gray-500 uppercase text-xs text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium capitalize">{user.username}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                          user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => setEditingUser({ id: user.id, username: user.username, password: '', role: user.role })}
                          className="text-blue-600 hover:text-blue-800 font-bold text-xs"
                        >
                          Editar
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Eliminar usuario ${user.username}?`)) return;
                            try {
                              await mysqlApi.deleteUser(user.id);
                              await loadUsers();
                            } catch (err: any) {
                              setUserError(err.message || 'Error al eliminar');
                            }
                          }}
                          className="text-red-500 hover:text-red-700 font-bold text-xs"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-gray-400">
                        {usersLoading ? 'Cargando...' : 'No hay usuarios'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: LOGS */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900">Registro de Actividad</h3>
              <button
                onClick={() => loadAuditLogs()}
                disabled={auditLoading}
                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 text-sm disabled:opacity-50"
              >
                {auditLoading ? 'Cargando...' : 'Actualizar'}
              </button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Usuario</label>
                <select
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={auditFilters.username}
                  onChange={e => setAuditFilters({ ...auditFilters, username: e.target.value })}
                >
                  <option value="">Todos</option>
                  {users.map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Tabla</label>
                <select
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={auditFilters.table}
                  onChange={e => setAuditFilters({ ...auditFilters, table: e.target.value })}
                >
                  <option value="">Todas</option>
                  <option value="reservations">Reservas</option>
                  <option value="guests">Huéspedes</option>
                  <option value="properties">Inmuebles</option>
                  <option value="owners">Propietarios</option>
                  <option value="managers">Gestores</option>
                  <option value="incidents">Incidencias</option>
                  <option value="invoices">Facturas</option>
                  <option value="users">Usuarios</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Desde</label>
                <input
                  type="date"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={auditFilters.from}
                  onChange={e => setAuditFilters({ ...auditFilters, from: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Hasta</label>
                <input
                  type="date"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={auditFilters.to}
                  onChange={e => setAuditFilters({ ...auditFilters, to: e.target.value })}
                />
              </div>
            </div>
            <button
              onClick={() => loadAuditLogs(auditFilters)}
              className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 text-sm"
            >
              Filtrar
            </button>

            {/* Log table */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-4 py-3 font-bold text-gray-500 uppercase text-xs whitespace-nowrap">Fecha</th>
                      <th className="px-4 py-3 font-bold text-gray-500 uppercase text-xs">Usuario</th>
                      <th className="px-4 py-3 font-bold text-gray-500 uppercase text-xs">Acción</th>
                      <th className="px-4 py-3 font-bold text-gray-500 uppercase text-xs">Tabla</th>
                      <th className="px-4 py-3 font-bold text-gray-500 uppercase text-xs">ID Registro</th>
                      <th className="px-4 py-3 font-bold text-gray-500 uppercase text-xs">Descripción</th>
                      <th className="px-4 py-3 font-bold text-gray-500 uppercase text-xs">Detalles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log: any) => (
                      <tr key={log.id} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString('es-ES') : '-'}
                        </td>
                        <td className="px-4 py-3 font-medium capitalize">{log.username}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                            log.action === 'INSERT' ? 'bg-green-100 text-green-700' :
                            log.action === 'UPDATE' ? 'bg-yellow-100 text-yellow-700' :
                            log.action === 'DELETE' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {log.action === 'INSERT' ? 'Crear' : log.action === 'UPDATE' ? 'Editar' : log.action === 'DELETE' ? 'Eliminar' : log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">{log.tableName}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{log.recordId || '-'}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{log.description || '-'}</td>
                        <td className="px-4 py-3">
                          {(log.oldValues || log.newValues) && (
                            <details className="text-xs">
                              <summary className="cursor-pointer text-blue-600 font-bold">Ver</summary>
                              <div className="mt-2 space-y-1 max-w-xs">
                                {log.oldValues && (
                                  <div>
                                    <span className="font-bold text-red-600">Anterior:</span>
                                    <pre className="bg-gray-50 p-2 rounded text-[10px] overflow-x-auto max-h-32 overflow-y-auto">
                                      {typeof log.oldValues === 'string' ? log.oldValues : JSON.stringify(log.oldValues, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {log.newValues && (
                                  <div>
                                    <span className="font-bold text-green-600">Nuevo:</span>
                                    <pre className="bg-gray-50 p-2 rounded text-[10px] overflow-x-auto max-h-32 overflow-y-auto">
                                      {typeof log.newValues === 'string' ? log.newValues : JSON.stringify(log.newValues, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </details>
                          )}
                        </td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                          {auditLoading ? 'Cargando...' : 'No hay registros de actividad'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: EMAIL */}
        {activeTab === 'email' && (
          <div className="space-y-6">
            <div className="p-6 bg-blue-50 rounded-2xl border border-blue-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-black text-blue-900">Configuración de Email</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    {emailConfig.configured
                      ? `✅ Email configurado con ${emailConfig.provider}`
                      : '❌ Email no configurado'}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-lg font-bold text-xs ${
                  emailConfig.configured
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {emailConfig.configured ? 'ACTIVO' : 'INACTIVO'}
                </span>
              </div>

              <div className="mt-6 space-y-3">
                <p className="text-sm text-gray-600">
                  Para configurar emails, necesitas establecer las siguientes variables de entorno:
                </p>
                <div className="bg-white rounded-xl p-4 font-mono text-[10px] space-y-1 overflow-x-auto">
                  <div className="text-gray-700">EMAIL_PROVIDER=gmail</div>
                  <div className="text-gray-700">EMAIL_USER=your-email@gmail.com</div>
                  <div className="text-gray-700">EMAIL_PASSWORD=your-app-password</div>
                  <div className="text-gray-400 italic">o para SendGrid:</div>
                  <div className="text-gray-700">SENDGRID_API_KEY=sk_test_...</div>
                </div>
              </div>

              {emailConfig.configured && (
                <div className="mt-6 space-y-4">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                    Enviar email de prueba
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="email"
                      placeholder="tu-email@ejemplo.com"
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-medium text-gray-800 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                      value={testEmail}
                      onChange={e => setTestEmail(e.target.value)}
                    />
                    <button
                      onClick={handleTestEmail}
                      disabled={!testEmail || testEmailStatus === 'loading'}
                      className={`px-6 py-3 rounded-xl font-bold text-white transition-all ${
                        testEmailStatus === 'loading'
                          ? 'bg-gray-400'
                          : testEmailStatus === 'success'
                          ? 'bg-green-600'
                          : testEmailStatus === 'error'
                          ? 'bg-red-600'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {testEmailStatus === 'loading' && '⏳ Enviando...'}
                      {testEmailStatus === 'success' && '✅ Enviado'}
                      {testEmailStatus === 'error' && '❌ Error'}
                      {testEmailStatus === 'idle' && '📧 Enviar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: PAYMENTS */}
        {activeTab === 'payments' && (
          <div className="space-y-6">
            <div className="p-6 bg-green-50 rounded-2xl border border-green-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-black text-green-900">Integración de Pagos</h3>
                  <p className="text-sm text-green-700 mt-1">
                    {paymentConfig.configured
                      ? `✅ Pagos configurados con ${paymentConfig.provider}`
                      : '❌ Pagos no configurados'}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-lg font-bold text-xs ${
                  paymentConfig.configured
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {paymentConfig.configured ? 'ACTIVO' : 'INACTIVO'}
                </span>
              </div>

              <div className="mt-6 space-y-3">
                <p className="text-sm text-gray-600">
                  Para integrar pagos con Stripe, necesitas:
                </p>
                <div className="bg-white rounded-xl p-4 font-mono text-[10px] space-y-1 overflow-x-auto">
                  <div className="text-gray-700">STRIPE_PUBLISHABLE_KEY=pk_live_...</div>
                  <div className="text-gray-700">STRIPE_SECRET_KEY=sk_live_...</div>
                  <div className="text-gray-700">STRIPE_WEBHOOK_SECRET=whsec_...</div>
                </div>

                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-xs text-blue-700 font-medium">
                    📌 <strong>Tip:</strong> Obtén tus claves en <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="underline font-bold">dashboard.stripe.com</a>
                  </p>
                </div>
              </div>

              {paymentConfig.configured && (
                <div className="mt-6 p-4 bg-green-100 border border-green-300 rounded-xl">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-green-700" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm font-bold text-green-700">Sistema de pagos listo para usar</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div className="p-6 bg-purple-50 rounded-2xl border border-purple-200">
              <h3 className="text-lg font-black text-purple-900">Preferencias de Notificaciones</h3>
              <p className="text-sm text-purple-700 mt-1">Controla qué emails se envían automáticamente</p>

              <div className="mt-6 space-y-4">
                {[
                  {
                    key: 'reservationConfirmation',
                    label: 'Confirmación de Reserva',
                    description: 'Enviar email cuando se crea una nueva reserva'
                  },
                  {
                    key: 'paymentReminder',
                    label: 'Recordatorio de Pago',
                    description: 'Recordar al huésped sobre pagos pendientes'
                  },
                  {
                    key: 'invoiceGeneration',
                    label: 'Generación de Factura',
                    description: 'Enviar factura al cliente cuando se genera'
                  },
                  {
                    key: 'overbookingAlert',
                    label: 'Alerta de Sobocupación',
                    description: 'Notificar sobre conflictos de fechas'
                  }
                ].map((notification) => (
                  <div key={notification.key} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:border-purple-200 transition-all">
                    <div>
                      <p className="font-bold text-gray-800">{notification.label}</p>
                      <p className="text-xs text-gray-500 mt-1">{notification.description}</p>
                    </div>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings[notification.key as keyof typeof notificationSettings]}
                        onChange={e => setNotificationSettings({
                          ...notificationSettings,
                          [notification.key]: e.target.checked
                        })}
                        className="w-5 h-5 text-purple-600 rounded focus:ring-0 border-gray-300"
                      />
                    </label>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex gap-3">
                <button 
                  onClick={handleCancelNotifications}
                  className="px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveNotifications}
                  className="px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-all"
                >
                  Guardar Preferencias
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

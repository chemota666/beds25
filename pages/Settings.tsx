import React, { useState, useEffect } from 'react';
import { EmailService } from '../services/email';
import { PaymentService } from '../services/payments';

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'email' | 'payments' | 'notifications'>('email');
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

  useEffect(() => {
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
  }, []);

  const handleTestEmail = async () => {
    if (!testEmail) return;

    setTestEmailStatus('loading');
    const result = await EmailService.sendCustomEmail(
      testEmail,
      'Test Email from Beds25',
      '<h1>Testing email configuration</h1><p>If you received this email, your email setup is working correctly!</p>'
    );

    if (result.success) {
      setTestEmailStatus('success');
      setTimeout(() => setTestEmailStatus('idle'), 3000);
    } else {
      setTestEmailStatus('error');
      setTimeout(() => setTestEmailStatus('idle'), 3000);
    }
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

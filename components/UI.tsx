import React from 'react';

/**
 * Componente para mostrar alertas/toasts de error
 */
export const Alert: React.FC<{
  type: 'error' | 'success' | 'warning' | 'info';
  message: string;
  onClose?: () => void;
  autoClose?: boolean;
}> = ({ type, message, onClose, autoClose = true }) => {
  React.useEffect(() => {
    if (autoClose && onClose) {
      const timer = setTimeout(onClose, 4000);
      return () => clearTimeout(timer);
    }
  }, [autoClose, onClose]);

  const colors = {
    error: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  const icons = {
    error: '❌',
    success: '✅',
    warning: '⚠️',
    info: 'ℹ️'
  };

  return (
    <div className={`border rounded-lg p-4 mb-4 flex items-start gap-3 ${colors[type]}`}>
      <span className="text-lg">{icons[type]}</span>
      <div className="flex-1">
        <p className="font-medium">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-lg opacity-60 hover:opacity-100"
        >
          ✕
        </button>
      )}
    </div>
  );
};

/**
 * Componente para mostrar errores de validación
 */
export const ValidationErrors: React.FC<{
  errors: string[];
}> = ({ errors }) => {
  if (errors.length === 0) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
      <h3 className="font-semibold text-red-800 mb-2">Errores de validación:</h3>
      <ul className="list-disc list-inside text-red-700 space-y-1">
        {errors.map((error, idx) => (
          <li key={idx}>{error}</li>
        ))}
      </ul>
    </div>
  );
};

/**
 * Componente de loading spinner
 */
export const LoadingSpinner: React.FC<{
  message?: string;
}> = ({ message = 'Cargando...' }) => (
  <div className="flex flex-col items-center justify-center py-8">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    {message && <p className="mt-4 text-gray-600">{message}</p>}
  </div>
);

/**
 * Componente para estado vacío
 */
export const EmptyState: React.FC<{
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}> = ({ title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-12 text-gray-500">
    <div className="text-6xl mb-4">📭</div>
    <h3 className="text-lg font-semibold mb-2">{title}</h3>
    {description && <p className="mb-4">{description}</p>}
    {action && (
      <button
        onClick={action.onClick}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        {action.label}
      </button>
    )}
  </div>
);

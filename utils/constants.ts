/**
 * Constantes globales de la aplicación
 * Centraliza valores reutilizables
 */

// API Configuration
export const API_CONFIG = {
  BASE_URL: '/api',
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000
};

// Storage Keys (LocalStorage)
export const STORAGE_KEYS = {
  PROPERTIES: 'roomflow_properties',
  ROOMS: 'roomflow_rooms',
  RESERVATIONS: 'roomflow_reservations',
  GUESTS: 'roomflow_guests',
  OWNERS: 'roomflow_owners',
  MANAGERS: 'roomflow_managers',
  INVOICES: 'roomflow_invoices',
  LAST_RES_NUMBER: 'roomflow_last_res_number',
  LAST_INV_NUMBER: 'roomflow_last_inv_number',
  AUTH_USER: 'roomflow_auth_user'
} as const;

// Payment Methods
export const PAYMENT_METHODS = {
  PENDING: 'pending',
  TRANSFER: 'transfer',
  CASH: 'cash'
} as const;

// Genders
export const GENDERS = {
  MALE: 'Masculino',
  FEMALE: 'Femenino',
  OTHER: 'Otro'
} as const;

// Date Formats
export const DATE_FORMATS = {
  ISO: 'YYYY-MM-DD',
  EU: 'DD/MM/YYYY',
  LONG: 'DD MMMM YYYY'
} as const;

// Validation Rules
export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 8,
  MIN_RESERVATION_NIGHTS: 1,
  MAX_RESERVATION_NIGHTS: 365,
  MAX_FILE_SIZE_MB: 10,
  ALLOWED_FILE_TYPES: ['application/pdf', 'image/jpeg', 'image/png']
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  CONNECTION_REFUSED: 'No se puede conectar al servidor',
  INVALID_DATA: 'Datos inválidos',
  DUPLICATE_RECORD: 'Este registro ya existe',
  NOT_FOUND: 'Registro no encontrado',
  UNAUTHORIZED: 'No autorizado',
  SERVER_ERROR: 'Error del servidor',
  VALIDATION_ERROR: 'Error de validación'
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  SAVED: 'Guardado correctamente',
  DELETED: 'Eliminado correctamente',
  CREATED: 'Creado correctamente',
  UPDATED: 'Actualizado correctamente'
} as const;

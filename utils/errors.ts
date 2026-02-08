/**
 * Utilidades para manejo de errores centralizado
 */

import { logger } from './logger';

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} no encontrado`, 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'No autorizado') {
    super('UNAUTHORIZED', message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
    this.name = 'ConflictError';
  }
}

/**
 * Wrapper para manejar errores en async functions
 */
export const asyncHandler = (fn: Function) => {
  return async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      logger.error('asyncHandler', 'Error en operación async', error);
      throw error;
    }
  };
};

/**
 * Transforma errores en respuestas consistentes
 */
export const handleError = (error: any, module: string): { message: string; code: string; statusCode: number } => {
  logger.error(module, 'Error capturado', error);

  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'INTERNAL_ERROR',
      statusCode: 500
    };
  }

  return {
    message: 'Error desconocido',
    code: 'UNKNOWN_ERROR',
    statusCode: 500
  };
};

/**
 * Retry con exponential backoff
 */
export const retryAsync = async <T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delayMs: number = 1000,
  module: string = 'unknown'
): Promise<T> => {
  let lastError: any;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const delay = delayMs * Math.pow(2, i);
      logger.warn(module, `Reintentando en ${delay}ms (intento ${i + 1}/${retries})`, { error });
      await new Promise(r => setTimeout(r, delay));
    }
  }

  logger.error(module, `Se agotaron los reintentos (${retries})`, lastError);
  throw lastError;
};

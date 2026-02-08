/**
 * Servicio HTTP mejorado con retry automático, logging y timeout
 */

import { logger } from '../utils/logger';
import { retryAsync, AppError } from '../utils/errors';
import { API_CONFIG } from '../utils/constants';

interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  cache?: 'default' | 'no-cache' | 'reload' | 'force-cache';
}

class HttpService {
  private baseUrl = API_CONFIG.BASE_URL;
  private defaultTimeout = API_CONFIG.TIMEOUT;
  private defaultRetries = API_CONFIG.RETRY_ATTEMPTS;

  /**
   * Realiza un fetch con timeout
   */
  private async fetchWithTimeout(
    url: string,
    options: FetchOptions = {}
  ): Promise<Response> {
    const timeout = options.timeout || this.defaultTimeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * GET con retry automático
   */
  async get<T = any>(path: string, options: FetchOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const retries = options.retries || this.defaultRetries;

    logger.debug('HttpService', `GET ${url}`);

    return retryAsync(
      async () => {
        const response = await this.fetchWithTimeout(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          ...options
        });

        if (!response.ok) {
          throw new AppError(
            'HTTP_ERROR',
            `GET ${path} falló con status ${response.status}`,
            response.status
          );
        }

        const data = await response.json();
        logger.debug('HttpService', `GET ${path} exitoso`, { itemsCount: Array.isArray(data) ? data.length : 1 });
        return data;
      },
      retries,
      API_CONFIG.RETRY_DELAY,
      'HttpService'
    );
  }

  /**
   * POST con retry automático
   */
  async post<T = any>(path: string, data: any, options: FetchOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const retries = options.retries ?? 1; // POST normalmente no se reintenta

    logger.debug('HttpService', `POST ${url}`, { data });

    return retryAsync(
      async () => {
        const response = await this.fetchWithTimeout(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          ...options
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new AppError(
            'HTTP_ERROR',
            `POST ${path} falló: ${error.error || response.statusText}`,
            response.status,
            error
          );
        }

        const result = await response.json();
        logger.debug('HttpService', `POST ${path} exitoso`, { result });
        return result;
      },
      retries,
      API_CONFIG.RETRY_DELAY,
      'HttpService'
    );
  }

  /**
   * PUT con retry automático
   */
  async put<T = any>(path: string, data: any, options: FetchOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const retries = options.retries ?? 1;

    logger.debug('HttpService', `PUT ${url}`, { data });

    return retryAsync(
      async () => {
        const response = await this.fetchWithTimeout(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          ...options
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new AppError(
            'HTTP_ERROR',
            `PUT ${path} falló: ${error.error || response.statusText}`,
            response.status,
            error
          );
        }

        const result = await response.json();
        logger.debug('HttpService', `PUT ${path} exitoso`);
        return result;
      },
      retries,
      API_CONFIG.RETRY_DELAY,
      'HttpService'
    );
  }

  /**
   * DELETE con retry automático
   */
  async delete<T = any>(path: string, options: FetchOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const retries = options.retries ?? 1;

    logger.debug('HttpService', `DELETE ${url}`);

    return retryAsync(
      async () => {
        const response = await this.fetchWithTimeout(url, {
          method: 'DELETE',
          ...options
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new AppError(
            'HTTP_ERROR',
            `DELETE ${path} falló: ${error.error || response.statusText}`,
            response.status,
            error
          );
        }

        const result = await response.json().catch(() => ({}));
        logger.debug('HttpService', `DELETE ${path} exitoso`);
        return result;
      },
      retries,
      API_CONFIG.RETRY_DELAY,
      'HttpService'
    );
  }
}

export const httpService = new HttpService();

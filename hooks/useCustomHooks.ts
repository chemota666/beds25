/**
 * Hooks personalizados para operaciones comunes
 */

import React, { useState, useCallback, useEffect } from 'react';
import { logger } from '../utils/logger';

/**
 * Hook para cargar datos con estado de carga y error
 */
export const useAsync = <T,>(
  asyncFunction: () => Promise<T>,
  immediate: boolean = true,
  dependencies: any[] = []
) => {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async () => {
    setStatus('pending');
    setValue(null);
    setError(null);
    try {
      const response = await asyncFunction();
      setValue(response);
      setStatus('success');
      return response;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setStatus('error');
      logger.error('useAsync', 'Error en operación async', err);
    }
  }, dependencies);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return { execute, status, value, error, loading: status === 'pending' };
};

/**
 * Hook para formularios con validación
 */
export const useForm = <T extends Record<string, any>>(
  initialValues: T,
  onSubmit: (values: T) => Promise<void>,
  validate?: (values: T) => Record<string, string>
) => {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = useCallback((e: React.ChangeEvent<any>) => {
    const { name, value, type, checked } = e.target;
    setValues(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  }, []);

  const handleBlur = useCallback((e: React.FocusEvent<any>) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));

    if (validate) {
      const validationErrors = validate(values);
      setErrors(prev => ({
        ...prev,
        [name]: validationErrors[name] || ''
      }));
    }
  }, [values, validate]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (validate) {
      const validationErrors = validate(values);
      setErrors(validationErrors);
      if (Object.keys(validationErrors).length > 0) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onSubmit(values);
      setValues(initialValues);
      setTouched({});
    } catch (error) {
      logger.error('useForm', 'Error en submit', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [values, onSubmit, validate, initialValues]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setValues,
    setErrors
  };
};

/**
 * Hook para paginación
 */
export const usePagination = <T,>(
  items: T[],
  itemsPerPage: number = 10
) => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const currentItems = items.slice(startIdx, endIdx);

  const goToPage = useCallback((page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  }, [totalPages]);

  const nextPage = useCallback(() => goToPage(currentPage + 1), [currentPage, goToPage]);
  const prevPage = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage]);

  return {
    currentPage,
    totalPages,
    currentItems,
    goToPage,
    nextPage,
    prevPage,
    itemsPerPage,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1
  };
};

/**
 * Hook para búsqueda y filtrado
 */
export const useSearch = <T extends Record<string, any>>(
  items: T[],
  searchFields: (keyof T)[]
) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = searchTerm.length === 0
    ? items
    : items.filter(item =>
        searchFields.some(field =>
          String(item[field]).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );

  const clear = useCallback(() => setSearchTerm(''), []);

  return {
    searchTerm,
    setSearchTerm,
    filtered,
    clear,
    hasResults: filtered.length > 0
  };
};

/**
 * Hook para debounce
 */
export const useDebounce = <T,>(value: T, delay: number = 500): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Hook para localStorage
 */
export const useLocalStorage = <T,>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      logger.error('useLocalStorage', `Error leyendo ${key}`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      logger.error('useLocalStorage', `Error escribiendo ${key}`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue] as const;
};

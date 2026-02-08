const API_URL = '/api';

let lastError: string | null = null;

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 10000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    throw error;
  }
};

const getUrl = (table: string, id?: string) => {
  return id ? `${API_URL}/${table}/${id}` : `${API_URL}/${table}`;
};

export const mysqlApi = {
  fetchData: async (table: string, retries = 1): Promise<any[]> => {
    try {
      const response = await fetchWithTimeout(getUrl(table), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error(`Error ${response.status}`);
      return await response.json();
    } catch (error: any) {
      lastError = error.message;
      console.error(`[MySQL API] Error en '${table}':`, error.message);
      const local = localStorage.getItem(`roomflow_${table}`);
      return local ? JSON.parse(local) : [];
    }
  },

  insertData: async (table: string, data: any): Promise<any> => {
    try {
      const response = await fetchWithTimeout(getUrl(table), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        let detail = '';
        try {
          const err = await response.json();
          if (err && err.error) detail = `: ${err.error}`;
        } catch (_) {}
        throw new Error(`Error ${response.status}${detail}`);
      }
      return await response.json();
    } catch (error: any) {
      lastError = error.message;
      throw error;
    }
  },

  updateData: async (table: string, id: string, data: any): Promise<any> => {
    try {
      const response = await fetchWithTimeout(getUrl(table, id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        let detail = '';
        try {
          const err = await response.json();
          if (err && err.error) detail = `: ${err.error}`;
        } catch (_) {}
        throw new Error(`Error ${response.status}${detail}`);
      }
      return await response.json();
    } catch (error: any) {
      lastError = error.message;
      throw error;
    }
  },

  deleteData: async (table: string, id: string): Promise<any> => {
    try {
      const response = await fetchWithTimeout(getUrl(table, id), {
        method: 'DELETE'
      });
      if (!response.ok) {
        let detail = '';
        try {
          const err = await response.json();
          if (err && err.error) detail = `: ${err.error}`;
        } catch (_) {}
        throw new Error(`Error ${response.status}${detail}`);
      }
      return await response.json();
    } catch (error: any) {
      lastError = error.message;
      throw error;
    }
  },

  getLastError: () => lastError
};

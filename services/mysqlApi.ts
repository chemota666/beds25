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

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const raw = localStorage.getItem('roomflow_auth_user');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.username) headers['X-User'] = parsed.username;
    }
  } catch (_) {}
  return headers;
};

export const mysqlApi = {
  fetchData: async (table: string, retries = 1): Promise<any[]> => {
    try {
      const response = await fetchWithTimeout(getUrl(table), {
        method: 'GET',
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
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
        method: 'DELETE',
        headers: getAuthHeaders()
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

  getLastError: () => lastError,

  login: async (username: string, password: string): Promise<any> => {
    const response = await fetchWithTimeout(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ username, password })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Error ${response.status}`);
    }
    return await response.json();
  },

  getUsers: async (): Promise<any[]> => {
    const response = await fetchWithTimeout(`${API_URL}/auth/users`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error(`Error ${response.status}`);
    return await response.json();
  },

  createUser: async (data: { username: string; password: string; role: string }): Promise<any> => {
    const response = await fetchWithTimeout(`${API_URL}/auth/users`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Error ${response.status}`);
    }
    return await response.json();
  },

  updateUser: async (id: string, data: { username?: string; password?: string; role?: string }): Promise<any> => {
    const response = await fetchWithTimeout(`${API_URL}/auth/users/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Error ${response.status}`);
    }
    return await response.json();
  },

  deleteUser: async (id: string): Promise<any> => {
    const response = await fetchWithTimeout(`${API_URL}/auth/users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Error ${response.status}`);
    }
    return await response.json();
  },

  getAuditLogs: async (filters?: { username?: string; table?: string; from?: string; to?: string; limit?: number; offset?: number }): Promise<any[]> => {
    const params = new URLSearchParams();
    if (filters?.username) params.set('username', filters.username);
    if (filters?.table) params.set('table', filters.table);
    if (filters?.from) params.set('from', filters.from);
    if (filters?.to) params.set('to', filters.to);
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));
    const qs = params.toString();
    const response = await fetchWithTimeout(`${API_URL}/audit-logs${qs ? '?' + qs : ''}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error(`Error ${response.status}`);
    return await response.json();
  }
};

import axios from 'axios';

// The CSRF token lives in memory only. It is intentionally never written to
// localStorage or sessionStorage; a reload fetches it again from /auth/me.
let csrfToken = null;

export function setAdminCsrfToken(token) {
  csrfToken = typeof token === 'string' && token.length > 0 ? token : null;
}

export function clearAdminCsrfToken() {
  csrfToken = null;
}

export function getAdminCsrfToken() {
  return csrfToken;
}

const adminApi = axios.create({
  baseURL: '/api/admin',
  timeout: 60000,
  withCredentials: true,
});

adminApi.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  const isStateChanging = method !== 'get' && method !== 'head' && method !== 'options';

  if (csrfToken && isStateChanging) {
    config.headers = config.headers || {};
    config.headers['X-Admin-CSRF'] = csrfToken;
  }

  return config;
});

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';

    // A failed admin login or a missing admin session must not trigger the
    // public user auth redirect; the admin page handles those itself.
    if (
      status === 401 &&
      !url.startsWith('/auth/login') &&
      !url.startsWith('/auth/me') &&
      typeof window !== 'undefined'
    ) {
      window.dispatchEvent(new Event('admin:unauthorized'));
    }

    return Promise.reject(error);
  }
);

// Admin auth
export const loginAdmin = (payload) => adminApi.post('/auth/login', payload);
export const getAdminMe = () => adminApi.get('/auth/me');
export const logoutAdmin = () => adminApi.post('/auth/logout');

// Overview
export const getAdminOverview = () => adminApi.get('/overview');

// Users
export const listUsers = (params) => adminApi.get('/users', { params });
export const getUser = (id) => adminApi.get(`/users/${id}`);
export const createUser = (payload) => adminApi.post('/users', payload);
export const bulkCreateUsers = (payload) => adminApi.post('/users/bulk', payload);
export const updateUser = (id, payload) => adminApi.patch(`/users/${id}`, payload);
export const lockUser = (id) => adminApi.post(`/users/${id}/lock`);
export const unlockUser = (id) => adminApi.post(`/users/${id}/unlock`);
export const restoreUser = (id) => adminApi.post(`/users/${id}/restore`);
export const resetUserPassword = (id) => adminApi.post(`/users/${id}/reset-password`);
export const deleteUser = (id, payload) => adminApi.delete(`/users/${id}`, { data: payload });

// Admission data
export const getDataTables = () => adminApi.get('/data/tables');
export const listTableRows = (table, params) => adminApi.get(`/data/${table}`, { params });
export const getTableRow = (table, id) => adminApi.get(`/data/${table}/${id}`);
export const createTableRow = (table, payload) => adminApi.post(`/data/${table}`, payload);
export const updateTableRow = (table, id, payload) =>
  adminApi.patch(`/data/${table}/${id}`, payload);
export const deleteTableRow = (table, id, payload) =>
  adminApi.delete(`/data/${table}/${id}`, { data: payload });

// Audit
export const listAudit = (params) => adminApi.get('/audit', { params });

export default adminApi;

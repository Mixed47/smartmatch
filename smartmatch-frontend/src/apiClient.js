const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');

export function apiBase() {
  return API_BASE;
}

export function clearAuthSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  localStorage.removeItem('user_id');
  localStorage.removeItem('email');
}

export function persistAuthToken(token) {
  if (!token) {
    clearAuthSession();
    return;
  }
  localStorage.setItem('token', token);
  localStorage.removeItem('role');
  localStorage.removeItem('user_id');
  localStorage.removeItem('email');
}

function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function getAuthUser() {
  const token = localStorage.getItem('token');
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  if (payload.purpose && payload.purpose !== 'access') return null;
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    clearAuthSession();
    return null;
  }
  const role = payload.role;
  const userId = payload.user_id;
  if (!role || !userId) return null;
  return { token, role, user_id: userId, email: payload.email || '' };
}

function redirectToLogin() {
  if (window.location.pathname === '/login' || window.location.pathname === '/register') {
    return;
  }
  window.location.assign('/login');
}

export function fileURL(path) {
  if (!path) return '';
  let relative = path;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const parsed = new URL(path);
      if (parsed.pathname.startsWith('/uploads/')) {
        relative = `/api/files/${parsed.pathname.replace(/^\/uploads\//, '')}`;
      } else if (parsed.pathname.startsWith('/api/files/')) {
        relative = parsed.pathname;
      } else {
        return path;
      }
    } catch {
      return path;
    }
  } else if (path.startsWith('/uploads/')) {
    relative = `/api/files/${path.replace(/^\/uploads\//, '')}`;
  }

  const token = localStorage.getItem('token') || '';
  const url = relative.startsWith('/') ? `${API_BASE}${relative}` : `${API_BASE}/${relative}`;
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}token=${encodeURIComponent(token)}`;
}

export async function apiFetch(path, options = {}) {
  const { skipAuthRedirect = false, ...fetchOptions } = options;
  const token = localStorage.getItem('token');
  const headers = new Headers(fetchOptions.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const isFormData = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;
  if (fetchOptions.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

  let res;
  try {
    res = await fetch(url, { ...fetchOptions, headers });
  } catch (err) {
    const error = new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    error.status = 0;
    error.data = { error: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' };
    throw error;
  }

  if (res.status === 401) {
    if (!skipAuthRedirect) {
      clearAuthSession();
      redirectToLogin();
    }
    const error = new Error('Unauthorized');
    error.status = 401;
    error.data = await res.json().catch(() => ({ error: 'Unauthorized' }));
    throw error;
  }

  return res;
}

export async function apiJson(path, options = {}) {
  const res = await apiFetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `Request failed (${res.status})`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function apiPublicJson(path, options = {}) {
  return apiJson(path, { ...options, skipAuthRedirect: true });
}

export function friendlyApiError(err, fallback = 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง') {
  if (!err) return fallback;
  if (err.status === 0) return 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';
  if (err.status === 401) return 'เซสชันหมดอายุหรือยังไม่ได้เข้าสู่ระบบ กรุณาล็อกอินใหม่';
  if (err.status === 403) return 'คุณไม่มีสิทธิ์ใช้งานส่วนนี้';
  if (err.status === 404) return 'ไม่พบข้อมูลที่ต้องการ';
  if (err.status >= 500) return 'เซิร์ฟเวอร์มีปัญหาชั่วคราว กรุณาลองใหม่ในอีกสักครู่';
  return err.data?.error || err.message || fallback;
}

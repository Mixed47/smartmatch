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
  const token = localStorage.getItem('token');
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (options.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    clearAuthSession();
    redirectToLogin();
    const error = new Error('Unauthorized');
    error.status = 401;
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

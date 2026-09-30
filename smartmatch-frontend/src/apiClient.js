// VITE_API_URL='' means "same origin" (Docker/nginx proxies /api to the backend).
const rawApiBase = import.meta.env.VITE_API_URL;
const API_BASE = (rawApiBase === undefined ? 'http://localhost:8080' : rawApiBase).replace(/\/$/, '');

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

// Maps a stored file path to the protected API route, or returns null when the
// path points at an external URL that must be used as-is.
function protectedFilePath(path) {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const { pathname } = new URL(path);
      if (pathname.startsWith('/uploads/')) {
        return `/api/files/${pathname.replace(/^\/uploads\//, '')}`;
      }
      if (pathname.startsWith('/api/files/')) {
        return pathname;
      }
      return null;
    } catch {
      return null;
    }
  }
  if (path.startsWith('/uploads/')) {
    return `/api/files/${path.replace(/^\/uploads\//, '')}`;
  }
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Downloads a protected upload with the Authorization header and returns an
 * object URL usable as an <img src>. Callers must revoke the URL when done.
 */
export async function fetchFileObjectURL(path) {
  return (await fetchFilePreview(path)).url;
}

function contentTypeFromPath(path) {
  const ext = String(path || '').split('?')[0].split('.').pop().toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png' || ext === 'gif' || ext === 'webp') return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  return '';
}

/**
 * Same as fetchFileObjectURL but also reports the content type, so callers can
 * render a PDF resume in an <object> and an image in an <img>.
 */
export async function fetchFilePreview(path) {
  if (!path) return { url: '', contentType: '' };
  const relative = protectedFilePath(path);
  if (relative === null) return { url: path, contentType: contentTypeFromPath(path) };

  const res = await apiFetch(relative);
  if (!res.ok) {
    const error = new Error(`Failed to load file (${res.status})`);
    error.status = res.status;
    throw error;
  }
  const blob = await res.blob();
  return {
    url: URL.createObjectURL(blob),
    contentType: blob.type || contentTypeFromPath(path),
  };
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
    // A caller-triggered abort (AI timeout) must stay an AbortError so the page
    // can show its own timeout message instead of "เชื่อมต่อไม่ได้".
    if (err?.name === 'AbortError') throw err;
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
    error.code = error.data?.code || '';
    // Login/MFA calls opt out of the redirect, and their 401 bodies explain the
    // real cause (wrong OTP, expired MFA session), so keep that message.
    error.trustServerMessage = skipAuthRedirect;
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
  if (err.status === 401) {
    if (err.trustServerMessage && err.data?.error) return err.data.error;
    return 'เซสชันหมดอายุหรือยังไม่ได้เข้าสู่ระบบ กรุณาล็อกอินใหม่';
  }
  if (err.status === 403) return 'คุณไม่มีสิทธิ์ใช้งานส่วนนี้';
  if (err.status === 404) return 'ไม่พบข้อมูลที่ต้องการ';
  if (err.status >= 500) return 'เซิร์ฟเวอร์มีปัญหาชั่วคราว กรุณาลองใหม่ในอีกสักครู่';
  return err.data?.error || err.message || fallback;
}

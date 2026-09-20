import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiPublicJson, persistAuthToken, friendlyApiError } from './apiClient';

const roleHome = {
  student: '/student',
  company: '/company',
  teacher: '/teacher',
};

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiPublicJson('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (!data.token) {
        setError('ไม่พบ Token จากเซิร์ฟเวอร์');
        return;
      }

      persistAuthToken(data.token);
      const path = roleHome[data.role];
      if (!path) {
        setError('บทบาทผู้ใช้ไม่รองรับ');
        return;
      }

      navigate(path);
    } catch (err) {
      setError(friendlyApiError(err, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4 dark:bg-[#09090b]">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4f46e5] text-white shadow-lg shadow-indigo-500/30">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551.2-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
            </svg>
          </div>
          <h1 className="m-0 text-2xl font-black text-slate-900 dark:text-white">เข้าสู่ระบบ</h1>
          <p className="mt-2 text-sm font-medium text-slate-500 dark:text-zinc-400">AI-InternMatch — เลือกบทบาทของคุณหลังเข้าสู่ระบบ</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-[#161616]">
          <div className="space-y-4">
            <div>
              <label htmlFor="login-email" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Email</label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-[#1a1a1a] px-4 py-3.5 text-sm text-white placeholder-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Password</label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-[#1a1a1a] px-4 py-3.5 text-sm text-white placeholder-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                placeholder="รหัสผ่านของคุณ"
              />
            </div>

            {error && (
              <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[#4f46e5] py-3.5 text-sm font-bold text-white shadow-md shadow-indigo-500/20 transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          ยังไม่มีบัญชี?{' '}
          <Link to="/register" className="font-bold text-[#4f46e5] hover:underline dark:text-indigo-400">
            สมัครสมาชิก
          </Link>
        </p>
      </div>
    </div>
  );
}

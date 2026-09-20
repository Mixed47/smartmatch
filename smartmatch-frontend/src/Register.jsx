import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiPublicJson, friendlyApiError } from './apiClient';

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [qrImage, setQrImage] = useState('');
  const [otpauthURL, setOtpauthURL] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }

    setLoading(true);
    try {
      const data = await apiPublicJson('/api/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, role }),
      });
      setQrImage(data.qr_image_base64 || '');
      setOtpauthURL(data.otpauth_url || '');
      if (!data.qr_image_base64) {
        setError('สมัครสำเร็จ แต่ระบบสร้าง QR Code ไม่ได้ กรุณาติดต่อผู้ดูแล');
      }
    } catch (err) {
      setError(friendlyApiError(err, 'สมัครสมาชิกไม่สำเร็จ'));
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
            </svg>
          </div>
          <h1 className="m-0 text-2xl font-black text-slate-900 dark:text-white">{qrImage ? 'ตั้งค่า MFA' : 'สร้างบัญชีใหม่'}</h1>
          <p className="mt-2 text-sm font-medium text-slate-500 dark:text-zinc-400">
            {qrImage ? 'สแกน QR ด้วย Google Authenticator หรือแอป TOTP อื่น' : 'สมัครสมาชิกเพื่อเข้าใช้งาน AI-InternMatch'}
          </p>
        </div>

        {!qrImage ? (
          <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-[#161616]">
            <div className="space-y-4">
              <div>
                <label htmlFor="register-email" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Email</label>
                <input
                  id="register-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#1a1a1a] px-4 py-3.5 text-sm text-white placeholder-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="register-password" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Password</label>
                <input
                  id="register-password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#1a1a1a] px-4 py-3.5 text-sm text-white placeholder-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                />
              </div>

              <div>
                <label htmlFor="register-role" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Role</label>
                <select
                  id="register-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full appearance-none rounded-2xl border border-white/10 bg-[#1a1a1a] px-4 py-3.5 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="student">student — นักศึกษา</option>
                  <option value="company">company — บริษัท / HR</option>
                  <option value="teacher">teacher — อาจารย์</option>
                </select>
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
                {loading ? 'กำลังสมัครสมาชิก...' : 'สมัครสมาชิก'}
              </button>
            </div>
          </form>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-[#161616]">
            <p className="mb-4 text-sm font-medium text-slate-600 dark:text-zinc-300">
              บัญชีถูกสร้างแล้ว สแกน QR นี้ทันที เพราะจะไม่แสดงอีกครั้งหลังจากออกจากหน้านี้
            </p>
            <img src={qrImage} alt="MFA QR Code" className="mx-auto h-56 w-56 rounded-2xl bg-white p-2" />
            {otpauthURL && (
              <p className="mt-4 break-all text-[11px] text-zinc-500">{otpauthURL}</p>
            )}
            {error && (
              <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => navigate('/login', { state: { registered: true } })}
              className="mt-6 w-full rounded-2xl bg-[#4f46e5] py-3.5 text-sm font-bold text-white shadow-md shadow-indigo-500/20 transition hover:bg-indigo-600"
            >
              ไปหน้าเข้าสู่ระบบ
            </button>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          มีบัญชีอยู่แล้ว?{' '}
          <Link to="/login" className="font-bold text-[#4f46e5] hover:underline dark:text-indigo-400">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  );
}

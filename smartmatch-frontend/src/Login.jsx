import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiPublicJson, persistAuthToken, friendlyApiError } from './apiClient';

const roleHome = {
  student: '/student',
  company: '/company',
  teacher: '/teacher',
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [qrImage, setQrImage] = useState('');
  const [otpauthURL, setOtpauthURL] = useState('');
  const [pendingRole, setPendingRole] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState(location.state?.registered ? 'สมัครสำเร็จแล้ว กรุณาสแกน QR และเข้าสู่ระบบด้วยรหัส MFA' : '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location.state?.registered) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  const finishLogin = (data) => {
    if (!data.token) {
      setError('ไม่พบ Token จากเซิร์ฟเวอร์');
      return;
    }
    persistAuthToken(data.token);
    const path = roleHome[data.role || pendingRole];
    if (!path) {
      setError('บทบาทผู้ใช้ไม่รองรับ');
      return;
    }
    navigate(path);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      const data = await apiPublicJson('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (data.require_mfa) {
        setMfaToken(data.mfa_token || '');
        setPendingRole(data.role || '');
        setQrImage(data.qr_image_base64 || '');
        setOtpauthURL(data.otpauth_url || '');
        setInfo(data.message || 'กรุณากรอกรหัส 6 หลักจากแอป Authenticator');
        return;
      }

      finishLogin(data);
    } catch (err) {
      setError(friendlyApiError(err, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'));
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiPublicJson('/api/verify-mfa', {
        method: 'POST',
        body: JSON.stringify({ mfa_token: mfaToken, code: otp }),
      });
      finishLogin(data);
    } catch (err) {
      setError(friendlyApiError(err, 'รหัส MFA ไม่ถูกต้อง'));
    } finally {
      setLoading(false);
    }
  };

  const mfaStep = Boolean(mfaToken);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4 dark:bg-[#09090b]">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4f46e5] text-white shadow-lg shadow-indigo-500/30">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
            </svg>
          </div>
          <h1 className="m-0 text-2xl font-black text-slate-900 dark:text-white">{mfaStep ? 'ยืนยันรหัส MFA' : 'เข้าสู่ระบบ'}</h1>
          <p className="mt-2 text-sm font-medium text-slate-500 dark:text-zinc-400">
            {mfaStep ? 'เปิดแอป Authenticator แล้วกรอกรหัส 6 หลัก' : 'AI-InternMatch — ต้องยืนยัน MFA ก่อนเข้าใช้งาน'}
          </p>
        </div>

        <form onSubmit={mfaStep ? handleMfaSubmit : handlePasswordSubmit} className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-[#161616]">
          <div className="space-y-4">
            {!mfaStep && (
              <>
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
              </>
            )}

            {mfaStep && (
              <>
                {qrImage && (
                  <div className="rounded-2xl border border-white/10 bg-[#111] p-4 text-center">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">สแกน QR เพื่อผูกแอป Authenticator</p>
                    <img src={qrImage} alt="MFA QR Code" className="mx-auto h-48 w-48 rounded-xl bg-white p-2" />
                    {otpauthURL && <p className="mt-3 break-all text-[10px] text-zinc-500">{otpauthURL}</p>}
                  </div>
                )}
                <div>
                  <label htmlFor="login-otp" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">รหัส OTP 6 หลัก</label>
                  <input
                    id="login-otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full rounded-2xl border border-white/10 bg-[#1a1a1a] px-4 py-3.5 text-center text-lg tracking-[0.4em] text-white placeholder-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    placeholder="000000"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => { setMfaToken(''); setOtp(''); setQrImage(''); setError(''); }}
                  className="w-full text-xs font-bold text-slate-500 hover:underline"
                >
                  กลับไปกรอกอีเมล / รหัสผ่าน
                </button>
              </>
            )}

            {info && !error && (
              <p className="rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                {info}
              </p>
            )}
            {error && (
              <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || (mfaStep && otp.length !== 6)}
              className="w-full rounded-2xl bg-[#4f46e5] py-3.5 text-sm font-bold text-white shadow-md shadow-indigo-500/20 transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'กำลังตรวจสอบ...' : mfaStep ? 'ยืนยันรหัส MFA' : 'เข้าสู่ระบบ'}
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

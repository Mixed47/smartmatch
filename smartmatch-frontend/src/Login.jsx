import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiPublicJson, persistAuthToken, friendlyApiError } from './apiClient';
import { Spinner } from './ui';

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
  const [mfaPending, setMfaPending] = useState(false);
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
        setMfaPending(Boolean(data.mfa_pending));
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

  const resetToPasswordStep = () => {
    setMfaToken('');
    setOtp('');
    setQrImage('');
    setOtpauthURL('');
    setPendingRole('');
    setMfaPending(false);
    setInfo('');
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
      // The temporary MFA token lives for 5 minutes; only send the user back to
      // the password step when that session is really gone.
      if (err.code === 'mfa_session_expired') {
        resetToPasswordStep();
        setError(friendlyApiError(err, 'เซสชันยืนยัน MFA หมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง'));
      } else {
        setOtp('');
        setError(friendlyApiError(err, 'รหัส MFA ไม่ถูกต้อง'));
      }
    } finally {
      setLoading(false);
    }
  };

  const mfaStep = Boolean(mfaToken);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
            </svg>
          </div>
          <h1 className="page-title">{mfaStep ? 'ยืนยันรหัส MFA' : 'เข้าสู่ระบบ'}</h1>
          <p className="page-subtitle">
            {mfaStep ? 'เปิดแอป Authenticator แล้วกรอกรหัส 6 หลัก' : 'AI-InternMatch — ต้องยืนยัน MFA ก่อนเข้าใช้งาน'}
          </p>
        </div>

        <form onSubmit={mfaStep ? handleMfaSubmit : handlePasswordSubmit} className="panel p-6 sm:p-8">
          <div className="space-y-5">
            {!mfaStep && (
              <>
                <div>
                  <label htmlFor="login-email" className="label">อีเมล</label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label htmlFor="login-password" className="label">รหัสผ่าน</label>
                  <input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                    placeholder="รหัสผ่านของคุณ"
                  />
                </div>
              </>
            )}

            {mfaStep && (
              <>
                {qrImage && (
                  <div className="card-soft p-4 text-center">
                    <p className="eyebrow mb-3">
                      {mfaPending ? 'ยังตั้งค่าไม่เสร็จ — สแกน QR นี้เพื่อผูกแอป Authenticator' : 'สแกน QR เพื่อผูกแอป Authenticator'}
                    </p>
                    <img src={qrImage} alt="QR Code สำหรับตั้งค่า MFA" className="mx-auto h-44 w-44 rounded-xl bg-white p-2 sm:h-48 sm:w-48" />
                    {otpauthURL && <p className="mt-3 break-all text-[11px] text-ink-subtle">{otpauthURL}</p>}
                  </div>
                )}
                <div>
                  <label htmlFor="login-otp" className="label">รหัส OTP 6 หลัก</label>
                  <input
                    id="login-otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="input text-center text-lg tracking-[0.4em]"
                    placeholder="000000"
                  />
                  <p className="field-hint">กรอกรหัสที่แสดงในแอป Authenticator ของคุณ</p>
                </div>
                <button
                  type="button"
                  onClick={() => { resetToPasswordStep(); setError(''); }}
                  className="btn btn-ghost btn-sm btn-block"
                >
                  ← กลับไปกรอกอีเมล / รหัสผ่าน
                </button>
              </>
            )}

            {info && !error && (
              <p className="alert alert-info" role="status">{info}</p>
            )}
            {error && (
              <p className="alert alert-danger" role="alert">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || (mfaStep && otp.length !== 6)}
              className="btn btn-primary btn-lg btn-block"
            >
              {loading && <Spinner />}
              {loading ? 'กำลังตรวจสอบ...' : mfaStep ? 'ยืนยันรหัส MFA' : 'เข้าสู่ระบบ'}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-ink-muted">
          ยังไม่มีบัญชี?{' '}
          <Link to="/register" className="font-semibold text-brand-600 underline-offset-4 hover:underline dark:text-brand-400">
            สมัครสมาชิก
          </Link>
        </p>
      </div>
    </div>
  );
}

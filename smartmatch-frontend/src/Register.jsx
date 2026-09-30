import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiPublicJson, friendlyApiError } from './apiClient';
import { Spinner } from './ui';

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
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
            </svg>
          </div>
          <h1 className="page-title">{qrImage ? 'ตั้งค่า MFA' : 'สร้างบัญชีใหม่'}</h1>
          <p className="page-subtitle">
            {qrImage ? 'สแกน QR ด้วย Google Authenticator หรือแอป TOTP อื่น' : 'สมัครสมาชิกเพื่อเข้าใช้งาน AI-InternMatch'}
          </p>
        </div>

        {!qrImage ? (
          <form onSubmit={handleSubmit} className="panel p-6 sm:p-8">
            <div className="space-y-5">
              <div>
                <label htmlFor="register-email" className="label">อีเมล</label>
                <input
                  id="register-email"
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
                <label htmlFor="register-password" className="label">รหัสผ่าน</label>
                <input
                  id="register-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                />
                <p className="field-hint">ใช้รหัสผ่านที่คาดเดายาก อย่างน้อย 8 ตัวอักษร</p>
              </div>

              <div>
                <label htmlFor="register-role" className="label">บทบาทผู้ใช้</label>
                <select
                  id="register-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="select"
                >
                  <option value="student">นักศึกษา (Student)</option>
                  <option value="company">บริษัท / HR (Company)</option>
                  <option value="teacher">อาจารย์นิเทศ (Teacher)</option>
                </select>
              </div>

              {error && (
                <p className="alert alert-danger" role="alert">{error}</p>
              )}

              <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-block">
                {loading && <Spinner />}
                {loading ? 'กำลังสมัครสมาชิก...' : 'สมัครสมาชิก'}
              </button>
            </div>
          </form>
        ) : (
          <div className="panel p-6 text-center sm:p-8">
            <p className="alert alert-warning mb-5 text-left">
              บัญชีถูกสร้างแล้ว สแกน QR นี้ทันที เพราะจะไม่แสดงอีกครั้งหลังจากออกจากหน้านี้
            </p>
            <img src={qrImage} alt="QR Code สำหรับตั้งค่า MFA" className="mx-auto h-52 w-52 rounded-2xl bg-white p-2 sm:h-56 sm:w-56" />
            {otpauthURL && (
              <p className="mt-4 break-all text-[11px] text-ink-subtle">{otpauthURL}</p>
            )}
            {error && (
              <p className="alert alert-danger mt-4 text-left" role="alert">{error}</p>
            )}
            <button
              type="button"
              onClick={() => navigate('/login', { state: { registered: true } })}
              className="btn btn-primary btn-lg btn-block mt-6"
            >
              ไปหน้าเข้าสู่ระบบ
            </button>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-ink-muted">
          มีบัญชีอยู่แล้ว?{' '}
          <Link to="/login" className="font-semibold text-brand-600 underline-offset-4 hover:underline dark:text-brand-400">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  );
}

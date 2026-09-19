import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function todayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function authErrorMessage(status, serverError) {
  if (status === 401) {
    if (serverError === 'token expired') {
      return 'เซสชันหมดอายุแล้ว กรุณาเข้าสู่ระบบอีกครั้ง';
    }
    if (serverError === 'not logged in') {
      return 'ยังไม่ได้เข้าสู่ระบบ กรุณาล็อกอินก่อนบันทึกเล่มสหกิจ';
    }
    return 'Token ไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง';
  }
  if (status === 403) {
    return 'เฉพาะนักศึกษาเท่านั้นที่บันทึกเล่มสหกิจได้';
  }
  return serverError || 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง';
}

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  localStorage.removeItem('user_id');
  localStorage.removeItem('email');
}

export default function StudentLogbook() {
  const navigate = useNavigate();
  const [date, setDate] = useState(todayISO);
  const [tasks, setTasks] = useState('');
  const [blocker, setBlocker] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const hasBlocker = blocker.trim().length > 0;

  const email = useMemo(() => localStorage.getItem('email') || '', []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    if (role !== 'student') {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const token = localStorage.getItem('token');
    if (!token) {
      setError('ยังไม่ได้เข้าสู่ระบบ กรุณาล็อกอินก่อนบันทึกเล่มสหกิจ');
      clearSession();
      navigate('/login', { replace: true });
      return;
    }

    if (!date) {
      setError('กรุณาเลือกวันที่');
      return;
    }
    if (!tasks.trim()) {
      setError('กรุณากรอกรายละเอียดงานที่ทำ');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/logbook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          date,
          tasks: tasks.trim(),
          blocker: blocker.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        setError(authErrorMessage(res.status, data.error));
        clearSession();
        setTimeout(() => navigate('/login', { replace: true }), 800);
        return;
      }

      if (!res.ok) {
        setError(authErrorMessage(res.status, data.error));
        return;
      }

      setSuccess('บันทึกเล่มสหกิจเรียบร้อยแล้ว');
      setTasks('');
      setBlocker('');
      setDate(todayISO());
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] px-4 py-10 dark:bg-[#09090b]">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            to="/student"
            className="text-sm font-bold text-[#4f46e5] hover:underline dark:text-indigo-400"
          >
            ← กลับแดชบอร์ด
          </Link>
          {email && (
            <p className="m-0 text-xs font-medium text-slate-400">{email}</p>
          )}
        </div>

        <div className="mb-8">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
            Student Module
          </p>
          <h1 className="m-0 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            จดบันทึกเล่มสหกิจ
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-500 dark:text-zinc-400">
            Digital Logbook — บันทึกงานประจำวันของนักศึกษาสหกิจ
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-[#161616]"
        >
          <div className="space-y-5">
            <div>
              <label htmlFor="logbook-date" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                วันที่
              </label>
              <input
                id="logbook-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/15 dark:border-white/10 dark:bg-[#0a0a0a] dark:text-zinc-100"
              />
            </div>

            <div>
              <label htmlFor="logbook-tasks" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                รายละเอียดงานที่ทำ
              </label>
              <textarea
                id="logbook-tasks"
                required
                rows={5}
                value={tasks}
                onChange={(e) => setTasks(e.target.value)}
                placeholder="สรุปงานที่ทำในวันนี้ เช่น เขียน API, ทดสอบระบบ, ประชุมกับพี่เลี้ยง..."
                className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm leading-relaxed text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/15 dark:border-white/10 dark:bg-[#0a0a0a] dark:text-zinc-100"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="logbook-blocker" className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                  ปัญหา / อุปสรรค
                </label>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-white/5 dark:text-zinc-400">
                  ไม่บังคับ
                </span>
              </div>
              <textarea
                id="logbook-blocker"
                rows={4}
                value={blocker}
                onChange={(e) => setBlocker(e.target.value)}
                placeholder="เว้นว่างได้ถ้าวันนี้ไม่มีปัญหา — กรอกเมื่อติดปัญหาหรือมีอุปสรรคที่ต้องการแจ้งอาจารย์"
                className={`w-full resize-y rounded-2xl border bg-slate-50 px-4 py-3.5 text-sm leading-relaxed text-slate-900 outline-none transition focus:bg-white focus:ring-4 dark:bg-[#0a0a0a] dark:text-zinc-100 ${
                  hasBlocker
                    ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-500/15 dark:border-amber-500/40'
                    : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/15 dark:border-white/10'
                }`}
              />
              <p className="mt-2 text-xs font-medium text-slate-400">
                {hasBlocker
                  ? 'ระบบจะบันทึกว่าวันนี้ติดปัญหา เพื่อให้พี่เลี้ยง/อาจารย์ติดตามได้'
                  : 'ออปชันเสริม: กรอกเฉพาะเมื่อมีปัญหาหรืออุปสรรค'}
              </p>
            </div>

            {error && (
              <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                {error}
              </p>
            )}
            {success && (
              <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[#4f46e5] py-3.5 text-sm font-bold text-white shadow-md shadow-indigo-500/20 transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'กำลังบันทึก...' : 'บันทึกเล่มสหกิจ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

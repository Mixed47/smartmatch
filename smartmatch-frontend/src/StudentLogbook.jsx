import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const AI_TIMEOUT_MS = 70000;

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
    return 'เฉพาะนักศึกษาเท่านั้นที่ใช้งานเล่มสหกิจได้';
  }
  return serverError || 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง';
}

function aiErrorMessage(status, serverError, aborted) {
  if (aborted) {
    return 'AI ใช้เวลานานเกินไป (timeout) กรุณาลองใหม่อีกครั้ง';
  }
  if (status === 504 || serverError === 'AI request timed out') {
    return 'การวิเคราะห์หมดเวลา เซิร์ฟเวอร์รอคำตอบจาก AI ไม่ทัน';
  }
  if (status === 502 || serverError === 'AI evaluation failed') {
    return 'ยิง AI ไม่สำเร็จ ระบบไม่สามารถวิเคราะห์บันทึกนี้ได้ในขณะนี้';
  }
  if (status === 503) {
    return 'บริการ AI ยังไม่พร้อมใช้งาน กรุณาตรวจสอบการตั้งค่าเซิร์ฟเวอร์';
  }
  if (status === 404) {
    return 'ไม่พบบันทึกเล่มสหกิจนี้';
  }
  return authErrorMessage(status, serverError) || 'วิเคราะห์ไม่สำเร็จ กรุณาลองอีกครั้ง';
}

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  localStorage.removeItem('user_id');
  localStorage.removeItem('email');
}

function Spinner({ className = 'h-4 w-4' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export default function StudentLogbook() {
  const navigate = useNavigate();
  const [date, setDate] = useState(todayISO);
  const [tasks, setTasks] = useState('');
  const [blocker, setBlocker] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState([]);
  const [listError, setListError] = useState('');
  const [listLoading, setListLoading] = useState(true);
  const [evaluatingId, setEvaluatingId] = useState(null);
  const [analyses, setAnalyses] = useState({});
  const [aiErrors, setAiErrors] = useState({});

  const hasBlocker = blocker.trim().length > 0;
  const email = useMemo(() => localStorage.getItem('email') || '', []);

  const handleAuthFailure = useCallback(
    (status, serverError) => {
      setError(authErrorMessage(status, serverError));
      clearSession();
      setTimeout(() => navigate('/login', { replace: true }), 800);
    },
    [navigate],
  );

  const loadEntries = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setListLoading(true);
    setListError('');
    try {
      const res = await fetch(`${API_BASE}/api/logbook/entries`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        handleAuthFailure(res.status, data.error);
        return;
      }
      if (!res.ok) {
        setListError(
          res.status === 401 || res.status === 403
            ? authErrorMessage(res.status, data.error)
            : data.error || 'โหลดประวัติไม่สำเร็จ',
        );
        return;
      }
      setEntries(Array.isArray(data.data) ? data.data : []);
    } catch {
      setListError('ไม่สามารถโหลดประวัติเล่มสหกิจได้');
    } finally {
      setListLoading(false);
    }
  }, [handleAuthFailure]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    if (role !== 'student') {
      navigate('/', { replace: true });
      return;
    }
    loadEntries();
  }, [navigate, loadEntries]);

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
        handleAuthFailure(res.status, data.error);
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
      await loadEntries();
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = async (entryId) => {
    const token = localStorage.getItem('token');
    if (!token) {
      handleAuthFailure(401, 'not logged in');
      return;
    }

    setEvaluatingId(entryId);
    setAiErrors((prev) => {
      const next = { ...prev };
      delete next[entryId];
      return next;
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    try {
      const res = await fetch(`${API_BASE}/api/logbook/${entryId}/evaluate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        handleAuthFailure(res.status, data.error);
        return;
      }

      if (!res.ok) {
        setAiErrors((prev) => ({
          ...prev,
          [entryId]: aiErrorMessage(res.status, data.error, false),
        }));
        return;
      }

      setAnalyses((prev) => ({
        ...prev,
        [entryId]: {
          feedback: data.feedback,
          score: data.score,
          is_critical: Boolean(data.is_critical),
        },
      }));
    } catch (err) {
      const aborted = err?.name === 'AbortError';
      setAiErrors((prev) => ({
        ...prev,
        [entryId]: aborted
          ? aiErrorMessage(0, '', true)
          : 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อวิเคราะห์ได้',
      }));
    } finally {
      clearTimeout(timer);
      setEvaluatingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] px-4 py-10 dark:bg-[#09090b]">
      <div className="mx-auto w-full max-w-3xl">
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
            Student Module · Phase 2
          </p>
          <h1 className="m-0 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            จดบันทึกเล่มสหกิจ
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-500 dark:text-zinc-400">
            Digital Logbook — บันทึกงานประจำวัน และให้ AI วิเคราะห์คำแนะนำ
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

        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="m-0 text-xl font-black tracking-tight text-slate-900 dark:text-white">
                ประวัติบันทึก
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500">กดให้ AI วิเคราะห์คำแนะนำรายวัน</p>
            </div>
          </div>

          {listLoading && (
            <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-6 text-sm font-medium text-slate-500 dark:border-white/10 dark:bg-[#161616]">
              <Spinner />
              กำลังโหลดประวัติ...
            </div>
          )}

          {!listLoading && listError && (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-500/20 dark:bg-rose-500/10">
              <p className="m-0 text-sm font-bold text-rose-700 dark:text-rose-300">โหลดประวัติไม่สำเร็จ</p>
              <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">{listError}</p>
            </div>
          )}

          {!listLoading && !listError && entries.length === 0 && (
            <p className="rounded-3xl border border-dashed border-slate-200 px-5 py-8 text-center text-sm font-medium text-slate-400 dark:border-white/10">
              ยังไม่มีบันทึกในเล่มสหกิจ
            </p>
          )}

          <div className="space-y-4">
            {entries.map((entry) => {
              const analysis = analyses[entry.id];
              const aiError = aiErrors[entry.id];
              const isEvaluating = evaluatingId === entry.id;

              return (
                <article
                  key={entry.id}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#161616]"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="m-0 text-xs font-bold uppercase tracking-wide text-slate-400">{entry.date}</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-zinc-200">
                        {entry.tasks}
                      </p>
                      {entry.blocker ? (
                        <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                          อุปสรรค: {entry.blocker}
                        </p>
                      ) : (
                        <p className="mt-3 text-xs font-medium text-slate-400">วันนี้ไม่มีอุปสรรคที่ระบุ</p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={isEvaluating}
                      onClick={() => handleEvaluate(entry.id)}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-bold text-[#4f46e5] transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
                    >
                      {isEvaluating ? (
                        <>
                          <Spinner />
                          กำลังวิเคราะห์...
                        </>
                      ) : (
                        '✨ AI วิเคราะห์การทำงาน'
                      )}
                    </button>
                  </div>

                  {isEvaluating && (
                    <div className="mt-5 flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm font-medium text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
                      <Spinner className="h-5 w-5" />
                      AI กำลังอ่านบันทึกและสรุปคำแนะนำ กรุณารอสักครู่...
                    </div>
                  )}

                  {aiError && (
                    <div className="mt-5 rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50 p-5 dark:border-rose-500/20 dark:from-rose-500/10 dark:to-orange-500/5">
                      <p className="m-0 text-sm font-black text-rose-700 dark:text-rose-300">วิเคราะห์ไม่สำเร็จ</p>
                      <p className="mt-1 text-sm leading-relaxed text-rose-600 dark:text-rose-400">{aiError}</p>
                      <button
                        type="button"
                        onClick={() => handleEvaluate(entry.id)}
                        className="mt-3 text-sm font-bold text-rose-700 underline dark:text-rose-300"
                      >
                        ลองอีกครั้ง
                      </button>
                    </div>
                  )}

                  {analysis && !isEvaluating && (
                    <div className="mt-5 overflow-hidden rounded-3xl bg-gradient-to-br from-[#4f46e5] via-indigo-500 to-violet-600 p-px shadow-lg shadow-indigo-500/20">
                      <div className="rounded-[1.4rem] bg-white/95 p-5 dark:bg-[#121212]/95">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="m-0 text-[10px] font-black uppercase tracking-widest text-indigo-500">
                            AI Dashboard · สรุปผลเล่มสหกิจ
                          </p>
                          {analysis.is_critical ? (
                            <span className="rounded-full bg-rose-500 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                              แจ้งอาจารย์ด่วน
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                              ไม่ถึงขั้นวิกฤต
                            </span>
                          )}
                        </div>
                        <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
                          <div className="rounded-2xl bg-indigo-50 px-5 py-4 text-center dark:bg-indigo-500/10">
                            <p className="m-0 text-[10px] font-bold uppercase tracking-wide text-indigo-400">คะแนน</p>
                            <p className="m-0 mt-1 text-3xl font-black text-[#4f46e5] dark:text-indigo-300">
                              {analysis.score}
                            </p>
                          </div>
                          <p className="m-0 text-sm leading-relaxed text-slate-700 dark:text-zinc-200">
                            {analysis.feedback}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

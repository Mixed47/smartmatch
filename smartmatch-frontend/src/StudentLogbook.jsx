import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiJson, clearAuthSession, getAuthUser } from './apiClient';

const AI_TIMEOUT_MS = 70000;

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function toISODate(year, monthIndex, day) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function formatThaiDate(iso) {
  if (typeof iso !== 'string' || !iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${THAI_MONTHS[m - 1] || ''} ${y + 543}`.trim();
}

function buildCalendarCells(year, monthIndex) {
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= lastDay; day += 1) {
    cells.push(day);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
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
  clearAuthSession();
}

function normalizeLogbookEntries(payload) {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : [];
  return list
    .filter((item) => item && typeof item === 'object')
    .map((item) => toTimelineEntry(item));
}

function toAnalysis(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const ev = src.evaluation && typeof src.evaluation === 'object' ? src.evaluation : src;
  const feedback = String(ev.feedback || '').trim();
  if (!feedback) return null;
  return {
    feedback,
    score: String(ev.score ?? '').trim(),
    is_critical: Boolean(ev.is_critical),
  };
}

function toTimelineEntry(raw, fallback = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const fb = fallback && typeof fallback === 'object' ? fallback : {};
  const evaluation = toAnalysis(src) || toAnalysis(fb);
  return {
    id: src.id ?? fb.id ?? `${src.date || fb.date || 'entry'}-${Date.now()}`,
    date: String(src.date || fb.date || ''),
    tasks: String(src.tasks || src.activity || fb.tasks || ''),
    blocker: String(src.blocker ?? fb.blocker ?? ''),
    created_at: String(src.created_at || fb.created_at || ''),
    evaluation,
  };
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
  const [date, setDate] = useState(() => todayISO());
  const [tasks, setTasks] = useState('');
  const [blocker, setBlocker] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState([]);
  const [listError, setListError] = useState('');
  const [listLoading, setListLoading] = useState(true);
  const [analyses, setAnalyses] = useState({});
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(null);

  const hasBlocker = String(blocker || '').trim().length > 0;
  const [email, setEmail] = useState('');
  const today = todayISO();
  const calendarCells = useMemo(
    () => buildCalendarCells(viewYear, viewMonth),
    [viewYear, viewMonth],
  );
  const loggedDateSet = useMemo(
    () => new Set((Array.isArray(entries) ? entries : []).map((entry) => entry.date).filter(Boolean)),
    [entries],
  );
  const monthLoggedCount = useMemo(() => {
    const prefix = `${viewYear}-${pad2(viewMonth + 1)}`;
    return [...loggedDateSet].filter((iso) => iso.startsWith(prefix)).length;
  }, [loggedDateSet, viewYear, viewMonth]);
  const visibleEntries = useMemo(() => {
    const list = Array.isArray(entries) ? entries : [];
    if (!selectedHistoryDate) return list;
    return list.filter((entry) => entry.date === selectedHistoryDate);
  }, [entries, selectedHistoryDate]);

  const loadEntries = useCallback(async (silent = false) => {
    const token = localStorage.getItem('token');
    if (!token) return [];

    if (!silent) {
      setListLoading(true);
    }
    setListError('');
    try {
      const data = await apiJson('/api/logbook', { cache: 'no-store' });
      const next = normalizeLogbookEntries(data);
      setEntries((prev) => {
        const current = Array.isArray(prev) ? prev : [];
        if (next.length === 0 && current.length === 0) return current;
        if (next.length === 0 && current.length > 0) return current;
        return next;
      });
      setAnalyses((prev) => {
        const merged = { ...prev };
        next.forEach((entry) => {
          const analysis = toAnalysis(entry);
          if (analysis) {
            merged[entry.id] = analysis;
          }
        });
        return merged;
      });
      return next;
    } catch (err) {
      if (err?.status === 401) {
        return [];
      }
      setListError(err?.data?.error || 'ไม่สามารถโหลดประวัติเล่มสหกิจได้');
      return [];
    } finally {
      if (!silent) {
        setListLoading(false);
      }
    }
  }, []);

  const loadEntriesRef = useRef(loadEntries);
  loadEntriesRef.current = loadEntries;

  useEffect(() => {
    const user = getAuthUser();
    if (!user) {
      navigate('/login', { replace: true });
      return undefined;
    }
    if (user.role !== 'student') {
      navigate('/', { replace: true });
      return undefined;
    }
    void loadEntriesRef.current(false);
    apiJson('/api/me').then((data) => setEmail(data.email || '')).catch(() => setEmail(''));
    return undefined;
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
    const savedDate = date;
    const savedTasks = tasks.trim();
    const savedBlocker = blocker.trim();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    try {
      const data = await apiJson('/api/logbook', {
        method: 'POST',
        body: JSON.stringify({
          date: savedDate,
          tasks: savedTasks,
          blocker: savedBlocker,
        }),
        signal: controller.signal,
      });

      const created = toTimelineEntry(data, {
        date: savedDate,
        tasks: savedTasks,
        blocker: savedBlocker,
      });
      const analysis = toAnalysis(data) || created.evaluation;
      setEntries((prev) => [created, ...prev.filter((entry) => entry.id !== created.id)]);
      if (analysis) {
        setAnalyses((prev) => ({ ...prev, [created.id]: analysis }));
      }
      setSelectedHistoryDate(savedDate);
      const [savedYear, savedMonth] = savedDate.split('-').map(Number);
      if (savedYear && savedMonth) {
        setViewYear(savedYear);
        setViewMonth(savedMonth - 1);
      }
      setSuccess(
        analysis?.is_critical
          ? 'บันทึกสำเร็จ และ AI แจ้งว่าเป็นปัญหาด่วนให้อาจารย์แล้ว'
          : 'บันทึกเล่มสหกิจสำเร็จ และ AI ประเมินผลรายวันเรียบร้อยแล้ว',
      );
      setTasks('');
      setBlocker('');
      setDate(todayISO());
      await loadEntries(true);
    } catch (err) {
      if (err?.status === 401) {
        return;
      }
      const aborted = err?.name === 'AbortError';
      setError(
        aborted
          ? aiErrorMessage(0, '', true)
          : err?.status >= 500
            ? aiErrorMessage(err.status, err?.data?.error, false)
            : (err?.data?.error ? authErrorMessage(err.status, err.data.error) : 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'),
      );
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  };

  const shiftMonth = (delta) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const handlePickCalendarDay = (iso) => {
    setDate(iso);
    setSelectedHistoryDate(loggedDateSet.has(iso) ? iso : null);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] px-4 py-10 dark:bg-[#09090b]">
      <div className="mx-auto w-full max-w-6xl">
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
            Digital Logbook — บันทึกงานประจำวัน แล้วระบบจะให้ AI ประเมินผลทันที
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-[#161616]"
        >
          <div className="mb-6">
            <p className="m-0 text-[10px] font-black uppercase tracking-widest text-slate-400">
              ส่วนที่ 1
            </p>
            <h2 className="m-0 mt-1 text-lg font-black tracking-tight text-slate-900 dark:text-white">
              กรอกบันทึกประจำวัน
            </h2>
          </div>
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
                className="w-full rounded-2xl border border-white/10 bg-[#1a1a1a] px-4 py-3.5 text-sm text-white scheme-dark outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
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
                className="w-full resize-y rounded-2xl border border-white/10 bg-[#1a1a1a] px-4 py-3.5 text-sm leading-relaxed text-white placeholder-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
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
                className={`w-full resize-y rounded-2xl border bg-[#1a1a1a] px-4 py-3.5 text-sm leading-relaxed text-white placeholder-gray-400 outline-none transition focus:ring-2 ${
                  hasBlocker
                    ? 'border-amber-500/40 focus:border-amber-500 focus:ring-amber-500'
                    : 'border-white/10 focus:border-blue-500 focus:ring-blue-500'
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
              {loading ? 'กำลังบันทึกและให้ AI ประเมิน...' : 'บันทึกเล่มสหกิจ'}
            </button>
          </div>
        </form>

        <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#161616]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="m-0 text-[10px] font-black uppercase tracking-widest text-slate-400">
                ส่วนที่ 2 · Calendar
              </p>
              <h2 className="m-0 mt-1 text-lg font-black tracking-tight text-slate-900 dark:text-white">
                {THAI_MONTHS[viewMonth]} {viewYear + 543}
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
                aria-label="เดือนก่อนหน้า"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
                aria-label="เดือนถัดไป"
              >
                ›
              </button>
            </div>
          </div>

          <p className="mb-4 text-sm font-medium text-slate-500 dark:text-zinc-400">
            เดือนนี้จดแล้ว {monthLoggedCount} วัน · รวมทั้งหมด {loggedDateSet.size} วัน
          </p>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((day) => (
              <span key={day} className="py-1 text-[10px] font-black uppercase tracking-wide text-slate-400">
                {day}
              </span>
            ))}
            {calendarCells.map((day, index) => {
              if (!day) {
                return <span key={`empty-${index}`} className="h-10" />;
              }
              const iso = toISODate(viewYear, viewMonth, day);
              const logged = loggedDateSet.has(iso);
              const isToday = iso === today;
              const isSelected = iso === selectedHistoryDate;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => handlePickCalendarDay(iso)}
                  className={`relative h-10 rounded-xl text-sm font-bold transition ${
                    isSelected
                      ? 'bg-[#4f46e5] text-white shadow-md shadow-indigo-500/30'
                      : logged
                        ? 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                        : isToday
                          ? 'bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white'
                          : 'text-slate-600 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-white/5'
                  }`}
                  title={logged ? `จดแล้ว ${formatThaiDate(iso)}` : formatThaiDate(iso)}
                >
                  {day}
                  {logged && !isSelected && (
                    <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-500" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-[11px] font-bold text-slate-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
              จดแล้ว
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#4f46e5]" />
              วันที่เลือก
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-white/20" />
              วันนี้
            </span>
          </div>
        </aside>
        </div>

        <section className="mt-10">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="m-0 text-xl font-black tracking-tight text-slate-900 dark:text-white">
                ไทม์ไลน์การทำงาน
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-zinc-400">
                {selectedHistoryDate
                  ? `แสดงบันทึกวันที่ ${formatThaiDate(selectedHistoryDate)}`
                  : 'เรียงตามวันที่จดล่าสุด — กดวันที่บนปฏิทินเพื่อกรอง'}
              </p>
            </div>
            {selectedHistoryDate && (
              <button
                type="button"
                onClick={() => setSelectedHistoryDate(null)}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
              >
                ดูทั้งหมด
              </button>
            )}
          </div>

          {listLoading && entries.length === 0 && (
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

          {!listLoading && !listError && entries.length > 0 && visibleEntries.length === 0 && (
            <p className="rounded-3xl border border-dashed border-slate-200 px-5 py-8 text-center text-sm font-medium text-slate-400 dark:border-white/10">
              วันที่นี้ยังไม่มีบันทึก — กรอกฟอร์มด้านบนแล้วบันทึกได้เลย
            </p>
          )}

          <div className="relative space-y-4">
            {visibleEntries.length > 0 && (
              <span
                className="absolute bottom-6 left-[1.15rem] top-6 hidden w-px bg-slate-200 sm:block dark:bg-white/10"
                aria-hidden="true"
              />
            )}
            {visibleEntries.map((entry) => {
              const analysis = analyses[entry.id] || analyses[String(entry.id)] || entry.evaluation;

              return (
                <article
                  key={String(entry.id)}
                  className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#161616] sm:pl-12"
                >
                  <span className="absolute left-4 top-7 hidden h-3.5 w-3.5 rounded-full border-2 border-[#4f46e5] bg-white sm:block dark:bg-[#161616]" />
                  <div>
                    <p className="m-0 text-xs font-bold uppercase tracking-wide text-indigo-500 dark:text-indigo-300">
                      {formatThaiDate(entry.date)}
                    </p>
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

                  {analysis ? (
                    <div className="mt-5 overflow-hidden rounded-3xl bg-gradient-to-br from-[#4f46e5] via-indigo-500 to-violet-600 p-px shadow-lg shadow-indigo-500/20 dark:shadow-indigo-900/40">
                      <div className="rounded-[1.4rem] bg-white p-5 dark:bg-[#0f0f12]">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="m-0 text-[10px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-300">
                              AI Dashboard · สรุปผลเล่มสหกิจ
                            </p>
                            <h3 className="m-0 mt-1 text-base font-black text-slate-900 dark:text-white">
                              คำแนะนำจาก AI
                            </h3>
                          </div>
                          {analysis.is_critical && (
                            <span className="rounded-full bg-rose-600 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-sm shadow-rose-500/30">
                              รออาจารย์ตรวจสอบ
                            </span>
                          )}
                        </div>
                        <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
                          <div className="rounded-2xl bg-indigo-50 px-5 py-4 text-center dark:bg-indigo-500/15">
                            <p className="m-0 text-[10px] font-bold uppercase tracking-wide text-indigo-400 dark:text-indigo-300">คะแนน</p>
                            <p className="m-0 mt-1 text-3xl font-black text-[#4f46e5] dark:text-indigo-200">
                              {analysis.score || '-'}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-white/10 dark:bg-white/5">
                            <p className="m-0 text-[10px] font-black uppercase tracking-widest text-indigo-400 dark:text-indigo-300">
                              Feedback
                            </p>
                            <p className="m-0 mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-zinc-200">
                              {analysis.feedback}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-xs font-medium text-slate-400">ยังไม่มีผลการประเมินจาก AI สำหรับบันทึกนี้</p>
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiJson, clearAuthSession, getAuthUser } from './apiClient';
import { EmptyState, Skeleton, Spinner } from './ui';

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
    <div className="min-h-screen bg-bg px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link to="/student" className="btn btn-outline btn-sm">
            ← กลับแดชบอร์ด
          </Link>
          {email && <p className="text-xs font-medium text-ink-subtle">{email}</p>}
        </div>

        <div className="mb-8">
          <p className="eyebrow">Student Module · Digital Logbook</p>
          <h1 className="page-title mt-1.5">จดบันทึกเล่มสหกิจ</h1>
          <p className="page-subtitle">บันทึกงานประจำวัน แล้วระบบจะให้ AI ประเมินผลและให้คำแนะนำทันที</p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <form onSubmit={handleSubmit} className="panel p-5 sm:p-8">
            <div className="mb-6">
              <p className="eyebrow">ส่วนที่ 1</p>
              <h2 className="section-title mt-1">กรอกบันทึกประจำวัน</h2>
            </div>

            <div className="space-y-5">
              <div>
                <label htmlFor="logbook-date" className="label">วันที่</label>
                <input
                  id="logbook-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label htmlFor="logbook-tasks" className="label">รายละเอียดงานที่ทำ</label>
                <textarea
                  id="logbook-tasks"
                  required
                  rows={5}
                  value={tasks}
                  onChange={(e) => setTasks(e.target.value)}
                  placeholder="สรุปงานที่ทำในวันนี้ เช่น เขียน API, ทดสอบระบบ, ประชุมกับพี่เลี้ยง..."
                  className="textarea"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="logbook-blocker" className="label mb-0">ปัญหา / อุปสรรค</label>
                  <span className="badge badge-neutral">ไม่บังคับ</span>
                </div>
                <textarea
                  id="logbook-blocker"
                  rows={4}
                  value={blocker}
                  onChange={(e) => setBlocker(e.target.value)}
                  placeholder="เว้นว่างได้ถ้าวันนี้ไม่มีปัญหา — กรอกเมื่อติดปัญหาหรือมีอุปสรรคที่ต้องการแจ้งอาจารย์"
                  className={`textarea ${hasBlocker ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-500/20' : ''}`}
                />
                <p className="field-hint">
                  {hasBlocker
                    ? 'ระบบจะบันทึกว่าวันนี้ติดปัญหา เพื่อให้พี่เลี้ยง/อาจารย์ติดตามได้'
                    : 'ออปชันเสริม: กรอกเฉพาะเมื่อมีปัญหาหรืออุปสรรค'}
                </p>
              </div>

              {error && <p className="alert alert-danger" role="alert">{error}</p>}
              {success && <p className="alert alert-success" role="status">{success}</p>}

              <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-block">
                {loading && <Spinner />}
                {loading ? 'กำลังบันทึกและให้ AI ประเมิน...' : 'บันทึกเล่มสหกิจ'}
              </button>
            </div>
          </form>

          <aside className="panel p-5 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">ส่วนที่ 2 · ปฏิทิน</p>
                <h2 className="section-title mt-1">{THAI_MONTHS[viewMonth]} {viewYear + 543}</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => shiftMonth(-1)} className="icon-btn h-9 w-9" aria-label="เดือนก่อนหน้า">‹</button>
                <button type="button" onClick={() => shiftMonth(1)} className="icon-btn h-9 w-9" aria-label="เดือนถัดไป">›</button>
              </div>
            </div>

            <p className="mb-4 text-sm text-ink-muted">
              เดือนนี้จดแล้ว <strong className="text-ink">{monthLoggedCount}</strong> วัน · รวมทั้งหมด <strong className="text-ink">{loggedDateSet.size}</strong> วัน
            </p>

            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((day) => (
                <span key={day} className="py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
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
                    aria-pressed={isSelected}
                    className={`relative h-10 rounded-xl text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                      isSelected
                        ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                        : logged
                          ? 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300'
                          : isToday
                            ? 'bg-surface-2 text-ink ring-1 ring-line-strong'
                            : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
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

            <div className="mt-5 flex flex-wrap gap-4 text-xs font-medium text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> จดแล้ว
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-brand-600" /> วันที่เลือก
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-line-strong" /> วันนี้
              </span>
            </div>
          </aside>
        </div>

        <section className="mt-10">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="section-title text-lg sm:text-xl">ไทม์ไลน์การทำงาน</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {selectedHistoryDate
                  ? `แสดงบันทึกวันที่ ${formatThaiDate(selectedHistoryDate)}`
                  : 'เรียงตามวันที่จดล่าสุด — กดวันที่บนปฏิทินเพื่อกรอง'}
              </p>
            </div>
            {selectedHistoryDate && (
              <button type="button" onClick={() => setSelectedHistoryDate(null)} className="btn btn-outline btn-sm">
                ดูทั้งหมด
              </button>
            )}
          </div>

          {listLoading && entries.length === 0 && (
            <div className="space-y-4" role="status" aria-label="กำลังโหลดประวัติ">
              {[0, 1].map((i) => (
                <div key={i} className="panel space-y-3 p-5 sm:p-6">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ))}
            </div>
          )}

          {!listLoading && listError && (
            <div className="alert alert-danger flex-col items-start" role="alert">
              <p className="font-bold">โหลดประวัติไม่สำเร็จ</p>
              <p>{listError}</p>
            </div>
          )}

          {!listLoading && !listError && entries.length === 0 && (
            <EmptyState title="ยังไม่มีบันทึกในเล่มสหกิจ" description="กรอกฟอร์มด้านบนเพื่อเริ่มบันทึกวันแรกของคุณ" />
          )}

          {!listLoading && !listError && entries.length > 0 && visibleEntries.length === 0 && (
            <EmptyState title="วันที่นี้ยังไม่มีบันทึก" description="กรอกฟอร์มด้านบนแล้วบันทึกได้เลย" />
          )}

          <div className="relative space-y-4">
            {visibleEntries.length > 0 && (
              <span className="absolute bottom-6 left-[1.15rem] top-6 hidden w-px bg-line sm:block" aria-hidden="true" />
            )}
            {visibleEntries.map((entry) => {
              const analysis = analyses[entry.id] || analyses[String(entry.id)] || entry.evaluation;

              return (
                <article key={String(entry.id)} className="panel relative p-5 sm:p-6 sm:pl-12">
                  <span className="absolute left-4 top-7 hidden h-3.5 w-3.5 rounded-full border-2 border-brand-600 bg-surface sm:block" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                      {formatThaiDate(entry.date)}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{entry.tasks}</p>
                    {entry.blocker ? (
                      <p className="alert alert-warning mt-3">อุปสรรค: {entry.blocker}</p>
                    ) : (
                      <p className="mt-3 text-xs text-ink-subtle">วันนี้ไม่มีอุปสรรคที่ระบุ</p>
                    )}
                  </div>

                  {analysis ? (
                    <div className="mt-5 rounded-2xl border border-brand-200 bg-brand-50/50 p-4 sm:p-5 dark:border-brand-500/25 dark:bg-brand-500/5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="eyebrow text-brand-600 dark:text-brand-300">AI Dashboard · สรุปผลเล่มสหกิจ</p>
                          <h3 className="card-title mt-1">คำแนะนำจาก AI</h3>
                        </div>
                        {analysis.is_critical && <span className="badge badge-danger">รออาจารย์ตรวจสอบ</span>}
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
                        <div className="rounded-xl border border-line bg-surface px-5 py-4 text-center">
                          <p className="eyebrow">คะแนน</p>
                          <p className="mt-1 text-3xl font-bold text-brand-600 dark:text-brand-400">
                            {analysis.score || '-'}
                          </p>
                        </div>
                        <div className="rounded-xl border border-line bg-surface p-4">
                          <p className="eyebrow">Feedback</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{analysis.feedback}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-ink-subtle">ยังไม่มีผลการประเมินจาก AI สำหรับบันทึกนี้</p>
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

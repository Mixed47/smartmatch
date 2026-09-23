import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { CancelRequest, Evaluation, Petition } from './types';
import { apiJson, friendlyApiError } from './apiClient';
import TeacherPetitions, { petitionError, resolveTeacherPetition } from './TeacherPetitions';
import { EmptyState, PageHeading, SkeletonList, Spinner } from './ui';

interface Application { id: string; name: string; job_title: string; company: string; status: string; }
interface Message { id: number; application_id: string; sender: string; text: string; created_at: string; }
interface Logbook { id: number; name: string; category: string; activity: string; blocker: string; created_at: string; date?: string; }
interface CriticalLogbook {
  id: number;
  student_id?: number;
  first_name?: string;
  last_name?: string;
  student_name?: string;
  date?: string;
  blocker?: string;
  ai_feedback?: string;
  feedback?: string;
}

const IconChat = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.436 3 11.996c0 2.29.932 4.35 2.44 5.86l-1.92 2.91a.75.75 0 00.91 1.09l3.22-1.39a9.123 9.123 0 004.35 1.034z" /></svg>;
const IconClipboard = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>;
const IconTrophy = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M18.75 4.236c.982.143 1.954.317 2.916.52a6.003 6.003 0 01-5.395 4.972m0 0a8.001 8.001 0 00-10.522 0m10.522 0a7.494 7.494 0 01-1.04 3.172M7.73 9.728a7.494 7.494 0 001.04 3.172m0 0h6.458" /></svg>;
const IconWarning = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>;

const containerVariants: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants: Variants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 110, damping: 16 } } };
const formatThaiDate = (dateString: string) => { if (!dateString) return ''; return new Date(dateString).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }); };

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  Matched: { cls: 'badge-success', label: 'Matched' },
  Canceled: { cls: 'badge-neutral', label: 'สละสิทธิ์แล้ว' },
  Completed: { cls: 'badge-info', label: 'ประเมินผลแล้ว' },
  Rejected: { cls: 'badge-danger', label: 'ไม่ผ่าน' },
  Pending: { cls: 'badge-warning', label: 'รอพิจารณา' },
};

export default function Teacher({ activeMenu, showToast, openInbox }: { activeMenu?: string; setActiveMenu?: (m: string) => void; showToast?: (msg: string, type: 'success' | 'error' | 'info') => void; openInbox?: (peerId?: number | null) => void; }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [cancelRequests, setCancelRequests] = useState<CancelRequest[]>([]);
  const [petitions, setPetitions] = useState<Petition[]>([]);
  const [resolvingPetitionId, setResolvingPetitionId] = useState<number | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [typedMessage, setTypedMessage] = useState('');
  const [logs, setLogs] = useState<Logbook[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [criticalLogs, setCriticalLogs] = useState<CriticalLogbook[]>([]);
  const [criticalLoading, setCriticalLoading] = useState(true);
  const [criticalError, setCriticalError] = useState('');
  const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);
  const [activeLogCardId, setActiveLogCardId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const pendingAckRef = useRef<Set<number>>(new Set());

  const notify = (msg: string, type: 'success' | 'error' | 'info' = 'success') => { if (showToast) showToast(msg, type); };

  const studentAlertName = (alert: CriticalLogbook) => {
    const fromParts = `${alert.first_name || ''} ${alert.last_name || ''}`.trim();
    return fromParts || alert.student_name || 'นักศึกษา';
  };

  const loadCriticalAlerts = (isInitial = false) => {
    if (isInitial) setCriticalLoading(true);
    return apiJson('/api/teacher/critical-logbooks')
      .then((data) => {
        const list: CriticalLogbook[] = Array.isArray(data) ? data : (data?.data || []);
        setCriticalLogs(list.filter((item) => !pendingAckRef.current.has(item.id)));
        setCriticalError('');
      })
      .catch((err) => {
        setCriticalError(friendlyApiError(err, 'โหลดแจ้งเตือนปัญหาด่วนไม่สำเร็จ'));
      })
      .finally(() => {
        if (isInitial) setCriticalLoading(false);
      });
  };

  const loadData = () => {
    Promise.all([
      apiJson('/api/my-applications').then((data) => setApplications(data || [])),
      apiJson('/api/logbook').then((data) => setLogs(Array.isArray(data) ? data : (data?.data || []))),
      apiJson('/api/cancel-requests').then((data) => setCancelRequests(data || [])),
      apiJson('/api/petitions').then((data) => setPetitions(Array.isArray(data) ? data : [])),
      apiJson('/api/evaluations').then((data) => setEvaluations(data || [])),
      loadCriticalAlerts(false),
    ])
      .then(() => setLoadError(''))
      .catch((err) => setLoadError(friendlyApiError(err, 'โหลดข้อมูลอาจารย์ไม่สำเร็จ')))
      .finally(() => setDataLoading(false));
  };

  const handleAcknowledge = async (id: number) => {
    const previous = criticalLogs;
    pendingAckRef.current.add(id);
    setAcknowledgingId(id);
    setCriticalLogs((current) => current.filter((item) => item.id !== id));
    try {
      await apiJson(`/api/teacher/critical-logbooks/${id}/acknowledge`, { method: 'PUT' });
      notify('รับทราบปัญหาแล้ว', 'success');
    } catch (err) {
      pendingAckRef.current.delete(id);
      setCriticalLogs(previous);
      notify(friendlyApiError(err, 'อัปเดตสถานะไม่สำเร็จ'), 'error');
    } finally {
      setAcknowledgingId(null);
    }
  };

  useEffect(() => {
    loadCriticalAlerts(true);
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeChatId) return;
    const fetchChat = () => apiJson(`/api/chat/messages?application_id=${encodeURIComponent(activeChatId)}`).then((data) => setChatMessages(data || [])).catch(() => {});
    fetchChat(); const interval = setInterval(fetchChat, 2000); return () => clearInterval(interval);
  }, [activeChatId]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault(); if (!typedMessage.trim() || !activeChatId) return;
    try {
      await apiJson('/api/chat/send', { method: 'POST', body: JSON.stringify({ application_id: activeChatId, text: typedMessage.trim() }) });
      setTypedMessage('');
    } catch (err) {
      notify(friendlyApiError(err, 'ส่งข้อความไม่สำเร็จ'), 'error');
    }
  };

  // Student conversations live in the universal inbox (keyed by user id), not in
  // the per-application chat, so this hands off instead of opening a drawer.
  const chatWithStudent = (studentId?: number) => {
    if (!studentId || !openInbox) {
      notify('ยังไม่พบบัญชีผู้ใช้ของนักศึกษาคนนี้ กรุณาเปิดจากกล่องข้อความ', 'error');
      return;
    }
    openInbox(studentId);
  };

  const handleResolvePetition = async (id: number, status: 'Approved' | 'Rejected') => {
    setResolvingPetitionId(id);
    try {
      await resolveTeacherPetition(id, status);
      notify(status === 'Approved' ? 'อนุมัติคำร้องแล้ว' : 'ปฏิเสธคำร้องแล้ว', 'success');
      loadData();
    } catch (err) {
      notify(petitionError(err), 'error');
    } finally {
      setResolvingPetitionId(null);
    }
  };

  const handleResolveRequest = async (id: number, appId: string, action: 'approve' | 'reject') => {
    try {
      await apiJson('/api/resolve-cancel', {
        method: 'POST',
        body: JSON.stringify({ id, application_id: appId, action }),
      });
      notify(action === 'approve' ? 'อนุมัติการสละสิทธิ์แล้ว' : 'ปฏิเสธคำร้องแล้ว', 'success');
      loadData();
    } catch (err) {
      notify(friendlyApiError(err, 'จัดการคำร้องไม่สำเร็จ'), 'error');
    }
  };

  const studentLogsOf = (studentName: string) => logs.filter((l) => l.name.includes(studentName.split(' ')[0]));

  const generateTeacherHeatmap = (studentName: string) => {
    const days = []; const today = new Date(); const studentLogs = studentLogsOf(studentName);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i); const dateStr = d.toISOString().split('T')[0];
      days.push({ date: dateStr, hasLog: studentLogs.some(log => log.date === dateStr || log.created_at === dateStr) });
    }
    return days;
  };

  const checkIssues = (studentName: string) => studentLogsOf(studentName).some((log) => log.blocker && log.blocker.trim() !== '');

  const total = new Set(applications.map(a => a.name)).size;
  const matched = applications.filter(a => a.status === 'Matched' || a.status === 'Completed').length;
  const pending = petitions.length + cancelRequests.length;
  const petitionsFocus = activeMenu === 'teacher-petitions';

  return (
    <div className="relative w-full text-ink">
      {loadError && <div className="alert alert-danger mb-6" role="alert">{loadError}</div>}

      <AnimatePresence mode="wait">
        <motion.div key="teacher-dashboard" variants={containerVariants} initial="hidden" animate="show" exit="hidden" className="w-full">

          <motion.div variants={itemVariants}>
            <PageHeading
              title={petitionsFocus ? 'จัดการคำร้อง' : 'ติดตามนักศึกษา'}
              subtitle={petitionsFocus ? 'อนุมัติหรือปฏิเสธคำร้องของนักศึกษา' : 'ระบบติดตามและอนุมัติการฝึกงานของนักศึกษาในความดูแล'}
              eyebrow="Teacher Module"
            />
          </motion.div>

          {/* ---------- Critical AI alerts ---------- */}
          {!petitionsFocus && (
            <motion.section variants={itemVariants} className="panel mb-8 border-orange-300/80 dark:border-orange-700/50" aria-labelledby="critical-alerts-title">
              <div className="panel-header border-orange-200 bg-orange-50 dark:border-orange-800/50 dark:bg-orange-950/30">
                <h3 id="critical-alerts-title" className="section-title flex items-center gap-2 text-orange-900 dark:text-orange-300">
                  <IconWarning /> แจ้งเตือนปัญหาด่วนจากนักศึกษา
                </h3>
                {!criticalLoading && !criticalError && (
                  <span className={`badge ${criticalLogs.length > 0 ? 'badge-danger' : 'badge-neutral'}`}>{criticalLogs.length} รายการ</span>
                )}
              </div>

              <div className="panel-body">
                {criticalLoading && <SkeletonList count={2} rows={3} />}

                {!criticalLoading && criticalError && (
                  <div className="alert alert-danger flex-col items-start" role="alert">
                    <p>{criticalError}</p>
                    <button type="button" onClick={() => loadCriticalAlerts(true)} className="btn btn-danger btn-sm mt-2">ลองใหม่</button>
                  </div>
                )}

                {!criticalLoading && !criticalError && criticalLogs.length === 0 && (
                  <EmptyState title="ไม่มีปัญหาด่วนที่รอรับทราบ" description="เมื่อ AI ตรวจพบปัญหาร้ายแรงจากบันทึกประจำวัน จะแจ้งเตือนที่นี่ทันที" />
                )}

                {!criticalLoading && !criticalError && (
                  <AnimatePresence>
                    {criticalLogs.map((alert) => (
                      <motion.article
                        key={alert.id}
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, height: 0, marginBottom: 0 }}
                        className="rounded-2xl border border-rose-200 bg-surface p-4 shadow-sm sm:p-5 dark:border-rose-800/50"
                      >
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-3">
                              <h4 className="text-base font-bold text-ink sm:text-lg">{studentAlertName(alert)}</h4>
                              <span className="badge badge-danger">ปัญหาด่วน</span>
                            </div>
                            <p className="text-xs text-ink-muted">
                              วันที่บันทึก: <span className="font-semibold text-ink">{formatThaiDate(alert.date || '')}</span>
                            </p>

                            <div className="alert alert-danger mt-3 flex-col items-start">
                              <p className="eyebrow text-rose-600 dark:text-rose-300">อุปสรรค (Blocker)</p>
                              <p className="text-sm">{alert.blocker?.trim() || 'ไม่ระบุอุปสรรค'}</p>
                            </div>

                            <div className="alert alert-warning mt-3 flex-col items-start">
                              <p className="eyebrow text-orange-700 dark:text-orange-300">คำแนะนำจาก AI</p>
                              <p className="text-sm">{alert.ai_feedback || alert.feedback || 'ยังไม่มีคำแนะนำจาก AI'}</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={acknowledgingId === alert.id}
                            onClick={() => handleAcknowledge(alert.id)}
                            className="btn btn-warning-soft btn-sm shrink-0"
                          >
                            {acknowledgingId === alert.id ? <><Spinner /> กำลังบันทึก...</> : 'รับทราบ / ให้คำปรึกษาแล้ว'}
                          </button>
                        </div>
                      </motion.article>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </motion.section>
          )}

          {/* ---------- Stats ---------- */}
          <motion.div variants={containerVariants} className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
            <motion.div variants={itemVariants} className="card card-pad text-center">
              <p className="eyebrow">นักศึกษาทั้งหมด</p>
              <p className="stat-value mt-2 text-brand-600 dark:text-brand-400">{total}</p>
            </motion.div>
            <motion.div variants={itemVariants} className="card card-pad text-center">
              <p className="eyebrow">จับคู่สำเร็จ</p>
              <p className="stat-value mt-2 text-emerald-600 dark:text-emerald-400">{matched}</p>
            </motion.div>
            <motion.div variants={itemVariants} className="card card-pad text-center">
              <p className="eyebrow">คำร้องรออนุมัติ</p>
              <p className={`stat-value mt-2 ${pending > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>{pending}</p>
            </motion.div>
          </motion.div>

          <motion.div variants={itemVariants}>
            <TeacherPetitions
              petitions={petitions}
              resolvingId={resolvingPetitionId}
              onResolve={handleResolvePetition}
            />
          </motion.div>

          {/* ---------- Waiver requests ---------- */}
          {!petitionsFocus && cancelRequests.length > 0 && (
            <motion.section variants={itemVariants} className="panel mb-8 border-rose-200 dark:border-rose-900/50">
              <div className="panel-header border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/20">
                <h3 className="section-title text-rose-800 dark:text-rose-300">คำร้องขอสละสิทธิ์สถานที่ฝึกงาน</h3>
                <span className="badge badge-danger">{cancelRequests.length} รายการ</span>
              </div>
              <div className="panel-body">
                {cancelRequests.map((req) => (
                  <div key={req.id} className="card card-pad">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-base font-bold text-ink sm:text-lg">{req.student_name}</h4>
                        <p className="mt-1 text-xs text-ink-muted">
                          ขอยกเลิกบริษัท: <span className="font-semibold text-brand-600 dark:text-brand-400">{req.company_name}</span>
                        </p>
                        <p className="alert alert-danger mt-3"><strong>เหตุผล:</strong> {req.reason}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 xl:justify-end">
                        <button
                          type="button"
                          onClick={() => chatWithStudent(applications.find((a) => a.id === req.application_id)?.student_id)}
                          className="btn btn-outline btn-sm"
                        >
                          <IconChat /> สอบถามนักศึกษา
                        </button>
                        <button type="button" onClick={() => handleResolveRequest(req.id, req.application_id, 'reject')} className="btn btn-outline btn-sm">ไม่อนุมัติ</button>
                        <button type="button" onClick={() => handleResolveRequest(req.id, req.application_id, 'approve')} className="btn btn-danger btn-sm">อนุมัติสละสิทธิ์</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {/* ---------- Student monitoring ---------- */}
          {!petitionsFocus && (
            <motion.section variants={itemVariants} className="panel">
              <div className="panel-header">
                <h3 className="section-title">สถานะและสมุดบันทึกของนักศึกษา</h3>
                <span className="badge badge-neutral">{applications.length} รายการ</span>
              </div>

              <div className="panel-body">
                {dataLoading && applications.length === 0 && <SkeletonList count={3} />}

                {!dataLoading && applications.length === 0 && (
                  <EmptyState title="ยังไม่มีข้อมูลนักศึกษาในระบบ" description="เมื่อมีนักศึกษาสมัครฝึกงาน ข้อมูลจะปรากฏที่นี่" />
                )}

                {applications.map((app, index) => {
                  const hasIssue = checkIssues(app.name);
                  const ev = evaluations.find(e => e.application_id === app.id);
                  const badge = STATUS_BADGE[app.status] || { cls: 'badge-neutral', label: app.status };
                  const entries = studentLogsOf(app.name);

                  return (
                    <motion.div
                      key={app.id || index}
                      variants={itemVariants}
                      className={`card card-pad ${hasIssue ? 'border-rose-300 dark:border-rose-900/60' : ''}`}
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-3">
                            <h4 className="text-base font-bold text-ink sm:text-lg">{app.name}</h4>
                            <span className={`badge ${badge.cls}`}>{badge.label}</span>
                            {hasIssue && <span className="badge badge-warning">มีอุปสรรคที่ต้องติดตาม</span>}
                          </div>
                          <p className="text-xs text-ink-muted">ตำแหน่ง: <span className="font-semibold text-ink">{app.job_title}</span></p>
                          <p className="mt-1 text-xs text-ink-muted">บริษัท: <span className="font-semibold text-brand-600 dark:text-brand-400">{app.company}</span></p>

                          {app.status === 'Completed' && ev && (
                            <div className="alert alert-info mt-4">
                              <span className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400"><IconTrophy /></span>
                              <span>
                                <span className="block font-bold">ผลการประเมิน: {ev.score} / 100</span>
                                {ev.comment && <span className="mt-1 block text-xs opacity-90">“{ev.comment}”</span>}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 xl:justify-end">
                          <button
                            type="button"
                            onClick={() => { setActiveChatId(null); setActiveLogCardId(activeLogCardId === app.id ? null : app.id); }}
                            aria-expanded={activeLogCardId === app.id}
                            className={`btn btn-sm ${activeLogCardId === app.id ? 'btn-neutral' : 'btn-warning-soft'}`}
                          >
                            <IconClipboard /> {activeLogCardId === app.id ? 'ปิดบันทึก' : 'บันทึกประจำวัน'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setActiveLogCardId(null); setActiveChatId(null); chatWithStudent(app.student_id); }}
                            className="btn btn-primary btn-sm"
                          >
                            <IconChat /> นักศึกษา
                          </button>
                          <button
                            type="button"
                            onClick={() => { setActiveLogCardId(null); setActiveChatId(activeChatId === `${app.id}-TH` ? null : `${app.id}-TH`); }}
                            aria-expanded={activeChatId === `${app.id}-TH`}
                            className={`btn btn-sm ${activeChatId === `${app.id}-TH` ? 'btn-neutral' : 'btn-outline'}`}
                          >
                            <IconChat /> HR
                          </button>
                        </div>
                      </div>

                      {/* Logbook drawer */}
                      <AnimatePresence>
                        {activeLogCardId === app.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0, marginTop: 0 }}
                            animate={{ height: 'auto', opacity: 1, marginTop: 20 }}
                            exit={{ height: 0, opacity: 0, marginTop: 0 }}
                            className="w-full overflow-hidden rounded-2xl border border-line"
                          >
                            <div className="border-b border-line bg-surface-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                              สมุดบันทึกประจำวันของ {app.name}
                            </div>
                            <div className="flex flex-col lg:flex-row">
                              <div className="border-b border-line p-4 sm:p-5 lg:w-1/3 lg:border-b-0 lg:border-r">
                                <p className="eyebrow mb-3">ปฏิทินการบันทึก (30 วัน)</p>
                                <div className="grid grid-cols-7 gap-1.5">
                                  {generateTeacherHeatmap(app.name).map((day, i) => (
                                    <div
                                      key={i}
                                      title={`${formatThaiDate(day.date)}${day.hasLog ? ' · จดแล้ว' : ' · ไม่มีบันทึก'}`}
                                      className={`aspect-square w-full rounded-md transition ${day.hasLog ? 'bg-emerald-500' : 'bg-surface-2 dark:bg-white/5'}`}
                                    />
                                  ))}
                                </div>
                                <p className="field-hint">สีเขียว = วันที่นักศึกษาบันทึกงาน</p>
                              </div>

                              <div className="max-h-80 w-full space-y-4 overflow-y-auto p-4 sm:p-5 lg:w-2/3">
                                {entries.length === 0 ? (
                                  <EmptyState title="ยังไม่มีบันทึก" description="นักศึกษาคนนี้ยังไม่ได้บันทึกสมุดสหกิจ" />
                                ) : (
                                  entries.map((log) => (
                                    <article key={log.id} className="card card-pad">
                                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                        <span className="badge badge-neutral">{log.category}</span>
                                        <span className="text-xs font-medium text-ink-subtle">{formatThaiDate(log.date || log.created_at)}</span>
                                      </div>
                                      <p className="eyebrow mb-2">รายละเอียดงานที่ทำ</p>
                                      <p className="rounded-xl border border-line bg-surface-2 p-3.5 text-sm leading-relaxed text-ink">{log.activity}</p>
                                      {log.blocker && log.blocker.trim() !== '' && (
                                        <div className="alert alert-danger mt-3 flex-col items-start">
                                          <p className="eyebrow text-rose-600 dark:text-rose-300">ปัญหาที่พบ</p>
                                          <p className="text-sm">{log.blocker}</p>
                                        </div>
                                      )}
                                    </article>
                                  ))
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Chat drawer */}
                      <AnimatePresence>
                        {activeChatId === `${app.id}-TH` && (
                          <motion.div
                            initial={{ height: 0, opacity: 0, marginTop: 0 }}
                            animate={{ height: 'auto', opacity: 1, marginTop: 20 }}
                            exit={{ height: 0, opacity: 0, marginTop: 0 }}
                            className="w-full overflow-hidden rounded-2xl border border-line"
                          >
                            <div className="border-b border-line bg-surface-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                              ห้องสนทนากับ:{' '}
                              <span className="font-bold text-brand-600 dark:text-brand-400">HR ({app.company})</span>
                            </div>
                            <div className="chat-window h-64">
                              {chatMessages.length === 0
                                ? <p className="my-auto text-center text-sm text-ink-muted">เริ่มพิมพ์ข้อความเพื่อสนทนา...</p>
                                : chatMessages.map((m) => (
                                  <div key={m.id} className={`bubble ${m.sender === 'teacher' ? 'bubble-me' : 'bubble-them'}`}>
                                    <p>{m.text}</p>
                                  </div>
                                ))}
                            </div>
                            <form onSubmit={handleSendChat} className="flex gap-2 border-t border-line bg-surface p-3">
                              <label htmlFor={`teacher-chat-${app.id}`} className="sr-only">ข้อความ</label>
                              <input id={`teacher-chat-${app.id}`} type="text" value={typedMessage} onChange={(e) => setTypedMessage(e.target.value)} placeholder="พิมพ์ข้อความ..." className="input py-2.5" />
                              <button type="submit" disabled={!typedMessage.trim()} className="btn btn-neutral btn-sm shrink-0">ส่ง</button>
                            </form>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </motion.section>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

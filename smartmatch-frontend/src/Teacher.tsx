import { useState, useEffect } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { CancelRequest, Evaluation } from './types';

interface Application { id: string; name: string; job_title: string; company: string; status: string; }
interface Message { id: number; application_id: string; sender: string; text: string; created_at: string; }
interface Logbook { id: number; name: string; category: string; activity: string; blocker: string; created_at: string; date?: string; }

// Premium Icons
const IconChat = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.436 3 11.996c0 2.29.932 4.35 2.44 5.86l-1.92 2.91a.75.75 0 00.91 1.09l3.22-1.39a9.123 9.123 0 004.35 1.034z" /></svg>;
const IconClipboard = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>;
const IconTrophy = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M18.75 4.236c.982.143 1.954.317 2.916.52a6.003 6.003 0 01-5.395 4.972m0 0a8.001 8.001 0 00-10.522 0m10.522 0a7.494 7.494 0 01-1.04 3.172M7.73 9.728a7.494 7.494 0 001.04 3.172m0 0h6.458" /></svg>;

const containerVariants: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants: Variants = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } } };
const formatThaiDate = (dateString: string) => { if (!dateString) return ''; return new Date(dateString).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }); };

export default function Teacher({ showToast }: { activeMenu?: string; setActiveMenu?: (m: string) => void; showToast?: (msg: string, type: 'success' | 'error' | 'info') => void; }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [cancelRequests, setCancelRequests] = useState<CancelRequest[]>([]); 
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [typedMessage, setTypedMessage] = useState('');
  const [logs, setLogs] = useState<Logbook[]>([]);
  const [activeLogCardId, setActiveLogCardId] = useState<string | null>(null);

  const notify = (msg: string, type: 'success' | 'error' | 'info' = 'success') => { if (showToast) showToast(msg, type); };

  const loadData = () => {
    fetch('https://smartmatch-api.onrender.com/api/my-applications').then(r=>r.json()).then(data => setApplications(data || []));
    fetch('https://smartmatch-api.onrender.com/api/logbook').then(r=>r.json()).then(data => setLogs(data || []));
    fetch('https://smartmatch-api.onrender.com/api/cancel-requests').then(r=>r.json()).then(data => setCancelRequests(data || [])); 
    fetch('https://smartmatch-api.onrender.com/api/evaluations').then(r=>r.json()).then(data => setEvaluations(data || []));
  };

  useEffect(() => { 
    loadData(); 
    const interval = setInterval(loadData, 3000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeChatId) return;
    const fetchChat = () => fetch(`https://smartmatch-api.onrender.com/api/chat/messages?application_id=${activeChatId}`).then(r=>r.json()).then(data => setChatMessages(data || []));
    fetchChat(); const interval = setInterval(fetchChat, 2000); return () => clearInterval(interval);
  }, [activeChatId]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault(); if (!typedMessage.trim() || !activeChatId) return;
    await fetch('https://smartmatch-api.onrender.com/api/chat/send', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ application_id: activeChatId, sender: 'teacher', text: typedMessage.trim() }) });
    setTypedMessage('');
  };

  const handleResolveRequest = async (id: number, appId: string, action: 'approve' | 'reject') => {
    await fetch('https://smartmatch-api.onrender.com/api/resolve-cancel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, application_id: appId, action })
    });
    notify(action === 'approve' ? 'อนุมัติการสละสิทธิ์แล้ว' : 'ปฏิเสธคำร้องแล้ว', 'success');
    loadData();
  };

  const generateTeacherHeatmap = (studentName: string) => {
    const days = []; const today = new Date(); const studentLogs = logs.filter(l => l.name.includes(studentName.split(' ')[0])); 
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i); const dateStr = d.toISOString().split('T')[0];
      days.push({ date: dateStr, hasLog: studentLogs.some(log => log.date === dateStr || log.created_at === dateStr) });
    }
    return days;
  };

  const checkIssues = (studentName: string) => { return logs.filter(l => l.name.includes(studentName.split(' ')[0])).some(log => log.blocker && log.blocker.trim() !== ''); };

  const total = new Set(applications.map(a => a.name)).size;
  const matched = applications.filter(a => a.status === 'Matched' || a.status === 'Completed').length;
  const pending = cancelRequests.length; 

  return (
    <div className="relative w-full pb-20 transition-colors duration-500 text-zinc-900 dark:text-zinc-100">
      <AnimatePresence mode="wait">
        <motion.div key="teacher-dashboard" variants={containerVariants} initial="hidden" animate="show" exit="hidden" className="w-full max-w-6xl mx-auto">
          
          <motion.div variants={itemVariants} className="flex flex-col gap-4 mb-10 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              <div><h2 className="m-0 text-3xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-zinc-900 to-zinc-600 dark:from-white dark:to-zinc-400">Monitoring Dashboard</h2><p className="m-0 mt-1 text-sm font-medium tracking-wide text-zinc-500 dark:text-zinc-400">ระบบติดตามและอนุมัติการฝึกงาน</p></div>
            </div>
          </motion.div>

          <motion.div variants={containerVariants} className="grid grid-cols-1 gap-6 mb-10 md:grid-cols-3">
            <motion.div variants={itemVariants} whileHover={{ y: -4 }} className="p-8 text-center bg-white/70 dark:bg-[#161616] backdrop-blur-xl border border-zinc-200/50 dark:border-white/5 shadow-sm rounded-[2rem] relative overflow-hidden group"><div className="absolute inset-0 transition-opacity duration-500 opacity-0 bg-indigo-500/5 dark:bg-indigo-500/10 group-hover:opacity-100"></div><p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 tracking-widest uppercase mb-2 relative z-10">Total Students</p><h3 className="relative z-10 m-0 text-6xl font-black tracking-tighter text-indigo-600 dark:text-indigo-400">{total}</h3></motion.div>
            <motion.div variants={itemVariants} whileHover={{ y: -4 }} className="p-8 text-center bg-white/70 dark:bg-[#161616] backdrop-blur-xl border border-zinc-200/50 dark:border-white/5 shadow-sm rounded-[2rem] relative overflow-hidden group"><div className="absolute inset-0 transition-opacity duration-500 opacity-0 bg-emerald-500/5 dark:bg-emerald-500/10 group-hover:opacity-100"></div><p className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 tracking-widest uppercase mb-2 relative z-10">Successfully Matched</p><h3 className="relative z-10 m-0 text-6xl font-black tracking-tighter text-emerald-500 dark:text-emerald-400">{matched}</h3></motion.div>
            <motion.div variants={itemVariants} whileHover={{ y: -4 }} className="p-8 text-center bg-white/70 dark:bg-[#161616] backdrop-blur-xl border border-zinc-200/50 dark:border-white/5 shadow-sm rounded-[2rem] relative overflow-hidden group"><div className="absolute inset-0 transition-opacity duration-500 opacity-0 bg-rose-500/5 dark:bg-rose-500/10 group-hover:opacity-100"></div><p className={`text-[10px] font-black tracking-widest uppercase mb-2 relative z-10 ${pending > 0 ? 'text-rose-600 dark:text-rose-500' : 'text-amber-600 dark:text-amber-500'}`}>คำร้องสละสิทธิ์ (รออนุมัติ)</p><h3 className={`relative z-10 m-0 text-6xl font-black tracking-tighter ${pending > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-amber-500 dark:text-amber-400'}`}>{pending}</h3></motion.div>
          </motion.div>

          {cancelRequests.length > 0 && (
            <motion.div variants={itemVariants} className="overflow-hidden mb-10 bg-white/70 dark:bg-[#121212] backdrop-blur-xl border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none rounded-[2rem] border-rose-200/80 dark:border-rose-900/50">
              <div className="flex items-center justify-between px-8 py-6 border-b border-rose-100 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20">
                <h3 className="flex items-center gap-2 m-0 text-sm font-bold tracking-wide uppercase text-rose-800 dark:text-rose-400">คำร้องขอสละสิทธิ์สถานที่ฝึกงาน ({cancelRequests.length})</h3>
              </div>
              <div className="p-6 space-y-4">
                {cancelRequests.map((req) => (
                  <div key={req.id} className="p-5 border bg-white dark:bg-[#161616] border-rose-200/50 dark:border-rose-900/30 rounded-2xl flex flex-col xl:flex-row xl:items-center justify-between gap-4 shadow-sm">
                    <div>
                      <h4 className="m-0 text-lg font-bold text-zinc-900 dark:text-zinc-100">{req.student_name}</h4>
                      <p className="m-0 mt-1 text-xs text-zinc-500 dark:text-zinc-400">ขอยกเลิกบริษัท: <span className="font-bold text-indigo-600 dark:text-indigo-400">{req.company_name}</span></p>
                      <p className="p-3 mt-3 text-sm border bg-rose-50/50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/50 rounded-xl text-rose-800 dark:text-rose-300"><strong>เหตุผล:</strong> {req.reason}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setActiveChatId(`${req.application_id}-TS`)} className="px-4 py-2 text-xs font-semibold text-zinc-700 bg-zinc-100 border border-zinc-200 rounded-xl dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 hover:bg-zinc-200"><IconChat /> สอบถามนักศึกษา</button>
                      <button onClick={() => handleResolveRequest(req.id, req.application_id, 'reject')} className="px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 rounded-xl dark:bg-[#1a1a1a] dark:text-zinc-300 dark:border-white/10 hover:bg-zinc-50">ไม่อนุมัติ</button>
                      <button onClick={() => handleResolveRequest(req.id, req.application_id, 'approve')} className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 rounded-xl shadow-md hover:bg-rose-700">อนุมัติสละสิทธิ์</button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          <motion.div variants={itemVariants} className="overflow-hidden bg-white/70 dark:bg-[#121212] backdrop-blur-xl border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none rounded-[2rem] border-zinc-200/50 dark:border-white/5">
            <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/5">
              <h3 className="flex items-center gap-2 m-0 text-sm font-bold tracking-wide uppercase text-zinc-800 dark:text-zinc-200">สถานะและสมุดบันทึกของนักศึกษา</h3>
            </div>
            
            <div className="p-6 space-y-4">
              {applications.length === 0 ? <p className="py-10 font-medium text-center text-zinc-400 dark:text-zinc-500">ยังไม่มีข้อมูลนักศึกษาในระบบ</p> : 
              applications.map((app, index) => {
                const hasIssue = checkIssues(app.name);
                const ev = evaluations.find(e => e.application_id === app.id);

                return (
                <motion.div key={app.id || index} variants={itemVariants} className={`p-6 transition-all bg-white dark:bg-[#161616] border ${hasIssue ? 'border-rose-300 dark:border-rose-900/50 shadow-[0_0_15px_rgba(244,63,94,0.1)]' : 'border-zinc-200/50 dark:border-white/5'} rounded-[1.5rem] hover:shadow-sm`}>
                  <div className="flex flex-col items-start justify-between gap-5 xl:flex-row xl:items-center">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="m-0 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{app.name}</h4>
                        <span className={`px-3 py-1 rounded-md text-[9px] font-black tracking-widest uppercase border ${app.status === 'Matched' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' : app.status === 'Canceled' ? 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/20' : app.status === 'Completed' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20' : app.status === 'Rejected' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'}`}>{app.status}</span>
                      </div>
                      <p className="m-0 mt-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">ตำแหน่ง: <span className="font-bold text-zinc-800 dark:text-zinc-200">{app.job_title}</span></p>
                      <p className="m-0 mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">บริษัท: <span className="font-bold text-indigo-600 dark:text-indigo-400">{app.company}</span></p>
                      
                      {app.status === 'Completed' && ev && (
                        <div className="flex items-start gap-3 p-3 mt-4 border shadow-sm bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30 rounded-xl">
                          <div className="text-blue-600 dark:text-blue-400 mt-0.5"><IconTrophy /></div>
                          <div>
                            <p className="m-0 text-sm font-bold text-blue-800 dark:text-blue-300">ผลการประเมิน: {ev.score} / 100</p>
                            {ev.comment && <p className="m-0 mt-1 text-xs text-blue-700/80 dark:text-blue-400/80">"{ev.comment}"</p>}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button onClick={() => { setActiveChatId(null); setActiveLogCardId(activeLogCardId === app.id ? null : app.id); }} className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 border ${activeLogCardId === app.id ? 'bg-amber-500 text-white border-amber-500 dark:bg-amber-600 dark:border-amber-600' : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20'}`}><IconClipboard /> {activeLogCardId === app.id ? 'ปิดบันทึก' : 'บันทึกประจำวัน'}</button>
                      <button onClick={() => { setActiveLogCardId(null); setActiveChatId(activeChatId === `${app.id}-TS` ? null : `${app.id}-TS`); }} className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 border ${activeChatId === `${app.id}-TS` ? 'bg-zinc-900 text-white dark:bg-white dark:text-black border-zinc-900 dark:border-white' : 'bg-indigo-600 text-white dark:bg-indigo-500 border-indigo-600 dark:border-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-400 shadow-sm'}`}><IconChat /> นักศึกษา</button>
                      <button onClick={() => { setActiveLogCardId(null); setActiveChatId(activeChatId === `${app.id}-TH` ? null : `${app.id}-TH`); }} className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 border ${activeChatId === `${app.id}-TH` ? 'bg-zinc-900 text-white dark:bg-white dark:text-black border-zinc-900 dark:border-white' : 'bg-white dark:bg-[#1a1a1a] border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 shadow-sm'}`}><IconChat /> HR</button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {activeLogCardId === app.id && (
                      <motion.div initial={{ height: 0, opacity: 0, marginTop: 0 }} animate={{ height: 'auto', opacity: 1, marginTop: 24 }} exit={{ height: 0, opacity: 0, marginTop: 0 }} className="w-full overflow-hidden border shadow-inner border-amber-200/50 dark:border-amber-900/30 rounded-2xl bg-amber-50/50 dark:bg-amber-950/10">
                        <div className="flex items-center justify-between px-5 py-3 text-xs font-bold border-b text-amber-800 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-900/40 border-amber-200/50 dark:border-amber-900/50"><span>สมุดบันทึกประจำวันของ: {app.name}</span></div>
                        <div className="flex flex-col lg:flex-row">
                          <div className="w-full p-6 border-b lg:w-1/3 border-amber-200/50 dark:border-amber-900/50 lg:border-b-0 lg:border-r">
                            <h3 className="mb-4 text-[10px] font-black tracking-widest uppercase text-amber-600 dark:text-amber-500">Activity Calendar</h3>
                            <div className="grid grid-cols-7 gap-2 mb-4">
                              {generateTeacherHeatmap(app.name).map((day, i) => (
                                <div key={i} title={formatThaiDate(day.date)} className={`w-full aspect-square rounded-md transition-colors duration-300 ${day.hasLog ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-amber-100/50 dark:bg-amber-900/20'}`} />
                              ))}
                            </div>
                          </div>
                          <div className="w-full p-6 lg:w-2/3 h-80 overflow-y-auto bg-white/50 dark:bg-[#0a0a0a]/50">
                            {logs.filter(l => l.name.includes(app.name.split(' ')[0])).length === 0 ? (
                              <div className="flex flex-col items-center justify-center h-full"><p className="text-sm font-medium text-zinc-400 dark:text-zinc-500">ยังไม่มีการบันทึก Logbook จากนักศึกษาคนนี้</p></div>
                            ) : (
                              logs.filter(l => l.name.includes(app.name.split(' ')[0])).map((log) => (
                                <div key={log.id} className="relative p-5 mb-4 border shadow-sm border-zinc-200/60 dark:border-white/5 rounded-2xl bg-white dark:bg-[#121212] last:mb-0">
                                  <div className="flex items-center justify-between mb-4"><span className="text-[9px] font-black text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-white/5 px-3 py-1.5 rounded-md uppercase tracking-widest border border-zinc-200/50 dark:border-white/5">{log.category}</span><span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500">{formatThaiDate(log.date || log.created_at)}</span></div>
                                  <div className="mb-4"><p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-2 tracking-wide uppercase">รายละเอียดงานที่ทำ</p><p className="p-4 m-0 text-sm leading-relaxed bg-zinc-50 dark:bg-[#0a0a0a] border text-zinc-800 dark:text-zinc-200 rounded-xl border-zinc-100 dark:border-white/5">{log.activity}</p></div>
                                  {log.blocker && log.blocker.trim() !== '' && (
                                    <div className="p-4 border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl"><p className="flex items-center gap-2 mb-2 text-xs font-bold tracking-wide uppercase text-rose-600 dark:text-rose-400">ปัญหาที่พบ (BLOCKERS)</p><p className="m-0 text-sm leading-relaxed text-rose-800 dark:text-rose-300">{log.blocker}</p></div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {activeChatId && (activeChatId === `${app.id}-TS` || activeChatId === `${app.id}-TH`) && (
                      <motion.div initial={{ height: 0, opacity: 0, marginTop: 0 }} animate={{ height: 'auto', opacity: 1, marginTop: 24 }} exit={{ height: 0, opacity: 0, marginTop: 0 }} className="w-full overflow-hidden border shadow-inner border-zinc-200 dark:border-white/5 rounded-2xl bg-zinc-50/50 dark:bg-[#0a0a0a]">
                        <div className="flex items-center justify-between px-5 py-3 text-xs font-semibold tracking-wide uppercase border-b text-zinc-600 dark:text-zinc-400 bg-zinc-100/80 dark:bg-white/5 border-zinc-200 dark:border-white/5">
                          <span>ห้องสนทนาส่วนตัวกับ: {activeChatId === `${app.id}-TS` ? <span className="ml-1 font-black text-indigo-600 dark:text-indigo-400">นักศึกษา</span> : <span className="ml-1 font-black text-indigo-600 dark:text-indigo-400">HR ({app.company})</span>}</span>
                        </div>
                        <div className="flex flex-col h-64 p-5 space-y-3 overflow-y-auto bg-white/50 dark:bg-transparent">
                          {chatMessages.length === 0 ? <p className="py-4 my-auto text-xs font-medium text-center text-zinc-400 dark:text-zinc-500">เริ่มพิมพ์ข้อความ...</p> : 
                            chatMessages.map((m) => (
                            <div key={m.id} className={`max-w-[75%] p-3.5 rounded-2xl text-sm shadow-sm ${m.sender === 'teacher' ? 'bg-indigo-600 dark:bg-indigo-500 text-white ml-auto rounded-br-sm' : 'bg-white dark:bg-[#1a1a1a] text-zinc-800 dark:text-zinc-200 mr-auto rounded-bl-sm border border-zinc-200 dark:border-white/5'}`}>
                              <p className="m-0 font-medium leading-relaxed">{m.text}</p>
                            </div>
                          ))}
                        </div>
                        <form onSubmit={(e) => { handleSendChat(e); notify('ส่งข้อความสำเร็จ', 'success'); }} className="flex gap-3 p-3 bg-white border-t dark:bg-[#121212] border-zinc-200 dark:border-white/5">
                          <input type="text" value={typedMessage} onChange={e => setTypedMessage(e.target.value)} placeholder="พิมพ์ข้อความ..." className="flex-1 px-4 py-2.5 text-sm transition-all border outline-none bg-[#1a1a1a] border-white/10 text-white placeholder-gray-400 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                          <button type="submit" className="px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-black text-sm font-semibold rounded-xl">ส่ง</button>
                        </form>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
              })}
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
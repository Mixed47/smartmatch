import { useState, useEffect } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Skill, JobMatch, Application } from './types';
import { apiFetch, apiJson, friendlyApiError } from './apiClient';

interface Message { id: number; application_id: string; sender: string; text: string; created_at: string; }
interface LogEntry { date: string; category: string; activity: string; blocker: string; }

const IconSparkles = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>;
const IconChat = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.436 3 11.996c0 2.29.932 4.35 2.44 5.86l-1.92 2.91a.75.75 0 00.91 1.09l3.22-1.39a9.123 9.123 0 004.35 1.034z" /></svg>;
const IconTeacher = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>;
const IconAlert = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;

const containerVariants: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants: Variants = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } } };
const formatThaiDate = (dateString: string) => { return new Date(dateString).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }); };

const emptyStudentProfile = {
  firstName: '',
  lastName: '',
  nickname: '',
  dob: '',
  phone: '',
  email: '',
  university: '',
  major: '',
  address: '',
  github: '',
};

export default function Student({ activeMenu, setActiveMenu, showToast }: { activeMenu: string, setActiveMenu: (m: string) => void, showToast: (msg: string, type: 'success'|'error'|'info') => void }) {
  const [avatar, setAvatar] = useState<string | null>(null);
  const [profileData, setProfileData] = useState(emptyStudentProfile);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [internship, setInternship] = useState<{ job_title: string; company: string; status: string } | null>(null);

  const [skills, setSkills] = useState<Skill[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [expText, setExpText] = useState('');
  const [loading, setLoading] = useState(false);
  const [matchedJobs, setMatchedJobs] = useState<JobMatch[]>([]);
  const [uploadedResumeUrl, setUploadedResumeUrl] = useState<string>(''); 
  const [myApps, setMyApps] = useState<Application[]>([]);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [typedMessage, setTypedMessage] = useState<string>('');
  const [aiContent, setAiContent] = useState<{ [key: string]: { type: string, data: string } }>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [logCategory, setLogCategory] = useState('Coding');
  const [logActivity, setLogActivity] = useState('');
  const [logBlocker, setLogBlocker] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const [cancelModal, setCancelModal] = useState({ show: false, appId: '', companyName: '' });
  const [cancelReason, setCancelReason] = useState('');
  const [loadError, setLoadError] = useState('');

  const fetchApplications = () => {
    apiJson('/api/my-applications')
      .then((data) => { setMyApps(Array.isArray(data) ? data : []); setLoadError(''); })
      .catch((err) => { setLoadError(friendlyApiError(err, 'โหลดใบสมัครไม่สำเร็จ')); });
  };

  const loadProfile = () => {
    setProfileLoading(true);
    apiJson('/api/student/profile')
      .then((data) => {
        setProfileData({
          firstName: data.first_name || '',
          lastName: data.last_name || '',
          nickname: data.nickname || '',
          dob: data.dob || '',
          phone: data.phone || '',
          email: data.email || '',
          university: data.university || '',
          major: data.major || '',
          address: data.address || '',
          github: data.github || '',
        });
        setSkills(Array.isArray(data.skills) ? data.skills : []);
        setUploadedResumeUrl(data.resume_url || '');
        setInternship(data.internship || null);
        setLoadError('');
      })
      .catch((err) => {
        setLoadError(friendlyApiError(err, 'โหลดโปรไฟล์ไม่สำเร็จ'));
      })
      .finally(() => setProfileLoading(false));
  };

  useEffect(() => { loadProfile(); }, []);

  useEffect(() => { fetchApplications(); }, [activeMenu, profileData.firstName]);

  useEffect(() => {
    if (activeMenu === '2' && skills.length > 0) {
      apiJson('/api/match-jobs', {
        method: 'POST',
        body: JSON.stringify({ skills }),
      }).then((matchData) => {
        if (Array.isArray(matchData)) {
          const appliedTitles = myApps.map(a => a.job_title);
          const freshJobs = matchData.filter((job: JobMatch) => !appliedTitles.includes(job.job_title));
          setMatchedJobs(freshJobs.sort((a, b) => b.match_percentage - a.match_percentage));
        }
      }).catch((err) => { setLoadError(friendlyApiError(err, 'ค้นหางานที่เหมาะกับคุณไม่สำเร็จ')); });
    }
  }, [activeMenu, skills, myApps]);

  useEffect(() => {
    if (activeMenu === '3') {
      apiJson('/api/logbook').then((data) => {
        const list = Array.isArray(data) ? data : (data?.data || []);
        setLogs(list.map((l: any) => ({
          date: l.date || l.created_at,
          category: l.category || 'Daily',
          activity: l.activity || l.tasks || '',
          blocker: l.blocker,
        })));
      }).catch((err) => { setLoadError(friendlyApiError(err, 'โหลดสมุดสหกิจไม่สำเร็จ')); });
    }
  }, [activeMenu]);

  useEffect(() => {
    if (!activeChatId) return;
    const fetchChat = () => apiJson(`/api/chat/messages?application_id=${encodeURIComponent(activeChatId)}`).then((data) => setChatMessages(data || [])).catch((err) => { setLoadError(friendlyApiError(err, 'โหลดข้อความแชทไม่สำเร็จ')); });
    fetchChat(); const interval = setInterval(fetchChat, 2000); return () => clearInterval(interval);
  }, [activeChatId]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) setAvatar(URL.createObjectURL(e.target.files[0])); };
  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      const saved = await apiJson('/api/student/profile', {
        method: 'PUT',
        body: JSON.stringify({
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          nickname: profileData.nickname,
          dob: profileData.dob,
          phone: profileData.phone,
          email: profileData.email,
          university: profileData.university,
          major: profileData.major,
          address: profileData.address,
          github: profileData.github,
        }),
      });
      setInternship(saved.internship || internship);
      showToast('บันทึกโปรไฟล์ลงระบบเรียบร้อยแล้ว', 'success');
    } catch (err) {
      showToast(friendlyApiError(err, 'บันทึกโปรไฟล์ไม่สำเร็จ'), 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleUpload = async () => {
    setLoading(true); setSkills([]);
    const formData = new FormData();
    if (file) formData.append('resume', file);
    formData.append('experience', expText);
    try {
      const res = await apiFetch('/api/extract-skills-graded', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw Object.assign(new Error(data.error || 'วิเคราะห์ทักษะไม่สำเร็จ'), { status: res.status, data });
      }
      const newSkills = data.skills || [];
      setSkills(newSkills);
      setUploadedResumeUrl(data.resume_url || '');
      showToast('AI วิเคราะห์ทักษะสำเร็จ!', 'info');

      const matchData = await apiJson('/api/match-jobs', {
        method: 'POST',
        body: JSON.stringify({ skills: newSkills }),
      });
      if (Array.isArray(matchData)) {
        const appliedTitles = myApps.map(a => a.job_title);
        const freshJobs = matchData.filter((job: JobMatch) => !appliedTitles.includes(job.job_title));
        setMatchedJobs(freshJobs.sort((a: JobMatch, b: JobMatch) => b.match_percentage - a.match_percentage));
      }
      showToast('AI ค้นหางานที่เหมาะสมเสร็จสมบูรณ์!', 'success');
    } catch (e) { console.error(e); showToast(friendlyApiError(e, 'มีปัญหาตอนโหลดรายชื่องาน'), 'error'); } finally { setLoading(false); }
  };

  const handleSwipe = (type: 'apply' | 'pass', job: JobMatch) => {
    setSwipeDirection(type === 'apply' ? 'right' : 'left');
    if (type === 'apply') {
      apiJson('/api/apply', {
        method: 'POST',
        body: JSON.stringify({ name: profileData.firstName + ' (' + profileData.nickname + ')', job_title: job.job_title, company: job.company, match_percentage: job.match_percentage, skills: skills.map(s => `${s.name} (เกรด ${s.grade})`), resume_url: uploadedResumeUrl }),
      }).then(() => {
        showToast(`ส่งใบสมัครไปยัง ${job.company} แล้ว!`, 'success');
        fetchApplications();
      }).catch((err) => { showToast(friendlyApiError(err, 'ส่งใบสมัครไม่สำเร็จ'), 'error'); });
    }
    setTimeout(() => { setMatchedJobs(prev => prev.slice(1)); setSwipeDirection(null); }, 300);
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault(); if (!typedMessage.trim() || !activeChatId) return;
    try {
      await apiJson('/api/chat/send', { method: 'POST', body: JSON.stringify({ application_id: activeChatId, text: typedMessage.trim() }) });
      setTypedMessage('');
    } catch (err) {
      showToast(friendlyApiError(err, 'ส่งข้อความไม่สำเร็จ'), 'error');
    }
  };

  const submitCancelRequest = () => {
    if (!cancelReason.trim()) { showToast('กรุณาระบุเหตุผลการสละสิทธิ์', 'error'); return; }
    apiJson('/api/request-cancel', {
      method: 'POST',
      body: JSON.stringify({ application_id: cancelModal.appId, student_name: profileData.firstName, company_name: cancelModal.companyName, reason: cancelReason }),
    }).then(() => {
      showToast('ส่งคำร้องให้อาจารย์สำเร็จ กรุณารอการอนุมัติ', 'success');
      setCancelModal({ show: false, appId: '', companyName: '' });
      setCancelReason('');
    }).catch((err) => showToast(friendlyApiError(err, 'ส่งคำร้องไม่สำเร็จ'), 'error'));
  };

  const generateAI = async (type: 'email' | 'interview', app: Application) => {
      setAiLoading(true); setAiContent({ ...aiContent, [app.id]: { type, data: 'กำลังวิเคราะห์และประมวลผลด้วย AI...' } });
      const endpoint = type === 'email' ? 'generate-email' : 'generate-questions';
      const body = type === 'email' ? { name: app.name, job_title: app.job_title, company: app.company, skills: [] } : { job_title: app.job_title };
      try {
        const data = await apiJson(`/api/${endpoint}`, { method: 'POST', body: JSON.stringify(body) });
        setAiContent({ ...aiContent, [app.id]: { type, data: type === 'email' ? data.email : data.questions } });
        showToast('ประมวลผลเสร็จสมบูรณ์!', 'success');
      } catch (e) { showToast(friendlyApiError(e, 'การประมวลผลล้มเหลว'), 'error'); } finally { setAiLoading(false); }
    };

  const handleSaveLogbook = async () => {
    try {
      const saved = await apiJson('/api/logbook', {
        method: 'POST',
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          tasks: logActivity,
          blocker: logBlocker,
        }),
      });
      const critical = Boolean(saved?.evaluation?.is_critical || saved?.is_critical);
      showToast(critical ? 'บันทึกสำเร็จ และ AI แจ้งปัญหาด่วนให้อาจารย์แล้ว' : 'บันทึกสมุดสหกิจสำเร็จ และ AI ประเมินผลแล้ว', 'success');
      setLogActivity(''); setLogBlocker('');
      apiJson('/api/logbook').then((data) => {
        const list = Array.isArray(data) ? data : (data?.data || []);
        setLogs(list.map((l: any) => ({
          date: l.date || l.created_at,
          category: l.category || 'Daily',
          activity: l.activity || l.tasks || '',
          blocker: l.blocker,
        })));
      }).catch(() => {});
    } catch (e) { showToast(friendlyApiError(e, 'เกิดข้อผิดพลาดในการบันทึก'), 'error'); }
  };

  const generateHeatmap = () => {
    const days = []; const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({ date: dateStr, hasLog: logs.some(log => log.date === dateStr) });
    }
    return days;
  };

  const pendingAppsCount = myApps.filter(a => a.status === 'Pending').length;
  const matchedAppsCount = myApps.filter(a => a.status === 'Matched').length;

  return (
    <div className="relative w-full min-h-screen pb-20 transition-colors duration-500 text-zinc-900 dark:text-zinc-100">
      {loadError && (
        <div className="max-w-5xl mx-auto mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {loadError}
        </div>
      )}
      <AnimatePresence>
        {cancelModal.show && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="w-full max-w-md p-6 bg-white border dark:bg-[#161616] rounded-3xl border-zinc-200 dark:border-zinc-800 shadow-2xl">
              <h3 className="flex items-center gap-2 mb-2 text-xl font-bold text-rose-600 dark:text-rose-500"><IconAlert /> ยืนยันการสละสิทธิ์</h3>
              <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">คุณต้องการสละสิทธิ์จากบริษัท <strong className="text-zinc-900 dark:text-zinc-100">{cancelModal.companyName}</strong> ใช่หรือไม่? คำร้องนี้จะถูกส่งให้อาจารย์อนุมัติ</p>
              
              <label className="block mb-2 text-xs font-bold tracking-wide uppercase text-zinc-500">ระบุเหตุผล (บังคับ)</label>
              <textarea value={cancelReason} onChange={e=>setCancelReason(e.target.value)} placeholder="เช่น ได้งานที่อื่นแล้ว, การเดินทางไม่สะดวก..." className="w-full h-24 p-3 mb-6 text-sm transition-all border outline-none resize-none bg-[#1a1a1a] text-white placeholder-gray-400 border-white/10 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
              
              <div className="flex gap-3">
                <button onClick={() => setCancelModal({show:false, appId:'', companyName:''})} className="flex-1 py-3 text-sm font-bold transition-colors bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700">ยกเลิก</button>
                <button onClick={submitCancelRequest} className="flex-1 py-3 text-sm font-bold text-white transition-colors shadow-lg bg-rose-600 rounded-xl hover:bg-rose-700">ส่งคำร้อง</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setActiveChatId(activeChatId === 'GENERAL-CHAT' ? null : 'GENERAL-CHAT')} className="fixed z-50 flex items-center justify-center gap-2 px-5 h-12 transition-all border rounded-full shadow-lg shadow-indigo-500/30 bottom-20 right-6 bg-[#4f46e5] border-indigo-400 text-white hover:bg-indigo-600">
        <IconTeacher /><span className="hidden text-sm font-bold sm:block">ปรึกษาอาจารย์</span>
      </motion.button>

      <AnimatePresence>
        {activeChatId === 'GENERAL-CHAT' && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.9 }} className="fixed z-50 bottom-36 right-6 w-80 bg-white dark:bg-[#121212] border border-zinc-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[400px]">
            <div className="z-10 flex items-center justify-between px-4 py-3 text-white shadow-md bg-zinc-900 dark:bg-white dark:text-black">
              <span className="flex items-center gap-2 text-xs font-bold"><IconTeacher /> ห้องแชทที่ปรึกษา</span>
              <button onClick={() => setActiveChatId(null)} className="transition-opacity opacity-70 hover:opacity-100"><IconAlert /></button>
            </div>
            <div className="flex-1 p-4 space-y-3 overflow-y-auto bg-zinc-50 dark:bg-transparent">
              {chatMessages.length === 0 ? <p className="mt-10 text-xs text-center text-zinc-400">ส่งข้อความเพื่อปรึกษาเรื่องที่ฝึกงาน หรือการเตรียมตัวสัมภาษณ์ได้เลยครับ</p> :
                chatMessages.map(m => (
                  <div key={m.id} className={`max-w-[80%] p-3 rounded-xl text-xs shadow-sm ${m.sender === 'student' ? 'bg-[#4f46e5] text-white ml-auto rounded-tr-none' : 'bg-white dark:bg-[#1a1a1a] text-zinc-800 dark:text-zinc-200 mr-auto rounded-tl-none border border-zinc-200 dark:border-white/5'}`}>
                    <p className="m-0 leading-relaxed">{m.text}</p>
                  </div>
                ))
              }
            </div>
            <form onSubmit={handleSendChat} className="p-3 bg-white dark:bg-[#121212] border-t border-zinc-200 dark:border-white/5 flex gap-2">
              <input type="text" value={typedMessage} onChange={e=>setTypedMessage(e.target.value)} placeholder="พิมพ์ข้อความ..." className="flex-1 px-3 py-2 text-xs border rounded-lg bg-[#1a1a1a] border-white/10 outline-none text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
              <button type="submit" className="bg-[#4f46e5] text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-indigo-600 transition-colors">ส่ง</button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        
        {activeMenu === 'student-home' && (
          <motion.div key="student-home" variants={containerVariants} initial="hidden" animate="show" exit="hidden" className="w-full max-w-5xl mx-auto">
            <motion.div variants={itemVariants} className="mb-10">
              <h2 className="text-3xl font-extrabold tracking-tighter text-zinc-900 dark:text-zinc-100">สวัสดี, {profileData.nickname || profileData.firstName || 'นักศึกษา'} 👋</h2>
              <p className="mt-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">ภาพรวมการหาสถานที่ฝึกงานและบันทึกสหกิจศึกษาของคุณ</p>
            </motion.div>

            <motion.div variants={containerVariants} className="grid grid-cols-1 gap-6 mb-10 md:grid-cols-3">
              <motion.div variants={itemVariants} whileHover={{ y: -4 }} onClick={() => setActiveMenu('3')} className="cursor-pointer p-6 bg-white dark:bg-[#161616] border border-zinc-200/50 dark:border-white/5 shadow-sm rounded-3xl relative overflow-hidden group">
                <div className="absolute inset-0 transition-opacity duration-500 opacity-0 bg-amber-500/5 dark:bg-amber-500/10 group-hover:opacity-100"></div>
                <h3 className="m-0 text-4xl font-black tracking-tighter text-zinc-900 dark:text-white">{pendingAppsCount}</h3>
                <p className="mt-2 text-xs font-bold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">ใบสมัครที่รอพิจารณา</p>
              </motion.div>

              <motion.div variants={itemVariants} whileHover={{ y: -4 }} onClick={() => setActiveMenu('3')} className="cursor-pointer p-6 bg-white dark:bg-[#161616] border border-zinc-200/50 dark:border-white/5 shadow-sm rounded-3xl relative overflow-hidden group">
                <div className="absolute inset-0 transition-opacity duration-500 opacity-0 bg-emerald-500/5 dark:bg-emerald-500/10 group-hover:opacity-100"></div>
                <h3 className="m-0 text-4xl font-black tracking-tighter text-emerald-600 dark:text-emerald-400">{matchedAppsCount}</h3>
                <p className="mt-2 text-xs font-bold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">บริษัทที่ตอบรับคุณ</p>
              </motion.div>
            </motion.div>

            <motion.h3 variants={itemVariants} className="mb-6 text-sm font-bold tracking-widest uppercase text-zinc-400 dark:text-zinc-500">Quick Actions</motion.h3>
            <motion.div variants={containerVariants} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <motion.button variants={itemVariants} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setActiveMenu('1')} className="flex items-center justify-between p-6 text-white bg-indigo-600 shadow-lg dark:bg-indigo-500 rounded-2xl shadow-indigo-500/20">
                <div className="text-left"><h4 className="m-0 text-lg font-bold">อัปเดตเรซูเม่ & ทักษะ</h4><p className="mt-1 text-xs text-indigo-100 opacity-80">ให้ AI สกัดทักษะใหม่ล่าสุดของคุณ</p></div><IconSparkles />
              </motion.button>
              <motion.button variants={itemVariants} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setActiveMenu('2')} className="flex items-center justify-between p-6 text-white shadow-lg bg-zinc-900 dark:bg-white dark:text-black rounded-2xl shadow-zinc-900/20 dark:shadow-none">
                <div className="text-left"><h4 className="m-0 text-lg font-bold">ค้นหาที่ฝึกงานใหม่</h4><p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">ปัดขวาเพื่อเลือกบริษัทที่ตรงใจคุณ</p></div>
              </motion.button>
            </motion.div>
          </motion.div>
        )}

        {activeMenu === '0' && (
          <motion.div key="menu0" variants={containerVariants} initial="hidden" animate="show" exit="hidden" className="w-full max-w-4xl mx-auto">
            <motion.h2 variants={itemVariants} className="mb-8 text-3xl font-extrabold tracking-tighter text-zinc-900 dark:text-zinc-100">My Profile</motion.h2>
            {profileLoading && (
              <p className="mb-4 text-sm font-medium text-zinc-500">กำลังโหลดโปรไฟล์จากเซิร์ฟเวอร์...</p>
            )}
            {internship && (
              <motion.div variants={itemVariants} className="p-5 mb-6 border rounded-2xl bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-200/60 dark:border-emerald-500/20">
                <p className="m-0 text-xs font-bold tracking-wide uppercase text-emerald-700 dark:text-emerald-400">สถานะการฝึกงาน</p>
                <p className="m-0 mt-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">{internship.job_title} @ {internship.company}</p>
                <p className="m-0 mt-1 text-xs text-zinc-500">{internship.status}</p>
              </motion.div>
            )}
            <motion.div variants={itemVariants} className="p-8 mb-8 bg-white/70 dark:bg-[#161616] backdrop-blur-xl border shadow-sm rounded-[2rem] border-zinc-200/50 dark:border-white/5">
              <div className="flex flex-col items-center gap-6 mb-10 sm:flex-row">
                <div className="relative flex items-center justify-center overflow-hidden border-4 border-white rounded-full shadow-xl cursor-pointer w-28 h-28 bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-700 group">
                  {avatar ? <img src={avatar} alt="Profile" className="object-cover w-full h-full" /> : <div className="text-zinc-400"><svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg></div>}
                  <div className="absolute inset-0 flex items-center justify-center transition-opacity opacity-0 bg-black/60 group-hover:opacity-100 backdrop-blur-sm"><span className="text-xs font-bold tracking-wider text-white uppercase">Upload</span></div>
                  <input type="file" onChange={handleAvatarUpload} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{profileData.firstName} {profileData.lastName} ({profileData.nickname})</h3>
                  <p className="mt-1 text-sm font-medium text-indigo-600 dark:text-indigo-400">{profileData.major} | {profileData.university}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div><label className="block mb-2 text-xs font-semibold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">ชื่อจริง</label><input type="text" value={profileData.firstName} onChange={e => setProfileData({...profileData, firstName: e.target.value})} className="w-full p-4 text-sm transition-all bg-[#1a1a1a] border border-white/10 outline-none rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400 scheme-dark" /></div>
                <div><label className="block mb-2 text-xs font-semibold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">นามสกุล</label><input type="text" value={profileData.lastName} onChange={e => setProfileData({...profileData, lastName: e.target.value})} className="w-full p-4 text-sm transition-all bg-[#1a1a1a] border border-white/10 outline-none rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400 scheme-dark" /></div>
                <div><label className="block mb-2 text-xs font-semibold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">ชื่อเล่น</label><input type="text" value={profileData.nickname} onChange={e => setProfileData({...profileData, nickname: e.target.value})} className="w-full p-4 text-sm transition-all bg-[#1a1a1a] border border-white/10 outline-none rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400 scheme-dark" /></div>
                <div><label className="block mb-2 text-xs font-semibold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">วันเกิด</label><input type="date" value={profileData.dob} onChange={e => setProfileData({...profileData, dob: e.target.value})} className="w-full p-4 text-sm transition-all bg-[#1a1a1a] border border-white/10 outline-none rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400 scheme-dark" /></div>
                <div className="md:col-span-2"><label className="block mb-2 text-xs font-semibold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">อีเมล</label><input type="email" value={profileData.email} onChange={e => setProfileData({...profileData, email: e.target.value})} className="w-full p-4 text-sm transition-all bg-[#1a1a1a] border border-white/10 outline-none rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400 scheme-dark" /></div>
              </div>
              <div className="pt-8 mt-8 border-t border-zinc-100 dark:border-white/5">
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={handleSaveProfile} disabled={profileSaving || profileLoading} className="w-full py-4 text-sm font-semibold tracking-tight text-white transition-colors shadow-lg bg-zinc-900 dark:bg-white dark:text-black rounded-2xl hover:bg-zinc-800 disabled:opacity-50">{profileSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {activeMenu === '1' && (
          <motion.div key="menu1" variants={containerVariants} initial="hidden" animate="show" exit="hidden" className="w-full max-w-6xl mx-auto">
            <motion.div variants={itemVariants} className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">AI Skill Extractor</h2>
              <span className="px-4 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full">SYSTEM READY</span>
            </motion.div>
            <div className="flex flex-col gap-8 lg:flex-row">
              <motion.div variants={itemVariants} className="w-full p-8 bg-white/70 dark:bg-[#121212] backdrop-blur-xl border border-zinc-200/50 dark:border-white/5 shadow-sm lg:w-1/3 rounded-[2rem]">
                <h3 className="mb-6 text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">ข้อมูลตั้งต้น (Input Data)</h3>
                <div className="relative p-6 mb-6 text-center transition-colors border border-indigo-300 border-dashed dark:border-white/10 group bg-indigo-50/50 dark:bg-white/5 rounded-2xl hover:bg-indigo-50 dark:hover:bg-white/10">
                  <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-sm font-medium cursor-pointer text-zinc-500 dark:text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-100 file:text-indigo-700 dark:file:bg-white/10 dark:file:text-zinc-300 hover:file:bg-indigo-200 dark:hover:file:bg-white/20" />
                </div>
                <label className="block mb-2 text-xs font-semibold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">ประสบการณ์เพิ่มเติม (Optional)</label>
                <textarea value={expText} onChange={e => setExpText(e.target.value)} placeholder="เล่าโปรเจกต์หรือผลงานที่โดดเด่น..." className="w-full h-32 p-4 mb-6 text-sm transition-all bg-[#1a1a1a] border outline-none resize-none border-white/10 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400" />
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleUpload} disabled={loading} className="w-full py-4 text-sm font-semibold tracking-tight text-white transition-colors shadow-lg bg-zinc-900 dark:bg-white dark:text-black rounded-2xl hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? 'กำลังประมวลผลด้วย AI...' : <><IconSparkles /> วิเคราะห์ทักษะ (Extract)</>}
                </motion.button>
              </motion.div>
              <motion.div variants={itemVariants} className="w-full p-8 border shadow-inner lg:w-2/3 bg-zinc-50/50 dark:bg-[#0f0f0f] rounded-[2rem] border-zinc-200/50 dark:border-white/5">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">ผลการวิเคราะห์ AI</h3>
                  <span className="px-4 py-1.5 text-xs font-semibold bg-white dark:bg-[#1a1a1a] border border-zinc-200/50 dark:border-white/10 rounded-full shadow-sm">พบ {skills.length} ทักษะ</span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {skills.length === 0 && !loading && <div className="col-span-2 p-10 font-medium text-center text-zinc-400 dark:text-zinc-500">กรุณาอัปโหลดเรซูเม่เพื่อเริ่มต้น</div>}
                  {skills.map((s, i) => (
                    <motion.div key={i} variants={itemVariants} whileHover={{ y: -4 }} className={`flex flex-col justify-between p-5 border rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] ${String(s.grade).toUpperCase() === 'S' ? 'bg-gradient-to-br from-amber-50 via-white to-yellow-50 border-amber-300/80 dark:from-amber-500/15 dark:via-[#161616] dark:to-yellow-500/10 dark:border-amber-400/40' : 'bg-white dark:bg-[#161616] border-white/40 dark:border-white/5'}`}>
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-bold tracking-tight text-zinc-800 dark:text-zinc-100">{s.name}</h4>
                        <span className={`px-2.5 py-1 text-[10px] font-black rounded-md ${String(s.grade).toUpperCase() === 'S' ? 'text-amber-950 bg-gradient-to-r from-amber-300 to-yellow-400 border border-amber-400 shadow-sm' : 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20'}`}>เกรด {s.grade}</span>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 tracking-wider mb-5 uppercase bg-indigo-50 dark:bg-indigo-500/10 self-start px-2.5 py-1 rounded-md">{s.type || 'Hard Skill'}</span>
                      <div className="pt-4 mt-auto border-t border-zinc-100 dark:border-white/5"><p className="text-[9px] font-semibold text-zinc-400 mb-1.5 uppercase tracking-widest">Source</p><p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{s.source || 'Resume Data'}</p></div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        {activeMenu === '2' && (
          <motion.div key="menu2" variants={containerVariants} initial="hidden" animate="show" exit="hidden" className="flex flex-col items-center max-w-xl mx-auto">
            <motion.div variants={itemVariants} className="mb-10 text-center">
              <h2 className="mb-2 text-3xl font-extrabold tracking-tighter text-zinc-900 dark:text-zinc-100">Job Discovery</h2>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">ปัดขวาเพื่อสมัคร ปัดซ้ายเพื่อข้าม</p>
            </motion.div>
            {matchedJobs.length === 0 ? (
              <motion.div variants={itemVariants} className="w-full p-12 text-center bg-white/70 dark:bg-[#121212] backdrop-blur-xl border shadow-sm rounded-[2rem] border-zinc-200/50 dark:border-white/5">
                <div className="flex justify-center mb-4 text-zinc-400"><IconSparkles /></div>
                <p className="mb-2 text-lg font-semibold tracking-tight text-zinc-800 dark:text-zinc-100">ไม่มีตำแหน่งงานที่รอพิจารณา</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">คุณได้พิจารณางานทั้งหมดแล้ว หรือลองให้ AI สกัดทักษะใหม่อีกครั้งที่หน้าแรก</p>
              </motion.div>
            ) : (
              <motion.div animate={{ x: swipeDirection === 'right' ? 300 : swipeDirection === 'left' ? -300 : 0, rotate: swipeDirection === 'right' ? 12 : swipeDirection === 'left' ? -12 : 0, opacity: swipeDirection ? 0 : 1 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="bg-white/90 dark:bg-[#111111] backdrop-blur-2xl border border-white dark:border-white/10 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] rounded-[2rem] p-8 w-full max-w-md relative mb-10">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-white text-white dark:text-black px-5 py-1.5 rounded-full text-xs font-bold shadow-lg whitespace-nowrap">Match Score {matchedJobs[0].match_percentage}%</div>
                <div className="mt-6 mb-8 text-center"><h3 className="m-0 text-2xl font-black leading-tight tracking-tight text-zinc-900 dark:text-white">{matchedJobs[0].job_title}</h3><p className="m-0 mt-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400">{matchedJobs[0].company}</p></div>
                <div className="p-5 mb-6 text-center border bg-zinc-50/80 dark:bg-white/5 rounded-2xl border-zinc-100 dark:border-white/5">
                  <span className="block mb-4 text-xs font-semibold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">ทักษะที่ตรงกับความต้องการ</span>
                  <div className="flex flex-wrap justify-center gap-2">{(matchedJobs[0].matched_skills || []).map((s,i) => (<span key={i} className="bg-white dark:bg-white/10 border border-zinc-200 dark:border-white/5 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm">✓ {s}</span>))}</div>
                </div>
                {(matchedJobs[0].missing_skills || []).length > 0 && (
                  <div className="p-5 mb-8 text-white border shadow-inner bg-zinc-900/95 dark:bg-[#0a0a0a] backdrop-blur-md border-zinc-800 dark:border-white/5 rounded-2xl">
                    <p className="mb-2 text-xs font-bold tracking-wide uppercase text-amber-400 flex items-center gap-2"><IconAlert /> AI Skill Gap Analysis</p>
                    <p className="m-0 text-xs font-medium leading-relaxed text-zinc-300 dark:text-zinc-400">คุณควรพิจารณาศึกษา <strong>{matchedJobs[0].missing_skills[0]}</strong> เพิ่มเติม เนื่องจากเป็นทักษะสำคัญที่ตำแหน่งนี้ต้องการ</p>
                  </div>
                )}
                <div className="flex justify-center gap-6 mt-4">
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => handleSwipe('pass', matchedJobs[0])} className="flex items-center justify-center w-16 h-16 text-2xl text-red-500 transition-colors bg-white dark:bg-[#1a1a1a] border border-zinc-200 dark:border-white/10 rounded-full shadow-lg hover:bg-red-50">✕</motion.button>
                  <motion.button whileHover={{ scale: 1.1, boxShadow: "0 10px 25px -5px rgba(79,70,229,0.4)" }} whileTap={{ scale: 0.95 }} onClick={() => handleSwipe('apply', matchedJobs[0])} className="flex items-center justify-center w-16 h-16 text-2xl text-white transition-shadow bg-indigo-600 rounded-full shadow-lg dark:bg-indigo-500">✓</motion.button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {activeMenu === '3' && (
          <motion.div key="menu3" variants={containerVariants} initial="hidden" animate="show" exit="hidden" className="w-full max-w-6xl mx-auto">
            <motion.div variants={itemVariants} className="flex items-center justify-between mb-8"><div><h2 className="text-3xl font-extrabold tracking-tighter text-zinc-900 dark:text-zinc-100">Application History</h2><p className="mt-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">ประวัติการสมัครงานและสมุดบันทึกสหกิจ</p></div></motion.div>
            
            <motion.div variants={containerVariants}>
              {myApps.length === 0 ? <p className="pl-2 font-medium text-zinc-400 dark:text-zinc-500">ยังไม่มีประวัติการสมัครงาน</p> : 
                myApps.map((app, idx) => (
                <motion.div variants={itemVariants} key={idx} className="p-6 mb-5 bg-white/60 dark:bg-[#161616] backdrop-blur-md border shadow-sm border-zinc-200/60 dark:border-white/5 rounded-[1.5rem]">
                  <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
                    <div>
                      <h3 className="m-0 text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{app.job_title}</h3>
                      <p className="m-0 mt-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">{app.company}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {app.status === 'Pending' && <span className="bg-amber-500/10 dark:bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 px-4 py-1.5 rounded-full text-xs font-semibold">รอพิจารณา</span>}
                      {app.status === 'Rejected' && <span className="bg-rose-500/10 dark:bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 px-4 py-1.5 rounded-full text-xs font-semibold">ไม่ผ่านการพิจารณา</span>}
                      {app.status === 'Canceled' && <span className="bg-zinc-500/10 dark:bg-zinc-500/10 border border-zinc-500/20 text-zinc-700 dark:text-zinc-400 px-4 py-1.5 rounded-full text-xs font-semibold">สละสิทธิ์แล้ว</span>}
                      {app.status === 'Completed' && <span className="bg-blue-500/10 dark:bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400 px-4 py-1.5 rounded-full text-xs font-semibold">ประเมินผลแล้ว</span>}
                      {app.status === 'Matched' && (
                        <>
                          <span className="bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-4 py-1.5 rounded-full text-xs font-semibold mr-2">MATCHED</span>
                          <button onClick={() => { setCancelReason(''); setCancelModal({ show: true, appId: app.id, companyName: app.company }); }} className="px-4 py-2 text-xs font-semibold text-rose-700 transition-colors border border-rose-200 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 rounded-xl hover:bg-rose-100 mr-2">สละสิทธิ์</button>
                          <button onClick={() => setActiveChatId(activeChatId === app.id ? null : app.id)} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white transition-colors shadow-sm dark:text-black rounded-xl bg-zinc-900 dark:bg-white hover:bg-zinc-800"><IconChat /> บริษัท</button>
                          <button onClick={() => generateAI('email', app)} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-indigo-700 transition-colors border border-indigo-200 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl hover:bg-indigo-100"><IconSparkles /> ร่างอีเมล</button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <AnimatePresence>
                    {activeChatId && (activeChatId === app.id || activeChatId === `${app.id}-TS`) && (
                      <motion.div initial={{ height: 0, opacity: 0, marginTop: 0 }} animate={{ height: 'auto', opacity: 1, marginTop: 24 }} exit={{ height: 0, opacity: 0, marginTop: 0 }} className="overflow-hidden border shadow-inner border-zinc-200 dark:border-white/5 rounded-2xl bg-zinc-50/50 dark:bg-[#0a0a0a]">
                        <div className="flex items-center justify-between px-5 py-3 text-xs font-semibold tracking-wide uppercase border-b text-zinc-600 dark:text-zinc-400 bg-zinc-100/80 dark:bg-white/5 border-zinc-200 dark:border-white/5">
                          สนทนากับ: {activeChatId === app.id ? `HR ${app.company}` : 'อาจารย์ที่ปรึกษา'}
                        </div>
                        <div className="flex flex-col h-56 p-5 space-y-3 overflow-y-auto bg-white/50 dark:bg-transparent">
                          {chatMessages.map(m => (
                            <div key={m.id} className={`max-w-[75%] p-3.5 rounded-2xl text-sm shadow-sm ${m.sender === 'student' ? 'bg-zinc-900 dark:bg-white text-white dark:text-black ml-auto rounded-br-sm' : 'bg-white dark:bg-[#1a1a1a] text-zinc-800 dark:text-zinc-200 mr-auto rounded-bl-sm border border-zinc-200 dark:border-white/5'}`}>
                              <p className="m-0 font-medium leading-relaxed">{m.text}</p>
                            </div>
                          ))}
                        </div>
                        <form onSubmit={handleSendChat} className="flex gap-3 p-3 bg-white border-t dark:bg-[#121212] border-zinc-200 dark:border-white/5">
                          <input type="text" value={typedMessage} onChange={e=>setTypedMessage(e.target.value)} placeholder="พิมพ์ข้อความ..." className="flex-1 px-4 py-2.5 text-sm transition-all border outline-none bg-[#1a1a1a] border-white/10 text-white placeholder-gray-400 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                          <button type="submit" className="px-5 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-black text-sm font-semibold rounded-xl">ส่ง</button>
                        </form>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {aiContent[app.id] && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`mt-5 p-6 border rounded-2xl shadow-sm ${aiContent[app.id].type === 'email' ? 'bg-indigo-50/30 dark:bg-indigo-500/5 border-indigo-100' : 'bg-purple-50/30 dark:bg-purple-500/5 border-purple-100'}`}>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className={`font-bold tracking-tight text-sm m-0 ${aiContent[app.id].type === 'email' ? 'text-indigo-700 dark:text-indigo-400' : 'text-purple-700 dark:text-purple-400'}`}>
                            {aiContent[app.id].type === 'email' ? 'ฉบับร่างอีเมลสมัครงาน' : 'คลังคำถามจำลองสัมภาษณ์'}
                          </h4>
                          {aiContent[app.id].type === 'email' && !aiLoading && <button onClick={() => {navigator.clipboard.writeText(aiContent[app.id].data); showToast('คัดลอกลงคลิปบอร์ดแล้ว!', 'info');}} className="px-4 py-1.5 bg-white dark:bg-[#1a1a1a] border border-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold shadow-sm hover:bg-indigo-50">คัดลอก</button>}
                        </div>
                        <div className="p-6 text-sm leading-relaxed whitespace-pre-line bg-white dark:bg-[#0a0a0a] border shadow-sm text-zinc-700 dark:text-zinc-300 rounded-xl border-zinc-100">
                          {aiContent[app.id].data}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </motion.div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
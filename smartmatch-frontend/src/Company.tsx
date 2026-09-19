import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { ParsedSkill, Application } from './types';
import { apiJson, fileURL } from './apiClient';

interface Message { id: number; application_id: string; sender: string; text: string; created_at: string; }

// Premium Icons
const IconBriefcase = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" /></svg>;
const IconUsers = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>;
const IconBadge = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /></svg>;
const IconBuilding = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" /></svg>;
const IconClipboard = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>;
const IconChat = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.436 3 11.996c0 2.29.932 4.35 2.44 5.86l-1.92 2.91a.75.75 0 00.91 1.09l3.22-1.39a9.123 9.123 0 004.35 1.034z" /></svg>;
const IconSparkles = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>;

const containerVariants: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants: Variants = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } } };

export default function Company({ activeMenu, setActiveMenu, showToast }: { activeMenu: string, setActiveMenu: (m: string) => void, showToast: (msg: string, type: 'success' | 'error' | 'info') => void }) {
  const [logo, setLogo] = useState<string | null>(null);
  const [profileData, setProfileData] = useState(() => {
    const saved = localStorage.getItem('companyProfile');
    return saved ? JSON.parse(saved) : { companyName: 'InternSmartMatch Co., Ltd.', industry: 'Technology / Software', location: 'กรุงเทพมหานคร, ประเทศไทย', website: 'https://ai-internmatch.com', culture: 'เราเป็น Tech Startup ที่เน้นการทำงานแบบ Agile เปิดรับไอเดียใหม่ๆ และให้ความสำคัญกับการเติบโตของพนักงาน' };
  });

  const [jd, setJd] = useState("We are looking for a Junior React Developer...\nRequirements:\n- React.js\n- Node.js\n- RESTful APIs");
  const [newJob, setNewJob] = useState({ title: '' }); 
  const [extractedSkills, setExtractedSkills] = useState<ParsedSkill[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [applicants, setApplicants] = useState<Application[]>([]);
  const [matchedList, setMatchedList] = useState<Application[]>([]);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [typedMessage, setTypedMessage] = useState('');
  
  const [myPostedJobs, setMyPostedJobs] = useState<any[]>([]);
  const [evalModal, setEvalModal] = useState({ show: false, appId: '', studentName: '' });
  const [evalScore, setEvalScore] = useState('');
  const [evalComment, setEvalComment] = useState('');

  const fetchMyJobs = () => {
    apiJson('/api/jobs')
      .then((data) => {
        if (data.data) {
          setMyPostedJobs([...data.data].reverse());
        }
      })
      .catch(() => {});
  };

  useEffect(() => { fetchMyJobs(); }, [activeMenu, profileData.companyName]);

  useEffect(() => {
    const fetchApps = () => { apiJson('/api/applications').then((data) => { if (Array.isArray(data)) setApplicants([...data].sort((a: any, b: any) => b.match_percentage - a.match_percentage)); }).catch(() => {}); };
    if (activeMenu === '5' || activeMenu === 'hr-home') fetchApps();
    const interval = setInterval(() => { if (activeMenu === '5' || activeMenu === 'hr-home') fetchApps(); }, 3000);
    return () => clearInterval(interval);
  }, [activeMenu]);

  useEffect(() => {
    const fetchMatches = () => { apiJson('/api/hr-matches').then((data) => setMatchedList(data || [])).catch(() => {}); };
    if (activeMenu === '6' || activeMenu === 'hr-home') fetchMatches();
    const interval = setInterval(fetchMatches, 3000); return () => clearInterval(interval);
  }, [activeMenu]);

  useEffect(() => {
    if (!activeChatId) return;
    const fetchChat = () => apiJson(`/api/chat/messages?application_id=${encodeURIComponent(activeChatId)}`).then((data) => setChatMessages(data || [])).catch(() => {});
    fetchChat(); const interval = setInterval(fetchChat, 2000); return () => clearInterval(interval);
  }, [activeChatId]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) setLogo(URL.createObjectURL(e.target.files[0])); };
  const handleSaveProfile = () => { localStorage.setItem('companyProfile', JSON.stringify(profileData)); showToast('อัปเดตข้อมูลบริษัทเรียบร้อยแล้ว!', 'success'); fetchMyJobs(); };

  const handleAnalyzeJD = async () => {
    if (!jd.trim()) return;
    setIsAnalyzing(true);
    try {
      const data = await apiJson('/api/extract-jd', { method: 'POST', body: JSON.stringify({ text: jd }) });
      if (data.skills) { setExtractedSkills(data.skills.map((s: any) => ({ skill: s.skill, weight: (s.weight || 'STANDARD').toUpperCase() }))); showToast('สกัดทักษะจาก JD เสร็จสมบูรณ์', 'success'); }
    } catch (e) { showToast('เกิดข้อผิดพลาดในการวิเคราะห์ AI', 'error'); } finally { setIsAnalyzing(false); }
  };

  const handleWeightChange = (index: number, weight: 'STANDARD' | 'IMPORTANT' | 'CRITICAL') => { const updated = [...extractedSkills]; updated[index].weight = weight; setExtractedSkills(updated); };

  const handlePostJob = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newJob.title || extractedSkills.length === 0) { showToast('ข้อมูลไม่ครบ หรือยังไม่ได้วิเคราะห์ JD', 'error'); return; }
    try {
      await apiJson('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ title: newJob.title, company: profileData.companyName, required_skills: extractedSkills }),
      });
      showToast(`ลงประกาศงาน ${newJob.title} สำเร็จ!`, 'success');
      const newJobData = { title: newJob.title, company: profileData.companyName, skills: extractedSkills };
      setMyPostedJobs([newJobData, ...myPostedJobs]);
      setNewJob({ title: '' }); setExtractedSkills([]);
    } catch (error) { showToast('ระบบมีปัญหา ไม่สามารถประกาศงานได้', 'error'); }
  };

  const handleAction = (type: 'like' | 'pass', applicantId: string) => {
    setSwipeDirection(type === 'like' ? 'right' : 'left');
    apiJson('/api/update-status', { method: 'POST', body: JSON.stringify({ id: applicantId, status: type === 'like' ? 'Matched' : 'Rejected' }) }).then(() => { if (type === 'like') showToast('Match สำเร็จ!', 'success'); }).catch(() => {});
    setTimeout(() => { setApplicants(prev => prev.slice(1)); setSwipeDirection(null); }, 300);
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault(); if (!typedMessage.trim() || !activeChatId) return;
    await apiJson('/api/chat/send', { method: 'POST', body: JSON.stringify({ application_id: activeChatId, text: typedMessage.trim() }) });
    setTypedMessage('');
  };

  const submitEvaluation = () => {
    const scoreNum = Number(evalScore);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100 || evalScore === '') { showToast('กรุณาระบุคะแนนให้ถูกต้อง (0-100)', 'error'); return; }
    apiJson('/api/evaluate', { method: 'POST', body: JSON.stringify({ application_id: evalModal.appId, score: scoreNum, comment: evalComment }) }).then(() => {
      showToast('บันทึกการประเมินสำเร็จ สถานะเปลี่ยนเป็น Completed', 'success');
      setEvalModal({ show: false, appId: '', studentName: '' }); setEvalScore(''); setEvalComment('');
      apiJson('/api/hr-matches').then((data) => setMatchedList(data || [])).catch(() => {});
    }).catch(() => showToast('บันทึกการประเมินไม่สำเร็จ', 'error'));
  };

  return (
    <div className="relative w-full pb-20 transition-colors duration-500 text-zinc-900 dark:text-zinc-100">
      
      <AnimatePresence>
        {evalModal.show && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="w-full max-w-md p-6 bg-white border dark:bg-[#161616] rounded-3xl border-zinc-200 dark:border-zinc-800 shadow-2xl">
              <h3 className="flex items-center gap-2 mb-2 text-xl font-bold text-blue-600 dark:text-blue-500"><IconClipboard /> ประเมินผลการฝึกงาน</h3>
              <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">นักศึกษา: <strong className="text-zinc-900 dark:text-zinc-100">{evalModal.studentName}</strong></p>
              <label className="block mb-2 text-xs font-bold tracking-wide uppercase text-zinc-500">คะแนนประเมิน (0-100)</label>
              <input type="number" min="0" max="100" value={evalScore} onChange={e => { let val = parseInt(e.target.value); if (val > 100) val = 100; if (val < 0) val = 0; setEvalScore(isNaN(val) ? '' : val.toString()); }} placeholder="เช่น 85" className="w-full p-4 mb-4 text-2xl font-black text-center transition-all border outline-none bg-[#1a1a1a] text-white placeholder-gray-400 border-white/10 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
              <label className="block mb-2 text-xs font-bold tracking-wide uppercase text-zinc-500">ข้อเสนอแนะเพิ่มเติม (Optional)</label>
              <textarea value={evalComment} onChange={e=>setEvalComment(e.target.value)} placeholder="จุดแข็ง จุดอ่อน..." className="w-full h-20 p-3 mb-6 text-sm transition-all border outline-none resize-none bg-[#1a1a1a] text-white placeholder-gray-400 border-white/10 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
              <div className="flex gap-3">
                <button onClick={() => setEvalModal({show:false, appId:'', studentName:''})} className="flex-1 py-3 text-sm font-bold transition-colors bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700">ยกเลิก</button>
                <button onClick={submitEvaluation} className="flex-1 py-3 text-sm font-bold text-white transition-colors shadow-lg bg-blue-600 rounded-xl hover:bg-blue-700">ยืนยัน</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">

        {activeMenu === 'hr-home' && (
          <motion.div key="hr-home" variants={containerVariants} initial="hidden" animate="show" exit="hidden" className="w-full max-w-5xl mx-auto">
            <motion.div variants={itemVariants} className="mb-10">
              <h2 className="text-3xl font-extrabold tracking-tighter text-zinc-900 dark:text-zinc-100">สวัสดี, ทีม HR</h2>
              <p className="mt-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">ภาพรวมการประกาศรับสมัครงานและผู้สมัครของ {profileData.companyName}</p>
            </motion.div>

            <motion.div variants={containerVariants} className="grid grid-cols-1 gap-6 mb-10 md:grid-cols-3">
              <motion.div variants={itemVariants} whileHover={{ y: -4 }} onClick={() => setActiveMenu('4')} className="cursor-pointer p-6 bg-white dark:bg-[#161616] border border-zinc-200/50 dark:border-white/5 shadow-sm rounded-3xl relative overflow-hidden group">
                <div className="absolute inset-0 transition-opacity duration-500 opacity-0 bg-indigo-500/5 dark:bg-indigo-500/10 group-hover:opacity-100"></div>
                <div className="flex items-center justify-between mb-4"><div className="flex items-center justify-center w-10 h-10 text-indigo-600 bg-indigo-100 rounded-full dark:bg-indigo-500/20 dark:text-indigo-400"><IconBriefcase /></div></div>
                <h3 className="m-0 text-4xl font-black tracking-tighter text-zinc-900 dark:text-white">Active</h3>
                <p className="mt-2 text-xs font-bold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">ไปที่ระบบสร้างประกาศงาน</p>
              </motion.div>

              <motion.div variants={itemVariants} whileHover={{ y: -4 }} onClick={() => setActiveMenu('5')} className="cursor-pointer p-6 bg-white dark:bg-[#161616] border border-zinc-200/50 dark:border-white/5 shadow-sm rounded-3xl relative overflow-hidden group">
                <div className="absolute inset-0 transition-opacity duration-500 opacity-0 bg-amber-500/5 dark:bg-amber-500/10 group-hover:opacity-100"></div>
                <div className="flex items-center justify-between mb-4"><div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"><IconUsers /></div></div>
                <h3 className="m-0 text-4xl font-black tracking-tighter text-amber-600 dark:text-amber-400">{applicants.length}</h3>
                <p className="mt-2 text-xs font-bold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">ผู้สมัครใหม่รอคัดกรอง</p>
              </motion.div>

              <motion.div variants={itemVariants} whileHover={{ y: -4 }} onClick={() => setActiveMenu('6')} className="cursor-pointer p-6 bg-white dark:bg-[#161616] border border-zinc-200/50 dark:border-white/5 shadow-sm rounded-3xl relative overflow-hidden group">
                <div className="absolute inset-0 transition-opacity duration-500 opacity-0 bg-emerald-500/5 dark:bg-emerald-500/10 group-hover:opacity-100"></div>
                <div className="flex items-center justify-between mb-4"><div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"><IconBadge /></div></div>
                <h3 className="m-0 text-4xl font-black tracking-tighter text-emerald-600 dark:text-emerald-400">{matchedList.length}</h3>
                <p className="mt-2 text-xs font-bold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">ผู้สมัครที่ Match แล้ว</p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}

        {activeMenu === '8' && (
          <motion.div key="menu8" variants={containerVariants} initial="hidden" animate="show" exit="hidden" className="w-full max-w-4xl mx-auto">
            <motion.div variants={itemVariants} className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-zinc-800 to-zinc-500 dark:from-white dark:to-zinc-400">Company Profile</h2>
              <span className="px-4 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full shadow-sm flex items-center gap-2"><IconBuilding /> HR Workspace</span>
            </motion.div>

            <motion.div variants={itemVariants} className="p-8 mb-8 bg-white/70 dark:bg-[#161616] backdrop-blur-xl border shadow-sm rounded-[2rem] border-zinc-200/50 dark:border-white/5">
              <div className="flex flex-col items-center gap-6 mb-10 sm:flex-row">
                <div className="relative flex items-center justify-center overflow-hidden border-4 border-white shadow-xl cursor-pointer w-28 h-28 rounded-2xl bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-700 group">
                  {logo ? <img src={logo} alt="Company Logo" className="object-cover w-full h-full" /> : <div className="text-slate-400"><IconBuilding /></div>}
                  <div className="absolute inset-0 flex items-center justify-center transition-opacity opacity-0 bg-black/60 group-hover:opacity-100 backdrop-blur-sm"><span className="text-xs font-bold tracking-wider text-center text-white uppercase">Upload<br/>Logo</span></div>
                  <input type="file" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                </div>
                <div className="text-center sm:text-left">
                  <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{profileData.companyName}</h3>
                  <p className="mt-1 text-sm font-medium text-indigo-600 dark:text-indigo-400">{profileData.industry}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="md:col-span-2"><label className="block mb-2 text-xs font-semibold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">ชื่อบริษัท (COMPANY NAME)</label><input type="text" value={profileData.companyName} onChange={e => setProfileData({...profileData, companyName: e.target.value})} className="w-full p-4 text-sm transition-all bg-[#1a1a1a] border border-white/10 outline-none rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400" /></div>
                <div><label className="block mb-2 text-xs font-semibold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">ที่ตั้งบริษัท (LOCATION)</label><input type="text" value={profileData.location} onChange={e => setProfileData({...profileData, location: e.target.value})} className="w-full p-4 text-sm transition-all bg-[#1a1a1a] border border-white/10 outline-none rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400" /></div>
                <div><label className="block mb-2 text-xs font-semibold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">เว็บไซต์ (WEBSITE)</label><input type="url" value={profileData.website} onChange={e => setProfileData({...profileData, website: e.target.value})} className="w-full p-4 text-sm transition-all bg-[#1a1a1a] border border-white/10 outline-none rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400" /></div>
                <div className="md:col-span-2"><label className="block mb-2 text-xs font-semibold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">วัฒนธรรมองค์กร & สวัสดิการ (CULTURE & BENEFITS)</label><textarea value={profileData.culture} onChange={e => setProfileData({...profileData, culture: e.target.value})} className="w-full p-4 text-sm transition-all bg-[#1a1a1a] border border-white/10 outline-none rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400 resize-none h-32" /></div>
              </div>
              <div className="pt-8 mt-8 border-t border-zinc-100 dark:border-white/5">
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={handleSaveProfile} className="w-full py-4 text-sm font-semibold tracking-tight text-white transition-colors shadow-lg bg-zinc-900 dark:bg-white dark:text-black rounded-2xl hover:bg-zinc-800 dark:hover:bg-zinc-200">บันทึกข้อมูลบริษัท</motion.button>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="mt-8 p-8 bg-white/70 dark:bg-[#161616] backdrop-blur-xl border shadow-sm rounded-[2rem] border-zinc-200/50 dark:border-white/5">
              <h3 className="flex items-center gap-2 mb-6 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100"><IconClipboard /> งานที่คุณประกาศไว้ (Posted Jobs)</h3>
              {myPostedJobs.length === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400">ยังไม่มีประกาศงาน</p> : (
                <div className="space-y-4">
                  {myPostedJobs.map((job, idx) => (
                    <div key={idx} className="p-5 border bg-zinc-50 dark:bg-[#1a1a1a] rounded-2xl border-zinc-200 dark:border-white/10">
                      <h4 className="font-bold text-indigo-600 dark:text-indigo-400">{job.title}</h4>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {job.skills && job.skills.map((s: any, i: number) => (
                          <span key={i} className="px-2 py-1 text-[10px] font-bold border rounded-md text-zinc-600 border-zinc-200 bg-white dark:bg-[#2a2a2a] dark:text-zinc-300 dark:border-zinc-700">{s.skill} ({s.weight})</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {activeMenu === '4' && (
          <motion.div key="menu4" variants={containerVariants} initial="hidden" animate="show" exit="hidden" className="w-full max-w-6xl mx-auto">
            <motion.div variants={itemVariants} className="flex items-center gap-5 mb-10">
              <div className="flex items-center justify-center text-2xl text-white border shadow-lg w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-indigo-500/20 dark:shadow-indigo-500/10 border-white/20"><IconSparkles /></div>
              <div><h2 className="m-0 text-3xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-zinc-800 to-zinc-500 dark:from-white dark:to-zinc-400">Smart Job Posting</h2><p className="m-0 mt-1 text-sm font-medium tracking-wide text-zinc-500 dark:text-zinc-400">AI Requirement Parser</p></div>
            </motion.div>

            <div className="flex flex-col gap-8 lg:flex-row">
              <motion.div variants={itemVariants} className="flex-1 p-8 bg-white/70 dark:bg-[#121212] backdrop-blur-xl border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none rounded-[2rem] border-zinc-200/50 dark:border-white/5">
                <p className="mb-4 text-xs font-semibold tracking-wide uppercase text-zinc-800 dark:text-zinc-300">Job Description (JD) (จำลอง AI)</p>
                <textarea value={jd} onChange={e=>setJd(e.target.value)} className="w-full h-40 p-5 mb-6 text-sm transition-all bg-[#1a1a1a] border outline-none resize-none text-white placeholder-gray-400 border-white/10 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} type="button" onClick={handleAnalyzeJD} disabled={isAnalyzing} className="w-full flex items-center justify-center gap-2 py-4 mb-8 text-sm font-semibold tracking-tight text-white transition-colors bg-indigo-600 shadow-lg dark:bg-indigo-500 rounded-2xl shadow-indigo-500/20 dark:shadow-none hover:bg-indigo-700 dark:hover:bg-indigo-400 disabled:opacity-50">
                  {isAnalyzing ? 'กำลังสกัดทักษะด้วย AI...' : <><IconSparkles /> วิเคราะห์ทักษะจาก JD ด้วย AI</>}
                </motion.button>
                
                <div className="pt-8 border-t border-zinc-100 dark:border-white/5">
                  <form onSubmit={handlePostJob}>
                    <input type="text" placeholder="ตำแหน่งงานจริง เช่น Software Engineer" value={newJob.title} onChange={e=>setNewJob({...newJob, title:e.target.value})} className="w-full p-4 mb-4 text-sm transition-all bg-[#1a1a1a] border border-white/10 outline-none rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400" required />
                    <input type="text" placeholder="ชื่อบริษัท" value={profileData.companyName} readOnly className="w-full p-4 mb-8 text-sm transition-all bg-[#1a1a1a] border border-white/10 outline-none rounded-2xl text-gray-400 placeholder-gray-400 cursor-not-allowed" />
                    <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} type="submit" className="w-full py-4 text-sm font-semibold tracking-tight text-white transition-colors shadow-lg bg-zinc-900 dark:bg-white dark:text-black rounded-2xl shadow-zinc-900/20 dark:shadow-none hover:bg-zinc-800 dark:hover:bg-zinc-200">โพสต์ประกาศงานจริง</motion.button>
                  </form>
                </div>
              </motion.div>
              
              <motion.div variants={itemVariants} className="flex-1 p-8 border shadow-inner bg-zinc-50/50 dark:bg-[#0f0f0f] rounded-[2rem] border-zinc-200/50 dark:border-white/5">
                <div className="flex items-center justify-between mb-6">
                  <p className="m-0 text-xs font-semibold tracking-wide uppercase text-zinc-800 dark:text-zinc-300">Skill Weight Config</p>
                  <span className="px-3 py-1 text-[10px] font-bold text-zinc-500 bg-zinc-200/50 dark:bg-white/10 rounded-full">{extractedSkills.length} SKILLS</span>
                </div>
                <div className="overflow-y-auto max-h-[450px] pr-2 scrollbar-hide">
                  {extractedSkills.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-2xl border-zinc-200 dark:border-white/5">
                      <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500">กรุณากดวิเคราะห์ JD ด้วย AI ก่อน</p>
                    </div>
                  ) : extractedSkills.map((s,i) => (
                    <motion.div key={i} variants={itemVariants} className="p-5 mb-4 bg-white dark:bg-[#161616] border border-white/40 dark:border-white/5 shadow-sm rounded-2xl transition-all">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-bold tracking-tight text-zinc-800 dark:text-zinc-100">{s.skill}</span>
                        <span className={`text-[9px] font-black px-2.5 py-1 rounded-md tracking-wider uppercase ${s.weight === 'CRITICAL' ? 'bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400' : s.weight === 'IMPORTANT' ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'bg-zinc-500/10 border border-zinc-500/20 text-zinc-600 dark:text-zinc-400'}`}>
                          {s.weight}
                        </span>
                      </div>
                      <div className="flex gap-2 p-1.5 border rounded-xl bg-zinc-50 dark:bg-[#0a0a0a] border-zinc-100 dark:border-white/5">
                        {['STANDARD', 'IMPORTANT', 'CRITICAL'].map(level => (
                          <button type="button" key={level} onClick={() => handleWeightChange(i, level as any)} className={`flex-1 text-[10px] py-2 rounded-lg font-bold transition-colors ${s.weight === level ? 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-sm' : 'text-zinc-400 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-white/10'}`}>
                            {level.charAt(0) + level.slice(1).toLowerCase()}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        {activeMenu === '5' && (
          <motion.div key="menu5" variants={containerVariants} initial="hidden" animate="show" exit="hidden" className="flex flex-col items-center max-w-xl mx-auto">
            <motion.div variants={itemVariants} className="mb-10 text-center">
              <h2 className="flex items-center justify-center gap-3 mb-2 text-3xl font-extrabold tracking-tighter text-zinc-900 dark:text-zinc-100">Candidate Screening</h2>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">ปัดขวาเพื่อรับเข้าทำงาน ปัดซ้ายเพื่อปฏิเสธ</p>
            </motion.div>
            
            {applicants.length > 0 ? (
              <motion.div 
                animate={{ x: swipeDirection === 'right' ? 300 : swipeDirection === 'left' ? -300 : 0, rotate: swipeDirection === 'right' ? 12 : swipeDirection === 'left' ? -12 : 0, opacity: swipeDirection ? 0 : 1 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="bg-white/90 dark:bg-[#111111] backdrop-blur-2xl border border-white dark:border-white/10 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] rounded-[2rem] p-8 w-full max-w-md relative mb-10"
              >
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-400 px-5 py-1.5 rounded-full text-xs font-bold shadow-lg whitespace-nowrap">
                  Match Score {applicants[0].match_percentage}%
                </div>
                
                <div className="mt-6 mb-6 text-center">
                  <h3 className="m-0 text-2xl font-black leading-tight tracking-tight text-zinc-900 dark:text-white">{applicants[0].name}</h3>
                  <p className="m-0 mt-2 text-xs font-semibold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">Applied for: <span className="font-bold text-indigo-600 dark:text-indigo-400">{applicants[0].job_title}</span></p>
                </div>
                
                <div className="flex items-center justify-center w-full h-64 p-3 mb-6 border bg-zinc-50 dark:bg-[#0a0a0a] rounded-2xl border-zinc-200/50 dark:border-white/5">
                  <img src={fileURL(applicants[0].resume_url) || 'https://via.placeholder.com/150?text=No+Resume+Image'} alt="Resume" className="object-contain max-h-full border shadow-sm border-zinc-200 dark:border-white/10 rounded-xl opacity-90 dark:opacity-80" />
                </div>

                <div className="p-5 mb-8 text-left border bg-zinc-50/80 dark:bg-white/5 rounded-2xl border-zinc-100 dark:border-white/5">
                  <span className="block mb-4 text-[10px] font-bold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">ทักษะที่ AI สกัดได้จากผู้สมัคร</span>
                  <div className="flex flex-wrap gap-2">
                    {(applicants[0].skills || []).map((s, i) => (
                      <span key={i} className="bg-white dark:bg-white/10 border border-zinc-200 dark:border-white/5 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex justify-center gap-6 mt-4">
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => handleAction('pass', applicants[0].id)} className="flex items-center justify-center w-16 h-16 text-2xl text-red-500 transition-colors bg-white dark:bg-[#1a1a1a] border border-zinc-200 dark:border-white/10 rounded-full shadow-lg hover:bg-red-50 dark:hover:bg-red-900/20">✕</motion.button>
                  <motion.button whileHover={{ scale: 1.1, boxShadow: "0 10px 25px -5px rgba(16,185,129,0.4)" }} whileTap={{ scale: 0.95 }} onClick={() => handleAction('like', applicants[0].id)} className="flex items-center justify-center w-16 h-16 text-2xl text-white transition-shadow rounded-full shadow-lg bg-emerald-500 dark:bg-emerald-600">✓</motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.div variants={itemVariants} className="w-full p-12 text-center bg-white/70 dark:bg-[#121212] backdrop-blur-xl border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none rounded-[2rem] border-zinc-200/50 dark:border-white/5">
                <p className="mb-2 text-lg font-semibold tracking-tight text-zinc-800 dark:text-zinc-100">ตรวจสอบใบสมัครครบทุกคนแล้ว</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">ระบบจะทำการแจ้งเตือนเมื่อมีผู้สมัครรายใหม่</p>
              </motion.div>
            )}
          </motion.div>
        )}

        {activeMenu === '6' && (
          <motion.div key="menu6" variants={containerVariants} initial="hidden" animate="show" exit="hidden" className="max-w-5xl mx-auto">
            <motion.div variants={itemVariants} className="flex items-center justify-between mb-8">
              <h2 className="flex items-center gap-3 text-3xl font-extrabold tracking-tighter text-zinc-900 dark:text-zinc-100">Mutual Matches</h2>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => showToast('เริ่มดาวน์โหลดไฟล์ CSV แล้ว', 'info')} className="px-5 py-2.5 text-xs font-bold text-white dark:text-black bg-zinc-900 dark:bg-white rounded-xl shadow-lg shadow-zinc-900/20 dark:shadow-none transition-colors hover:bg-zinc-800 dark:hover:bg-zinc-200">Export CSV</motion.button>
            </motion.div>
            
            <motion.div variants={containerVariants}>
              {matchedList.length === 0 ? <p className="py-10 font-medium text-center text-zinc-400 dark:text-zinc-500">ยังไม่มีผู้สมัครที่ตรงใจ</p> : 
                matchedList.map((match, i) => (
                <motion.div variants={itemVariants} key={i} className="p-6 mb-5 bg-white/60 dark:bg-[#161616] backdrop-blur-md border shadow-sm border-zinc-200/60 dark:border-white/5 rounded-[1.5rem] hover:shadow-md transition-shadow">
                  <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
                    <div>
                      <h4 className="mb-1 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{match.name}</h4>
                      <p className="flex items-center gap-2 m-0 mt-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{match.job_title}</span> 
                        {match.status === 'Completed' ? (
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md text-[10px] uppercase tracking-wider font-black border border-blue-500/20">ประเมินผลแล้ว</span>
                        ) : match.status === 'Canceled' ? (
                          <span className="px-2 py-0.5 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 rounded-md text-[10px] uppercase tracking-wider font-black border border-zinc-500/20">สละสิทธิ์แล้ว</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md text-[10px] uppercase tracking-wider font-black border border-emerald-500/20">Match {match.match_percentage}%</span>
                        )}
                      </p>
                    </div>
                    
                    <div className="flex flex-wrap gap-3">
                      {match.status === 'Matched' && (
                        <button onClick={() => { setEvalScore(''); setEvalComment(''); setEvalModal({ show: true, appId: match.id, studentName: match.name }); }} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-colors bg-blue-600 text-white hover:bg-blue-700"><IconClipboard /> ประเมินผลงาน</button>
                      )}
                      <button onClick={() => setActiveChatId(activeChatId === match.id ? null : match.id)} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-colors ${activeChatId === match.id ? 'bg-zinc-900 dark:bg-white text-white dark:text-black' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'}`}><IconChat /> นักศึกษา</button>
                      <button onClick={() => setActiveChatId(activeChatId === `${match.id}-TH` ? null : `${match.id}-TH`)} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-colors border border-zinc-200 dark:border-white/10 ${activeChatId === `${match.id}-TH` ? 'bg-zinc-900 dark:bg-white text-white dark:text-black' : 'bg-zinc-50 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10'}`}><IconChat /> อาจารย์</button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {activeChatId && (activeChatId === match.id || activeChatId === `${match.id}-TH`) && (
                      <motion.div initial={{ height: 0, opacity: 0, marginTop: 0 }} animate={{ height: 'auto', opacity: 1, marginTop: 24 }} exit={{ height: 0, opacity: 0, marginTop: 0 }} className="overflow-hidden border shadow-inner border-zinc-200 dark:border-white/5 rounded-2xl bg-zinc-50/50 dark:bg-[#0a0a0a]">
                        <div className="flex items-center justify-between px-5 py-3 text-xs font-semibold tracking-wide uppercase border-b text-zinc-600 dark:text-zinc-400 bg-zinc-100/80 dark:bg-white/5 border-zinc-200 dark:border-white/5">กำลังสนทนากับ: {activeChatId === match.id ? <span className="ml-1 font-black text-indigo-600 dark:text-indigo-400">{match.name}</span> : 'อาจารย์ที่ปรึกษา'}</div>
                        <div className="flex flex-col h-56 p-5 space-y-3 overflow-y-auto bg-white/50 dark:bg-transparent">
                          {chatMessages.length === 0 ? <p className="py-4 my-auto text-xs font-medium text-center text-zinc-400 dark:text-zinc-500">เริ่มพิมพ์ข้อความตอบกลับ...</p> : 
                            chatMessages.map(m => (
                            <div key={m.id} className={`max-w-[75%] p-3.5 rounded-2xl text-sm shadow-sm ${m.sender === 'company' ? 'bg-indigo-600 dark:bg-indigo-500 text-white ml-auto rounded-br-sm' : 'bg-white dark:bg-[#1a1a1a] text-zinc-800 dark:text-zinc-200 mr-auto rounded-bl-sm border border-zinc-200 dark:border-white/5'}`}>
                              <div className="font-bold text-[9px] mb-1.5 opacity-60 uppercase tracking-wider">{m.sender}</div>
                              <p className="m-0 font-medium leading-relaxed">{m.text}</p>
                              <span className="block text-[9px] text-right mt-2 opacity-50">{m.created_at}</span>
                            </div>
                          ))}
                        </div>
                        <form onSubmit={handleSendChat} className="flex gap-3 p-3 bg-white border-t dark:bg-[#121212] border-zinc-200 dark:border-white/5">
                          <input type="text" placeholder="พิมพ์ข้อความตอบกลับ..." value={typedMessage} onChange={e=>setTypedMessage(e.target.value)} className="flex-1 px-4 py-2.5 text-sm transition-all border outline-none bg-[#1a1a1a] border-white/10 text-white placeholder-gray-400 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                          <button type="submit" className="px-6 py-2.5 text-sm font-semibold text-white transition-colors shadow-md bg-zinc-900 dark:bg-white dark:text-black rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200">ส่ง</button>
                        </form>
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
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { ParsedSkill, Application } from './types';
import { apiJson, fileURL, friendlyApiError } from './apiClient';
import { EmptyState, PageHeading, Skeleton, SkeletonList, Spinner } from './ui';

interface Message { id: number; application_id: string; sender: string; text: string; created_at: string; }

const IconBriefcase = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" /></svg>;
const IconUsers = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>;
const IconBadge = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /></svg>;
const IconBuilding = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" /></svg>;
const IconClipboard = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>;
const IconChat = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.436 3 11.996c0 2.29.932 4.35 2.44 5.86l-1.92 2.91a.75.75 0 00.91 1.09l3.22-1.39a9.123 9.123 0 004.35 1.034z" /></svg>;
const IconSparkles = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>;

const containerVariants: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants: Variants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 110, damping: 16 } } };

const WEIGHT_LEVELS: Array<ParsedSkill['weight']> = ['STANDARD', 'IMPORTANT', 'CRITICAL'];
const WEIGHT_LABEL: Record<string, string> = { STANDARD: 'ทั่วไป', IMPORTANT: 'สำคัญ', CRITICAL: 'จำเป็นมาก' };
const WEIGHT_BADGE: Record<string, string> = { STANDARD: 'badge-neutral', IMPORTANT: 'badge-brand', CRITICAL: 'badge-danger' };

export default function Company({ activeMenu, setActiveMenu, showToast }: { activeMenu: string, setActiveMenu: (m: string) => void, showToast: (msg: string, type: 'success' | 'error' | 'info') => void }) {
  const [logo, setLogo] = useState<string | null>(null);
  const [profileData, setProfileData] = useState({ companyName: '', industry: '', location: '', website: '', culture: '' });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);

  const [jd, setJd] = useState("We are looking for a Junior React Developer...\nRequirements:\n- React.js\n- Node.js\n- RESTful APIs");
  const [newJob, setNewJob] = useState({ title: '' });
  const [extractedSkills, setExtractedSkills] = useState<ParsedSkill[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [applicants, setApplicants] = useState<Application[]>([]);
  const [applicantsLoading, setApplicantsLoading] = useState(true);
  const [matchedList, setMatchedList] = useState<Application[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [typedMessage, setTypedMessage] = useState('');

  const [myPostedJobs, setMyPostedJobs] = useState<any[]>([]);
  const [evalModal, setEvalModal] = useState({ show: false, appId: '', studentName: '' });
  const [evalScore, setEvalScore] = useState('');
  const [evalComment, setEvalComment] = useState('');
  const [loadError, setLoadError] = useState('');

  const fetchMyJobs = () => {
    apiJson('/api/jobs')
      .then((data) => {
        if (data.data) {
          setMyPostedJobs([...data.data].reverse());
        }
      })
      .catch((err) => { setLoadError(friendlyApiError(err, 'โหลดประกาศงานไม่สำเร็จ')); });
  };

  useEffect(() => { fetchMyJobs(); }, [activeMenu, profileData.companyName]);

  useEffect(() => {
    setProfileLoading(true);
    apiJson('/api/company/profile')
      .then((data) => {
        setProfileData({
          companyName: data.company_name || '',
          industry: data.industry || '',
          location: data.location || '',
          website: data.website || '',
          culture: data.culture || '',
        });
        setLoadError('');
      })
      .catch((err) => setLoadError(friendlyApiError(err, 'โหลดโปรไฟล์บริษัทไม่สำเร็จ')))
      .finally(() => setProfileLoading(false));
  }, []);

  useEffect(() => {
    const fetchApps = () => {
      apiJson('/api/applications')
        .then((data) => { if (Array.isArray(data)) { setApplicants([...data].sort((a: any, b: any) => b.match_percentage - a.match_percentage)); setLoadError(''); } })
        .catch((err) => { setLoadError(friendlyApiError(err, 'โหลดผู้สมัครไม่สำเร็จ')); })
        .finally(() => setApplicantsLoading(false));
    };
    if (activeMenu === '5' || activeMenu === 'hr-home') fetchApps();
    const interval = setInterval(() => { if (activeMenu === '5' || activeMenu === 'hr-home') fetchApps(); }, 3000);
    return () => clearInterval(interval);
  }, [activeMenu]);

  useEffect(() => {
    const fetchMatches = () => {
      apiJson('/api/hr-matches')
        .then((data) => { setMatchedList(data || []); setLoadError(''); })
        .catch((err) => { setLoadError(friendlyApiError(err, 'โหลดรายการ Match ไม่สำเร็จ')); })
        .finally(() => setMatchesLoading(false));
    };
    if (activeMenu === '6' || activeMenu === 'hr-home') fetchMatches();
    const interval = setInterval(fetchMatches, 3000); return () => clearInterval(interval);
  }, [activeMenu]);

  useEffect(() => {
    if (!activeChatId) return;
    const fetchChat = () => apiJson(`/api/chat/messages?application_id=${encodeURIComponent(activeChatId)}`).then((data) => setChatMessages(data || [])).catch(() => {});
    fetchChat(); const interval = setInterval(fetchChat, 2000); return () => clearInterval(interval);
  }, [activeChatId]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) setLogo(URL.createObjectURL(e.target.files[0])); };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      await apiJson('/api/company/profile', {
        method: 'PUT',
        body: JSON.stringify({
          company_name: profileData.companyName,
          industry: profileData.industry,
          location: profileData.location,
          website: profileData.website,
          culture: profileData.culture,
        }),
      });
      showToast('อัปเดตข้อมูลบริษัทเรียบร้อยแล้ว!', 'success');
      fetchMyJobs();
    } catch (err) {
      showToast(friendlyApiError(err, 'บันทึกโปรไฟล์บริษัทไม่สำเร็จ'), 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAnalyzeJD = async () => {
    if (!jd.trim()) return;
    setIsAnalyzing(true);
    try {
      const data = await apiJson('/api/extract-jd', { method: 'POST', body: JSON.stringify({ text: jd }) });
      if (data.skills) { setExtractedSkills(data.skills.map((s: any) => ({ skill: s.skill, weight: (s.weight || 'STANDARD').toUpperCase() }))); showToast('สกัดทักษะจาก JD เสร็จสมบูรณ์', 'success'); }
    } catch (e) { showToast(friendlyApiError(e, 'เกิดข้อผิดพลาดในการวิเคราะห์ AI'), 'error'); } finally { setIsAnalyzing(false); }
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
    } catch (error) { showToast(friendlyApiError(error, 'ระบบมีปัญหา ไม่สามารถประกาศงานได้'), 'error'); }
  };

  const handleAction = (type: 'like' | 'pass', applicantId: string) => {
    setSwipeDirection(type === 'like' ? 'right' : 'left');
    apiJson('/api/update-status', { method: 'POST', body: JSON.stringify({ id: applicantId, status: type === 'like' ? 'Matched' : 'Rejected' }) }).then(() => { if (type === 'like') showToast('Match สำเร็จ!', 'success'); }).catch((err) => { showToast(friendlyApiError(err, 'อัปเดตสถานะไม่สำเร็จ'), 'error'); });
    setTimeout(() => { setApplicants(prev => prev.slice(1)); setSwipeDirection(null); }, 300);
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

  const submitEvaluation = () => {
    const scoreNum = Number(evalScore);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100 || evalScore === '') { showToast('กรุณาระบุคะแนนให้ถูกต้อง (0-100)', 'error'); return; }
    apiJson('/api/evaluate', { method: 'POST', body: JSON.stringify({ application_id: evalModal.appId, score: scoreNum, comment: evalComment }) }).then(() => {
      showToast('บันทึกการประเมินสำเร็จ สถานะเปลี่ยนเป็น Completed', 'success');
      setEvalModal({ show: false, appId: '', studentName: '' }); setEvalScore(''); setEvalComment('');
      apiJson('/api/hr-matches').then((data) => setMatchedList(data || [])).catch(() => {});
    }).catch((err) => showToast(friendlyApiError(err, 'บันทึกการประเมินไม่สำเร็จ'), 'error'));
  };

  return (
    <div className="relative w-full text-ink">
      {loadError && <div className="alert alert-danger mb-6" role="alert">{loadError}</div>}

      {/* ---------- Evaluation modal ---------- */}
      <AnimatePresence>
        {evalModal.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-overlay p-4 backdrop-blur-sm sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="eval-modal-title"
          >
            <motion.div
              initial={{ scale: 0.96, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 24 }}
              className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-2xl"
            >
              <h3 id="eval-modal-title" className="flex items-center gap-2 text-lg font-bold text-blue-600 dark:text-blue-400">
                <IconClipboard /> ประเมินผลการฝึกงาน
              </h3>
              <p className="mt-2 text-sm text-ink-muted">นักศึกษา: <strong className="text-ink">{evalModal.studentName}</strong></p>

              <div className="mt-6">
                <label htmlFor="eval-score" className="label">คะแนนประเมิน (0-100)</label>
                <input
                  id="eval-score"
                  type="number"
                  min="0"
                  max="100"
                  value={evalScore}
                  onChange={(e) => { let val = parseInt(e.target.value); if (val > 100) val = 100; if (val < 0) val = 0; setEvalScore(isNaN(val) ? '' : val.toString()); }}
                  placeholder="เช่น 85"
                  className="input text-center text-2xl font-bold"
                />
              </div>

              <div className="mt-5">
                <label htmlFor="eval-comment" className="label">ข้อเสนอแนะเพิ่มเติม (ไม่บังคับ)</label>
                <textarea id="eval-comment" value={evalComment} onChange={(e) => setEvalComment(e.target.value)} placeholder="จุดแข็ง จุดที่ควรพัฒนา..." className="textarea h-24" />
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => setEvalModal({ show: false, appId: '', studentName: '' })} className="btn btn-outline btn-block">ยกเลิก</button>
                <button type="button" onClick={submitEvaluation} className="btn btn-info btn-block">ยืนยันการประเมิน</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">

        {/* ---------- Dashboard ---------- */}
        {activeMenu === 'hr-home' && (
          <motion.div key="hr-home" variants={containerVariants} initial="hidden" animate="show" exit="hidden" className="w-full">
            <motion.div variants={itemVariants}>
              <PageHeading
                title="สวัสดี, ทีม HR 👋"
                subtitle={`ภาพรวมการประกาศรับสมัครงานและผู้สมัครของ ${profileData.companyName || 'บริษัทคุณ'}`}
              />
            </motion.div>

            <motion.div variants={containerVariants} className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
              <motion.button type="button" variants={itemVariants} onClick={() => setActiveMenu('4')} className="card card-interactive card-pad text-left">
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"><IconBriefcase /></span>
                <p className="text-2xl font-bold tracking-tight text-ink">{myPostedJobs.length} ประกาศ</p>
                <p className="stat-label">ไปที่ระบบสร้างประกาศงาน</p>
              </motion.button>

              <motion.button type="button" variants={itemVariants} onClick={() => setActiveMenu('5')} className="card card-interactive card-pad text-left">
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"><IconUsers /></span>
                <p className="stat-value text-amber-600 dark:text-amber-400">{applicantsLoading ? '—' : applicants.length}</p>
                <p className="stat-label">ผู้สมัครใหม่รอคัดกรอง</p>
              </motion.button>

              <motion.button type="button" variants={itemVariants} onClick={() => setActiveMenu('6')} className="card card-interactive card-pad text-left sm:col-span-2 xl:col-span-1">
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"><IconBadge /></span>
                <p className="stat-value text-emerald-600 dark:text-emerald-400">{matchesLoading ? '—' : matchedList.length}</p>
                <p className="stat-label">ผู้สมัครที่ Match แล้ว</p>
              </motion.button>
            </motion.div>
          </motion.div>
        )}

        {/* ---------- Company profile ---------- */}
        {activeMenu === '8' && (
          <motion.div key="menu8" variants={containerVariants} initial="hidden" animate="show" exit="hidden" className="mx-auto w-full max-w-3xl">
            <motion.div variants={itemVariants}>
              <PageHeading
                title="โปรไฟล์บริษัท"
                subtitle="ข้อมูลนี้จะแสดงให้นักศึกษาเห็นในประกาศรับสมัครงาน"
                eyebrow="HR Workspace"
                actions={<span className="badge badge-brand"><IconBuilding /> HR Workspace</span>}
              />
            </motion.div>

            <motion.div variants={itemVariants} className="panel p-5 sm:p-8">
              <div className="mb-8 flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
                <div className="group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface-2 sm:h-28 sm:w-28">
                  {logo
                    ? <img src={logo} alt="โลโก้บริษัท" className="h-full w-full object-cover" />
                    : <span className="text-ink-subtle"><IconBuilding /></span>}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-center text-xs font-semibold uppercase tracking-wide text-white opacity-0 transition group-hover:opacity-100">
                    อัปโหลด<br />โลโก้
                  </span>
                  <input type="file" onChange={handleLogoUpload} className="absolute inset-0 cursor-pointer opacity-0" accept="image/*" aria-label="อัปโหลดโลโก้บริษัท" />
                </div>

                <div className="min-w-0 text-center sm:text-left">
                  {profileLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-7 w-52" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  ) : (
                    <>
                      <h3 className="truncate text-xl font-bold text-ink sm:text-2xl">{profileData.companyName || 'ยังไม่ได้ตั้งชื่อบริษัท'}</h3>
                      <p className="mt-1 text-sm font-medium text-brand-600 dark:text-brand-400">{profileData.industry || 'ยังไม่ได้ระบุอุตสาหกรรม'}</p>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="company-name" className="label">ชื่อบริษัท</label>
                  <input id="company-name" type="text" value={profileData.companyName} onChange={(e) => setProfileData({ ...profileData, companyName: e.target.value })} className="input" />
                </div>
                <div>
                  <label htmlFor="company-industry" className="label">อุตสาหกรรม</label>
                  <input id="company-industry" type="text" value={profileData.industry} onChange={(e) => setProfileData({ ...profileData, industry: e.target.value })} className="input" />
                </div>
                <div>
                  <label htmlFor="company-location" className="label">ที่ตั้งบริษัท</label>
                  <input id="company-location" type="text" value={profileData.location} onChange={(e) => setProfileData({ ...profileData, location: e.target.value })} className="input" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="company-website" className="label">เว็บไซต์</label>
                  <input id="company-website" type="url" value={profileData.website} onChange={(e) => setProfileData({ ...profileData, website: e.target.value })} className="input" placeholder="https://example.com" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="company-culture" className="label">วัฒนธรรมองค์กร &amp; สวัสดิการ</label>
                  <textarea id="company-culture" value={profileData.culture} onChange={(e) => setProfileData({ ...profileData, culture: e.target.value })} className="textarea h-32" />
                </div>
              </div>

              <div className="divider mt-8 pt-6">
                <button type="button" onClick={handleSaveProfile} disabled={profileSaving || profileLoading} className="btn btn-neutral btn-lg btn-block">
                  {profileSaving && <Spinner />}
                  {profileSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลบริษัท'}
                </button>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="panel mt-6">
              <div className="panel-header">
                <h3 className="section-title flex items-center gap-2"><IconClipboard /> งานที่คุณประกาศไว้</h3>
                <span className="badge badge-neutral">{myPostedJobs.length} ประกาศ</span>
              </div>
              <div className="panel-body">
                {myPostedJobs.length === 0 ? (
                  <EmptyState title="ยังไม่มีประกาศงาน" description="สร้างประกาศงานแรกของคุณด้วยตัวช่วย AI" action={<button type="button" onClick={() => setActiveMenu('4')} className="btn btn-primary btn-sm">สร้างประกาศงาน</button>} />
                ) : (
                  myPostedJobs.map((job, idx) => (
                    <div key={idx} className="card-soft p-4 sm:p-5">
                      <h4 className="card-title text-brand-700 dark:text-brand-400">{job.title}</h4>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {job.skills && job.skills.map((s: any, i: number) => (
                          <span key={i} className="chip">{s.skill} · {WEIGHT_LABEL[s.weight] || s.weight}</span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ---------- Smart job posting ---------- */}
        {activeMenu === '4' && (
          <motion.div key="menu4" variants={containerVariants} initial="hidden" animate="show" exit="hidden" className="w-full">
            <motion.div variants={itemVariants}>
              <PageHeading
                title="ประกาศงานด้วย AI"
                subtitle="วาง Job Description แล้วให้ AI สกัดทักษะที่ต้องการ พร้อมกำหนดน้ำหนักความสำคัญ"
                eyebrow="AI Requirement Parser"
              />
            </motion.div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <motion.div variants={itemVariants} className="panel p-5 sm:p-6">
                <label htmlFor="jd-text" className="label">Job Description (JD)</label>
                <textarea id="jd-text" value={jd} onChange={(e) => setJd(e.target.value)} className="textarea h-40" />

                <button type="button" onClick={handleAnalyzeJD} disabled={isAnalyzing || !jd.trim()} className="btn btn-primary btn-lg btn-block mt-5">
                  {isAnalyzing ? <><Spinner /> กำลังสกัดทักษะด้วย AI...</> : <><IconSparkles /> วิเคราะห์ทักษะจาก JD</>}
                </button>

                <form onSubmit={handlePostJob} className="divider mt-8 space-y-5 pt-6">
                  <div>
                    <label htmlFor="job-title" className="label">ตำแหน่งงาน</label>
                    <input id="job-title" type="text" placeholder="เช่น Software Engineer (Intern)" value={newJob.title} onChange={(e) => setNewJob({ ...newJob, title: e.target.value })} className="input" required />
                  </div>
                  <div>
                    <label htmlFor="job-company" className="label">ชื่อบริษัท</label>
                    <input id="job-company" type="text" value={profileData.companyName} readOnly className="input input-readonly" aria-describedby="job-company-hint" />
                    <p id="job-company-hint" className="field-hint">แก้ไขชื่อบริษัทได้ที่หน้าโปรไฟล์บริษัท</p>
                  </div>
                  <button type="submit" disabled={!newJob.title || extractedSkills.length === 0} className="btn btn-neutral btn-lg btn-block">
                    โพสต์ประกาศงาน
                  </button>
                  {extractedSkills.length === 0 && (
                    <p className="field-hint text-center">ต้องวิเคราะห์ทักษะจาก JD ก่อนจึงจะโพสต์ได้</p>
                  )}
                </form>
              </motion.div>

              <motion.div variants={itemVariants} className="panel bg-surface-2/60 p-5 sm:p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="section-title">กำหนดน้ำหนักทักษะ</h3>
                  <span className="badge badge-neutral">{extractedSkills.length} ทักษะ</span>
                </div>

                {isAnalyzing && <SkeletonList count={3} rows={1} />}

                {!isAnalyzing && extractedSkills.length === 0 && (
                  <EmptyState title="ยังไม่มีทักษะที่สกัดได้" description="กดปุ่ม “วิเคราะห์ทักษะจาก JD” เพื่อให้ AI ช่วยสกัดทักษะที่ต้องการ" />
                )}

                {!isAnalyzing && extractedSkills.length > 0 && (
                  <div className="max-h-[28rem] space-y-4 overflow-y-auto pr-1">
                    {extractedSkills.map((s, i) => (
                      <motion.div key={i} variants={itemVariants} className="card card-pad">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                          <span className="card-title">{s.skill}</span>
                          <span className={`badge ${WEIGHT_BADGE[s.weight] || 'badge-neutral'}`}>{WEIGHT_LABEL[s.weight] || s.weight}</span>
                        </div>
                        <div
                          className="flex gap-1.5 rounded-xl border border-line bg-surface-2 p-1.5"
                          role="group"
                          aria-label={`ระดับความสำคัญของ ${s.skill}`}
                        >
                          {WEIGHT_LEVELS.map((level) => (
                            <button
                              type="button"
                              key={level}
                              onClick={() => handleWeightChange(i, level as any)}
                              aria-pressed={s.weight === level}
                              className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-brand-500 ${s.weight === level ? 'bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900' : 'text-ink-muted hover:bg-surface hover:text-ink'}`}
                            >
                              {WEIGHT_LABEL[level]}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ---------- Candidate screening ---------- */}
        {activeMenu === '5' && (
          <motion.div key="menu5" variants={containerVariants} initial="hidden" animate="show" exit="hidden" className="mx-auto flex w-full max-w-xl flex-col items-center">
            <motion.div variants={itemVariants} className="mb-8 text-center">
              <h2 className="page-title">คัดกรองผู้สมัคร</h2>
              <p className="page-subtitle">กดปุ่ม ✓ เพื่อรับเข้าทำงาน หรือ ✕ เพื่อปฏิเสธ</p>
            </motion.div>

            {applicantsLoading && <div className="w-full"><SkeletonList count={1} rows={5} /></div>}

            {!applicantsLoading && applicants.length > 0 && (
              <motion.div
                animate={{
                  x: swipeDirection === 'right' ? 280 : swipeDirection === 'left' ? -280 : 0,
                  rotate: swipeDirection === 'right' ? 10 : swipeDirection === 'left' ? -10 : 0,
                  opacity: swipeDirection ? 0 : 1,
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="relative w-full max-w-md rounded-3xl border border-line bg-surface p-5 shadow-lg sm:p-8"
              >
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md">
                  ความตรงกัน {applicants[0].match_percentage}%
                </span>

                <div className="mb-5 mt-4 text-center">
                  <h3 className="text-xl font-bold leading-snug text-ink sm:text-2xl">{applicants[0].name}</h3>
                  <p className="mt-2 text-sm text-ink-muted">
                    สมัครตำแหน่ง <span className="font-semibold text-brand-600 dark:text-brand-400">{applicants[0].job_title}</span>
                  </p>
                </div>

                <div className="card-soft mb-5 flex h-56 items-center justify-center p-3 sm:h-64">
                  {applicants[0].resume_url ? (
                    <img src={fileURL(applicants[0].resume_url)} alt={`เรซูเม่ของ ${applicants[0].name}`} className="max-h-full rounded-xl border border-line object-contain" />
                  ) : (
                    <p className="text-sm text-ink-muted">ผู้สมัครไม่ได้แนบไฟล์เรซูเม่</p>
                  )}
                </div>

                <div className="card-soft mb-6 p-4 sm:p-5">
                  <p className="eyebrow mb-3">ทักษะที่ AI สกัดได้จากผู้สมัคร</p>
                  <div className="flex flex-wrap gap-2">
                    {(applicants[0].skills || []).map((s, i) => (
                      <span key={i} className="chip">{s}</span>
                    ))}
                  </div>
                </div>

                <div className="flex justify-center gap-5 sm:gap-6">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => handleAction('pass', applicants[0].id)}
                    className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-surface text-2xl text-rose-500 shadow-md transition hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg dark:hover:bg-rose-500/10"
                    aria-label="ปฏิเสธผู้สมัคร"
                  >
                    ✕
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => handleAction('like', applicants[0].id)}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    aria-label="รับผู้สมัครเข้าทำงาน"
                  >
                    ✓
                  </motion.button>
                </div>
              </motion.div>
            )}

            {!applicantsLoading && applicants.length === 0 && (
              <motion.div variants={itemVariants} className="panel w-full p-8 sm:p-12">
                <EmptyState
                  icon={<IconUsers />}
                  title="ตรวจสอบใบสมัครครบทุกคนแล้ว"
                  description="ระบบจะแจ้งเตือนเมื่อมีผู้สมัครรายใหม่เข้ามา"
                />
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ---------- Mutual matches ---------- */}
        {activeMenu === '6' && (
          <motion.div key="menu6" variants={containerVariants} initial="hidden" animate="show" exit="hidden" className="w-full">
            <motion.div variants={itemVariants}>
              <PageHeading
                title="ผู้สมัครที่ Match แล้ว"
                subtitle="ติดต่อนักศึกษา ประสานอาจารย์นิเทศ และประเมินผลการฝึกงาน"
                actions={
                  <button type="button" onClick={() => showToast('เริ่มดาวน์โหลดไฟล์ CSV แล้ว', 'info')} className="btn btn-neutral btn-sm">
                    ส่งออก CSV
                  </button>
                }
              />
            </motion.div>

            {matchesLoading && <SkeletonList count={3} />}

            {!matchesLoading && matchedList.length === 0 && (
              <EmptyState title="ยังไม่มีผู้สมัครที่ Match" description="เมื่อคุณและนักศึกษาสนใจตรงกัน รายชื่อจะปรากฏที่นี่" />
            )}

            {!matchesLoading && (
              <motion.div variants={containerVariants} className="space-y-4">
                {matchedList.map((match, i) => (
                  <motion.div variants={itemVariants} key={match.id || i} className="card card-pad">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <h4 className="text-base font-bold text-ink sm:text-lg">{match.name}</h4>
                        <p className="mt-1 text-sm font-semibold text-brand-600 dark:text-brand-400">{match.job_title}</p>
                        <span className={`badge mt-3 ${match.status === 'Completed' ? 'badge-info' : match.status === 'Canceled' ? 'badge-neutral' : 'badge-success'}`}>
                          {match.status === 'Completed' ? 'ประเมินผลแล้ว' : match.status === 'Canceled' ? 'สละสิทธิ์แล้ว' : `Match ${match.match_percentage}%`}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        {match.status === 'Matched' && (
                          <button type="button" onClick={() => { setEvalScore(''); setEvalComment(''); setEvalModal({ show: true, appId: match.id, studentName: match.name }); }} className="btn btn-info btn-sm">
                            <IconClipboard /> ประเมินผลงาน
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveChatId(activeChatId === match.id ? null : match.id)}
                          aria-expanded={activeChatId === match.id}
                          className={`btn btn-sm ${activeChatId === match.id ? 'btn-neutral' : 'btn-success-soft'}`}
                        >
                          <IconChat /> นักศึกษา
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveChatId(activeChatId === `${match.id}-TH` ? null : `${match.id}-TH`)}
                          aria-expanded={activeChatId === `${match.id}-TH`}
                          className={`btn btn-sm ${activeChatId === `${match.id}-TH` ? 'btn-neutral' : 'btn-outline'}`}
                        >
                          <IconChat /> อาจารย์
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {activeChatId && (activeChatId === match.id || activeChatId === `${match.id}-TH`) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0, marginTop: 0 }}
                          animate={{ height: 'auto', opacity: 1, marginTop: 20 }}
                          exit={{ height: 0, opacity: 0, marginTop: 0 }}
                          className="overflow-hidden rounded-2xl border border-line"
                        >
                          <div className="border-b border-line bg-surface-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                            กำลังสนทนากับ: {activeChatId === match.id ? match.name : 'อาจารย์ที่ปรึกษา'}
                          </div>
                          <div className="chat-window h-56">
                            {chatMessages.length === 0
                              ? <p className="my-auto text-center text-sm text-ink-muted">เริ่มพิมพ์ข้อความตอบกลับ...</p>
                              : chatMessages.map((m) => (
                                <div key={m.id} className={`bubble ${m.sender === 'company' ? 'bubble-me' : 'bubble-them'}`}>
                                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-70">{m.sender}</p>
                                  <p>{m.text}</p>
                                  <span className="mt-1.5 block text-right text-[11px] opacity-60">{m.created_at}</span>
                                </div>
                              ))}
                          </div>
                          <form onSubmit={handleSendChat} className="flex gap-2 border-t border-line bg-surface p-3">
                            <label htmlFor={`hr-chat-${match.id}`} className="sr-only">ข้อความ</label>
                            <input id={`hr-chat-${match.id}`} type="text" placeholder="พิมพ์ข้อความตอบกลับ..." value={typedMessage} onChange={(e) => setTypedMessage(e.target.value)} className="input py-2.5" />
                            <button type="submit" disabled={!typedMessage.trim()} className="btn btn-neutral btn-sm shrink-0">ส่ง</button>
                          </form>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

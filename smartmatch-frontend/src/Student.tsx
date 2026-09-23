import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Skill, JobMatch, Application } from './types';
import { apiFetch, apiJson, friendlyApiError } from './apiClient';
import StudentPetitions from './StudentPetitions';
import { EmptyState, PageHeading, Skeleton, SkeletonList, Spinner } from './ui';

interface Message { id: number; application_id: string; sender: string; text: string; created_at: string; }

const IconSparkles = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>;
const IconChat = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.436 3 11.996c0 2.29.932 4.35 2.44 5.86l-1.92 2.91a.75.75 0 00.91 1.09l3.22-1.39a9.123 9.123 0 004.35 1.034z" /></svg>;
const IconAlert = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
const IconUserCircle = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-10 w-10"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>;

const CHAT_POLL_MS = 10000;

const jobKey = (job: { job_title: string; company: string }) => `${job.job_title}@@${job.company}`;

const containerVariants: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants: Variants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 110, damping: 16 } } };

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

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  Pending: { cls: 'badge-warning', label: 'รอพิจารณา' },
  Rejected: { cls: 'badge-danger', label: 'ไม่ผ่านการพิจารณา' },
  Canceled: { cls: 'badge-neutral', label: 'สละสิทธิ์แล้ว' },
  Completed: { cls: 'badge-info', label: 'ประเมินผลแล้ว' },
  Matched: { cls: 'badge-success', label: 'ตอบรับแล้ว (Matched)' },
};

export default function Student({ activeMenu, setActiveMenu, showToast }: { activeMenu: string, setActiveMenu: (m: string) => void, showToast: (msg: string, type: 'success'|'error'|'info') => void }) {
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
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
  const [appsLoading, setAppsLoading] = useState(true);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  // Jobs the student swiped away stay hidden for the whole session, so they do
  // not reappear when the menu is switched and the matches are refetched.
  const passedJobsRef = useRef<Set<string>>(new Set());
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  // One draft per application, so several open chat rooms never share text.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [aiContent, setAiContent] = useState<{ [key: string]: { type: string, data: string } }>({});
  const [aiLoading, setAiLoading] = useState(false);

  const [petitionPrefill, setPetitionPrefill] = useState<{ type: string; applicationId: string } | null>(null);
  const [loadError, setLoadError] = useState('');

  // Waivers are filed as petitions, so the dashboard hands off to the petition
  // form with the placement already selected.
  const requestWaiver = (applicationId: string) => {
    setPetitionPrefill({ type: 'waiver', applicationId });
    setActiveMenu('petitions');
  };

  const fetchApplications = () => {
    apiJson('/api/my-applications')
      .then((data) => { setMyApps(Array.isArray(data) ? data : []); setLoadError(''); })
      .catch((err) => { setLoadError(friendlyApiError(err, 'โหลดใบสมัครไม่สำเร็จ')); })
      .finally(() => setAppsLoading(false));
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

  // Drops jobs already applied to and jobs swiped away in this session, then
  // orders the deck by match quality.
  const buildJobDeck = (jobs: JobMatch[]) => {
    const appliedTitles = myApps.map(a => a.job_title);
    return jobs
      .filter((job) => !appliedTitles.includes(job.job_title) && !passedJobsRef.current.has(jobKey(job)))
      .sort((a, b) => b.match_percentage - a.match_percentage);
  };

  useEffect(() => {
    if (activeMenu === '2' && skills.length > 0) {
      apiJson('/api/match-jobs', {
        method: 'POST',
        body: JSON.stringify({ skills }),
      }).then((matchData) => {
        if (Array.isArray(matchData)) {
          setMatchedJobs(buildJobDeck(matchData));
        }
      }).catch((err) => { setLoadError(friendlyApiError(err, 'ค้นหางานที่เหมาะกับคุณไม่สำเร็จ')); });
    }
  }, [activeMenu, skills, myApps]);

  useEffect(() => {
    if (!activeChatId) return;
    const fetchChat = () => apiJson(`/api/chat/messages?application_id=${encodeURIComponent(activeChatId)}`).then((data) => setChatMessages(data || [])).catch((err) => { setLoadError(friendlyApiError(err, 'โหลดข้อความแชทไม่สำเร็จ')); });
    fetchChat(); const interval = setInterval(fetchChat, CHAT_POLL_MS); return () => clearInterval(interval);
  }, [activeChatId]);

  // The preview URL is derived from the selected file, so it survives every
  // other state change and is revoked only when the file is replaced.
  useEffect(() => {
    if (!avatarFile) return;
    const objectUrl = URL.createObjectURL(avatarFile);
    setAvatar(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarFile]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const picked = e.target.files?.[0]; if (picked) setAvatarFile(picked); };

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
        setMatchedJobs(buildJobDeck(matchData));
      }
      showToast('AI ค้นหางานที่เหมาะสมเสร็จสมบูรณ์!', 'success');
    } catch (e) { console.error(e); showToast(friendlyApiError(e, 'มีปัญหาตอนโหลดรายชื่องาน'), 'error'); } finally { setLoading(false); }
  };

  const handleSwipe = (type: 'apply' | 'pass', job: JobMatch) => {
    setSwipeDirection(type === 'apply' ? 'right' : 'left');
    if (type === 'pass') {
      passedJobsRef.current.add(jobKey(job));
    }
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

  const draftOf = (appId: string) => drafts[appId] || '';
  const setDraft = (appId: string, text: string) => setDrafts((current) => ({ ...current, [appId]: text }));

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const threadId = activeChatId;
    if (!threadId) return;
    const text = draftOf(threadId).trim();
    if (!text) return;
    try {
      await apiJson('/api/chat/send', { method: 'POST', body: JSON.stringify({ application_id: threadId, text }) });
      setDraft(threadId, '');
    } catch (err) {
      showToast(friendlyApiError(err, 'ส่งข้อความไม่สำเร็จ'), 'error');
    }
  };

  const generateAI = async (type: 'email' | 'interview', app: Application) => {
    setAiLoading(true);
    setAiContent((current) => ({ ...current, [app.id]: { type, data: 'กำลังวิเคราะห์และประมวลผลด้วย AI...' } }));
    const endpoint = type === 'email' ? 'generate-email' : 'generate-questions';
    const body = type === 'email'
      ? { name: app.name, job_title: app.job_title, company: app.company, skills: skills.map(s => s.name) }
      : { job_title: app.job_title };
    try {
      const data = await apiJson(`/api/${endpoint}`, { method: 'POST', body: JSON.stringify(body) });
      setAiContent((current) => ({ ...current, [app.id]: { type, data: type === 'email' ? data.email : data.questions } }));
      showToast('ประมวลผลเสร็จสมบูรณ์!', 'success');
    } catch (e) {
      setAiContent((current) => {
        const next = { ...current };
        delete next[app.id];
        return next;
      });
      showToast(friendlyApiError(e, 'การประมวลผลล้มเหลว'), 'error');
    } finally { setAiLoading(false); }
  };

  const pendingAppsCount = myApps.filter(a => a.status === 'Pending').length;
  const matchedAppsCount = myApps.filter(a => a.status === 'Matched').length;

  const profileField = (
    label: string,
    key: keyof typeof emptyStudentProfile,
    type: string = 'text',
    wide = false,
  ) => (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <label htmlFor={`profile-${key}`} className="label">{label}</label>
      <input
        id={`profile-${key}`}
        type={type}
        value={profileData[key]}
        onChange={(e) => setProfileData({ ...profileData, [key]: e.target.value })}
        className="input"
      />
    </div>
  );

  return (
    <div className="relative w-full text-ink">
      {loadError && (
        <div className="alert alert-danger mb-6" role="alert">{loadError}</div>
      )}

      <AnimatePresence mode="wait">

        {activeMenu === 'petitions' && (
          <motion.div key="petitions" variants={containerVariants} initial="hidden" animate="show" exit="hidden">
            <StudentPetitions
              showToast={showToast}
              prefill={petitionPrefill}
              onPrefillConsumed={() => setPetitionPrefill(null)}
            />
          </motion.div>
        )}

        {/* ---------- Dashboard ---------- */}
        {activeMenu === 'student-home' && (
          <motion.div key="student-home" variants={containerVariants} initial="hidden" animate="show" exit="hidden" className="w-full">
            <motion.div variants={itemVariants}>
              <PageHeading
                title={`สวัสดี, ${profileData.nickname || profileData.firstName || 'นักศึกษา'} 👋`}
                subtitle="ภาพรวมการหาสถานที่ฝึกงานและบันทึกสหกิจศึกษาของคุณ"
              />
            </motion.div>

            <motion.div variants={containerVariants} className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
              <motion.button
                type="button"
                variants={itemVariants}
                onClick={() => setActiveMenu('3')}
                className="card card-interactive card-pad text-left"
              >
                <p className="stat-value text-amber-600 dark:text-amber-400">{appsLoading ? '—' : pendingAppsCount}</p>
                <p className="stat-label">ใบสมัครที่รอพิจารณา</p>
              </motion.button>

              <motion.button
                type="button"
                variants={itemVariants}
                onClick={() => setActiveMenu('3')}
                className="card card-interactive card-pad text-left"
              >
                <p className="stat-value text-emerald-600 dark:text-emerald-400">{appsLoading ? '—' : matchedAppsCount}</p>
                <p className="stat-label">บริษัทที่ตอบรับคุณ</p>
              </motion.button>
            </motion.div>

            <motion.h3 variants={itemVariants} className="eyebrow mb-4">ทางลัดที่ใช้บ่อย</motion.h3>
            <motion.div variants={containerVariants} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <motion.button
                type="button"
                variants={itemVariants}
                onClick={() => setActiveMenu('1')}
                className="flex items-center justify-between gap-4 rounded-2xl bg-brand-600 p-5 text-left text-white shadow-md shadow-brand-600/25 transition hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:scale-[0.99] sm:p-6"
              >
                <span>
                  <span className="block text-base font-semibold sm:text-lg">อัปเดตเรซูเม่ &amp; ทักษะ</span>
                  <span className="mt-1 block text-sm text-brand-100">ให้ AI สกัดทักษะใหม่ล่าสุดของคุณ</span>
                </span>
                <IconSparkles />
              </motion.button>

              <motion.button
                type="button"
                variants={itemVariants}
                onClick={() => setActiveMenu('2')}
                className="flex items-center justify-between gap-4 rounded-2xl bg-zinc-900 p-5 text-left text-white shadow-md transition hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:scale-[0.99] dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 sm:p-6"
              >
                <span>
                  <span className="block text-base font-semibold sm:text-lg">ค้นหาที่ฝึกงานใหม่</span>
                  <span className="mt-1 block text-sm text-zinc-300 dark:text-zinc-600">ปัดขวาเพื่อเลือกบริษัทที่ตรงใจคุณ</span>
                </span>
              </motion.button>
            </motion.div>
          </motion.div>
        )}

        {/* ---------- My profile ---------- */}
        {activeMenu === '0' && (
          <motion.div key="menu0" variants={containerVariants} initial="hidden" animate="show" exit="hidden" className="mx-auto w-full max-w-3xl">
            <motion.div variants={itemVariants}>
              <PageHeading title="โปรไฟล์ของฉัน" subtitle="ข้อมูลนี้จะถูกส่งให้บริษัทเมื่อคุณสมัครงาน" eyebrow="Student Module" />
            </motion.div>

            {internship && (
              <motion.div variants={itemVariants} className="alert alert-success mb-6 flex-col items-start">
                <p className="eyebrow text-emerald-700 dark:text-emerald-300">สถานะการฝึกงาน</p>
                <p className="text-sm font-semibold">{internship.job_title} @ {internship.company}</p>
                <p className="text-xs opacity-80">{internship.status}</p>
              </motion.div>
            )}

            <motion.div variants={itemVariants} className="panel p-5 sm:p-8">
              <div className="mb-8 flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
                <div className="group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-2 sm:h-28 sm:w-28">
                  {avatar
                    ? <img src={avatar} alt="รูปโปรไฟล์" className="h-full w-full object-cover" />
                    : <span className="text-ink-subtle"><IconUserCircle /></span>}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-xs font-semibold uppercase tracking-wide text-white opacity-0 transition group-hover:opacity-100">
                    เปลี่ยนรูป
                  </span>
                  <input type="file" onChange={handleAvatarUpload} className="absolute inset-0 cursor-pointer opacity-0" accept="image/*" aria-label="อัปโหลดรูปโปรไฟล์" />
                </div>

                <div className="min-w-0 text-center sm:text-left">
                  {profileLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  ) : (
                    <>
                      <h3 className="truncate text-lg font-bold text-ink sm:text-xl">
                        {[profileData.firstName, profileData.lastName].filter(Boolean).join(' ') || 'ยังไม่ได้กรอกชื่อ'}
                        {profileData.nickname && <span className="text-ink-muted"> ({profileData.nickname})</span>}
                      </h3>
                      <p className="mt-1 text-sm font-medium text-brand-600 dark:text-brand-400">
                        {[profileData.major, profileData.university].filter(Boolean).join(' · ') || 'ยังไม่ได้ระบุสาขา / สถาบัน'}
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {profileField('ชื่อจริง', 'firstName')}
                {profileField('นามสกุล', 'lastName')}
                {profileField('ชื่อเล่น', 'nickname')}
                {profileField('วันเกิด', 'dob', 'date')}
                {profileField('เบอร์โทรศัพท์', 'phone', 'tel')}
                {profileField('GitHub / Portfolio', 'github', 'url')}
                {profileField('สถาบันการศึกษา', 'university')}
                {profileField('สาขาวิชา', 'major')}
                {profileField('อีเมล', 'email', 'email', true)}
              </div>

              <div className="divider mt-8 pt-6">
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={profileSaving || profileLoading}
                  className="btn btn-neutral btn-lg btn-block"
                >
                  {profileSaving && <Spinner />}
                  {profileSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ---------- AI skill extraction ---------- */}
        {activeMenu === '1' && (
          <motion.div key="menu1" variants={containerVariants} initial="hidden" animate="show" exit="hidden" className="w-full">
            <motion.div variants={itemVariants}>
              <PageHeading
                title="สกัดทักษะด้วย AI"
                subtitle="อัปโหลดเรซูเม่ แล้ว AI จะสกัดทักษะพร้อมจัดเกรดให้อัตโนมัติ"
                eyebrow="AI Skill Extractor"
                actions={<span className="badge badge-success">ระบบพร้อมใช้งาน</span>}
              />
            </motion.div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <motion.div variants={itemVariants} className="panel p-5 sm:p-6 lg:col-span-1">
                <h3 className="section-title mb-5">ข้อมูลตั้งต้น</h3>

                <div className="mb-5">
                  <label htmlFor="resume-file" className="label">ไฟล์เรซูเม่</label>
                  <div className="rounded-2xl border border-dashed border-brand-300 bg-brand-50/60 p-4 transition hover:bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/5 dark:hover:bg-brand-500/10">
                    <input id="resume-file" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="file-input" />
                    <p className="field-hint">{file ? `เลือกแล้ว: ${file.name}` : 'รองรับไฟล์รูปภาพหรือ PDF ของเรซูเม่'}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <label htmlFor="experience-text" className="label">ประสบการณ์เพิ่มเติม (ไม่บังคับ)</label>
                  <textarea
                    id="experience-text"
                    value={expText}
                    onChange={(e) => setExpText(e.target.value)}
                    placeholder="เล่าโปรเจกต์หรือผลงานที่โดดเด่น..."
                    className="textarea h-32"
                  />
                  <p className="field-hint">ระบุงานจริง เช่น งาน freelance หรือระบบที่ขึ้น production เพื่อโอกาสได้เกรด S</p>
                </div>

                <button type="button" onClick={handleUpload} disabled={loading} className="btn btn-primary btn-lg btn-block">
                  {loading ? <><Spinner /> กำลังประมวลผลด้วย AI...</> : <><IconSparkles /> วิเคราะห์ทักษะ</>}
                </button>
              </motion.div>

              <motion.div variants={itemVariants} className="panel bg-surface-2/60 p-5 sm:p-6 lg:col-span-2">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="section-title">ผลการวิเคราะห์ของ AI</h3>
                  <span className="badge badge-neutral">พบ {skills.length} ทักษะ</span>
                </div>

                {loading && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <SkeletonList count={2} rows={2} />
                    <SkeletonList count={2} rows={2} />
                  </div>
                )}

                {!loading && skills.length === 0 && (
                  <EmptyState
                    title="ยังไม่มีผลการวิเคราะห์"
                    description="อัปโหลดเรซูเม่หรือกรอกประสบการณ์ แล้วกดปุ่มวิเคราะห์ทักษะเพื่อเริ่มต้น"
                  />
                )}

                {!loading && skills.length > 0 && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {skills.map((s, i) => {
                      const isTop = String(s.grade).toUpperCase() === 'S';
                      return (
                        <motion.div
                          key={i}
                          variants={itemVariants}
                          className={`flex flex-col rounded-2xl border p-4 shadow-sm transition hover:shadow-md sm:p-5 ${isTop ? 'border-amber-300 bg-amber-50 dark:border-amber-400/40 dark:bg-amber-500/10' : 'border-line bg-surface'}`}
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <h4 className="card-title">{s.name}</h4>
                            <span className={`badge ${isTop ? 'badge-warning' : 'badge-neutral'} shrink-0`}>เกรด {s.grade}</span>
                          </div>
                          <span className="badge badge-brand self-start">{s.type || 'Hard Skill'}</span>
                          <div className="divider mt-4 pt-3">
                            <p className="eyebrow">แหล่งข้อมูล</p>
                            <p className="mt-1 text-sm text-ink-muted">{s.source || 'ข้อมูลจากเรซูเม่'}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ---------- Job discovery ---------- */}
        {activeMenu === '2' && (
          <motion.div key="menu2" variants={containerVariants} initial="hidden" animate="show" exit="hidden" className="mx-auto flex w-full max-w-xl flex-col items-center">
            <motion.div variants={itemVariants} className="mb-8 text-center">
              <h2 className="page-title">ค้นหาที่ฝึกงาน</h2>
              <p className="page-subtitle">กดปุ่ม ✓ เพื่อสมัคร หรือ ✕ เพื่อข้ามตำแหน่งนี้</p>
            </motion.div>

            {matchedJobs.length === 0 ? (
              <motion.div variants={itemVariants} className="panel w-full p-8 sm:p-12">
                <EmptyState
                  icon={<IconSparkles />}
                  title="ไม่มีตำแหน่งงานที่รอพิจารณา"
                  description="คุณได้พิจารณางานทั้งหมดแล้ว หรือลองให้ AI สกัดทักษะใหม่อีกครั้ง"
                  action={<button type="button" onClick={() => setActiveMenu('1')} className="btn btn-brand-soft btn-sm">ไปหน้าสกัดทักษะ</button>}
                />
              </motion.div>
            ) : (
              <motion.div
                animate={{
                  x: swipeDirection === 'right' ? 280 : swipeDirection === 'left' ? -280 : 0,
                  rotate: swipeDirection === 'right' ? 10 : swipeDirection === 'left' ? -10 : 0,
                  opacity: swipeDirection ? 0 : 1,
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="relative w-full max-w-md rounded-3xl border border-line bg-surface p-5 shadow-lg sm:p-8"
              >
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md">
                  ความตรงกัน {matchedJobs[0].match_percentage}%
                </span>

                <div className="mb-6 mt-4 text-center">
                  <h3 className="text-xl font-bold leading-snug text-ink sm:text-2xl">{matchedJobs[0].job_title}</h3>
                  <p className="mt-2 text-sm font-semibold text-brand-600 dark:text-brand-400">{matchedJobs[0].company}</p>
                </div>

                <div className="card-soft mb-5 p-4 text-center sm:p-5">
                  <p className="eyebrow mb-3">ทักษะที่ตรงกับความต้องการ</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {(matchedJobs[0].matched_skills || []).map((s, i) => (
                      <span key={i} className="chip">✓ {s}</span>
                    ))}
                  </div>
                </div>

                {/* Jobs whose critical skills are unmet are filtered out server-side,
                    so anything shown here already clears the hard requirements. */}
                {(matchedJobs[0].critical_skills || []).length > 0 && (
                  <p className="mb-5 flex flex-wrap items-center justify-center gap-2 text-xs text-ink-muted">
                    <span className="badge badge-success">ผ่านทักษะบังคับ</span>
                    {(matchedJobs[0].critical_skills || []).join(', ')}
                  </p>
                )}

                {(matchedJobs[0].missing_skills || []).length > 0 && (
                  <div className="alert alert-warning mb-6 flex-col items-start">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide"><IconAlert /> AI Skill Gap Analysis</p>
                    <p className="text-sm">
                      คุณควรพิจารณาศึกษา <strong>{matchedJobs[0].missing_skills[0]}</strong> เพิ่มเติม
                      เนื่องจากเป็นทักษะสำคัญที่ตำแหน่งนี้ต้องการ
                    </p>
                  </div>
                )}

                <div className="flex justify-center gap-5 sm:gap-6">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => handleSwipe('pass', matchedJobs[0])}
                    className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-surface text-2xl text-rose-500 shadow-md transition hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg dark:hover:bg-rose-500/10"
                    aria-label="ข้ามตำแหน่งนี้"
                  >
                    ✕
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => handleSwipe('apply', matchedJobs[0])}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-2xl text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    aria-label="สมัครตำแหน่งนี้"
                  >
                    ✓
                  </motion.button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ---------- Application history ---------- */}
        {activeMenu === '3' && (
          <motion.div key="menu3" variants={containerVariants} initial="hidden" animate="show" exit="hidden" className="w-full">
            <motion.div variants={itemVariants}>
              <PageHeading title="ประวัติการสมัครงาน" subtitle="ติดตามสถานะใบสมัครและติดต่อบริษัทที่ตอบรับคุณ" />
            </motion.div>

            {appsLoading && <SkeletonList count={3} />}

            {!appsLoading && myApps.length === 0 && (
              <EmptyState
                title="ยังไม่มีประวัติการสมัครงาน"
                description="เริ่มค้นหาตำแหน่งที่เหมาะกับทักษะของคุณได้เลย"
                action={<button type="button" onClick={() => setActiveMenu('2')} className="btn btn-primary btn-sm">ไปหน้าค้นหาที่ฝึกงาน</button>}
              />
            )}

            {!appsLoading && (
              <motion.div variants={containerVariants} className="space-y-4">
                {myApps.map((app, idx) => {
                  const badge = STATUS_BADGE[app.status] || { cls: 'badge-neutral', label: app.status };
                  return (
                    <motion.div variants={itemVariants} key={app.id || idx} className="card card-pad">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-ink sm:text-lg">{app.job_title}</h3>
                          <p className="mt-1 text-sm text-ink-muted">{app.company}</p>
                          <span className={`badge ${badge.cls} mt-3`}>{badge.label}</span>
                        </div>

                        {app.status === 'Matched' && (
                          <div className="flex flex-wrap gap-2 lg:justify-end">
                            <button
                              type="button"
                              onClick={() => setActiveChatId(activeChatId === app.id ? null : app.id)}
                              className="btn btn-neutral btn-sm"
                              aria-expanded={activeChatId === app.id}
                            >
                              <IconChat /> คุยกับบริษัท
                            </button>
                            <button type="button" onClick={() => generateAI('email', app)} disabled={aiLoading} className="btn btn-brand-soft btn-sm">
                              <IconSparkles /> ร่างอีเมล
                            </button>
                            <button type="button" onClick={() => generateAI('interview', app)} disabled={aiLoading} className="btn btn-brand-soft btn-sm">
                              <IconSparkles /> คลังคำถามสัมภาษณ์ AI
                            </button>
                            <button
                              type="button"
                              onClick={() => requestWaiver(app.id)}
                              className="btn btn-danger-soft btn-sm"
                            >
                              สละสิทธิ์
                            </button>
                          </div>
                        )}
                      </div>

                      <AnimatePresence>
                        {activeChatId === app.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0, marginTop: 0 }}
                            animate={{ height: 'auto', opacity: 1, marginTop: 20 }}
                            exit={{ height: 0, opacity: 0, marginTop: 0 }}
                            className="overflow-hidden rounded-2xl border border-line"
                          >
                            <div className="border-b border-line bg-surface-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                              สนทนากับ: HR {app.company}
                            </div>
                            <div className="chat-window h-56">
                              {chatMessages.length === 0
                                ? <p className="my-auto text-center text-sm text-ink-muted">เริ่มพิมพ์ข้อความเพื่อสนทนา...</p>
                                : chatMessages.map((m) => (
                                  <div key={m.id} className={`bubble ${m.sender === 'student' ? 'bubble-me' : 'bubble-them'}`}>
                                    <p>{m.text}</p>
                                  </div>
                                ))}
                            </div>
                            <form onSubmit={handleSendChat} className="flex gap-2 border-t border-line bg-surface p-3">
                              <label htmlFor={`chat-${app.id}`} className="sr-only">ข้อความ</label>
                              <input id={`chat-${app.id}`} type="text" value={draftOf(app.id)} onChange={(e) => setDraft(app.id, e.target.value)} placeholder="พิมพ์ข้อความ..." className="input py-2.5" />
                              <button type="submit" disabled={!draftOf(app.id).trim()} className="btn btn-neutral btn-sm shrink-0">ส่ง</button>
                            </form>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <AnimatePresence>
                        {aiContent[app.id] && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-5 rounded-2xl border border-brand-200 bg-brand-50/60 p-4 sm:p-5 dark:border-brand-500/25 dark:bg-brand-500/5"
                          >
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                              <h4 className="card-title text-brand-700 dark:text-brand-300">
                                {aiContent[app.id].type === 'email' ? 'ฉบับร่างอีเมลสมัครงาน' : 'คลังคำถามจำลองสัมภาษณ์'}
                              </h4>
                              {aiContent[app.id].type === 'email' && !aiLoading && (
                                <button
                                  type="button"
                                  onClick={() => { navigator.clipboard.writeText(aiContent[app.id].data); showToast('คัดลอกลงคลิปบอร์ดแล้ว!', 'info'); }}
                                  className="btn btn-outline btn-xs"
                                >
                                  คัดลอก
                                </button>
                              )}
                            </div>
                            <div className="rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-ink sm:p-5">
                              {aiLoading
                                ? <span className="flex items-center gap-2 text-ink-muted"><Spinner /> กำลังวิเคราะห์และประมวลผลด้วย AI...</span>
                                : <p className="whitespace-pre-line">{aiContent[app.id].data}</p>}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

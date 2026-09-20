import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Student from './Student';
import Company from './Company';
import Teacher from './Teacher';
import { apiJson, clearAuthSession } from './apiClient';

export type ToastType = { msg: string; type: 'success' | 'error' | 'info' } | null;

const IconMoon = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>;
const IconSun = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>;
const IconBell = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>;
const IconBrain = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" /></svg>;
const IconSparkles = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>;

function Dashboard({ initialRole }: { initialRole: 'student' | 'company' | 'teacher' }) {
  const navigate = useNavigate();
  const mappedRole = initialRole === 'company' ? 'hr' : initialRole;
  const [role, setRole] = useState<'student' | 'hr' | 'teacher'>(mappedRole);
  const [activeMenu, setActiveMenu] = useState<string>(
    mappedRole === 'student' ? 'student-home' : mappedRole === 'hr' ? 'hr-home' : 'teacher-home'
  );
  const [isDark, setIsDark] = useState(false);
  const [toast, setToast] = useState<ToastType>(null);
  const [showNotif, setShowNotif] = useState(false);
  const [studentHeader, setStudentHeader] = useState({ name: 'นักศึกษา', major: '' });

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) { document.documentElement.classList.add('dark'); setIsDark(true); }
  }, []);

  useEffect(() => {
    setRole(mappedRole);
    if (mappedRole === 'student') setActiveMenu('student-home');
    if (mappedRole === 'hr') setActiveMenu('hr-home');
    if (mappedRole === 'teacher') setActiveMenu('teacher-home');
  }, [mappedRole]);

  useEffect(() => {
    if (role !== 'student') return;
    apiJson('/api/student/profile')
      .then((data) => {
        const display = data.nickname
          ? `${data.first_name || 'นักศึกษา'} (${data.nickname})`
          : (data.first_name || 'นักศึกษา');
        setStudentHeader({ name: display, major: data.major || '' });
      })
      .catch(() => {
        setStudentHeader({ name: 'นักศึกษา', major: '' });
      });
  }, [role, activeMenu]);

  const toggleTheme = () => {
    if (isDark) { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); setIsDark(false); } 
    else { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); setIsDark(true); }
  };

  const handleLogout = () => {
    clearAuthSession();
    navigate('/login');
  };

  const getStudentName = () => studentHeader.name;

  return (
    <div className="flex min-h-screen bg-[#f8fafc] dark:bg-[#09090b] transition-colors duration-500 font-sans relative">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 50, scale: 0.9 }} className={`fixed bottom-10 left-1/2 -translate-x-1/2 px-6 py-3.5 rounded-full text-white shadow-2xl z-[100] flex items-center gap-3 font-semibold text-sm backdrop-blur-md border border-white/20 ${toast.type === 'success' ? 'bg-emerald-600/90' : toast.type === 'error' ? 'bg-rose-600/90' : 'bg-indigo-600/90'}`}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <aside className="flex-col hidden w-64 bg-white dark:bg-[#161616] border-r border-slate-200 dark:border-white/5 md:flex transition-colors duration-500">
        <div className="flex items-center h-20 px-6 border-b border-slate-100 dark:border-white/5">
          <h1 className="text-xl font-black text-[#4f46e5] dark:text-indigo-400 flex items-center gap-2 m-0"><IconBrain /> AI-InternMatch</h1>
        </div>
        
        <div className="flex-1 p-4 overflow-y-auto">
          {role === 'student' && (
            <>
              <div className="text-[10px] font-black text-slate-400 dark:text-zinc-500 mb-3 tracking-widest uppercase">Student Module</div>
              <button onClick={() => setActiveMenu('student-home')} className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm mb-2 transition flex items-center gap-3 ${activeMenu === 'student-home' ? 'bg-[#4f46e5] text-white shadow-md' : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>Dashboard</button>
              <button onClick={() => setActiveMenu('1')} className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm mb-2 transition flex items-center gap-3 ${activeMenu === '1' ? 'bg-[#4f46e5] text-white shadow-md' : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>Skill Extraction</button>
              <button onClick={() => setActiveMenu('2')} className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm mb-2 transition flex items-center gap-3 ${activeMenu === '2' ? 'bg-[#4f46e5] text-white shadow-md' : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>Job Discovery</button>
              <button onClick={() => navigate('/student/logbook')} className="w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition flex items-center gap-3 text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/5">Digital Logbook</button>
            </>
          )}
          {role === 'hr' && (
            <>
              <div className="text-[10px] font-black text-slate-400 dark:text-zinc-500 mb-3 tracking-widest uppercase">Company Module</div>
              <button onClick={() => setActiveMenu('hr-home')} className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm mb-2 transition flex items-center gap-3 ${activeMenu === 'hr-home' ? 'bg-[#4f46e5] text-white shadow-md' : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>Dashboard</button>
              <button onClick={() => setActiveMenu('4')} className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm mb-2 transition flex items-center gap-3 ${activeMenu === '4' ? 'bg-[#4f46e5] text-white shadow-md' : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>Smart Posting</button>
              <button onClick={() => setActiveMenu('5')} className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm mb-2 transition flex items-center gap-3 ${activeMenu === '5' ? 'bg-[#4f46e5] text-white shadow-md' : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>Candidate Screening</button>
              <button onClick={() => setActiveMenu('6')} className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition flex items-center gap-3 ${activeMenu === '6' ? 'bg-[#4f46e5] text-white shadow-md' : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>Mutual Matches</button>
            </>
          )}
          {role === 'teacher' && (
            <>
              <div className="text-[10px] font-black text-slate-400 dark:text-zinc-500 mb-3 tracking-widest uppercase">Teacher Module</div>
              <button onClick={() => setActiveMenu('teacher-home')} className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm mb-2 transition flex items-center gap-3 ${activeMenu === 'teacher-home' || activeMenu === '7' ? 'bg-[#4f46e5] text-white shadow-md' : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>Monitoring</button>
            </>
          )}
        </div>
        <div className="p-4 border-t border-slate-100 dark:border-white/5">
          <button onClick={handleLogout} className="w-full py-2.5 bg-slate-100 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 text-slate-600 dark:text-zinc-400 rounded-lg text-sm font-bold transition">ออกจากระบบ</button>
        </div>
      </aside>

      <main className="relative flex-1 overflow-y-auto">
        <div className="max-w-6xl p-8 mx-auto">
          
          <div className="flex items-center justify-between mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-[#161616] border border-slate-200 dark:border-white/10 rounded-full text-[10px] font-black text-slate-500 dark:text-zinc-400 tracking-wider shadow-sm uppercase">
              <div className={`w-2 h-2 rounded-full ${role === 'student' ? 'bg-[#4f46e5] dark:bg-indigo-400' : role === 'hr' ? 'bg-slate-700 dark:bg-zinc-400' : 'bg-emerald-500 dark:bg-emerald-400'}`}></div>
              ROLE: {role}
            </div>

            <div className="flex items-center gap-4">
              <button onClick={toggleTheme} className="p-2.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors bg-white dark:bg-[#161616] border border-zinc-200 dark:border-white/10 rounded-full shadow-sm">
                {isDark ? <IconMoon /> : <IconSun />}
              </button>

              <div className="relative">
                <button onClick={() => setShowNotif(!showNotif)} className="relative p-2.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors bg-white dark:bg-[#161616] border border-zinc-200 dark:border-white/10 rounded-full shadow-sm hover:shadow-md">
                  <IconBell />
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 border-2 border-white dark:border-[#161616] rounded-full animate-pulse"></span>
                </button>
                <AnimatePresence>
                  {showNotif && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 mt-2 w-72 bg-white dark:bg-[#1a1a1a] border border-zinc-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
                      <div className="p-4 border-b border-zinc-100 dark:border-white/5"><h4 className="m-0 text-sm font-bold text-zinc-800 dark:text-zinc-100">การแจ้งเตือน (Notifications)</h4></div>
                      <div className="p-4 flex flex-col gap-3">
                        <div className="flex items-start gap-3 p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl">
                          <div className="text-indigo-600 dark:text-indigo-400 mt-0.5"><IconSparkles /></div>
                          <div><p className="m-0 text-xs font-bold text-zinc-800 dark:text-zinc-200">ระบบ AI อัปเดตใหม่</p><p className="m-0 text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">อัปเดตข้อมูลและแก้ไขโปรไฟล์ได้แล้ว</p></div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {role === 'student' && (
                <motion.button whileHover={{ scale: 1.05 }} onClick={() => setActiveMenu('0')} className="flex items-center gap-3 p-1.5 pr-4 bg-white dark:bg-[#161616] border border-slate-200 dark:border-white/10 rounded-full shadow-sm hover:shadow-md transition-all">
                  <img src={`https://ui-avatars.com/api/?name=${getStudentName()}&background=4f46e5&color=fff`} alt="Avatar" className="border rounded-full shadow-sm w-9 h-9 border-slate-100 dark:border-zinc-800" />
                  <div className="hidden text-right sm:block">
                    <p className="m-0 text-xs font-bold text-slate-800 dark:text-zinc-100">{getStudentName()}</p>
                    <p className="text-[9px] font-bold text-[#4f46e5] dark:text-indigo-400 m-0 uppercase tracking-wider">{studentHeader.major || 'Student'}</p>
                  </div>
                </motion.button>
              )}
              {role === 'hr' && (
                <motion.button whileHover={{ scale: 1.05 }} onClick={() => setActiveMenu('8')} className="flex items-center gap-3 p-1.5 pr-4 bg-white dark:bg-[#161616] border border-slate-200 dark:border-white/10 rounded-full shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-center border rounded-full text-slate-500 dark:text-zinc-400 shadow-sm w-9 h-9 bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21" /></svg>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="m-0 text-xs font-bold text-slate-800 dark:text-zinc-100">Company_HR</p>
                    <p className="text-[9px] font-bold text-slate-500 dark:text-zinc-400 m-0 uppercase tracking-wider">บัญชีบริษัทของคุณ</p>
                  </div>
                </motion.button>
              )}
            </div>
          </div>

          {role === 'student' && <Student activeMenu={activeMenu} setActiveMenu={setActiveMenu} showToast={showToast} />}
          {role === 'hr' && <Company activeMenu={activeMenu} setActiveMenu={setActiveMenu} showToast={showToast} />}
          {role === 'teacher' && <Teacher activeMenu={activeMenu} setActiveMenu={setActiveMenu} showToast={showToast} />}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Student from './Student';
import Company from './Company';
import Teacher from './Teacher';
import { apiJson, clearAuthSession } from './apiClient';

export type ToastType = { msg: string; type: 'success' | 'error' | 'info' } | null;

type Role = 'student' | 'hr' | 'teacher';

type NavItem = {
  key: string;
  label: string;
  icon: () => React.ReactElement;
  /** Navigate to a route instead of switching the in-page menu. */
  route?: string;
  /** Extra menu keys that should also light this item up. */
  alias?: string[];
};

const iconClass = 'h-[18px] w-[18px] shrink-0';

const IconMoon = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>;
const IconSun = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>;
const IconBell = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>;
const IconBrain = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-6 w-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" /></svg>;
const IconSparkles = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>;
const IconMenu = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>;
const IconClose = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
const IconLogout = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>;

const IconGrid = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25A2.25 2.25 0 0113.5 8.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>;
const IconWand = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>;
const IconSearch = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>;
const IconBook = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>;
const IconDoc = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5A3.375 3.375 0 0010.125 2.25H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>;
const IconMegaphone = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535" /></svg>;
const IconUsers = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>;
const IconHeart = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>;
const IconChart = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className={iconClass}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>;
const IconCheckCircle = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IconXCircle = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IconInfoCircle = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>;

const NAV: Record<Role, { label: string; items: NavItem[] }> = {
  student: {
    label: 'Student Module',
    items: [
      { key: 'student-home', label: 'ภาพรวม (Dashboard)', icon: IconGrid },
      { key: '1', label: 'สกัดทักษะด้วย AI', icon: IconWand },
      { key: '2', label: 'ค้นหาที่ฝึกงาน', icon: IconSearch },
      { key: 'logbook', label: 'สมุดบันทึกสหกิจ', icon: IconBook, route: '/student/logbook' },
      { key: 'petitions', label: 'ยื่นคำร้อง', icon: IconDoc },
    ],
  },
  hr: {
    label: 'Company Module',
    items: [
      { key: 'hr-home', label: 'ภาพรวม (Dashboard)', icon: IconGrid },
      { key: '4', label: 'ประกาศงานด้วย AI', icon: IconMegaphone },
      { key: '5', label: 'คัดกรองผู้สมัคร', icon: IconUsers },
      { key: '6', label: 'ผู้สมัครที่ Match', icon: IconHeart },
    ],
  },
  teacher: {
    label: 'Teacher Module',
    items: [
      { key: 'teacher-home', label: 'ติดตามนักศึกษา', icon: IconChart, alias: ['7'] },
      { key: 'teacher-petitions', label: 'จัดการคำร้อง', icon: IconDoc },
    ],
  },
};

const ROLE_LABEL: Record<Role, string> = {
  student: 'นักศึกษา',
  hr: 'บริษัท / HR',
  teacher: 'อาจารย์นิเทศ',
};

const TOAST_STYLE = {
  success: { cls: 'border-emerald-500/30 bg-emerald-600 text-white', icon: <IconCheckCircle /> },
  error: { cls: 'border-rose-500/30 bg-rose-600 text-white', icon: <IconXCircle /> },
  info: { cls: 'border-brand-500/30 bg-brand-600 text-white', icon: <IconInfoCircle /> },
} as const;

function Dashboard({ initialRole }: { initialRole: 'student' | 'company' | 'teacher' }) {
  const navigate = useNavigate();
  const mappedRole: Role = initialRole === 'company' ? 'hr' : initialRole;
  const [role, setRole] = useState<Role>(mappedRole);
  const [activeMenu, setActiveMenu] = useState<string>(
    mappedRole === 'student' ? 'student-home' : mappedRole === 'hr' ? 'hr-home' : 'teacher-home'
  );
  const [isDark, setIsDark] = useState(false);
  const [toast, setToast] = useState<ToastType>(null);
  const [showNotif, setShowNotif] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [studentHeader, setStudentHeader] = useState({ name: 'นักศึกษา', major: '' });
  const notifRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3600);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
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

  // Close overlays with Escape, and lock scroll while the mobile drawer is open.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setSidebarOpen(false);
      setShowNotif(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  useEffect(() => {
    if (!showNotif) return;
    const onClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showNotif]);

  const toggleTheme = () => {
    const next = !isDark;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setIsDark(next);
  };

  const handleLogout = () => {
    clearAuthSession();
    navigate('/login');
  };

  const getStudentName = () => studentHeader.name;

  const isActive = (item: NavItem) =>
    activeMenu === item.key || Boolean(item.alias?.includes(activeMenu));

  const handleNavClick = (item: NavItem) => {
    setSidebarOpen(false);
    if (item.route) { navigate(item.route); return; }
    setActiveMenu(item.key);
  };

  const sidebarContent = (
    <>
      <div className="flex h-16 items-center justify-between gap-2 border-b border-line px-5 lg:h-20">
        <p className="flex items-center gap-2 text-base font-bold tracking-tight text-brand-600 dark:text-brand-400">
          <IconBrain /> AI-InternMatch
        </p>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="icon-btn h-9 w-9 md:hidden"
          aria-label="ปิดเมนู"
        >
          <IconClose />
        </button>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto p-3 sm:p-4" aria-label="เมนูหลัก">
        <p className="nav-section-label">{NAV[role].label}</p>
        {NAV[role].items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleNavClick(item)}
              aria-current={active ? 'page' : undefined}
              className={`nav-item ${active ? 'nav-item-active' : ''}`}
            >
              <Icon />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-line p-3 sm:p-4">
        <button type="button" onClick={handleLogout} className="btn btn-block btn-ghost justify-start hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400">
          <IconLogout /> ออกจากระบบ
        </button>
      </div>
    </>
  );

  return (
    <div className="relative flex min-h-screen bg-bg font-sans text-ink transition-colors duration-300">
      {/* ---------- Toast ---------- */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex justify-center px-4 sm:bottom-8">
        <AnimatePresence>
          {toast && (
            <motion.div
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm font-semibold shadow-2xl backdrop-blur-sm ${TOAST_STYLE[toast.type].cls}`}
            >
              <span className="shrink-0">{TOAST_STYLE[toast.type].icon}</span>
              <span className="flex-1 leading-snug">{toast.msg}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="shrink-0 rounded-lg p-1 text-white/80 transition hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70"
                aria-label="ปิดการแจ้งเตือน"
              >
                <IconClose />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ---------- Sidebar (desktop) ---------- */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface transition-colors duration-300 md:flex xl:w-72">
        {sidebarContent}
      </aside>

      {/* ---------- Sidebar (mobile drawer) ---------- */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-overlay backdrop-blur-sm md:hidden"
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[17rem] max-w-[85vw] flex-col border-r border-line bg-surface shadow-2xl md:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="เมนูนำทาง"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="relative min-w-0 flex-1">
        {/* ---------- Top bar ---------- */}
        <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="icon-btn md:hidden"
                aria-label="เปิดเมนู"
                aria-expanded={sidebarOpen}
              >
                <IconMenu />
              </button>
              <span className="badge badge-neutral">
                <span
                  className={`h-2 w-2 rounded-full ${role === 'student' ? 'bg-brand-500' : role === 'hr' ? 'bg-zinc-500' : 'bg-emerald-500'}`}
                  aria-hidden="true"
                />
                <span className="truncate">{ROLE_LABEL[role]}</span>
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={toggleTheme}
                className="icon-btn"
                aria-label={isDark ? 'สลับไปโหมดสว่าง' : 'สลับไปโหมดมืด'}
                title={isDark ? 'โหมดสว่าง' : 'โหมดมืด'}
              >
                {isDark ? <IconSun /> : <IconMoon />}
              </button>

              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={() => setShowNotif(!showNotif)}
                  className="icon-btn relative"
                  aria-label="การแจ้งเตือน"
                  aria-expanded={showNotif}
                >
                  <IconBell />
                  <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-surface bg-rose-500" aria-hidden="true" />
                </button>
                <AnimatePresence>
                  {showNotif && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
                    >
                      <div className="border-b border-line px-4 py-3">
                        <h4 className="card-title">การแจ้งเตือน</h4>
                      </div>
                      <div className="space-y-3 p-4">
                        <div className="flex items-start gap-3 rounded-xl bg-brand-50 p-3 dark:bg-brand-500/10">
                          <span className="mt-0.5 text-brand-600 dark:text-brand-400"><IconSparkles /></span>
                          <div>
                            <p className="text-sm font-semibold text-ink">ระบบ AI อัปเดตใหม่</p>
                            <p className="mt-0.5 text-xs text-ink-muted">อัปเดตข้อมูลและแก้ไขโปรไฟล์ได้แล้ว</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {role === 'student' && (
                <button
                  type="button"
                  onClick={() => setActiveMenu('0')}
                  className="flex items-center gap-2.5 rounded-full border border-line bg-surface p-1 pr-1 transition hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:pr-4"
                  aria-label="ไปที่โปรไฟล์ของฉัน"
                >
                  <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(getStudentName())}&background=4f46e5&color=fff`}
                    alt=""
                    className="h-9 w-9 rounded-full"
                  />
                  <span className="hidden text-left sm:block">
                    <span className="block text-sm font-semibold leading-tight text-ink">{getStudentName()}</span>
                    <span className="block text-xs leading-tight text-ink-muted">{studentHeader.major || 'Student'}</span>
                  </span>
                </button>
              )}

              {role === 'hr' && (
                <button
                  type="button"
                  onClick={() => setActiveMenu('8')}
                  className="flex items-center gap-2.5 rounded-full border border-line bg-surface p-1 pr-1 transition hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:pr-4"
                  aria-label="ไปที่โปรไฟล์บริษัท"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-ink-muted">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21" /></svg>
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block text-sm font-semibold leading-tight text-ink">Company HR</span>
                    <span className="block text-xs leading-tight text-ink-muted">บัญชีบริษัทของคุณ</span>
                  </span>
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          {role === 'student' && <Student activeMenu={activeMenu} setActiveMenu={setActiveMenu} showToast={showToast} />}
          {role === 'hr' && <Company activeMenu={activeMenu} setActiveMenu={setActiveMenu} showToast={showToast} />}
          {role === 'teacher' && <Teacher activeMenu={activeMenu} setActiveMenu={setActiveMenu} showToast={showToast} />}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;

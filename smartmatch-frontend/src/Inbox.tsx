import { useEffect, useMemo, useRef, useState } from 'react';
import { InboxContact, InboxMessage, UserRole } from './types';
import { apiJson, friendlyApiError } from './apiClient';
import { EmptyState, PageHeading, Skeleton } from './ui';

const CONTACTS_POLL_MS = 6000;
const THREAD_POLL_MS = 3000;

const ROLE_LABEL: Record<UserRole, string> = {
  student: 'นักศึกษา',
  company: 'บริษัท / HR',
  teacher: 'อาจารย์นิเทศ',
};

const ROLE_BADGE: Record<UserRole, string> = {
  student: 'badge-brand',
  company: 'badge-neutral',
  teacher: 'badge-success',
};

const IconSend = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>;
const IconInbox = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-10 w-10"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" /></svg>;
const IconBack = () => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>;

export default function Inbox({
  showToast,
  onUnreadChange,
}: {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onUnreadChange?: () => void;
}) {
  const [contacts, setContacts] = useState<InboxContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [activePeerId, setActivePeerId] = useState<number | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [loadError, setLoadError] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);

  const loadContacts = () =>
    apiJson('/api/messages/contacts')
      .then((data) => {
        setContacts(Array.isArray(data) ? data : []);
        setLoadError('');
      })
      .catch((err) => setLoadError(friendlyApiError(err, 'โหลดรายชื่อผู้ติดต่อไม่สำเร็จ')))
      .finally(() => setContactsLoading(false));

  useEffect(() => {
    loadContacts();
    const interval = setInterval(loadContacts, CONTACTS_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activePeerId === null) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setThreadLoading(true);
    const loadThread = () =>
      apiJson(`/api/messages?with=${activePeerId}`)
        .then((data) => {
          if (cancelled) return;
          setMessages(Array.isArray(data) ? data : []);
          setLoadError('');
          onUnreadChange?.();
        })
        .catch((err) => {
          if (!cancelled) setLoadError(friendlyApiError(err, 'โหลดข้อความไม่สำเร็จ'));
        })
        .finally(() => {
          if (!cancelled) setThreadLoading(false);
        });

    loadThread();
    const interval = setInterval(loadThread, THREAD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activePeerId]);

  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, activePeerId]);

  const activeContact = useMemo(
    () => contacts.find((c) => c.user_id === activePeerId) || null,
    [contacts, activePeerId],
  );

  const visibleContacts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (roleFilter !== 'all' && c.role !== roleFilter) return false;
      if (!keyword) return true;
      return c.name.toLowerCase().includes(keyword) || c.email.toLowerCase().includes(keyword);
    });
  }, [contacts, search, roleFilter]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || activePeerId === null || sending) return;
    setSending(true);
    try {
      await apiJson('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ receiver_id: activePeerId, body }),
      });
      setDraft('');
      const data = await apiJson(`/api/messages?with=${activePeerId}`);
      if (Array.isArray(data)) setMessages(data);
      loadContacts();
    } catch (err) {
      showToast(friendlyApiError(err, 'ส่งข้อความไม่สำเร็จ'), 'error');
    } finally {
      setSending(false);
    }
  };

  const totalUnread = contacts.reduce((sum, c) => sum + c.unread_count, 0);

  return (
    <div className="text-ink">
      <PageHeading
        eyebrow="Universal Chat"
        title="กล่องข้อความ"
        subtitle="ส่งข้อความหานักศึกษา บริษัท และอาจารย์นิเทศได้จากที่เดียว"
        actions={
          totalUnread > 0 ? (
            <span className="badge badge-danger">ยังไม่ได้อ่าน {totalUnread} ข้อความ</span>
          ) : undefined
        }
      />

      {loadError && <div className="alert alert-danger mb-6" role="alert">{loadError}</div>}

      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        {/* ---------- Contact list ---------- */}
        <section
          className={`card flex max-h-[34rem] flex-col overflow-hidden ${activePeerId !== null ? 'hidden lg:flex' : ''}`}
          aria-label="รายชื่อผู้ติดต่อ"
        >
          <div className="space-y-3 border-b border-line p-4">
            <div>
              <label htmlFor="inbox-search" className="sr-only">ค้นหาผู้ติดต่อ</label>
              <input
                id="inbox-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อหรืออีเมล..."
                className="input py-2.5 text-sm"
              />
            </div>
            <div className="flex gap-1.5 rounded-xl bg-surface-2 p-1">
              {(['all', 'student', 'company', 'teacher'] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setRoleFilter(role)}
                  aria-pressed={roleFilter === role}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-brand-500 ${roleFilter === role ? 'bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900' : 'text-ink-muted hover:bg-surface hover:text-ink'}`}
                >
                  {role === 'all' ? 'ทั้งหมด' : ROLE_LABEL[role].split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {contactsLoading ? (
              <div className="space-y-3 p-4" role="status" aria-label="กำลังโหลดรายชื่อ">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : visibleContacts.length === 0 ? (
              <p className="p-6 text-center text-sm text-ink-muted">ไม่พบผู้ติดต่อที่ตรงกับเงื่อนไข</p>
            ) : (
              <ul className="divide-y divide-line">
                {visibleContacts.map((contact) => (
                  <li key={contact.user_id}>
                    <button
                      type="button"
                      onClick={() => setActivePeerId(contact.user_id)}
                      aria-current={activePeerId === contact.user_id ? 'true' : undefined}
                      className={`w-full px-4 py-3 text-left transition hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand-500 ${activePeerId === contact.user_id ? 'bg-surface-2' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-ink">{contact.name}</span>
                        {contact.unread_count > 0 && (
                          <span className="badge badge-danger shrink-0">{contact.unread_count}</span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`badge ${ROLE_BADGE[contact.role]} shrink-0`}>{ROLE_LABEL[contact.role]}</span>
                        <span className="truncate text-xs text-ink-muted">
                          {contact.last_message || contact.email}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ---------- Thread ---------- */}
        <section className="card flex max-h-[34rem] min-h-[26rem] flex-col overflow-hidden" aria-label="หน้าต่างสนทนา">
          {activeContact === null ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                icon={<IconInbox />}
                title="เลือกผู้ติดต่อเพื่อเริ่มสนทนา"
                description="เลือกรายชื่อทางด้านซ้าย แล้วพิมพ์ข้อความเพื่อเริ่มการสนทนาได้ทันที"
              />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-line bg-surface-2 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setActivePeerId(null)}
                  className="icon-btn h-8 w-8 lg:hidden"
                  aria-label="กลับไปรายชื่อผู้ติดต่อ"
                >
                  <IconBack />
                </button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{activeContact.name}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {ROLE_LABEL[activeContact.role]} · {activeContact.email}
                  </p>
                </div>
              </div>

              <div ref={threadRef} className="chat-window flex-1">
                {threadLoading && messages.length === 0 ? (
                  <p className="mt-10 text-center text-sm text-ink-muted" role="status">กำลังโหลดข้อความ...</p>
                ) : messages.length === 0 ? (
                  <p className="mt-10 px-4 text-center text-sm text-ink-muted">
                    ยังไม่มีข้อความในห้องนี้ เริ่มต้นบทสนทนาได้เลย
                  </p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`bubble ${m.mine ? 'bubble-me' : 'bubble-them'}`}>
                      {!m.mine && <p className="mb-0.5 text-xs font-semibold opacity-80">{m.sender_name}</p>}
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`mt-1 text-[11px] ${m.mine ? 'text-white/70' : 'text-ink-subtle'}`}>{m.created_at}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleSend} className="flex gap-2 border-t border-line bg-surface p-3">
                <label htmlFor="inbox-draft" className="sr-only">ข้อความ</label>
                <input
                  id="inbox-draft"
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={2000}
                  placeholder={`ส่งข้อความถึง ${activeContact.name}...`}
                  className="input py-2.5 text-sm"
                />
                <button type="submit" disabled={!draft.trim() || sending} className="btn btn-primary btn-sm shrink-0" aria-label="ส่งข้อความ">
                  <IconSend />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

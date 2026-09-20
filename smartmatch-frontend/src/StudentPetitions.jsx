import { useEffect, useState } from 'react';
import { apiJson, friendlyApiError } from './apiClient';

const PETITION_TYPES = [
  { value: 'waiver', label: 'สละสิทธิ์' },
  { value: 'transfer', label: 'เปลี่ยนที่' },
  { value: 'leave', label: 'ลางาน' },
];

function typeLabel(type) {
  return PETITION_TYPES.find((item) => item.value === type)?.label || type;
}

function statusClass(status) {
  if (status === 'Approved') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
  if (status === 'Rejected') return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20';
  return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
}

function statusLabel(status) {
  if (status === 'Approved') return 'Approved';
  if (status === 'Rejected') return 'Rejected';
  return 'Pending';
}

function petitionReason(petition) {
  if (petition?.reason) return petition.reason;
  const payload = petition?.payload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload.reason || '';
  }
  return '';
}

export default function StudentPetitions({ showToast }) {
  const [type, setType] = useState('waiver');
  const [reason, setReason] = useState('');
  const [petitions, setPetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const notify = (msg, kind = 'success') => {
    if (showToast) showToast(msg, kind);
  };

  const loadPetitions = () => {
    setLoading(true);
    apiJson('/api/petitions')
      .then((data) => {
        setPetitions(Array.isArray(data) ? data : []);
        setError('');
      })
      .catch((err) => {
        setError(friendlyApiError(err, 'โหลดคำร้องไม่สำเร็จ'));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPetitions();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      notify('กรุณาระบุเหตุผลของคำร้อง', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await apiJson('/api/petitions', {
        method: 'POST',
        body: JSON.stringify({
          type,
          reason: reason.trim(),
          payload: { reason: reason.trim() },
        }),
      });
      setReason('');
      notify('ส่งคำร้องเรียบร้อยแล้ว', 'success');
      loadPetitions();
    } catch (err) {
      notify(friendlyApiError(err, 'ยื่นคำร้องไม่สำเร็จ'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="m-0 text-3xl font-extrabold tracking-tighter text-zinc-900 dark:text-zinc-100">ยื่นคำร้อง</h2>
        <p className="mt-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">ส่งคำร้องสละสิทธิ์ เปลี่ยนสถานที่ฝึกงาน หรือลางานให้อาจารย์พิจารณา</p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-8 mb-10 bg-white/70 dark:bg-[#161616] backdrop-blur-xl border shadow-sm rounded-[2rem] border-zinc-200/50 dark:border-white/5">
        <h3 className="mb-6 text-sm font-bold tracking-wide uppercase text-zinc-800 dark:text-zinc-200">แบบฟอร์มคำร้อง</h3>
        <label className="block mb-2 text-xs font-semibold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">ประเภทคำร้อง</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full p-4 mb-6 text-sm transition-all bg-[#1a1a1a] border border-white/10 outline-none rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-white"
        >
          {PETITION_TYPES.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
        <label className="block mb-2 text-xs font-semibold tracking-wide uppercase text-zinc-500 dark:text-zinc-400">เหตุผล</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="ระบุรายละเอียด เช่น เหตุผลการลา / สถานที่ที่ต้องการย้าย / เหตุผลสละสิทธิ์"
          className="w-full h-32 p-4 mb-6 text-sm transition-all bg-[#1a1a1a] border outline-none resize-none border-white/10 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 text-sm font-semibold tracking-tight text-white transition-colors shadow-lg bg-zinc-900 dark:bg-white dark:text-black rounded-2xl hover:bg-zinc-800 disabled:opacity-50"
        >
          {submitting ? 'กำลังส่งคำร้อง...' : 'Submit'}
        </button>
      </form>

      <div className="overflow-hidden bg-white/70 dark:bg-[#121212] backdrop-blur-xl border shadow-sm rounded-[2rem] border-zinc-200/50 dark:border-white/5">
        <div className="px-8 py-6 border-b border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/5">
          <h3 className="m-0 text-sm font-bold tracking-wide uppercase text-zinc-800 dark:text-zinc-200">คำร้องที่เคยยื่น</h3>
        </div>
        <div className="p-6 space-y-4">
          {loading && <p className="py-8 m-0 text-sm font-medium text-center text-zinc-400">กำลังโหลดคำร้อง...</p>}
          {!loading && petitions.length === 0 && (
            <p className="py-8 m-0 text-sm font-medium text-center text-zinc-400 dark:text-zinc-500">ยังไม่มีคำร้องในระบบ</p>
          )}
          {!loading && petitions.map((petition) => (
            <div key={petition.id} className="p-5 border bg-white dark:bg-[#161616] border-zinc-200/50 dark:border-white/5 rounded-2xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="m-0 text-lg font-bold text-zinc-900 dark:text-zinc-100">{typeLabel(petition.type)}</h4>
                  <p className="m-0 mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{petitionReason(petition) || '-'}</p>
                  <p className="m-0 mt-2 text-xs font-medium text-zinc-400">{petition.created_at}</p>
                </div>
                <span className={`self-start px-3 py-1 rounded-md text-[10px] font-black tracking-widest uppercase border ${statusClass(petition.status)}`}>
                  {statusLabel(petition.status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { apiJson, friendlyApiError } from './apiClient';

const TYPE_LABELS = {
  waiver: 'สละสิทธิ์',
  transfer: 'เปลี่ยนที่',
  leave: 'ลางาน',
  cancel: 'สละสิทธิ์',
};

function typeLabel(type) {
  return TYPE_LABELS[type] || type;
}

function petitionReason(petition) {
  if (petition?.reason) return petition.reason;
  const payload = petition?.payload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload.reason || '';
  }
  return '';
}

export default function TeacherPetitions({ petitions, resolvingId, onResolve }) {
  return (
    <div className="overflow-hidden mb-10 bg-white/70 dark:bg-[#121212] backdrop-blur-xl border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none rounded-[2rem] border-indigo-200/80 dark:border-indigo-900/40">
      <div className="flex items-center justify-between px-8 py-6 border-b border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20">
        <h3 className="flex items-center gap-2 m-0 text-sm font-bold tracking-wide uppercase text-indigo-800 dark:text-indigo-300">
          Petition Management ({petitions.length})
        </h3>
      </div>
      <div className="p-6 space-y-4">
        {petitions.length === 0 ? (
          <p className="py-8 m-0 font-medium text-center text-zinc-400 dark:text-zinc-500">ไม่มีคำร้องที่รออนุมัติในขณะนี้</p>
        ) : petitions.map((petition) => (
          <div key={petition.id} className="p-5 border bg-white dark:bg-[#161616] border-indigo-200/50 dark:border-indigo-900/30 rounded-2xl flex flex-col xl:flex-row xl:items-center justify-between gap-4 shadow-sm">
            <div>
              <h4 className="m-0 text-lg font-bold text-zinc-900 dark:text-zinc-100">{petition.student_name || 'นักศึกษา'}</h4>
              <p className="m-0 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                ประเภทคำร้อง: <span className="font-bold text-indigo-600 dark:text-indigo-400">{typeLabel(petition.type)}</span>
              </p>
              <p className="p-3 mt-3 text-sm border bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/50 rounded-xl text-indigo-900 dark:text-indigo-200">
                <strong>เหตุผล:</strong> {petitionReason(petition) || '-'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={resolvingId === petition.id}
                onClick={() => onResolve(petition.id, 'Rejected')}
                className="px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 rounded-xl dark:bg-[#1a1a1a] dark:text-zinc-300 dark:border-white/10 hover:bg-zinc-50 disabled:opacity-60"
              >
                ❌ ปฏิเสธ (Reject)
              </button>
              <button
                type="button"
                disabled={resolvingId === petition.id}
                onClick={() => onResolve(petition.id, 'Approved')}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl shadow-md hover:bg-emerald-700 disabled:opacity-60"
              >
                ✅ อนุมัติ (Approve)
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export async function resolveTeacherPetition(id, status) {
  return apiJson(`/api/petitions/${id}/resolve`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export function petitionError(err) {
  return friendlyApiError(err, 'จัดการคำร้องไม่สำเร็จ');
}

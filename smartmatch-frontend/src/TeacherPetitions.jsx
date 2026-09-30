import { apiJson, friendlyApiError } from './apiClient';
import { EmptyState, Spinner } from './ui';

const TYPE_LABELS = {
  waiver: 'สละสิทธิ์',
  transfer: 'เปลี่ยนสถานที่ฝึกงาน',
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
    <section className="panel mb-8 border-brand-200 dark:border-brand-900/50" aria-labelledby="petition-management-title">
      <div className="panel-header border-brand-200 bg-brand-50 dark:border-brand-900/50 dark:bg-brand-950/20">
        <h3 id="petition-management-title" className="section-title text-brand-800 dark:text-brand-300">
          คำร้องที่รอพิจารณา
        </h3>
        <span className={`badge ${petitions.length > 0 ? 'badge-brand' : 'badge-neutral'}`}>{petitions.length} รายการ</span>
      </div>

      <div className="panel-body">
        {petitions.length === 0 ? (
          <EmptyState title="ไม่มีคำร้องที่รออนุมัติ" description="คำร้องใหม่จากนักศึกษาจะปรากฏที่นี่ทันที" />
        ) : petitions.map((petition) => {
          const busy = resolvingId === petition.id;
          return (
            <div key={petition.id} className="card card-pad">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <h4 className="text-base font-bold text-ink sm:text-lg">{petition.student_name || 'นักศึกษา'}</h4>
                  <p className="mt-1 text-xs text-ink-muted">
                    ประเภทคำร้อง: <span className="font-semibold text-brand-600 dark:text-brand-400">{typeLabel(petition.type)}</span>
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    บริษัทที่เกี่ยวข้อง:{' '}
                    {petition.company_name ? (
                      <span className="font-semibold text-brand-600 dark:text-brand-400">
                        {petition.company_name}
                        {petition.job_title ? ` — ${petition.job_title}` : ''}
                      </span>
                    ) : (
                      <span className="text-ink-subtle">ไม่ระบุ</span>
                    )}
                  </p>
                  <p className="alert alert-info mt-3"><strong>เหตุผล:</strong> {petitionReason(petition) || '-'}</p>
                </div>

                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onResolve(petition.id, 'Rejected')}
                    className="btn btn-outline btn-sm"
                  >
                    ปฏิเสธคำร้อง
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onResolve(petition.id, 'Approved')}
                    className="btn btn-success btn-sm"
                  >
                    {busy && <Spinner />}
                    {busy ? 'กำลังบันทึก...' : 'อนุมัติคำร้อง'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
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

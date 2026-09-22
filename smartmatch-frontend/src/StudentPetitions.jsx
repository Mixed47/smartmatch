import { useEffect, useState } from 'react';
import { apiJson, friendlyApiError } from './apiClient';
import { EmptyState, PageHeading, SkeletonList, Spinner } from './ui';

const PETITION_TYPES = [
  { value: 'waiver', label: 'สละสิทธิ์ที่ฝึกงาน' },
  { value: 'transfer', label: 'เปลี่ยนสถานที่ฝึกงาน' },
  { value: 'leave', label: 'ลางาน' },
];

function typeLabel(type) {
  return PETITION_TYPES.find((item) => item.value === type)?.label || type;
}

function statusClass(status) {
  if (status === 'Approved') return 'badge-success';
  if (status === 'Rejected') return 'badge-danger';
  return 'badge-warning';
}

function statusLabel(status) {
  if (status === 'Approved') return 'อนุมัติแล้ว';
  if (status === 'Rejected') return 'ไม่อนุมัติ';
  return 'รอพิจารณา';
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
    <div className="w-full">
      <PageHeading
        title="ยื่นคำร้อง"
        subtitle="ส่งคำร้องสละสิทธิ์ เปลี่ยนสถานที่ฝึกงาน หรือลางานให้อาจารย์พิจารณา"
        eyebrow="Student Module"
      />

      {error && <div className="alert alert-danger mb-6" role="alert">{error}</div>}

      <form onSubmit={handleSubmit} className="panel mb-8 p-5 sm:p-8">
        <h3 className="section-title mb-5">แบบฟอร์มคำร้อง</h3>

        <div className="space-y-5">
          <div>
            <label htmlFor="petition-type" className="label">ประเภทคำร้อง</label>
            <select
              id="petition-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="select"
            >
              {PETITION_TYPES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="petition-reason" className="label">เหตุผล</label>
            <textarea
              id="petition-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ระบุรายละเอียด เช่น เหตุผลการลา / สถานที่ที่ต้องการย้าย / เหตุผลสละสิทธิ์"
              className="textarea h-32"
              required
            />
            <p className="field-hint">อาจารย์จะเห็นข้อความนี้ประกอบการพิจารณา</p>
          </div>

          <button type="submit" disabled={submitting || !reason.trim()} className="btn btn-primary btn-lg btn-block">
            {submitting && <Spinner />}
            {submitting ? 'กำลังส่งคำร้อง...' : 'ส่งคำร้อง'}
          </button>
        </div>
      </form>

      <section className="panel">
        <div className="panel-header">
          <h3 className="section-title">คำร้องที่เคยยื่น</h3>
          {!loading && <span className="badge badge-neutral">{petitions.length} รายการ</span>}
        </div>
        <div className="panel-body">
          {loading && <SkeletonList count={2} rows={2} />}

          {!loading && petitions.length === 0 && (
            <EmptyState title="ยังไม่มีคำร้องในระบบ" description="คำร้องที่คุณยื่นจะแสดงสถานะการพิจารณาที่นี่" />
          )}

          {!loading && petitions.map((petition) => (
            <div key={petition.id} className="card card-pad">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h4 className="text-base font-bold text-ink sm:text-lg">{typeLabel(petition.type)}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{petitionReason(petition) || '-'}</p>
                  <p className="mt-2 text-xs text-ink-subtle">{petition.created_at}</p>
                </div>
                <span className={`badge ${statusClass(petition.status)} self-start`}>
                  {statusLabel(petition.status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

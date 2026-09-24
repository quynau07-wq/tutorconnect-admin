import {useEffect, useState} from 'react';
import {JobPost, request} from './api';

type Candidate = {id: string; displayName: string; subjects?: string[]; grades?: string[]; university?: string; teachingAreas?: string; teachingModes?: string[]; onlinePrice?: string; offlinePrice?: string; priceUnit?: string; availability?: JobPost['schedule']; subjectMatch: boolean; gradeMatch: boolean; scheduleScore: number; alreadyRecommended: boolean};
const days: Record<string, string> = {MONDAY: 'Thứ 2', TUESDAY: 'Thứ 3', WEDNESDAY: 'Thứ 4', THURSDAY: 'Thứ 5', FRIDAY: 'Thứ 6', SATURDAY: 'Thứ 7', SUNDAY: 'Chủ nhật'};
export default function TutorRecommendations({job, onClose, onSaved}: {job: JobPost; onClose: () => void; onSaved: () => void}) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [matching, setMatching] = useState(true);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError(''); setSelected([]);
    try { setCandidates(await request<Candidate[]>(`/api/learning/admin/jobs/${job.id}/candidates`)); }
    catch (e: any) { setCandidates([]); setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [job.id]);
  const send = async () => {
    if (saving || !selected.length) return;
    setSaving(true); setError('');
    try {
      await request(`/api/learning/admin/jobs/${job.id}/recommendations`, {method: 'POST', body: JSON.stringify({tutorIds: selected, note})});
      onSaved();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
  const visible = candidates.filter(c => (!matching || (c.subjectMatch && c.gradeMatch)) && normalize(`${c.displayName} ${c.subjects?.join(' ')} ${c.university || ''}`).includes(normalize(query)))
    .sort((a, b) => Number(b.subjectMatch && b.gradeMatch) - Number(a.subjectMatch && a.gradeMatch) || b.scheduleScore - a.scheduleScore);
  return <div className="modal-backdrop"><section className="profile-modal" role="dialog" aria-modal="true" aria-label="Đề xuất gia sư">
    <div className="modal-header"><div><h2>Đề xuất gia sư</h2><p>{job.subject} · {job.grade}</p></div><button type="button" disabled={saving} onClick={onClose}>Đóng</button></div>
    <p>Chọn tối đa 20 gia sư. Phụ huynh xem hồ sơ và quyết định chọn một người; bài đăng vẫn mở trong khi chờ duyệt.</p>
    <div className="management-toolbar"><input aria-label="Tìm gia sư" placeholder="Tên, môn dạy, trường..." value={query} onChange={e => setQuery(e.target.value)} /><label><input type="checkbox" checked={matching} onChange={e => setMatching(e.target.checked)} /> Đúng môn và lớp</label></div>
    {error && <div className="error-banner" role="alert">{error}<button disabled={saving} onClick={load}>Tải lại danh sách</button></div>}
    {loading ? <p>Đang tải gia sư...</p> : !visible.length ? <p>Không có gia sư phù hợp với bộ lọc.</p> : visible.map(c => <div className="detail-section" key={c.id}>
      <label><input type="checkbox" disabled={saving || c.alreadyRecommended || (!selected.includes(c.id) && selected.length >= 20)} checked={selected.includes(c.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id))} /> <strong>{c.displayName}</strong> {c.alreadyRecommended && <span className="badge neutral">Đã đề xuất</span>}</label>
      <p>{c.subjects?.join(', ')} · {c.grades?.join(', ')}</p><p>{c.university || 'Chưa cập nhật trường'} · Lịch phù hợp {c.scheduleScore}%</p>
      {(!c.subjectMatch || !c.gradeMatch) && <p>Chưa khớp môn hoặc lớp của bài đăng.</p>}
      <details><summary>Xem lịch và thông tin dạy</summary><p>{c.teachingModes?.join(', ')} · {c.teachingAreas}</p><p>Online: {c.onlinePrice || 'Chưa cập nhật'} đ · Trực tiếp: {c.offlinePrice || 'Chưa cập nhật'} đ / {c.priceUnit === 'SESSION' ? 'buổi' : 'giờ'}</p>{c.availability?.map((slot, i) => <p key={i}>{days[slot.dayOfWeek] || slot.dayOfWeek}: {slot.startTime}–{slot.endTime}</p>)}</details>
    </div>)}
    <label className="field"><span>Lời nhắn của trung tâm (không bắt buộc)</span><textarea maxLength={10000} value={note} disabled={saving} onChange={e => setNote(e.target.value)} /></label>
    <div className="modal-actions"><span>Đã chọn {selected.length}/20</span><button className="primary compact" disabled={loading || saving || !selected.length} onClick={send}>{saving ? 'Đang gửi...' : 'Gửi phụ huynh duyệt'}</button></div>
  </section></div>;
}

import ManagementFilters, {
  CONTRACT_STATUS,
  normalizeSearch,
  statusClass,
} from './ManagementFilters';
import { useEffect, useState } from 'react';
import { request } from './api';
type ClassRecord = {
  id: string;
  tutorId: string;
  tutorName: string;
  learnerName: string;
  subject: string;
  status: string;
  rejectionReason?: string;
  rejectionCategory?: string;
  lessonRecords?: Record<string, any>;
  scheduleHistory?: any[];
  lessons: {
    lessonIndex: number;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
  }[];
};
const CATEGORIES: Record<string, string> = {
  METHOD: 'Phương pháp',
  PUNCTUALITY: 'Đúng giờ',
  COMMUNICATION: 'Giao tiếp',
  CHANGED_NEEDS: 'Đổi nhu cầu',
  OTHER: 'Khác / chưa phân loại',
};
const STATUS: Record<string, string> = {
  UPCOMING: 'Sắp học',
  IN_PROGRESS: 'Đang học',
  AWAIT_CONFIRMATION: 'Chờ xác nhận',
  COMPLETED: 'Đã học',
  CANCELLED: 'Đã hủy',
  WAIT_PAYMENT: 'Chờ trả buổi đầu',
  WAIT_BALANCE: 'Chờ trả phần còn lại',
  WAIT_DECISION: 'Chờ quyết định',
};
export default function LearningOperations() {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [audit, setAudit] = useState<{
    events: { id: string; title: string; createdAtMs: number }[];
    notifications: { total: number; waiting: number; retry: number };
  } | null>(null);
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [items, log] = await Promise.all([
        request<ClassRecord[]>('/api/operations/admin/classes'),
        request<NonNullable<typeof audit>>('/api/operations/admin/activity'),
      ]);
      setClasses(items);
      setAudit(log);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const resolve = async (c: ClassRecord, index: number, decision: string) => {
    const note = window.prompt(
      decision === 'COMPLETE'
        ? 'Ghi căn cứ xác nhận buổi học đã diễn ra:'
        : 'Ghi lý do mở lại buổi học để hai bên thống nhất học bù:',
    );
    if (!note?.trim() || saving) return;
    setSaving(true);
    try {
      await request(`/api/operations/admin/${c.id}/${index}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ decision, note }),
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const hasAction = (c: ClassRecord) =>
    Object.values(c.lessonRecords || {}).some(r =>
      actionFilter === 'CHANGE'
        ? r.change?.status === 'PENDING'
        : actionFilter === 'DISPUTED'
        ? r.attendance?.status === 'DISPUTED'
        : actionFilter === 'REPORTED'
        ? r.attendance?.status === 'REPORTED'
        : r.change?.status === 'PENDING' ||
          ['DISPUTED', 'REPORTED'].includes(r.attendance?.status),
    );
  const filtered = classes.filter(
    c =>
      (!status || c.status === status) &&
      (!actionFilter || hasAction(c)) &&
      normalizeSearch(
        c.tutorName + ' ' + c.learnerName + ' ' + c.subject + ' ' + c.id,
      ).includes(normalizeSearch(query)),
  );
  const stats = new Map<
    string,
    {
      name: string;
      trials: number;
      rejected: number;
      reasons: Record<string, number>;
    }
  >();
  classes.forEach(c => {
    const t = stats.get(c.tutorId) || {
      name: c.tutorName,
      trials: 0,
      rejected: 0,
      reasons: {},
    };
    if (c.lessons[0]?.status === 'COMPLETED') t.trials++;
    if (c.status === 'CANCELLED') {
      t.rejected++;
      const category = c.rejectionCategory || 'OTHER';
      t.reasons[category] = (t.reasons[category] || 0) + 1;
    }
    stats.set(c.tutorId, t);
  });
  return (
    <>
      <ManagementFilters
        query={query}
        onQuery={setQuery}
        placeholder="Tìm gia sư, người học, môn hoặc mã hợp đồng…"
        loading={loading}
        onRefresh={load}
        count={filtered.length}
        total={classes.length}
        active={!!(query || status || actionFilter)}
        onReset={() => {
          setQuery('');
          setStatus('');
          setActionFilter('');
        }}
      >
        <select
          aria-label="Lọc trạng thái lớp học"
          value={status}
          onChange={e => setStatus(e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(CONTRACT_STATUS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Lọc việc cần xử lý"
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
        >
          <option value="">Tất cả công việc</option>
          <option value="PENDING">Có việc cần xử lý</option>
          <option value="DISPUTED">Có phản ánh</option>
          <option value="REPORTED">Chờ phụ huynh xác nhận</option>
          <option value="CHANGE">Chờ duyệt đổi lịch</option>
        </select>
      </ManagementFilters>
      {audit && (
        <details className="management-fold">
          <summary>
            Nhật ký vận hành · {audit.notifications.waiting} thông báo chờ gửi
          </summary>
          <div className="audit-events">
            <p>
              {audit.notifications.total} thông báo ·{' '}
              {audit.notifications.retry} cần thử lại
            </p>
            {audit.events.map(e => (
              <p key={e.id}>
                {new Date(e.createdAtMs).toLocaleString('vi-VN')} · {e.title}
              </p>
            ))}
          </div>
        </details>
      )}
      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <p>Đang tải…</p>
      ) : (
        <>
          <details className="management-fold">
            <summary>Chất lượng sau buổi đầu · Toàn bộ dữ liệu</summary>
            <p>
              Đánh giá theo cả số lần và tỷ lệ. Lý do đổi nhu cầu không đồng
              nghĩa với chất lượng gia sư kém.
            </p>
            <section className="table-wrap management-table">
              <table>
                <thead>
                  <tr>
                    <th>Gia sư</th>
                    <th>Buổi đầu đã học</th>
                    <th>Từ chối / tỷ lệ</th>
                    <th>Nhóm lý do</th>
                  </tr>
                </thead>
                <tbody>
                  {[...stats].map(([id, t]) => (
                    <tr key={id}>
                      <td data-label="Gia sư">{t.name}</td>
                      <td data-label="Buổi đầu đã học">{t.trials}</td>
                      <td data-label="Từ chối / tỷ lệ">
                        {t.rejected} /{' '}
                        {t.trials
                          ? Math.round((t.rejected / t.trials) * 100)
                          : 0}
                        %
                      </td>
                      <td data-label="Nhóm lý do">
                        {Object.entries(t.reasons).map(([key, count]) => (
                          <small key={key}>
                            {CATEGORIES[key]}: {count}
                          </small>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </details>
          <h2 className="section-heading">Tiến độ, đổi lịch và nhật ký</h2>
          {!filtered.length && (
            <div className="table-wrap empty">
              Không có lớp học phù hợp với tìm kiếm và bộ lọc.
            </div>
          )}
          {filtered.map(c => (
            <details key={c.id} className="management-fold management-table">
              <summary>
                <span className="class-summary">
                  <strong>
                    {c.learnerName} · {c.subject}
                  </strong>
                  <small>Gia sư {c.tutorName}</small>
                  <span className={`badge ${statusClass(c.status)}`}>
                    {CONTRACT_STATUS[c.status] || c.status}
                  </span>
                  <span className="class-progress">
                    <progress
                      aria-label="Tiến độ học"
                      value={
                        c.lessons.filter(l => l.status === 'COMPLETED').length
                      }
                      max={Math.max(
                        1,
                        c.lessons.filter(l => l.status !== 'CANCELLED').length,
                      )}
                    />
                    {c.lessons.filter(l => l.status === 'COMPLETED').length}/
                    {c.lessons.filter(l => l.status !== 'CANCELLED').length}{' '}
                    buổi
                  </span>
                  {hasAction(c) && (
                    <span className="badge neutral">Có việc cần xử lý</span>
                  )}
                </span>
              </summary>
              <p>Mã hợp đồng: {c.id}</p>
              {c.rejectionReason && (
                <p>
                  Lý do từ chối: {CATEGORIES[c.rejectionCategory || 'OTHER']} ·{' '}
                  {c.rejectionReason}
                </p>
              )}
              <div className="table-wrap management-table">
                <table>
                  <thead>
                    <tr>
                      <th>Buổi / lịch</th>
                      <th>Xác nhận hai phía</th>
                      <th>Nhật ký / bài tập</th>
                      <th>Đổi lịch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.lessons.map(l => {
                      const r = c.lessonRecords?.[l.lessonIndex] || {};
                      return (
                        <tr key={l.lessonIndex}>
                          <td data-label="Buổi / lịch">
                            Buổi {l.lessonIndex + 1}
                            <small>
                              {l.date} · {l.startTime}–{l.endTime}
                            </small>
                            <small>{STATUS[l.status]}</small>
                          </td>
                          <td data-label="Xác nhận hai phía">
                            {r.attendance?.status === 'REPORTED'
                              ? 'Gia sư báo đã dạy, chờ phụ huynh'
                              : r.attendance?.status === 'DISPUTED'
                              ? 'Cần xử lý phản hồi'
                              : r.attendance?.status === 'CONFIRMED'
                              ? 'Đã xác nhận'
                              : 'Chưa có báo cáo'}
                            {r.attendance?.reason && (
                              <small>{r.attendance.reason}</small>
                            )}
                            {r.attendance?.resolution && (
                              <small>Kết luận: {r.attendance.resolution}</small>
                            )}
                            {r.attendance?.status === 'DISPUTED' && (
                              <>
                                <button
                                  disabled={saving}
                                  onClick={() =>
                                    resolve(c, l.lessonIndex, 'COMPLETE')
                                  }
                                >
                                  Xác nhận đã học
                                </button>
                                <button
                                  disabled={saving}
                                  onClick={() =>
                                    resolve(c, l.lessonIndex, 'REOPEN')
                                  }
                                >
                                  Mở lại để học bù
                                </button>
                              </>
                            )}
                          </td>
                          <td data-label="Nhật ký / bài tập">
                            {r.journal ? (
                              <>
                                <small>Nội dung: {r.journal.content}</small>
                                <small>Nhận xét: {r.journal.feedback}</small>
                                <small>
                                  Bài tập: {r.journal.homework}{' '}
                                  {r.journal.homework
                                    ? r.homeworkDone
                                      ? '(Đã xong)'
                                      : '(Chưa xong)'
                                    : ''}
                                </small>
                                <small>Mục tiêu: {r.journal.nextGoal}</small>
                              </>
                            ) : (
                              'Chưa có nhật ký'
                            )}
                          </td>
                          <td data-label="Đổi lịch">
                            {r.change && (
                              <>
                                <small>
                                  {r.change.status === 'PENDING'
                                    ? 'Đang chờ'
                                    : r.change.status === 'ACCEPTED'
                                    ? 'Đã đồng ý'
                                    : 'Đã từ chối'}
                                </small>
                                <small>
                                  {r.change.date} · {r.change.startTime}–
                                  {r.change.endTime}
                                </small>
                                <small>{r.change.reason}</small>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!!c.scheduleHistory?.length && (
                <details>
                  <summary>Lịch sử thay đổi</summary>
                  {c.scheduleHistory.map((h, i) => (
                    <p key={i}>
                      Buổi {h.lessonIndex + 1}: {h.original?.date}{' '}
                      {h.original?.startTime} → {h.date} {h.startTime} (
                      {h.status === 'ACCEPTED' ? 'Đồng ý' : 'Từ chối'}) ·{' '}
                      {h.reason}
                    </p>
                  ))}
                </details>
              )}
            </details>
          ))}
        </>
      )}
    </>
  );
}

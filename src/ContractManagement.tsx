import ManagementFilters, {
  CONTRACT_STATUS,
  normalizeSearch,
  statusClass,
} from './ManagementFilters';
import { useEffect, useState } from 'react';
import { request } from './api';

type Contract = {
  id: string;
  tutorId: string;
  tutorName: string;
  learnerName: string;
  subject: string;
  packageLabel: string;
  sessions: number;
  status: string;
  total: number;
  firstAmount: number;
  remainingAmount: number;
  firstPaidAt?: unknown;
  completedLessons?: Record<string, unknown>;
  balancePaidAt?: unknown;
  rejectionReason?: string;
  lessons: { date: string; startTime: string; endTime: string }[];
};
const STATUS = CONTRACT_STATUS;
export default function ContractManagement() {
  const [reconciliation, setReconciliation] = useState<
    {
      id: string;
      contractId: string;
      amount: number;
      providerTransactionId: string;
    }[]
  >([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [packageFilter, setPackageFilter] = useState('');
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [items, exceptions] = await Promise.all([
        request<Contract[]>('/api/contracts/admin/all'),
        request<typeof reconciliation>('/api/contracts/admin/reconciliation'),
      ]);
      setContracts(items);
      setReconciliation(exceptions);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const complete = async (c: Contract, index = 0) => {
    if (
      saving ||
      !window.confirm(
        `Xác nhận buổi ${index + 1} của ${c.learnerName} với ${
          c.tutorName
        } đã thực sự hoàn thành?`,
      )
    )
      return;
    setSaving(c.id);
    try {
      await request(`/api/contracts/admin/${c.id}/lessons/${index}/complete`, {
        method: 'POST',
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving('');
    }
  };
  const filtered = contracts.filter(
    c =>
      (!status || c.status === status) &&
      (!packageFilter || c.packageLabel === packageFilter) &&
      normalizeSearch(
        c.tutorName + ' ' + c.learnerName + ' ' + c.id + ' ' + c.subject,
      ).includes(normalizeSearch(query)),
  );
  const tutors = new Map<
    string,
    { name: string; rejected: number; trials: number }
  >();
  contracts.forEach(c => {
    const entry = tutors.get(c.tutorId) || {
      name: c.tutorName,
      rejected: 0,
      trials: 0,
    };
    if (c.status === 'CANCELLED') entry.rejected++;
    if (
      [
        'AWAIT_DECISION',
        'WAIT_BALANCE',
        'ACTIVE',
        'CANCELLED',
        'COMPLETED',
      ].includes(c.status)
    )
      entry.trials++;
    tutors.set(c.tutorId, entry);
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
        total={contracts.length}
        active={!!(query || status || packageFilter)}
        onReset={() => {
          setQuery('');
          setStatus('');
          setPackageFilter('');
        }}
      >
        <select
          aria-label="Lọc trạng thái gói học"
          value={status}
          onChange={e => setStatus(e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Lọc loại gói học"
          value={packageFilter}
          onChange={e => setPackageFilter(e.target.value)}
        >
          <option value="">Tất cả gói học</option>
          {[...new Set(contracts.map(c => c.packageLabel))]
            .sort()
            .map(label => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
        </select>
      </ManagementFilters>
      {!!reconciliation.length && (
        <section className="error-banner">
          <strong>Giao dịch cần trung tâm đối soát</strong>
          {reconciliation.map(p => (
            <p key={p.id}>
              Hợp đồng {p.contractId} · {p.amount.toLocaleString('vi-VN')} đ ·
              Mã giao dịch {p.providerTransactionId}. Chưa cộng vào học phí;
              kiểm tra giao dịch trùng hoặc trạng thái hợp đồng.
            </p>
          ))}
        </section>
      )}
      <details className="management-fold">
        <summary>Thống kê gia sư sau buổi đầu · Toàn bộ dữ liệu</summary>
        <section className="table-wrap management-table">
          <table>
            <thead>
              <tr>
                <th>Gia sư</th>
                <th>Buổi đầu đã hoàn thành</th>
                <th>Số lần bị từ chối</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3}>Đang tải...</td>
                </tr>
              ) : (
                [...tutors]
                  .sort((a, b) => b[1].rejected - a[1].rejected)
                  .map(([id, t]) => (
                    <tr key={id}>
                      <td data-label="Gia sư">{t.name}</td>
                      <td data-label="Buổi đầu đã hoàn thành">{t.trials}</td>
                      <td data-label="Số lần bị từ chối">
                        <strong>{t.rejected}</strong>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </section>
      </details>
      {error && <div className="error-banner">{error}</div>}
      <h2 className="section-heading">Danh sách gói học</h2>

      <section className="table-wrap management-table">
        <table>
          <thead>
            <tr>
              <th>Người học / Gia sư</th>
              <th>Gói và lịch</th>
              <th>Thu tiền về trung tâm</th>
              <th>Trạng thái / Lý do</th>
              <th>Xử lý</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>Đang tải...</td>
              </tr>
            ) : !filtered.length ? (
              <tr>
                <td colSpan={5}>
                  Không có gói học phù hợp với tìm kiếm và bộ lọc.
                </td>
              </tr>
            ) : (
              filtered.map(c => (
                <tr key={c.id}>
                  <td data-label="Người học / Gia sư">
                    {c.learnerName}
                    <small>{c.tutorName}</small>
                    <small>{c.subject}</small>
                    <small>{c.id}</small>
                  </td>
                  <td data-label="Gói và lịch">
                    {c.packageLabel} · {c.sessions} buổi
                    <details>
                      <summary>Lịch thực tế</summary>
                      {c.lessons.map((l, i) => (
                        <small key={i}>
                          {l.date} · {l.startTime}–{l.endTime}
                          {c.completedLessons?.[String(i)] ||
                          (i === 0 &&
                            [
                              'AWAIT_DECISION',
                              'WAIT_BALANCE',
                              'ACTIVE',
                              'CANCELLED',
                              'COMPLETED',
                            ].includes(c.status)) ||
                          c.status === 'COMPLETED'
                            ? ' · Đã hoàn thành'
                            : ['CANCELLED', 'VOID'].includes(c.status)
                            ? ' · Đã hủy'
                            : null}
                          {c.status === 'ACTIVE' &&
                            i > 0 &&
                            !c.completedLessons?.[String(i)] &&
                            Date.parse(`${l.date}T${l.endTime}:00+07:00`) <=
                              Date.now() && (
                              <button
                                disabled={!!saving}
                                onClick={() => complete(c, i)}
                              >
                                Xác nhận buổi {i + 1} đã học
                              </button>
                            )}
                        </small>
                      ))}
                    </details>
                  </td>
                  <td data-label="Thu tiền về trung tâm">
                    Buổi đầu: {c.firstAmount.toLocaleString('vi-VN')} đ (
                    {c.firstPaidAt ? 'Đã thu' : 'Chưa thu'})
                    <small>
                      Còn lại: {c.remainingAmount.toLocaleString('vi-VN')} đ (
                      {c.status === 'CANCELLED'
                        ? 'Đã hủy, không thu'
                        : c.balancePaidAt
                        ? 'Đã thu'
                        : 'Chưa thu'}
                      )
                    </small>
                    <small>Tổng gói: {c.total.toLocaleString('vi-VN')} đ</small>
                  </td>
                  <td data-label="Trạng thái / Lý do">
                    <span className={`badge ${statusClass(c.status)}`}>
                      {STATUS[c.status] || c.status}
                    </span>
                    {c.rejectionReason && (
                      <small>Lý do từ chối: {c.rejectionReason}</small>
                    )}
                  </td>
                  <td data-label="Xử lý">
                    {c.status === 'FIRST_SCHEDULED' && (
                      <button disabled={!!saving} onClick={() => complete(c)}>
                        Xác nhận học xong buổi đầu
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}

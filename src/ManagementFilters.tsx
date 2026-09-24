import { Search, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';

export const CONTRACT_STATUS: Record<string, string> = {
  WAIT_FIRST_PAYMENT: 'Chờ thanh toán buổi đầu',
  FIRST_SCHEDULED: 'Chờ học buổi đầu',
  AWAIT_DECISION: 'Chờ phụ huynh quyết định',
  WAIT_BALANCE: 'Chờ thanh toán còn lại',
  ACTIVE: 'Đang học',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy sau buổi đầu',
  VOID: 'Đăng ký đã hủy / hết hạn',
};
export const normalizeSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();
export const statusClass = (status: string) =>
  ['CANCELLED', 'VOID'].includes(status)
    ? 'rejected'
    : ['ACTIVE', 'COMPLETED'].includes(status)
    ? 'approved'
    : 'neutral';

export default function ManagementFilters({
  query,
  onQuery,
  placeholder,
  children,
  loading,
  onRefresh,
  count,
  total,
  active,
  onReset,
}: {
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  children: ReactNode;
  loading: boolean;
  onRefresh: () => void;
  count: number;
  total: number;
  active: boolean;
  onReset: () => void;
}) {
  return (
    <div className="filter-panel">
      <div className="management-toolbar filter-toolbar">
        <div className="search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label={placeholder}
            placeholder={placeholder}
            value={query}
            onChange={e => onQuery(e.target.value)}
          />
        </div>
        {children}
        <button
          className="filter-refresh"
          onClick={onRefresh}
          disabled={loading}
        >
          <RotateCcw size={16} aria-hidden="true" />
          Làm mới
        </button>
      </div>
      <div className="filter-caption" aria-live="polite">
        <span>
          {loading
            ? 'Đang tải dữ liệu…'
            : `Hiển thị ${count} / ${total} kết quả`}
        </span>
        {active && <button onClick={onReset}>Xóa bộ lọc</button>}
      </div>
    </div>
  );
}

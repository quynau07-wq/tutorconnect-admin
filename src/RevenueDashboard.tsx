import {useEffect, useState} from 'react';
import {BarChart3, CalendarDays, RefreshCw, Wallet, Receipt, Users} from 'lucide-react';
import {getRevenue, type RevenueReport} from './api';
import './revenue.css';

const periods = [['day', 'Hôm nay'], ['week', 'Tuần này'], ['month', 'Tháng này'], ['3months', '3 tháng'], ['6months', '6 tháng'], ['year', 'Năm nay'], ['custom', 'Tùy chọn']];
const palette = ['#087f8c', '#6366f1', '#f2a93b', '#e06c86', '#38a88a', '#a6b2c5'];
const money = (n: number) => `${n.toLocaleString('vi-VN')} ₫`;
const compact = (n: number) => new Intl.NumberFormat('vi-VN', {notation: 'compact', maximumFractionDigits: 1}).format(n);
const dateLabel = (s: string) => s.split('-').reverse().join('/');
const today = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const label = (key: string, bucket: string) => bucket === 'hour' ? `${key.slice(11)}h` : bucket === 'month' ? `${key.slice(5)}/${key.slice(0, 4)}` : dateLabel(key);

export default function RevenueDashboard() {
  const [period, setPeriod] = useState('month');
  const [draft, setDraft] = useState({from: today(), to: today()});
  const [range, setRange] = useState(draft);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<RevenueReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setData(null); setSelected(null);
    getRevenue(period, range.from, range.to).then(report => {
      if (!Array.isArray(report.series) || !Array.isArray(report.tutors)) throw new Error('Backend chưa có báo cáo biểu đồ. Vui lòng triển khai bản cập nhật backend trước.');
      if (active) setData(report);
    }).catch(e => {if (active) setError(e.message || 'Không tải được báo cáo.');})
      .finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
  }, [period, range, revision]);
  const applyRange = () => {
    if (!draft.from || !draft.to || draft.from > draft.to) {setValidation('Chọn khoảng ngày hợp lệ, ngày kết thúc không trước ngày bắt đầu.'); return;}
    setValidation(''); setRange({...draft});
  };
  const chartTutors = data ? data.tutors.length > 6 ? [
    ...data.tutors.slice(0, 5),
    {id: 'other', name: `Gia sư khác (${data.tutors.length - 5})`, total: data.tutors.slice(5).reduce((sum, t) => sum + t.total, 0), count: data.tutors.slice(5).reduce((sum, t) => sum + t.count, 0)},
  ] : data.tutors : [];
  const max = Math.max(1, ...data?.series.map(s => s.total) || []);
  let offset = 0;
  return <section className="revenue-dashboard" aria-label="Thống kê doanh số">
    <div className="rev-toolbar">
      <div className="rev-periods" aria-label="Khoảng thống kê">{periods.map(([key, text]) => <button key={key} type="button" aria-pressed={period === key} className={period === key ? 'is-active' : ''} onClick={() => {setPeriod(key); setValidation('');}}>{text}</button>)}</div>
      <button type="button" className="rev-refresh" disabled={loading} onClick={() => setRevision(v => v + 1)}><RefreshCw size={16} /> Làm mới</button>
    </div>
    {period === 'custom' && <form className="rev-dates" onSubmit={e => {e.preventDefault(); applyRange();}}>
      <label>Từ ngày<input required type="date" value={draft.from} max={draft.to || undefined} onChange={e => setDraft({...draft, from: e.target.value})} /></label>
      <label>Đến ngày<input required type="date" value={draft.to} min={draft.from || undefined} onChange={e => setDraft({...draft, to: e.target.value})} /></label>
      <button type="submit">Áp dụng</button>
    </form>}
    {!!validation && <p className="rev-error" role="alert">{validation}</p>}
    <p className="rev-caption"><CalendarDays size={15} />{data ? `${dateLabel(data.from)} – ${dateLabel(data.to)} · Giờ Việt Nam` : 'Thống kê theo giờ Việt Nam'}{['3months', '6months'].includes(period) && ' · Gồm tháng hiện tại và các tháng liền trước'}</p>
    {loading ? <div className="rev-empty" role="status">Đang tổng hợp doanh số…</div> : error ? <div className="rev-empty" role="alert"><p>{error}</p><button type="button" onClick={() => setRevision(v => v + 1)}>Thử lại</button></div> : data && <>
      <div className="rev-metrics">
        <div className="rev-metric rev-primary"><Wallet size={21} /><span>Doanh số đã thu</span><strong>{money(data.total)}</strong><small>Tổng thanh toán đã xác nhận</small></div>
        <div className="rev-metric"><Receipt size={21} /><span>Giao dịch thành công</span><strong>{data.count.toLocaleString('vi-VN')}</strong><small>Trong khoảng đã chọn</small></div>
        <div className="rev-metric"><BarChart3 size={21} /><span>Trung bình / giao dịch</span><strong>{money(data.average)}</strong><small>Theo số tiền đã thu</small></div>
        <div className="rev-metric"><Users size={21} /><span>Gia sư có doanh số</span><strong>{data.tutors.filter(t => t.id !== 'unassigned').length}</strong><small>Từ các gói học đã thanh toán</small></div>
      </div>
      <div className="rev-charts">
        <article className="rev-panel">
          <div className="rev-panel-heading"><div><h2>Doanh số trung tâm</h2><p>Theo {data.bucket === 'hour' ? 'giờ' : data.bucket === 'day' ? 'ngày' : 'tháng'} · VNĐ</p></div><span className="rev-badge">Đã thu</span></div>
          {data.count === 0 ? <div className="rev-empty">Chưa có thanh toán thành công trong khoảng này.</div> : <>
            <div className="rev-bar-detail" aria-live="polite">{selected === null ? 'Chạm hoặc di chuột vào cột để xem chi tiết' : `${label(data.series[selected].key, data.bucket)} · ${money(data.series[selected].total)} · ${data.series[selected].count} giao dịch`}</div>
            <div className="rev-bar-layout"><div className="rev-axis"><span>{compact(max)}</span><span>{compact(max / 2)}</span><span>0</span></div><div className="rev-bar-scroll"><div className="rev-bars" style={{minWidth: Math.max(320, data.series.length * 36)}}>
              {data.series.map((point, index) => <div className="rev-bar-column" key={point.key}>
                <button type="button" className={`rev-bar ${selected === index ? 'is-selected' : ''}`} style={{height: `${Math.max(point.total ? 1 : 0, point.total / max * 100)}%`}} aria-label={`${label(point.key, data.bucket)}: ${money(point.total)}, ${point.count} giao dịch`} title={`${label(point.key, data.bucket)}: ${money(point.total)}`} onMouseEnter={() => setSelected(index)} onFocus={() => setSelected(index)} onClick={() => setSelected(index)} />
                <span className="rev-bar-label">{data.bucket === 'hour' ? `${point.key.slice(11)}h` : data.bucket === 'day' ? point.key.slice(8) + '/' + point.key.slice(5, 7) : point.key.slice(5) + '/' + point.key.slice(2, 4)}</span>
              </div>)}
            </div></div></div>
          </>}
        </article>
        <article className="rev-panel">
          <div className="rev-panel-heading"><div><h2>Tỷ trọng theo gia sư</h2><p>Doanh số từ gói học của từng gia sư</p></div></div>
          {!data.total ? <div className="rev-empty">Có giao dịch thành công, biểu đồ sẽ xuất hiện tại đây.</div> : <>
            <div className="rev-donut"><svg viewBox="0 0 220 220" role="img" aria-label="Biểu đồ tỷ trọng doanh số theo gia sư; số liệu chi tiết ở danh sách bên dưới">
              {chartTutors.map((t, i) => {
                const share = t.total / data.total * 100;
                const start = offset; offset += share;
                return <circle key={t.id} cx="110" cy="110" r="82" fill="none" stroke={palette[i]} strokeWidth="30" pathLength="100" strokeDasharray={`${share} ${100 - share}`} strokeDashoffset={-start} transform="rotate(-90 110 110)"><title>{t.name}: {money(t.total)} ({share.toFixed(1)}%)</title></circle>;
              })}
              <text x="110" y="105" textAnchor="middle" className="rev-donut-label">Tổng doanh số</text><text x="110" y="132" textAnchor="middle" className="rev-donut-value">{compact(data.total)} ₫</text>
            </svg></div>
            <ul className="rev-legend">{chartTutors.map((t, i) => <li key={t.id}><span className="rev-dot" style={{background: palette[i]}} /><span className="rev-legend-name" title={t.name}>{t.name}</span><strong>{(t.total / data.total * 100).toLocaleString('vi-VN', {maximumFractionDigits: 1})}%</strong><small>{money(t.total)}</small></li>)}</ul>
          </>}
        </article>
      </div>
      {!!data.tutors.length && <article className="rev-panel"><div className="rev-panel-heading"><div><h2>Chi tiết theo gia sư</h2><p>Sắp xếp theo doanh số từ cao xuống thấp</p></div></div><div className="rev-table-scroll"><table className="rev-table"><thead><tr><th>Gia sư</th><th>Giao dịch</th><th>Doanh số</th><th>Tỷ trọng</th></tr></thead><tbody>{data.tutors.map(t => <tr key={t.id}><td>{t.name}</td><td>{t.count}</td><td>{money(t.total)}</td><td>{(t.total / data.total * 100).toLocaleString('vi-VN', {maximumFractionDigits: 1})}%</td></tr>)}</tbody></table></div></article>}
      <p className="rev-footnote">Doanh số là tiền trung tâm đã thu, chưa trừ chi phí hoặc thù lao gia sư. Không bao gồm khoản đang chờ thanh toán hoặc chờ đối soát. Giao dịch sandbox là dữ liệu thử nghiệm.</p>
    </>}
  </section>;
}

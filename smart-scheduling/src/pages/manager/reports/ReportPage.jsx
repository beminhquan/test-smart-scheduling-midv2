import { useMemo, useState } from 'react';
import useReportData from './hooks/useReportData';
import ReportStatsOverview from './components/ReportStatsOverview';
import ReportChartsGrid from './components/ReportChartsGrid';
import { CATEGORIES, PERIODS, STATUS_LABEL, exportCsv } from './reportData';

const DEFAULT_FILTERS = { days: 30, category: '', status: '' };
const PAGE_SIZE = 10;
const COLS = [
  { key: 'title', label: 'Tiêu đề' },
  { key: 'category', label: 'Danh mục' },
  { key: 'priority', label: 'Ưu tiên' },
  { key: 'start', label: 'Bắt đầu' },
  { key: 'planned', label: 'Dự kiến (giờ)' },
  { key: 'actual', label: 'Thực tế (giờ)' },
  { key: 'status', label: 'Trạng thái' },
];

function TasksTable({ rows }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ key: 'start', dir: 'desc' });
  const [page, setPage] = useState(1);

  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    const f = k ? rows.filter((t) => `${t.title} ${t.category}`.toLowerCase().includes(k)) : rows;
    const d = sort.dir === 'asc' ? 1 : -1;
    return [...f].sort((a, b) => (a[sort.key] > b[sort.key] ? 1 : a[sort.key] < b[sort.key] ? -1 : 0) * d);
  }, [rows, q, sort]);

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const view = list.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);
  const toggle = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

  return (
    <section className="rp-panel">
      <div className="rp-table-head">
        <h3>Chi tiết công việc</h3>
        <input type="search" placeholder="Tìm theo tiêu đề hoặc danh mục" aria-label="Tìm công việc" value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </div>
      <div className="rp-scroll">
        <table className="rp-table">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={c.key} aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button onClick={() => toggle(c.key)}>{c.label}{sort.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((t) => (
              <tr key={t.id}>
                <td>{t.title}{t.conflict ? ' (trùng lịch)' : ''}</td>
                <td>{t.category}</td>
                <td>{t.priority}</td>
                <td>{new Date(t.start).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td>{t.planned}</td>
                <td>{t.actual || '—'}</td>
                <td><span className={`rp-status ${t.status}`}>{STATUS_LABEL[t.status]}</span></td>
              </tr>
            ))}
            {view.length === 0 && <tr><td colSpan={COLS.length} className="rp-muted">Không có công việc nào khớp từ khóa.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="rp-pager">
        <span className="rp-muted">{list.length} việc, trang {cur}/{pages}</span>
        <button className="rp-btn ghost" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>Trang trước</button>
        <button className="rp-btn ghost" disabled={cur >= pages} onClick={() => setPage(cur + 1)}>Trang sau</button>
      </div>
    </section>
  );
}

export default function ReportPage() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const { report, loading, error, reload } = useReportData(filters);
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: k === 'days' ? +e.target.value : e.target.value }));

  let body;
  if (error) {
    body = (
      <div className="rp-state" role="alert">
        <p>Không tải được dữ liệu thống kê: {error}</p>
        <button className="rp-btn" onClick={reload}>Tải lại</button>
      </div>
    );
  } else if (loading) {
    body = <div className="rp-skel" aria-busy="true" aria-label="Đang tải thống kê" />;
  } else if (!report.rows.length) {
    body = (
      <div className="rp-state">
        <p>Không có công việc nào trong khoảng này. Đổi khoảng thời gian hoặc bỏ bớt bộ lọc.</p>
        <button className="rp-btn" onClick={() => setFilters(DEFAULT_FILTERS)}>Đặt lại bộ lọc</button>
      </div>
    );
  } else {
    body = (
      <>
        <ReportStatsOverview summary={report.summary} prev={report.prev} insights={report.insights} />
        <ReportChartsGrid report={report} />
        <TasksTable rows={report.rows} />
      </>
    );
  }

  return (
    <div className="rp">
      <style>{CSS}</style>
      <header className="rp-head">
        <h1>Thống kê</h1>
        <button className="rp-btn" onClick={() => exportCsv(report.rows)} disabled={loading || !report.rows.length}>Xuất CSV</button>
      </header>
      <div className="rp-filters" role="group" aria-label="Bộ lọc thống kê">
        <label>Khoảng thời gian
          <select value={filters.days} onChange={set('days')}>
            {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>
        <label>Danh mục
          <select value={filters.category} onChange={set('category')}>
            <option value="">Tất cả</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>Trạng thái
          <select value={filters.status} onChange={set('status')}>
            <option value="">Tất cả</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <button className="rp-btn ghost" onClick={() => setFilters(DEFAULT_FILTERS)}>Đặt lại</button>
      </div>
      {body}
    </div>
  );
}

// Màu nằm ở các biến --rp-*: đổi ở đây để khớp giao diện của dự án.
const CSS = `
.rp{--ink:#1f2a2e;--mute:#5d6b6f;--panel:#fff;--line:#dfe3de;--accent:#0f766e;--warn:#b45309;--bad:#b91c1c;color:var(--ink);padding:24px;max-width:1200px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
@media (prefers-color-scheme:dark){.rp{--ink:#e6ece9;--mute:#9aa7a4;--panel:#1c2324;--line:#2c3638;--accent:#2dd4bf;--warn:#f59e0b;--bad:#f87171}}
.rp h1{margin:0;font-size:1.6rem}.rp h3{margin:0 0 8px;font-size:1rem}
.rp-muted{color:var(--mute);margin:0 0 8px;font-size:.9rem}
.rp-head{display:flex;justify-content:space-between;align-items:center;gap:12px}
.rp-filters{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end}
.rp-filters label{display:flex;flex-direction:column;gap:4px;font-size:.85rem;color:var(--mute)}
.rp select,.rp input[type=search]{padding:7px 10px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);font:inherit;min-width:140px}
.rp-btn{padding:8px 14px;border-radius:6px;border:1px solid var(--accent);background:var(--accent);color:#fff;font:inherit;cursor:pointer}
.rp-btn.ghost{background:transparent;color:var(--ink);border-color:var(--line)}
.rp-btn:disabled{opacity:.45;cursor:not-allowed}
.rp button:focus-visible,.rp select:focus-visible,.rp input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.rp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:8px;overflow:hidden}
.rp-kpi{background:var(--panel);padding:14px 16px;display:flex;flex-direction:column;gap:2px}
.rp-kpi-label{color:var(--mute);font-size:.85rem}.rp-kpi-value{font-size:1.6rem;font-weight:600}
.rp-kpi.score .rp-kpi-value{font-size:2.2rem;color:var(--accent)}
.rp-delta{font-size:.8rem;color:var(--mute)}.rp-delta.good{color:var(--accent)}.rp-delta.bad{color:var(--bad)}
.rp-panel{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px;min-width:0}
.rp-insights{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}
.rp-insights li{padding:8px 12px;border-left:3px solid var(--accent)}
.rp-insights li.warn{border-color:var(--warn)}.rp-insights li.danger{border-color:var(--bad)}
.rp-charts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.rp-panel.wide{grid-column:1/-1}
@media (max-width:760px){.rp-charts{grid-template-columns:1fr}.rp{padding:12px}}
.rp-svg{width:100%;height:auto}.rp-grid{stroke:var(--line)}.rp-tick{font-size:11px;fill:var(--mute);color:var(--mute)}
.rp-line{fill:none;stroke-width:2.5}.rp-line.main{stroke:var(--accent)}.rp-line.muted{stroke:var(--mute);stroke-dasharray:5 4;stroke-width:1.5}
.rp-dot{fill:var(--accent)}
.rp-legend-inline{display:flex;gap:16px;margin:0 0 8px;font-size:.85rem;color:var(--mute)}
.sw{display:inline-block;width:18px;height:0;border-top:2.5px solid var(--accent);margin-right:6px;vertical-align:middle}.sw.muted{border-top:2px dashed var(--mute)}
.rp-bars{display:flex;gap:8px;align-items:flex-end}.rp-bar-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px}
.rp-bar-track{height:140px;width:100%;display:flex;align-items:flex-end}.rp-bar{width:100%;background:var(--accent);border-radius:4px 4px 0 0;min-height:2px}
.rp-donut-wrap{display:flex;align-items:center;gap:16px;flex-wrap:wrap}.rp-donut{width:150px;height:150px}.rp-donut-n{font-size:14px;fill:var(--ink);font-weight:600}
.rp-legend{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;font-size:.9rem}
.rp-legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:8px}
.rp-heat{display:grid;grid-template-columns:32px repeat(12,minmax(0,1fr));gap:3px;align-items:center;text-align:center}
.rp-cell{font-style:normal;font-size:.75rem;border-radius:3px;min-height:26px;display:flex;align-items:center;justify-content:center}
.rp-table-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.rp-scroll{overflow-x:auto}.rp-table{width:100%;border-collapse:collapse;font-size:.9rem}
.rp-table th,.rp-table td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
.rp-table th button{all:unset;cursor:pointer;font-weight:600}.rp-table th button:focus-visible{outline:2px solid var(--accent)}
.rp-status.done{color:var(--accent)}.rp-status.overdue{color:var(--bad)}.rp-status.doing{color:var(--warn)}
.rp-pager{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:12px}.rp-pager .rp-muted{margin:0 auto 0 0}
.rp-state{padding:32px;text-align:center;border:1px dashed var(--line);border-radius:8px}
.rp-skel{height:320px;border-radius:8px;background:var(--line);opacity:.5}
@media (prefers-reduced-motion:no-preference){.rp-skel{animation:rp-pulse 1.2s ease-in-out infinite}@keyframes rp-pulse{50%{opacity:.25}}}
`;

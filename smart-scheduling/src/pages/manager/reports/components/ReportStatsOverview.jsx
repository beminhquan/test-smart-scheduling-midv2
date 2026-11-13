const LEVEL = { info: 'Gợi ý', warn: 'Cần chú ý', danger: 'Cần xử lý' };

function Delta({ cur, prev, goodWhenUp = true }) {
  if (!prev) return <span className="rp-delta">Kỳ trước chưa có dữ liệu</span>;
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return <span className="rp-delta">Không đổi so với kỳ trước</span>;
  const good = pct > 0 === goodWhenUp;
  return (
    <span className={`rp-delta ${good ? 'good' : 'bad'}`}>
      {pct > 0 ? '▲' : '▼'} {Math.abs(pct)}% so với kỳ trước
    </span>
  );
}

export default function ReportStatsOverview({ summary: s, prev: p, insights }) {
  const cards = [
    { label: 'Điểm hiệu quả lịch', value: s.score, cur: s.score, prev: p.score, score: true,
      tip: '40% tỷ lệ hoàn thành + 30% không quá hạn + 30% không trùng lịch (thang 0–100)' },
    { label: 'Việc đã lên lịch', value: s.total, cur: s.total, prev: p.total },
    { label: 'Tỷ lệ hoàn thành', value: `${s.rate}%`, cur: s.rate, prev: p.rate,
      tip: `${s.done} việc hoàn thành trên ${s.total} việc` },
    { label: 'Việc quá hạn', value: s.overdue, cur: s.overdue, prev: p.overdue, goodWhenUp: false },
    { label: 'Giờ thực tế / dự kiến', value: `${s.actualHours} / ${s.plannedHours}`, cur: s.actualHours, prev: p.actualHours,
      tip: 'Giờ thực tế chỉ tính các việc đã hoàn thành' },
    { label: 'Việc trùng lịch', value: s.conflicts, cur: s.conflicts, prev: p.conflicts, goodWhenUp: false },
  ];

  return (
    <>
      <div className="rp-kpis">
        {cards.map((c) => (
          <div key={c.label} className={`rp-kpi${c.score ? ' score' : ''}`} title={c.tip}>
            <div className="rp-kpi-label">{c.label}</div>
            <div className="rp-kpi-value">{c.value}</div>
            <Delta cur={c.cur} prev={c.prev} goodWhenUp={c.goodWhenUp} />
          </div>
        ))}
      </div>

      <section className="rp-panel">
        <h3>Gợi ý cải thiện lịch</h3>
        {insights.length === 0 ? (
          <p className="rp-muted">Chưa có gợi ý nào cho khoảng thời gian này.</p>
        ) : (
          <ul className="rp-insights">
            {insights.map((i, k) => (
              <li key={k} className={i.level}>
                <strong>{LEVEL[i.level]}:</strong> {i.text}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

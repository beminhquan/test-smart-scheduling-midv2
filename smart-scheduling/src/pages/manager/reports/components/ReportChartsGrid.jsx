import { Fragment } from 'react';
import { HOURS, WEEKDAYS } from '../reportData';

const COLORS = ['#0f766e', '#b45309', '#4d6b8a', '#9a3f6b', '#6b7a2f'];
const W = 560, H = 200, PAD = { l: 32, r: 12, t: 12, b: 24 };

function LineChart({ labels, total, done }) {
  const max = Math.max(1, ...total);
  const x = (i) => PAD.l + (labels.length < 2 ? 0 : (i * (W - PAD.l - PAD.r)) / (labels.length - 1));
  const y = (v) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  const path = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('');
  const every = Math.ceil(labels.length / 7);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Số việc đã lên lịch và đã hoàn thành theo thời gian" className="rp-svg">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(max * f)} y2={y(max * f)} className="rp-grid" />
          <text x={PAD.l - 6} y={y(max * f) + 4} textAnchor="end" className="rp-tick">{Math.round(max * f)}</text>
        </g>
      ))}
      <path d={path(total)} className="rp-line muted" />
      <path d={path(done)} className="rp-line main" />
      {done.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="3" className="rp-dot">
          <title>{`${labels[i]}: ${v} hoàn thành, ${total[i]} đã lên lịch`}</title>
        </circle>
      ))}
      {labels.map((l, i) => i % every === 0 && (
        <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="rp-tick">{l}</text>
      ))}
    </svg>
  );
}

function BarChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="rp-bars" role="img" aria-label="Số giờ lên lịch theo ngày trong tuần">
      {data.map((d) => (
        <div key={d.label} className="rp-bar-col" title={`${d.label}: ${d.value} giờ`}>
          <span className="rp-tick">{d.value}</span>
          <div className="rp-bar-track"><div className="rp-bar" style={{ height: `${(d.value / max) * 100}%` }} /></div>
          <span className="rp-tick">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function Donut({ data }) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const R = 40, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="rp-donut-wrap">
      <svg viewBox="0 0 100 100" className="rp-donut" role="img" aria-label="Phân bổ giờ theo danh mục">
        {data.map((d, i) => {
          const len = (d.value / total) * C;
          const el = (
            <circle key={d.name} cx="50" cy="50" r={R} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth="16"
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} transform="rotate(-90 50 50)">
              <title>{`${d.name}: ${d.value} giờ`}</title>
            </circle>
          );
          acc += len;
          return el;
        })}
        <text x="50" y="55" textAnchor="middle" className="rp-donut-n">{Math.round(total)}h</text>
      </svg>
      <ul className="rp-legend">
        {data.map((d, i) => (
          <li key={d.name}><i style={{ background: COLORS[i % COLORS.length] }} />{d.name} {Math.round((d.value / total) * 100)}%</li>
        ))}
      </ul>
    </div>
  );
}

// Bản đồ nhiệt: ô càng đậm càng nhiều việc. Số việc hiển thị ngay trong ô.
function Heatmap({ heat }) {
  const max = Math.max(1, ...heat.flat());
  return (
    <div className="rp-heat" role="img" aria-label="Số việc theo giờ và theo thứ trong tuần">
      <span />
      {HOURS.map((h) => <span key={h} className="rp-tick">{h}h</span>)}
      {heat.map((row, d) => (
        <Fragment key={d}>
          <span className="rp-tick">{WEEKDAYS[d]}</span>
          {row.map((v, h) => (
            <i key={h} className="rp-cell" title={`${WEEKDAYS[d]} ${HOURS[h]}h: ${v} việc`}
              style={{ background: `rgba(15,118,110,${v ? 0.12 + (0.88 * v) / max : 0.04})`, color: v / max > 0.5 ? '#fff' : 'inherit' }}>
              {v || ''}
            </i>
          ))}
        </Fragment>
      ))}
    </div>
  );
}

export default function ReportChartsGrid({ report }) {
  const { series, byCategory, byWeekday, heat } = report;
  return (
    <div className="rp-charts">
      <section className="rp-panel wide">
        <h3>Giờ vàng trong tuần</h3>
        <p className="rp-muted">Các ô đậm là khung giờ bạn xếp nhiều việc nhất.</p>
        <Heatmap heat={heat} />
      </section>
      <section className="rp-panel wide">
        <h3>Việc theo thời gian</h3>
        <p className="rp-legend-inline">
          <span><i className="sw main" />Đã hoàn thành</span>
          <span><i className="sw muted" />Đã lên lịch</span>
        </p>
        <LineChart {...series} />
      </section>
      <section className="rp-panel">
        <h3>Giờ lên lịch theo ngày trong tuần</h3>
        <BarChart data={byWeekday} />
      </section>
      <section className="rp-panel">
        <h3>Phân bổ theo danh mục</h3>
        <Donut data={byCategory} />
      </section>
    </div>
  );
}

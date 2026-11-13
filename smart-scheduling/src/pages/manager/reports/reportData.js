// Dữ liệu mẫu và các hàm tính số liệu cho trang thống kê.
// Khi có API thật: chỉ cần sửa hàm fetchTasks, phần còn lại giữ nguyên.

export const CATEGORIES = ['Học tập', 'Công việc', 'Cá nhân', 'Họp', 'Sức khỏe'];
export const STATUS_LABEL = { done: 'Hoàn thành', doing: 'Đang làm', todo: 'Chưa làm', overdue: 'Quá hạn' };
export const PERIODS = [
  { value: 7, label: '7 ngày' },
  { value: 30, label: '30 ngày' },
  { value: 90, label: '90 ngày' },
];
export const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7h–18h
export const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const DAY = 864e5;``

function seeded(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function buildMock() {
  const rnd = seeded(42);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  return Array.from({ length: 400 }, (_, i) => {
    const d = new Date(Date.now() - Math.floor(rnd() * 180) * DAY);
    d.setHours(7 + Math.floor(rnd() * 12), 0, 0, 0);
    const planned = pick([0.5, 1, 1.5, 2, 3]);
    const p = rnd();
    const status = p < 0.62 ? 'done' : p < 0.75 ? 'doing' : p < 0.87 ? 'todo' : 'overdue';
    return {
      id: i + 1,
      title: `Công việc ${i + 1}`,
      category: pick(CATEGORIES),
      priority: pick(['Cao', 'Trung bình', 'Thấp']),
      start: d.toISOString(),
      planned,
      actual: status === 'done' ? +(planned * (0.7 + rnd() * 0.7)).toFixed(1) : 0,
      status,
      conflict: rnd() < 0.08,
    };
  });
}
const MOCK = buildMock();

// TODO: thay bằng API thật, ví dụ: const res = await fetch('/api/tasks'); return res.json();
// Mỗi phần tử cần có: id, title, category, priority, start (ISO), planned, actual, status, conflict.
export async function fetchTasks() {
  await new Promise((r) => setTimeout(r, 400));
  return MOCK;
}

const sum = (list, key) => list.reduce((a, t) => a + (t[key] || 0), 0);
const round = (n) => Math.round(n * 10) / 10;
const weekday = (t) => (new Date(t.start).getDay() + 6) % 7;

// offset 0 = kỳ hiện tại, 1 = kỳ liền trước (dùng để so sánh)
function inRange(tasks, days, offset, { category, status }) {
  const end = Date.now() - offset * days * DAY;
  const start = end - days * DAY;
  return tasks.filter((t) => {
    const ts = +new Date(t.start);
    return ts >= start && ts < end && (!category || t.category === category) && (!status || t.status === status);
  });
}

// Điểm hiệu quả = 40% tỷ lệ hoàn thành + 30% tỷ lệ không quá hạn + 30% tỷ lệ không trùng lịch
export function summarize(list) {
  const total = list.length;
  const done = list.filter((t) => t.status === 'done');
  const overdue = list.filter((t) => t.status === 'overdue').length;
  const conflicts = list.filter((t) => t.conflict).length;
  const rate = total ? done.length / total : 0;
  const score = total
    ? Math.round(100 * (0.4 * rate + 0.3 * (1 - overdue / total) + 0.3 * (1 - conflicts / total)))
    : 0;
  const plannedDone = sum(done, 'planned');
  return {
    total,
    done: done.length,
    rate: round(rate * 100),
    overdue,
    conflicts,
    score,
    plannedHours: round(sum(list, 'planned')),
    actualHours: round(sum(done, 'actual')),
    // độ lệch = (thực tế - dự kiến) / dự kiến, chỉ tính các việc đã hoàn thành
    deviation: plannedDone ? round(((sum(done, 'actual') - plannedDone) / plannedDone) * 100) : 0,
  };
}

function timeSeries(list, days) {
  const step = days > 31 ? 7 : 1; // theo ngày, hoặc theo tuần với kỳ dài
  const n = Math.ceil(days / step);
  const start = Date.now() - days * DAY;
  const total = Array(n).fill(0);
  const done = Array(n).fill(0);
  list.forEach((t) => {
    const i = Math.min(n - 1, Math.floor((+new Date(t.start) - start) / (step * DAY)));
    total[i]++;
    if (t.status === 'done') done[i]++;
  });
  const labels = total.map((_, i) => {
    const d = new Date(start + i * step * DAY);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  });
  return { labels, total, done };
}

// Gợi ý theo luật đơn giản; muốn thêm luật mới chỉ cần thêm một dòng push.
function makeInsights(s, doneByHour, byWeekday) {
  const out = [];
  if (!s.total) return out;
  if (s.conflicts) out.push({ level: 'danger', text: `Có ${s.conflicts} việc bị trùng lịch. Mở lịch để dời hoặc gộp các việc này.` });
  if (s.rate < 50) out.push({ level: 'warn', text: `Tỷ lệ hoàn thành chỉ ${s.rate}%. Thử giảm số việc mỗi ngày hoặc chia nhỏ việc lớn.` });
  if (s.overdue / s.total > 0.1) out.push({ level: 'warn', text: `${s.overdue} việc đã quá hạn. Hãy xếp lại lịch cho các việc này.` });
  if (s.deviation > 20) out.push({ level: 'warn', text: `Thời gian thực tế vượt dự kiến ${s.deviation}%. Hãy tăng thời lượng dự kiến ở lần lên lịch sau.` });
  const best = Math.max(...doneByHour);
  if (best > 0) out.push({ level: 'info', text: `Bạn hoàn thành nhiều việc nhất lúc ${HOURS[doneByHour.indexOf(best)]}h. Hãy xếp việc quan trọng vào khung giờ này.` });
  const heavy = [...byWeekday].sort((a, b) => b.value - a.value)[0];
  if (heavy && heavy.value > 0) out.push({ level: 'info', text: `${heavy.label} là ngày nặng nhất (${heavy.value} giờ). Cân nhắc chuyển bớt việc sang ngày nhẹ hơn.` });
  return out;
}

export function buildReport(tasks, filters) {
  const rows = inRange(tasks, filters.days, 0, filters);
  const summary = summarize(rows);
  const byCategory = CATEGORIES.map((name) => ({
    name,
    value: round(sum(rows.filter((t) => t.category === name), 'planned')),
  })).filter((c) => c.value > 0);
  const byWeekday = WEEKDAYS.map((label, i) => ({
    label,
    value: round(sum(rows.filter((t) => weekday(t) === i), 'planned')),
  }));
  const heat = WEEKDAYS.map(() => HOURS.map(() => 0));
  const doneByHour = HOURS.map(() => 0);
  rows.forEach((t) => {
    const h = new Date(t.start).getHours() - HOURS[0];
    if (h < 0 || h >= HOURS.length) return;
    heat[weekday(t)][h]++;
    if (t.status === 'done') doneByHour[h]++;
  });
  return {
    rows,
    summary,
    prev: summarize(inRange(tasks, filters.days, 1, filters)),
    series: timeSeries(rows, filters.days),
    byCategory,
    byWeekday,
    heat,
    insights: makeInsights(summary, doneByHour, byWeekday),
  };
}

// Xuất CSV có BOM để Excel đọc đúng tiếng Việt
export function exportCsv(rows) {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const head = ['ID', 'Tiêu đề', 'Danh mục', 'Ưu tiên', 'Bắt đầu', 'Dự kiến (giờ)', 'Thực tế (giờ)', 'Trạng thái'];
  const lines = rows.map((t) =>
    [t.id, t.title, t.category, t.priority, new Date(t.start).toLocaleString('vi-VN'), t.planned, t.actual, STATUS_LABEL[t.status]]
      .map(esc)
      .join(',')
  );
  const blob = new Blob(['\uFEFF' + [head.map(esc).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `thong-ke-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

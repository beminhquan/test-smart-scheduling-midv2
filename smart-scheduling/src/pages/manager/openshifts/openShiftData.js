import { MAX_NEEDED, ROLES, addDaysISO, dayLabel, parseISO, toISO, fmtDate } from "../../../services/openShiftService.js";

// Nhãn hiển thị, màu và vài hàm dựng dữ liệu cho trang Ca trực mở.
// Màu: mỗi trạng thái đúng một màu, dùng chung cho huy hiệu trên bảng và trong hộp thoại.

export const STATUS = {
  open: { label: "Đang mở", hex: "#f59e0b" },
  filled: { label: "Đã đủ người", hex: "#10b981" },
  closed: { label: "Đã đóng", hex: "#94a3b8" },
  cancelled: { label: "Đã hủy", hex: "#f43f5e" },
};

export const REG_STATUS = {
  pending: { label: "Chờ duyệt", hex: "#f59e0b" },
  approved: { label: "Đã duyệt", hex: "#10b981" },
  rejected: { label: "Đã từ chối", hex: "#f43f5e" },
  claimed: { label: "Đã nhận ca", hex: "#10b981" },
};

export const TABS = [["all", "Tất cả"], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])];
export const PAGE_SIZES = [7, 10, 20];

// Thứ tự trong bảng: ca còn việc (mở, đã đủ) trước, lịch sử sau; cùng nhóm thì ngày gần nhất trước
const ORDER = { open: 0, filled: 1, closed: 2, cancelled: 3 };
export const compareShifts = (a, b, statusOf) =>
  ORDER[statusOf(a)] - ORDER[statusOf(b)] || `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`);

/**
 * Tìm ngày Thứ Hai của tuần chứa một ngày bất kỳ (ISO: YYYY-MM-DD)
 */
export function getMondayOf(isoDate) {
  if (!isoDate) return "2026-11-02";
  const d = parseISO(isoDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return toISO(d);
}

/**
 * Lấy danh sách 7 ngày trong tuần (từ Thứ Hai đến Chủ Nhật)
 */
export function getWeekDays(weekMonday) {
  const base = weekMonday || "2026-11-02";
  return Array.from({ length: 7 }, (_, i) => addDaysISO(base, i));
}

/**
 * Tạo nhãn hiển thị tuần: Ví dụ "Tuần 02/11/2026 – 08/11/2026"
 */
export function getWeekLabel(weekMonday) {
  const base = weekMonday || "2026-11-02";
  const sunday = addDaysISO(base, 6);
  return `Tuần ${fmtDate(base)} – ${fmtDate(sunday)}`;
}

/**
 * GIỚI HẠN NGÀY TẠO CA TRỰC MỞ THEO TUẦN (Thứ Hai đến Chủ Nhật)
 * Chỉ hiển thị đúng 7 ngày trong tuần được chọn.
 * `weekMonday` = Ngày thứ Hai của tuần đang thao tác (ví dụ 2026-11-02).
 */
export function dayOptions(weekMonday, keep) {
  const base = weekMonday || (keep ? getMondayOf(keep) : "2026-11-02");
  const days = getWeekDays(base);
  if (keep && !days.includes(keep)) {
    days.unshift(keep);
  }
  return days.map((value) => ({ value, label: dayLabel(value) }));
}

// Trang Tạo lịch chuyển sang kèm ca đang thiếu người -> điền sẵn vào form mở ca.
export function prefillFromSchedule(raw, catalog, weekMonday) {
  const options = dayOptions(weekMonday);
  const text = [raw.day?.fullDate, raw.dayName, raw.day].filter((v) => typeof v === "string").join(" ");
  const m = text.match(/(\d{1,2})\/(\d{1,2})/);
  const date = (m && options.find((o) => o.value.endsWith(`-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`))?.value) || options[0].value;

  const hay = `${raw.shiftName ?? ""} ${raw.demand?.name ?? ""} ${raw.time ?? ""}`.toLowerCase();
  const shift = catalog.find((s) => hay.includes(s.name.toLowerCase()) || hay.includes(`${s.startTime.slice(0, 2)}:`)) ?? catalog[0];

  return {
    date,
    shiftCode: shift?.code ?? "",
    role: raw.pcMissing > 0 ? "Pha chế" : raw.pvMissing > 0 ? "Phục vụ" : ROLES[0],
    needed: Math.min(MAX_NEEDED, Math.max(1, raw.totalMissing || raw.missing || 1)),
    bonus: 0,
    note: "",
  };
}

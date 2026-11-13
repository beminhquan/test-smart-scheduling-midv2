// =============================================================================
// File: src/services/availabilityService.js
// Tầng: Dịch vụ đăng ký và tổng hợp khả năng làm việc (US08, US09)
// Kết nối trực tiếp Laravel Backend & MySQL
// =============================================================================

import httpClient from "./httpClient.js";
import { addDays, toISO, toVN, startOfDay, getNow, mondayOf } from "../lib/dateUtils.js";

export { addDays, toISO, toVN };

// Hệ thống phát sự kiện cục bộ để đồng bộ tức thì các tab
const listeners = new Set();

export function notifyAvailabilityChange() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  });
}

export function subscribeAvailability(cb) {
  if (typeof cb === "function") {
    listeners.add(cb);
  }
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Tính toán deadline đăng ký cho một tuần (Thứ Sáu trước tuần đó lúc 23:59:59)
 */
export function calculateDeadline(weekMondayIso) {
  if (!weekMondayIso) return new Date();
  const [y, m, d] = weekMondayIso.split("-").map(Number);
  const monday = new Date(y, m - 1, d);
  const deadline = addDays(monday, -3); // Thứ Sáu trước tuần áp dụng
  deadline.setHours(23, 59, 59, 999);
  return deadline;
}

/**
 * 1. [Staff] Lấy thông tin đăng ký lịch rảnh của nhân viên cho một tuần (US08 - Staff)
 * Endpoint: GET /api/availability/my?weekMonday=YYYY-MM-DD
 */
export async function getMyAvailability(params = {}) {
  const { weekMonday } = params;
  const res = await httpClient.get("/availability/my", {
    params: weekMonday ? { weekMonday } : {},
  });
  const data = res.data?.data || res.data;
  return data;
}

/**
 * 2. [Staff] Lưu đăng ký lịch rảnh của nhân viên cho một tuần (US08 - Staff)
 * Endpoint: POST /api/availability/my
 */
export async function saveMyAvailability(payload = {}) {
  const { weekMonday, slots, expectedVersion } = payload;
  const res = await httpClient.post("/availability/my", {
    weekMonday,
    slots,
    expectedVersion,
  });

  // Thông báo đồng bộ đến các màn hình Manager / Staff đang mở
  notifyAvailabilityChange();

  return {
    ok: true,
    data: res.data?.data || res.data,
    ...(res.data?.data || res.data),
  };
}

/**
 * 3. [Manager] Lấy tổng hợp khả năng làm việc của toàn bộ nhân viên theo tuần cho Manager (US09)
 * Endpoint: GET /api/availability/weekly?weekMonday=YYYY-MM-DD
 */
export async function getWeeklyStaffAvailability(weekMondayIso) {
  const res = await httpClient.get("/availability/weekly", {
    params: weekMondayIso ? { weekMonday: weekMondayIso } : {},
  });
  return res.data?.data || res.data;
}

/**
 * Đếm số ca rảnh, bận và chưa chọn từ dữ liệu slots
 */
export function countAvailabilitySlots(slots = {}, totalSlots = 21) {
  const values = Object.values(slots || {});
  const available = values.filter((v) => v === "available").length;
  const busy = values.filter((v) => v === "busy").length;
  const unselected = Math.max(0, totalSlots - available - busy);
  return {
    available,
    busy,
    unselected,
  };
}

/**
 * Kiểm tra khả dụng của nhân viên
 */
export function isEmployeeAvailable(emp, dayIndex, shiftName) {
  if (!emp || !emp.registered || !emp.slots) return false;
  return emp.slots[`${dayIndex}_${shiftName}`] === "available";
}

export default {
  getMyAvailability,
  saveMyAvailability,
  getWeeklyStaffAvailability,
  subscribeAvailability,
  notifyAvailabilityChange,
  calculateDeadline,
  isEmployeeAvailable,
  countAvailabilitySlots,
};

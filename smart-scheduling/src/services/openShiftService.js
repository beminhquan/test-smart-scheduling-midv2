// =============================================================================
// File: src/services/openShiftService.js
// Tầng: Service - Nghiệp vụ và tương tác dữ liệu Ca trực mở (US18, US19)
// =============================================================================

import {
  ROLES,
  MAX_NEEDED,
  MAX_NOTE,
  dayLabel,
  startOf,
  statusOf,
  weekdayOf,
  fmtDate,
  getCancelRule,
  getEditRule,
  validateOpenShift,
  validateClaim,
  isEligible,
  isClaimedBy,
  toISO,
  parseISO,
  todayISO,
  addDaysISO,
  getSavedOpenShifts,
  saveOpenShifts,
} from "../mocks/openShiftMock.js";
import { getCurrentUser } from "./authService.js";
import { getEmployeeById } from "./employeeService.js";
import { getMySchedule } from "./scheduleService.js";
import httpClient from "./httpClient.js";
import { createNotification } from "./notificationService.js";

export {
  ROLES,
  MAX_NEEDED,
  MAX_NOTE,
  dayLabel,
  startOf,
  statusOf,
  weekdayOf,
  fmtDate,
  getCancelRule,
  getEditRule,
  validateOpenShift,
  validateClaim,
  isEligible,
  isClaimedBy,
  toISO,
  parseISO,
  todayISO,
  addDaysISO,
  getSavedOpenShifts,
  saveOpenShifts,
};

const businessError = (message) => Object.assign(new Error(message), { business: true });

function find(list, id) {
  const s = list.find((x) => x.id === id);
  if (!s) throw businessError("Không tìm thấy ca trực mở, vui lòng tải lại danh sách.");
  return s;
}

const commit = (list, shift) => {
  const next = { ...shift, version: (shift.version ?? 1) + 1 };
  saveOpenShifts(list.map((s) => (s.id === next.id ? next : s)));
  return next;
};

/**
 * Trích xuất mảng danh sách từ Response của Axios (xử lý cả dạng mảng trực tiếp và dạng bọc trong data)
 */
function extractShiftList(res) {
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.shifts)) return res.data.shifts;
  return null;
}

/**
 * Lấy danh sách ca trực mở (Manager & Staff)
 */
export const getOpenShifts = async (params) => {
  try {
    const res = await httpClient.get("/open-shifts", { params });
    const list = extractShiftList(res);
    if (list !== null) {
      return list;
    }
  } catch (err) {
    console.warn("getOpenShifts API fallback to local:", err?.message);
  }

  let list = getSavedOpenShifts();
  if (params?.status === "open") {
    list = list.filter((s) => !s.cancelled && (s.claims?.length || 0) < s.needed);
  } else if (params?.status === "filled") {
    list = list.filter((s) => (s.claims?.length || 0) >= s.needed);
  }
  return list;
};

/**
 * Lấy danh sách nguồn mở ca (Ca thiếu từ lịch tự động, ca thay thế nhân viên nghỉ)
 */
export async function getOpenShiftSources(params = {}) {
  try {
    const res = await httpClient.get("/open-shifts/sources", { params });
    return res.data?.data || { deficient_shifts: [], leave_replacements: [] };
  } catch (err) {
    console.warn("getOpenShiftSources error:", err?.message);
    return { deficient_shifts: [], leave_replacements: [] };
  }
}

/**
 * Manager tạo ca trực mở mới
 */
export async function createOpenShift(p) {
  const u = getCurrentUser();
  if (u && u.role !== "manager") {
    throw businessError("Chỉ Quản lý mới có quyền tạo ca trực mở.");
  }

  try {
    const res = await httpClient.post("/open-shifts", p);
    const created = res?.data?.data || res?.data?.shift || (res?.data?.id ? res.data : null);
    if (created) {
      createNotification({
        title: "Ca trực mở mới",
        content: `Ca ${p.shiftName || ""} ngày ${fmtDate(p.date)} cần ${p.needed} nhân viên (${p.role || ""}).`,
        type: "open_shift",
        link: "/employee/open-shifts",
        recipientRole: "staff",
      });
      notifyOpenShiftChange();
      return created;
    }
  } catch (err) {
    if (err.response?.data?.message) {
      throw businessError(err.response.data.message);
    }
    throw businessError(err.message || "Không thể tạo ca trực mở.");
  }

  const list = getSavedOpenShifts();
  const err = validateOpenShift(p, list);
  if (err) throw businessError(err);

  const n = Math.max(0, ...list.map((s) => Number(s.id?.replace(/\D/g, "") || 0))) + 1;
  const shift = {
    ...p,
    id: `OS${String(n).padStart(3, "0")}`,
    needed: Number(p.needed),
    bonus: Number(p.bonus) || 0,
    note: (p.note ?? "").trim(),
    cancelled: false,
    version: 1,
    claims: [],
  };
  saveOpenShifts([shift, ...list]);
  notifyOpenShiftChange();
  return shift;
}

/**
 * Manager sửa ca trực mở
 */
export async function updateOpenShift(p) {
  const u = getCurrentUser();
  if (u && u.role !== "manager") {
    throw businessError("Chỉ Quản lý mới có quyền chỉnh sửa ca trực mở.");
  }

  try {
    const rawId = p.raw_id || p.id;
    const res = await httpClient.put(`/open-shifts/${rawId}`, p);
    const updated = res?.data?.data || res?.data?.shift || (res?.data?.id ? res.data : null);
    if (updated) {
      notifyOpenShiftChange();
      return updated;
    }
  } catch (err) {
    if (err.response?.data?.message) {
      throw businessError(err.response.data.message);
    }
    throw businessError(err.message || "Không thể chỉnh sửa ca trực mở.");
  }

  const list = getSavedOpenShifts();
  const s = find(list, p.id);
  const rule = getEditRule(s);
  if (!rule.allowed) throw businessError(rule.reason);
  if (rule.locked && (p.date !== s.date || p.shiftCode !== s.shiftCode || p.role !== s.role || Number(p.bonus) !== s.bonus))
    throw businessError(rule.reason);
  const err = validateOpenShift(p, list);
  if (err) throw businessError(err);
  const saved = commit(list, { ...s, ...p, needed: Number(p.needed), bonus: Number(p.bonus) || 0, note: (p.note ?? "").trim() });
  notifyOpenShiftChange();
  return saved;
}

/**
 * Manager hủy ca trực mở
 */
export async function cancelOpenShift(id) {
  const u = getCurrentUser();
  if (u && u.role !== "manager") {
    throw businessError("Chỉ Quản lý mới có quyền hủy ca trực mở.");
  }

  try {
    const res = await httpClient.post(`/open-shifts/${id}/cancel`);
    notifyOpenShiftChange();
    return res.data;
  } catch (err) {
    if (err.response?.data?.message) {
      throw businessError(err.response.data.message);
    }
    throw businessError(err.message || "Không thể hủy ca trực mở.");
  }
}

/**
 * Manager xác nhận nhân viên nhận ca và cập nhật lịch thực tế
 */
export async function approveOpenShiftClaim(shiftId, registrationId) {
  const rawShiftId = String(shiftId).replace(/\D/g, "");
  const regId = Number(registrationId);

  try {
    const res = await httpClient.post(`/open-shifts/${rawShiftId}/approve`, {
      registration_id: regId,
    });

    createNotification({
      title: "Ca trực mở đã được duyệt",
      content: `Quản lý đã xác nhận bạn nhận ca trực mở. Ca làm việc đã được cập nhật vào lịch làm việc của bạn.`,
      type: "open_shift",
      link: "/employee/open-shifts",
      recipientRole: "staff",
    });

    notifyOpenShiftChange();
    return res.data;
  } catch (err) {
    const errorMsg = err.response?.data?.message || err.message;
    throw businessError(errorMsg);
  }
}

/**
 * Manager từ chối nhân viên nhận ca
 */
export async function rejectOpenShiftClaim(shiftId, registrationId, reason = "") {
  const rawShiftId = String(shiftId).replace(/\D/g, "");
  const regId = Number(registrationId);

  try {
    const res = await httpClient.post(`/open-shifts/${rawShiftId}/reject`, {
      registration_id: regId,
      reason: reason || "Quản lý từ chối yêu cầu nhận ca.",
    });

    createNotification({
      title: "Yêu cầu nhận ca trực mở bị từ chối",
      content: `Yêu cầu nhận ca trực mở của bạn đã bị từ chối${reason ? `: ${reason}` : "."}`,
      type: "open_shift",
      link: "/employee/open-shifts",
      recipientRole: "staff",
    });

    notifyOpenShiftChange();
    return res.data;
  } catch (err) {
    const errorMsg = err.response?.data?.message || err.message;
    throw businessError(errorMsg);
  }
}

export const acceptOpenShift = (id, data, expectedVersion) =>
  claimOpenShift(id, data, expectedVersion);

/**
 * Kiểm tra tính hợp lệ nhận ca (Fallback client-side)
 */
export async function checkOpenShiftEligibility(shift, empId) {
  if (!shift) return { eligible: false, reason: "Không tìm thấy ca trực mở." };
  if (shift.cancelled) return { eligible: false, reason: "Ca này đã bị hủy." };
  if ((shift.claims?.length || 0) >= shift.needed) return { eligible: false, reason: "Ca này đã đủ người đăng ký." };

  const emp = await getEmployeeById(empId);
  if (!emp) return { eligible: false, reason: "Không tìm thấy thông tin nhân viên." };
  const empRoles = emp.roles || [emp.role || "Phục vụ"];

  if (shift.role && !empRoles.includes(shift.role)) {
    return { eligible: false, reason: `Vai trò của bạn (${empRoles.join(", ")}) không phù hợp với ca này (${shift.role}).` };
  }

  const mySchedule = await getMySchedule({ employeeId: empId, currentUserId: empId });
  const myShifts = mySchedule?.myShifts || [];

  // QUY TẮC BẮT BUỘC: Nhân viên phải hoàn toàn trống lịch trong toàn bộ ngày đó
  const hasShiftInDay = myShifts.some((m) => m.date === shift.date);
  if (hasShiftInDay) {
    return { eligible: false, reason: "Bạn đã có lịch làm việc trong ngày này nên không thể đăng ký thêm ca trực mở." };
  }

  return { eligible: true, reason: null };
}

/**
 * Lấy danh sách ca trực mở phù hợp cho nhân viên (US19)
 */
export async function getOpenShiftsForEmployee(empId) {
  try {
    const res = await httpClient.get("/employees/open-shifts");
    const list = extractShiftList(res);
    if (list !== null) {
      return list;
    }
  } catch (err) {
    console.warn("getOpenShiftsForEmployee API fallback to local:", err?.message);
  }

  const openList = getSavedOpenShifts().filter((s) => !s.cancelled && (s.claims?.length || 0) < s.needed);
  const results = [];
  for (const s of openList) {
    const check = await checkOpenShiftEligibility(s, empId);
    if (check.eligible) {
      results.push(s);
    }
  }
  return results;
}

/**
 * Staff đăng ký nhận ca trực mở
 */
export async function claimOpenShift(shiftId, employee, expectedVersion) {
  let actualShiftId = shiftId;
  let actualEmployee = employee;

  if (typeof shiftId === "object" && shiftId !== null) {
    actualShiftId = shiftId.shiftId || shiftId.id;
    actualEmployee = shiftId.employee || {
      employeeId: shiftId.employeeId || shiftId.id,
      name: shiftId.name,
      phone: shiftId.phone,
      roles: shiftId.roles || shiftId.roleTags,
    };
  }

  const rawShiftId = String(actualShiftId).replace(/\D/g, "");

  try {
    const res = await httpClient.post(`/employees/open-shifts/${rawShiftId}/claim`, {
      employee_id: actualEmployee?.employeeId || actualEmployee?.id,
      note: actualEmployee?.note || "",
    });

    createNotification({
      title: "Đăng ký ca trực mở mới",
      content: `Nhân viên ${actualEmployee?.name || actualEmployee?.employeeId || "Nhân viên"} đã đăng ký nhận ca trực mở #${rawShiftId}.`,
      type: "open_shift",
      link: "/manager/open-shifts",
      recipientRole: "manager",
    });

    notifyOpenShiftChange();

    return {
      ok: true,
      shift: res.data?.shift,
      data: res.data?.data,
      filled: res.data?.shift?.claims?.length >= res.data?.shift?.needed,
      bonus: res.data?.shift?.bonus,
    };
  } catch (err) {
    const errorMsg = err.response?.data?.message || err.message;
    throw businessError(errorMsg);
  }
}

export const subscribeOpenShift = (cb) => {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb && cb();
  window.addEventListener("storage", handler);
  window.addEventListener("openshift-change", handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("openshift-change", handler);
  };
};

export const notifyOpenShiftChange = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("openshift-change"));
  }
};

export default {
  ROLES,
  MAX_NEEDED,
  MAX_NOTE,
  dayLabel,
  statusOf,
  weekdayOf,
  fmtDate,
  getCancelRule,
  getEditRule,
  validateOpenShift,
  validateClaim,
  isEligible,
  isClaimedBy,
  toISO,
  parseISO,
  todayISO,
  addDaysISO,
  getOpenShifts,
  getOpenShiftSources,
  createOpenShift,
  updateOpenShift,
  cancelOpenShift,
  acceptOpenShift,
  claimOpenShift,
  approveOpenShiftClaim,
  rejectOpenShiftClaim,
  getOpenShiftsForEmployee,
  subscribeOpenShift,
  notifyOpenShiftChange,
};

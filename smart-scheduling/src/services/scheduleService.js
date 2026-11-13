// =============================================================================
// File: src/services/scheduleService.js
// Tầng: Dịch vụ dữ liệu (Service / Schedule)
// Nghiệp vụ: Lịch làm việc tuần (Manager - US11, US12) & Xem lịch cá nhân (Staff - US13)
// =============================================================================

import {
  employeeRoster,
  getEmployeeById,
  getWeekDays,
  getCurrentWeekLabel,
  initialDays,
  initialShiftDemands,
  initialConstraints,
  DAILY_SHIFT_REQUIREMENTS,
  generateInitialSchedules,
  getSavedSchedules,
  saveSchedules,
  confirmSchedule,
  isScheduleConfirmed,
  getFutureShiftsForEmployee,
  freeFutureShiftsForEmployee,
  restoreEmployeeShiftInSchedule,
  getShiftInfo,
  roleBadgeClass,
  mergeConfigConstraints,
  mergeConfigShifts,
  WEEK_LABEL,
} from "../mocks/scheduleMock.js";
import { getLeaveRequests } from "../mocks/leaveMock.js";
import { getOpenShifts } from "./openShiftService.js";
import { WEEKLY_PATTERN } from "../mocks/workHoursMock.js";
import { mondayOf, addDays, toISO, toVN, startOfDay, getNow } from "../lib/dateUtils.js";
import { calculateScheduleStats } from "../lib/shiftColors.js";
import { getCurrentUser } from "./authService.js";
import httpClient from "./httpClient.js";

/**
 * Lấy cấu hình đầu vào tạo lịch tự động từ Backend Laravel/MySQL:
 * - 11 ràng buộc chuẩn với trạng thái thực tế
 * - Ca mẫu hoạt động
 * - Vai trò RoleTag
 * - Cấu hình nhu cầu nhân sự của tuần
 */
export async function getScheduleInputConfig(weekMonday) {
  try {
    const res = await httpClient.get("/schedule/input-config", {
      params: weekMonday ? { weekMonday } : {},
    });
    return res.data;
  } catch (err) {
    console.warn("Lỗi tải cấu hình đầu vào từ Backend, sử dụng dự phòng:", err);
    return null;
  }
}

/**
 * Lấy nhu cầu nhân sự của tuần cụ thể từ MySQL
 */
export async function getScheduleDemand(weekMonday) {
  try {
    const res = await httpClient.get("/schedule/demand", {
      params: weekMonday ? { weekMonday } : {},
    });
    return res.data;
  } catch (err) {
    console.warn("Lỗi tải nhu cầu nhân sự tuần từ Backend:", err);
    return null;
  }
}

/**
 * Lưu cấu hình nhu cầu nhân sự tuần vào Backend (MySQL table nhu_cau_cas & rang_buoc)
 */
export async function saveScheduleDemand(payload) {
  const res = await httpClient.post("/schedule/demand", payload);
  return res.data;
}

/**
 * Tự động tạo lịch làm việc tuần bằng Python OR-Tools solver qua Laravel Backend
 */
export async function generateScheduleORTools(weekMonday) {
  const res = await httpClient.post("/schedule/auto-generate", { weekMonday });
  return res.data;
}

/**
 * Lấy lịch làm việc đã lưu của tuần từ Backend MySQL
 */
export async function getWeeklySchedule(weekMonday) {
  try {
    const res = await httpClient.get("/schedule/weekly", {
      params: weekMonday ? { weekMonday } : {},
    });
    return res.data;
  } catch (err) {
    console.warn("Lỗi tải lịch làm việc tuần từ Backend:", err);
    return null;
  }
}

/**
 * Xác nhận công bố lịch tuần chính thức (CONFIRMED)
 */
export async function confirmWeeklySchedule(weekMonday) {
  const res = await httpClient.post("/schedule/confirm", { weekMonday });
  return res.data;
}


export {
  calculateScheduleStats,
  employeeRoster,
  getEmployeeById,
  getWeekDays,
  getCurrentWeekLabel,
  initialDays,
  initialShiftDemands,
  initialConstraints,
  DAILY_SHIFT_REQUIREMENTS,
  generateInitialSchedules,
  getSavedSchedules,
  saveSchedules,
  confirmSchedule,
  isScheduleConfirmed,
  getFutureShiftsForEmployee,
  freeFutureShiftsForEmployee,
  restoreEmployeeShiftInSchedule,
  getShiftInfo,
  roleBadgeClass,
  mergeConfigConstraints,
  mergeConfigShifts,
  WEEK_LABEL,
  WEEKLY_PATTERN,
  mondayOf,
  addDays,
  toISO,
  toVN,
  getNow,
};

const delay = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));

/** Lấy toàn bộ dữ liệu bảng lịch làm việc tuần (Manager) */
export async function getScheduleBoard(weekKey) {
  await delay(100);
  const schedules = getSavedSchedules();
  return {
    weekKey: weekKey || WEEK_LABEL,
    schedules,
    employees: employeeRoster,
    days: initialDays,
    demands: initialShiftDemands,
    constraints: initialConstraints,
  };
}

/** Lưu bản nháp lịch làm việc tuần */
export async function saveScheduleDraft(schedules, weekMonday = null) {
  // BACKEND: Lưu bản nháp lịch phân ca tuần vào bảng schedules với status = DRAFT
  const u = getCurrentUser();
  if (u && u.role !== "manager") {
    throw new Error("Chỉ Quản lý mới có quyền lưu bản nháp lịch làm việc.");
  }
  await delay(100);
  saveSchedules(schedules, weekMonday);
  return { ok: true, schedules };
}

/** Công bố lịch làm việc chính thức (Official) */
export async function publishSchedule(schedules, weekMonday = null) {
  const u = getCurrentUser();
  if (u && u.role !== "manager") {
    throw new Error("Chỉ Quản lý mới có quyền công bố lịch làm việc.");
  }
  const targetMonday = weekMonday || mondayOf(getNow());
  const targetMondayIso = typeof targetMonday === "string" ? targetMonday : toISO(targetMonday);
  try {
    await confirmWeeklySchedule(targetMondayIso);
  } catch (err) {
    console.warn("Lỗi gọi confirmWeeklySchedule lên Backend:", err);
  }
  confirmSchedule(schedules, targetMondayIso);
  return { ok: true, status: "CONFIRMED", schedules };
}

/** Lắng nghe thay đổi dữ liệu lịch làm việc (No-op sau khi gỡ db.js) */
export const subscribeSchedule = () => () => {};

// ---------- API giả lập tương thích ----------
export const generateSchedule = async () => {
  // BACKEND: Chạy thuật toán lập lịch tối ưu (Constraint Programming / OR-Tools) trên máy chủ
  await delay(200);
  return { ok: true, schedules: getSavedSchedules() };
};



export const getSchedule = async (params) => {
  return getScheduleBoard(params?.weekMonday);
};

export const updateShift = async (id, data) => {
  // BACKEND: Cập nhật phân công ca trong bảng schedules
  return { id, ...data };
};

export const applySchedule = async (data) => {
  // BACKEND: Áp dụng lịch tự động vào lịch tuần
  return { ok: true, ...data };
};

/**
 * Chuyển đổi một ca làm việc thành định dạng Event chuẩn của FullCalendar
 */
export function shiftToCalendarEvent(shift) {
  const [sh, sm] = (shift.startTime || "06:00").split(":");
  const [eh, em] = (shift.endTime || "12:00").split(":");
  const start = `${shift.date}T${sh.padStart(2, "0")}:${sm.padStart(2, "0")}:00`;
  const end = `${shift.date}T${eh.padStart(2, "0")}:${em.padStart(2, "0")}:00`;

  return {
    id: shift.id,
    title: `Ca ${shift.shiftName}: ${shift.startTime} – ${shift.endTime}`,
    start,
    end,
    backgroundColor: "transparent",
    borderColor: "transparent",
    extendedProps: {
      ...shift,
      isLeave: false,
    },
  };
}

/**
 * Chuyển đổi một đơn nghỉ phép đã duyệt thành Event của FullCalendar
 */
export function leaveToCalendarEvent(leave) {
  return [
    {
      id: `leave_bg_${leave.id}`,
      title: "Nghỉ phép",
      start: leave.isoDate,
      allDay: true,
      display: "background",
      backgroundColor: "#F5F3FF",
      extendedProps: {
        isLeave: true,
        isBackground: true,
        ...leave,
      },
    },
    {
      id: `leave_item_${leave.id}`,
      title: "🏖️ Nghỉ phép",
      start: leave.isoDate,
      allDay: true,
      backgroundColor: "#EDE9FE",
      borderColor: "#DDD6FE",
      textColor: "#6B21A8",
      extendedProps: {
        isLeave: true,
        ...leave,
      },
    },
  ];
}

/**
 * Lấy lịch làm việc của nhân viên đăng nhập (US13 - Staff)
 * Kết nối API Backend thực tế /api/staff/schedule/my (LichNhanVienController), tự động xác định nhân viên qua token
 */
export async function getMySchedule({ week_start } = {}) {
  const now = getNow();
  const currentMonday = mondayOf(startOfDay(now));
  const currentMondayIso = toISO(currentMonday);
  const targetMondayIso = week_start || currentMondayIso;
  const todayIso = toISO(now);

  try {
    const res = await httpClient.get("/staff/schedule/my", {
      params: { weekMonday: targetMondayIso },
    });

    if (res.data && res.data.status) {
      const data = res.data;
      const myShifts = Array.isArray(data.myShifts) ? data.myShifts : [];
      const approvedLeaves = Array.isArray(data.approvedLeaves) ? data.approvedLeaves : [];
      const approvedLeaveDates = approvedLeaves.map((l) => l.isoDate || l.date);

      // Chuyển đổi thành Calendar Events cho FullCalendar
      const calendarEvents = [];
      myShifts.forEach((s) => {
        calendarEvents.push(shiftToCalendarEvent(s));
      });
      approvedLeaves.forEach((l) => {
        calendarEvents.push(...leaveToCalendarEvent(l));
      });

      // Lấy số lượng ca mở nếu có
      let openShifts = [];
      try {
        const rawOpen = await getOpenShifts({ weekStart: targetMondayIso });
        openShifts = Array.isArray(rawOpen) ? rawOpen : (rawOpen?.data || []);
      } catch {
        openShifts = [];
      }

      const todayShiftItem = myShifts.find((s) => s.date === todayIso);
      const todayShift = todayShiftItem
        ? {
            code: todayShiftItem.shiftId,
            name: todayShiftItem.shiftName,
            start: todayShiftItem.startTime,
            end: todayShiftItem.endTime,
            roleTag: todayShiftItem.role,
          }
        : null;

      const todaySummary = {
        todayDateIso: todayIso,
        todayShift,
        todayStatus: {
          hasShift: Boolean(todayShiftItem),
          shiftName: todayShiftItem?.shiftName || "",
          startTime: todayShiftItem?.startTime || "",
          endTime: todayShiftItem?.endTime || "",
          isCheckedIn: false,
          label: !data.published
            ? "Chưa có lịch làm việc được công bố"
            : todayShiftItem
            ? `Sẵn sàng check-in ca ${todayShiftItem.shiftName} (${todayShiftItem.startTime})`
            : "Không có ca trực hôm nay",
          tone: !data.published ? "neutral" : todayShiftItem ? "warning" : "neutral",
          canCheckIn: Boolean(todayShiftItem) && Boolean(data.published),
        },
      };

      return {
        ...data,
        weekStart: data.weekStart || targetMondayIso,
        weekLabel: data.weekLabel || `Tuần ${toVN(targetMondayIso)}`,
        published: Boolean(data.published),
        days: data.days || [],
        shiftsConfig: data.shiftsConfig || [],
        shifts: myShifts,
        myShifts,
        allCoworkerShifts: [],
        openShifts,
        approvedLeaves,
        approvedLeaveDates,
        calendarEvents,
        stats: {
          totalHours: data.stats?.totalHours ?? myShifts.reduce((s, r) => s + (Number(r.hours) || 0), 0),
          contractHours: data.stats?.contractHours ?? 40,
          shiftCount: data.stats?.shiftCount ?? myShifts.length,
          openShiftCount: openShifts.length,
          nextShift: data.nextShift || myShifts.find((s) => s.date >= todayIso) || myShifts[0] || null,
          published: Boolean(data.published),
        },
        todayShift,
        todaySummary,
      };
    }

    throw new Error(res.data?.message || "Không thể tải lịch cá nhân từ máy chủ.");
  } catch (err) {
    console.error("Lỗi getMySchedule từ API Backend:", err);
    throw err;
  }
}

export default {
  getScheduleBoard,
  saveScheduleDraft,
  publishSchedule,
  subscribeSchedule,
  generateSchedule,
  getSchedule,
  updateShift,
  applySchedule,
  shiftToCalendarEvent,
  leaveToCalendarEvent,
  getMySchedule,
  calculateScheduleStats,
  employeeRoster,
  getEmployeeById,
  getWeekDays,
  getCurrentWeekLabel,
  initialDays,
  initialShiftDemands,
  initialConstraints,
  DAILY_SHIFT_REQUIREMENTS,
  generateInitialSchedules,
  getSavedSchedules,
  saveSchedules,
  confirmSchedule,
  isScheduleConfirmed,
  getFutureShiftsForEmployee,
  freeFutureShiftsForEmployee,
  restoreEmployeeShiftInSchedule,
  getShiftInfo,
  roleBadgeClass,
  mergeConfigConstraints,
  mergeConfigShifts,
  WEEK_LABEL,
  WEEKLY_PATTERN,
  mondayOf,
  addDays,
  toISO,
  toVN,
  getNow,
};

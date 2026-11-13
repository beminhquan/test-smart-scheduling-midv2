// =============================================================================
// HOOK: useCreatedScheduleData
// Tầng: Hook giao diện (Custom Hook) - US11: Xem, sửa và công bố lịch đã tạo
// Mô tả: Kết nối API Backend MySQL để lấy lịch làm việc tuần thực tế (Single Source of Truth),
//        hỗ trợ chuyển tuần (trước/này/sau), lọc nhân viên, tính toán thống kê và kiểm tra ca thiếu định biên.
// =============================================================================

import { createElement, Fragment, useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Building, Users, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  employeeRoster,
  getWeekDays,
  getCurrentWeekLabel,
  initialShiftDemands,
  DAILY_SHIFT_REQUIREMENTS,
  getSavedSchedules,
  saveSchedules,
  isScheduleConfirmed,
  getWeeklySchedule,
  confirmWeeklySchedule,
} from "../scheduleShared";
import { getNow, addDays, toISO, mondayOf } from "../../../../lib/dateUtils";
import { stripAccents } from "../../../../lib/formatters";

/**
 * Hook quản lý trạng thái, bộ lọc và tính toán thống kê của trang Lịch đã tạo
 */
export function useCreatedScheduleData({ showToast }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [period, setPeriod] = useState("week");
  const [schedules, setSchedules] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [hasSchedule, setHasSchedule] = useState(false);
  const [scheduleInfo, setScheduleInfo] = useState(null);
  const [serverEmployees, setServerEmployees] = useState([]);
  const [shiftDemands] = useState(initialShiftDemands);

  // Tính ngày Thứ 2 của tuần được chọn (ISO: YYYY-MM-DD)
  const currentWeekMonday = useMemo(() => {
    const offset = period === "prev" ? -7 : period === "next" ? 7 : 0;
    return toISO(mondayOf(addDays(getNow(), offset)));
  }, [period]);

  // Tính toán 7 ngày trong tuần theo khoảng thời gian được chọn
  const days = useMemo(() => {
    const offset = period === "prev" ? -7 : period === "next" ? 7 : 0;
    return getWeekDays(addDays(getNow(), offset));
  }, [period]);

  // Nhãn tuần động (vd: Tuần 02/11/2026 - 08/11/2026)
  const weekLabel = useMemo(() => {
    const offset = period === "prev" ? -7 : period === "next" ? 7 : 0;
    return getCurrentWeekLabel(addDays(getNow(), offset));
  }, [period]);

  // Tải dữ liệu lịch thực tế từ Backend Laravel MySQL mỗi khi đổi tuần hoặc mở trang
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    getWeeklySchedule(currentWeekMonday)
      .then((res) => {
        if (!isMounted) return;
        if (res && res.status && res.has_schedule && res.schedules) {
          setSchedules(res.schedules);
          setHasSchedule(true);
          setScheduleInfo({
            lichId: res.lich_id,
            trangThai: res.trang_thai,
            phienBan: res.phien_ban,
            weekMonday: res.weekMonday,
            weekSunday: res.weekSunday,
            totalAssignments: res.total_assignments,
            totalRequired: res.total_required,
            deficientShifts: res.deficient_shifts,
          });
          if (Array.isArray(res.employees) && res.employees.length > 0) {
            setServerEmployees(res.employees);
          }
          saveSchedules(res.schedules);
        } else {
          setHasSchedule(false);
          setSchedules({});
          setScheduleInfo(null);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn("Lỗi tải lịch làm việc tuần từ Backend:", err);
        setHasSchedule(false);
        setSchedules({});
        setScheduleInfo(null);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentWeekMonday]);

  // Danh sách nhân sự khả dụng (ưu tiên nhân viên thật từ MySQL)
  const availableEmployees = useMemo(() => {
    if (serverEmployees.length > 0) return serverEmployees;
    return employeeRoster;
  }, [serverEmployees]);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [view, setView] = useState("grid"); // "grid" | "list"
  const [activeModalShiftKey, setActiveModalShiftKey] = useState(null);

  const canClear = search !== "" || roleFilter !== "all" || shiftFilter !== "all" || period !== "week";

  const resetFilters = () => {
    setSearch("");
    setRoleFilter("all");
    setShiftFilter("all");
    setPeriod("week");
  };

  const handleOpenShiftModal = (shiftKey) => setActiveModalShiftKey(shiftKey);
  const handleCloseModal = () => setActiveModalShiftKey(null);

  const handleSaveModal = (shiftKey, updatedList) => {
    if (scheduleInfo?.trangThai === "CONFIRMED") {
      showToast?.("Lịch tuần này đã được xác nhận chính thức, không thể sửa đổi.");
      handleCloseModal();
      return;
    }
    const updated = {
      ...schedules,
      [shiftKey]: {
        ...(schedules[shiftKey] || {}),
        assigned: updatedList,
      },
    };
    setSchedules(updated);
    saveSchedules(updated);
    handleCloseModal();
    showToast?.("Đã cập nhật phân công ca thành công!");
  };

  const handleGoToOpenShift = (shiftInfo) => {
    handleCloseModal();
    navigate("/manager/open-shifts", {
      state: {
        shift: shiftInfo,
        fromSchedule: true,
      },
    });
  };

  // Thống kê tổng hợp từ ma trận lịch thực tế
  const stats = useMemo(() => {
    const uniqueEmployees = new Set();
    let totalRequiredPositions = 0;
    let totalAssignedPositions = 0;
    let totalAssignedHours = 0;
    let deficientShiftsCount = 0;

    days.forEach((day) => {
      shiftDemands.forEach((demand) => {
        const key = `${demand.id}_${day.id}`;
        const shiftData = schedules[key] || { assigned: [] };
        const count = shiftData.assigned?.length || 0;
        const req = shiftData.required ?? shiftData.total ?? (DAILY_SHIFT_REQUIREMENTS[day.id]?.[demand.id]?.total || demand.total || 0);

        totalRequiredPositions += req;
        totalAssignedPositions += count;
        const hours = demand.id === "morning" ? 6 : 5;
        totalAssignedHours += count * hours;
        shiftData.assigned?.forEach((e) => uniqueEmployees.add(e.id));
        if (count < req) {
          deficientShiftsCount++;
        }
      });
    });

    const fillRate = totalRequiredPositions > 0
      ? Math.round((totalAssignedPositions / totalRequiredPositions) * 100)
      : (totalAssignedPositions > 0 ? 100 : 0);

    return {
      uniqueEmployees,
      totalRequiredPositions,
      totalAssignedPositions,
      totalAssignedHours,
      deficientShiftsCount,
      fillRate,
    };
  }, [days, shiftDemands, schedules]);

  // Phẳng hóa phân công cho dạng xem Danh sách
  const allAssignments = useMemo(() => {
    const list = [];
    days.forEach((day) => {
      shiftDemands.forEach((demand) => {
        const key = `${demand.id}_${day.id}`;
        const shiftData = schedules[key] || { assigned: [] };
        const emps = shiftData.assigned || [];
        const hours = demand.id === "morning" ? 6 : 5;

        emps.forEach((emp) => {
          list.push({
            id: `${emp.id}_${day.id}_${demand.id}`,
            shiftKey: key,
            employeeId: emp.id,
            employeeName: emp.name,
            employeeAvatar: emp.avatar,
            role: emp.role || emp.roles?.[0] || "Phục vụ",
            roles: emp.roles || [emp.role || "Phục vụ"],
            dayId: day.id,
            dayLabel: day.label,
            dayName: day.fullDate?.split(",")?.[0] || day.label,
            date: day.date ? `${day.date}/2026` : day.iso,
            fullDate: day.fullDate || `${day.label}, ${day.date}`,
            shiftId: demand.id,
            shiftName: demand.shortName || (demand.id === "morning" ? "Sáng" : (demand.id === "afternoon" ? "Chiều" : "Tối")),
            shiftFullName: demand.name,
            scheduled: demand.time,
            hours,
            status: "Đã phân công",
          });
        });
      });
    });
    return list;
  }, [days, shiftDemands, schedules]);

  const keyword = stripAccents(search);
  const filteredAssignments = useMemo(() => {
    return allAssignments.filter((r) => {
      if (keyword) {
        const matchName = stripAccents(r.employeeName).includes(keyword);
        const matchId = String(r.employeeId || "").toLowerCase().includes(keyword);
        if (!matchName && !matchId) return false;
      }
      if (roleFilter !== "all" && !(r.roles ? r.roles.includes(roleFilter) : r.role === roleFilter)) return false;
      if (shiftFilter !== "all" && r.shiftId !== shiftFilter) return false;
      return true;
    });
  }, [allAssignments, keyword, roleFilter, shiftFilter]);

  const filteredEmployees = useMemo(() => {
    return availableEmployees.filter((emp) => {
      if (keyword) {
        const matchName = stripAccents(emp.name).includes(keyword);
        const matchId = String(emp.id || "").toLowerCase().includes(keyword);
        if (!matchName && !matchId) return false;
      }
      if (roleFilter !== "all" && !(emp.roles ? emp.roles.includes(roleFilter) : emp.role === roleFilter)) return false;
      if (shiftFilter !== "all") {
        const hasShift = days.some(
          (d) => schedules[`${shiftFilter}_${d.id}`]?.assigned?.some((e) => e.id === emp.id)
        );
        if (!hasShift) return false;
      }
      return true;
    });
  }, [availableEmployees, keyword, roleFilter, shiftFilter, days, schedules]);

  const modalData = useMemo(() => {
    if (!activeModalShiftKey) return null;
    const [shiftId, dayId] = activeModalShiftKey.split("_");
    const shiftSchedule = schedules[activeModalShiftKey] || {};
    const baseDemand = shiftSchedule.demand || shiftDemands.find((d) => d.id === shiftId) || shiftDemands[0];
    const dailyReq = DAILY_SHIFT_REQUIREMENTS[dayId]?.[shiftId] || baseDemand;
    const demand = { ...baseDemand, ...dailyReq };
    const day = days.find((d) => d.id === dayId) || days[0];
    const assigned = shiftSchedule.assigned || [];

    const pvAssigned = assigned.filter((e) => e.role === "Phục vụ" || e.roleTagId === 1 || e.roleTagId === 4).length;
    const pcAssigned = assigned.filter((e) => e.role === "Pha chế" || e.roleTagId === 2).length;
    const tnAssigned = assigned.filter((e) => e.role === "Thu ngân" || e.roleTagId === 3).length;
    const reqTotal = shiftSchedule.required ?? demand.total ?? (pvAssigned + pcAssigned + tnAssigned);
    const missing = Math.max(0, reqTotal - assigned.length);

    return {
      key: activeModalShiftKey,
      shiftId,
      dayId,
      demand: {
        ...demand,
        total: reqTotal,
        phucVu: shiftSchedule.phucVu ?? demand.phucVu ?? 0,
        phaChe: shiftSchedule.phaChe ?? demand.phaChe ?? 0,
        thuNgan: shiftSchedule.thuNgan ?? demand.thuNgan ?? 0,
      },
      day,
      assigned,
      pvAssigned,
      pcAssigned,
      tnAssigned,
      missing,
    };
  }, [activeModalShiftKey, shiftDemands, days, schedules]);

  const statItems = useMemo(
    () => [
      {
        key: "shifts",
        icon: createElement(Building, { size: 16, strokeWidth: 1.8, className: "text-[#0F172A]" }),
        dot: "#0F172A",
        label: "Tổng số ca tuần",
        value: "21 ca",
        note: "3 ca × 7 ngày",
        footer: createElement(
          Fragment,
          null,
          createElement("span", null, "Toàn tuần:"),
          createElement("span", { className: "font-semibold text-[#0F172A] tabular-nums" }, "7 ngày")
        ),
      },
      {
        key: "employees",
        icon: createElement(Users, { size: 16, strokeWidth: 1.8, className: "text-[#0F172A]" }),
        dot: "#8B5CF6",
        label: "Nhân sự tham gia",
        value: `${stats.uniqueEmployees.size} / ${availableEmployees.length}`,
        note: "Nhân viên phân công",
        footer: createElement(
          Fragment,
          null,
          createElement("span", null, "Tỷ lệ huy động:"),
          createElement(
            "span",
            { className: "font-semibold text-[#0F172A] tabular-nums" },
            `${Math.round((stats.uniqueEmployees.size / (availableEmployees.length || 1)) * 100)}%`
          )
        ),
      },
      {
        key: "hours",
        icon: createElement(Clock, { size: 16, strokeWidth: 1.8, className: "text-[#0F172A]" }),
        dot: "#2B9FCF",
        label: "Tổng giờ phân công",
        value: `${stats.totalAssignedHours}g`,
        note: "Toàn tuần",
        footer: createElement(
          Fragment,
          null,
          createElement("span", null, "Trung bình:"),
          createElement(
            "span",
            { className: "font-semibold text-[#0F172A] tabular-nums" },
            `${(stats.totalAssignedHours / (stats.uniqueEmployees.size || 1)).toFixed(1)}g/người`
          )
        ),
      },
      {
        key: "fillRate",
        icon: createElement(CheckCircle2, { size: 16, strokeWidth: 1.8, className: "text-[#0F172A]" }),
        dot: "#2A9D8F",
        label: "Tỷ lệ lấp đầy ca",
        value: `${stats.fillRate}%`,
        note: `${stats.totalAssignedPositions}/${stats.totalRequiredPositions} vị trí`,
        footer: createElement(
          Fragment,
          null,
          createElement("span", null, "Vị trí còn thiếu:"),
          createElement(
            "span",
            { className: "font-semibold text-emerald-700 tabular-nums" },
            `${Math.max(0, stats.totalRequiredPositions - stats.totalAssignedPositions)} vị trí`
          )
        ),
      },
      {
        key: "deficient",
        icon: createElement(AlertTriangle, { size: 16, strokeWidth: 1.8, className: "text-[#0F172A]" }),
        dot: stats.deficientShiftsCount > 0 ? "#E76F51" : "#2A9D8F",
        label: "Ca cần bổ sung",
        value: `${stats.deficientShiftsCount} ca`,
        note: stats.deficientShiftsCount > 0 ? "Cần phân công thêm" : "Đã đủ định biên",
        footer: createElement(
          Fragment,
          null,
          createElement("span", null, "Tình trạng:"),
          createElement(
            "span",
            { className: `font-semibold tabular-nums ${stats.deficientShiftsCount > 0 ? "text-rose-700" : "text-emerald-700"}` },
            stats.deficientShiftsCount > 0 ? "Chưa đạt" : "Đạt định biên"
          )
        ),
      },
    ],
    [stats, availableEmployees.length]
  );

  return {
    days,
    weekLabel,
    shiftDemands,
    schedules,
    period,
    setPeriod,
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    shiftFilter,
    setShiftFilter,
    view,
    setView,
    activeModalShiftKey,
    canClear,
    resetFilters,
    handleOpenShiftModal,
    handleCloseModal,
    handleSaveModal,
    handleGoToOpenShift,
    stats,
    statItems,
    allAssignments,
    filteredAssignments,
    filteredEmployees,
    modalData,
    isLoading,
    hasSchedule,
    scheduleInfo,
    availableEmployees,
  };
}

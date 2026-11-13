import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  employeeRoster,
  initialConstraints,
  initialShiftDemands,
  getSavedSchedules,
  saveSchedules,
  confirmSchedule,
  isScheduleConfirmed,
  getShiftInfo,
  getWeekDays,
  getCurrentWeekLabel,
  subscribeSchedule,
  getScheduleInputConfig,
  saveScheduleDemand,
  generateScheduleORTools,
  getWeeklySchedule,
  confirmWeeklySchedule,
} from "../scheduleShared";
import { mondayOf, addDays, toISO, getNow } from "../../../../lib/dateUtils";

/**
 * Hook quản lý cấu hình đầu vào, nhu cầu nhân sự (US10), xếp lịch tự động (US11) và phân công lịch (US12)
 */
export function useScheduleManagement() {
  const navigate = useNavigate();

  // 1. Quản lý tuần làm việc
  const initialMonday = useMemo(() => toISO(mondayOf(getNow())), []);
  const [currentWeekMonday, setCurrentWeekMonday] = useState(initialMonday);

  const days = useMemo(() => {
    const [y, m, d] = currentWeekMonday.split("-").map(Number);
    const mon = new Date(y, m - 1, d);
    return getWeekDays(mon);
  }, [currentWeekMonday]);

  const weekLabel = useMemo(() => {
    const [y, m, d] = currentWeekMonday.split("-").map(Number);
    const mon = new Date(y, m - 1, d);
    return getCurrentWeekLabel(mon);
  }, [currentWeekMonday]);

  const handlePrevWeek = () => {
    const [y, m, d] = currentWeekMonday.split("-").map(Number);
    const prevMon = addDays(new Date(y, m - 1, d), -7);
    setCurrentWeekMonday(toISO(prevMon));
  };

  const handleNextWeek = () => {
    const [y, m, d] = currentWeekMonday.split("-").map(Number);
    const nextMon = addDays(new Date(y, m - 1, d), 7);
    setCurrentWeekMonday(toISO(nextMon));
  };

  // 2. Ràng buộc từ Backend MySQL
  const [constraints, setConstraints] = useState(initialConstraints);

  // 3. Quản lý nhu cầu nhân sự (Chế độ A - Dùng chung vs Chế độ B - Cuối tuần riêng)
  const [selectedDayId, setSelectedDayId] = useState("T2");
  const [useSameConfigForWeekend, setUseSameConfigForWeekend] = useState(true);
  const [weekdayDemand, setWeekdayDemand] = useState(initialShiftDemands);
  const [weekendDemand, setWeekendDemand] = useState(initialShiftDemands);
  const [saturdayDemand, setSaturdayDemand] = useState(null);
  const [sundayDemand, setSundayDemand] = useState(null);
  const [isSavingDemand, setIsSavingDemand] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Nhu cầu nhân sự hiển thị và điều chỉnh hiện tại
  const shiftDemands = useMemo(() => {
    if (useSameConfigForWeekend) {
      return weekdayDemand;
    }
    if (selectedDayId === "T7") {
      return saturdayDemand || weekendDemand;
    }
    if (selectedDayId === "CN") {
      return sundayDemand || weekendDemand;
    }
    return weekdayDemand;
  }, [useSameConfigForWeekend, selectedDayId, weekdayDemand, weekendDemand, saturdayDemand, sundayDemand]);

  // Nhãn trạng thái đang điều chỉnh
  const activeTargetLabel = useMemo(() => {
    if (useSameConfigForWeekend) {
      return "Toàn bộ tuần (Dùng chung T2–CN)";
    }
    if (selectedDayId === "T7") {
      return "Cuối tuần - Thứ 7 (T7)";
    }
    if (selectedDayId === "CN") {
      return "Cuối tuần - Chủ nhật (CN)";
    }
    return "Ngày thường (T2–T6)";
  }, [useSameConfigForWeekend, selectedDayId]);

  // Đồng bộ cấu hình đầu vào từ Backend Laravel/MySQL mỗi khi đổi tuần hoặc mở trang
  useEffect(() => {
    let isMounted = true;
    getScheduleInputConfig(currentWeekMonday)
      .then((cfg) => {
        if (!isMounted || !cfg) return;
        if (Array.isArray(cfg.constraints) && cfg.constraints.length > 0) {
          setConstraints(cfg.constraints);
        }
        if (cfg.demandConfig) {
          const dc = cfg.demandConfig;
          if (dc.useSameConfigForWeekend !== undefined) {
            setUseSameConfigForWeekend(Boolean(dc.useSameConfigForWeekend));
          }
          if (Array.isArray(dc.weekdayDemand) && dc.weekdayDemand.length > 0) {
            setWeekdayDemand(dc.weekdayDemand);
          }
          if (Array.isArray(dc.weekendDemand) && dc.weekendDemand.length > 0) {
            setWeekendDemand(dc.weekendDemand);
          }
          if (Array.isArray(dc.saturdayDemand)) {
            setSaturdayDemand(dc.saturdayDemand);
          }
          if (Array.isArray(dc.sundayDemand)) {
            setSundayDemand(dc.sundayDemand);
          }
        }
      })
      .catch((err) => console.warn("Lỗi tải dữ liệu đầu vào lịch:", err));

    return () => {
      isMounted = false;
    };
  }, [currentWeekMonday]);

  // 4. Các tương tác nhu cầu nhân sự
  const updateDemandField = (shiftId, field, delta) => {
    const updater = (list) =>
      list.map((item) => {
        const idMatches = item.id === shiftId || item.shiftId === shiftId;
        if (!idMatches) return item;
        const curVal = item[field] ?? 0;
        const newVal = Math.max(0, curVal + delta);
        const updated = { ...item, [field]: newVal };
        updated.total = (updated.phucVu ?? 0) + (updated.phaChe ?? 0) + (updated.thuNgan ?? 0);
        return updated;
      });

    if (useSameConfigForWeekend) {
      setWeekdayDemand((prev) => updater(prev));
    } else {
      if (selectedDayId === "T7") {
        setSaturdayDemand((prev) => updater(prev || weekendDemand));
        setWeekendDemand((prev) => updater(prev));
      } else if (selectedDayId === "CN") {
        setSundayDemand((prev) => updater(prev || weekendDemand));
        setWeekendDemand((prev) => updater(prev));
      } else {
        setWeekdayDemand((prev) => updater(prev));
      }
    }
  };

  const handleToggleSharedMode = (useShared) => {
    setUseSameConfigForWeekend(useShared);
    // Khi bật Chế độ B lần đầu nếu chưa có weekendDemand, sao chép từ weekdayDemand
    if (!useShared && (!weekendDemand || weekendDemand.length === 0)) {
      setWeekendDemand(JSON.parse(JSON.stringify(weekdayDemand)));
    }
  };

  const handleCopyWeekdayToWeekend = () => {
    const cloned = JSON.parse(JSON.stringify(weekdayDemand));
    setWeekendDemand(cloned);
    setSaturdayDemand(JSON.parse(JSON.stringify(weekdayDemand)));
    setSundayDemand(JSON.parse(JSON.stringify(weekdayDemand)));
  };

  const handleCustomWeekendDemand = () => {
    setUseSameConfigForWeekend(false);
    setSelectedDayId("T7");
    if (!weekendDemand || weekendDemand.length === 0) {
      setWeekendDemand(JSON.parse(JSON.stringify(weekdayDemand)));
    }
  };

  const handleSaveDemand = async () => {
    try {
      setIsSavingDemand(true);
      await saveScheduleDemand({
        weekMonday: currentWeekMonday,
        useSameConfigForWeekend,
        weekdayDemand,
        weekendDemand,
        saturdayDemand,
        sundayDemand,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert("Lỗi lưu nhu cầu nhân sự: " + (err.response?.data?.message || err.message));
    } finally {
      setIsSavingDemand(false);
    }
  };

  // 5. Quản lý phân công lịch & Modal (US11, US12)
  const [activeModal, setActiveModal] = useState(null);
  const [schedules, setSchedules] = useState({});
  const [selectedShiftKey, setSelectedShiftKey] = useState("morning_T2");
  const [isConfirmedState, setIsConfirmedState] = useState(false);

  // Tải lịch làm việc thực tế từ Backend MySQL khi đổi tuần hoặc mở trang
  useEffect(() => {
    let isMounted = true;
    getWeeklySchedule(currentWeekMonday).then((res) => {
      if (!isMounted || !res) return;
      if (res.has_schedule && res.schedules && Object.keys(res.schedules).length > 0) {
        setSchedules(res.schedules);
        saveSchedules(res.schedules);
        setIsConfirmedState(res.trang_thai === "CONFIRMED" || res.trang_thai === "APPROVED");
      } else {
        setSchedules({});
        saveSchedules({});
        setIsConfirmedState(false);
      }
    }).catch(() => {
      if (!isMounted) return;
      setSchedules({});
      setIsConfirmedState(false);
    });
    return () => {
      isMounted = false;
    };
  }, [currentWeekMonday]);

  const [editEmployeesList, setEditEmployeesList] = useState([]);
  const [showAddEmployeeDropdown, setShowAddEmployeeDropdown] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationSuccess, setGenerationSuccess] = useState(false);

  const selectedInfo = useMemo(
    () => getShiftInfo(schedules, shiftDemands, days, selectedShiftKey),
    [schedules, shiftDemands, days, selectedShiftKey]
  );

  const handleCellClick = (shiftId, dayId) => {
    setSelectedShiftKey(`${shiftId}_${dayId}`);
    setActiveModal("shiftDetail");
  };

  const handleOpenEditModal = () => {
    if (isConfirmedState) {
      alert("Lịch tuần này đã được xác nhận chính thức, không thể chỉnh sửa.");
      return;
    }
    setEditEmployeesList([...(schedules[selectedShiftKey]?.assigned || [])]);
    setShowAddEmployeeDropdown(false);
    setActiveModal("editShift");
  };

  const handleGoToOpenShift = (targetShift) => {
    setActiveModal(null);
    navigate("/manager/open-shifts", {
      state: { shift: targetShift || selectedInfo, fromSchedule: true },
    });
  };

  const toggleConstraint = (id) =>
    setConstraints((prev) => prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)));

  const updateConstraintValue = (id, val) =>
    setConstraints((prev) => prev.map((c) => (c.id === id ? { ...c, value: val } : c)));

  const handleRemoveFromEditShift = (empId) =>
    setEditEmployeesList((prev) => prev.filter((e) => e.id !== empId));

  const handleAddEmployeeToEditShift = (emp) => {
    if (!editEmployeesList.some((e) => e.id === emp.id)) {
      setEditEmployeesList((prev) => [...prev, emp]);
    }
    setShowAddEmployeeDropdown(false);
  };

  const handleSaveEditShift = () => {
    if (isConfirmedState) {
      alert("Lịch tuần này đã được xác nhận chính thức, không thể chỉnh sửa.");
      setActiveModal(null);
      return;
    }
    setSchedules((prev) => {
      const next = { ...prev, [selectedShiftKey]: { ...prev[selectedShiftKey], assigned: editEmployeesList } };
      saveSchedules(next);
      return next;
    });
    setActiveModal(null);
  };

  const handleConfirmSchedule = async () => {
    try {
      const res = await confirmWeeklySchedule(currentWeekMonday);
      if (res && res.status) {
        setIsConfirmedState(true);
        confirmSchedule(schedules);
        setActiveModal(null);
        alert(res.message || "Lịch làm việc tuần đã được xác nhận chính thức.");
      } else {
        alert(res?.message || "Không thể xác nhận lịch.");
      }
    } catch (err) {
      console.warn("Lỗi xác nhận lịch lên Backend:", err);
      alert(err.response?.data?.message || err.message || "Lỗi khi xác nhận lịch.");
    }
  };

  const handleRunORTools = async () => {
    setIsGenerating(true);
    try {
      const res = await generateScheduleORTools(currentWeekMonday);
      if (res && res.status) {
        // Cập nhật ngay từ response của OR-Tools nếu có ma trận schedules
        if (res.schedules && Object.keys(res.schedules).length > 0) {
          setSchedules(res.schedules);
          saveSchedules(res.schedules);
          setIsConfirmedState(false);
        }

        // Tải lại lịch mới tạo từ MySQL để đồng bộ trọn vẹn
        const weeklyRes = await getWeeklySchedule(currentWeekMonday);
        if (weeklyRes && weeklyRes.has_schedule && weeklyRes.schedules) {
          setSchedules(weeklyRes.schedules);
          saveSchedules(weeklyRes.schedules);
          setIsConfirmedState(weeklyRes.trang_thai === "CONFIRMED" || weeklyRes.trang_thai === "APPROVED");
        }
        setIsGenerating(false);
        setGenerationSuccess(true);
        setTimeout(() => {
          setGenerationSuccess(false);
          setActiveModal(null);
        }, 900);
      } else {
        throw new Error(res?.message || "Không thể tạo lịch");
      }
    } catch (err) {
      console.warn("Lỗi gọi Python OR-Tools solver qua Laravel:", err);
      alert(err.response?.data?.message || err.message || "Lỗi tạo lịch tự động");
      setIsGenerating(false);
      setGenerationSuccess(false);
    }
  };

  const uniqueEmployeesCount = useMemo(() => {
    const s = new Set();
    Object.values(schedules).forEach((shift) => shift.assigned?.forEach((e) => s.add(e.id)));
    return s.size || 0;
  }, [schedules]);

  return {
    currentWeekMonday,
    weekLabel,
    handlePrevWeek,
    handleNextWeek,
    activeModal,
    setActiveModal,
    constraints,
    days,
    selectedDayId,
    setSelectedDayId,
    useSameConfigForWeekend,
    activeTargetLabel,
    shiftDemands,
    schedules,
    selectedShiftKey,
    isConfirmedState,
    editEmployeesList,
    showAddEmployeeDropdown,
    setShowAddEmployeeDropdown,
    isGenerating,
    generationSuccess,
    selectedInfo,
    uniqueEmployeesCount,
    employeeRoster,
    isSavingDemand,
    saveSuccess,
    handleCellClick,
    handleOpenEditModal,
    handleGoToOpenShift,
    toggleConstraint,
    updateConstraintValue,
    updateDemandField,
    handleToggleSharedMode,
    handleCopyWeekdayToWeekend,
    handleCustomWeekendDemand,
    handleSaveDemand,
    handleRemoveFromEditShift,
    handleAddEmployeeToEditShift,
    handleSaveEditShift,
    handleConfirmSchedule,
    handleRunORTools,
  };
}

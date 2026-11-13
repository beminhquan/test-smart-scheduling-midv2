import { useEffect, useState, useRef, useMemo } from "react";
import {
  getShiftConfig,
  saveShiftConfig,
  getRoleTags,
  addRoleTag,
  updateRoleTag,
  deleteRoleTag,
  deleteShift as deleteShiftApi,
  pauseShift as pauseShiftApi,
} from "../../../../services/shiftConfigService";
import {
  initialShifts,
  initialConstraints,
  initialGeneralSettings,
  generateShiftCode,
  toPayload,
  fromPayload,
} from "../shiftConfigData";
import { getSavedSchedules } from "../../schedule/scheduleShared";
import { stripAccents } from "../../../../lib/formatters";

export function useShiftConfig() {
  const [tab, setTab] = useState("shifts");
  const [shifts, setShifts] = useState(initialShifts);
  const [constraints, setConstraints] = useState(initialConstraints);
  const [generalSettings, setGeneralSettings] = useState(initialGeneralSettings);
  const [roleTags, setRoleTags] = useState([]);
  const [roleError, setRoleError] = useState("");
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [filters, setFilters] = useState({ q: "", status: "all" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(7);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [toast, setToast] = useState("");
  const toastTimerRef = useRef(null);

  const notify = (message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(""), 3500);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const loadData = () => {
    setLoading(true);
    Promise.all([getShiftConfig(), getRoleTags()])
      .then(([data, roles]) => {
        const cfg = fromPayload(data);
        setShifts(cfg.shifts);
        setConstraints(cfg.constraints);
        if (cfg.generalSettings) setGeneralSettings(cfg.generalSettings);
        if (roles && Array.isArray(roles)) {
          setRoleTags(roles);
        } else if (data?.roles && Array.isArray(data.roles)) {
          setRoleTags(data.roles);
        }
        setOffline(false);
      })
      .catch((err) => {
        console.error("Lỗi tải cấu hình:", err);
        setOffline(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRoleAdd = async (roleName) => {
    setRoleError("");
    try {
      const updated = await addRoleTag(roleName);
      setRoleTags(updated);
      notify(`Đã thêm vai trò “${roleName}”.`);
    } catch (err) {
      setRoleError(err.response?.data?.message || err.message || "Lỗi khi thêm vai trò.");
    }
  };

  const handleRoleUpdate = async (oldRole, newRole) => {
    setRoleError("");
    try {
      const updated = await updateRoleTag(oldRole, newRole);
      setRoleTags(updated);
      notify(`Đã đổi tên vai trò thành “${newRole}”.`);
    } catch (err) {
      setRoleError(err.response?.data?.message || err.message || "Lỗi khi sửa vai trò.");
    }
  };

  const handleRoleDelete = async (roleName) => {
    setRoleError("");
    try {
      const updated = await deleteRoleTag(roleName);
      setRoleTags(updated);
      notify(`Đã xóa vai trò “${roleName}”.`);
    } catch (err) {
      setRoleError(err.response?.data?.message || err.message || "Role_Tag đang được sử dụng");
    }
  };

  const persist = async (nextShifts, nextConstraints, nextGeneralSettings, okMessage) => {
    try {
      await saveShiftConfig(toPayload(nextShifts, nextConstraints, nextGeneralSettings));
      setShifts(nextShifts);
      setConstraints(nextConstraints);
      setGeneralSettings(nextGeneralSettings);
      notify(okMessage);
      return true;
    } catch (err) {
      notify(err.response?.data?.message || "Không lưu được, vui lòng thử lại.");
      return false;
    }
  };

  const activeCount = useMemo(
    () => shifts.filter((s) => s.status === "active").length,
    [shifts]
  );

  const q = stripAccents(filters.q);
  const rows = useMemo(
    () =>
      shifts.filter(
        (s) =>
          (!q || stripAccents(s.name).includes(q)) &&
          (filters.status === "all" || s.status === filters.status)
      ),
    [shifts, q, filters.status]
  );

  const canClear = filters.q !== "" || filters.status !== "all";
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)));
  const pageRows = useMemo(
    () => rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [rows, safePage, pageSize]
  );

  const isShiftUsedInSchedule = (shift) => {
    if (!shift) return false;
    if (shift.is_used || shift.isUsed) return true;
    try {
      const schedules = getSavedSchedules();
      const codes = [shift.code, `shift_${shift.id}`, shift.name?.toLowerCase()].filter(Boolean);
      return Object.values(schedules).some((slot) => {
        const sId = String(slot.shiftId || "").toLowerCase();
        return (
          codes.some((c) => String(c).toLowerCase() === sId) &&
          Array.isArray(slot.assigned) &&
          slot.assigned.length > 0
        );
      });
    } catch {
      return false;
    }
  };

  const saveShift = async (data) => {
    const id = data.id ?? Date.now();
    const code = data.code || generateShiftCode();
    const next = data.id
      ? shifts.map((s) =>
          s.id === data.id ? { ...data, multiplier: Number(data.multiplier) || 1.0 } : s
        )
      : [...shifts, { ...data, id, code, multiplier: Number(data.multiplier) || 1.0 }];
    if (
      await persist(
        next,
        constraints,
        generalSettings,
        data.id ? `Đã cập nhật ca “${data.name}”.` : `Đã thêm ca “${data.name}”.`
      )
    ) {
      setEditing(null);
    }
  };

  const pauseShift = async (shift) => {
    try {
      if (shift.id && typeof shift.id === "number" && shift.id < 1000000000) {
        await pauseShiftApi(shift.id);
      }
      const next = shifts.map((s) => (s.id === shift.id ? { ...s, status: "paused" } : s));
      setShifts(next);
      notify(`Đã chuyển ca “${shift.name}” sang tạm dừng.`);
      setDeleting(null);
    } catch (err) {
      notify(err.response?.data?.message || "Không thể cập nhật trạng thái ca.");
    }
  };

  const deleteShift = async (shift) => {
    try {
      // Nếu ca đã có trong CSDL (id số nguyên chuẩn), gọi API DELETE để backend kiểm tra isUsedInSchedule
      if (shift.id && typeof shift.id === "number" && shift.id < 1000000000) {
        await deleteShiftApi(shift.id);
      }
      const next = shifts.filter((s) => s.id !== shift.id);
      setShifts(next);
      notify(`Đã xóa ca “${shift.name}”.`);
      setDeleting(null);
    } catch (err) {
      notify(err.response?.data?.message || "Không thể xóa ca làm việc.");
    }
  };

  const saveConstraints = (draft) =>
    persist(shifts, draft, generalSettings, "Đã lưu cấu hình ràng buộc.");

  const saveGeneral = (draft) =>
    persist(shifts, constraints, draft, "Đã lưu cấu hình chung.");

  const resetFilters = () => {
    setFilters({ q: "", status: "all" });
    setPage(1);
  };

  const tabs = [
    ["shifts", "Danh mục ca", shifts.length],
    ["roles", "Danh mục vai trò", roleTags.length],
    ["constraints", "Ràng buộc", `${constraints.filter((c) => c.enabled).length}/${constraints.length}`],
    ["general", "Cấu hình chung", "3 mục"],
  ];

  return {
    tab,
    setTab,
    shifts,
    constraints,
    generalSettings,
    roleTags,
    roleError,
    loading,
    offline,
    filters,
    setFilters,
    page,
    setPage,
    pageSize,
    setPageSize,
    editing,
    setEditing,
    deleting,
    setDeleting,
    toast,
    notify,
    rows,
    pageRows,
    activeCount,
    canClear,
    resetFilters,
    isShiftUsedInSchedule,
    saveShift,
    pauseShift,
    deleteShift,
    saveConstraints,
    saveGeneral,
    handleRoleAdd,
    handleRoleUpdate,
    handleRoleDelete,
    tabs,
  };
}

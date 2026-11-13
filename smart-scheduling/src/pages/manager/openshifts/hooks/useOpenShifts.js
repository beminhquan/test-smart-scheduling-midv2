import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  cancelOpenShift,
  createOpenShift,
  getOpenShifts,
  updateOpenShift,
  approveOpenShiftClaim,
  rejectOpenShiftClaim,
  subscribeOpenShift,
  getCancelRule,
  getEditRule,
  statusOf,
  weekdayOf,
  fmtDate,
  addDaysISO,
} from "../../../../services/openShiftService.js";
import { getShiftConfig } from "../../../../services/shiftConfigService.js";
import { fromPayload } from "../../shiftconfig/shiftConfigData.js";
import { PAGE_SIZES, compareShifts, getWeekLabel, getMondayOf } from "../openShiftData.js";
import { matchesSearch } from "../../../../lib/searchUtils.js";

const DEFAULT_FILTERS = { status: "all", q: "", role: "all" };

export function useOpenShifts() {
  const location = useLocation();
  const navigate = useNavigate();
  const fromSchedule = location.state?.shift;

  // Tuần đang thao tác: ưu tiên từ location.state, URL query ?week=, hoặc ngày ca chuyển từ lịch, mặc định 2026-11-02
  const [weekMonday, setWeekMonday] = useState(() => {
    const params = new URLSearchParams(location.search);
    const fromParam = params.get("week");
    const fromState = location.state?.weekMonday;
    const fromShift = fromSchedule?.date ? getMondayOf(fromSchedule.date) : null;
    return fromParam || fromState || fromShift || "2026-11-02";
  });

  const [shifts, setShifts] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);

  const [form, setForm] = useState(fromSchedule ? { shift: null } : null);
  const [detailId, setDetailId] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [notice, setNotice] = useState(null);

  // Điều hướng tuần
  const handlePrevWeek = () => setWeekMonday((prev) => addDaysISO(prev, -7));
  const handleNextWeek = () => setWeekMonday((prev) => addDaysISO(prev, 7));
  const weekLabel = getWeekLabel(weekMonday);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getOpenShifts({ week: weekMonday }),
      getShiftConfig().catch(() => ({})),
    ])
      .then(([list, cfg]) => {
        setShifts(list);
        setCatalog(fromPayload(cfg).shifts.filter((s) => s.status === "active"));
      })
      .catch(() => setLoadError("Không tải được danh sách ca trực mở."))
      .finally(() => setLoading(false));

    if (fromSchedule) navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekMonday]);

  useEffect(() => {
    const unsub = subscribeOpenShift(() => {
      getOpenShifts({ week: weekMonday }).then((list) => setShifts(list)).catch(() => {});
    });
    return unsub;
  }, [weekMonday]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const [prevFilterKey, setPrevFilterKey] = useState("");
  const currentFilterKey = `${JSON.stringify(filters)}|${pageSize}|${weekMonday}`;
  if (prevFilterKey !== currentFilterKey) {
    setPrevFilterKey(currentFilterKey);
    setPage(1);
  }

  const act = async (fn, success) => {
    try {
      await fn();
      setShifts(await getOpenShifts({ week: weekMonday }));
      setNotice({ message: success, type: "success" });
      return true;
    } catch (err) {
      setNotice({
        message: err.business ? err.message : (err?.response?.data?.message || "Không thực hiện được, vui lòng thử lại."),
        type: "error",
      });
      return false;
    }
  };

  const saveForm = async (payload) => {
    const payloadWithWeek = { ...payload, week: weekMonday };
    const ok = await act(
      () => (payloadWithWeek.id ? updateOpenShift(payloadWithWeek) : createOpenShift(payloadWithWeek)),
      payloadWithWeek.id ? "Đã cập nhật ca trực mở." : "Đã mở ca trực mới."
    );
    if (ok) setForm(null);
  };

  const confirmCancel = async (shift) => {
    const ok = await act(() => cancelOpenShift(shift.id), "Đã hủy ca trực mở.");
    if (ok) setCancelling(null);
  };

  const approveClaim = async (shiftId, registrationId) => {
    const ok = await act(
      () => approveOpenShiftClaim(shiftId, registrationId),
      "Đã duyệt nhân viên nhận ca thành công và cập nhật lịch làm việc."
    );
    if (ok) setDetailId(null);
    return ok;
  };

  const rejectClaim = async (shiftId, registrationId, reason) => {
    const ok = await act(
      () => rejectOpenShiftClaim(shiftId, registrationId, reason),
      "Đã từ chối đăng ký nhận ca."
    );
    if (ok) setDetailId(null);
    return ok;
  };

  const weekSunday = addDaysISO(weekMonday, 6);

  const baseFiltered = useMemo(() => {
    return shifts.filter((s) => {
      // Giới hạn hiển thị ca trong tuần đang thao tác (Thứ Hai đến Chủ Nhật)
      const d = (s.date || "").slice(0, 10);
      if (d && (d < weekMonday || d > weekSunday)) return false;

      if (filters.role !== "all") {
        const matchRole = s.roles ? s.roles.includes(filters.role) : (s.role === filters.role || s.roleTag === filters.role);
        if (!matchRole) return false;
      }

      return matchesSearch(filters.q, [
        s.shiftName,
        s.role,
        s.roleTag,
        ...(Array.isArray(s.roles) ? s.roles : []),
        fmtDate(s.date),
        weekdayOf(s.date),
        s.note,
        ...(s.claims || []).map((c) => c.name),
        ...(s.claims || []).map((c) => c.employeeId),
      ]);
    });
  }, [shifts, filters.q, filters.role, weekMonday, weekSunday]);

  const countOf = (tab) =>
    (tab === "all" ? baseFiltered : baseFiltered.filter((s) => statusOf(s) === tab)).length;

  const rows = useMemo(
    () =>
      baseFiltered
        .filter((s) => filters.status === "all" || statusOf(s) === filters.status)
        .sort((a, b) => compareShifts(a, b, statusOf)),
    [baseFiltered, filters.status]
  );

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(
    () => rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [rows, safePage, pageSize]
  );

  const canClear = filters.q !== "" || filters.role !== "all" || filters.status !== "all";
  const openCount = useMemo(
    () => shifts.filter((s) => {
      const d = (s.date || "").slice(0, 10);
      return (!d || (d >= weekMonday && d <= weekSunday)) && statusOf(s) === "open";
    }).length,
    [shifts, weekMonday, weekSunday]
  );
  const detail = shifts.find((s) => s.id === detailId) ?? null;

  const menuItems = (s) => {
    const edit = getEditRule(s);
    const cancel = getCancelRule(s);
    return [
      { label: "Xem chi tiết", onClick: () => setDetailId(s.id) },
      { label: "Sửa ca trực", disabled: !edit.allowed, onClick: () => setForm({ shift: s }) },
      {
        label: "Hủy ca trực",
        danger: true,
        disabled: !cancel.allowed,
        onClick: () => setCancelling(s),
      },
    ];
  };

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  return {
    fromSchedule,
    weekMonday,
    setWeekMonday,
    handlePrevWeek,
    handleNextWeek,
    weekLabel,
    shifts,
    catalog,
    loading,
    loadError,
    filters,
    setFilters,
    resetFilters,
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    form,
    setForm,
    detailId,
    setDetailId,
    cancelling,
    setCancelling,
    notice,
    saveForm,
    confirmCancel,
    approveClaim,
    rejectClaim,
    countOf,
    rows,
    pageCount,
    pageRows,
    canClear,
    openCount,
    detail,
    menuItems,
  };
}

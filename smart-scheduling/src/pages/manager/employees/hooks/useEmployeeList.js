import { useState, useEffect, useMemo, useCallback } from "react";
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  grantAccount,
  resetPassword,
  toggleLock,
  terminateEmployee,
  reactivateEmployee,
  subscribeEmployees,
  getNextEmployeeCode,
} from "../../../../services/employeeService";
import { matchesSearch } from "../../../../lib/searchUtils";
import {
  validateName,
  validatePhone,
  validateEmail,
  validateHourlyWage,
} from "../../../../lib/validators";

/**
 * Hook quản lý danh sách và nghiệp vụ CRUD nhân viên (US03 / US04 / US05 / US02)
 */
export function useEmployeeList() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getEmployees();
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Lỗi tải danh sách nhân viên:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsub = subscribeEmployees(loadData);
    return () => {
      unsub();
    };
  }, [loadData]);

  // Bộ lọc
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [contractFilter, setContractFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modal state: null | "add" | "edit" | "account" | "success" | "delete"
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const [notice, setNotice] = useState("");
  const [nextEmployeeCode, setNextEmployeeCode] = useState("");
  const [loadingNextCode, setLoadingNextCode] = useState(false);

  const fetchNextCode = useCallback(async () => {
    try {
      setLoadingNextCode(true);
      const res = await getNextEmployeeCode();
      const code = res?.next_code || res?.ma_nhan_vien || res?.data?.next_code || "";
      if (code) {
        setNextEmployeeCode(code);
      }
      return code;
    } catch (err) {
      console.error("Lỗi lấy mã nhân viên dự kiến:", err);
      return "";
    } finally {
      setLoadingNextCode(false);
    }
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const baseFiltered = useMemo(
    () =>
      employees.filter(
        (e) =>
          matchesSearch(search, [
            e.id,
            e.name,
            e.ho_ten,
            e.role,
            e.roleTag,
            e.phone,
            e.so_dien_thoai,
            e.email,
            e.account?.email,
            e.contract,
            e.status,
          ]) &&
          (!roleFilter || e.role === roleFilter || e.roleTag === roleFilter) &&
          (!contractFilter || e.contract === contractFilter)
      ),
    [employees, search, roleFilter, contractFilter]
  );

  const rows = useMemo(
    () =>
      baseFiltered.filter((e) =>
        !statusFilter ? e.status !== "Nghỉ việc" : e.status === statusFilter
      ),
    [baseFiltered, statusFilter]
  );

  // Thống kê đếm chuẩn: "Tất cả" = toàn bộ nhân viên trừ "Nghỉ việc"
  const countOf = (s) =>
    s
      ? baseFiltered.filter((e) => e.status === s).length
      : baseFiltered.filter((e) => e.status !== "Nghỉ việc").length;
  const canClear = search || roleFilter || contractFilter || statusFilter;

  const resetFilters = () => {
    setSearch("");
    setRoleFilter("");
    setContractFilter("");
    setStatusFilter("");
  };

  const openModal = (type, emp = null) => {
    setSelected(emp);
    setError("");
    if (type === "add") {
      fetchNextCode();
    }
    const roleVal = emp?.role || emp?.roleTag || (Array.isArray(emp?.roles) ? emp.roles[0] : "Phục vụ");
    setForm(
      emp
        ? {
            ...emp,
            roles: [roleVal],
            role: roleVal,
            email: emp.account?.email || emp.email || "",
            password: "", // Để trống khi sửa theo yêu cầu bảo mật
            hourlyWage: emp.hourlyWage ?? 28000,
          }
        : {
            roles: ["Phục vụ"],
            role: "Phục vụ",
            contract: "Bán thời gian",
            hourlyWage: 28000,
            createAccount: true,
            email: "",
          }
    );
    setModal(type);
  };

  const closeModal = () => {
    setModal(null);
    setSelected(null);
    setError("");
    setCreated(null); // US02: Đóng dialog là xóa mật khẩu tạm, không thể xem lại được nữa
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const isEmailTaken = (email, exceptId) =>
    employees.some(
      (e) =>
        e.id !== exceptId &&
        String(e.raw_id || e.id) !== String(exceptId) &&
        e.account?.email?.toLowerCase() === email?.trim().toLowerCase()
    );

  const handleAdd = async (emp) => {
    const roleVal = emp.role || (Array.isArray(emp.roles) ? emp.roles[0] : "Phục vụ");
    const expectedCode = emp.expected_code || emp.expectedId || emp.id || nextEmployeeCode;
    try {
      const res = await createEmployee({
        ...emp,
        expected_code: expectedCode,
        role: roleVal,
        roles: [roleVal],
      });
      const createdData = res.data || res;
      const actualCode = res.ma_nhan_vien || createdData.ma_nhan_vien || createdData.id;
      const tempPass = res.tempPassword || res.temp_password;

      // Bước 3: Đối chiếu kết quả giữa mã dự kiến và mã thực tế
      if (expectedCode && actualCode && expectedCode !== actualCode) {
        setNotice(`Đã thêm nhân viên ${createdData.name || createdData.ho_ten || emp.name}. Lưu ý: Mã nhân viên thực tế được cấp là ${actualCode} (khác mã dự kiến ${expectedCode}).`);
      } else {
        setNotice(`Đã thêm nhân viên ${createdData.name || createdData.ho_ten || emp.name} (${actualCode || ""}) thành công.`);
      }

      if (tempPass) {
        setCreated({
          name: createdData.name || createdData.ho_ten || emp.name,
          email: createdData.account?.email || emp.account?.email || emp.email,
          tempPassword: tempPass,
          isReset: false,
          actualCode: actualCode,
        });
        setModal("success");
      } else {
        closeModal();
      }
      await loadData();
      fetchNextCode();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Lỗi khi thêm nhân viên.");
      throw err;
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const hasAccount = !!selected.account;
    const nameCheck = validateName(form.name);
    if (!nameCheck.valid) return setError(nameCheck.error);
    const phoneCheck = validatePhone(form.phone);
    if (!phoneCheck.valid) return setError(phoneCheck.error);

    const roleVal = form.role || (Array.isArray(form.roles) ? form.roles[0] : "Phục vụ");

    if (hasAccount && form.email) {
      const emailCheck = validateEmail(form.email);
      if (!emailCheck.valid) return setError(emailCheck.error);
      if (isEmailTaken(form.email, selected.id))
        return setError("Email đã được sử dụng.");
    }

    const wageCheck = form.hourlyWage ? validateHourlyWage(form.hourlyWage) : { valid: true, value: selected.hourlyWage || 28000 };
    if (!wageCheck.valid) return setError(wageCheck.error);

    try {
      await updateEmployee(selected.id, {
        ...selected,
        name: nameCheck.value,
        ho_ten: nameCheck.value,
        phone: phoneCheck.value,
        so_dien_thoai: phoneCheck.value,
        birthDate: form.birthDate || null,
        ngay_sinh: form.birthDate || null,
        contract: form.contract,
        role: roleVal,
        roles: [roleVal],
        hourlyWage: wageCheck.value,
        status: form.status || selected.status,
        email: hasAccount ? form.email.trim() : selected.email,
      });
      setNotice(`Đã lưu thay đổi cho ${form.name.trim()}.`);
      closeModal();
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Lỗi khi cập nhật nhân viên.");
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    const emailCheck = validateEmail(form.email);
    if (!emailCheck.valid) return setError(emailCheck.error);
    if (isEmailTaken(form.email, selected.id)) return setError("Email này đã được dùng cho tài khoản khác.");

    try {
      const res = await grantAccount(selected.id, form.email.trim());
      const tempPass = res.tempPassword || res.temp_password;

      setCreated({
        name: selected.name,
        email: form.email.trim(),
        tempPassword: tempPass,
        isReset: false,
      });
      setSelected(null);
      setModal("success");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Lỗi khi cấp tài khoản.");
    }
  };

  const handleResetPassword = async (emp) => {
    try {
      const res = await resetPassword(emp.id);
      const tempPass = res.tempPassword || res.temp_password;

      setCreated({
        name: emp.name,
        email: emp.account?.email || emp.email,
        tempPassword: tempPass,
        isReset: true,
      });
      setModal("success");
      await loadData();
    } catch (err) {
      setNotice(`Lỗi khi đặt lại mật khẩu: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleToggleLock = async (emp) => {
    try {
      const isCurrentlyLocked = emp.account?.status === "locked";
      await toggleLock(emp.id, !isCurrentlyLocked);
      setNotice(isCurrentlyLocked ? `Đã mở khóa tài khoản cho ${emp.name}.` : `Đã khóa tài khoản của ${emp.name}.`);
      await loadData();
    } catch (err) {
      setNotice(`Lỗi thay đổi trạng thái tài khoản: ${err.response?.data?.message || err.message}`);
    }
  };

  const confirmDelete = async () => {
    try {
      const res = await terminateEmployee(selected.id);
      setNotice(res.message || `Đã chuyển ${selected.name} sang trạng thái nghỉ việc.`);
      closeModal();
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Lỗi khi cho nghỉ việc.");
    }
  };

  const handleReactivate = async (emp) => {
    try {
      await reactivateEmployee(emp.id);
      setNotice(`Đã kích hoạt lại nhân viên ${emp.name}.`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Lỗi khi kích hoạt lại.");
    }
  };

  const menuItems = (emp) => [
    { label: "Sửa thông tin", onClick: () => openModal("edit", emp) },
    ...(!emp.account ? [{ label: "Cấp tài khoản", onClick: () => openModal("account", emp) }] : []),
    ...(emp.account ? [{ label: "Đặt lại mật khẩu", onClick: () => handleResetPassword(emp) }] : []),
    ...(emp.account && emp.status !== "Nghỉ việc"
      ? [{
          label: emp.account.status === "locked" ? "Mở khóa tài khoản" : "Khóa tài khoản",
          onClick: () => handleToggleLock(emp),
        }]
      : []),
    ...(emp.status !== "Nghỉ việc"
      ? [{ label: "Cho nghỉ việc", danger: true, onClick: () => openModal("delete", emp) }]
      : [{ label: "Kích hoạt lại", onClick: () => handleReactivate(emp) }]),
  ];

  return {
    employees,
    loading,
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    contractFilter,
    setContractFilter,
    statusFilter,
    setStatusFilter,
    rows,
    countOf,
    canClear,
    resetFilters,
    modal,
    selected,
    form,
    error,
    created,
    notice,
    openModal,
    closeModal,
    handleChange,
    isEmailTaken,
    handleAdd,
    handleUpdate,
    handleCreateAccount,
    confirmDelete,
    menuItems,
    nextEmployeeCode,
    nextCode: nextEmployeeCode,
    loadingNextCode,
    fetchNextCode,
  };
}

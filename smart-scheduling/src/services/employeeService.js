// =============================================================================
// File: src/services/employeeService.js
// Tầng: Dịch Vụ Nhân Sự (Employee Service) - Kết nối thực tế Backend Laravel & MySQL
// =============================================================================

import httpClient from "./httpClient.js";
import { mockEmployees } from "../mocks/employeeMock.js";

export { mockEmployees };

const listeners = new Set();

export function notifyEmployeesChange() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  });
}

export const subscribeEmployees = (cb) => {
  if (typeof cb === "function") {
    listeners.add(cb);
  }
  return () => {
    listeners.delete(cb);
  };
};

/**
 * 1. Lấy danh sách toàn bộ nhân viên từ MySQL qua Backend Laravel
 * Endpoint: GET /api/employees
 */
export async function list(params = {}) {
  const res = await httpClient.get("/employees", { params });
  const data = res.data?.data || res.data || [];
  return Array.isArray(data) ? data : [];
}
export const getEmployees = list;

/**
 * 2. Lấy chi tiết nhân viên theo ID
 */
export async function getById(id) {
  const cleanId = String(id).replace(/[^0-9]/g, "");
  const all = await list();
  return all.find((e) => String(e.raw_id || e.id) === String(cleanId) || e.id === id) || null;
}
export const getEmployeeById = getById;

/**
 * 2.1. Lấy mã nhân viên dự kiến tiếp theo từ AUTO_INCREMENT thực tế của Database
 * Endpoint: GET /api/employees/next-code
 */
export async function getNextEmployeeCode() {
  const res = await httpClient.get("/employees/next-code");
  return res.data?.data || res.data || {};
}
export const getNextCode = getNextEmployeeCode;

/**
 * 3. Tạo mới nhân viên và cấp tài khoản (US05, US02)
 * Endpoint: POST /api/employees
 */
export async function create(data) {
  const roleVal = data.role || (Array.isArray(data.roles) && data.roles[0]) || "Phục vụ";
  const payload = {
    name: data.name,
    ho_ten: data.name,
    expected_code: data.expected_code || data.expectedId || data.id || null,
    phone: data.phone,
    so_dien_thoai: data.phone,
    birthDate: data.birthDate || null,
    ngay_sinh: data.birthDate || null,
    contract: data.contract || data.contractType || "Bán thời gian",
    loai_hop_dong: data.contract || data.contractType || "Bán thời gian",
    role: roleVal,
    role_tag_id: data.role_tag_id || null,
    hourlyWage: Number(data.hourlyWage || data.hourlyRate) || 28000,
    muc_luong_gio: Number(data.hourlyWage || data.hourlyRate) || 28000,
    status: data.status || "ACTIVE",
    trang_thai: data.status === "Nghỉ việc" ? "INACTIVE" : "ACTIVE",
    createAccount: Boolean(data.createAccount || data.account),
    create_account: Boolean(data.createAccount || data.account),
    email: data.account?.email || data.email || null,
  };

  const res = await httpClient.post("/employees", payload);
  notifyEmployeesChange();

  return {
    ...res.data,
    ma_nhan_vien: res.data?.ma_nhan_vien || res.data?.data?.ma_nhan_vien || res.data?.data?.id,
    nhan_vien_id: res.data?.nhan_vien_id || res.data?.data?.nhan_vien_id,
    expected_code_matched: res.data?.expected_code_matched ?? true,
    tempPassword: res.data?.tempPassword || res.data?.temp_password,
    temp_password: res.data?.temp_password || res.data?.tempPassword,
    data: res.data?.data || res.data,
  };
}
export const createEmployee = create;

/**
 * 4. Cập nhật thông tin nhân viên
 * Endpoint: PUT /api/employees/{id}
 */
export async function update(id, data) {
  const cleanId = String(id).replace(/[^0-9]/g, "");
  const roleVal = data.role || (Array.isArray(data.roles) && data.roles[0]) || undefined;

  const payload = {
    ...data,
    id: cleanId,
    nhan_vien_id: cleanId,
    name: data.name,
    ho_ten: data.name,
    phone: data.phone,
    so_dien_thoai: data.phone,
    birthDate: data.birthDate,
    ngay_sinh: data.birthDate,
    contract: data.contract,
    loai_hop_dong: data.contract,
    role: roleVal,
    hourlyWage: data.hourlyWage,
    muc_luong_gio: data.hourlyWage,
    status: data.status,
    trang_thai: data.status === "Nghỉ việc" ? "INACTIVE" : "ACTIVE",
    email: data.account?.email || data.email || undefined,
  };

  const res = await httpClient.put(`/employees/${cleanId}`, payload);
  notifyEmployeesChange();

  return {
    ...res.data,
    tempPassword: res.data?.tempPassword || res.data?.temp_password,
    temp_password: res.data?.temp_password || res.data?.tempPassword,
  };
}
export const updateEmployee = update;

/**
 * 5. Cấp tài khoản mới cho nhân viên đã có hồ sơ (US02)
 * Endpoint: POST /api/employees/{id}/grant-account
 */
export async function grantAccount(id, email) {
  const cleanId = String(id).replace(/[^0-9]/g, "");
  const res = await httpClient.post(`/employees/${cleanId}/grant-account`, { email });
  notifyEmployeesChange();

  return {
    ...res.data,
    tempPassword: res.data?.tempPassword || res.data?.temp_password,
    temp_password: res.data?.temp_password || res.data?.tempPassword,
  };
}

/**
 * 6. Đặt lại mật khẩu tạm thời cho nhân viên (US02)
 * Endpoint: POST /api/employees/{id}/reset-password
 */
export async function resetPassword(id) {
  const cleanId = String(id).replace(/[^0-9]/g, "");
  const res = await httpClient.post(`/employees/${cleanId}/reset-password`);
  notifyEmployeesChange();

  return {
    ...res.data,
    tempPassword: res.data?.tempPassword || res.data?.temp_password,
    temp_password: res.data?.temp_password || res.data?.tempPassword,
  };
}

/**
 * 7. Khóa / Mở khóa tài khoản nhân viên
 * Endpoint: PATCH /api/employees/{id}/lock
 */
export async function toggleLock(id, locked = true) {
  const cleanId = String(id).replace(/[^0-9]/g, "");
  const res = await httpClient.patch(`/employees/${cleanId}/lock`, { locked });
  notifyEmployeesChange();
  return res.data;
}

/**
 * 8. Cho nhân viên nghỉ việc (US06 - Không xóa cứng, kiểm tra ca làm tương lai)
 * Endpoint: DELETE /api/employees/{id}
 */
export async function terminateEmployee(id) {
  const cleanId = String(id).replace(/[^0-9]/g, "");
  const res = await httpClient.delete(`/employees/${cleanId}`);
  notifyEmployeesChange();
  return res.data;
}

/**
 * 9. Kích hoạt lại nhân viên
 */
export async function reactivateEmployee(id) {
  const cleanId = String(id).replace(/[^0-9]/g, "");
  const res = await httpClient.put(`/employees/${cleanId}`, {
    status: "Đang làm việc",
    trang_thai: "ACTIVE",
  });
  // Mở khóa tài khoản nếu có
  try {
    await httpClient.patch(`/employees/${cleanId}/lock`, { locked: false });
  } catch {
    /* ignore */
  }
  notifyEmployeesChange();
  return res.data;
}

/**
 * Cập nhật trạng thái nhân viên
 */
export async function setStatus(id, status) {
  const cleanId = String(id).replace(/[^0-9]/g, "");
  const res = await httpClient.put(`/employees/${cleanId}`, {
    status,
    trang_thai: status === "Nghỉ việc" ? "INACTIVE" : "ACTIVE",
  });
  notifyEmployeesChange();
  return res.data;
}
export const setEmployeeStatus = setStatus;

/**
 * Lấy hồ sơ cá nhân
 */
export async function getMyProfile() {
  const res = await httpClient.get("/auth/me");
  return res.data?.user || res.data;
}

/**
 * Cập nhật hồ sơ cá nhân
 */
export async function updateMyProfile(data, user) {
  const id = user?.nhan_vien_id || user?.id;
  return update(id, data);
}

export default {
  list,
  getEmployees,
  getById,
  getEmployeeById,
  create,
  createEmployee,
  update,
  updateEmployee,
  grantAccount,
  resetPassword,
  toggleLock,
  terminateEmployee,
  reactivateEmployee,
  setStatus,
  setEmployeeStatus,
  getMyProfile,
  updateMyProfile,
  subscribeEmployees,
  notifyEmployeesChange,
};

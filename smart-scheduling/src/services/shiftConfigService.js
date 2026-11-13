// =============================================================================
// File: src/services/shiftConfigService.js
// Tầng: Dịch Vụ Cấu Hình Ca (Shift Config Service) - Kết nối Backend Laravel thực tế
// =============================================================================

import httpClient from "./httpClient";

// Danh mục vai trò mặc định dự phòng toàn hệ thống
export const STANDARD_ROLES = ["Phục vụ", "Pha chế", "Thu ngân"];

/**
 * 1. Lấy dữ liệu cấu hình tổng hợp: Ca mẫu + 11 Ràng buộc + Cấu hình chung + Role_Tags
 * Endpoint: GET /api/shift-config
 */
export const getShiftConfig = async () => {
  const res = await httpClient.get("/shift-config");
  return res.data?.data || res.data;
};

/**
 * 2. Lưu dữ liệu cấu hình tổng hợp
 * Endpoint: PUT /api/shift-config
 */
export const saveShiftConfig = async (payload) => {
  const res = await httpClient.put("/shift-config", payload);
  return res.data?.data || res.data;
};

/**
 * 3. Lấy danh mục vai trò (Role_Tag)
 * Endpoint: GET /api/role-tags
 */
export const getRoleTags = async () => {
  const res = await httpClient.get("/role-tags");
  if (Array.isArray(res.data?.roles)) {
    return res.data.roles;
  }
  if (Array.isArray(res.data?.data)) {
    return res.data.data.map((r) => r.name || r.ten_role || r);
  }
  return STANDARD_ROLES;
};

/**
 * 4. Thêm vai trò mới
 * Endpoint: POST /api/role-tags
 */
export const addRoleTag = async (roleName) => {
  const res = await httpClient.post("/role-tags", { name: roleName });
  if (Array.isArray(res.data?.roles)) {
    return res.data.roles;
  }
  if (Array.isArray(res.data?.data)) {
    return res.data.data.map((r) => r.name || r.ten_role || r);
  }
  return [];
};

/**
 * 5. Cập nhật tên vai trò
 * Endpoint: PUT /api/role-tags
 */
export const updateRoleTag = async (oldRole, newRole) => {
  const res = await httpClient.put("/role-tags", { oldRole, newRole });
  if (Array.isArray(res.data?.roles)) {
    return res.data.roles;
  }
  if (Array.isArray(res.data?.data)) {
    return res.data.data.map((r) => r.name || r.ten_role || r);
  }
  return [];
};

/**
 * 6. Xóa vai trò (có kiểm tra khóa ngoại nhân viên và nhu cầu ca)
 * Endpoint: DELETE /api/role-tags
 */
export const deleteRoleTag = async (roleName) => {
  const res = await httpClient.delete("/role-tags", { data: { roleName } });
  if (Array.isArray(res.data?.roles)) {
    return res.data.roles;
  }
  if (Array.isArray(res.data?.data)) {
    return res.data.data.map((r) => r.name || r.ten_role || r);
  }
  return [];
};

/**
 * 7. Xóa ca mẫu độc lập theo ID (kiểm tra an toàn dữ liệu lịch sử)
 * Endpoint: DELETE /api/shifts/{id}
 */
export const deleteShift = async (shiftId) => {
  const res = await httpClient.delete(`/shifts/${shiftId}`);
  return res.data;
};

/**
 * 8. Tạm dừng ca mẫu
 * Endpoint: PATCH /api/shifts/{id}/status
 */
export const pauseShift = async (shiftId) => {
  const res = await httpClient.patch(`/shifts/${shiftId}/status`, { status: "PAUSED" });
  return res.data;
};

export default {
  getShiftConfig,
  saveShiftConfig,
  getRoleTags,
  addRoleTag,
  updateRoleTag,
  deleteRoleTag,
  deleteShift,
  pauseShift,
  STANDARD_ROLES,
};

// =============================================================================
// File: src/services/authService.js
// Tầng: Dịch Vụ Xác Thực (Auth Service)
// Nhiệm vụ: Xử lý đăng nhập, đăng xuất, lưu phiên và kiểm tra phân quyền.
// =============================================================================

import { mockUsers, changeUserPassword } from "../mocks/authMock.js";
import httpClient from "./httpClient.js";
import { ERROR_CODES, AppError } from "./errors.js";
import { ROLES } from "../lib/constants.js";

let inMemorySession = null;

export function getSession() {
  try {
    if (typeof sessionStorage !== "undefined") {
      const sUser = sessionStorage.getItem("user");
      const sToken = sessionStorage.getItem("token");
      if (sUser && sToken) {
        const user = JSON.parse(sUser);
        if (user && typeof user === "object") {
          return { user, token: sToken };
        }
      }
    }

    if (typeof localStorage !== "undefined") {
      const lUser = localStorage.getItem("user");
      const lToken = localStorage.getItem("token");
      if (lUser && lToken) {
        const user = JSON.parse(lUser);
        if (user && typeof user === "object") {
          if (typeof sessionStorage !== "undefined") {
            sessionStorage.setItem("user", lUser);
            sessionStorage.setItem("token", lToken);
          }
          return { user, token: lToken };
        }
      }
    }

    if (inMemorySession) {
      return inMemorySession;
    }

    return null;
  } catch {
    return inMemorySession || null;
  }
}

export function saveSession(user, token, rememberMe = false) {
  inMemorySession = { user, token };

  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem("user", JSON.stringify(user));
    sessionStorage.setItem("token", token);
  }

  if (typeof localStorage !== "undefined") {
    if (rememberMe) {
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("token", token);
      localStorage.setItem("rememberMe", "true");
    } else {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      localStorage.removeItem("rememberMe");
    }
  }
}

export function clearSession() {
  inMemorySession = null;
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("token");
  }

  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("rememberMe");
    localStorage.removeItem("SMART_SCHEDULING_REMEMBERED_EMAIL");
  }
}

export function getCurrentUser() {
  const session = getSession();
  return session?.user || null;
}

export async function login(account, password, rememberMe = false) {
  try {
    const res = await httpClient.post("/auth/login", {
      login: account,
      email: account,
      password,
    });

    const resData = res.data;
    const user = resData.user || resData.data?.user;
    const token = resData.token || resData.data?.token;

    if (!user || !token) {
      throw new AppError(ERROR_CODES.INTERNAL_ERROR, "Dữ liệu đăng nhập từ máy chủ không hợp lệ.", 500);
    }

    saveSession(user, token, rememberMe);
    return { user, token, message: resData.message };
  } catch (err) {
    if (err instanceof AppError) throw err;
    const resData = err.response?.data;
    const status = err.response?.status || 400;
    const msg =
      resData?.message ||
      resData?.error?.message ||
      (status === 401
        ? "Tài khoản hoặc mật khẩu không đúng."
        : status === 403
        ? "Tài khoản không có quyền hoặc đã bị vô hiệu hóa."
        : status === 404
        ? "Tài khoản hoặc mã nhân viên không tồn tại."
        : "Không thể kết nối đến máy chủ.");
    const code =
      status === 401
        ? ERROR_CODES.INVALID_CREDENTIALS
        : status === 403
        ? ERROR_CODES.FORBIDDEN
        : status === 404
        ? ERROR_CODES.NOT_FOUND
        : ERROR_CODES.VALIDATION_ERROR;
    throw new AppError(code, msg, status);
  }
}

export async function logout() {
  try {
    await httpClient.post("/auth/logout");
  } catch (err) {
    console.warn("Lỗi thu hồi token máy chủ khi đăng xuất:", err);
  } finally {
    clearSession();
  }
  return { message: "Đã đăng xuất thành công." };
}

/**
 * Đổi mật khẩu cho người dùng hiện tại (US02) - Gọi API Backend Laravel
 */
export async function changePassword(currentPassword, newPassword) {
  const session = getSession();
  const currentUser = session?.user;
  if (!currentUser) {
    throw new AppError(ERROR_CODES.UNAUTHORIZED, "Vui lòng đăng nhập để đổi mật khẩu.", 401);
  }

  try {
    const res = await httpClient.post("/auth/change-password", {
      current_password: currentPassword,
      currentPassword,
      new_password: newPassword,
      newPassword,
      confirm_password: newPassword,
      confirmPassword: newPassword,
    });

    // Cập nhật lại phiên với mustChangePassword = false
    const updatedUser = { ...currentUser, mustChangePassword: false, must_change_password: false };
    saveSession(updatedUser, session.token, true);

    return {
      status: true,
      message: res.data?.message || "Đổi mật khẩu thành công.",
      user: updatedUser,
    };
  } catch (err) {
    const resData = err.response?.data;
    const msg = resData?.message || err.message || "Lỗi khi đổi mật khẩu.";
    const field = resData?.field;
    const error = new AppError(ERROR_CODES.VALIDATION_ERROR, msg, err.response?.status || 400);
    if (field) error.field = field;
    throw error;
  }
}

export async function getSessionAsync() {
  const session = getSession();
  if (session) return session;
  // Trả về mặc định quản lý nếu chưa có session trong môi trường dev
  return { user: mockUsers[0], token: "mock-jwt-token-manager" };
}

export function hasRole(requiredRole) {
  const user = getCurrentUser();
  if (!user) return false;
  const currentRole = user.role === "employee" ? ROLES.STAFF : user.role;
  const targetRole = requiredRole === "employee" ? ROLES.STAFF : requiredRole;
  return currentRole === targetRole;
}

export function requireAuth() {
  const user = getCurrentUser();
  if (!user) {
    throw new AppError(ERROR_CODES.UNAUTHORIZED, "Vui lòng đăng nhập để tiếp tục.", 401);
  }
  return user;
}

export function requireRole(requiredRole) {
  const user = requireAuth();
  const currentRole = user.role === "employee" ? ROLES.STAFF : user.role;
  const targetRole = requiredRole === "employee" ? ROLES.STAFF : requiredRole;
  if (currentRole !== targetRole) {
    throw new AppError(ERROR_CODES.FORBIDDEN, "Bạn không có quyền thực hiện thao tác này.", 403);
  }
  return user;
}

export function requireManager() {
  return requireRole(ROLES.MANAGER);
}

export function resolveStaffIdentity() {
  const user = requireRole(ROLES.STAFF);
  const employeeId = user.employeeId || user.id;
  if (!employeeId) {
    throw new AppError(ERROR_CODES.FORBIDDEN, "Không tìm thấy hồ sơ nhân sự liên kết với tài khoản này.", 403);
  }
  return { user, employeeId };
}

export { ERROR_CODES, AppError };

export default {
  login,
  logout,
  changePassword,
  getSession,
  getSessionAsync,
  saveSession,
  clearSession,
  getCurrentUser,
  hasRole,
  requireAuth,
  requireRole,
  requireManager,
  resolveStaffIdentity,
};

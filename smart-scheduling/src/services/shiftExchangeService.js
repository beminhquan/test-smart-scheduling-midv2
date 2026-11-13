// =============================================================================
// File: src/services/shiftExchangeService.js
// Tầng: Dịch vụ Đổi ca làm việc (US15, US16, US17)
// =============================================================================

import httpClient from "./httpClient.js";
import { getCurrentUser } from "./authService.js";
import { createNotification } from "./notificationService.js";

const listeners = new Set();

export const subscribeShiftExchange = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const notifyShiftExchangeChange = () => {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error("ShiftExchange listener error:", e);
    }
  });
};

/**
 * 1. Lấy danh sách yêu cầu đổi ca (Staff & Manager)
 * - Nếu Staff: Backend trả về { sent: [...], received: [...] }
 * - Nếu Manager: Backend trả về danh sách tất cả yêu cầu
 */
export const getExchangeRequests = async (params) => {
  try {
    const user = getCurrentUser();
    const endpoint = user?.role === "manager" ? "/manager/shift-exchange" : "/staff/shift-exchange";
    const res = await httpClient.get(endpoint, { params });
    if (res?.data) {
      return res.data;
    }
  } catch (err) {
    console.warn("getExchangeRequests API fallback:", err?.message);
    // Fallback thử endpoint chung
    try {
      const res = await httpClient.get("/shift-exchange", { params });
      if (res?.data) return res.data;
    } catch {
      // ignore
    }
  }
  return { sent: [], received: [] };
};

/**
 * 2. Lấy danh sách đồng nghiệp rảnh ca và đủ điều kiện để đổi ca
 */
export const getExchangeCandidates = async (shift, currentUserId) => {
  try {
    const shiftId = shift?.id ?? shift?.phan_cong_ca_id;
    const res = await httpClient.get("/staff/shift-exchange/candidates", {
      params: { shift_id: shiftId },
    });
    if (res?.data?.data) return res.data.data;
    if (Array.isArray(res?.data)) return res.data;
  } catch (err) {
    console.warn("getExchangeCandidates API error:", err?.message);
  }
  return [];
};

/**
 * 3. Tạo yêu cầu đổi ca mới (Staff A gửi cho Staff B)
 */
export const createExchangeRequest = async (data) => {
  const shiftId = data.shift_id ?? data.shift?.id ?? data.shift?.phan_cong_ca_id;
  const recipientId = data.recipient_id ?? data.targetEmployeeId;
  const note = data.note ?? data.reason ?? "";

  const payload = {
    shift_id: shiftId,
    recipient_id: recipientId,
    targetEmployeeId: recipientId,
    reason: note,
    note: note,
  };

  const res = await httpClient.post("/staff/shift-exchange", payload);
  notifyShiftExchangeChange();

  // Tạo thông báo cho đồng nghiệp nhận yêu cầu
  try {
    createNotification({
      title: "Yêu cầu đổi ca mới",
      content: `Đồng nghiệp gửi yêu cầu đổi ca. Vui lòng kiểm tra và phản hồi.`,
      type: "shift_exchange",
      link: "/employee/shift-exchange",
      recipientRole: "staff",
    });
  } catch {}

  return res?.data?.data ?? res?.data;
};

export const sendExchangeRequest = createExchangeRequest;

/**
 * 4. Đồng nghiệp phản hồi: Đồng ý hoặc Từ chối (Staff B)
 * Lưu ý: Khi đồng ý, trạng thái chuyển sang pending_manager (chờ Quản lý duyệt), chưa cập nhật lịch.
 */
export const peerRespondExchange = async (id, data) => {
  const rawId = String(id).replace(/\D/g, "");
  const action = data.action === "accept" || data.status === "accepted" ? "accept" : "decline";
  const payload = {
    action,
    reason: data.reason ?? data.declineReason ?? "",
  };

  const res = await httpClient.post(`/staff/shift-exchange/${rawId}/respond`, payload);
  notifyShiftExchangeChange();

  if (action === "accept") {
    // Thông báo cho Quản lý có yêu cầu chờ duyệt
    try {
      createNotification({
        title: "Yêu cầu đổi ca chờ duyệt",
        content: `Đồng nghiệp đã đồng ý đổi ca. Đang chờ Quản lý phê duyệt.`,
        type: "shift_exchange",
        link: "/admin/shift-exchange",
        recipientRole: "manager",
      });
    } catch {}
  }

  return res?.data?.data ?? res?.data;
};

/**
 * 5. Quản lý phê duyệt đổi ca (Manager)
 * Backend kiểm tra lại ràng buộc và cập nhật lịch làm việc của 2 nhân viên trong DB Transaction
 */
export const managerApproveExchange = async (id, managerNote = "") => {
  const u = getCurrentUser();
  if (u && u.role !== "manager") {
    throw new Error("Chỉ Quản lý mới có quyền phê duyệt đơn đổi ca.");
  }
  const rawId = String(id).replace(/\D/g, "");
  const res = await httpClient.post(`/manager/shift-exchange/${rawId}/approve`, {
    managerNote,
  });
  notifyShiftExchangeChange();
  return res?.data?.data ?? res?.data;
};

/**
 * 6. Quản lý từ chối đổi ca (Manager)
 */
export const managerRejectExchange = async (id, rejectReason = "") => {
  const u = getCurrentUser();
  if (u && u.role !== "manager") {
    throw new Error("Chỉ Quản lý mới có quyền từ chối đơn đổi ca.");
  }
  const rawId = String(id).replace(/\D/g, "");
  const res = await httpClient.post(`/manager/shift-exchange/${rawId}/reject`, {
    rejectReason,
  });
  notifyShiftExchangeChange();
  return res?.data?.data ?? res?.data;
};

/**
 * 7. Nhân viên hủy yêu cầu đổi ca đang chờ xử lý
 */
export const cancelExchangeRequest = async (id) => {
  const rawId = String(id).replace(/\D/g, "");
  const res = await httpClient.post(`/staff/shift-exchange/${rawId}/cancel`);
  notifyShiftExchangeChange();
  return res?.data?.data ?? res?.data;
};

/**
 * 8. Dispatcher phản hồi dùng chung
 */
export const respondExchange = async (id, data) => {
  if (data.action === "peer_respond" || data.action === "accept" || data.action === "decline") {
    return peerRespondExchange(id, data);
  }
  if (data.action === "approve") {
    return managerApproveExchange(id, data.managerNote);
  }
  if (data.action === "reject") {
    return managerRejectExchange(id, data.rejectReason);
  }
  if (data.action === "cancel") {
    return cancelExchangeRequest(id);
  }
  return { id, ...data };
};

export default {
  getExchangeRequests,
  getExchangeCandidates,
  createExchangeRequest,
  sendExchangeRequest,
  peerRespondExchange,
  managerApproveExchange,
  managerRejectExchange,
  cancelExchangeRequest,
  respondExchange,
  subscribeShiftExchange,
  notifyShiftExchangeChange,
};

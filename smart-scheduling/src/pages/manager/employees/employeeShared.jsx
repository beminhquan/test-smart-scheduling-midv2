import { useState } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { STATUSES } from "./employeeData";
import { STANDARD_ROLES } from "../../../services/shiftConfigService";

// Các thành phần dùng chung cho form nhân viên (thêm / sửa / cấp tài khoản)

export const ROLES = STANDARD_ROLES;
export const CONTRACTS = ["Toàn thời gian", "Bán thời gian"];

export const fieldClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100";

export const getFieldClass = (hasError) =>
  `w-full rounded-lg border bg-white px-3 py-2 text-[14px] text-slate-900 outline-none placeholder:text-slate-400 transition ${
    hasError
      ? "border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
      : "border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
  }`;

export function Field({ label, helper, error, children, className = "" }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-[13px] font-medium text-slate-600">{label}</label>
      {children}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-[12px] text-rose-600 font-medium">
          <AlertCircle size={13} className="shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {!error && helper && <p className="mt-1 text-[12px] text-slate-500">{helper}</p>}
    </div>
  );
}

export function FormError({ message }) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-[14px] text-rose-800">
      <AlertCircle size={16} className="shrink-0 text-rose-600" />
      <span>{message}</span>
    </div>
  );
}

export function PasswordInput({ error, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${getFieldClass(Boolean(error))} pr-10`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-800"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

// Nhóm ô "Thông tin nhân viên" (dùng cho cả form thêm và form sửa)
// Quy tắc Role_Tag: Mỗi nhân viên chỉ có DUY NHẤT một vai trò chính (Single Select)
export function EmployeeFields({ form, onChange, onBlur, errors = {} }) {
  const selectedRole = form.role || (Array.isArray(form.roles) && form.roles[0]) || "Phục vụ";

  const handleRoleChange = (e) => {
    const chosen = e.target.value;
    onChange({ target: { name: "role", value: chosen } });
    onChange({ target: { name: "roles", value: [chosen] } });
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Mã nhân viên">
        <input value={form.id || ""} disabled className={`${fieldClass} bg-slate-50 text-slate-500`} />
      </Field>
      <Field label="Họ và tên *" error={errors.name}>
        <input
          name="name"
          value={form.name || ""}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="Nguyễn Văn A"
          className={getFieldClass(Boolean(errors.name))}
        />
      </Field>
      <Field label="Số điện thoại *" error={errors.phone}>
        <input
          name="phone"
          value={form.phone || ""}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="0912345678"
          className={getFieldClass(Boolean(errors.phone))}
        />
      </Field>
      <Field label="Ngày sinh" error={errors.birthDate}>
        <input
          type="date"
          name="birthDate"
          value={form.birthDate || ""}
          onChange={onChange}
          onBlur={onBlur}
          className={getFieldClass(Boolean(errors.birthDate))}
        />
      </Field>
      <Field label="Loại hợp đồng">
        <select name="contract" value={form.contract || "Toàn thời gian"} onChange={onChange} className={fieldClass}>
          {CONTRACTS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Vai trò (Role_Tag) *" error={errors.role || errors.roles}>
        <select
          name="role"
          value={selectedRole}
          onChange={handleRoleChange}
          className={getFieldClass(Boolean(errors.role || errors.roles))}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Lương theo giờ (VNĐ)" error={errors.hourlyWage}>
        <input
          type="number"
          name="hourlyWage"
          value={form.hourlyWage ?? ""}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="Ví dụ: 30000"
          min="0"
          step="1000"
          className={getFieldClass(Boolean(errors.hourlyWage))}
        />
      </Field>
      <Field label="Trạng thái">
        <select name="status" value={form.status || "Đang làm việc"} onChange={onChange} className={fieldClass}>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
    </div>
  );
}

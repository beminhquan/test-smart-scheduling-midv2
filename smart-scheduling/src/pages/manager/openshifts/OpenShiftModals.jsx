import { useState, useEffect } from "react";
import { Modal } from "../../../components/FormKit";
import { Button } from "../../../components/FormKit";
import { Field, inputClass } from "../../../components/PageKit";
import { MAX_NEEDED, MAX_NOTE, ROLES, dayLabel, getEditRule, validateOpenShift, getOpenShiftSources } from "../../../services/openShiftService.js";
import { dayOptions, getMondayOf } from "./openShiftData.js";
import { validateBonus, validateNote } from "../../../lib/validators";

// Hai hộp thoại của trang Ca trực mở: mở/sửa ca và xác nhận hủy ca.

const noteClass = "rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-[14px] text-slate-900";

// Mở ca mới (shift = undefined) hoặc sửa ca.
// Giới hạn ngày trực theo tuần: Chỉ cho phép chọn các ngày từ Thứ Hai đến Chủ Nhật của tuần đang thao tác.
export function OpenShiftFormModal({ shift, shifts, catalog, prefill, weekMonday, onClose, onSubmit }) {
  const targetWeekMonday = weekMonday || (shift?.date ? getMondayOf(shift.date) : "2026-11-02");
  const rule = shift ? getEditRule(shift) : { locked: false, minNeeded: 1 };
  const options = dayOptions(targetWeekMonday, shift?.date);

  const [form, setForm] = useState(
    shift ?? prefill ?? {
      date: options[0]?.value || targetWeekMonday,
      shiftCode: catalog[0]?.code ?? "",
      role: ROLES[0],
      needed: 1,
      bonus: 0,
      note: "",
    }
  );
  const [sources, setSources] = useState({ deficient_shifts: [], leave_replacements: [] });
  const [selectedSourceKey, setSelectedSourceKey] = useState("manual");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!shift) {
      getOpenShiftSources({ week: targetWeekMonday }).then(setSources).catch(() => {});
    }
  }, [targetWeekMonday, shift]);

  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    setError("");
  };

  // Ca đã chọn có thể là ca đã bị tạm dừng ở trang cấu hình (khi sửa ca cũ): vẫn hiện để không mất dữ liệu.
  const picked = catalog.find((c) => c.code === form.shiftCode) ?? (shift && { code: shift.shiftCode, name: shift.shiftName, startTime: shift.startTime, endTime: shift.endTime });
  const choices = picked && !catalog.some((c) => c.code === picked.code) ? [...catalog, picked] : catalog;

  const submit = (e) => {
    e.preventDefault();
    const bonusCheck = validateBonus(form.bonus);
    if (!bonusCheck.valid) return setError(bonusCheck.error);
    const noteCheck = validateNote(form.note, { required: false, maxLength: 200, label: "Ghi chú" });
    if (!noteCheck.valid) return setError(noteCheck.error);

    const payload = {
      ...(shift && { id: shift.id }),
      date: form.date,
      shiftCode: form.shiftCode,
      shiftName: picked?.name,
      startTime: picked?.startTime,
      endTime: picked?.endTime,
      role: form.role,
      needed: Number(form.needed),
      bonus: bonusCheck.value,
      note: noteCheck.value,
      source_type: form.source_type,
      ca_mau_id: form.ca_mau_id || picked?.id,
      role_tag_id: form.role_tag_id,
      phan_cong_ca_id: form.phan_cong_ca_id,
      yeu_cau_nghi_id: form.yeu_cau_nghi_id,
      week: targetWeekMonday,
    };
    const err = picked ? validateOpenShift(payload, shifts) : "Vui lòng chọn ca.";
    return err ? setError(err) : onSubmit(payload);
  };

  return (
    <Modal open title={shift ? "Sửa ca trực mở" : "Mở ca trực"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 text-[15px]">
        {error && <p role="alert" className={noteClass}>{error}</p>}
        {rule.locked && <p className={noteClass}>{rule.reason}</p>}
        {catalog.length === 0 && !shift && <p role="alert" className={noteClass}>Chưa có ca nào đang hoạt động. Hãy bật ít nhất một ca ở trang Ca & ràng buộc.</p>}

        {/* Đề xuất ca cần mở từ ca thiếu hoặc nhân viên nghỉ (nếu có) */}
        {!shift && (sources.deficient_shifts.length > 0 || sources.leave_replacements.length > 0) && (
          <Field label="Nguồn mở ca (Tùy chọn đề xuất)">
            <select
              value={selectedSourceKey}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedSourceKey(val);
                if (val.startsWith("def_")) {
                  const idx = Number(val.replace("def_", ""));
                  const s = sources.deficient_shifts[idx];
                  if (s) {
                    const matchedCa = catalog.find((c) => c.id === s.ca_mau_id || c.name === s.shift_name) || catalog[0];
                    setForm({
                      ...form,
                      date: s.date,
                      shiftCode: matchedCa?.code || form.shiftCode,
                      role: s.role_name || form.role,
                      needed: s.missing || 1,
                      source_type: "DEFICIENT_SCHEDULE",
                      ca_mau_id: s.ca_mau_id,
                      role_tag_id: s.role_tag_id,
                    });
                  }
                } else if (val.startsWith("leave_")) {
                  const idx = Number(val.replace("leave_", ""));
                  const s = sources.leave_replacements[idx];
                  if (s) {
                    const matchedCa = catalog.find((c) => c.id === s.ca_mau_id || c.name === s.shift_name) || catalog[0];
                    setForm({
                      ...form,
                      date: s.date,
                      shiftCode: matchedCa?.code || form.shiftCode,
                      role: s.role_name || form.role,
                      needed: 1,
                      source_type: "LEAVE_REPLACEMENT",
                      ca_mau_id: s.ca_mau_id,
                      phan_cong_ca_id: s.phan_cong_ca_id,
                      yeu_cau_nghi_id: s.yeu_cau_nghi_id,
                    });
                  }
                } else {
                  setForm({
                    ...form,
                    source_type: "MANUAL",
                    phan_cong_ca_id: null,
                    yeu_cau_nghi_id: null,
                  });
                }
              }}
              className={inputClass}
            >
              <option value="manual">Chủ động mở ca mới</option>
              {sources.deficient_shifts.map((d, i) => (
                <option key={`def_${i}`} value={`def_${i}`}>
                  [Thiếu từ lịch] {d.date} - {d.shift_name} (Thiếu {d.missing} {d.role_name})
                </option>
              ))}
              {sources.leave_replacements.map((l, i) => (
                <option key={`leave_${i}`} value={`leave_${i}`}>
                  [Thay thế nghỉ] {l.date} - {l.shift_name} ({l.employee_name})
                </option>
              ))}
            </select>
          </Field>
        )}

        {/* Ngày trực: Chỉ hiển thị các ngày trong tuần (Thứ Hai đến Chủ Nhật). Manager tự do chọn ngày */}
        <Field label="Ngày trực (Trong tuần đang xem)">
          <select value={form.date} onChange={set("date")} disabled={rule.locked} className={inputClass}>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>

        <Field label="Ca">
          <select value={form.shiftCode} onChange={set("shiftCode")} disabled={rule.locked} className={inputClass}>
            {choices.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.startTime} – {c.endTime})</option>)}
          </select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role_Tag yêu cầu">
            <select value={form.role} onChange={set("role")} disabled={rule.locked} className={inputClass}>
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Số lượng cần">
            <input type="number" min={rule.minNeeded} max={MAX_NEEDED} value={form.needed} onChange={set("needed")} className={inputClass} />
          </Field>
        </div>
        {shift && rule.minNeeded > 1 && <p className="text-[13px] text-slate-600">Đã có {rule.minNeeded} người nhận nên số lượng cần tối thiểu là {rule.minNeeded}.</p>}

        <Field label="Tiền thưởng khuyến khích (VND, tùy chọn)">
          <input type="number" min={0} step={1000} value={form.bonus} onChange={set("bonus")} disabled={rule.locked} placeholder="0" className={inputClass} />
        </Field>

        <Field label="Ghi chú (tùy chọn)">
          <textarea value={form.note ?? ""} onChange={set("note")} maxLength={MAX_NOTE} rows={2} placeholder="Ví dụ: cuối tuần đông khách" className={`${inputClass} h-auto py-2`} />
        </Field>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" size="lg" onClick={onClose}>Hủy</Button>
          <Button type="submit" size="lg" disabled={catalog.length === 0 && !shift}>{shift ? "Lưu thay đổi" : "Mở ca trực"}</Button>
        </div>
      </form>
    </Modal>
  );
}

// Xác nhận hủy. Chỉ hủy được khi chưa có người nhận; ca chuyển "Đã hủy" (vẫn lưu lịch sử) và biến mất khỏi danh sách của nhân viên.
export function CancelOpenShiftModal({ shift, onClose, onConfirm }) {
  return (
    <Modal open={!!shift} title="Hủy ca trực mở" onClose={onClose}>
      {shift && (
        <div className="space-y-4 text-[15px]">
          <p className="text-slate-700">
            Ca <b className="text-slate-900">{shift.shiftName}</b> ({shift.startTime} – {shift.endTime}) • {dayLabel(shift.date)} • {shift.role}, cần {shift.needed} người.
          </p>
          <p className="text-[14px] text-slate-600">
            Chưa có nhân viên nào nhận ca này. Nếu hủy, ca chuyển sang “Đã hủy” (vẫn lưu lịch sử) và nhân viên không còn thấy ca này để nhận.
          </p>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" size="lg" onClick={onClose}>Quay lại</Button>
            <Button type="button" size="lg" onClick={() => onConfirm(shift)}>Hủy ca</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

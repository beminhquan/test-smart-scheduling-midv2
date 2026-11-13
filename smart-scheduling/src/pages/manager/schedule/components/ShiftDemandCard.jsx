import { Calendar, Info, Copy, Save, CheckCircle2, SlidersHorizontal } from "lucide-react";
import { Button } from "../../../../components/FormKit";

export default function ShiftDemandCard({
  days = [],
  selectedDayId = "T2",
  onSelectDay,
  useSameConfigForWeekend = true,
  onToggleSharedMode,
  activeTargetLabel = "Ngày thường (T2–T6)",
  shiftDemands = [],
  onUpdateDemandField,
  onCopyWeekdayToWeekend,
  onCustomWeekendDemand,
  onSaveDemand,
  isSaving = false,
  saveSuccess = false,
}) {
  const isWeekendSelected = selectedDayId === "T7" || selectedDayId === "CN";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="mb-5 flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-[#CBE3F0] p-2 text-[#0F172A]">
            <Calendar size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Thiết lập nhu cầu nhân sự</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Điều chỉnh số lượng nhân sự cho từng ca theo từng vai trò (Phục vụ, Pha chế, Thu ngân).
            </p>
          </div>
        </div>

        {/* 1. Ngày áp dụng nhu cầu */}
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">1. Ngày áp dụng nhu cầu</span>
            <span className="text-[11px] font-medium text-slate-500">
              Đang chỉnh: <strong className="text-slate-800">{activeTargetLabel}</strong>
            </span>
          </div>

          {/* Hàng nút 7 ngày trong tuần */}
          <div className="flex flex-wrap items-center gap-1.5">
            {days.map((day) => {
              const isSelected = selectedDayId === day.id;
              const isWknd = day.id === "T7" || day.id === "CN";

              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => onSelectDay(day.id)}
                  className={`flex flex-col items-center justify-center rounded-xl px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer min-w-[42px] ${
                    isSelected
                      ? "bg-[#0F172A] text-white shadow-xs"
                      : isWknd
                      ? "border border-amber-200 bg-amber-50/60 text-amber-900 hover:bg-amber-100"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                  title={`${day.fullDate || day.label} ${isWknd ? "(Cuối tuần)" : "(Ngày thường)"}`}
                >
                  <span>{day.label}</span>
                  {day.date && (
                    <span
                      className={`text-[9px] tabular-nums ${
                        isSelected ? "text-slate-300" : "text-slate-400"
                      }`}
                    >
                      {day.date}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Hộp tùy chọn phân nhóm Chế độ A (Dùng chung) vs Chế độ B (Cuối tuần riêng) */}
          <div className="mt-3.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useSameConfigForWeekend}
                onChange={(e) => onToggleSharedMode(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0F172A] focus:ring-[#0F172A]"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-800">
                    Dùng chung cấu hình ngày thường cho cuối tuần
                  </span>
                  {useSameConfigForWeekend ? (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-800">
                      Chế độ A (Dùng chung)
                    </span>
                  ) : (
                    <span className="rounded bg-indigo-100 px-1.5 py-0.2 text-[10px] font-semibold text-indigo-800">
                      Chế độ B (Cuối tuần riêng)
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {useSameConfigForWeekend
                    ? "Thứ 7 & Chủ nhật kế thừa cùng nhu cầu nhân sự với các ngày thường (T2–T6)."
                    : "Thứ 7 và Chủ nhật có cấu hình nhân sự riêng biệt. Có thể đặt số lượng riêng cho từng ngày."}
                </p>
              </div>
            </label>

            {/* Khi ở Chế độ B: Hiển thị bộ chuyển nhóm nhanh và tùy chọn sao chép */}
            {!useSameConfigForWeekend && (
              <div className="mt-3 border-t border-slate-200/80 pt-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-[11px] font-medium text-slate-600">
                  <span>Chỉnh sửa:</span>
                  <button
                    type="button"
                    onClick={() => onSelectDay("T2")}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition cursor-pointer ${
                      !isWeekendSelected
                        ? "bg-[#0F172A] text-white"
                        : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    Ngày thường (T2–T6)
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectDay("T7")}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition cursor-pointer ${
                      selectedDayId === "T7"
                        ? "bg-[#0F172A] text-white"
                        : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    Thứ 7 (T7)
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectDay("CN")}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition cursor-pointer ${
                      selectedDayId === "CN"
                        ? "bg-[#0F172A] text-white"
                        : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    Chủ nhật (CN)
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onCopyWeekdayToWeekend}
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer underline decoration-dotted"
                  title="Sao chép số lượng nhân sự ngày thường sang cuối tuần làm mốc điều chỉnh"
                >
                  <Copy size={11} />
                  <span>Sao chép từ ngày thường</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 2. Nhu cầu theo ca mẫu */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">2. Nhu cầu theo ca mẫu</span>
            <span className="text-[11px] text-slate-500">
              Tổng số lượng tính tự động
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-3 py-2.5 font-bold">Ca làm việc</th>
                  <th className="px-2 py-2.5 text-center font-bold text-blue-800">Phục vụ</th>
                  <th className="px-2 py-2.5 text-center font-bold text-amber-800">Pha chế</th>
                  <th className="px-2 py-2.5 text-center font-bold text-purple-800">Thu ngân</th>
                  <th className="px-3 py-2.5 text-right font-bold text-slate-900">Tổng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {shiftDemands.map((shift) => (
                  <tr key={shift.id || shift.shiftId} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2.5 font-semibold text-slate-800">
                      <div>{shift.name || shift.shortName}</div>
                      {shift.time && (
                        <div className="text-[10px] text-slate-400 font-normal">{shift.time}</div>
                      )}
                    </td>

                    {/* Phục vụ */}
                    <td className="px-2 py-2.5 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onUpdateDemandField(shift.id || shift.shiftId, "phucVu", -1)}
                          className="h-5 w-5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold transition active:scale-95 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-4 text-center font-semibold tabular-nums text-slate-800">
                          {shift.phucVu ?? 0}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateDemandField(shift.id || shift.shiftId, "phucVu", 1)}
                          className="h-5 w-5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold transition active:scale-95 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </td>

                    {/* Pha chế */}
                    <td className="px-2 py-2.5 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onUpdateDemandField(shift.id || shift.shiftId, "phaChe", -1)}
                          className="h-5 w-5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold transition active:scale-95 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-4 text-center font-semibold tabular-nums text-slate-800">
                          {shift.phaChe ?? 0}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateDemandField(shift.id || shift.shiftId, "phaChe", 1)}
                          className="h-5 w-5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold transition active:scale-95 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </td>

                    {/* Thu ngân */}
                    <td className="px-2 py-2.5 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onUpdateDemandField(shift.id || shift.shiftId, "thuNgan", -1)}
                          className="h-5 w-5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold transition active:scale-95 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-4 text-center font-semibold tabular-nums text-slate-800">
                          {shift.thuNgan ?? 0}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateDemandField(shift.id || shift.shiftId, "thuNgan", 1)}
                          className="h-5 w-5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold transition active:scale-95 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </td>

                    {/* Tổng = Phục vụ + Pha chế + Thu ngân */}
                    <td className="px-3 py-2.5 text-right font-bold text-slate-900 tabular-nums text-sm">
                      {(shift.phucVu ?? 0) + (shift.phaChe ?? 0) + (shift.thuNgan ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Footer & Nút Lưu */}
      <div className="mt-5 border-t border-slate-100 pt-4 flex items-center justify-between gap-3">
        <div>
          {saveSuccess ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 size={15} />
              <span>Đã lưu vào MySQL thành công!</span>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400">
              Lưu cấu hình vào MySQL bảng nhu_cau_cas
            </span>
          )}
        </div>

        <Button
          type="button"
          size="sm"
          icon={<Save size={14} />}
          onClick={onSaveDemand}
          disabled={isSaving}
          className="bg-[#0F172A] text-white hover:bg-[#1E293B]"
        >
          {isSaving ? "Đang lưu..." : "Lưu nhu cầu nhân sự"}
        </Button>
      </div>
    </div>
  );
}

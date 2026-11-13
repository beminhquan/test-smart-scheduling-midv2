import { Avatar } from "../../../../components/TableKit";
import { Modal } from "../../../../components/FormKit";
import { Button } from "../../../../components/FormKit";
import { Calendar, Clock, Edit3, PlusCircle, Users, CheckCircle2, AlertCircle } from "lucide-react";

export default function ShiftDetailModal({
  open,
  selectedInfo,
  onClose,
  onOpenEdit,
  onGoToOpenShift,
}) {
  if (!selectedInfo) return null;

  const assigned = selectedInfo.assigned || [];
  const demand = selectedInfo.demand || {};
  const day = selectedInfo.day || {};

  // Tính toán số lượng phân công thực tế theo vai trò
  const pvAssigned = assigned.filter(
    (e) => e.role === "Phục vụ" || e.roleTagId === 4 || e.roleTagId === 1
  ).length;
  const pcAssigned = assigned.filter(
    (e) => e.role === "Pha chế" || e.roleTagId === 2
  ).length;
  const tnAssigned = assigned.filter(
    (e) => e.role === "Thu ngân" || e.roleTagId === 3
  ).length;

  const reqPv = demand.phucVu || 0;
  const reqPc = demand.phaChe || 0;
  const reqTn = demand.thuNgan || 0;

  const totalRequired = demand.total || reqPv + reqPc + reqTn || 0;
  const totalAssigned = assigned.length;
  const totalMissing = Math.max(0, totalRequired - totalAssigned);
  const isSatisfied = totalAssigned >= totalRequired;

  const handleCreateOpenShift = () => {
    // Đóng modal chi tiết ca và chuyển đến trang tạo ca mở với đầy đủ thông tin ca đang thiếu
    onGoToOpenShift({
      ...selectedInfo,
      assigned,
      demand,
      day,
      date: day.iso,
      totalMissing,
      missing: totalMissing,
      shiftName: demand.name,
      pvMissing: Math.max(0, reqPv - pvAssigned),
      pcMissing: Math.max(0, reqPc - pcAssigned),
      tnMissing: Math.max(0, reqTn - tnAssigned),
    });
  };

  return (
    <Modal open={open} title="Chi tiết ca làm việc" onClose={onClose}>
      <div className="space-y-5">
        {/* Banner thông tin ca làm việc */}
        <div
          className={`flex items-start justify-between rounded-xl p-4 border transition-all ${
            isSatisfied
              ? "border-emerald-200 bg-[#EEF9F2]"
              : "border-rose-200 bg-[#FDF2F2]"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg ${
                isSatisfied ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
              }`}
            >
              <Calendar size={20} />
            </div>
            <div>
              <div
                className={`text-sm font-bold ${
                  isSatisfied ? "text-emerald-900" : "text-rose-900"
                }`}
              >
                {day.fullDate || `${day.label}, ${day.date}`}
              </div>
              <div className="mt-0.5 text-xs font-medium text-slate-700 flex items-center gap-1.5">
                <Clock size={13} className="text-slate-400" />
                <span>{demand.name || "Ca làm việc"}</span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-slate-600">
                <span>
                  Nhu cầu: <strong className="font-semibold text-slate-900">{totalRequired}</strong> nhân viên
                </span>
                <span>•</span>
                <span>
                  Đã phân công: <strong className="font-semibold text-slate-900">{totalAssigned}</strong> nhân viên
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                isSatisfied
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : "bg-rose-100 text-rose-800 border border-rose-300"
              }`}
            >
              {isSatisfied ? (
                <>
                  <CheckCircle2 size={13} />
                  <span>Đủ {totalAssigned}/{totalRequired} nhân viên</span>
                </>
              ) : (
                <>
                  <AlertCircle size={13} />
                  <span>Còn thiếu {totalMissing} nhân viên</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Bảng phân bổ định biên theo vai trò chuyên môn */}
        <div>
          <div className="mb-2 text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>Định biên vai trò chuyên môn</span>
            <span className="text-[11px] font-normal text-slate-400">
              Tổng yêu cầu: {totalRequired} | Đã xếp: {totalAssigned}
            </span>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-medium">
                  <th className="px-3 py-2">Vai trò</th>
                  <th className="px-3 py-2 text-center">Yêu cầu</th>
                  <th className="px-3 py-2 text-center">Đã xếp</th>
                  <th className="px-3 py-2 text-center">Tình trạng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr>
                  <td className="px-3 py-2 font-medium">Phục vụ</td>
                  <td className="px-3 py-2 text-center tabular-nums">{reqPv}</td>
                  <td className="px-3 py-2 text-center tabular-nums font-semibold">{pvAssigned}</td>
                  <td className="px-3 py-2 text-center">
                    {reqPv - pvAssigned <= 0 ? (
                      <span className="text-emerald-600 font-medium">Đủ</span>
                    ) : (
                      <span className="font-bold text-rose-600">Thiếu {reqPv - pvAssigned}</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">Pha chế</td>
                  <td className="px-3 py-2 text-center tabular-nums">{reqPc}</td>
                  <td className="px-3 py-2 text-center tabular-nums font-semibold">{pcAssigned}</td>
                  <td className="px-3 py-2 text-center">
                    {reqPc - pcAssigned <= 0 ? (
                      <span className="text-emerald-600 font-medium">Đủ</span>
                    ) : (
                      <span className="font-bold text-rose-600">Thiếu {reqPc - pcAssigned}</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">Thu ngân</td>
                  <td className="px-3 py-2 text-center tabular-nums">{reqTn}</td>
                  <td className="px-3 py-2 text-center tabular-nums font-semibold">{tnAssigned}</td>
                  <td className="px-3 py-2 text-center">
                    {reqTn - tnAssigned <= 0 ? (
                      <span className="text-emerald-600 font-medium">Đủ</span>
                    ) : (
                      <span className="font-bold text-rose-600">Thiếu {reqTn - tnAssigned}</span>
                    )}
                  </td>
                </tr>
                <tr className="bg-slate-50/70 font-bold border-t border-slate-200">
                  <td className="px-3 py-2.5 text-slate-900">Tổng cộng</td>
                  <td className="px-3 py-2.5 text-center text-slate-900 tabular-nums">{totalRequired}</td>
                  <td className="px-3 py-2.5 text-center text-slate-900 tabular-nums">{totalAssigned}</td>
                  <td className="px-3 py-2.5 text-center">
                    {isSatisfied ? (
                      <span className="text-emerald-600 font-bold">Đủ chỉ tiêu</span>
                    ) : (
                      <span className="text-rose-600 font-bold">Thiếu {totalMissing}</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Danh sách nhân viên được phân công */}
        <div>
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Users size={14} className="text-slate-500" />
              <span>Danh sách nhân viên được phân công ({totalAssigned}/{totalRequired})</span>
            </span>
          </div>

          {assigned.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
              <Users size={24} className="mx-auto mb-2 text-slate-400 opacity-60" />
              Chưa có nhân viên nào được phân công cho ca này.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-medium">
                    <th className="px-3 py-2 text-center w-12">STT</th>
                    <th className="px-3 py-2">Nhân viên</th>
                    <th className="px-3 py-2 text-right">Vai trò</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {assigned.map((emp, idx) => {
                    const empObj = typeof emp === "string" ? { id: emp, name: emp, role: "Nhân viên" } : emp;
                    return (
                      <tr key={empObj.id || empObj.nhan_vien_id || idx} className="hover:bg-slate-50/60 transition">
                        <td className="px-3 py-2.5 text-center text-slate-400 font-medium tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={empObj.name} size="sm" />
                            <div>
                              <div className="font-semibold text-slate-900">{empObj.name}</div>
                              {empObj.id && (
                                <div className="text-[11px] text-slate-400 font-mono">
                                  {empObj.id}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="inline-block rounded-md bg-[#CBE3F0] px-2.5 py-1 text-xs font-semibold text-[#0F172A]">
                            {empObj.role || "Nhân viên"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer hành động */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <div className="text-xs text-slate-400">
            {!isSatisfied && (
              <span className="text-rose-600 font-medium">
                Ca này đang thiếu {totalMissing} nhân sự.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <Button type="button" variant="outline" size="md" onClick={onClose}>
              Đóng
            </Button>

            {/* Chỉ hiển thị nút "Tạo ca mở" khi ca CHƯA ĐỦ nhân viên */}
            {!isSatisfied && (
              <Button
                type="button"
                variant="outline"
                size="md"
                icon={<PlusCircle size={15} />}
                onClick={handleCreateOpenShift}
                className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 font-semibold cursor-pointer"
              >
                Tạo ca mở
              </Button>
            )}

            <Button
              type="button"
              size="md"
              icon={<Edit3 size={15} />}
              onClick={onOpenEdit}
            >
              Chỉnh sửa phân công
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Tầng: Trang quản lý (Manager / Open Shifts)
 * Chức năng: Quản lý ca trực mở để nhân viên tự do đăng ký nhận ca (US18, US19)
 * Quy tắc: Dùng chung PageCard (tiêu đề h1 + nút hành động ở hàng 1, mô tả ở hàng 2)
 */

import { Plus, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../../../components/FormKit";
import { PageCard, Pagination, SearchInput, StatusTabs, Toolbar, inputClass } from "../../../components/PageKit";
import { RowActions, StatusPill, EmptyState } from "../../../components/TableKit";
import { formatMoney } from "../../../lib/formatters";

import { ROLES, dayLabel, statusOf, weekdayOf, fmtDate } from "../../../services/openShiftService.js";
import { CancelOpenShiftModal, OpenShiftFormModal } from "./OpenShiftModals.jsx";
import ShiftDetailModal from "./ShiftDetailModal.jsx";
import { PAGE_SIZES, STATUS, TABS, prefillFromSchedule } from "./openShiftData.js";
import { useOpenShifts } from "./hooks/useOpenShifts.js";

const th = "px-4 py-3.5 text-left text-[13px] font-semibold text-slate-600 bg-slate-50 border-b border-slate-200";
const NOTICE = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
};

export default function OpenShiftPage() {
  const {
    fromSchedule,
    weekMonday,
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
    page,
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
  } = useOpenShifts();

  return (
    <PageCard
      icon="userPlus"
      breadcrumb={["Duyệt yêu cầu", "Ca trực mở"]}
      title="Ca trực mở"
      subtitle={
        <>
          Các ca còn thiếu nhân viên trong <b className="font-semibold text-slate-700">{weekLabel}</b>. Nhân viên đủ điều kiện tự nhận ca. Đang mở:{" "}
          <b className="font-semibold tabular-nums text-slate-700">{openCount}</b> ca
        </>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {/* Bộ chọn tuần chuẩn theo đúng tuần Manager đang thao tác */}
          <div className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white shadow-sm">
            <span className="flex items-center gap-2 pl-3 pr-2 text-[13.5px] font-medium text-slate-800">
              <Calendar size={15} className="text-slate-500" />
              <span className="tabular-nums">{weekLabel}</span>
            </span>
            <span className="h-5 w-px bg-slate-200" />
            <button
              type="button"
              onClick={handlePrevWeek}
              className="flex h-full w-8 items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 cursor-pointer"
              title="Tuần trước"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="h-5 w-px bg-slate-200" />
            <button
              type="button"
              onClick={handleNextWeek}
              className="flex h-full w-8 items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 cursor-pointer"
              title="Tuần sau"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <Button type="button" size="md" icon={<Plus size={16} />} onClick={() => setForm({ shift: null })}>
            Mở ca trực
          </Button>
        </div>
      }
    >
      <div>
        {notice && (
          <div role={notice.type === "error" ? "alert" : "status"} className={`mb-4 rounded-lg border px-4 py-3 text-[14px] ${NOTICE[notice.type]}`}>
            {notice.message}
          </div>
        )}

        {/* TAB TRẠNG THÁI + BỘ LỌC (Toolbar chuẩn) */}
        <Toolbar
          tabs={
            <StatusTabs
              tabs={TABS}
              value={filters.status}
              onChange={(st) => setFilters({ ...filters, status: st })}
              counts={Object.fromEntries(TABS.map(([id]) => [id, countOf(id)]))}
            />
          }
          search={
            <SearchInput
              value={filters.q}
              onChange={(val) => setFilters({ ...filters, q: val })}
              placeholder="Tìm ca, ngày hoặc tên nhân viên..."
            />
          }
          filters={
            <select aria-label="Role_Tag" value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })} className={`${inputClass} w-44`}>
              <option value="all">Tất cả Role_Tag</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          }
          onClear={resetFilters}
          canClear={canClear}
        />

        {/* BẢNG */}
        {loadError ? (
          <p className="py-10 text-center text-[15px] text-rose-600">{loadError}</p>
        ) : loading ? (
          <p className="py-10 text-center text-[15px] text-slate-500">Đang tải ca trực mở...</p>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Không tìm thấy kết quả phù hợp"
            description="Thử thay đổi từ khóa, bộ lọc hoặc chuyển sang tuần khác"
            onClear={resetFilters}
            canClear={Boolean(canClear)}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[960px] border-collapse text-[14px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className={th}>Ngày</th>
                  <th className={th}>Ca làm việc</th>
                  <th className={th}>Role_Tag</th>
                  <th className={`${th} text-right`}>Thưởng</th>
                  <th className={`${th} text-center`}>Đã nhận / Cần</th>
                  <th className={th}>Người nhận</th>
                  <th className={`${th} text-center`}>Trạng thái</th>
                  <th className={`${th} text-right`}>Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[14px] text-slate-800">
                {pageRows.map((s) => {
                  const st = statusOf(s);
                  return (
                    <tr
                      key={s.id}
                      onClick={() => setDetailId(s.id)}
                      className="cursor-pointer transition-colors hover:bg-slate-50/80"
                    >
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span className="block font-medium text-slate-900">{weekdayOf(s.date)}</span>
                        <span className="block text-[12px] text-slate-500">{fmtDate(s.date)}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span className="block font-medium text-slate-900">{s.shiftName}</span>
                        <span className="block text-[12px] tabular-nums text-slate-500">
                          {s.startTime} – {s.endTime}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-900">{s.role}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right font-medium tabular-nums text-emerald-600">
                        {s.bonus > 0 ? formatMoney(s.bonus) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-center tabular-nums text-slate-700">
                        {s.claims?.length || 0} / {s.needed}
                      </td>
                      <td className="px-4 py-3.5">
                        {s.claims && s.claims.length > 0 ? (
                          <span className="font-medium text-slate-900">
                            {s.claims.map((c) => c.name).join(", ")}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-center">
                        <StatusPill hex={STATUS[st]?.hex || "#94a3b8"}>{STATUS[st]?.label || st}</StatusPill>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <RowActions label={`Thao tác với ca ${s.shiftName} ${dayLabel(s.date)}`} items={menuItems(s)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4">
          {rows.length > 0 && (
            <Pagination
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              total={rows.length}
              unit="ca trực"
              sizes={PAGE_SIZES}
              onPage={setPage}
              onPageSize={setPageSize}
            />
          )}
        </div>
      </div>

      {form && !loading && (
        <OpenShiftFormModal
          key={form.shift?.id ?? "new"}
          shift={form.shift ?? undefined}
          shifts={shifts}
          catalog={catalog}
          weekMonday={weekMonday}
          prefill={fromSchedule && !form.shift ? prefillFromSchedule(fromSchedule, catalog, weekMonday) : undefined}
          onClose={() => setForm(null)}
          onSubmit={saveForm}
        />
      )}
      <ShiftDetailModal
        shift={detail}
        onClose={() => setDetailId(null)}
        onApprove={approveClaim}
        onReject={rejectClaim}
        onEdit={(s) => {
          setDetailId(null);
          setForm({ shift: s });
        }}
        onCancel={(s) => {
          setDetailId(null);
          setCancelling(s);
        }}
      />
      <CancelOpenShiftModal shift={cancelling} onClose={() => setCancelling(null)} onConfirm={confirmCancel} />
    </PageCard>
  );
}

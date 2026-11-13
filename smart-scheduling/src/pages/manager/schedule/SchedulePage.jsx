import { useNavigate } from "react-router-dom";
import {
  Calendar, ChevronLeft, ChevronRight, Cpu, CalendarDays, FileCheck2,
} from "lucide-react";
import { Button } from "../../../components/FormKit";
import { PageCard } from "../../../components/PageKit";
import { SCHEDULE_TABS } from "./scheduleShared";
import ScheduleConstraintsCard from "./components/ScheduleConstraintsCard";
import ShiftDemandCard from "./components/ShiftDemandCard";
import ScheduleMatrixCard from "./components/ScheduleMatrixCard";
import SchedulePreparationBar from "./components/SchedulePreparationBar";
import ShiftDetailModal from "./components/ShiftDetailModal";
import EditShiftModal from "./components/EditShiftModal";
import AutoGenerateModal from "./components/AutoGenerateModal";
import ConfirmScheduleModal from "./components/ConfirmScheduleModal";
import { useScheduleManagement } from "./hooks/useScheduleManagement.js";

/**
 * US10 - Cấu hình đầu vào, US11 - Xếp lịch tự động & US12 - Xem, sửa, công bố lịch (Manager)
 */
export default function SchedulePage() {
  const navigate = useNavigate();
  const {
    currentWeekMonday,
    weekLabel,
    handlePrevWeek,
    handleNextWeek,
    activeModal,
    setActiveModal,
    constraints,
    days,
    selectedDayId,
    setSelectedDayId,
    useSameConfigForWeekend,
    activeTargetLabel,
    shiftDemands,
    schedules,
    selectedShiftKey,
    isConfirmedState,
    editEmployeesList,
    showAddEmployeeDropdown,
    setShowAddEmployeeDropdown,
    isGenerating,
    generationSuccess,
    selectedInfo,
    uniqueEmployeesCount,
    employeeRoster,
    isSavingDemand,
    saveSuccess,
    handleCellClick,
    handleOpenEditModal,
    handleGoToOpenShift,
    toggleConstraint,
    updateConstraintValue,
    updateDemandField,
    handleToggleSharedMode,
    handleCopyWeekdayToWeekend,
    handleCustomWeekendDemand,
    handleSaveDemand,
    handleRemoveFromEditShift,
    handleAddEmployeeToEditShift,
    handleSaveEditShift,
    handleConfirmSchedule,
    handleRunORTools,
  } = useScheduleManagement();

  return (
    <PageCard
      icon="calendar"
      breadcrumb={["Lịch làm việc", "Tạo lịch tự động"]}
      title="Tạo lịch tự động"
      subtitle="Cấu hình nhu cầu nhân sự và các ràng buộc để hệ thống sử dụng OR-Tools tạo lịch làm việc tự động (bản mô phỏng)."
      tabs={SCHEDULE_TABS}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {/* Bộ chọn tuần chuẩn */}
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

          <Button
            type="button"
            variant="outline"
            size="md"
            icon={<CalendarDays size={16} />}
            onClick={() => navigate("/manager/schedule/created", { state: { weekMonday: currentWeekMonday, schedules } })}
          >
            Xem lịch chi tiết
          </Button>

          <Button
            type="button"
            variant="outline"
            size="md"
            icon={<FileCheck2 size={16} />}
            onClick={() => {
              if (isConfirmedState) {
                alert("Lịch tuần này đã được xác nhận chính thức.");
                return;
              }
              setActiveModal("confirmSchedule");
            }}
            disabled={isConfirmedState}
            className={isConfirmedState ? "" : "border-emerald-600 text-emerald-700 hover:bg-emerald-50"}
          >
            {isConfirmedState ? "Đã xác nhận" : "Xác nhận lịch"}
          </Button>

          <Button
            type="button"
            size="md"
            icon={<Cpu size={16} />}
            onClick={() => {
              if (isConfirmedState) {
                alert("Lịch tuần này đã được xác nhận chính thức, không thể tạo lại.");
                return;
              }
              setActiveModal("createSchedule");
            }}
            disabled={isConfirmedState}
          >
            Tạo lịch bằng OR-Tools
          </Button>
        </div>
      }
      notices={<SchedulePreparationBar fallbackCount={uniqueEmployeesCount} />}
    >
      {/* 3 Cột chức năng */}
      <div className="pt-5 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <ScheduleConstraintsCard
            constraints={constraints}
            onToggle={toggleConstraint}
            onUpdateValue={updateConstraintValue}
          />
        </div>

        <div className="xl:col-span-4">
          <ShiftDemandCard
            days={days}
            selectedDayId={selectedDayId}
            onSelectDay={setSelectedDayId}
            useSameConfigForWeekend={useSameConfigForWeekend}
            onToggleSharedMode={handleToggleSharedMode}
            activeTargetLabel={activeTargetLabel}
            shiftDemands={shiftDemands}
            onUpdateDemandField={updateDemandField}
            onCopyWeekdayToWeekend={handleCopyWeekdayToWeekend}
            onCustomWeekendDemand={handleCustomWeekendDemand}
            onSaveDemand={handleSaveDemand}
            isSaving={isSavingDemand}
            saveSuccess={saveSuccess}
          />
        </div>

        <div className="xl:col-span-4">
          <ScheduleMatrixCard
            days={days}
            shiftDemands={shiftDemands}
            schedules={schedules}
            selectedShiftKey={selectedShiftKey}
            onSelectShift={handleCellClick}
            onOpenFullSchedule={() => navigate("/manager/schedule/created", { state: { weekMonday: currentWeekMonday, schedules } })}
            onGoToOpenShift={handleGoToOpenShift}
          />
        </div>
      </div>

      <ShiftDetailModal
        open={activeModal === "shiftDetail"}
        selectedInfo={selectedInfo}
        onClose={() => setActiveModal(null)}
        onOpenEdit={handleOpenEditModal}
        onGoToOpenShift={handleGoToOpenShift}
      />

      <EditShiftModal
        open={activeModal === "editShift"}
        selectedInfo={selectedInfo}
        editEmployeesList={editEmployeesList}
        employeeRoster={employeeRoster}
        showAddDropdown={showAddEmployeeDropdown}
        onClose={() => setActiveModal(null)}
        onToggleAddDropdown={() => setShowAddEmployeeDropdown((prev) => !prev)}
        onRemoveEmployee={handleRemoveFromEditShift}
        onAddEmployee={handleAddEmployeeToEditShift}
        onSave={handleSaveEditShift}
      />

      <AutoGenerateModal
        open={activeModal === "createSchedule"}
        isGenerating={isGenerating}
        generationSuccess={generationSuccess}
        constraints={constraints}
        onClose={() => setActiveModal(null)}
        onRun={handleRunORTools}
      />

      <ConfirmScheduleModal
        open={activeModal === "confirmSchedule"}
        onClose={() => setActiveModal(null)}
        onConfirm={handleConfirmSchedule}
      />
    </PageCard>
  );
}

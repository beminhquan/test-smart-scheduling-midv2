import {
  Users,
  Calendar,
  Clock,
  Coffee,
  AlertTriangle,
  Timer,
  ShieldCheck,
  CheckCircle2,
  Settings,
} from "lucide-react";

export default function ScheduleConstraintsCard({
  constraints = [],
  onToggle,
  onUpdateValue,
}) {
  const renderIcon = (c) => {
    const type = c.type || c.id;
    if (type.includes("users") || type === "max_shifts_per_day" || type === "sufficient_staff") {
      return <Users size={17} className="text-[#0F172A]" />;
    }
    if (type.includes("calendar") || type === "fair_weekend_distribution" || type === "preference_matching" || type === "availability") {
      return <Calendar size={17} className="text-amber-500" />;
    }
    if (type.includes("clock") || type === "no_clopening" || type === "no_overlap") {
      return <Clock size={17} className="text-[#0F172A]" />;
    }
    if (type.includes("coffee") || type === "rest_between_shifts" || type === "min_rest") {
      return <Coffee size={17} className="text-orange-500" />;
    }
    if (type.includes("alert") || type === "max_consecutive_days" || type === "respect_approved_leave") {
      return <AlertTriangle size={17} className="text-rose-500" />;
    }
    if (type.includes("timer") || type === "max_hours_per_day" || type === "max_hours_per_week" || type === "fair_hours_distribution") {
      return <Timer size={17} className="text-emerald-600" />;
    }
    if (type.includes("shield") || type === "skill_match" || type === "role_match") {
      return <ShieldCheck size={17} className="text-amber-600" />;
    }
    return <CheckCircle2 size={17} className="text-[#0F172A]" />;
  };

  const getBgColor = (c) => {
    if (!c.enabled) return "bg-slate-100";
    if (c.category === "hard") return "bg-[#CBE3F0]";
    return "bg-emerald-50";
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-[#CBE3F0] p-2 text-[#0F172A]">
          <Settings size={20} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Ràng buộc khi xếp lịch</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {constraints.length} ràng buộc
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Dữ liệu đồng bộ trực tiếp từ module Ca & ràng buộc (MySQL).
          </p>
        </div>
      </div>

      <div className="space-y-3.5 max-h-[640px] overflow-y-auto pr-1">
        {constraints.map((c) => {
          const isHard = c.category === "hard";
          const isEnabled = c.enabled !== false;

          return (
            <div
              key={c.id || c.code}
              className={`rounded-xl border p-3 transition-colors ${
                isEnabled
                  ? "border-slate-200 bg-white shadow-2xs"
                  : "border-slate-200 bg-slate-50/70 opacity-75"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${getBgColor(
                      c
                    )}`}
                  >
                    {renderIcon(c)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-800">
                        {c.name || c.title}
                      </span>
                      {isHard ? (
                        <span className="rounded bg-rose-50 border border-rose-200 px-1.5 py-0.2 text-[10px] font-semibold text-rose-700">
                          Bắt buộc
                        </span>
                      ) : (
                        <span className="rounded bg-sky-50 border border-sky-200 px-1.5 py-0.2 text-[10px] font-semibold text-sky-700">
                          Ưu tiên
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                      {c.desc}
                    </p>
                  </div>
                </div>

                {/* Trạng thái áp dụng */}
                <div className="shrink-0 pt-0.5">
                  {!isEnabled ? (
                    <span className="inline-flex items-center rounded-md border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      Không áp dụng
                    </span>
                  ) : isHard ? (
                    <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      Luôn áp dụng
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                      Đang áp dụng
                    </span>
                  )}
                </div>
              </div>

              {/* Mức trần quy định nếu có */}
              {c.value !== undefined && (
                <div className="mt-2.5 ml-10 flex items-center justify-between gap-2 rounded-lg bg-slate-100/70 px-2.5 py-1 text-xs">
                  <span className="text-[11px] font-medium text-slate-500">
                    Mức trần quy định:
                  </span>
                  <span
                    className={`font-bold tabular-nums text-xs ${
                      isEnabled ? "text-slate-800" : "text-slate-400 line-through"
                    }`}
                  >
                    {c.value} {c.unit || ""}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

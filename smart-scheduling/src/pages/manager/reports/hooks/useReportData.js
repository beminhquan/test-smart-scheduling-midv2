import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildReport, fetchTasks } from '../reportData';

// Tải dữ liệu một lần, tính lại số liệu mỗi khi bộ lọc đổi.
export default function useReportData(filters) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTasks()
      .then((d) => !cancelled && setTasks(d))
      .catch((e) => !cancelled && setError(e.message || 'Không tải được dữ liệu'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  const report = useMemo(() => buildReport(tasks, filters), [tasks, filters]);
  return { report, loading, error, reload: () => void load() };
}

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { CitizenDashboard, type CitizenOverviewData } from './dashboards/CitizenDashboard';
import { RevenueOfficerDashboard, type RevenueOverviewData } from './dashboards/RevenueOfficerDashboard';
import { VerificationDeskDashboard, type VerificationOverviewData } from './dashboards/VerificationDeskDashboard';
import { AdminDashboard, type AdminOverviewData } from './dashboards/AdminDashboard';

type DashboardPayload =
  | CitizenOverviewData
  | RevenueOverviewData
  | VerificationOverviewData
  | AdminOverviewData;

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOverview = useCallback(async () => {
    try {
      const res = await apiRequest<DashboardPayload>('/api/dashboard/overview');
      setData(res);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview, user?.role]);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-72 bg-[#E4E7DF]/60 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white border border-[#E4E7DF] rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-80 bg-white border border-[#E4E7DF] rounded-xl animate-pulse" />
      </div>
    );
  }

  if (data.role === 'Citizen / Landowner') {
    return <CitizenDashboard data={data as CitizenOverviewData} onRefresh={loadOverview} />;
  }

  if (data.role === 'Revenue Officer') {
    return <RevenueOfficerDashboard data={data as RevenueOverviewData} onRefresh={loadOverview} />;
  }

  if (data.role === 'Document Verification Officer') {
    return <VerificationDeskDashboard data={data as VerificationOverviewData} onRefresh={loadOverview} />;
  }

  return <AdminDashboard data={data as AdminOverviewData} />;
}

import { Outlet } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';

export default function DashboardLayoutRoute() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}

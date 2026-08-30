import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { CustomersPage } from './pages/CustomersPage';
import { DashboardPage } from './pages/DashboardPage';
import { PlatformAdmin } from './platform/PlatformAdmin';

export function App(): ReactNode {
  return (
    <Routes>
      <Route path="/platform/*" element={<PlatformAdmin />} />
      <Route
        path="*"
        element={
          <AppShell>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/appointments" element={<AppointmentsPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/customers/:customerId" element={<CustomerDetailPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        }
      />
    </Routes>
  );
}

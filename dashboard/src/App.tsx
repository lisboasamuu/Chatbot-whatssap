import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { CompanyLogin } from './auth/CompanyLogin';
import { AppShell } from './components/AppShell';
import { api } from './lib/api';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { CompanySettingsPage } from './pages/CompanySettingsPage';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { CustomersPage } from './pages/CustomersPage';
import { DashboardPage } from './pages/DashboardPage';
import { WhatsAppPage } from './pages/WhatsAppPage';
import { AutomationsPage } from './pages/AutomationsPage';
import { PlatformAdmin } from './platform/PlatformAdmin';
import type { AuthenticatedCompany } from './types';

function CompanyApp(): ReactNode {
  const [company, setCompany] = useState<AuthenticatedCompany | null | undefined>(undefined);
  useEffect(() => {
    void api.companySession().then(setCompany).catch(() => setCompany(null));
  }, []);
  useEffect(() => {
    const handler = () => setCompany(null);
    window.addEventListener('company-session-expired', handler);
    return () => window.removeEventListener('company-session-expired', handler);
  }, []);

  if (company === undefined) {
    return (
      <div className="grid min-h-screen place-items-center bg-brand-50 px-4 text-center">
        <div>
          <div className="mx-auto grid h-12 w-12 place-items-center overflow-hidden rounded-xl border border-brand-100 bg-white p-1 shadow-sm">
            <img src="/brand/codigo-ns-black.png" alt="Código NS" className="h-full w-full object-contain" />
          </div>
          <p className="mt-4 text-sm font-medium text-brand-900">Verificando sessão…</p>
        </div>
      </div>
    );
  }
  if (company === null) return <CompanyLogin onLogin={setCompany} />;

  async function logout() {
    try {
      await api.companyLogout();
    } finally {
      setCompany(null);
    }
  }

  return (
    <AppShell onLogout={() => void logout()}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/appointments" element={<AppointmentsPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/:customerId" element={<CustomerDetailPage />} />
        <Route path="/automations" element={<AutomationsPage />} />
        <Route path="/settings" element={<CompanySettingsPage />} />
        <Route path="/whatsapp" element={<WhatsAppPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export function App(): ReactNode {
  return (
    <Routes>
      <Route path="/platform/*" element={<PlatformAdmin />} />
      <Route path="*" element={<CompanyApp />} />
    </Routes>
  );
}

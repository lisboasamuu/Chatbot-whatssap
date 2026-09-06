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
import { PlatformAdmin } from './platform/PlatformAdmin';
import type { AuthenticatedCompany } from './types';

function CompanyApp():ReactNode {
  const [company,setCompany]=useState<AuthenticatedCompany|null|undefined>(undefined);
  useEffect(()=>{void api.companySession().then(setCompany).catch(()=>setCompany(null));},[]);
  useEffect(()=>{const handler=()=>setCompany(null);window.addEventListener('company-session-expired',handler);return()=>window.removeEventListener('company-session-expired',handler);},[]);
  if(company===undefined)return <div className="grid min-h-screen place-items-center bg-slate-950 text-slate-400">Verificando sessão…</div>;
  if(company===null)return <CompanyLogin onLogin={setCompany}/>;
  async function logout(){try{await api.companyLogout();}finally{setCompany(null);}}
  return <AppShell onLogout={()=>void logout()}><Routes><Route path="/" element={<DashboardPage/>}/><Route path="/appointments" element={<AppointmentsPage/>}/><Route path="/customers" element={<CustomersPage/>}/><Route path="/customers/:customerId" element={<CustomerDetailPage/>}/><Route path="/settings" element={<CompanySettingsPage/>}/><Route path="/whatsapp" element={<WhatsAppPage/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></AppShell>;
}

export function App(): ReactNode {
  return <Routes><Route path="/platform/*" element={<PlatformAdmin/>}/><Route path="*" element={<CompanyApp/>}/></Routes>;
}

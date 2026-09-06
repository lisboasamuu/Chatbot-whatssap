import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type {
  BusinessHour,
  CompanySettings,
  MessageTemplate,
  MessageTemplateType,
  PlatformCompany,
  PlatformCompanyDetail,
  PlatformSummary,
  ReminderOffsetMinutes,
  Weekday,
} from '../types';
import { api } from '../lib/api';

const WEEKDAYS: Array<{ key: Weekday; label: string }> = [
  { key: 'MONDAY', label: 'Segunda-feira' },
  { key: 'TUESDAY', label: 'Terça-feira' },
  { key: 'WEDNESDAY', label: 'Quarta-feira' },
  { key: 'THURSDAY', label: 'Quinta-feira' },
  { key: 'FRIDAY', label: 'Sexta-feira' },
  { key: 'SATURDAY', label: 'Sábado' },
  { key: 'SUNDAY', label: 'Domingo' },
];

const TEMPLATE_LABELS: Record<MessageTemplateType, string> = {
  WELCOME: 'Mensagem de boas-vindas',
  APPOINTMENT_CREATED: 'Agendamento confirmado',
  APPOINTMENT_CANCELLED: 'Agendamento cancelado',
  APPOINTMENT_RESCHEDULED: 'Agendamento remarcado',
  NO_APPOINTMENTS: 'Nenhum agendamento',
  BUSINESS_CLOSED: 'Fora do horário de atendimento',
  REMINDER: 'Lembrete de agendamento',
};

const DEFAULT_MESSAGES: Record<MessageTemplateType, string> = {
  WELCOME: 'Olá! 👋 Bem-vindo. Como posso ajudar?',
  APPOINTMENT_CREATED: 'Agendamento confirmado para {{date}} às {{time}}. Obrigado pela preferência!',
  APPOINTMENT_CANCELLED: 'Agendamento cancelado com sucesso. Obrigado pela preferência!',
  APPOINTMENT_RESCHEDULED: 'Agendamento remarcado para {{date}} às {{time}}. Obrigado pela preferência!',
  NO_APPOINTMENTS: 'Você não possui agendamentos.',
  BUSINESS_CLOSED: 'Esse horário está fora do horário de atendimento. Envie outro horário no formato HH:mm.',
  REMINDER: 'Olá, {{customerName}}! Este é um lembrete do seu agendamento na {{companyName}} em {{date}} às {{time}}.',
};

const REMINDER_PRESETS: Array<{ value: ReminderOffsetMinutes; label: string }> = [
  { value: 1440, label: '24 horas antes' },
  { value: 720, label: '12 horas antes' },
  { value: 240, label: '4 horas antes' },
  { value: 60, label: '1 hora antes' },
  { value: 30, label: '30 minutos antes' },
];

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-2xl border border-brand-100 bg-white p-4 shadow-soft sm:p-5 ${className}`}>{children}</section>;
}

function Badge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {active ? 'Ativa' : 'Inativa'}
    </span>
  );
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.platformLogin(password);
      onLogin();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative grid min-h-screen overflow-hidden bg-brand-50 px-4 py-6 text-slate-900 sm:place-items-center sm:py-8">
      <img src="/brand/codigo-ns-black.png" alt="" aria-hidden="true" className="brand-watermark absolute -bottom-24 -left-20 hidden w-[420px] -rotate-12 sm:block lg:w-[620px]" />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-brand-100 bg-white p-6 shadow-panel sm:p-9">
        <div className="mb-7">
          <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border border-brand-100 bg-white p-1.5 shadow-sm">
            <img src="/brand/codigo-ns-black.png" alt="Código NS" className="h-full w-full object-contain" />
          </div>
          <p className="mt-5 brand-eyebrow">Código NS</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-900">Platform Admin</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Acesso privado à administração da plataforma.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Senha administrativa
            <input autoFocus type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="field" />
          </label>
          {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <button disabled={loading || !password} className="brand-button w-full py-3">{loading ? 'Entrando…' : 'Entrar com segurança'}</button>
        </form>
      </div>
    </div>
  );
}

export function PlatformAdmin(): ReactNode {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [companies, setCompanies] = useState<PlatformCompany[]>([]);
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [selected, setSelected] = useState<PlatformCompanyDetail | null>(null);
  const [view, setView] = useState<'dashboard' | 'companies' | 'company'>('dashboard');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [nextSummary, nextCompanies] = await Promise.all([api.getPlatformSummary(), api.getCompanies()]);
      setSummary(nextSummary);
      setCompanies(nextCompanies);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void api.platformSession().then(() => setAuthenticated(true)).catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    if (authenticated) void refresh();
  }, [authenticated]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileMenuOpen]);

  async function openCompany(id: string) {
    setLoading(true);
    setError('');
    try {
      setSelected(await api.getPlatformCompany(id));
      setView('company');
      setMobileMenuOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar empresa.');
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await api.platformLogout();
    setMobileMenuOpen(false);
    setAuthenticated(false);
  }

  function changeView(next: 'dashboard' | 'companies') {
    setView(next);
    setMobileMenuOpen(false);
  }

  if (authenticated === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-brand-50 px-4 text-slate-500">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center overflow-hidden rounded-xl border border-brand-100 bg-white p-1 shadow-sm">
            <img src="/brand/codigo-ns-black.png" alt="Código NS" className="h-full w-full object-contain" />
          </div>
          <p className="mt-4">Verificando sessão…</p>
        </div>
      </div>
    );
  }

  if (!authenticated) return <Login onLogin={() => setAuthenticated(true)} />;

  return (
    <div className="min-h-screen overflow-x-hidden bg-brand-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-hidden bg-brand-900 p-5 text-white lg:flex">
        <div className="relative z-10 mb-9 flex items-center gap-3">
          <img src="/brand/codigo-ns-white.png" alt="Código NS" className="h-11 w-11 shrink-0 object-contain" />
          <div className="min-w-0">
            <strong className="block">Código NS</strong>
            <span className="text-xs text-brand-300">Platform Admin</span>
          </div>
        </div>
        <nav className="relative z-10 space-y-1 text-sm" aria-label="Navegação administrativa">
          <button onClick={() => changeView('dashboard')} className={`w-full rounded-xl px-3 py-2.5 text-left font-medium transition ${view === 'dashboard' ? 'bg-white text-brand-900' : 'text-brand-100 hover:bg-white/10 hover:text-white'}`}>Visão geral</button>
          <button onClick={() => changeView('companies')} className={`w-full rounded-xl px-3 py-2.5 text-left font-medium transition ${view !== 'dashboard' ? 'bg-white text-brand-900' : 'text-brand-100 hover:bg-white/10 hover:text-white'}`}>Empresas</button>
        </nav>
        <div className="relative z-10 mt-auto space-y-3">
          <a href="https://www.instagram.com/codigonsbr" target="_blank" rel="noreferrer" className="block rounded-xl border border-white/10 px-3 py-2.5 text-xs text-brand-200 transition hover:bg-white/10 hover:text-white">Instagram · @codigonsbr</a>
          <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3 text-xs leading-5 text-brand-100">Sessão protegida<br />Expira após inatividade.</div>
        </div>
      </aside>

      <main className="relative min-h-screen overflow-hidden lg:ml-64">
        <img src="/brand/codigo-ns-black.png" alt="" aria-hidden="true" className="brand-watermark absolute -right-28 top-28 hidden w-[430px] rotate-6 xl:block" />
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-brand-100 bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6 md:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <img src="/brand/codigo-ns-black.png" alt="Código NS" className="h-9 w-9 shrink-0 object-contain lg:hidden" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-brand-700 sm:text-xs">Código NS / Platform Admin</p>
              <h1 className="truncate text-sm font-semibold text-brand-900 sm:text-base">{view === 'dashboard' ? 'Dashboard' : view === 'companies' ? 'Empresas' : selected?.name}</h1>
            </div>
          </div>
          <div className="hidden gap-2 lg:flex">
            <button onClick={() => changeView('companies')} className="brand-button-secondary px-3 py-2">Empresas</button>
            <button onClick={() => void logout()} className="brand-button-secondary px-3 py-2">Sair</button>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-brand-200 bg-white text-brand-900 shadow-sm transition hover:bg-brand-50 lg:hidden"
            aria-label="Abrir menu"
            aria-expanded={mobileMenuOpen}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </header>

        {mobileMenuOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu administrativo">
            <button type="button" aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)} className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]" />
            <aside className="absolute inset-y-0 right-0 flex w-[min(88vw,320px)] flex-col overflow-y-auto bg-brand-900 p-5 text-white shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <img src="/brand/codigo-ns-white.png" alt="Código NS" className="h-10 w-10 shrink-0 object-contain" />
                  <div><strong className="block text-sm">Código NS</strong><span className="text-xs text-brand-300">Platform Admin</span></div>
                </div>
                <button type="button" onClick={() => setMobileMenuOpen(false)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/15 text-brand-100" aria-label="Fechar menu">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>
              <nav className="mt-8 space-y-1.5">
                <button onClick={() => changeView('dashboard')} className={`w-full rounded-xl px-4 py-3 text-left text-sm font-medium ${view === 'dashboard' ? 'bg-white text-brand-900' : 'text-brand-100 hover:bg-white/10'}`}>Visão geral</button>
                <button onClick={() => changeView('companies')} className={`w-full rounded-xl px-4 py-3 text-left text-sm font-medium ${view !== 'dashboard' ? 'bg-white text-brand-900' : 'text-brand-100 hover:bg-white/10'}`}>Empresas</button>
              </nav>
              <div className="mt-auto space-y-3 pt-8">
                <a href="https://www.instagram.com/codigonsbr" target="_blank" rel="noreferrer" className="block rounded-xl border border-white/10 px-4 py-3 text-xs text-brand-200">Instagram · @codigonsbr</a>
                <button onClick={() => void logout()} className="w-full rounded-xl border border-white/15 px-4 py-3 text-left text-sm font-medium text-brand-100">Sair</button>
              </div>
            </aside>
          </div>
        ) : null}

        <div className="relative z-10 mx-auto w-full max-w-7xl p-4 sm:p-6 md:p-8">
          {error ? <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {loading ? <div className="mb-5 text-sm text-slate-500">Carregando…</div> : null}
          {view === 'dashboard' ? <Dashboard summary={summary} companies={companies} onCompanies={() => changeView('companies')} /> : null}
          {view === 'companies' ? <Companies companies={companies} creating={creating} setCreating={setCreating} onCreated={async (company) => { setCreating(false); await refresh(); await openCompany(company.id); }} onOpen={(id) => void openCompany(id)} /> : null}
          {view === 'company' && selected ? <CompanyEditor company={selected} onChange={setSelected} onSaved={async (company) => { setSelected(company); await refresh(); }} /> : null}
        </div>
      </main>
    </div>
  );
}

function Dashboard({ summary, companies, onCompanies }: { summary: PlatformSummary | null; companies: PlatformCompany[]; onCompanies: () => void }) {
  const cards = [
    ['Total de empresas', summary?.totalCompanies ?? '—'],
    ['Empresas ativas', summary?.activeCompanies ?? '—'],
    ['Empresas inativas', summary?.inactiveCompanies ?? '—'],
    ['Total de agendamentos', summary?.totalAppointments ?? '—'],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm text-slate-400">Operação da plataforma</p><h2 className="mt-1 text-2xl font-semibold">Visão geral</h2></div>
        <button onClick={onCompanies} className="brand-button w-full hover:bg-brand-900 sm:w-auto">Gerenciar empresas</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => <Card key={String(label)}><p className="text-sm text-slate-400">{label}</p><strong className="mt-3 block text-3xl">{value}</strong></Card>)}
      </div>
      <Card>
        <div className="mb-4"><h3 className="font-semibold">Empresas recentes</h3><p className="text-sm text-slate-400">Dados reais cadastrados na plataforma.</p></div>
        {companies.length === 0 ? <p className="py-10 text-center text-sm text-slate-400">Nenhuma empresa cadastrada.</p> : <CompanyTable companies={companies.slice(0, 6)} onOpen={() => onCompanies()} />}
      </Card>
    </div>
  );
}

function CompanyTable({ companies, onOpen }: { companies: PlatformCompany[]; onOpen: (id: string) => void }) {
  return (
    <div className="space-y-3">
      <div className="hidden grid-cols-[minmax(150px,1.2fr)_auto_minmax(150px,1fr)_minmax(130px,0.8fr)_auto_auto] gap-4 border-b border-brand-100 pb-3 text-xs uppercase tracking-wide text-slate-400 xl:grid">
        <span>Empresa</span><span>Status</span><span>Identificador</span><span>Timezone</span><span>Clientes</span><span>Ações</span>
      </div>
      {companies.map((company) => (
        <div key={company.id} className="grid min-w-0 gap-3 rounded-xl border border-brand-100 bg-brand-50/35 p-4 sm:grid-cols-2 xl:grid-cols-[minmax(150px,1.2fr)_auto_minmax(150px,1fr)_minmax(130px,0.8fr)_auto_auto] xl:items-center xl:border-x-0 xl:border-t-0 xl:bg-white xl:px-0 xl:py-4">
          <div className="min-w-0"><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 xl:hidden">Empresa</span><p className="break-words font-medium text-slate-900">{company.name}</p><p className="mt-1 text-xs text-slate-400 xl:hidden">Criada em {new Date(company.createdAt).toLocaleDateString('pt-BR')}</p></div>
          <div><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400 xl:hidden">Status</span><Badge active={company.status === 'ACTIVE'} /></div>
          <div className="min-w-0"><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 xl:hidden">Identificador</span><p className="break-all font-mono text-xs text-slate-500">{company.id}</p></div>
          <div className="min-w-0"><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 xl:hidden">Timezone</span><p className="break-words text-sm text-slate-500">{company.timezone}</p></div>
          <div><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 xl:hidden">Clientes</span><p className="text-sm text-slate-500">{company.customerCount}</p></div>
          <button onClick={() => onOpen(company.id)} className="brand-button-secondary w-full sm:w-auto">Configurar</button>
        </div>
      ))}
    </div>
  );
}

function Companies({ companies, creating, setCreating, onCreated, onOpen }: { companies: PlatformCompany[]; creating: boolean; setCreating: (value: boolean) => void; onCreated: (company: PlatformCompanyDetail) => void; onOpen: (id: string) => void }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm text-slate-400">Cadastro e configuração</p><h2 className="mt-1 text-2xl font-semibold">Empresas</h2></div>
        <button onClick={() => setCreating(!creating)} className="brand-button w-full hover:bg-brand-900 sm:w-auto">+ Nova empresa</button>
      </div>
      {creating ? <NewCompany onCreated={onCreated} /> : null}
      <Card>{companies.length ? <CompanyTable companies={companies} onOpen={onOpen} /> : <div className="py-12 text-center"><p className="font-medium">Nenhuma empresa cadastrada</p><p className="mt-1 text-sm text-slate-400">Cadastre a primeira empresa para começar.</p></div>}</Card>
    </div>
  );
}

function NewCompany({ onCreated }: { onCreated: (company: PlatformCompanyDetail) => void }) {
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try { onCreated(await api.createCompany({ name, timezone })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Falha ao cadastrar.'); }
    finally { setSaving(false); }
  }

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto] xl:items-end">
        <label className="text-sm text-slate-500">Nome<input value={name} onChange={(e) => setName(e.target.value)} className="field" /></label>
        <label className="text-sm text-slate-500">Timezone<input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="field" /></label>
        <button disabled={saving} className="brand-button w-full md:col-span-2 xl:col-span-1 xl:w-auto">{saving ? 'Salvando…' : 'Cadastrar'}</button>
        {error ? <p className="text-sm text-red-700 md:col-span-2 xl:col-span-3">{error}</p> : null}
      </form>
    </Card>
  );
}

function CompanyEditor({ company, onSaved }: { company: PlatformCompanyDetail; onChange: (company: PlatformCompanyDetail) => void; onSaved: (company: PlatformCompanyDetail) => void }) {
  const [section, setSection] = useState<'general' | 'access' | 'hours' | 'messages' | 'reminders' | 'pix'>('general');
  const tabs = [['general', 'Visão geral'], ['access', 'Acesso'], ['hours', 'Horários'], ['messages', 'Mensagens'], ['reminders', 'Lembretes'], ['pix', 'Pix / Antecipação']] as const;

  return (
    <div className="space-y-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><h2 className="break-words text-2xl font-semibold">{company.name}</h2><Badge active={company.status === 'ACTIVE'} /></div>
        <p className="mt-1 break-all text-xs text-slate-400 sm:text-sm">{company.id}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap">
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setSection(key)} className={`min-h-11 rounded-xl px-3 py-2 text-sm transition lg:px-4 ${section === key ? 'bg-brand-700 text-white' : 'bg-white text-slate-500 hover:text-slate-700'}`}>{label}</button>
        ))}
      </div>
      {section === 'general' ? <General company={company} onSaved={onSaved} /> : null}
      {section === 'access' ? <Access company={company} onSaved={onSaved} /> : null}
      {section === 'hours' ? <Hours company={company} onSaved={onSaved} /> : null}
      {section === 'messages' ? <Messages company={company} onSaved={onSaved} /> : null}
      {section === 'reminders' ? <Reminders company={company} onSaved={onSaved} /> : null}
      {section === 'pix' ? <Pix company={company} onSaved={onSaved} /> : null}
    </div>
  );
}

function Access({ company, onSaved }: { company: PlatformCompanyDetail; onSaved: (company: PlatformCompanyDetail) => void }) {
  const [email, setEmail] = useState(company.access.email ?? '');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  async function save() {
    try {
      onSaved(await api.saveCompanyAccess(company.id, { email, password }));
      setPassword('');
      setMsg(company.access.configured ? 'Acesso atualizado. Sessões anteriores foram revogadas.' : 'Acesso empresarial provisionado.');
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Erro ao salvar acesso.'); }
  }
  return <Card><h3 className="font-semibold">Acesso da empresa</h3><p className="mt-1 text-sm text-slate-400">Credenciais usadas no dashboard empresarial. A senha nunca é exibida depois de salva.</p><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm text-slate-500">E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" /></label><label className="text-sm text-slate-500">{company.access.configured ? 'Nova senha (opcional)' : 'Senha inicial'}<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="field" placeholder={company.access.configured ? 'Deixe vazio para manter a atual' : 'Mínimo de 12 caracteres'} /></label></div><button onClick={() => void save()} className="mt-5 brand-button w-full sm:w-auto">Salvar acesso</button><SaveFeedback message={msg} /></Card>;
}

function SaveFeedback({ message }: { message: string }) { return message ? <p className="mt-3 break-words text-sm text-slate-500">{message}</p> : null; }

function General({ company, onSaved }: { company: PlatformCompanyDetail; onSaved: (company: PlatformCompanyDetail) => void }) {
  const [name, setName] = useState(company.name);
  const [timezone, setTimezone] = useState(company.timezone);
  const [msg, setMsg] = useState('');
  async function save() { try { onSaved(await api.updatePlatformCompany(company.id, { name, timezone })); setMsg('Informações salvas.'); } catch (e) { setMsg(e instanceof Error ? e.message : 'Erro ao salvar.'); } }
  async function toggle() { try { onSaved(await api.updatePlatformCompany(company.id, { status: company.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })); setMsg(company.status === 'ACTIVE' ? 'Empresa desativada. Histórico preservado.' : 'Empresa ativada.'); } catch (e) { setMsg(e instanceof Error ? e.message : 'Erro.'); } }
  return <div className="grid gap-5 xl:grid-cols-3"><Card className="xl:col-span-2"><h3 className="font-semibold">Informações gerais</h3><p className="mt-1 text-sm text-slate-400">Identidade operacional e timezone da empresa.</p><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm text-slate-500">Nome<input value={name} onChange={(e) => setName(e.target.value)} className="field" /></label><label className="text-sm text-slate-500">Timezone<input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="field" /></label></div><button onClick={() => void save()} className="mt-5 brand-button w-full sm:w-auto">Salvar alterações</button><SaveFeedback message={msg} /></Card><Card><h3 className="font-semibold">Status operacional</h3><p className="mt-2 text-sm leading-6 text-slate-400">Ao desativar, o WhatsApp e novos agendamentos deixam de operar. O histórico permanece intacto.</p><button onClick={() => void toggle()} className="mt-5 brand-button-secondary w-full sm:w-auto">{company.status === 'ACTIVE' ? 'Desativar empresa' : 'Ativar empresa'}</button></Card></div>;
}

function Hours({ company, onSaved }: { company: PlatformCompanyDetail; onSaved: (company: PlatformCompanyDetail) => void }) {
  const [hours, setHours] = useState<BusinessHour[]>(company.businessHours);
  const [msg, setMsg] = useState('');
  const byDay = useMemo(() => new Map(WEEKDAYS.map((day) => [day.key, hours.filter((hour) => hour.weekday === day.key)])), [hours]);
  function add(day: Weekday) { setHours((current) => [...current, { weekday: day, startTime: '09:00', endTime: '18:00' }]); }
  function update(day: Weekday, index: number, key: 'startTime' | 'endTime', value: string) { let seen = -1; setHours((current) => current.map((hour) => { if (hour.weekday !== day) return hour; seen += 1; return seen === index ? { ...hour, [key]: value } : hour; })); }
  function remove(day: Weekday, index: number) { let seen = -1; setHours((current) => current.filter((hour) => { if (hour.weekday !== day) return true; seen += 1; return seen !== index; })); }
  async function save() { try { onSaved(await api.saveBusinessHours(company.id, hours)); setMsg('Horários salvos e aplicados à disponibilidade.'); } catch (e) { setMsg(e instanceof Error ? e.message : 'Erro ao salvar.'); } }
  return <Card><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="font-semibold">Horários semanais</h3><p className="mt-1 text-sm text-slate-400">Dias sem períodos ficam fechados. Intervalos são simplesmente múltiplas faixas.</p></div><button onClick={() => void save()} className="brand-button w-full sm:w-auto">Salvar horários</button></div><div className="mt-6 divide-y divide-brand-100">{WEEKDAYS.map((day) => { const periods = byDay.get(day.key) ?? []; return <div key={day.key} className="grid gap-3 py-4 md:grid-cols-[180px_1fr]"><div><strong className="text-sm">{day.label}</strong><span className="mt-1 block text-xs text-slate-400">{periods.length ? 'Aberto' : 'Fechado'}</span></div><div className="space-y-2">{periods.map((period, index) => <div key={`${period.startTime}-${index}`} className="grid grid-cols-2 gap-2 rounded-xl bg-brand-50/70 p-3 sm:flex sm:flex-wrap sm:items-end sm:bg-transparent sm:p-0"><label className="min-w-0 text-xs font-medium text-slate-500 sm:text-[0]"><span className="mb-1 block sm:sr-only">Início</span><input type="time" value={period.startTime} onChange={(e) => update(day.key, index, 'startTime', e.target.value)} className="time-field" /></label><span className="hidden self-center text-sm text-slate-400 sm:inline">até</span><label className="min-w-0 text-xs font-medium text-slate-500 sm:text-[0]"><span className="mb-1 block sm:sr-only">Fim</span><input type="time" value={period.endTime} onChange={(e) => update(day.key, index, 'endTime', e.target.value)} className="time-field" /></label><button onClick={() => remove(day.key, index)} className="col-span-2 min-h-10 rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-700 sm:col-auto sm:text-center">Remover período</button></div>)}<button onClick={() => add(day.key)} className="inline-flex min-h-10 items-center text-sm font-medium text-brand-700 hover:text-brand-900">+ Adicionar período</button></div></div>; })}</div><SaveFeedback message={msg} /></Card>;
}

function Messages({ company, onSaved }: { company: PlatformCompanyDetail; onSaved: (company: PlatformCompanyDetail) => void }) {
  const types = (Object.keys(TEMPLATE_LABELS) as MessageTemplateType[]).filter((type) => type !== 'REMINDER');
  const [templates, setTemplates] = useState<MessageTemplate[]>(company.messageTemplates);
  const [msg, setMsg] = useState('');
  function body(type: MessageTemplateType) { return templates.find((template) => template.type === type)?.body ?? ''; }
  function set(type: MessageTemplateType, value: string) { setTemplates((current) => [...current.filter((template) => template.type !== type), ...(value ? [{ type, body: value }] : [])]); }
  async function save() { try { onSaved(await api.saveMessageTemplates(company.id, templates)); setMsg('Mensagens salvas.'); } catch (e) { setMsg(e instanceof Error ? e.message : 'Erro ao salvar.'); } }
  return <div className="space-y-4">{types.map((type) => <Card key={type}><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h3 className="break-words font-semibold">{TEMPLATE_LABELS[type]}</h3><p className="mt-1 text-xs text-slate-400">{body(type) ? 'Personalizada' : 'Usando padrão da plataforma'}</p></div>{body(type) ? <button onClick={() => set(type, '')} className="min-h-10 self-start text-xs font-medium text-slate-500 hover:text-brand-700">Restaurar padrão</button> : null}</div><textarea rows={3} value={body(type)} placeholder={DEFAULT_MESSAGES[type]} onChange={(e) => set(type, e.target.value)} className="field mt-4 resize-y" />{['APPOINTMENT_CREATED', 'APPOINTMENT_RESCHEDULED'].includes(type) ? <p className="mt-2 break-words text-xs leading-5 text-slate-400">Placeholders permitidos: {'{{date}}'} e {'{{time}}'}.</p> : null}</Card>)}<button onClick={() => void save()} className="brand-button w-full sm:w-auto">Salvar mensagens</button><SaveFeedback message={msg} /></div>;
}

function Reminders({ company, onSaved }: { company: PlatformCompanyDetail; onSaved: (company: PlatformCompanyDetail) => void }) {
  const [enabled, setEnabled] = useState(company.reminders.enabled);
  const [offsets, setOffsets] = useState<ReminderOffsetMinutes[]>(company.reminders.offsets);
  const [message, setMessage] = useState(company.messageTemplates.find((template) => template.type === 'REMINDER')?.body ?? '');
  const [msg, setMsg] = useState('');
  function toggleOffset(offset: ReminderOffsetMinutes) { setOffsets((current) => current.includes(offset) ? current.filter((value) => value !== offset) : [...current, offset]); }
  async function save() { try { onSaved(await api.saveReminderConfiguration(company.id, { enabled, offsets, message: message || null })); setMsg('Configuração de lembretes salva.'); } catch (e) { setMsg(e instanceof Error ? e.message : 'Erro ao salvar.'); } }
  return <div className="grid gap-5 xl:grid-cols-2"><Card><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold">Lembretes automáticos</h3><p className="mt-1 text-sm leading-6 text-slate-400">Escolha um ou mais momentos. Apenas lembretes futuros serão programados.</p></div><label className="flex min-h-10 items-center gap-2 text-sm text-slate-700"><input aria-label="Ativar lembretes" type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Ativar</label></div><div className="mt-5 grid gap-2 sm:grid-cols-2">{REMINDER_PRESETS.map((preset) => <label key={preset.value} className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-3 text-sm ${offsets.includes(preset.value) ? 'border-brand-300 bg-brand-100 text-brand-900' : 'border-brand-100 text-slate-500'}`}><input type="checkbox" checked={offsets.includes(preset.value)} onChange={() => toggleOffset(preset.value)} />{preset.label}</label>)}</div></Card><Card><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold">Mensagem do lembrete</h3><p className="mt-1 text-xs text-slate-400">{message ? 'Personalizada' : 'Usando padrão da plataforma'}</p></div>{message ? <button onClick={() => setMessage('')} className="min-h-10 self-start text-xs font-medium text-slate-500 hover:text-brand-700">Restaurar padrão</button> : null}</div><label className="mt-4 block text-sm text-slate-500">Texto enviado<textarea aria-label="Mensagem do lembrete" rows={6} value={message} placeholder={DEFAULT_MESSAGES.REMINDER} onChange={(e) => setMessage(e.target.value)} className="field mt-2 resize-y" /></label><p className="mt-2 break-words text-xs leading-5 text-slate-400">Placeholders permitidos: {'{{customerName}}'}, {'{{date}}'}, {'{{time}}'} e {'{{companyName}}'}.</p><button onClick={() => void save()} className="mt-5 brand-button w-full sm:w-auto">Salvar lembretes</button><SaveFeedback message={msg} /></Card></div>;
}

function formatDepositInput(value: number | null): string {
  if (value === null) return '';
  return (value / 100).toFixed(2).replace('.', ',');
}

function Pix({ company, onSaved }: { company: PlatformCompanyDetail; onSaved: (company: PlatformCompanyDetail) => void }) {
  const [settings, setSettings] = useState<CompanySettings>(company.settings);
  const [depositInput, setDepositInput] = useState(() => formatDepositInput(company.settings.depositValue));
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setSettings(company.settings);
    setDepositInput(formatDepositInput(company.settings.depositValue));
  }, [company.id, company.settings]);

  function changeDepositType(depositType: CompanySettings['depositType']) {
    setSettings((current) => ({ ...current, depositType, depositValue: null }));
    setDepositInput('');
    setMsg('');
  }

  function valueChanged(raw: string) {
    let value = raw.replace(/\./g, ',').replace(/[^\d,]/g, '');
    if (value.startsWith(',')) value = `0${value}`;
    if (!/^\d*(,\d{0,2})?$/.test(value)) return;
    setDepositInput(value);
  }

  function parsedDepositValue(): number | null {
    if (settings.depositType === 'NONE') return null;
    if (!depositInput.trim()) return null;
    const numeric = Number(depositInput.replace(',', '.'));
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    if (settings.depositType === 'PERCENTAGE' && numeric > 100) return null;
    return Math.round(numeric * 100);
  }

  async function save() {
    const depositValue = parsedDepositValue();
    if (settings.depositType !== 'NONE' && depositValue === null) {
      setMsg(settings.depositType === 'PERCENTAGE' ? 'Informe um percentual entre 0,01% e 100%.' : 'Informe um valor de sinal a partir de R$ 0,01.');
      return;
    }
    const payload = { ...settings, depositValue };
    try {
      const saved = await api.saveCompanySettings(company.id, payload);
      setSettings(saved.settings);
      setDepositInput(formatDepositInput(saved.settings.depositValue));
      onSaved(saved);
      setMsg('Configuração salva. Nenhuma cobrança é processada por esta tela.');
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Erro ao salvar.'); }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <h3 className="font-semibold">Pix</h3>
        <p className="mt-1 text-sm text-slate-400">Somente configuração para uso futuro. Nenhum pagamento é processado.</p>
        <label className="mt-5 flex min-h-10 items-center gap-3 text-sm"><input type="checkbox" checked={settings.pixEnabled} onChange={(e) => setSettings({ ...settings, pixEnabled: e.target.checked })} /> Habilitar dados Pix</label>
        <div className="mt-4 grid gap-4"><label className="text-sm text-slate-500">Chave Pix<input disabled={!settings.pixEnabled} value={settings.pixKey ?? ''} onChange={(e) => setSettings({ ...settings, pixKey: e.target.value || null })} className="field" /></label><label className="text-sm text-slate-500">Favorecido<input disabled={!settings.pixEnabled} value={settings.pixRecipientName ?? ''} onChange={(e) => setSettings({ ...settings, pixRecipientName: e.target.value || null })} className="field" /></label></div>
      </Card>
      <Card>
        <h3 className="font-semibold">Antecipação</h3>
        <div className="mt-5 space-y-2">{([['NONE', 'Não exigir antecipação'], ['FIXED', 'Valor fixo'], ['PERCENTAGE', 'Percentual']] as const).map(([value, label]) => <label key={value} className="flex min-h-12 items-center gap-3 rounded-xl border border-brand-100 px-3 py-3 text-sm"><input type="radio" name="deposit" checked={settings.depositType === value} onChange={() => changeDepositType(value)} />{label}</label>)}</div>
        {settings.depositType !== 'NONE' ? <label className="mt-4 block text-sm text-slate-500">{settings.depositType === 'FIXED' ? 'Valor do sinal (R$)' : 'Percentual (%)'}<input inputMode="decimal" value={depositInput} onChange={(e) => valueChanged(e.target.value)} placeholder="0,00" className="field" /></label> : null}
        <button onClick={() => void save()} className="mt-5 brand-button w-full sm:w-auto">Salvar configuração</button>
        <SaveFeedback message={msg} />
      </Card>
    </div>
  );
}

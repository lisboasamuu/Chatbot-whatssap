import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type {
  BusinessHour, CompanySettings, MessageTemplate, MessageTemplateType,
  PlatformCompany, PlatformCompanyDetail, PlatformSummary, Weekday,
} from '../types';
import { api } from '../lib/api';

const WEEKDAYS: Array<{key:Weekday;label:string}> = [
  {key:'MONDAY',label:'Segunda-feira'},{key:'TUESDAY',label:'Terça-feira'},
  {key:'WEDNESDAY',label:'Quarta-feira'},{key:'THURSDAY',label:'Quinta-feira'},
  {key:'FRIDAY',label:'Sexta-feira'},{key:'SATURDAY',label:'Sábado'},
  {key:'SUNDAY',label:'Domingo'},
];
const TEMPLATE_LABELS:Record<MessageTemplateType,string>={
  WELCOME:'Mensagem de boas-vindas',
  APPOINTMENT_CREATED:'Agendamento confirmado',
  APPOINTMENT_CANCELLED:'Agendamento cancelado',
  APPOINTMENT_RESCHEDULED:'Agendamento remarcado',
  NO_APPOINTMENTS:'Nenhum agendamento',
  BUSINESS_CLOSED:'Fora do horário de atendimento',
};
const DEFAULT_MESSAGES:Record<MessageTemplateType,string>={
  WELCOME:'Olá! 👋 Bem-vindo. Como posso ajudar?',
  APPOINTMENT_CREATED:'Agendamento confirmado para {{date}} às {{time}}. Obrigado pela preferência!',
  APPOINTMENT_CANCELLED:'Agendamento cancelado com sucesso. Obrigado pela preferência!',
  APPOINTMENT_RESCHEDULED:'Agendamento remarcado para {{date}} às {{time}}. Obrigado pela preferência!',
  NO_APPOINTMENTS:'Você não possui agendamentos.',
  BUSINESS_CLOSED:'Esse horário está fora do horário de atendimento. Envie outro horário no formato HH:mm.',
};

function Card({children,className=''}:{children:ReactNode;className?:string}) {
  return <section className={`rounded-2xl border border-white/8 bg-[#151515] p-5 shadow-sm ${className}`}>{children}</section>;
}
function Badge({active}:{active:boolean}) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${active?'bg-emerald-500/12 text-emerald-300':'bg-white/7 text-zinc-400'}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${active?'bg-emerald-400':'bg-zinc-500'}`} />{active?'Ativa':'Inativa'}
  </span>;
}
function Login({onLogin}:{onLogin:()=>void}) {
  const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setLoading(true);setError('');try{await api.platformLogin(password);onLogin();}catch(err){setError(err instanceof Error?err.message:'Falha no login.');}finally{setLoading(false);}}
  return <div className="flex min-h-screen items-center justify-center bg-[#090909] px-4 text-zinc-100">
    <Card className="w-full max-w-md p-7">
      <div className="mb-7"><div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 font-black text-black">S</div>
        <p className="text-xs font-semibold uppercase tracking-[.24em] text-orange-400">S-TECH</p><h1 className="mt-2 text-2xl font-semibold">Platform Admin</h1>
        <p className="mt-2 text-sm text-zinc-400">Acesso privado à administração da plataforma.</p></div>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium text-zinc-300">Senha administrativa
          <input autoFocus type="password" value={password} onChange={e=>setPassword(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#0d0d0d] px-3.5 py-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" />
        </label>
        {error&&<p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <button disabled={loading||!password} className="w-full rounded-xl bg-orange-500 px-4 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50">
          {loading?'Entrando…':'Entrar com segurança'}
        </button>
      </form>
    </Card>
  </div>;
}

export function PlatformAdmin():ReactNode {
  const [authenticated,setAuthenticated]=useState<boolean|null>(null);
  const [companies,setCompanies]=useState<PlatformCompany[]>([]);
  const [summary,setSummary]=useState<PlatformSummary|null>(null);
  const [selected,setSelected]=useState<PlatformCompanyDetail|null>(null);
  const [view,setView]=useState<'dashboard'|'companies'|'company'>('dashboard');
  const [error,setError]=useState(''); const [loading,setLoading]=useState(false); const [creating,setCreating]=useState(false);

  async function refresh(){
    setLoading(true);setError('');
    try{const [s,c]=await Promise.all([api.getPlatformSummary(),api.getCompanies()]);setSummary(s);setCompanies(c);}
    catch(e){setError(e instanceof Error?e.message:'Falha ao carregar.');}
    finally{setLoading(false);}
  }
  useEffect(()=>{void api.platformSession().then(()=>setAuthenticated(true)).catch(()=>setAuthenticated(false));},[]);
  useEffect(()=>{if(authenticated) void refresh();},[authenticated]);
  async function openCompany(id:string){setLoading(true);setError('');try{setSelected(await api.getPlatformCompany(id));setView('company');}catch(e){setError(e instanceof Error?e.message:'Falha ao carregar empresa.');}finally{setLoading(false);}}
  async function logout(){await api.platformLogout();setAuthenticated(false);}
  if(authenticated===null) return <div className="grid min-h-screen place-items-center bg-[#090909] text-zinc-400">Verificando sessão…</div>;
  if(!authenticated) return <Login onLogin={()=>setAuthenticated(true)} />;

  return <div className="min-h-screen bg-[#090909] text-zinc-100">
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-white/7 bg-[#101010] p-5 lg:flex">
      <div className="mb-9 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-500 font-black text-black">S</div><div><strong className="block">S-TECH</strong><span className="text-xs text-zinc-500">Platform Admin</span></div></div>
      <nav className="space-y-1 text-sm">
        <button onClick={()=>setView('dashboard')} className={`w-full rounded-xl px-3 py-2.5 text-left transition ${view==='dashboard'?'bg-orange-500/12 text-orange-300':'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}>Visão geral</button>
        <button onClick={()=>setView('companies')} className={`w-full rounded-xl px-3 py-2.5 text-left transition ${view!=='dashboard'?'bg-orange-500/12 text-orange-300':'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}>Empresas</button>
      </nav>
      <div className="mt-auto rounded-xl border border-white/7 bg-white/[.025] p-3 text-xs text-zinc-500">Sessão protegida<br/>Expira após inatividade.</div>
    </aside>
    <main className="lg:ml-64">
      <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-white/7 bg-[#090909]/90 px-4 backdrop-blur md:px-8">
        <div><p className="text-xs text-zinc-500">S-TECH / Platform Admin</p><h1 className="font-semibold">{view==='dashboard'?'Dashboard':view==='companies'?'Empresas':selected?.name}</h1></div>
        <div className="flex gap-2"><button onClick={()=>setView('companies')} className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-white/5 lg:hidden">Empresas</button><button onClick={()=>void logout()} className="rounded-lg border border-white/8 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5">Sair</button></div>
      </header>
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        {error&&<div role="alert" className="mb-5 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-300">{error}</div>}
        {loading&&<div className="mb-5 text-sm text-zinc-500">Carregando…</div>}
        {view==='dashboard'&&<Dashboard summary={summary} companies={companies} onCompanies={()=>setView('companies')} />}
        {view==='companies'&&<Companies companies={companies} creating={creating} setCreating={setCreating} onCreated={async c=>{setCreating(false);await refresh();await openCompany(c.id);}} onOpen={id=>void openCompany(id)} />}
        {view==='company'&&selected&&<CompanyEditor company={selected} onChange={setSelected} onSaved={async c=>{setSelected(c);await refresh();}} />}
      </div>
    </main>
  </div>;
}

function Dashboard({summary,companies,onCompanies}:{summary:PlatformSummary|null;companies:PlatformCompany[];onCompanies:()=>void}) {
  const cards=[['Total de empresas',summary?.totalCompanies??'—'],['Empresas ativas',summary?.activeCompanies??'—'],['Empresas inativas',summary?.inactiveCompanies??'—'],['Total de agendamentos',summary?.totalAppointments??'—']];
  return <div className="space-y-6"><div className="flex items-end justify-between"><div><p className="text-sm text-zinc-500">Operação da plataforma</p><h2 className="mt-1 text-2xl font-semibold">Visão geral</h2></div><button onClick={onCompanies} className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-orange-400">Gerenciar empresas</button></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value])=><Card key={String(label)}><p className="text-sm text-zinc-500">{label}</p><strong className="mt-3 block text-3xl">{value}</strong></Card>)}</div>
    <Card><div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold">Empresas recentes</h3><p className="text-sm text-zinc-500">Dados reais cadastrados na plataforma.</p></div></div>
      {companies.length===0?<p className="py-10 text-center text-sm text-zinc-500">Nenhuma empresa cadastrada.</p>:<CompanyTable companies={companies.slice(0,6)} onOpen={()=>onCompanies()} />}</Card></div>;
}
function CompanyTable({companies,onOpen}:{companies:PlatformCompany[];onOpen:(id:string)=>void}) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-white/7 text-xs uppercase tracking-wide text-zinc-500"><tr><th className="py-3">Empresa</th><th>Status</th><th>Identificador</th><th>Timezone</th><th>Clientes</th><th>Criada em</th><th /></tr></thead><tbody>{companies.map(c=><tr key={c.id} className="border-b border-white/5 transition hover:bg-white/[.025]"><td className="py-4 font-medium">{c.name}</td><td><Badge active={c.status==='ACTIVE'} /></td><td className="font-mono text-xs text-zinc-500">{c.id}</td><td className="text-zinc-400">{c.timezone}</td><td className="text-zinc-400">{c.customerCount}</td><td className="text-zinc-400">{new Date(c.createdAt).toLocaleDateString('pt-BR')}</td><td className="text-right"><button onClick={()=>onOpen(c.id)} className="rounded-lg px-3 py-2 text-orange-300 hover:bg-orange-500/10">Configurar</button></td></tr>)}</tbody></table></div>;
}
function Companies({companies,creating,setCreating,onCreated,onOpen}:{companies:PlatformCompany[];creating:boolean;setCreating:(v:boolean)=>void;onCreated:(c:PlatformCompanyDetail)=>void;onOpen:(id:string)=>void}) {
  return <div className="space-y-5"><div className="flex items-end justify-between gap-4"><div><p className="text-sm text-zinc-500">Cadastro e configuração</p><h2 className="mt-1 text-2xl font-semibold">Empresas</h2></div><button onClick={()=>setCreating(!creating)} className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-orange-400">+ Nova empresa</button></div>
    {creating&&<NewCompany onCreated={onCreated}/>}<Card>{companies.length?<CompanyTable companies={companies} onOpen={onOpen}/>:<div className="py-12 text-center"><p className="font-medium">Nenhuma empresa cadastrada</p><p className="mt-1 text-sm text-zinc-500">Cadastre a primeira empresa para começar.</p></div>}</Card></div>;
}
function NewCompany({onCreated}:{onCreated:(c:PlatformCompanyDetail)=>void}) {
  const [name,setName]=useState('');const [timezone,setTimezone]=useState('America/Sao_Paulo');const [error,setError]=useState('');const [saving,setSaving]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setSaving(true);setError('');try{onCreated(await api.createCompany({name,timezone}));}catch(err){setError(err instanceof Error?err.message:'Falha ao cadastrar.');}finally{setSaving(false);}}
  return <Card><form onSubmit={submit} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end"><label className="text-sm text-zinc-400">Nome<input value={name} onChange={e=>setName(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0d0d0d] px-3 py-2.5 text-zinc-100 outline-none focus:border-orange-500"/></label><label className="text-sm text-zinc-400">Timezone<input value={timezone} onChange={e=>setTimezone(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0d0d0d] px-3 py-2.5 text-zinc-100 outline-none focus:border-orange-500"/></label><button disabled={saving} className="rounded-xl bg-orange-500 px-5 py-2.5 font-semibold text-black disabled:opacity-50">{saving?'Salvando…':'Cadastrar'}</button>{error&&<p className="text-sm text-red-300 md:col-span-3">{error}</p>}</form></Card>;
}
function CompanyEditor({company,onSaved}:{company:PlatformCompanyDetail;onChange:(c:PlatformCompanyDetail)=>void;onSaved:(c:PlatformCompanyDetail)=>void}) {
  const [section,setSection]=useState<'general'|'hours'|'messages'|'pix'>('general');
  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="text-2xl font-semibold">{company.name}</h2><Badge active={company.status==='ACTIVE'}/></div><p className="mt-1 text-sm text-zinc-500">{company.id}</p></div></div>
    <div className="flex gap-2 overflow-x-auto pb-1">{([['general','Visão geral'],['hours','Horários'],['messages','Mensagens'],['pix','Pix / Antecipação']] as const).map(([k,l])=><button key={k} onClick={()=>setSection(k)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm ${section===k?'bg-orange-500 text-black':'bg-[#151515] text-zinc-400 hover:text-zinc-200'}`}>{l}</button>)}</div>
    {section==='general'&&<General company={company} onSaved={onSaved}/>}
    {section==='hours'&&<Hours company={company} onSaved={onSaved}/>}
    {section==='messages'&&<Messages company={company} onSaved={onSaved}/>}
    {section==='pix'&&<Pix company={company} onSaved={onSaved}/>}
  </div>;
}
function SaveFeedback({message}:{message:string}){return message?<p className="mt-3 text-sm text-zinc-400">{message}</p>:null}
function General({company,onSaved}:{company:PlatformCompanyDetail;onSaved:(c:PlatformCompanyDetail)=>void}) {
  const [name,setName]=useState(company.name),[timezone,setTimezone]=useState(company.timezone),[msg,setMsg]=useState('');
  async function save(){try{onSaved(await api.updatePlatformCompany(company.id,{name,timezone}));setMsg('Informações salvas.');}catch(e){setMsg(e instanceof Error?e.message:'Erro ao salvar.');}}
  async function toggle(){try{onSaved(await api.updatePlatformCompany(company.id,{status:company.status==='ACTIVE'?'INACTIVE':'ACTIVE'}));setMsg(company.status==='ACTIVE'?'Empresa desativada. Histórico preservado.':'Empresa ativada.');}catch(e){setMsg(e instanceof Error?e.message:'Erro.');}}
  return <div className="grid gap-5 xl:grid-cols-3"><Card className="xl:col-span-2"><h3 className="font-semibold">Informações gerais</h3><p className="mt-1 text-sm text-zinc-500">Identidade operacional e timezone da empresa.</p><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm text-zinc-400">Nome<input value={name} onChange={e=>setName(e.target.value)} className="field"/></label><label className="text-sm text-zinc-400">Timezone<input value={timezone} onChange={e=>setTimezone(e.target.value)} className="field"/></label></div><button onClick={()=>void save()} className="mt-5 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-black">Salvar alterações</button><SaveFeedback message={msg}/></Card>
  <Card><h3 className="font-semibold">Status operacional</h3><p className="mt-2 text-sm leading-6 text-zinc-500">Ao desativar, o WhatsApp e novos agendamentos deixam de operar. O histórico permanece intacto.</p><button onClick={()=>void toggle()} className="mt-5 rounded-xl border border-white/10 px-4 py-2.5 text-sm hover:bg-white/5">{company.status==='ACTIVE'?'Desativar empresa':'Ativar empresa'}</button></Card></div>;
}
function Hours({company,onSaved}:{company:PlatformCompanyDetail;onSaved:(c:PlatformCompanyDetail)=>void}) {
  const [hours,setHours]=useState<BusinessHour[]>(company.businessHours),[msg,setMsg]=useState('');
  const byDay=useMemo(()=>new Map(WEEKDAYS.map(d=>[d.key,hours.filter(h=>h.weekday===d.key)])),[hours]);
  function add(day:Weekday){setHours(v=>[...v,{weekday:day,startTime:'09:00',endTime:'18:00'}]);}
  function update(day:Weekday,index:number,key:'startTime'|'endTime',value:string){let seen=-1;setHours(v=>v.map(h=>{if(h.weekday!==day)return h;seen++;return seen===index?{...h,[key]:value}:h;}));}
  function remove(day:Weekday,index:number){let seen=-1;setHours(v=>v.filter(h=>{if(h.weekday!==day)return true;seen++;return seen!==index;}));}
  async function save(){try{onSaved(await api.saveBusinessHours(company.id,hours));setMsg('Horários salvos e aplicados à disponibilidade.');}catch(e){setMsg(e instanceof Error?e.message:'Erro ao salvar.');}}
  return <Card><div className="flex items-end justify-between"><div><h3 className="font-semibold">Horários semanais</h3><p className="mt-1 text-sm text-zinc-500">Dias sem períodos ficam fechados. Intervalos são simplesmente múltiplas faixas.</p></div><button onClick={()=>void save()} className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-black">Salvar horários</button></div>
    <div className="mt-6 divide-y divide-white/6">{WEEKDAYS.map(day=>{const ps=byDay.get(day.key)??[];return <div key={day.key} className="grid gap-3 py-4 md:grid-cols-[180px_1fr]"><div><strong className="text-sm">{day.label}</strong><span className="mt-1 block text-xs text-zinc-500">{ps.length?'Aberto':'Fechado'}</span></div><div className="space-y-2">{ps.map((p,i)=><div key={`${p.startTime}-${i}`} className="flex flex-wrap items-center gap-2"><input type="time" value={p.startTime} onChange={e=>update(day.key,i,'startTime',e.target.value)} className="time-field"/><span className="text-zinc-600">até</span><input type="time" value={p.endTime} onChange={e=>update(day.key,i,'endTime',e.target.value)} className="time-field"/><button onClick={()=>remove(day.key,i)} className="rounded-lg px-2 py-2 text-xs text-zinc-500 hover:bg-red-500/10 hover:text-red-300">remover</button></div>)}<button onClick={()=>add(day.key)} className="text-sm font-medium text-orange-300 hover:text-orange-200">+ Adicionar período</button></div></div>})}</div><SaveFeedback message={msg}/></Card>;
}
function Messages({company,onSaved}:{company:PlatformCompanyDetail;onSaved:(c:PlatformCompanyDetail)=>void}) {
  const types=Object.keys(TEMPLATE_LABELS) as MessageTemplateType[];
  const [templates,setTemplates]=useState<MessageTemplate[]>(company.messageTemplates),[msg,setMsg]=useState('');
  function body(type:MessageTemplateType){return templates.find(t=>t.type===type)?.body??'';}
  function set(type:MessageTemplateType,value:string){setTemplates(v=>[...v.filter(t=>t.type!==type),...(value?[{type,body:value}]:[])]);}
  async function save(){try{onSaved(await api.saveMessageTemplates(company.id,templates));setMsg('Mensagens salvas.');}catch(e){setMsg(e instanceof Error?e.message:'Erro ao salvar.');}}
  return <div className="space-y-4">{types.map(type=><Card key={type}><div className="flex items-center justify-between"><div><h3 className="font-semibold">{TEMPLATE_LABELS[type]}</h3><p className="mt-1 text-xs text-zinc-500">{body(type)?'Personalizada':'Usando padrão da plataforma'}</p></div>{body(type)&&<button onClick={()=>set(type,'')} className="text-xs text-zinc-400 hover:text-orange-300">Restaurar padrão</button>}</div><textarea rows={3} value={body(type)} placeholder={DEFAULT_MESSAGES[type]} onChange={e=>set(type,e.target.value)} className="field mt-4 resize-y"/>{['APPOINTMENT_CREATED','APPOINTMENT_RESCHEDULED'].includes(type)&&<p className="mt-2 text-xs text-zinc-600">Placeholders permitidos: {'{{date}}'} e {'{{time}}'}.</p>}</Card>)}<button onClick={()=>void save()} className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-black">Salvar mensagens</button><SaveFeedback message={msg}/></div>;
}
function Pix({company,onSaved}:{company:PlatformCompanyDetail;onSaved:(c:PlatformCompanyDetail)=>void}) {
  const [settings,setSettings]=useState<CompanySettings>(company.settings),[msg,setMsg]=useState('');
  const displayValue=settings.depositValue===null?'':settings.depositType==='FIXED'?(settings.depositValue/100).toFixed(2):(settings.depositValue/100).toFixed(2);
  function valueChanged(raw:string){const n=Number(raw.replace(',','.'));setSettings(s=>({...s,depositValue:Number.isFinite(n)&&n>0?Math.round(n*100):null}));}
  async function save(){try{onSaved(await api.saveCompanySettings(company.id,settings));setMsg('Configuração salva. Nenhuma cobrança é processada por esta tela.');}catch(e){setMsg(e instanceof Error?e.message:'Erro ao salvar.');}}
  return <div className="grid gap-5 xl:grid-cols-2"><Card><h3 className="font-semibold">Pix</h3><p className="mt-1 text-sm text-zinc-500">Somente configuração para uso futuro. Nenhum pagamento é processado.</p><label className="mt-5 flex items-center gap-3 text-sm"><input type="checkbox" checked={settings.pixEnabled} onChange={e=>setSettings({...settings,pixEnabled:e.target.checked})}/> Habilitar dados Pix</label><div className="mt-4 grid gap-4"><label className="text-sm text-zinc-400">Chave Pix<input disabled={!settings.pixEnabled} value={settings.pixKey??''} onChange={e=>setSettings({...settings,pixKey:e.target.value||null})} className="field"/></label><label className="text-sm text-zinc-400">Favorecido<input disabled={!settings.pixEnabled} value={settings.pixRecipientName??''} onChange={e=>setSettings({...settings,pixRecipientName:e.target.value||null})} className="field"/></label></div></Card>
    <Card><h3 className="font-semibold">Antecipação</h3><div className="mt-5 space-y-2">{([['NONE','Não exigir antecipação'],['FIXED','Valor fixo'],['PERCENTAGE','Percentual']] as const).map(([v,l])=><label key={v} className="flex items-center gap-3 rounded-xl border border-white/7 px-3 py-3 text-sm"><input type="radio" name="deposit" checked={settings.depositType===v} onChange={()=>setSettings({...settings,depositType:v,depositValue:null})}/>{l}</label>)}</div>{settings.depositType!=='NONE'&&<label className="mt-4 block text-sm text-zinc-400">{settings.depositType==='FIXED'?'Valor do sinal (R$)':'Percentual (%)'}<input inputMode="decimal" value={displayValue} onChange={e=>valueChanged(e.target.value)} className="field"/></label>}<button onClick={()=>void save()} className="mt-5 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-black">Salvar configuração</button><SaveFeedback message={msg}/></Card></div>;
}

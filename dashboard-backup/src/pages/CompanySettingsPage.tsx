import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type {
  BusinessHour, CompanyConfiguration, CompanySettings, MessageTemplate,
  MessageTemplateType, ReminderOffsetMinutes, Weekday,
} from '../types';

const WEEKDAYS:Array<{key:Weekday;label:string}>=[
  {key:'MONDAY',label:'Segunda'},{key:'TUESDAY',label:'Terça'},{key:'WEDNESDAY',label:'Quarta'},
  {key:'THURSDAY',label:'Quinta'},{key:'FRIDAY',label:'Sexta'},{key:'SATURDAY',label:'Sábado'},{key:'SUNDAY',label:'Domingo'},
];
const LABELS:Record<MessageTemplateType,string>={WELCOME:'Boas-vindas',APPOINTMENT_CREATED:'Agendamento confirmado',APPOINTMENT_CANCELLED:'Agendamento cancelado',APPOINTMENT_RESCHEDULED:'Agendamento remarcado',NO_APPOINTMENTS:'Nenhum agendamento',BUSINESS_CLOSED:'Fora do horário',REMINDER:'Lembrete'};
const REMINDERS:Array<{value:ReminderOffsetMinutes;label:string}>=[{value:1440,label:'24 horas antes'},{value:720,label:'12 horas antes'},{value:240,label:'4 horas antes'},{value:60,label:'1 hora antes'},{value:30,label:'30 minutos antes'}];

function Card({children}:{children:ReactNode}){return <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">{children}</section>}
function Feedback({value}:{value:string}){return value?<p className="mt-3 text-sm text-slate-400">{value}</p>:null}

export function CompanySettingsPage():ReactNode {
  const [config,setConfig]=useState<CompanyConfiguration|null>(null); const [error,setError]=useState('');
  useEffect(()=>{void api.getCompanyConfiguration().then(setConfig).catch(e=>setError(e instanceof Error?e.message:'Falha ao carregar configurações.'));},[]);
  if(error)return <div role="alert" className="rounded-xl bg-red-500/10 p-4 text-red-300">{error}</div>;
  if(!config)return <p className="text-slate-400">Carregando configurações…</p>;
  return <div className="space-y-6"><div><p className="text-sm text-cyan-400">Configuração da empresa</p><h2 className="mt-1 text-2xl font-semibold">Operação</h2><p className="mt-2 text-sm text-slate-400">Horários, mensagens, lembretes e dados Pix usados pelo chatbot.</p></div>
    <Hours config={config} setConfig={setConfig}/><Messages config={config} setConfig={setConfig}/><Reminders config={config} setConfig={setConfig}/><Pix config={config} setConfig={setConfig}/>
  </div>;
}

function Hours({config,setConfig}:{config:CompanyConfiguration;setConfig:(v:CompanyConfiguration)=>void}){
  const [hours,setHours]=useState(config.businessHours),[msg,setMsg]=useState('');
  const byDay=useMemo(()=>new Map(WEEKDAYS.map(day=>[day.key,hours.filter(h=>h.weekday===day.key)])),[hours]);
  function add(day:Weekday){setHours(v=>[...v,{weekday:day,startTime:'09:00',endTime:'18:00'}]);}
  function update(day:Weekday,index:number,key:'startTime'|'endTime',value:string){let seen=-1;setHours(v=>v.map(h=>{if(h.weekday!==day)return h;seen+=1;return seen===index?{...h,[key]:value}:h;}));}
  function remove(day:Weekday,index:number){let seen=-1;setHours(v=>v.filter(h=>{if(h.weekday!==day)return true;seen+=1;return seen!==index;}));}
  async function save(){try{const saved=await api.saveOwnBusinessHours(hours);setHours(saved);setConfig({...config,businessHours:saved});setMsg('Horários salvos.');}catch(e){setMsg(e instanceof Error?e.message:'Erro ao salvar.');}}
  return <Card><div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-semibold">Horários de atendimento</h3><p className="mt-1 text-sm text-slate-400">Dias sem período ficam fechados.</p></div><button onClick={()=>void save()} className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950">Salvar horários</button></div><div className="mt-5 divide-y divide-slate-800">{WEEKDAYS.map(day=><div key={day.key} className="grid gap-3 py-4 md:grid-cols-[130px_1fr]"><strong className="text-sm">{day.label}</strong><div className="space-y-2">{(byDay.get(day.key)??[]).map((period,index)=><div key={`${period.startTime}-${index}`} className="flex flex-wrap items-center gap-2"><input type="time" value={period.startTime} onChange={e=>update(day.key,index,'startTime',e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"/><span className="text-slate-500">até</span><input type="time" value={period.endTime} onChange={e=>update(day.key,index,'endTime',e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"/><button onClick={()=>remove(day.key,index)} className="px-2 py-2 text-xs text-slate-400">remover</button></div>)}<button onClick={()=>add(day.key)} className="text-sm font-medium text-cyan-300">+ Adicionar período</button></div></div>)}</div><Feedback value={msg}/></Card>;
}

function Messages({config,setConfig}:{config:CompanyConfiguration;setConfig:(v:CompanyConfiguration)=>void}){
  const [templates,setTemplates]=useState(config.messageTemplates),[msg,setMsg]=useState('');
  const types=(Object.keys(LABELS) as MessageTemplateType[]).filter(t=>t!=='REMINDER');
  function body(type:MessageTemplateType){return templates.find(t=>t.type===type)?.body??'';}
  function set(type:MessageTemplateType,value:string){setTemplates(v=>[...v.filter(t=>t.type!==type),...(value.trim()?[{type,body:value}]:[])]);}
  async function save(){try{const reminder=config.messageTemplates.find(t=>t.type==='REMINDER');const payload=[...templates.filter(t=>t.type!=='REMINDER'),...(reminder?[reminder]:[])];const saved=await api.saveOwnMessageTemplates(payload);setTemplates(saved);setConfig({...config,messageTemplates:saved});setMsg('Mensagens salvas.');}catch(e){setMsg(e instanceof Error?e.message:'Erro ao salvar.');}}
  return <Card><div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-semibold">Mensagens</h3><p className="mt-1 text-sm text-slate-400">Campos vazios usam o texto padrão da plataforma.</p></div><button onClick={()=>void save()} className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950">Salvar mensagens</button></div><div className="mt-5 grid gap-4 lg:grid-cols-2">{types.map(type=><label key={type} className="text-sm text-slate-300">{LABELS[type]}<textarea rows={3} value={body(type)} onChange={e=>set(type,e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 outline-none focus:border-cyan-400"/></label>)}</div><Feedback value={msg}/></Card>;
}

function Reminders({config,setConfig}:{config:CompanyConfiguration;setConfig:(v:CompanyConfiguration)=>void}){
  const [enabled,setEnabled]=useState(config.reminders.enabled),[offsets,setOffsets]=useState(config.reminders.offsets),[msg,setMsg]=useState('');
  const [message,setMessage]=useState(config.messageTemplates.find(t=>t.type==='REMINDER')?.body??'');
  function toggle(value:ReminderOffsetMinutes){setOffsets(v=>v.includes(value)?v.filter(x=>x!==value):[...v,value]);}
  async function save(){try{const saved=await api.saveOwnReminders({enabled,offsets,message:message.trim()||null});const next={...config,reminders:saved.reminders,messageTemplates:saved.messageTemplates};setConfig(next);setMsg('Lembretes salvos.');}catch(e){setMsg(e instanceof Error?e.message:'Erro ao salvar.');}}
  return <Card><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Lembretes automáticos</h3><p className="mt-1 text-sm text-slate-400">Escolha quando o cliente será lembrado.</p></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Ativar</label></div><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{REMINDERS.map(item=><label key={item.value} className="flex items-center gap-2 rounded-xl border border-slate-800 p-3 text-sm"><input type="checkbox" checked={offsets.includes(item.value)} onChange={()=>toggle(item.value)}/>{item.label}</label>)}</div><label className="mt-5 block text-sm text-slate-300">Mensagem do lembrete<textarea rows={4} value={message} onChange={e=>setMessage(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 outline-none focus:border-cyan-400"/></label><p className="mt-2 text-xs text-slate-500">Placeholders: {'{{customerName}}'}, {'{{date}}'}, {'{{time}}'}, {'{{companyName}}'}.</p><button onClick={()=>void save()} className="mt-4 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950">Salvar lembretes</button><Feedback value={msg}/></Card>;
}

function Pix({config,setConfig}:{config:CompanyConfiguration;setConfig:(v:CompanyConfiguration)=>void}){
  const [settings,setSettings]=useState<CompanySettings>(config.settings),[msg,setMsg]=useState('');
  async function save(){try{const saved=await api.saveOwnSettings(settings);setSettings(saved);setConfig({...config,settings:saved});setMsg('Configuração Pix salva.');}catch(e){setMsg(e instanceof Error?e.message:'Erro ao salvar.');}}
  return <Card><h3 className="font-semibold">Pix / antecipação</h3><p className="mt-1 text-sm text-slate-400">Somente configuração. Esta versão não processa pagamentos.</p><label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.pixEnabled} onChange={e=>setSettings({...settings,pixEnabled:e.target.checked})}/> Habilitar dados Pix</label><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm text-slate-300">Chave Pix<input disabled={!settings.pixEnabled} value={settings.pixKey??''} onChange={e=>setSettings({...settings,pixKey:e.target.value||null})} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 disabled:opacity-50"/></label><label className="text-sm text-slate-300">Favorecido<input disabled={!settings.pixEnabled} value={settings.pixRecipientName??''} onChange={e=>setSettings({...settings,pixRecipientName:e.target.value||null})} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 disabled:opacity-50"/></label></div><button onClick={()=>void save()} className="mt-4 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950">Salvar Pix</button><Feedback value={msg}/></Card>;
}

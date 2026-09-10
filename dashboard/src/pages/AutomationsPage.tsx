import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type {
  Automation,
  AutomationInput,
  AutomationScheduleType,
  AutomationType,
  Customer,
  Weekday,
} from '../types';

const WEEKDAYS: Array<{ key: Weekday; short: string; label: string }> = [
  { key: 'MONDAY', short: 'Seg', label: 'Segunda' },
  { key: 'TUESDAY', short: 'Ter', label: 'Terça' },
  { key: 'WEDNESDAY', short: 'Qua', label: 'Quarta' },
  { key: 'THURSDAY', short: 'Qui', label: 'Quinta' },
  { key: 'FRIDAY', short: 'Sex', label: 'Sexta' },
  { key: 'SATURDAY', short: 'Sáb', label: 'Sábado' },
  { key: 'SUNDAY', short: 'Dom', label: 'Domingo' },
];

interface FormState {
  name: string;
  type: AutomationType;
  isActive: boolean;
  variations: string[];
  responseBody: string;
  messageBody: string;
  scheduleType: AutomationScheduleType;
  oneTimeDate: string;
  oneTimeTime: string;
  weekdays: Weekday[];
  times: string[];
  recipientIds: string[];
}

function initialForm(): FormState {
  return {
    name: '', type: 'INBOUND', isActive: true, variations: [''], responseBody: '', messageBody: '',
    scheduleType: 'ONE_TIME', oneTimeDate: '', oneTimeTime: '09:00', weekdays: [], times: ['09:00'], recipientIds: [],
  };
}

function editForm(automation: Automation): FormState {
  return {
    name: automation.name,
    type: automation.type,
    isActive: automation.isActive,
    variations: automation.variations.map((item) => item.value),
    responseBody: automation.responseBody ?? '',
    messageBody: automation.messageBody ?? '',
    scheduleType: automation.scheduleType ?? 'ONE_TIME',
    oneTimeDate: automation.oneTimeDate ?? '',
    oneTimeTime: automation.oneTimeTime ?? '09:00',
    weekdays: automation.weekdays,
    times: automation.times.length ? automation.times : ['09:00'],
    recipientIds: automation.recipients.map((item) => item.customerId),
  };
}

function toInput(form: FormState): AutomationInput {
  const base = { name: form.name, type: form.type, isActive: form.isActive };
  return form.type === 'INBOUND'
    ? { ...base, variations: form.variations, responseBody: form.responseBody }
    : {
        ...base, messageBody: form.messageBody, scheduleType: form.scheduleType,
        oneTimeDate: form.scheduleType === 'ONE_TIME' ? form.oneTimeDate : null,
        oneTimeTime: form.scheduleType === 'ONE_TIME' ? form.oneTimeTime : null,
        weekdays: form.scheduleType === 'WEEKLY' ? form.weekdays : [],
        times: form.scheduleType === 'WEEKLY' ? form.times : [],
        recipientIds: form.recipientIds,
      };
}

function ContactCreator({ onCreated }: { onCreated: (customer: Customer) => void }): ReactNode {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(): Promise<void> {
    setSaving(true);
    setFeedback('');
    try {
      const customer = await api.createCustomer({ name, phone });
      onCreated(customer);
      setName(''); setPhone(''); setOpen(false);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível salvar o contato.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="brand-link min-h-10 text-sm">+ Novo contato</button>;
  }

  return (
    <div className="mt-3 rounded-2xl border border-brand-200 bg-brand-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Nome<input value={name} onChange={(event) => setName(event.target.value)} className="field" placeholder="João da Silva" maxLength={100} /></label>
        <label className="text-sm font-medium text-slate-700">WhatsApp<input value={phone} onChange={(event) => setPhone(event.target.value)} className="field" placeholder="+55 11 99999-9999" inputMode="tel" /></label>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">Confira o número antes de salvar. As mensagens serão enviadas exatamente para o WhatsApp cadastrado; esta validação não confirma que o número existe ou pertence à pessoa.</p>
      {feedback ? <p role="alert" className="mt-2 text-sm text-red-700">{feedback}</p> : null}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button type="button" disabled={saving} onClick={() => void save()} className="brand-button">{saving ? 'Salvando…' : 'Salvar contato'}</button>
        <button type="button" onClick={() => setOpen(false)} className="brand-button-secondary">Cancelar</button>
      </div>
    </div>
  );
}

function AutomationForm({
  value, setValue, customers, onCustomerCreated, onSave, onCancel, saving, editing,
}: {
  value: FormState;
  setValue: (value: FormState) => void;
  customers: Customer[];
  onCustomerCreated: (customer: Customer) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  editing: boolean;
}): ReactNode {
  const [search, setSearch] = useState('');
  const visibleCustomers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return customers.filter((customer) => !query || `${customer.name ?? ''} ${customer.externalId}`.toLocaleLowerCase('pt-BR').includes(query));
  }, [customers, search]);

  function setType(type: AutomationType): void {
    if (!editing) setValue({ ...value, type });
  }
  function toggleDay(day: Weekday): void {
    setValue({ ...value, weekdays: value.weekdays.includes(day) ? value.weekdays.filter((item) => item !== day) : [...value.weekdays, day] });
  }
  function toggleRecipient(id: string): void {
    setValue({ ...value, recipientIds: value.recipientIds.includes(id) ? value.recipientIds.filter((item) => item !== id) : [...value.recipientIds, id] });
  }

  return (
    <section className="brand-card border-brand-300" aria-label={editing ? 'Editar automação' : 'Criar automação'}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div><h3 className="text-lg font-semibold text-brand-900">{editing ? 'Editar automação' : 'Nova automação'}</h3><p className="mt-1 text-sm text-slate-500">Configure apenas o que esta automação precisa.</p></div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={value.isActive} onChange={(event) => setValue({ ...value, isActive: event.target.checked })} className="accent-brand-700" /> Ativa</label>
      </div>

      <label className="mt-5 block text-sm font-medium text-slate-700">Nome da automação<input value={value.name} onChange={(event) => setValue({ ...value, name: event.target.value })} className="field" maxLength={100} placeholder="Ex.: Serviços" /></label>
      <fieldset className="mt-5"><legend className="text-sm font-semibold text-slate-700">Quando executar?</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className={`rounded-xl border p-3 text-sm ${value.type === 'INBOUND' ? 'border-brand-400 bg-brand-100' : 'border-slate-200 bg-white'} ${editing ? 'opacity-70' : ''}`}><input type="radio" name="automation-type" checked={value.type === 'INBOUND'} disabled={editing} onChange={() => setType('INBOUND')} className="mr-2 accent-brand-700" />Ao receber uma mensagem</label>
        <label className={`rounded-xl border p-3 text-sm ${value.type === 'SCHEDULED' ? 'border-brand-400 bg-brand-100' : 'border-slate-200 bg-white'} ${editing ? 'opacity-70' : ''}`}><input type="radio" name="automation-type" checked={value.type === 'SCHEDULED'} disabled={editing} onChange={() => setType('SCHEDULED')} className="mr-2 accent-brand-700" />Em horários programados</label>
      </div></fieldset>

      {value.type === 'INBOUND' ? (
        <div className="mt-5 space-y-5">
          <div><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-700">Quando o cliente disser</p><span className="text-xs text-slate-400">{value.variations.length}/10</span></div>
            <div className="mt-2 space-y-2">{value.variations.map((variation, index) => <div key={index} className="flex gap-2"><input value={variation} onChange={(event) => setValue({ ...value, variations: value.variations.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} className="field mt-0" maxLength={200} aria-label={`Variação ${index + 1}`} placeholder="Ex.: quais serviços vocês oferecem" /><button type="button" disabled={value.variations.length === 1} onClick={() => setValue({ ...value, variations: value.variations.filter((_, itemIndex) => itemIndex !== index) })} className="min-h-11 rounded-xl px-3 text-sm text-slate-500 hover:bg-red-50 hover:text-red-700" aria-label={`Remover variação ${index + 1}`}>Remover</button></div>)}</div>
            <button type="button" disabled={value.variations.length >= 10} onClick={() => setValue({ ...value, variations: [...value.variations, ''] })} className="brand-link mt-2 min-h-10 text-sm">+ Adicionar variação</button>
          </div>
          <label className="block text-sm font-medium text-slate-700">Resposta<textarea value={value.responseBody} onChange={(event) => setValue({ ...value, responseBody: event.target.value })} rows={5} maxLength={4000} className="field resize-y" placeholder="Trabalhamos com…" /></label>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <div><label className="block text-sm font-medium text-slate-700">Buscar contato<input value={search} onChange={(event) => setSearch(event.target.value)} className="field" placeholder="Nome ou WhatsApp" /></label>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-2" role="group" aria-label="Destinatários">
              {visibleCustomers.length ? visibleCustomers.map((customer) => <label key={customer.id} className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-brand-50"><input type="checkbox" checked={value.recipientIds.includes(customer.id)} onChange={() => toggleRecipient(customer.id)} className="accent-brand-700" /><span className="min-w-0"><strong className="block truncate text-slate-700">{customer.name ?? 'Sem nome'}</strong><span className="block truncate text-xs text-slate-500">{customer.externalId}</span></span></label>) : <p className="p-3 text-sm text-slate-500">Nenhum contato encontrado.</p>}
            </div><p className="mt-2 text-xs text-slate-500">{value.recipientIds.length} contato(s) selecionado(s). Limite operacional inicial: 200.</p><ContactCreator onCreated={onCustomerCreated} />
          </div>
          <label className="block text-sm font-medium text-slate-700">Mensagem<textarea value={value.messageBody} onChange={(event) => setValue({ ...value, messageBody: event.target.value })} rows={5} maxLength={4000} className="field resize-y" /></label>
          <fieldset><legend className="text-sm font-semibold text-slate-700">Frequência</legend><div className="mt-2 flex flex-wrap gap-4"><label className="text-sm"><input type="radio" name="schedule-type" checked={value.scheduleType === 'ONE_TIME'} onChange={() => setValue({ ...value, scheduleType: 'ONE_TIME' })} className="mr-2 accent-brand-700" />Uma vez</label><label className="text-sm"><input type="radio" name="schedule-type" checked={value.scheduleType === 'WEEKLY'} onChange={() => setValue({ ...value, scheduleType: 'WEEKLY' })} className="mr-2 accent-brand-700" />Semanal</label></div></fieldset>
          {value.scheduleType === 'ONE_TIME' ? <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Data<input type="date" value={value.oneTimeDate} onChange={(event) => setValue({ ...value, oneTimeDate: event.target.value })} className="field" /></label><label className="text-sm font-medium text-slate-700">Horário<input type="time" value={value.oneTimeTime} onChange={(event) => setValue({ ...value, oneTimeTime: event.target.value })} className="field" /></label></div> : <div className="space-y-4">
            <fieldset><legend className="text-sm font-semibold text-slate-700">Dias</legend><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{WEEKDAYS.map((day) => <label key={day.key} className={`rounded-xl border p-3 text-sm ${value.weekdays.includes(day.key) ? 'border-brand-400 bg-brand-100 text-brand-900' : 'border-slate-200'}`}><input type="checkbox" checked={value.weekdays.includes(day.key)} onChange={() => toggleDay(day.key)} className="mr-2 accent-brand-700" />{day.short}</label>)}</div></fieldset>
            <div><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-700">Horários</p><span className="text-xs text-slate-400">{value.times.length}/3</span></div><div className="mt-2 space-y-2">{value.times.map((time, index) => <div key={index} className="flex gap-2"><input type="time" value={time} onChange={(event) => setValue({ ...value, times: value.times.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} className="time-field flex-1" aria-label={`Horário ${index + 1}`} /><button type="button" disabled={value.times.length === 1} onClick={() => setValue({ ...value, times: value.times.filter((_, itemIndex) => itemIndex !== index) })} className="rounded-xl px-3 text-sm text-slate-500 hover:bg-red-50 hover:text-red-700">Remover</button></div>)}</div><button type="button" disabled={value.times.length >= 3} onClick={() => setValue({ ...value, times: [...value.times, '09:00'] })} className="brand-link mt-2 min-h-10 text-sm">+ Adicionar horário</button></div>
          </div>}
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onCancel} className="brand-button-secondary">Cancelar</button><button type="button" disabled={saving} onClick={onSave} className="brand-button">{saving ? 'Salvando…' : 'Salvar automação'}</button></div>
    </section>
  );
}

function summary(automation: Automation): string {
  if (automation.type === 'INBOUND') return `${automation.variations.length} variação(ões)`;
  if (automation.scheduleType === 'ONE_TIME') return `${automation.oneTimeDate ?? ''} às ${automation.oneTimeTime ?? ''}`;
  const days = WEEKDAYS.filter((day) => automation.weekdays.includes(day.key)).map((day) => day.short).join(' • ');
  return `${days} · ${automation.times.join(' • ')}`;
}

export function AutomationsPage(): ReactNode {
  const [automations, setAutomations] = useState<Automation[] | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  async function load(): Promise<void> {
    try {
      const [automationData, customerData] = await Promise.all([api.getAutomations(), api.getCustomers()]);
      setAutomations(automationData); setCustomers(customerData); setFeedback('');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao carregar automações.');
    }
  }
  useEffect(() => { void load(); }, []);

  async function save(): Promise<void> {
    if (!form) return;
    setSaving(true); setFeedback('');
    try {
      if (editingId) await api.updateAutomation(editingId, toInput(form));
      else await api.createAutomation(toInput(form));
      setForm(null); setEditingId(null); await load();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível salvar a automação.');
    } finally { setSaving(false); }
  }

  async function toggle(automation: Automation): Promise<void> {
    try {
      const updated = await api.setAutomationActive(automation.id, !automation.isActive);
      setAutomations((current) => current?.map((item) => item.id === updated.id ? updated : item) ?? null);
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Não foi possível alterar o status.'); }
  }

  async function remove(automation: Automation): Promise<void> {
    if (!window.confirm(`Excluir a automação “${automation.name}”? O histórico de execuções será preservado.`)) return;
    try { await api.deleteAutomation(automation.id); setAutomations((current) => current?.filter((item) => item.id !== automation.id) ?? null); }
    catch (error) { setFeedback(error instanceof Error ? error.message : 'Não foi possível excluir.'); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="brand-eyebrow">Comunicação inteligente</p><h2 className="brand-page-title">Automações</h2><p className="mt-2 brand-muted">Automatize respostas e mensagens para seus clientes.</p></div>{!form ? <button type="button" onClick={() => { setEditingId(null); setForm(initialForm()); }} className="brand-button w-full sm:w-auto">+ Nova automação</button> : null}</div>
      {feedback ? <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{feedback}</p> : null}
      {form ? <AutomationForm value={form} setValue={setForm} customers={customers} onCustomerCreated={(customer) => { setCustomers((items) => [customer, ...items.filter((item) => item.id !== customer.id)]); setForm({ ...form, recipientIds: [...new Set([...form.recipientIds, customer.id])] }); }} onSave={() => void save()} onCancel={() => { setForm(null); setEditingId(null); }} saving={saving} editing={Boolean(editingId)} /> : null}
      {automations === null ? <p className="text-sm text-slate-500">Carregando automações…</p> : automations.length === 0 ? <section className="brand-card-muted text-center"><h3 className="font-semibold text-brand-900">Nenhuma automação ainda</h3><p className="mt-2 text-sm text-slate-500">Crie uma resposta automática ou programe uma mensagem para seus contatos.</p></section> : <div className="grid gap-4 lg:grid-cols-2">{automations.map((automation) => { const lastRun = automation.runs[0]; return <article key={automation.id} className="brand-card"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-semibold text-brand-900">{automation.name}</h3><p className="mt-1 text-sm text-slate-500">{automation.type === 'INBOUND' ? 'Ao receber mensagem' : 'Em horários programados'}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${automation.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{automation.isActive ? 'ATIVA' : 'INATIVA'}</span></div><p className="mt-4 text-sm text-slate-700">{summary(automation)}</p>{automation.type === 'SCHEDULED' ? <p className="mt-1 text-xs text-slate-500">{automation.recipients.length} contato(s){automation.nextRunAt ? ` · próxima: ${new Date(automation.nextRunAt).toLocaleString('pt-BR')}` : ''}</p> : null}{lastRun ? <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-xs text-slate-600">Última execução: {lastRun.status} · {lastRun.sentCount} enviada(s) · {lastRun.failedCount} não enviada(s)</p> : null}<div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => { setEditingId(automation.id); setForm(editForm(automation)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="brand-button-secondary">Editar</button><button type="button" onClick={() => void toggle(automation)} className="brand-button-secondary">{automation.isActive ? 'Desativar' : 'Ativar'}</button><button type="button" onClick={() => void remove(automation)} className="brand-button-danger">Excluir</button></div></article>; })}</div>}
    </div>
  );
}

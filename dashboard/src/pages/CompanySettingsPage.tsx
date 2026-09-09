import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type {
  BusinessHour,
  CompanyConfiguration,
  CompanySettings,
  MessageTemplateType,
  ReminderOffsetMinutes,
  Weekday,
} from '../types';

const WEEKDAYS: Array<{ key: Weekday; label: string }> = [
  { key: 'MONDAY', label: 'Segunda' },
  { key: 'TUESDAY', label: 'Terça' },
  { key: 'WEDNESDAY', label: 'Quarta' },
  { key: 'THURSDAY', label: 'Quinta' },
  { key: 'FRIDAY', label: 'Sexta' },
  { key: 'SATURDAY', label: 'Sábado' },
  { key: 'SUNDAY', label: 'Domingo' },
];

const LABELS: Record<MessageTemplateType, string> = {
  WELCOME: 'Boas-vindas (primeira mensagem)',
  APPOINTMENT_CREATED: 'Agendamento confirmado',
  APPOINTMENT_CANCELLED: 'Agendamento cancelado',
  APPOINTMENT_RESCHEDULED: 'Agendamento remarcado',
  NO_APPOINTMENTS: 'Nenhum agendamento',
  BUSINESS_CLOSED: 'Fora do horário',
  REMINDER: 'Lembrete',
};

const REMINDERS: Array<{ value: ReminderOffsetMinutes; label: string }> = [
  { value: 1440, label: '24 horas antes' },
  { value: 720, label: '12 horas antes' },
  { value: 240, label: '4 horas antes' },
  { value: 60, label: '1 hora antes' },
  { value: 30, label: '30 minutos antes' },
];

function Card({ children }: { children: ReactNode }) {
  return <section className="brand-card">{children}</section>;
}

function Feedback({ value }: { value: string }) {
  return value ? <p className="mt-3 text-sm text-slate-500">{value}</p> : null;
}

export function CompanySettingsPage(): ReactNode {
  const [config, setConfig] = useState<CompanyConfiguration | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void api
      .getCompanyConfiguration()
      .then(setConfig)
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha ao carregar configurações.'));
  }, []);

  if (error) {
    return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>;
  }
  if (!config) return <p className="text-slate-500">Carregando configurações…</p>;

  return (
    <div className="space-y-6">
      <div>
        <p className="brand-eyebrow">Configuração da empresa</p>
        <h2 className="brand-page-title">Operação</h2>
        <p className="mt-2 brand-muted">Horários, mensagens, lembretes e dados Pix usados pelo chatbot.</p>
      </div>
      <Hours config={config} setConfig={setConfig} />
      <Messages config={config} setConfig={setConfig} />
      <Reminders config={config} setConfig={setConfig} />
      <Pix config={config} setConfig={setConfig} />
    </div>
  );
}

function Hours({ config, setConfig }: { config: CompanyConfiguration; setConfig: (v: CompanyConfiguration) => void }) {
  const [hours, setHours] = useState(config.businessHours);
  const [msg, setMsg] = useState('');
  const byDay = useMemo(() => new Map(WEEKDAYS.map((day) => [day.key, hours.filter((h) => h.weekday === day.key)])), [hours]);

  function add(day: Weekday) {
    setHours((v) => [...v, { weekday: day, startTime: '09:00', endTime: '18:00' }]);
  }
  function update(day: Weekday, index: number, key: 'startTime' | 'endTime', value: string) {
    let seen = -1;
    setHours((v) => v.map((h) => {
      if (h.weekday !== day) return h;
      seen += 1;
      return seen === index ? { ...h, [key]: value } : h;
    }));
  }
  function remove(day: Weekday, index: number) {
    let seen = -1;
    setHours((v) => v.filter((h) => {
      if (h.weekday !== day) return true;
      seen += 1;
      return seen !== index;
    }));
  }
  async function save() {
    try {
      const saved = await api.saveOwnBusinessHours(hours);
      setHours(saved);
      setConfig({ ...config, businessHours: saved });
      setMsg('Horários salvos.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro ao salvar.');
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-semibold text-brand-900">Horários de atendimento</h3>
          <p className="mt-1 text-sm text-slate-500">Dias sem período ficam fechados.</p>
        </div>
        <button onClick={() => void save()} className="brand-button w-full sm:w-auto">Salvar horários</button>
      </div>
      <div className="mt-5 divide-y divide-brand-100">
        {WEEKDAYS.map((day) => (
          <div key={day.key} className="grid gap-3 py-4 md:grid-cols-[130px_1fr]">
            <strong className="text-sm text-slate-700">{day.label}</strong>
            <div className="space-y-2">
              {(byDay.get(day.key) ?? []).map((period: BusinessHour, index: number) => (
                <div key={`${period.startTime}-${index}`} className="grid grid-cols-2 gap-2 rounded-xl bg-brand-50/70 p-3 sm:flex sm:flex-wrap sm:items-end sm:bg-transparent sm:p-0">
                  <label className="min-w-0 text-xs font-medium text-slate-500 sm:text-[0]">
                    <span className="mb-1 block sm:sr-only">Início</span>
                    <input type="time" value={period.startTime} onChange={(e) => update(day.key, index, 'startTime', e.target.value)} className="time-field" />
                  </label>
                  <span className="hidden self-center text-sm text-slate-400 sm:inline">até</span>
                  <label className="min-w-0 text-xs font-medium text-slate-500 sm:text-[0]">
                    <span className="mb-1 block sm:sr-only">Fim</span>
                    <input type="time" value={period.endTime} onChange={(e) => update(day.key, index, 'endTime', e.target.value)} className="time-field" />
                  </label>
                  <button onClick={() => remove(day.key, index)} className="col-span-2 min-h-10 rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-700 sm:col-auto sm:text-center">Remover período</button>
                </div>
              ))}
              <button onClick={() => add(day.key)} className="brand-link inline-flex min-h-10 items-center text-sm">+ Adicionar período</button>
            </div>
          </div>
        ))}
      </div>
      <Feedback value={msg} />
    </Card>
  );
}

function Messages({ config, setConfig }: { config: CompanyConfiguration; setConfig: (v: CompanyConfiguration) => void }) {
  const [templates, setTemplates] = useState(config.messageTemplates);
  const [msg, setMsg] = useState('');
  const types = (Object.keys(LABELS) as MessageTemplateType[]).filter((t) => t !== 'REMINDER');

  function body(type: MessageTemplateType) {
    return templates.find((t) => t.type === type)?.body ?? '';
  }
  function set(type: MessageTemplateType, value: string) {
    setTemplates((v) => [...v.filter((t) => t.type !== type), ...(value.trim() ? [{ type, body: value }] : [])]);
  }
  async function save() {
    try {
      const reminder = config.messageTemplates.find((t) => t.type === 'REMINDER');
      const payload = [...templates.filter((t) => t.type !== 'REMINDER'), ...(reminder ? [reminder] : [])];
      const saved = await api.saveOwnMessageTemplates(payload);
      setTemplates(saved);
      setConfig({ ...config, messageTemplates: saved });
      setMsg('Mensagens salvas.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro ao salvar.');
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-semibold text-brand-900">Mensagens</h3>
          <p className="mt-1 text-sm text-slate-500">Campos vazios usam o texto padrão da plataforma.</p>
        </div>
        <button onClick={() => void save()} className="brand-button w-full sm:w-auto">Salvar mensagens</button>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {types.map((type) => (
          <label key={type} className="text-sm font-medium text-slate-700">
            {LABELS[type]}
            <textarea rows={3} value={body(type)} onChange={(e) => set(type, e.target.value)} className="field resize-y" />
          </label>
        ))}
      </div>
      <Feedback value={msg} />
    </Card>
  );
}

function Reminders({ config, setConfig }: { config: CompanyConfiguration; setConfig: (v: CompanyConfiguration) => void }) {
  const [enabled, setEnabled] = useState(config.reminders.enabled);
  const [offsets, setOffsets] = useState(config.reminders.offsets);
  const [msg, setMsg] = useState('');
  const [message, setMessage] = useState(config.messageTemplates.find((t) => t.type === 'REMINDER')?.body ?? '');

  function toggle(value: ReminderOffsetMinutes) {
    setOffsets((v) => v.includes(value) ? v.filter((x) => x !== value) : [...v, value]);
  }
  async function save() {
    try {
      const saved = await api.saveOwnReminders({ enabled, offsets, message: message.trim() || null });
      const next = { ...config, reminders: saved.reminders, messageTemplates: saved.messageTemplates };
      setConfig(next);
      setMsg('Lembretes salvos.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro ao salvar.');
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-brand-900">Lembretes automáticos</h3>
          <p className="mt-1 text-sm text-slate-500">Escolha quando o cliente será lembrado.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-brand-700" /> Ativar
        </label>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {REMINDERS.map((item) => {
          const active = offsets.includes(item.value);
          return (
            <label key={item.value} className={`flex items-center gap-2 rounded-xl border p-3 text-sm transition ${active ? 'border-brand-300 bg-brand-100 text-brand-900' : 'border-slate-200 bg-white text-slate-600'}`}>
              <input type="checkbox" checked={active} onChange={() => toggle(item.value)} className="accent-brand-700" />{item.label}
            </label>
          );
        })}
      </div>
      <label className="mt-5 block text-sm font-medium text-slate-700">
        Mensagem do lembrete
        <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className="field resize-y" />
      </label>
      <p className="mt-2 break-words text-xs leading-5 text-slate-400">Campos: {'{{NomeCliente}}'}, {'{{data}}'}, {'{{horario}}'}, {'{{NomeEmpresa}}'}.</p>
      <button onClick={() => void save()} className="brand-button mt-4 w-full sm:w-auto">Salvar lembretes</button>
      <Feedback value={msg} />
    </Card>
  );
}

function Pix({ config, setConfig }: { config: CompanyConfiguration; setConfig: (v: CompanyConfiguration) => void }) {
  const [settings, setSettings] = useState<CompanySettings>(config.settings);
  const [msg, setMsg] = useState('');

  async function save() {
    try {
      const saved = await api.saveOwnSettings(settings);
      setSettings(saved);
      setConfig({ ...config, settings: saved });
      setMsg('Configuração Pix salva.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro ao salvar.');
    }
  }

  return (
    <Card>
      <h3 className="font-semibold text-brand-900">Pix / antecipação</h3>
      <p className="mt-1 text-sm text-slate-500">Somente configuração. Esta versão não processa pagamentos.</p>
      <label className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" checked={settings.pixEnabled} onChange={(e) => setSettings({ ...settings, pixEnabled: e.target.checked })} className="accent-brand-700" /> Habilitar dados Pix
      </label>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Chave Pix<input disabled={!settings.pixEnabled} value={settings.pixKey ?? ''} onChange={(e) => setSettings({ ...settings, pixKey: e.target.value || null })} className="field" /></label>
        <label className="text-sm font-medium text-slate-700">Favorecido<input disabled={!settings.pixEnabled} value={settings.pixRecipientName ?? ''} onChange={(e) => setSettings({ ...settings, pixRecipientName: e.target.value || null })} className="field" /></label>
      </div>
      <button onClick={() => void save()} className="brand-button mt-4 w-full sm:w-auto">Salvar Pix</button>
      <Feedback value={msg} />
    </Card>
  );
}

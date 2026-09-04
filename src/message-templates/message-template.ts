export type MessageTemplateType =
  | 'WELCOME'
  | 'APPOINTMENT_CREATED'
  | 'APPOINTMENT_CANCELLED'
  | 'APPOINTMENT_RESCHEDULED'
  | 'NO_APPOINTMENTS'
  | 'BUSINESS_CLOSED'
  | 'REMINDER';

export type MessageTemplateVariables = Partial<
  Record<'customerName' | 'date' | 'time' | 'companyName', string>
>;

export const DEFAULT_MESSAGE_TEMPLATES: Record<MessageTemplateType, string> = {
  WELCOME: [
    'Olá! 👋 Bem-vindo.',
    '',
    'Como posso ajudar?',
    '',
    '• Para agendar um horário, digite "agendar".',
    '• Para consultar seus horários, digite "meus agendamentos".',
    '• Para remarcar um horário, digite "remarcar agendamento".',
    '• Para cancelar um horário, digite "cancelar agendamento".',
    '',
    'Durante uma operação, digite "sair" para voltar ao menu.',
  ].join('\n'),
  APPOINTMENT_CREATED:
    'Agendamento confirmado para {{date}} às {{time}}. Obrigado pela preferência!',
  APPOINTMENT_CANCELLED:
    'Agendamento cancelado com sucesso. Obrigado pela preferência!',
  APPOINTMENT_RESCHEDULED:
    'Agendamento remarcado para {{date}} às {{time}}. Obrigado pela preferência!',
  NO_APPOINTMENTS: 'Você não possui agendamentos.',
  BUSINESS_CLOSED:
    'Esse horário está fora do horário de atendimento. Envie outro horário no formato HH:mm.',
  REMINDER:
    'Olá, {{customerName}}! Este é um lembrete do seu agendamento na {{companyName}} em {{date}} às {{time}}.',
};

export const MESSAGE_TEMPLATE_PLACEHOLDERS: Record<
  MessageTemplateType,
  ReadonlySet<keyof MessageTemplateVariables>
> = {
  WELCOME: new Set(),
  APPOINTMENT_CREATED: new Set(['date', 'time']),
  APPOINTMENT_CANCELLED: new Set(),
  APPOINTMENT_RESCHEDULED: new Set(['date', 'time']),
  NO_APPOINTMENTS: new Set(),
  BUSINESS_CLOSED: new Set(),
  REMINDER: new Set(['customerName', 'date', 'time', 'companyName']),
};

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function findUnsupportedPlaceholder(
  type: MessageTemplateType,
  body: string,
): string | null {
  for (const match of body.matchAll(PLACEHOLDER_PATTERN)) {
    const placeholder = match[1] as keyof MessageTemplateVariables;
    if (!MESSAGE_TEMPLATE_PLACEHOLDERS[type].has(placeholder)) {
      return match[1] ?? null;
    }
  }
  return null;
}

export function renderMessageTemplate(
  type: MessageTemplateType,
  body: string,
  variables: MessageTemplateVariables = {},
): string {
  const unsupported = findUnsupportedPlaceholder(type, body);
  if (unsupported) {
    throw new Error(`Unsupported placeholder: ${unsupported}.`);
  }

  return body.replace(
    PLACEHOLDER_PATTERN,
    (_placeholder, key: keyof MessageTemplateVariables) => variables[key] ?? '',
  );
}

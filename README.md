# Código NS — Plataforma SaaS de Atendimento e Agendamentos via WhatsApp

Criado por **Samuel Lisboa**.

> Plataforma multiempresa para atendimento, agendamentos e automações via WhatsApp, com dashboard web, PostgreSQL, administração centralizada e isolamento por empresa.

**Instagram:** [@codigonsbr](https://www.instagram.com/codigonsbr)

---

## Visão geral

O projeto começou como uma integração incremental com WhatsApp e evoluiu para uma aplicação SaaS multiempresa.

Hoje a solução reúne:

- integração com WhatsApp via `whatsapp-web.js`;
- motor de conversação com máquina de estados;
- persistência PostgreSQL com Prisma;
- agendamento, cancelamento e remarcação;
- validação de datas, horários e disponibilidade;
- suporte a entradas como `hoje`, `amanhã`, `depois de amanhã` e `semana que vem`;
- dashboard empresarial em React;
- cadastro e consulta de clientes;
- configuração de horários comerciais;
- templates de mensagens;
- lembretes automáticos;
- arquitetura multiempresa;
- autenticação separada para empresas e Platform Admin;
- sessão empresarial persistida;
- runtime de WhatsApp independente por empresa;
- identidade visual Código NS;
- interface responsiva para mobile, tablet e desktop;
- configuração de Pix/antecipação preparada para uso futuro.

> **Importante:** Pix/antecipação ainda não processa pagamentos. A Fase 6 continua adiada.

---

## Status do roadmap

| Etapa | Status |
| --- | --- |
| Fase 0 — Integração WhatsApp | ✅ |
| Fase 1 — Motor de Conversação | ✅ |
| Fase 2 — PostgreSQL | ✅ |
| Fase 3 — Agendamentos | ✅ |
| Fase 4 — Dashboard React | ✅ |
| Fase 5 — Multiempresa | ✅ |
| Fase 5.5 — Platform Admin / Company Configuration | ✅ |
| Fase 6 — Pagamentos | ⏸️ Adiada |
| Fase 7 — Lembretes Automáticos | ✅ |
| Fase 7.5 — Company Access / Production Readiness | ✅ |
| Identidade visual Código NS | ✅ |
| Responsive UI / Mobile Polish | ✅ |
| IA / linguagem natural avançada | 🔜 Futuro |
| Analytics | 🔜 Futuro |

---

## Stack

### Backend

- Node.js
- TypeScript
- PostgreSQL
- Prisma ORM
- `whatsapp-web.js`
- ESLint

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Vitest
- ESLint

---

## Arquitetura

```text
Cliente WhatsApp
      │
      ▼
WhatsAppProvider
      │
      ▼
ConversationEngine
      │
      ├────────────► AppointmentService
      │
      ▼
Stores / Repositories
      │
      ▼
Prisma
      │
      ▼
PostgreSQL
```

Dashboard:

```text
Empresa
   │
   ▼
React Dashboard
   │
   ▼
Company Auth / Session
   │
   ▼
Company Context
   │
   ▼
API / Services
   │
   ▼
Repositories
   │
   ▼
PostgreSQL
```

O Platform Admin possui autenticação e sessão separadas do acesso empresarial.

---

## Multiempresa

A aplicação usa banco compartilhado com isolamento por `companyId`.

Cada empresa possui seu próprio contexto de:

- clientes;
- conversas;
- agendamentos;
- configurações;
- horários;
- templates;
- lembretes;
- credenciais;
- sessão web;
- conexão WhatsApp.

O tenant é resolvido no servidor a partir da sessão autenticada. O frontend não é fonte de confiança para definir `companyId`.

---

## WhatsApp por empresa

Empresas ativas possuem runtime isolado.

```text
CompanyRuntimeManager
        │
        ├── Empresa A
        │   ├── WhatsAppProvider
        │   ├── ConversationEngine
        │   ├── AppointmentService
        │   └── Reminder Worker
        │
        └── Empresa B
            ├── WhatsAppProvider
            ├── ConversationEngine
            ├── AppointmentService
            └── Reminder Worker
```

A autenticação usa `LocalAuth` separada por empresa.

O logout do dashboard **não desconecta** a sessão do WhatsApp.

---

## Agendamentos

O fluxo permite:

- criar;
- listar;
- cancelar;
- remarcar;
- validar data e horário;
- impedir horários passados;
- respeitar horário comercial;
- detectar conflito de slot.

Datas são normalizadas internamente como:

```text
YYYY-MM-DD
```

E podem ser exibidas como:

```text
DD/MM/AAAA
```

Também são aceitas expressões comuns como:

```text
hoje
amanhã
amanha
depois de amanhã
semana que vem
esse mesmo dia semana que vem
daqui a 3 dias
```

A resolução considera o timezone da empresa.

---

## Lembretes automáticos

Presets disponíveis:

```text
24 horas antes
12 horas antes
4 horas antes
1 hora antes
30 minutos antes
```

Os lembretes utilizam persistência em banco e worker periódico, evitando depender apenas de timers em memória.

---

## Dashboard empresarial

Áreas atuais:

- Dashboard;
- Agendamentos;
- Clientes;
- Configurações;
- WhatsApp.

Configurações incluem:

- horários comerciais;
- mensagens;
- lembretes;
- dados Pix;
- antecipação.

A interface usa a identidade visual **Código NS** e foi ajustada para mobile, tablet e desktop.

No mobile, a navegação principal utiliza drawer/menu.

---

## Platform Admin

Permite:

- visualizar empresas;
- cadastrar empresas;
- ativar/desativar empresas;
- configurar acesso empresarial;
- editar timezone;
- configurar horários;
- mensagens;
- lembretes;
- Pix/antecipação.

---

## Pix / Antecipação

A interface permite cadastrar:

- chave Pix;
- favorecido;
- antecipação desativada;
- valor fixo;
- percentual.

Valores monetários são exibidos no padrão brasileiro:

```text
0,01
1,00
10,50
150,90
```

Internamente, valores monetários podem continuar representados em centavos inteiros.

> Nenhum Pix é cobrado ou processado automaticamente nesta etapa.

---

## Estrutura principal

```text
Chatbot-whatssap/
├── dashboard/
│   ├── public/brand/
│   ├── src/
│   └── package.json
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── src/
│   ├── appointments/
│   ├── conversation/
│   ├── database/
│   ├── message-templates/
│   ├── reminders/
│   ├── whatssap/
│   └── ...
├── package.json
├── tsconfig.json
└── README.md
```

> `src/whatssap` mantém o nome histórico já existente no projeto.

---

## Pré-requisitos

- Node.js
- npm
- PostgreSQL

```bash
node --version
npm --version
psql --version
```

---

## Instalação

Na raiz:

```bash
npm install
```

Dashboard:

```bash
npm --prefix dashboard ci
```

Durante desenvolvimento também pode ser usado:

```bash
npm --prefix dashboard install
```

---

## Variáveis de ambiente

Crie `.env` na raiz conforme `.env.example`.

Variáveis importantes da arquitetura atual:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/chatbot?schema=public"
PLATFORM_ADMIN_PASSWORD="..."
SESSION_SECRET="..."
APP_ORIGIN="http://localhost:5173"
```

Dependendo do ambiente:

```env
TRUST_PROXY="..."
WHATSAPP_AUTH_PATH="..."
NODE_ENV="development"
```

Não versione:

```text
.env
.wwebjs_auth/
.wwebjs_cache/
node_modules/
dist/
dashboard/node_modules/
dashboard/dist/
```

---

## Prisma

```bash
npx prisma validate
npx prisma generate
npx prisma migrate status
```

Em desenvolvimento, quando houver migration nova:

```bash
npx prisma migrate dev
```

### Regra importante

**Nunca use `prisma migrate reset` como solução para divergência de migrations neste projeto.**

---

## Executando

Backend:

```bash
npm run dev
```

Dashboard:

```bash
npm run dashboard:dev
```

ou:

```bash
npm --prefix dashboard run dev
```

Frontend em desenvolvimento:

```text
http://localhost:5173
```

---

## Validação

Backend:

```bash
npm run build
npm run lint
npm test
npx prisma validate
npx prisma migrate status
```

Dashboard:

```bash
npm run dashboard:build
npm run dashboard:lint
npm run dashboard:test
```

---

## Segurança

Princípios atuais:

- senha empresarial não armazenada em texto puro;
- `scrypt` para hash de senha;
- comparação segura;
- token de sessão opaco;
- hash do token persistido;
- cookie `HttpOnly`;
- expiração absoluta e por inatividade;
- tenant resolvido no servidor;
- Platform Admin separado do Company Access;
- sessões WhatsApp fora do Git;
- preparação para HTTPS/proxy em produção.

Segurança deve continuar sendo revisada antes e depois da publicação.

---

## Git

Branch principal:

```text
main
```

Antes de alterações importantes:

```bash
git branch --show-current
git status
git log --oneline --decorate -10
```

Evite operações destrutivas como:

```text
git reset --hard
git clean
git restore .
```

---

## Próximas etapas

- calibração final;
- testes end-to-end;
- logs e observabilidade;
- backup e recuperação;
- exclusão segura de empresas e seus dados;
- refinamento de segurança;
- hospedagem;
- HTTPS e domínio;
- estratégia de manutenção;
- pagamentos quando a Fase 6 for retomada;
- linguagem natural avançada/IA;
- analytics.

---

## Identidade Código NS

Paleta principal:

```text
#0F195C  brand-900
#334DAF  brand-700
#7096D1  brand-500
#B0D4FE  brand-300
#E8F2FE  brand-100
#F9FBFF  brand-50
```

Assets:

```text
dashboard/public/brand/
```

Use logo branca em fundos escuros e logo preta em superfícies claras.

---

## Estado atual

```text
WhatsApp
   +
Conversation Engine
   +
Agendamentos
   +
PostgreSQL
   +
Multiempresa
   +
Dashboard React
   +
Company Access
   +
Platform Admin
   +
Lembretes
   +
Configuração operacional
   +
Interface responsiva
```

A próxima grande etapa é **calibrar, proteger, hospedar e preparar a base existente para produção**.

# Fase 1 — Motor de Conversação
Autor: Samuel Lisboa

Implementação da **Fase 1** do projeto de atendimento e automação via WhatsApp.

Nesta fase foi introduzido um **Motor de Conversação determinístico e desacoplado do WhatsApp**, responsável por processar mensagens normalizadas, manter o estado temporário de cada conversa e produzir respostas.

A integração construída na Fase 0 foi preservada.

---

## Objetivo

Separar as regras de conversação da integração com `whatsapp-web.js`.

O fluxo da aplicação passa a ser:

```text
WhatsApp
   ↓
WhatsApp Layer
   ↓
Normalização da mensagem
   ↓
Conversation Engine
   ↓
Estado da conversa
   ↓
Resposta
   ↓
WhatsApp
```

A camada WhatsApp continua responsável apenas pela comunicação com o WhatsApp.

O Motor de Conversação é responsável por:

* receber mensagens normalizadas;
* identificar o estado atual da conversa;
* validar a entrada;
* executar regras determinísticas;
* realizar transições de estado;
* produzir uma resposta;
* atualizar o estado temporário da conversa.

---

## Arquitetura

A estrutura relevante do projeto passa a ser:

```text
src/
├── index.ts
│
├── conversation/
│   ├── conversation.types.ts
│   ├── conversation.store.ts
│   ├── conversation.engine.ts
│   └── conversation.engine.test.ts
│
└── whatsapp/
    ├── whatsapp.client.ts
    └── whatsapp.events.ts
```

### `conversation.types.ts`

Contém os tipos utilizados internamente pelo Motor de Conversação.

Entre eles:

* estado da conversa;
* entrada normalizada;
* resultado do processamento;
* sessão armazenada em memória.

Nenhum desses tipos depende de `whatsapp-web.js`.

---

### `conversation.store.ts`

Responsável pelo armazenamento temporário do estado das conversas.

Nesta fase o armazenamento utiliza:

```text
Map<string, ConversationSession>
```

Cada conversa é identificada pelo seu `conversationId`.

O estado existe apenas em memória.

Portanto:

> Reiniciar a aplicação apaga os estados das conversas.

Isso é comportamento esperado na Fase 1.

A persistência permanente pertence a uma fase posterior.

---

### `conversation.engine.ts`

Contém a máquina de estados e as regras de conversação.

O engine recebe dados internos simples, conceitualmente:

```ts
{
  conversationId,
  text,
  type
}
```

e retorna:

```ts
{
  reply,
  state
}
```

O engine:

* não importa `whatsapp-web.js`;
* não cria clientes WhatsApp;
* não envia mensagens diretamente;
* não acessa banco de dados;
* não conhece QR Code ou autenticação;
* não depende de infraestrutura externa.

Isso permite testar toda a lógica conversacional sem iniciar o WhatsApp.

---

### `whatsapp.events.ts`

Continua responsável pelos eventos provenientes do WhatsApp.

Para mensagens recebidas, sua responsabilidade agora é:

```text
receber evento
→ validar evento
→ normalizar mensagem
→ chamar ConversationEngine
→ receber resultado
→ enviar resposta
```

As regras da máquina de estados não ficam no listener do WhatsApp.

Os eventos existentes da Fase 0 foram preservados, incluindo:

* QR Code;
* autenticação;
* cliente pronto;
* falha de autenticação;
* mensagem recebida;
* desconexão.

---

## Máquina de estados

A Fase 1 utiliza uma máquina de estados mínima:

```text
INITIAL
   │
   │ mensagem textual válida
   ▼
ACTIVE
   │
   │ novas mensagens válidas
   └──────────────► ACTIVE
```

### `INITIAL`

Estado inicial de toda nova conversa.

Quando uma mensagem textual válida é processada:

```text
INITIAL → ACTIVE
```

### `ACTIVE`

Indica que a conversa já foi iniciada.

Novas mensagens válidas mantêm:

```text
ACTIVE → ACTIVE
```

Nenhum estado relacionado a agendamento, serviços, pagamentos ou IA foi criado nesta fase.

---

## Estado por conversa

Cada `conversationId` possui estado independente.

Exemplo:

```text
Usuário A → ACTIVE
Usuário B → INITIAL
```

Uma conversa não interfere no estado de outra.

O armazenamento é realizado pelo `ConversationStore`.

---

## Comportamento atual

### Mensagem textual válida

Uma mensagem válida recebe:

```text
Olá! Sua mensagem foi recebida com sucesso.
```

Esse comportamento preserva a resposta utilizada na Fase 0.

Na primeira mensagem válida:

```text
INITIAL → ACTIVE
```

Nas mensagens seguintes:

```text
ACTIVE → ACTIVE
```

---

## Entradas inválidas

Entradas como:

```text
""
"   "
```

não causam exceções.

O motor retorna:

```text
Desculpe, não entendi.
```

Uma entrada inválida também não avança uma conversa `INITIAL` para `ACTIVE`.

---

## Mensagens não suportadas

Tipos de mensagem ainda não suportados pelo Motor de Conversação utilizam o fallback:

```text
Desculpe, não entendi.
```

Não foi implementado processamento avançado de mídia nesta fase.

---

## Proteção contra loops e eventos indesejados

A camada WhatsApp continua ignorando eventos que não devem entrar no Motor de Conversação, incluindo:

* mensagens enviadas pelo próprio cliente;
* mensagens de status;
* mensagens de grupos.

Isso evita respostas duplicadas e loops causados pelas próprias mensagens enviadas pela aplicação.

---

## Tratamento de erros

Erros de entrada são tratados pelo próprio Motor de Conversação através de respostas controladas.

Erros técnicos inesperados são capturados na fronteira da integração.

O usuário recebe uma mensagem genérica:

```text
Desculpe, ocorreu um erro ao processar sua mensagem.
```

Detalhes técnicos são registrados apenas no terminal.

Falhas ao enviar mensagens pelo WhatsApp também são tratadas separadamente.

O Motor de Conversação não implementa retry de rede.

---

## Instalação

Instale as dependências existentes do projeto:

```bash
npm install
```

A Fase 1 não adiciona frameworks, banco de dados ou bibliotecas de máquina de estados.

---

## Build

Compile o projeto:

```bash
npm run build
```

---

## Lint

Execute:

```bash
npm run lint
```

---

## Testes automatizados

Execute:

```bash
npm test
```

Os testes do Motor de Conversação utilizam recursos nativos do Node.js:

* `node:test`;
* `node:assert`.

Não foi necessário adicionar Jest ou Vitest.

### Cenários cobertos

Os testes verificam:

1. criação de uma nova conversa;
2. transição `INITIAL → ACTIVE`;
3. manutenção de uma conversa `ACTIVE`;
4. isolamento entre diferentes `conversationId`;
5. texto vazio;
6. texto contendo apenas espaços;
7. mensagem não suportada;
8. execução do engine sem criar um cliente WhatsApp.

O Motor de Conversação pode, portanto, ser testado sem autenticar ou inicializar o WhatsApp.

---

## Desenvolvimento

Inicie a aplicação normalmente:

```bash
npm run dev
```

Quando existir uma sessão válida da Fase 0, o `LocalAuth` reutiliza a autenticação armazenada.

Exemplo de inicialização:

```text
[WhatsApp] Inicializando cliente...
[WhatsApp] Autenticado.
[WhatsApp] Cliente conectado e pronto.
```

---

## Teste manual

### Primeira mensagem

Envie uma mensagem textual para a conta conectada.

O terminal deve registrar o recebimento e o processamento:

```text
[WhatsApp] Mensagem recebida: {
  from: '...',
  type: 'chat'
}

[Conversation] Mensagem processada: {
  conversationId: '...',
  state: 'ACTIVE'
}
```

O usuário deve receber:

```text
Olá! Sua mensagem foi recebida com sucesso.
```

Isso confirma:

```text
INITIAL → ACTIVE
```

---

### Segunda mensagem

Envie outra mensagem utilizando o mesmo usuário.

A conversa deve continuar:

```text
ACTIVE → ACTIVE
```

sem voltar para `INITIAL`.

---

### Dois usuários

Utilize dois números diferentes.

Fluxo esperado:

```text
Usuário A
→ primeira mensagem
→ ACTIVE

Usuário B
→ primeira mensagem
→ ACTIVE

Usuário A
→ segunda mensagem
→ continua ACTIVE
```

Os estados devem permanecer independentes.

---

## Persistência

Existem dois tipos diferentes de estado no projeto.

### Sessão WhatsApp

A autenticação do WhatsApp continua sendo gerenciada pelo `LocalAuth`.

Ela é persistida localmente e pode ser reutilizada após reiniciar a aplicação enquanto continuar válida.

Os arquivos de autenticação não devem ser versionados.

### Estado da conversa

O estado do Motor de Conversação existe somente em memória.

```text
ConversationStore
→ Map
→ memória do processo
```

Ao reiniciar a aplicação:

```text
ACTIVE → perdido
```

Uma nova mensagem será tratada novamente como uma conversa `INITIAL`.

Isso é intencional na Fase 1.

---

## Validação realizada

A integração foi validada com uma conta WhatsApp real.

Foram confirmados:

* build TypeScript;
* ESLint;
* testes automatizados;
* inicialização da aplicação;
* reutilização da autenticação existente;
* conexão do cliente;
* recebimento de mensagens;
* passagem da mensagem pelo Motor de Conversação;
* transição para `ACTIVE`;
* envio de respostas;
* preservação do funcionamento da Fase 0.

Exemplo observado:

```text
[WhatsApp] Inicializando cliente...
[WhatsApp] Autenticado.
[WhatsApp] Cliente conectado e pronto.

[WhatsApp] Mensagem recebida: {
  from: '...',
  type: 'chat'
}

[Conversation] Mensagem processada: {
  conversationId: '...',
  state: 'ACTIVE'
}
```

---

## Limitações atuais

A Fase 1 é propositalmente simples.

Ainda não existem:

* persistência permanente do estado das conversas;
* PostgreSQL;
* Prisma;
* agendamentos;
* serviços ou profissionais;
* calendário;
* dashboard;
* multiempresa;
* pagamentos;
* lembretes;
* interpretação de linguagem natural;
* OpenAI API;
* LLM;
* agentes;
* analytics.

Esses componentes pertencem às próximas fases do projeto.

---

## Princípio arquitetural

O WhatsApp é um canal de entrada e saída, não o núcleo das regras de conversação.

A arquitetura atual mantém:

```text
WhatsApp Layer
      │
      ▼
Conversation Engine
```

O `ConversationEngine` não depende do WhatsApp.

Isso significa que futuramente outro canal poderá fornecer uma entrada normalizada equivalente sem exigir que as regras da máquina de estados sejam reescritas.

---

## Status

**FASE 1 — CONCLUÍDA E VALIDADA**

O projeto possui agora:

```text
FASE 0
WhatsApp funcional
        │
        ▼
FASE 1
Motor de Conversação
        │
        ├── entrada normalizada
        ├── máquina de estados
        ├── estado independente por conversa
        ├── armazenamento temporário em memória
        ├── fallback determinístico
        └── testes automatizados
```

A aplicação está preparada para avançar para a próxima fase do roadmap sem que funcionalidades dessa fase tenham sido antecipadas.

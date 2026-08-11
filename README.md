# WhatsApp SaaS — Fase 0

Integração inicial com WhatsApp usando Node.js, TypeScript e `whatsapp-web.js`.

Nesta fase, a aplicação apenas autentica uma conta via QR Code, persiste a sessão localmente, recebe mensagens adequadas ao teste e envia uma resposta determinística. CRM, banco de dados, IA, pagamentos, agenda, dashboard e multiempresa estão fora do escopo.

## Requisitos

- Node.js 18 ou superior
- npm
- Acesso a uma conta WhatsApp no celular para escanear o QR Code
- Ambiente capaz de executar o Chromium usado pelo Puppeteer

## Instalação

```bash
npm install
```

## Desenvolvimento

Compile e inicie a aplicação:

```bash
npm run dev
```

Também estão disponíveis:

```bash
npm run build
npm start
npm run lint
```

`npm start` executa o JavaScript já compilado em `dist/`, portanto execute `npm run build` antes dele quando necessário.

## Conectar WhatsApp

Na primeira execução, o terminal exibirá um QR Code.

No celular:

1. Abra o WhatsApp.
2. Acesse **Aparelhos conectados**.
3. Escolha **Conectar um aparelho**.
4. Escaneie o QR Code mostrado no terminal.
5. Aguarde o log `[WhatsApp] Cliente conectado e pronto.`.

## Teste manual

Com a aplicação conectada:

1. Use outra conta/conversa adequada para enviar uma mensagem de texto para a conta conectada.
2. Confirme no terminal o log `[WhatsApp] Mensagem recebida`.
3. Confirme o log `[WhatsApp] Resposta enviada.`.
4. Verifique no WhatsApp o recebimento de:

```text
Olá! Sua mensagem foi recebida com sucesso.
```

Mensagens enviadas pelo próprio cliente, mensagens de status, grupos e mensagens sem texto são ignoradas para evitar loops ou respostas indiscriminadas nesta fase.

## Sessão

A autenticação é persistida por `LocalAuth` no diretório:

```text
.wwebjs_auth/
```

Esse diretório contém dados locais de sessão e está no `.gitignore`. Ele não deve ser versionado, copiado para commits nem tratado como código-fonte.

Quando a sessão continuar válida, reiniciar a aplicação deve reutilizá-la sem exigir um novo QR Code.

## Problemas conhecidos

- `whatsapp-web.js` automatiza o WhatsApp Web por meio do Puppeteer; alterações no WhatsApp Web podem afetar a integração.
- A Fase 0 não implementa reconexão automática após logout/desconexão. O evento é registrado e a aplicação pode ser reiniciada; uma sessão ainda válida é reutilizada pelo `LocalAuth`.
- A execução do Chromium pode exigir dependências do sistema operacional em ambientes Linux mínimos ou containers.
- Não há confirmação de entrega própria da aplicação; erros retornados pela biblioteca durante o envio são registrados.

## Estrutura

```text
src/
  index.ts
  whatsapp/
    whatsapp.client.ts
    whatsapp.events.ts
```

`whatsapp.client.ts` mantém a criação e o ciclo de vida do provider WhatsApp. `whatsapp.events.ts` concentra os eventos mínimos da integração e o processamento simples da mensagem.

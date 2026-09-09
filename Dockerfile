FROM node:22-bookworm-slim

WORKDIR /app

# Usa o Chromium instalado pelo Debian em vez de baixar outro navegador.
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        chromium \
        dumb-init \
        ca-certificates \
        fonts-liberation \
        fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

# Mantemos devDependencies porque o build TypeScript e o
# prisma migrate deploy precisam das ferramentas no container.
RUN npm ci --include=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

ENV NODE_ENV=production

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/index.js"]

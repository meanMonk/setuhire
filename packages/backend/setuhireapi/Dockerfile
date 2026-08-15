FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app
COPY package.json ./
RUN pnpm install
COPY . .

EXPOSE 3400
CMD ["pnpm", "exec", "tsx", "src/index.ts"]

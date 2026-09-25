# syntax=docker/dockerfile:1

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
# npm 10.9의 peer 의존성 버그를 피하려고 npm 11을 쓴다 (CLAUDE.md 참고)
RUN npm install -g npm@11
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- runtime ----
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
# 마이그레이션을 적용한 뒤 서버를 띄운다
CMD ["sh", "-c", "node node_modules/typeorm/cli.js -d dist/config/data-source.js migration:run && node dist/main.js"]

# syntax=docker/dockerfile:1
FROM node:22-slim AS web
WORKDIR /app/web
COPY web/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app/server
ENV NODE_ENV=production PORT=3000 DB_PATH=/data/panel.db
COPY server/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm install --omit=dev --no-audit --no-fund
COPY server/src ./src
COPY --from=web /app/server/public ./public
VOLUME /data
EXPOSE 3000
CMD ["npm", "start"]

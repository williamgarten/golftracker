# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci

COPY tsconfig.base.json ./
COPY shared shared
COPY server server
COPY client client
RUN npm run build


FROM node:22-alpine AS prod-deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY server/package.json server/package.json
RUN npm ci --omit=dev --workspace=shared --workspace=server --include-workspace-root


FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=prod-deps /app/node_modules ./node_modules
COPY shared/package.json ./shared/package.json
COPY --from=build /app/shared/dist ./shared/dist
COPY server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/client-dist ./server/client-dist

EXPOSE 3000
CMD ["node", "server/dist/index.js"]

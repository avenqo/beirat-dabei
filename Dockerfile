FROM node:22-slim AS bau
RUN corepack enable
WORKDIR /bau
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY app ./app
COPY docs/vorlagen ./docs/vorlagen
COPY dashboard/package.json ./dashboard/package.json
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @beirat-dabei/core build \
 && pnpm --filter @beirat-dabei/ris-adapter build \
 && pnpm --filter @beirat-dabei/handlers build
# Zum Bauen genügen Platzhalter; echte Werte kommen erst zur Laufzeit
RUN cd app && PAYLOAD_SECRET=bau MAGIC_LINK_SECRET=bau PUBLIC_URL=http://localhost pnpm build

FROM node:22-slim
ENV NODE_ENV=production NODE_OPTIONS=--no-deprecation
WORKDIR /bau
COPY --from=bau /bau /bau
RUN mkdir -p /bau/app/data && chown -R node:node /bau/app/data /bau/app/.next
USER node
WORKDIR /bau/app
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]

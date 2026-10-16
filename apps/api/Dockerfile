# Build from the repository root:  docker build -f apps/api/Dockerfile .
FROM node:22-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace apps/api --include-workspace-root

FROM deps AS build
COPY apps/api apps/api
RUN npm run db:generate -w apps/api && npm run build -w apps/api

FROM node:22-bookworm-slim AS run
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/apps/api/uploads/seed apps/api/uploads/seed
WORKDIR /app/apps/api
EXPOSE 4000
# Apply pending migrations, then start. Run `npm run db:seed` once for demo data.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]

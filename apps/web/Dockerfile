# Build from the repository root:  docker build -f apps/web/Dockerfile --build-arg API_URL=http://api:4000 .
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace apps/web --include-workspace-root

FROM deps AS build
# The /api and /uploads proxy targets are written into the build, so set API_URL here.
ARG API_URL=http://api:4000
ENV API_URL=$API_URL NEXT_TELEMETRY_DISABLED=1
COPY apps/web apps/web
RUN npm run build -w apps/web

FROM node:22-bookworm-slim AS run
ARG API_URL=http://api:4000
ENV NODE_ENV=production API_URL=$API_URL NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/web/package.json apps/web/package.json
COPY --from=build /app/apps/web/next.config.ts apps/web/next.config.ts
COPY --from=build /app/apps/web/.next apps/web/.next
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]

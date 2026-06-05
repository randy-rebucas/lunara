FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
# Copy entire package directories to preserve structure for npm ci to resolve workspaces
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
# Copy build configuration
COPY tsconfig.base.json turbo.json ./
# Install all dependencies (includes workspaces and devDependencies)
RUN npm ci --include-workspace-root

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
# Only copy API app source (not other apps like web/mobile)
COPY apps/api ./apps/api
COPY packages ./packages
COPY tsconfig.base.json turbo.json ./
# Build only the API app (Turbo will auto-build its dependencies: types, utils, validation)
RUN npm run build --workspace=@lunara/api

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/main.js"]
